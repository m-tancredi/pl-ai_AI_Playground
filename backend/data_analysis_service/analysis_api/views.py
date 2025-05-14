import os
import uuid
import json
import pandas as pd
from io import StringIO
import requests
import joblib # Per caricare modello e preprocessor
from rest_framework import generics # Assicurati che sia importato
    
from django.conf import settings
from django.core.cache import cache # Per sessioni analisi temporanee
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from pathlib import Path

from rest_framework import views, status, permissions, exceptions, generics
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from openai import OpenAI # Nuovo SDK OpenAI

from .models import AnalysisJob
from .serializers import (
    AlgorithmSuggestionRequestSerializer, SuggestionResponseSerializer, DatasetPreviewSerializer,
    AnalysisRunRequestSerializer, AnalysisJobSubmitResponseSerializer,
    AnalysisJobSerializer, InstanceFeaturesSerializer, ClassificationPredictionSerializer 
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

class PredictInstanceView(views.APIView):
    """
    Esegue una predizione per una singola istanza usando un modello di classificazione addestrato.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, analysis_job_id, *args, **kwargs):
        # 1. Recupera il Job di Analisi
        job = get_object_or_404(AnalysisJob, pk=analysis_job_id, owner_id=request.user.id)

        if job.status != AnalysisJob.Status.COMPLETED:
            return Response({"error": "Analysis job is not completed. Current status: " + job.status}, status=status.HTTP_400_BAD_REQUEST)
        if job.task_type != 'classification':
            return Response({"error": "This endpoint is for classification models only."}, status=status.HTTP_400_BAD_REQUEST)

        # Verifica che i path necessari siano presenti
        model_file_path_str = job.model_path.name if job.model_path else None # model_path è un FileField, .name dà il path relativo
        preprocessor_path_str = job.input_parameters.get('preprocessor_path')
        
        if not model_file_path_str or not preprocessor_path_str:
            return Response({"error": "Model or preprocessor path not found for this job. Please ensure training was successful and paths are saved."}, status=status.HTTP_404_NOT_FOUND)

        # 2. Valida le feature in input
        input_serializer = InstanceFeaturesSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        instance_features_dict_from_request = input_serializer.validated_data['features']

        try:
            # 3. Carica Modello, Preprocessor e LabelEncoder (se esiste)
            model_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / model_file_path_str
            preprocessor_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / preprocessor_path_str
            
            if not model_full_path.exists() or not preprocessor_full_path.exists():
                print(f"Error: Model file {model_full_path} or preprocessor {preprocessor_full_path} does not exist.")
                raise FileNotFoundError("Model or preprocessor file missing on server.")

            print(f"Loading model from: {model_full_path}")
            model = joblib.load(model_full_path)
            print(f"Loading preprocessor from: {preprocessor_full_path}")
            preprocessor = joblib.load(preprocessor_full_path)
            
            label_encoder = None
            le_path_rel = job.input_parameters.get('label_encoder_path')
            if le_path_rel:
                le_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / le_path_rel
                if le_full_path.exists():
                    print(f"Loading label encoder from: {le_full_path}")
                    label_encoder = joblib.load(le_full_path)
                else:
                    print(f"Warning: Label encoder file not found at {le_full_path}, will use numeric labels or class_names from job.")

            # 4. Prepara l'istanza per la predizione
            # L'ordine delle feature DEVE corrispondere a quello usato per addestrare il preprocessor
            original_features_order = job.input_parameters.get('selected_features', [])
            if not original_features_order:
                return Response({"error": "Original feature list not found in job parameters. Cannot prepare data for prediction."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Verifica che tutte le feature necessarie siano presenti nell'input
            if not all(feat_name in instance_features_dict_from_request for feat_name in original_features_order):
                 missing_feats = [f for f in original_features_order if f not in instance_features_dict_from_request]
                 return Response({"error": f"Missing feature(s) in input: {', '.join(missing_feats)}. Expected all of: {original_features_order}"}, status=status.HTTP_400_BAD_REQUEST)

            # Crea DataFrame con una riga nell'ordine corretto
            # Prova a convertire in numerico se possibile, altrimenti lascia stringa
            instance_df_data_ordered = {}
            for feat in original_features_order:
                val = instance_features_dict_from_request[feat]
                try:
                    instance_df_data_ordered[feat] = [float(val)] # Tenta float per coerenza con Scikit-learn
                except (ValueError, TypeError):
                    instance_df_data_ordered[feat] = [val] # Lascia come stringa se non convertibile

            instance_df = pd.DataFrame(instance_df_data_ordered)
            print(f"Instance DataFrame for prediction: {instance_df}")

            # Applica preprocessor
            instance_transformed = preprocessor.transform(instance_df)
            print(f"Instance transformed shape: {instance_transformed.shape}")

            # 5. Esegui Predizione
            prediction_numeric_array = model.predict(instance_transformed)
            predicted_class_numeric = prediction_numeric_array[0] # È un array, prendi il primo elemento

            predicted_class_name = str(predicted_class_numeric) # Default se non c'è encoder/nomi
            if label_encoder:
                try:
                    predicted_class_name = str(label_encoder.inverse_transform([predicted_class_numeric])[0])
                except Exception as le_err:
                    print(f"Warning: Error inverse transforming label with LabelEncoder: {le_err}. Using numeric label.")
            elif job.class_names and isinstance(job.class_names, list): # Usa i nomi salvati nel job
                try:
                    if int(predicted_class_numeric) < len(job.class_names):
                       predicted_class_name = job.class_names[int(predicted_class_numeric)]
                    else:
                         print(f"Warning: Predicted numeric label {predicted_class_numeric} out of bounds for job.class_names (len {len(job.class_names)}).")
                except (ValueError, TypeError, IndexError) as map_err:
                     print(f"Warning: Error mapping numeric label to class name from job.class_names: {map_err}.")


            probabilities_dict = None
            if hasattr(model, "predict_proba"):
                proba_numeric_array = model.predict_proba(instance_transformed)[0]
                class_names_for_proba = []
                if label_encoder and hasattr(label_encoder, 'classes_'):
                    class_names_for_proba = label_encoder.classes_.tolist()
                elif job.class_names and isinstance(job.class_names, list):
                    class_names_for_proba = job.class_names
                else: # Fallback
                    class_names_for_proba = [f"Class_{i}" for i in range(len(proba_numeric_array))]

                if len(class_names_for_proba) == len(proba_numeric_array):
                    probabilities_dict = {str(class_names_for_proba[i]): float(proba_numeric_array[i]) for i in range(len(proba_numeric_array))}
                else:
                    print(f"Warning: Length mismatch between class_names_for_proba ({len(class_names_for_proba)}) and proba_numeric_array ({len(proba_numeric_array)}). Skipping probabilities.")


            # 6. Restituisci Risultato
            result_data = {
                "predicted_class": predicted_class_name,
                "probabilities": probabilities_dict
            }
            response_serializer = ClassificationPredictionSerializer(result_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except FileNotFoundError as e:
            print(f"Error predicting instance for job {analysis_job_id} (File Not Found): {e}")
            return Response({"error": "Model data or preprocessor not found. The job might need to be re-run or files are missing."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error predicting instance for job {analysis_job_id}: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred during prediction."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    """
    Esegue una predizione per una singola istanza usando un modello di classificazione addestrato.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, analysis_job_id, *args, **kwargs):
        # 1. Recupera il Job di Analisi
        job = get_object_or_404(AnalysisJob, pk=analysis_job_id, owner_id=request.user.id)

        if job.status != AnalysisJob.Status.COMPLETED:
            return Response({"error": "Analysis job is not completed."}, status=status.HTTP_400_BAD_REQUEST)
        if job.task_type != 'classification':
            return Response({"error": "This endpoint is for classification models only."}, status=status.HTTP_400_BAD_REQUEST)
        if not job.model_path or not job.input_parameters.get('preprocessor_path'):
            return Response({"error": "Model or preprocessor path not found for this job."}, status=status.HTTP_404_NOT_FOUND)

        # 2. Valida le feature in input
        input_serializer = InstanceFeaturesSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        instance_features_dict = input_serializer.validated_data['features']

        try:
            # 3. Carica Modello e Preprocessor
            model_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / job.model_path.name # model_path è un FileField
            preprocessor_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / job.input_parameters['preprocessor_path']
            
            if not model_full_path.exists() or not preprocessor_full_path.exists():
                raise FileNotFoundError("Model or preprocessor file missing on server.")

            model = joblib.load(model_full_path)
            preprocessor = joblib.load(preprocessor_full_path)
            
            # Carica LabelEncoder se esiste
            label_encoder = None
            le_path_rel = job.input_parameters.get('label_encoder_path')
            if le_path_rel:
                le_full_path = Path(settings.ANALYSIS_RESULTS_ROOT) / le_path_rel
                if le_full_path.exists():
                    label_encoder = joblib.load(le_full_path)
                else:
                    print(f"Warning: Label encoder file not found at {le_full_path}")

            # 4. Prepara l'istanza per la predizione
            # Assicurati che le feature siano nell'ordine corretto atteso dal preprocessor/modello
            # Il preprocessor è stato fittato sulle `selected_features` originali
            original_features_order = job.input_parameters.get('selected_features', [])
            if not all(feat_name in instance_features_dict for feat_name in original_features_order):
                 missing_feats = [f for f in original_features_order if f not in instance_features_dict]
                 return Response({"error": f"Missing feature(s) in input: {', '.join(missing_feats)}. Expected: {original_features_order}"}, status=status.HTTP_400_BAD_REQUEST)

            # Crea DataFrame con una riga nell'ordine corretto
            instance_df_data = {feat: [instance_features_dict.get(feat)] for feat in original_features_order}
            instance_df = pd.DataFrame(instance_df_data)

            # Applica preprocessor
            instance_transformed = preprocessor.transform(instance_df)

            # 5. Esegui Predizione
            prediction_numeric = model.predict(instance_transformed) # Restituisce array (es. [0])
            predicted_class_numeric = prediction_numeric[0]

            predicted_class_name = str(predicted_class_numeric) # Default a numerico
            if label_encoder:
                try:
                    predicted_class_name = label_encoder.inverse_transform([predicted_class_numeric])[0]
                except Exception as le_err:
                    print(f"Error inverse transforming label: {le_err}. Using numeric label.")
            elif job.results and 'confusion_matrix_labels' in job.results and isinstance(job.results['confusion_matrix_labels'], list):
                # Prova a usare i nomi classi salvati nelle metriche se LabelEncoder non c'è
                try:
                    predicted_class_name = job.results['confusion_matrix_labels'][int(predicted_class_numeric)]
                except (IndexError, ValueError) as map_err:
                     print(f"Error mapping numeric label to class name: {map_err}. Using numeric label.")


            probabilities = None
            if hasattr(model, "predict_proba"):
                proba_numeric = model.predict_proba(instance_transformed)[0]
                class_names_for_proba = label_encoder.classes_ if label_encoder else job.results.get('confusion_matrix_labels', [str(i) for i in range(len(proba_numeric))])
                probabilities = {str(class_names_for_proba[i]): float(proba_numeric[i]) for i in range(len(proba_numeric))}

            # 6. Restituisci Risultato
            result_data = {
                "predicted_class": predicted_class_name,
                "probabilities": probabilities
            }
            response_serializer = ClassificationPredictionSerializer(result_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except FileNotFoundError as e:
            print(f"Error predicting instance for job {analysis_job_id}: {e}")
            return Response({"error": "Model data not found. The job might need to be re-run."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error predicting instance for job {analysis_job_id}: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred during prediction."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)