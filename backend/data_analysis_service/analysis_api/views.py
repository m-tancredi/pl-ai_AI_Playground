import os
import uuid
import json
import pandas as pd
from io import StringIO
import requests
from rest_framework import generics # Assicurati che sia importato
    
from django.conf import settings
from django.core.cache import cache # Per sessioni analisi temporanee
from django.http import Http404
from django.utils import timezone

from rest_framework import views, status, permissions, exceptions, generics
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from openai import OpenAI # Nuovo SDK OpenAI

from .models import AnalysisJob
from .serializers import (
    AlgorithmSuggestionRequestSerializer, SuggestionResponseSerializer, DatasetPreviewSerializer,
    AnalysisRunRequestSerializer, AnalysisJobSubmitResponseSerializer,
    AnalysisJobSerializer
)
from .authentication import JWTCustomAuthentication
from .tasks import run_analysis_task # Importa task Celery
import uuid # Necessario per isinstance(..., uuid.UUID)
from django.core.cache import cache # Per interagire con la cache di Django
from django.conf import settings # Per DEBUG
# ... (import del modello AnalysisJob e del task run_analysis_task)
from .models import AnalysisJob
from .tasks import run_analysis_task
from .serializers import AnalysisRunRequestSerializer, AnalysisJobSubmitResponseSerializer
from .authentication import JWTCustomAuthentication
from rest_framework import permissions, status, views # Assicura che views sia importato
from rest_framework.response import Response

# Costanti per header interno
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

# Inizializza client OpenAI (se la chiave è disponibile)
openai_client = None
if settings.OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        print("OpenAI client initialized.")
    except Exception as e:
        print(f"Failed to initialize OpenAI client: {e}")
else:
    print("Warning: OPENAI_API_KEY not set. Algorithm suggestion via OpenAI will be disabled.")

# pl-ai/backend/data_analysis_service/analysis_api/views.py

# ... (altri import: os, uuid, json, pandas, StringIO, requests, settings, cache, Http404, timezone) ...
# ... (import da DRF: views, status, permissions, exceptions, generics, Response, parsers) ...
# ... (import OpenAI, models, serializers, authentication, tasks, internal API constants) ...

class SuggestAlgorithmView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_dataframe_from_request(self, request_data, request_files): # Aggiunto request_files
        """Helper per ottenere DataFrame da resource_id o file upload."""
        df = None
        resource_id_from_data = request_data.get('resource_id') # Può essere stringa UUID o int a seconda della correzione precedente
        uploaded_file_obj = request_files.get('file') # Prendi da request.FILES

        original_filename_for_job = "uploaded_file.csv" # Default
        source_type = "unknown"

        if resource_id_from_data:
            resource_id_str = str(resource_id_from_data) # Assicura sia stringa
            print(f"Suggest Algo: Fetching dataset from Resource Manager for resource_id: {resource_id_str}")
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/{resource_id_str}/content/"
            headers = {'Accept': 'text/csv'}
            if INTERNAL_API_SECRET: headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET
            
            response = requests.get(resource_url, headers=headers, timeout=30)
            response.raise_for_status()
            csv_content = response.text
            df = pd.read_csv(StringIO(csv_content))
            # Prova a ottenere il nome originale dalla risposta del resource manager se possibile
            # Per ora, potremmo doverlo passare o recuperare separatamente
            # Potremmo anche recuperare i metadati della risorsa dal RM
            # Qui assumiamo che il nome originale non sia facilmente disponibile dalla chiamata /content/
            # Lo passeremo dal frontend o lo prenderemo da un'altra chiamata API se necessario.
            # Per ora, questo non è critico per la logica di suggestion.
            # original_filename_for_job = f"resource_{resource_id_str}.csv" # O recuperarlo
            source_type = "resource_manager"
            print(f"Suggest Algo: DataFrame loaded from Resource Manager. Shape: {df.shape}")

        elif uploaded_file_obj:
            print(f"Suggest Algo: Processing uploaded file: {uploaded_file_obj.name}")
            if not uploaded_file_obj.name.lower().endswith('.csv'):
                raise exceptions.ParseError("Uploaded file is not a CSV.")
            try:
                df = pd.read_csv(uploaded_file_obj)
                original_filename_for_job = uploaded_file_obj.name
                source_type = "upload"
            except pd.errors.ParserError as e:
                raise exceptions.ParseError(f"Error parsing uploaded CSV: {e}")
            print(f"Suggest Algo: DataFrame loaded from upload. Shape: {df.shape}")
        
        return df, original_filename_for_job, source_type, resource_id_from_data if resource_id_from_data else None


    def post(self, request, *args, **kwargs):
        print("--- SuggestAlgorithmView Received Data ---")
        print(f"request.data: {request.data}")
        print(f"request.FILES: {request.FILES}")
        print("--- End Received Data ---")

        serializer = AlgorithmSuggestionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            print("--- SuggestAlgorithmView Serializer Errors ---")
            print(serializer.errors)
            print("--- End Serializer Errors ---")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        df = None
        original_filename_for_cache = "default_filename.csv"
        source_type_for_cache = "unknown"
        resource_id_for_cache = None

        try:
            # Passa request.FILES a _get_dataframe_from_request
            df, original_filename_for_cache, source_type_for_cache, resource_id_for_cache = self._get_dataframe_from_request(serializer.validated_data, request.FILES)
            if df is None or df.empty:
                return Response({"error": "Could not load or process dataset from provided input."}, status=status.HTTP_400_BAD_REQUEST)

        except requests.exceptions.RequestException as e:
            print(f"Error in SuggestAlgorithmView (RequestException): {e}")
            return Response({"error": f"Failed to retrieve resource: Network or Resource Manager error."}, status=status.HTTP_502_BAD_GATEWAY)
        except exceptions.ParseError as e: # Errore da _get_dataframe o validazione serializer
            print(f"Error in SuggestAlgorithmView (ParseError): {e.detail}")
            return Response({"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in SuggestAlgorithmView (_get_dataframe general exception): {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred while preparing data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- Prepara preview e dati per OpenAI ---
        sample_df_openai = df.head(min(len(df), 100))
        headers = list(df.columns)
        sample_rows_preview = df.head(10).to_dict(orient='records')

        dataset_preview_data = {
            "headers": headers,
            "sample_rows": sample_rows_preview,
            "num_rows_sample": len(sample_df_openai), # Numero righe nel campione inviato a OpenAI
            "num_cols": len(headers)
        }

        # --- Chiamata a OpenAI per suggerimenti ---
        suggestions = []
        if openai_client:
            try:
                prompt_detail = "Dataset Sample (first few rows):\n" # ... (prompt dettagliato come prima) ...
                prompt_detail += sample_df_openai.to_string(index=False, max_rows=10, max_cols=10) + "\n\n"
                prompt_detail += f"Column Headers: {', '.join(headers)}\n"
                prompt_detail += f"Number of rows in sample: {len(sample_df_openai)}\n"
                prompt_detail += f"Number of columns: {len(headers)}\n\n"
                prompt_detail += "Based on this CSV data sample, suggest suitable machine learning algorithms from the list ['linear_regression', 'polynomial_regression', 'decision_tree_regressor', 'random_forest_regressor', 'svr', 'logistic_regression', 'svc', 'decision_tree_classifier', 'random_forest_classifier', 'naive_bayes_classifier'].\n"
                prompt_detail += "For each suggestion, provide ALL of the following fields in a JSON object:\n"
                prompt_detail += "1. 'algorithm_name': User-friendly name (e.g., 'Linear Regression').\n"
                prompt_detail += "2. 'algorithm_key': The standardized key from the list above.\n"
                prompt_detail += "3. 'task_type': Either 'regression' or 'classification'.\n"
                prompt_detail += "4. 'motivation': Brief reason why this algorithm is suitable (1-2 sentences).\n"
                prompt_detail += "5. 'suggested_features': A list of 2-3 column names from the dataset that could be good initial features. Choose varied types if possible.\n"
                prompt_detail += "6. 'suggested_target': A single column name that could be a suitable target variable.\n"
                prompt_detail += "If a task type preference is given, prioritize algorithms for that task.\n"
                if serializer.validated_data.get('task_type_preference'):
                    prompt_detail += f"Task type preference: {serializer.validated_data['task_type_preference']}\n"
                prompt_detail += "Return the response as a JSON object containing a single key 'suggestions' which is an array of suggestion objects. Each object must contain all 6 fields. If no suitable algorithms are found from the list, return an empty array for 'suggestions'."

                print(f"Sending prompt to OpenAI for suggestions. Length: {len(prompt_detail)}")
                completion = openai_client.chat.completions.create(
                    model="gpt-3.5-turbo", # O gpt-4
                    messages=[ {"role": "system", "content": "You are a data scientist assistant providing ML algorithm suggestions in JSON format."}, {"role": "user", "content": prompt_detail} ],
                    response_format={"type": "json_object"},
                    temperature=0.3, max_tokens=1024
                )
                ai_response_content = completion.choices[0].message.content
                print(f"OpenAI Raw Suggestion Response: {ai_response_content}")
                try:
                    parsed_response = json.loads(ai_response_content)
                    if isinstance(parsed_response, dict) and 'suggestions' in parsed_response and isinstance(parsed_response['suggestions'], list):
                        suggestions = parsed_response['suggestions']
                    else:
                        print("Warning: OpenAI response was JSON, but not in the expected {suggestions: list} format.")
                except json.JSONDecodeError:
                    print(f"Warning: Failed to parse OpenAI response as JSON: {ai_response_content}")
            except Exception as openai_exc:
                print(f"Error calling OpenAI for suggestions: {openai_exc}")
        else:
            print("OpenAI client not initialized, skipping AI suggestions.")

        # --- Salva dati temporanei in Cache ---
        analysis_session_id = uuid.uuid4() # Genera un nuovo ID sessione
        cache_key_data = f"analysis_session_data_{analysis_session_id}"
        cache_key_headers = f"analysis_session_headers_{analysis_session_id}"
        cache_key_resource_info = f"analysis_session_resource_info_{analysis_session_id}"

        # Salva il DataFrame completo
        df_json_string = df.to_json(orient='split', date_format='iso') # 'split' per preservare tipi
        cache.set(cache_key_data, df_json_string, timeout=3600) # Cache per 1 ora
        cache.set(cache_key_headers, headers, timeout=3600)

        # Salva info sulla risorsa originale
        resource_info_for_cache = {
            "original_filename": original_filename_for_cache,
            "source": source_type_for_cache
        }
        if resource_id_for_cache: # Solo se veniva da un resource_id esistente
            resource_info_for_cache["resource_id"] = str(resource_id_for_cache) # Assicura sia stringa

        cache.set(cache_key_resource_info, resource_info_for_cache, timeout=3600)
        print(f"Dataset (shape: {df.shape}), headers, and resource info cached with session ID: {analysis_session_id}")

        response_data = {
            "analysis_session_id": analysis_session_id,
            "dataset_preview": dataset_preview_data,
            "suggestions": suggestions
        }
        # Non c'è bisogno di serializzare response_data con SuggestionResponseSerializer
        # se è già nel formato corretto e tutti i suoi campi sono JSON-serializzabili.
        # Ma se vuoi essere sicuro, puoi usarlo:
        # response_serializer = SuggestionResponseSerializer(response_data)
        # return Response(response_serializer.data, status=status.HTTP_200_OK)
        return Response(response_data, status=status.HTTP_200_OK)

# ... (RunAnalysisView e AnalysisResultView come prima, assicurati che RunAnalysisView
#      recuperi `original_filename` e `resource_id` dalla cache usando
#      `cached_resource_info = cache.get(f"analysis_session_resource_info_{analysis_session_id}")`
#      e li usi quando crea l'oggetto AnalysisJob) ...

# pl-ai/backend/data_analysis_service/analysis_api/views.py

# ... (altri import: os, json, pandas, StringIO, requests, settings, Http404, timezone) ...
# ... (import da DRF: views, status, permissions, exceptions, generics, Response, parsers) ...
# ... (import OpenAI, models, serializers, authentication, tasks, internal API constants) ...



class RunAnalysisView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        print("--- RunAnalysisView Received Request Data ---")
        print(f"request.data: {request.data}")
        print("--- End Received Request Data ---")

        serializer = AnalysisRunRequestSerializer(data=request.data)
        if not serializer.is_valid():
            print("--- RunAnalysisView Serializer Errors ---")
            print(serializer.errors)
            print("--- End Serializer Errors ---")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        user_id = request.user.id
        # analysis_session_id è già un oggetto UUID dal serializer se la validazione è passata
        analysis_session_id_obj = validated_data['analysis_session_id']
        analysis_session_id_str = str(analysis_session_id_obj) # Converti in stringa per la cache key

        print(f"Processing run request for session ID: {analysis_session_id_str}")

        # --- Recupera dati dalla Cache ---
        cache_key_data = f"analysis_session_data_{analysis_session_id_str}"
        cache_key_headers = f"analysis_session_headers_{analysis_session_id_str}"
        cache_key_resource_info = f"analysis_session_resource_info_{analysis_session_id_str}"

        cached_df_json = cache.get(cache_key_data)
        cached_headers = cache.get(cache_key_headers)
        cached_resource_info = cache.get(cache_key_resource_info)

        if not cached_df_json or not cached_headers or not cached_resource_info:
            print(f"Cache miss for session {analysis_session_id_str}. Data: {bool(cached_df_json)}, Headers: {bool(cached_headers)}, ResourceInfo: {bool(cached_resource_info)}")
            return Response({"error": "Analysis session data expired or incomplete. Please restart the suggestion process."}, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"Data successfully retrieved from cache for session ID: {analysis_session_id_str}")
        print(f"Cached resource info: {cached_resource_info}")


        # --- Validazione Features/Target contro Header Cachati ---
        for feature in validated_data['selected_features']:
            if feature not in cached_headers:
                error_msg = f"Selected feature '{feature}' not found in dataset headers. Available headers: {cached_headers}"
                print(f"Validation Error: {error_msg}")
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        if validated_data['selected_target'] not in cached_headers:
            error_msg = f"Selected target '{validated_data['selected_target']}' not found in dataset headers. Available headers: {cached_headers}"
            print(f"Validation Error: {error_msg}")
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
        print("Features and target validation passed.")

        try:
            # Prepara input_parameters per il salvataggio nel DB
            # validated_data contiene già tutti i parametri necessari e corretti dal serializer
            # Converti analysis_session_id (che è UUID object) in stringa per JSONField
            input_params_for_db = validated_data.copy() # Fai una copia
            input_params_for_db['analysis_session_id'] = str(input_params_for_db['analysis_session_id'])

            # --- Crea record AnalysisJob ---
            job = AnalysisJob.objects.create(
                owner_id=user_id,
                # Usa i valori da cached_resource_info
                resource_id=cached_resource_info.get('resource_id'), # Sarà None o un ID (convertito in int nel modello se necessario)
                original_filename=cached_resource_info.get('original_filename', 'analysis_dataset.csv'),
                task_type=validated_data['task_type'],
                selected_algorithm_key=validated_data['selected_algorithm_key'],
                input_parameters=input_params_for_db, # Salva tutti i parametri, inclusa la session_id stringa
                status=AnalysisJob.Status.PENDING
            )
            print(f"Created AnalysisJob {job.id}, status PENDING. Original filename: {job.original_filename}, Resource ID from job: {job.resource_id}")

            # --- Invia task Celery ---
            # Passa l'ID del job (che è un UUID, convertito in stringa)
            job_id_str_for_task = str(job.id)
            print(f"Dispatching run_analysis_task for job ID (string): {job_id_str_for_task} to queue 'analysis_tasks'")
            run_analysis_task.apply_async(args=[job_id_str_for_task], queue='analysis_tasks')
            
            # --- Prepara e Restituisci Risposta ---
            response_data_dict = {
                "analysis_job_id": job_id_str_for_task, # Usa l'ID stringa
                "status": job.status,
                "message": "Analysis task submitted successfully."
            }
            # Non c'è bisogno di ri-serializzare un dizionario semplice se è già nel formato corretto
            # response_serializer = AnalysisJobSubmitResponseSerializer(response_data_dict)
            # return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)
            return Response(response_data_dict, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
            print(f"Error creating AnalysisJob or dispatching task: {e}")
            if settings.DEBUG:
                import traceback
                traceback.print_exc()
            # Se il job è stato creato ma il dispatch fallisce, potremmo volerlo marcare come FAILED
            if 'job' in locals() and job.pk:
                try:
                    job.status = AnalysisJob.Status.FAILED
                    job.error_message = f"Failed to dispatch task: {str(e)[:500]}"
                    job.job_finished_at = timezone.now()
                    job.save()
                except Exception as save_err:
                    print(f"Could not update job {job.id} to FAILED status: {save_err}")

            return Response({"error": "Failed to submit analysis task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalysisResultView(generics.RetrieveAPIView):
    """Recupera lo stato e i risultati di un AnalysisJob."""
    queryset = AnalysisJob.objects.all()
    serializer_class = AnalysisJobSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    # --- CORREZIONE QUI ---
    # Specifica che il campo nel modello da usare per il lookup è 'id'
    lookup_field = 'id'
    # Specifica che il nome del keyword argument dall'URL è 'analysis_job_id'
    lookup_url_kwarg = 'analysis_job_id'
    # --- FINE CORREZIONE ---

    def get_queryset(self):
        # Filtra per assicurare che l'utente possa vedere solo i propri job
        user = self.request.user
        # JWTCustomAuthentication assicura che user.id esista
        return AnalysisJob.objects.filter(owner_id=user.id)
