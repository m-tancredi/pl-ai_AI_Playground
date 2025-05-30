# pl-ai/backend/data_analysis_service/analysis_api/views.py
import os
import uuid
import json
import pandas as pd
from io import StringIO
import requests
import joblib
from pathlib import Path
import traceback # Per loggare stack trace completi

from django.conf import settings
from django.core.cache import cache
from django.http import Http404 # HttpResponse non è usata direttamente qui
from django.shortcuts import get_object_or_404 # Già importato, ma per chiarezza
from django.utils import timezone
# from django.core.exceptions import ValidationError as DjangoValidationError # Non usata direttamente qui

from rest_framework import views, status, permissions, exceptions, generics
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from openai import OpenAI # Nuovo SDK OpenAI

from .models import AnalysisJob, SyntheticDatasetJob
from .serializers import (
    AlgorithmSuggestionRequestSerializer, SuggestionResponseSerializer, DatasetPreviewSerializer,
    AnalysisRunRequestSerializer, AnalysisJobSubmitResponseSerializer,
    AnalysisJobSerializer, InstanceFeaturesSerializer, ClassificationPredictionSerializer,
    RegressionPredictionSerializer, SyntheticCsvRequestSerializer, SyntheticDatasetJobSubmitResponseSerializer, SyntheticDatasetJobSerializer # Nuovi
 # Assicurati sia definito in serializers.py
)
from .authentication import JWTCustomAuthentication
from .tasks import run_analysis_task, generate_synthetic_csv_task

# Costanti per header interno
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

# Inizializza client OpenAI
openai_client = None
if settings.OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        print("OpenAI client initialized in views.")
    except Exception as e:
        print(f"Failed to initialize OpenAI client in views: {e}")
else:
    print("Warning: OPENAI_API_KEY Docker Secret not found or not set in Django settings. Algorithm suggestion via OpenAI will be disabled.")


class SuggestAlgorithmView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser] # Accetta file o resource_id

    def _get_dataframe_from_request(self, request_data, request_files):
        df = None
        # Assumiamo che resource_id sia un intero come da correzione precedente
        resource_id_from_data = request_data.get('resource_id')
        uploaded_file_obj = request_files.get('file')

        original_filename_for_job = "uploaded_file.csv"
        source_type = "unknown"
        # Inizializza resource_id che verrà ritornato
        actual_resource_id_used = None

        if resource_id_from_data:
            actual_resource_id_used = str(resource_id_from_data) # Usiamo la stringa per la chiamata API
            print(f"Suggest Algo: Fetching dataset from Resource Manager for resource_id: {actual_resource_id_used}")
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/{actual_resource_id_used}/content/"
            headers = {'Accept': 'text/csv'}
            if INTERNAL_API_SECRET: headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET
            
            response = requests.get(resource_url, headers=headers, timeout=30)
            response.raise_for_status()
            csv_content = response.text
            df = pd.read_csv(StringIO(csv_content))
            # TODO: Recuperare original_filename dal Resource Manager se _get_dataframe_from_request lo usa
            # Per ora, non è critico per il flusso di suggestion.
            source_type = "resource_manager"
            print(f"Suggest Algo: DataFrame loaded from RM. Shape: {df.shape}")

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
        
        # Ritorna l'ID della risorsa (o None se era un upload) e il nome del file
        return df, original_filename_for_job, source_type, actual_resource_id_used


    def post(self, request, *args, **kwargs):
        print("--- SuggestAlgorithmView Received Request Data ---")
        print(f"request.data: {request.data}")
        print(f"request.FILES: {request.FILES}")
        print("--- End Received Request Data ---")

        serializer = AlgorithmSuggestionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            print("--- SuggestAlgorithmView Serializer Errors ---")
            print(serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        df = None
        original_filename_for_cache = "default_filename.csv"
        source_type_for_cache = "unknown"
        resource_id_for_cache = None # Sarà l'ID della risorsa *se* usata, altrimenti None

        try:
            df, original_filename_for_cache, source_type_for_cache, resource_id_for_cache = \
                self._get_dataframe_from_request(serializer.validated_data, request.FILES)
            
            if df is None or df.empty:
                return Response({"error": "Could not load or process dataset from provided input."}, status=status.HTTP_400_BAD_REQUEST)

        except requests.exceptions.RequestException as e:
            print(f"Error in SuggestAlgorithmView (RequestException fetching resource): {e}")
            return Response({"error": f"Failed to retrieve resource: Network or Resource Manager error."}, status=status.HTTP_502_BAD_GATEWAY)
        except exceptions.ParseError as e:
            print(f"Error in SuggestAlgorithmView (ParseError from CSV): {e.detail}")
            return Response({"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in SuggestAlgorithmView (_get_dataframe general exception): {e}")
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred while preparing data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        sample_df_openai = df.head(min(len(df), 100))
        headers = list(df.columns)
        sample_rows_preview = df.head(10).to_dict(orient='records')

        dataset_preview_data = {
            "headers": headers, "sample_rows": sample_rows_preview,
            "num_rows_sample": len(sample_df_openai), "num_cols": len(headers)
        }
        suggestions = []
        if openai_client:
            try:
                prompt_detail = f"Dataset Sample (first {len(sample_df_openai)} rows):\n{sample_df_openai.to_string(index=False, max_rows=10, max_cols=10)}\n\n"
                prompt_detail += f"Column Headers: {', '.join(headers)}\n"
                prompt_detail += f"Total columns: {len(headers)}\n\n"

                # --- Nuova sezione: statistiche sulle colonne ---
                prompt_detail += "Column statistics:\n"
                likely_class_cols = []
                for col in df.columns:
                    unique_vals = df[col].nunique(dropna=True)
                    dtype = str(df[col].dtype)
                    if unique_vals <= 10:
                        vals = df[col].dropna().unique().tolist()
                        prompt_detail += f"- {col}: {dtype}, unique={unique_vals}, values={vals}\n"
                    elif dtype.startswith('float') or dtype.startswith('int'):
                        prompt_detail += f"- {col}: {dtype}, unique={unique_vals}, min={df[col].min()}, max={df[col].max()}, mean={df[col].mean()}\n"
                    else:
                        prompt_detail += f"- {col}: {dtype}, unique={unique_vals}\n"
                    # Candidata per classificazione?
                    if unique_vals <= 10 or any(x in col.lower() for x in ['class', 'label', 'target', 'category']):
                        likely_class_cols.append(col)
                if likely_class_cols:
                    prompt_detail += f"Columns likely to be classification targets: {', '.join(likely_class_cols)}\n"

                # --- Nuova sezione: correlazione feature-target ---
                correlation_info = ""
                fit_test_info = ""
                from sklearn.linear_model import LinearRegression, LogisticRegression
                from sklearn.preprocessing import PolynomialFeatures
                from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
                from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
                from sklearn.svm import SVR, SVC
                from sklearn.naive_bayes import GaussianNB
                from sklearn.metrics import r2_score, mean_squared_error, accuracy_score, f1_score
                target_col = headers[-1] if headers else None
                if target_col and target_col in df.columns:
                    y = df[target_col].dropna()
                    # REGRESSIONE
                    if pd.api.types.is_numeric_dtype(df[target_col]):
                        for col in df.columns:
                            if col == target_col or not pd.api.types.is_numeric_dtype(df[col]):
                                continue
                            X = df[[col]].dropna()
                            y_aligned = y.loc[X.index]
                            if len(X) < 10:
                                continue
                            results = []
                            # Linear Regression
                            linreg = LinearRegression().fit(X, y_aligned)
                            y_pred_lin = linreg.predict(X)
                            r2_lin = r2_score(y_aligned, y_pred_lin)
                            mse_lin = mean_squared_error(y_aligned, y_pred_lin)
                            results.append(("linear_regression", r2_lin, mse_lin))
                            # Polynomial Regression
                            poly = PolynomialFeatures(degree=2)
                            X_poly = poly.fit_transform(X)
                            polyreg = LinearRegression().fit(X_poly, y_aligned)
                            y_pred_poly = polyreg.predict(X_poly)
                            r2_poly = r2_score(y_aligned, y_pred_poly)
                            mse_poly = mean_squared_error(y_aligned, y_pred_poly)
                            results.append(("polynomial_regression", r2_poly, mse_poly))
                            # Decision Tree
                            dtr = DecisionTreeRegressor(max_depth=6, random_state=42).fit(X, y_aligned)
                            y_pred_dtr = dtr.predict(X)
                            r2_dtr = r2_score(y_aligned, y_pred_dtr)
                            mse_dtr = mean_squared_error(y_aligned, y_pred_dtr)
                            results.append(("decision_tree_regressor", r2_dtr, mse_dtr))
                            # Random Forest
                            rfr = RandomForestRegressor(n_estimators=30, max_depth=8, random_state=42).fit(X, y_aligned)
                            y_pred_rfr = rfr.predict(X)
                            r2_rfr = r2_score(y_aligned, y_pred_rfr)
                            mse_rfr = mean_squared_error(y_aligned, y_pred_rfr)
                            results.append(("random_forest_regressor", r2_rfr, mse_rfr))
                            # SVR
                            svr = SVR(kernel='rbf', max_iter=500).fit(X, y_aligned)
                            y_pred_svr = svr.predict(X)
                            r2_svr = r2_score(y_aligned, y_pred_svr)
                            mse_svr = mean_squared_error(y_aligned, y_pred_svr)
                            results.append(("svr", r2_svr, mse_svr))
                            fit_test_info += f"\nFeature: {col} vs Target: {target_col}\n"
                            for name, r2, mse in results:
                                fit_test_info += f"- {name}: R2={r2:.3f}, MSE={mse:.3f}\n"
                    # CLASSIFICAZIONE
                    elif pd.api.types.is_categorical_dtype(df[target_col]) or df[target_col].nunique() < 20:
                        for col in df.columns:
                            if col == target_col or not pd.api.types.is_numeric_dtype(df[col]):
                                continue
                            X = df[[col]].dropna()
                            y_aligned = y.loc[X.index]
                            if len(X) < 10:
                                continue
                            y_bin = y_aligned.astype(str)
                            results = []
                            # Logistic Regression
                            try:
                                logreg = LogisticRegression(max_iter=200).fit(X, y_bin)
                                y_pred_log = logreg.predict(X)
                                acc_log = accuracy_score(y_bin, y_pred_log)
                                f1_log = f1_score(y_bin, y_pred_log, average='macro')
                                results.append(("logistic_regression", acc_log, f1_log))
                            except Exception as e:
                                results.append(("logistic_regression", 0, 0))
                            # Decision Tree
                            try:
                                dtc = DecisionTreeClassifier(max_depth=6, random_state=42).fit(X, y_bin)
                                y_pred_dtc = dtc.predict(X)
                                acc_dtc = accuracy_score(y_bin, y_pred_dtc)
                                f1_dtc = f1_score(y_bin, y_pred_dtc, average='macro')
                                results.append(("decision_tree_classifier", acc_dtc, f1_dtc))
                            except Exception as e:
                                results.append(("decision_tree_classifier", 0, 0))
                            # Random Forest
                            try:
                                rfc = RandomForestClassifier(n_estimators=30, max_depth=8, random_state=42).fit(X, y_bin)
                                y_pred_rfc = rfc.predict(X)
                                acc_rfc = accuracy_score(y_bin, y_pred_rfc)
                                f1_rfc = f1_score(y_bin, y_pred_rfc, average='macro')
                                results.append(("random_forest_classifier", acc_rfc, f1_rfc))
                            except Exception as e:
                                results.append(("random_forest_classifier", 0, 0))
                            # SVC
                            try:
                                svc = SVC(kernel='rbf', max_iter=500).fit(X, y_bin)
                                y_pred_svc = svc.predict(X)
                                acc_svc = accuracy_score(y_bin, y_pred_svc)
                                f1_svc = f1_score(y_bin, y_pred_svc, average='macro')
                                results.append(("svc", acc_svc, f1_svc))
                            except Exception as e:
                                results.append(("svc", 0, 0))
                            # Naive Bayes
                            try:
                                nb = GaussianNB().fit(X, y_bin)
                                y_pred_nb = nb.predict(X)
                                acc_nb = accuracy_score(y_bin, y_pred_nb)
                                f1_nb = f1_score(y_bin, y_pred_nb, average='macro')
                                results.append(("naive_bayes_classifier", acc_nb, f1_nb))
                            except Exception as e:
                                results.append(("naive_bayes_classifier", 0, 0))
                            fit_test_info += f"\nFeature: {col} vs Target: {target_col}\n"
                            for name, acc, f1 in results:
                                fit_test_info += f"- {name}: Accuracy={acc:.3f}, F1_macro={f1:.3f}\n"
                prompt_detail += f"\nFit tests (all models):\n{fit_test_info}\n"
                prompt_detail += "Suggest the best algorithm(s) based on these tests. Motivate your choice using the metrics above.\n"

                prompt_detail += "Suggest ML algorithms from ['linear_regression', 'polynomial_regression', 'decision_tree_regressor', 'random_forest_regressor', 'svr', 'logistic_regression', 'svc', 'decision_tree_classifier', 'random_forest_classifier', 'naive_bayes_classifier'].\n"
                prompt_detail += "For each, provide JSON: {'algorithm_name': str, 'algorithm_key': str, 'task_type': 'regression'|'classification', 'motivation': str, 'suggested_features': list[str], 'suggested_target': str}.\n"
                prompt_detail += "For each suggestion, explain why you chose regression or classification for the target column.\n"
                if serializer.validated_data.get('task_type_preference'):
                    prompt_detail += f"Prioritize: {serializer.validated_data['task_type_preference']} if it makes sense for the data.\n"
                prompt_detail += "Response must be a JSON object: {'suggestions': array_of_suggestion_objects}. Empty array if none."

                print(f"Sending prompt to OpenAI for suggestions (length {len(prompt_detail)}).")
                completion = openai_client.chat.completions.create(
                    model="gpt-3.5-turbo", messages=[ {"role": "system", "content": "You are a data science assistant providing ML algorithm suggestions in JSON format."}, {"role": "user", "content": prompt_detail} ],
                    response_format={"type": "json_object"}, temperature=0.3, max_tokens=1024 )
                ai_response_content = completion.choices[0].message.content
                print(f"OpenAI Raw Suggestion Response: {ai_response_content}")
                try:
                    parsed_response = json.loads(ai_response_content)
                    if isinstance(parsed_response, dict) and 'suggestions' in parsed_response and isinstance(parsed_response['suggestions'], list):
                        suggestions = parsed_response['suggestions']
                    else: print("Warning: OpenAI response not in expected format.")
                except json.JSONDecodeError: print(f"Warning: Failed to parse OpenAI JSON: {ai_response_content}")
            except Exception as openai_exc: print(f"Error calling OpenAI: {openai_exc}")
        else: print("OpenAI client not initialized, skipping AI suggestions.")

        analysis_session_id = uuid.uuid4()
        cache_key_data = f"analysis_session_data_{analysis_session_id}"
        cache_key_headers = f"analysis_session_headers_{analysis_session_id}"
        cache_key_resource_info = f"analysis_session_resource_info_{analysis_session_id}"

        df_json_string = df.to_json(orient='split', date_format='iso', index=False) # index=False è importante
        cache.set(cache_key_data, df_json_string, timeout=3600)
        cache.set(cache_key_headers, headers, timeout=3600)
        resource_info_for_cache = { "original_filename": original_filename_for_cache, "source": source_type_for_cache }
        if resource_id_for_cache: resource_info_for_cache["resource_id"] = str(resource_id_for_cache)
        cache.set(cache_key_resource_info, resource_info_for_cache, timeout=3600)
        print(f"Data cached with session ID: {analysis_session_id}")

        response_data = { "analysis_session_id": analysis_session_id, "dataset_preview": dataset_preview_data, "suggestions": suggestions }
        return Response(response_data, status=status.HTTP_200_OK)


class RunAnalysisView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = AnalysisRunRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data; user_id = request.user.id
        analysis_session_id_obj = validated_data['analysis_session_id']
        analysis_session_id_str = str(analysis_session_id_obj)

        print(f"Run request for session ID: {analysis_session_id_str}")
        cache_key_data = f"analysis_session_data_{analysis_session_id_str}"
        cache_key_headers = f"analysis_session_headers_{analysis_session_id_str}"
        cache_key_resource_info = f"analysis_session_resource_info_{analysis_session_id_str}"
        cached_df_json = cache.get(cache_key_data)
        cached_headers = cache.get(cache_key_headers)
        cached_resource_info = cache.get(cache_key_resource_info)

        if not all([cached_df_json, cached_headers, cached_resource_info]):
            return Response({"error": "Session data expired/incomplete. Restart suggestion."}, status=status.HTTP_400_BAD_REQUEST)
        print(f"Cached resource info for run: {cached_resource_info}")

        for feature in validated_data['selected_features']:
            if feature not in cached_headers: return Response({"error": f"Feature '{feature}' not in headers."}, status=status.HTTP_400_BAD_REQUEST)
        if validated_data['selected_target'] not in cached_headers: return Response({"error": f"Target '{validated_data['selected_target']}' not in headers."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            input_params_for_db = validated_data.copy()
            input_params_for_db['analysis_session_id'] = str(input_params_for_db['analysis_session_id']) # Per JSONField

            job = AnalysisJob.objects.create(
                owner_id=user_id,
                resource_id=cached_resource_info.get('resource_id'), # Può essere None
                original_filename=cached_resource_info.get('original_filename', 'dataset.csv'),
                task_type=validated_data['task_type'],
                selected_algorithm_key=validated_data['selected_algorithm_key'],
                input_parameters=input_params_for_db,
                status=AnalysisJob.Status.PENDING
            )
            print(f"Created AnalysisJob {job.id}. Resource ID: {job.resource_id}")
            job_id_str_for_task = str(job.id)
            run_analysis_task.apply_async(args=[job_id_str_for_task], queue='analysis_tasks')
            print(f"Dispatched task for job {job_id_str_for_task} to queue 'analysis_tasks'")
            
            return Response({ "analysis_job_id": job_id_str_for_task, "status": job.status, "message": "Analysis task submitted." }, status=status.HTTP_202_ACCEPTED)
        except Exception as e:
            print(f"Error creating Job/dispatching task: {e}")
            if settings.DEBUG: traceback.print_exc()
            return Response({"error": "Failed to submit analysis task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalysisResultView(generics.RetrieveAPIView):
    queryset = AnalysisJob.objects.all()
    serializer_class = AnalysisJobSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    lookup_field = 'id' # Il modello AnalysisJob usa 'id' come UUIDField pk
    lookup_url_kwarg = 'analysis_job_id' # Dall'URL pattern

    def get_queryset(self):
        return AnalysisJob.objects.filter(owner_id=self.request.user.id)


class PredictInstanceView(views.APIView):
    """
    Esegue una predizione per una singola istanza usando un modello addestrato.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [JSONParser]

    def post(self, request, analysis_job_id, *args, **kwargs):
        print(f"\n--- PredictInstanceView START for job ID {analysis_job_id} ---")
        print(f"  Request User ID: {request.user.id}")
        print(f"  Request Data: {request.data}")

        # 1. Recupera il Job di Analisi
        try:
            job = AnalysisJob.objects.get(pk=analysis_job_id, owner_id=request.user.id)
            print(f"  Successfully retrieved AnalysisJob: {job.id}, Status: {job.status}, TaskType: {job.task_type}")
        except AnalysisJob.DoesNotExist:
            print(f"  Error: AnalysisJob {analysis_job_id} not found or not owned by user {request.user.id}.")
            return Response({"error": "AnalysisJob not found or you do not have permission to access it."}, status=status.HTTP_404_NOT_FOUND)

        if job.status != AnalysisJob.Status.COMPLETED:
            print(f"  Error: Job {job.id} is not completed. Current status: {job.status}")
            return Response({"error": f"Analysis job is not completed. Current status: {job.status}"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verifica che il task type sia supportato da questo endpoint
        if job.task_type not in ['classification', 'regression']:
            print(f"  Error: Job {job.id} has unsupported task_type: {job.task_type}")
            return Response({"error": f"Prediction for task type '{job.task_type}' is not supported by this endpoint."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Verifica path necessari e valida input
        model_file_rel_path = job.model_path.name if job.model_path and hasattr(job.model_path, 'name') else None
        preprocessor_rel_path = job.input_parameters.get('preprocessor_path')
        label_encoder_rel_path = job.input_parameters.get('label_encoder_path') # Potrebbe essere None

        print(f"  Model relative path from DB: {model_file_rel_path}")
        print(f"  Preprocessor relative path from DB: {preprocessor_rel_path}")
        print(f"  Label Encoder relative path from DB: {label_encoder_rel_path}")

        if not model_file_rel_path or not preprocessor_rel_path:
            print(f"  Error: Missing model_path or preprocessor_path in job {job.id}.")
            return Response({"error": "Model or preprocessor path not found for this job. Training might have failed or paths were not saved correctly."}, status=status.HTTP_404_NOT_FOUND)

        input_serializer = InstanceFeaturesSerializer(data=request.data)
        if not input_serializer.is_valid():
            print(f"  Error: Input data validation failed. Errors: {input_serializer.errors}")
            return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        instance_features_dict_from_request = input_serializer.validated_data['features']
        print(f"  Features received for prediction from request: {instance_features_dict_from_request}")

        try:
            # 3. Carica Modello, Preprocessor e LabelEncoder
            model_full_path = (Path(settings.ANALYSIS_RESULTS_ROOT) / model_file_rel_path).resolve()
            preprocessor_full_path = (Path(settings.ANALYSIS_RESULTS_ROOT) / preprocessor_rel_path).resolve()
            
            print(f"  Attempting to load model from: {model_full_path}")
            if not model_full_path.exists(): raise FileNotFoundError(f"Model file missing on server at {model_full_path}")
            model = joblib.load(model_full_path)
            print("  Model loaded successfully.")

            print(f"  Attempting to load preprocessor from: {preprocessor_full_path}")
            if not preprocessor_full_path.exists(): raise FileNotFoundError(f"Preprocessor file missing on server at {preprocessor_full_path}")
            preprocessor = joblib.load(preprocessor_full_path)
            print("  Preprocessor loaded successfully.")
            
            label_encoder = None
            if label_encoder_rel_path:
                le_full_path = (Path(settings.ANALYSIS_RESULTS_ROOT) / label_encoder_rel_path).resolve()
                if le_full_path.exists():
                    print(f"  Attempting to load label encoder from: {le_full_path}")
                    label_encoder = joblib.load(le_full_path)
                    print("  Label encoder loaded successfully.")
                else:
                    print(f"  Warning: Label encoder file not found at {le_full_path}. Prediction will use numeric labels or job.class_names if available.")
            else:
                 print("  No label encoder path found in job parameters.")


            # 4. Prepara l'istanza per la predizione
            original_features_order = job.input_parameters.get('selected_features', [])
            print(f"  Original features order from job parameters: {original_features_order}")
            if not original_features_order:
                return Response({"error": "Original feature list not found in job parameters. Cannot prepare data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            if not all(f_name in instance_features_dict_from_request for f_name in original_features_order):
                 missing_feats = [f for f in original_features_order if f not in instance_features_dict_from_request]
                 return Response({"error": f"Missing feature(s) in input: {', '.join(missing_feats)}. Expected all of: {original_features_order}"}, status=status.HTTP_400_BAD_REQUEST)

            instance_df_data_ordered = {}
            for feat in original_features_order:
                val_str = str(instance_features_dict_from_request.get(feat, ''))
                try: instance_df_data_ordered[feat] = [float(val_str)]
                except ValueError: instance_df_data_ordered[feat] = [val_str]
            
            instance_df = pd.DataFrame(instance_df_data_ordered, columns=original_features_order)
            print(f"  Instance DataFrame for prediction (before transform): {instance_df.to_dict(orient='records')}")

            instance_transformed_array = preprocessor.transform(instance_df)
            print(f"  Instance transformed for prediction (shape): {instance_transformed_array.shape}")

            # 5. Esegui Predizione e Prepara Risposta
            if job.task_type == 'classification':
                prediction_numeric_array = model.predict(instance_transformed_array)
                predicted_class_numeric = prediction_numeric_array[0]
                print(f"  Numeric prediction (classification): {predicted_class_numeric}")

                predicted_class_name = str(predicted_class_numeric)
                class_names_from_results = job.results.get('confusion_matrix_labels') # Da metriche
                job_class_names_param = job.input_parameters.get('class_names_from_suggestion_or_user') # Da input job (se salvato)

                if class_names_from_results and isinstance(class_names_from_results, list):
                    try:
                        if int(predicted_class_numeric) < len(class_names_from_results):
                           predicted_class_name = class_names_from_results[int(predicted_class_numeric)]
                        else: print(f"  Warning: Predicted label {predicted_class_numeric} out of bounds for class_names from results (len {len(class_names_from_results)}).")
                    except: print(f"  Warning: Error mapping label from results for {predicted_class_numeric}.")
                elif label_encoder and hasattr(label_encoder, 'classes_'):
                    try: predicted_class_name = str(label_encoder.inverse_transform([predicted_class_numeric])[0])
                    except: print(f"  Warning: Error inverse transforming label with LabelEncoder for {predicted_class_numeric}.")
                elif job_class_names_param and isinstance(job_class_names_param, list):
                    try:
                        if int(predicted_class_numeric) < len(job_class_names_param):
                           predicted_class_name = job_class_names_param[int(predicted_class_numeric)]
                        else: print(f"  Warning: Predicted label {predicted_class_numeric} out of bounds for job_class_names_param (len {len(job_class_names_param)}).")
                    except: print(f"  Warning: Error mapping label from job_class_names_param for {predicted_class_numeric}.")

                print(f"  Final predicted class name: {predicted_class_name}")

                probabilities_dict = None
                if hasattr(model, "predict_proba"):
                    proba_numeric_array = model.predict_proba(instance_transformed_array)[0]
                    class_names_for_proba = class_names_from_results or \
                                            (label_encoder.classes_.tolist() if label_encoder and hasattr(label_encoder, 'classes_') else \
                                             job_class_names_param or \
                                             [f"Class_{i}" for i in range(len(proba_numeric_array))])
                    if len(class_names_for_proba) == len(proba_numeric_array):
                        probabilities_dict = {str(class_names_for_proba[i]): float(proba_numeric_array[i]) for i in range(len(proba_numeric_array))}
                    else: print(f"  Warning: Length mismatch for probabilities. Names: {len(class_names_for_proba)}, Probas: {len(proba_numeric_array)}.")
                print(f"  Probabilities: {probabilities_dict}")
                
                plot_coords_list = instance_transformed_array[0, :min(3, instance_transformed_array.shape[1])].tolist()
                while len(plot_coords_list) < 3: plot_coords_list.append(0.0)
                print(f"  Plot coordinates for predicted instance: {plot_coords_list}")

                result_data = {"predicted_class": predicted_class_name, "probabilities": probabilities_dict, "plot_coordinates": plot_coords_list}
                response_serializer = ClassificationPredictionSerializer(result_data)
                print(f"--- PredictInstanceView END - SUCCESS (Classification) for job ID {analysis_job_id} ---")
                return Response(response_serializer.data, status=status.HTTP_200_OK)

            elif job.task_type == 'regression':
                predicted_value_array = model.predict(instance_transformed_array)
                predicted_value = float(predicted_value_array[0])
                print(f"  Predicted value (regression): {predicted_value}")
                
                result_data = {"predicted_value": predicted_value}
                # plot_coordinates non è tipicamente restituito per regressione semplice dal backend
                # il frontend lo calcola se necessario (X originale, Y predetto)
                response_serializer = RegressionPredictionSerializer(result_data)
                print(f"--- PredictInstanceView END - SUCCESS (Regression) for job ID {analysis_job_id} ---")
                return Response(response_serializer.data, status=status.HTTP_200_OK)
            
            else: # Non dovrebbe accadere se il job.task_type è validato all'inizio
                print(f"  Error: Job {job.id} has unsupported task_type for prediction: {job.task_type}")
                return Response({"error": f"Unsupported task type for prediction: {job.task_type}"}, status=status.HTTP_400_BAD_REQUEST)

        except FileNotFoundError as e:
            print(f"--- PredictInstanceView ERROR (FileNotFound) for job {analysis_job_id}: {e} ---")
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"--- PredictInstanceView ERROR (General Exception) for job {analysis_job_id}: {e} ---")
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred during prediction."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class GenerateSyntheticCsvView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [JSONParser] # Solo JSON per questa richiesta

    def post(self, request, *args, **kwargs):
        serializer = SyntheticCsvRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        user_id = request.user.id
        
        base_name = validated_data.get('dataset_name')
        if not base_name or not base_name.strip():
            prompt_slug = "".join(c if c.isalnum() else "_" for c in validated_data['user_prompt'][:30]).strip("_")
            timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
            base_name = f"synthetic_{prompt_slug}_{timestamp}.csv"
        elif not base_name.lower().endswith('.csv'):
            base_name += '.csv'

        try:
            job = SyntheticDatasetJob.objects.create(
                owner_id=user_id,
                user_prompt=validated_data['user_prompt'],
                num_rows_requested=validated_data['num_rows'],
                generated_dataset_name=base_name, # Nome file finale
                status=SyntheticDatasetJob.Status.PENDING
            )
            print(f"Created SyntheticDatasetJob {job.id}, status PENDING.")

            generate_synthetic_csv_task.apply_async(args=[str(job.id)], queue='analysis_tasks') # Usa la stessa coda
            print(f"Dispatched generate_synthetic_csv_task for job ID: {job.id}")

            response_serializer = SyntheticDatasetJobSubmitResponseSerializer({
                "job_id": job.id,
                "status": job.status,
                "message": "Synthetic dataset generation task submitted successfully."
            })
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
            print(f"Error creating SyntheticDatasetJob or dispatching task: {e}")
            traceback.print_exc()
            return Response({"error": "Failed to submit synthetic dataset generation task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyntheticJobStatusView(generics.RetrieveAPIView):
    """Recupera lo stato e i risultati di un SyntheticDatasetJob."""
    queryset = SyntheticDatasetJob.objects.all()
    serializer_class = SyntheticDatasetJobSerializer # Usa il serializer completo
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    lookup_field = 'id' # Il modello usa 'id' come UUIDField pk
    lookup_url_kwarg = 'job_id' # Dall'URL pattern

    def get_queryset(self):
        user = self.request.user
        return SyntheticDatasetJob.objects.filter(owner_id=user.id)