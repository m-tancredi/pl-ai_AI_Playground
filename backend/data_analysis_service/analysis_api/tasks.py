# pl-ai/backend/data_analysis_service/analysis_api/tasks.py
import os
import time
import json
import pandas as pd
import numpy as np
import joblib
from io import StringIO
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from sklearn.model_selection import train_test_split
from django.core.files.base import ContentFile
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression # Già importato in ml_utils, ma meglio essere espliciti se lo usi qui

from .models import AnalysisJob
from .ml_utils import (
    preprocess_data, get_sklearn_model,
    calculate_regression_metrics, calculate_classification_metrics,
    generate_regression_plot_data, generate_classification_plot_data
)
import requests

# Costanti per header interno
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

@shared_task(bind=True, max_retries=1, default_retry_delay=300) # default_retry_delay in secondi
def run_analysis_task(self, analysis_job_id_str):
    """
    Task Celery per eseguire l'analisi ML scelta.
    """
    task_id_log_prefix = f"[Task ID: {self.request.id or 'N/A'}]" # Per log più chiari
    print(f"{task_id_log_prefix} Starting analysis for AnalysisJob ID: {analysis_job_id_str}")
    start_time = time.time()

    analysis_job = None # Inizializza per uso nel blocco finally/except

    try:
        # --- 1. Recupera Job e imposta stato a PROCESSING ---
        with transaction.atomic():
            try:
                analysis_job = AnalysisJob.objects.select_for_update().get(pk=analysis_job_id_str)
            except AnalysisJob.DoesNotExist:
                print(f"{task_id_log_prefix} Error: AnalysisJob {analysis_job_id_str} not found. Aborting task.")
                return # Non ritentare se il job non esiste
            
            if analysis_job.status != AnalysisJob.Status.PENDING:
                print(f"{task_id_log_prefix} AnalysisJob {analysis_job_id_str} not PENDING (Status: {analysis_job.status}). Aborting.")
                return f"Aborted: Job {analysis_job_id_str} not PENDING."
            
            analysis_job.status = AnalysisJob.Status.PROCESSING
            analysis_job.job_started_at = timezone.now()
            analysis_job.error_message = None # Pulisci errori precedenti
            analysis_job.save()
        print(f"{task_id_log_prefix} AnalysisJob status set to PROCESSING.")

        # --- 2. Recupera Dati del Dataset ---
        df = None # Inizializza DataFrame
        # L'analysis_session_id è salvato in input_parameters del job
        analysis_session_id = analysis_job.input_parameters.get('analysis_session_id')

        if analysis_session_id:
            cache_key_data = f"analysis_session_data_{analysis_session_id}"
            dataset_json_str_from_cache = cache.get(cache_key_data)
            if dataset_json_str_from_cache:
                print(f"{task_id_log_prefix}   Dataset found in cache for session {analysis_session_id}.")
                try:
                    df_data_cached = json.loads(dataset_json_str_from_cache)
                    df = pd.DataFrame(df_data_cached['data'], columns=df_data_cached['columns'])
                    # Tenta di ripristinare i tipi di dati originali dalla cache 'split'
                    for col_name, col_type_str in df_data_cached.get('column_dtypes', {}).items():
                         if col_name in df.columns:
                             try: df[col_name] = df[col_name].astype(col_type_str)
                             except: pass # Ignora se il cast fallisce
                    print(f"{task_id_log_prefix}   DataFrame successfully loaded from cache. Shape: {df.shape}")
                except Exception as e:
                    print(f"{task_id_log_prefix}   Error loading/parsing DataFrame from cached JSON: {e}")
                    df = None # Assicura che df sia None se il parsing fallisce
            else:
                print(f"{task_id_log_prefix}   Warning: Dataset NOT found in cache for session {analysis_session_id}. Will try resource_id if available.")
        else:
            print(f"{task_id_log_prefix}   Warning: No analysis_session_id found in job input_parameters. Will try resource_id.")

        # Se non caricato dalla cache E analysis_job.resource_id è disponibile, prova Resource Manager
        if df is None and analysis_job.resource_id:
            print(f"{task_id_log_prefix}   Dataset not loaded from cache. Fetching from RM for resource_id: {analysis_job.resource_id}")
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/{analysis_job.resource_id}/content/"
            internal_headers = {'Accept': 'text/csv'}
            if INTERNAL_API_SECRET: internal_headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET
            
            try:
                response = requests.get(resource_url, headers=internal_headers, timeout=30)
                print(f"{task_id_log_prefix}   RM API response status: {response.status_code}")
                response.raise_for_status()
                csv_content = response.text
                if not csv_content or not csv_content.strip():
                    print(f"{task_id_log_prefix}   Warning: Resource Manager returned empty CSV content for resource {analysis_job.resource_id}.")
                else:
                    df = pd.read_csv(StringIO(csv_content))
                    print(f"{task_id_log_prefix}   Dataset successfully fetched from RM. Shape: {df.shape}")
            except requests.exceptions.HTTPError as http_err:
                 print(f"{task_id_log_prefix}   ERROR fetching from Resource Manager (HTTPError {http_err.response.status_code}): {http_err.response.text if http_err.response else 'No response body'}")
            except requests.exceptions.RequestException as req_exc:
                 print(f"{task_id_log_prefix}   ERROR fetching from Resource Manager (RequestException): {req_exc}")
            except pd.errors.ParserError as pd_exc:
                 print(f"{task_id_log_prefix}   ERROR parsing CSV from Resource Manager: {pd_exc}")
            except Exception as e:
                 print(f"{task_id_log_prefix}   UNEXPECTED ERROR fetching/parsing from RM: {e}")
        
        # Verifica finale del DataFrame
        if df is None or df.empty:
            print(f"{task_id_log_prefix}   Final check: df is None or empty. Raising ValueError.")
            print(f"{task_id_log_prefix}   Details: analysis_job.resource_id = {analysis_job.resource_id}, session_id used = {analysis_session_id}")
            raise ValueError("Dataset data could not be retrieved or is empty for analysis.")
        
        print(f"{task_id_log_prefix}   DataFrame successfully prepared. Shape: {df.shape}, Columns: {df.columns.tolist()}")

        # --- 3. Prepara Dati per Scikit-learn ---
        # selected_features e selected_target sono in input_parameters
        selected_features = analysis_job.input_parameters['selected_features']
        selected_target = analysis_job.input_parameters['selected_target']
        task_type = analysis_job.task_type # Anche questo è nel modello job

        X, y, preprocessor, label_encoder = preprocess_data(df, selected_features, selected_target, task_type)

        # Split dati
        stratify_y = None
        if task_type == 'classification' and len(y) > 0: # Assicurati che y non sia vuoto
            unique_labels, counts = np.unique(y.astype(int), return_counts=True) # Assumi y è già encodato e intero
            num_classes = len(unique_labels)
            # Calcola la dimensione del test set
            # test_size_float = 0.2 # Il tuo test_size
            # n_samples_test = np.ceil(len(y) * test_size_float).astype(int)
            # Scikit-learn lo calcola internamente, ma il vincolo è che
            # n_samples_test deve essere >= num_classes per la stratificazione
            # Un modo più semplice è controllare che ogni classe abbia abbastanza campioni
            # per essere presente sia in train che in test (almeno 2 per classe)
            if all(count >= 2 for count in counts) and len(y) * 0.2 >= num_classes : # Condizione più robusta
                 stratify_y = y
                 print(f"{task_id_log_prefix}   Using stratified split. Class counts: {dict(zip(unique_labels, counts))}")
            else:
                 print(f"{task_id_log_prefix}   Warning: Not enough samples in each class for a stratified split (or test set too small). Using non-stratified split. Class counts: {dict(zip(unique_labels, counts))}")
                 # stratify_y rimane None

        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=0.2, # Mantieni test_size desiderato
            random_state=42,
            stratify=stratify_y # Sarà None se le condizioni non sono soddisfatte
        )
        print(f"{task_id_log_prefix}   Data split: X_train={X_train.shape}, X_test={X_test.shape}")


        # --- 4. Inizializza e Addestra Modello ---
        algorithm_key = analysis_job.selected_algorithm_key
        algorithm_params = analysis_job.input_parameters.get('algorithm_params', {})
        model = get_sklearn_model(algorithm_key, task_type, algorithm_params)

        print(f"{task_id_log_prefix}   Training model: {algorithm_key}...")
        model.fit(X_train, y_train)
        print(f"{task_id_log_prefix}   Model training complete.")

        # --- 5. Valuta Modello e Calcola Metriche ---
        y_pred = model.predict(X_test)
        metrics = {}
        plot_data_json = {} # Dati JSON per il grafico

        if task_type == 'regression':
            metrics = calculate_regression_metrics(y_test, y_pred)
            # --- ASSICURATI CHE SLOPE E INTERCEPT SIANO QUI ---
            # model è l'istanza di LinearRegression (o simile)
            if hasattr(model, 'coef_') and hasattr(model, 'intercept_'):
                if isinstance(model, Pipeline) and isinstance(model.named_steps['linear'], LinearRegression): # Per Polynomial
                    metrics['slope'] = model.named_steps['linear'].coef_[0] if model.named_steps['linear'].coef_.ndim == 1 else model.named_steps['linear'].coef_.tolist() # Gestisci multi-output
                    metrics['intercept'] = float(model.named_steps['linear'].intercept_)
                elif isinstance(model, LinearRegression):
                    metrics['slope'] = model.coef_[0] if model.coef_.ndim == 1 else model.coef_.tolist()
                    metrics['intercept'] = float(model.intercept_)
                # Aggiungere casi per SVR, DecisionTreeRegressor, RandomForestRegressor se i nomi degli attributi sono diversi
                # SVR: non ha coef_ o intercept_ diretti in modo semplice
                # DecisionTree/RandomForest: non hanno slope/intercept
                # Per questi, la predizione interattiva nel frontend non funzionerà con slope/intercept.
                # Dovresti usare l'endpoint /predict_instance/ del backend anche per loro.
            # --- FINE ASSICURAZIONE ---
            plot_data_json = generate_regression_plot_data(X_test, y_test, y_pred, "Features (Test Set)", selected_target)
        elif task_type == 'classification':
            y_pred_proba = None
            if hasattr(model, "predict_proba"):
                y_pred_proba = model.predict_proba(X_test)

            all_original_class_names = []
            if label_encoder and hasattr(label_encoder, 'classes_'):
                all_original_class_names = label_encoder.classes_.tolist()
            elif analysis_job.class_names: # Dal campo class_names del modello AnalysisJob
                 all_original_class_names = analysis_job.class_names
            else:
                 all_original_class_names = [f"Class {i}" for i in sorted(list(np.unique(y_train.astype(int))))]

            all_numeric_labels_for_all_classes = list(range(len(all_original_class_names)))

            # --- CORREZIONE NELLA CHIAMATA QUI ---
            metrics = calculate_classification_metrics(
                y_test.astype(int),
                y_pred.astype(int),
                y_pred_proba,
                all_class_labels_numeric=all_numeric_labels_for_all_classes, # Usa nuovo nome argomento
                all_class_names=all_original_class_names  # Usa nuovo nome argomento
            )
            # --- FINE CORREZIONE ---
            plot_data_json = generate_classification_plot_data(X_test, y_test.astype(int), model, selected_features, selected_target, all_original_class_names, preprocessor, label_encoder)

        print(f"{task_id_log_prefix}   Metrics calculated: {metrics}")

        # --- 6. Salva Modello e Preprocessor ---
        job_dir_rel = f"analysis_jobs/user_{analysis_job.owner_id}/job_{analysis_job_id_str}"
        job_dir_full = Path(settings.ANALYSIS_RESULTS_ROOT) / job_dir_rel
        job_dir_full.mkdir(parents=True, exist_ok=True)

        model_filename = "trained_model.joblib"
        preprocessor_filename = "preprocessor.joblib"
        model_path_full = job_dir_full / model_filename
        preprocessor_path_full = job_dir_full / preprocessor_filename

        joblib.dump(model, model_path_full)
        joblib.dump(preprocessor, preprocessor_path_full)
        
        saved_paths_for_db = { # Salva nel DB
            'model_path': os.path.join(job_dir_rel, model_filename),
            'preprocessor_path': os.path.join(job_dir_rel, preprocessor_filename)
        }

        if label_encoder:
            label_encoder_filename = "label_encoder.joblib"
            label_encoder_path_full = job_dir_full / label_encoder_filename
            joblib.dump(label_encoder, label_encoder_path_full)
            saved_paths_for_db['label_encoder_path'] = os.path.join(job_dir_rel, label_encoder_filename)

        print(f"{task_id_log_prefix}   Model saved to {model_path_full}")
        print(f"{task_id_log_prefix}   Preprocessor saved to {preprocessor_path_full}")

        # --- 7. Aggiorna Record DB ---
        with transaction.atomic():
            final_job = AnalysisJob.objects.get(pk=analysis_job_id_str)
            final_job.status = AnalysisJob.Status.COMPLETED
            final_job.results = metrics
            final_job.plot_data = plot_data_json
            # Salva il path del modello FILE (FileField lo gestirà correttamente)
            # Apri il file salvato e passalo al FileField
            with open(model_path_full, 'rb') as model_f:
                 final_job.model_path.save(model_filename, ContentFile(model_f.read()), save=False) # save=False qui

            # Aggiorna input_parameters con i path, non direttamente i campi del modello
            current_input_params = final_job.input_parameters or {}
            current_input_params.update(saved_paths_for_db)
            final_job.input_parameters = current_input_params

            final_job.job_finished_at = timezone.now()
            final_job.error_message = None
            final_job.save() # Salva tutte le modifiche, inclusi i file

        # Pulisci dati dalla cache
        if analysis_session_id:
            cache.delete(f"analysis_session_data_{analysis_session_id}")
            cache.delete(f"analysis_session_headers_{analysis_session_id}")
            cache.delete(f"analysis_session_resource_info_{analysis_session_id}") # Pulisci anche questo
            print(f"{task_id_log_prefix}   Cache cleared for session {analysis_session_id}")


        end_time = time.time()
        print(f"{task_id_log_prefix} Successfully completed AnalysisJob ID: {analysis_job_id_str}. Time: {end_time - start_time:.2f}s")
        return f"Completed AnalysisJob ID: {analysis_job_id_str}"

    except Exception as exc:
        print(f"{task_id_log_prefix} FATAL Error processing AnalysisJob ID {analysis_job_id_str}: {exc}")
        import traceback
        traceback.print_exc()
        try:
            # Assicurati che analysis_job sia definito (potrebbe fallire prima del caricamento)
            if analysis_job is None and analysis_job_id_str:
                analysis_job = AnalysisJob.objects.filter(pk=analysis_job_id_str).first()

            if analysis_job:
                with transaction.atomic():
                    # Rileggi per evitare sovrascritture se modificato da altro processo (improbabile)
                    failed_job = AnalysisJob.objects.get(pk=analysis_job.id)
                    failed_job.status = AnalysisJob.Status.FAILED
                    failed_job.error_message = f"Analysis failed: {str(exc)[:1000]}" # Limita lunghezza
                    failed_job.job_finished_at = timezone.now()
                    failed_job.save()
            # Se analysis_job non è mai stato caricato, non possiamo aggiornarlo
            # ma l'errore è già stato loggato.
        except Exception as update_exc:
            print(f"{task_id_log_prefix} FATAL: Could not update status to FAILED for Job {analysis_job_id_str}: {update_exc}")
        raise exc # Rilancia per far fallire il task Celery e permettere ritentativi se configurati