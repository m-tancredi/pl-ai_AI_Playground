# pl-ai/backend/data_analysis_service/analysis_api/tasks.py
import os
import time
import json
import pandas as pd
import numpy as np
import joblib # Per salvare/caricare modelli Scikit-learn e preprocessor
from io import StringIO
from pathlib import Path
from io import BytesIO
import csv # <-- AGGIUNGI QUESTO IMPORT
import json
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from django.core.files.base import ContentFile # <-- IMPORT CORRETTO
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline # Necessario se usato in ml_utils per regressione polinomiale
from sklearn.linear_model import LinearRegression # Necessario se usato in ml_utils o qui per slope/intercept
from django.conf import settings # Importa settings per accedere a OPENAI_API_KEY
from openai import OpenAI # Assicurati che OpenAI sia importato

# Importa modelli e utils dell'app corrente
from .models import AnalysisJob, SyntheticDatasetJob # Ora importi anche SyntheticDatasetJob

from .ml_utils import (
    preprocess_data, get_sklearn_model,
    calculate_regression_metrics, calculate_classification_metrics,
    generate_regression_plot_data, generate_classification_plot_data, analyze_dataframe_for_potential_uses
)
import requests # Per chiamare Resource Manager
import traceback # Per loggare stack trace completi in caso di errore

# Costanti per header interno
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

# --- INIZIALIZZA OPENAI CLIENT QUI ---
openai_client = None
# Leggi la chiave API da settings (che a sua volta la legge dai Docker Secrets)
# Nota: settings.OPENAI_API_KEY deve essere definito in service_config/settings.py
# e leggere il secret lì.
if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        print("OpenAI client initialized in tasks.py.")
    except Exception as e:
        print(f"Failed to initialize OpenAI client in tasks.py: {e}")
        # Il task fallirà se openai_client è None e viene usato
else:
    print("Warning (tasks.py): OPENAI_API_KEY not set in Django settings or secret not found. Synthetic CSV generation will fail.")
# --- FINE INIZIALIZZAZIONE ---


@shared_task(bind=True, max_retries=1, default_retry_delay=300) # default_retry_delay in secondi
def run_analysis_task(self, analysis_job_id_str):
    """
    Task Celery per eseguire l'analisi ML scelta.
    """
    task_id_log_prefix = f"[Task ID: {self.request.id or 'N/A'}]"
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
                return f"Aborted: Job {analysis_job_id_str} not found."
            
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
        analysis_session_id = analysis_job.input_parameters.get('analysis_session_id')

        if analysis_session_id:
            cache_key_data = f"analysis_session_data_{analysis_session_id}"
            dataset_json_str_from_cache = cache.get(cache_key_data)
            if dataset_json_str_from_cache:
                print(f"{task_id_log_prefix}   Dataset found in cache for session {analysis_session_id}.")
                try:
                    df_data_cached = json.loads(dataset_json_str_from_cache)
                    df = pd.DataFrame(df_data_cached['data'], columns=df_data_cached['columns'])
                    # Ripristina tipi se possibile (semplificato)
                    for col_name in df.columns:
                        if col_name in df_data_cached.get('index', []): continue
                        # Questo è un tentativo base, la serializzazione JSON perde tipi specifici di Pandas
                        try: df[col_name] = pd.to_numeric(df[col_name], errors='ignore')
                        except: pass
                    print(f"{task_id_log_prefix}   DataFrame successfully loaded from cache. Shape: {df.shape}")
                except Exception as e:
                    print(f"{task_id_log_prefix}   Error loading/parsing DataFrame from cached JSON: {e}")
                    df = None
            else:
                print(f"{task_id_log_prefix}   Warning: Dataset NOT found in cache for session {analysis_session_id}. Will try resource_id if available.")
        else:
            print(f"{task_id_log_prefix}   Warning: No analysis_session_id found in job input_parameters. Will try resource_id.")

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
            except requests.exceptions.HTTPError as http_err: print(f"{task_id_log_prefix}   ERROR fetching from RM (HTTPError {http_err.response.status_code if http_err.response else 'N/A'}): {http_err.response.text if http_err.response else str(http_err)}")
            except requests.exceptions.RequestException as req_exc: print(f"{task_id_log_prefix}   ERROR fetching from RM (RequestException): {req_exc}")
            except pd.errors.ParserError as pd_exc: print(f"{task_id_log_prefix}   ERROR parsing CSV from RM: {pd_exc}")
            except Exception as e: print(f"{task_id_log_prefix}   UNEXPECTED ERROR fetching/parsing from RM: {e}")
        
        if df is None or df.empty:
            print(f"{task_id_log_prefix}   Final check: df is None or empty. Raising ValueError. Details: resource_id = {analysis_job.resource_id}, session_id = {analysis_session_id}")
            raise ValueError("Dataset data could not be retrieved or is empty for analysis.")
        
        print(f"{task_id_log_prefix}   DataFrame successfully prepared. Shape: {df.shape}, Columns: {df.columns.tolist()}")

        # --- 3. Prepara Dati per Scikit-learn ---
        selected_features = analysis_job.input_parameters['selected_features']
        selected_target = analysis_job.input_parameters['selected_target']
        task_type = analysis_job.task_type

        X, y, preprocessor, label_encoder = preprocess_data(df, selected_features, selected_target, task_type)

        # Split dati
        stratify_y = None
        if task_type == 'classification' and len(y) > 0:
            unique_labels_in_y, counts_in_y = np.unique(y.astype(int), return_counts=True)
            num_classes_in_y = len(unique_labels_in_y)
            # Condizione più robusta per stratificazione: test set deve poter avere almeno un campione per classe
            min_samples_for_stratify = num_classes_in_y 
            if all(c >= 2 for c in counts_in_y) and (len(y) * 0.2 >= min_samples_for_stratify):
                 stratify_y = y
                 print(f"{task_id_log_prefix}   Using stratified split. Class counts in y: {dict(zip(unique_labels_in_y, counts_in_y))}")
            else:
                 print(f"{task_id_log_prefix}   Warning: Not enough samples in each class of y for stratified split (or test set too small). Using non-stratified split. Class counts in y: {dict(zip(unique_labels_in_y, counts_in_y))}")
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=stratify_y)
        print(f"{task_id_log_prefix}   Data split: X_train={X_train.shape}, X_test={X_test.shape}, y_train={y_train.shape}, y_test={y_test.shape}")

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
        plot_data_json = {}

        if task_type == 'regression':
            metrics = calculate_regression_metrics(y_test, y_pred)
            # Aggiungi slope/intercept se applicabile
            if hasattr(model, 'coef_') and hasattr(model, 'intercept_'):
                if isinstance(model, Pipeline) and 'linear' in model.named_steps and isinstance(model.named_steps['linear'], LinearRegression):
                    final_estimator = model.named_steps['linear']
                    metrics['slope'] = final_estimator.coef_[0] if final_estimator.coef_.ndim == 1 else final_estimator.coef_.tolist()
                    metrics['intercept'] = float(final_estimator.intercept_)
                elif isinstance(model, LinearRegression):
                    metrics['slope'] = model.coef_[0] if model.coef_.ndim == 1 else model.coef_.tolist()
                    metrics['intercept'] = float(model.intercept_)
                else: print(f"{task_id_log_prefix}   Model type {type(model)} doesn't have standard slope/intercept.")
            plot_data_json = generate_regression_plot_data(X_test, y_test, y_pred, model, selected_features, selected_target)

        elif task_type == 'classification':
            y_pred_proba = None
            if hasattr(model, "predict_proba"): y_pred_proba = model.predict_proba(X_test)
            
            all_original_class_names = []
            if label_encoder and hasattr(label_encoder, 'classes_'):
                all_original_class_names = label_encoder.classes_.tolist()
            elif analysis_job.input_parameters.get('class_names_from_suggestion_or_user'): # Assumendo che la vista lo salvi qui
                all_original_class_names = analysis_job.input_parameters['class_names_from_suggestion_or_user']
            # Fallback se i nomi non sono stati passati o trovati
            if not all_original_class_names:
                all_original_class_names = [f"Class {i}" for i in sorted(list(np.unique(y_train.astype(int))))]

            all_numeric_labels_for_all_classes = list(range(len(all_original_class_names)))
            metrics = calculate_classification_metrics(y_test.astype(int), y_pred.astype(int), y_pred_proba, all_class_labels_numeric=all_numeric_labels_for_all_classes, all_class_names=all_original_class_names)
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
        
        saved_paths_for_db = {
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
            # Salva il path del modello usando FileField.save()
            with open(model_path_full, 'rb') as model_f:
                 final_job.model_path.save(model_filename, ContentFile(model_f.read()), save=False) # save=False qui
            
            current_input_params = final_job.input_parameters or {}
            current_input_params.update(saved_paths_for_db) # Aggiungi path preproc e label_encoder
            final_job.input_parameters = current_input_params
            
            final_job.job_finished_at = timezone.now()
            final_job.error_message = None
            final_job.save() # Salva tutto, incluso il FileField model_path

        if analysis_session_id: # Pulisci cache
            cache.delete(f"analysis_session_data_{analysis_session_id}")
            cache.delete(f"analysis_session_headers_{analysis_session_id}")
            cache.delete(f"analysis_session_resource_info_{analysis_session_id}")
            print(f"{task_id_log_prefix}   Cache cleared for session {analysis_session_id}")

        end_time = time.time()
        print(f"{task_id_log_prefix} Successfully completed AnalysisJob ID: {analysis_job_id_str}. Time: {end_time - start_time:.2f}s")
        return f"Completed AnalysisJob ID: {analysis_job_id_str}"

    except Exception as exc:
        print(f"{task_id_log_prefix} FATAL Error processing AnalysisJob ID {analysis_job_id_str}: {exc}")
        traceback.print_exc()
        try:
            if analysis_job is None and analysis_job_id_str:
                analysis_job = AnalysisJob.objects.filter(pk=analysis_job_id_str).first()
            if analysis_job:
                with transaction.atomic():
                    failed_job = AnalysisJob.objects.get(pk=analysis_job.id) # Rileggi per evitare race
                    failed_job.status = AnalysisJob.Status.FAILED
                    failed_job.error_message = f"Analysis failed: {str(exc)[:1000]}"
                    failed_job.job_finished_at = timezone.now()
                    failed_job.save()
        except Exception as update_exc:
            print(f"{task_id_log_prefix} FATAL: Could not update status to FAILED for Job {analysis_job_id_str}: {update_exc}")
        raise exc
    

@shared_task(bind=True, max_retries=1, default_retry_delay=180) # Riprova dopo 3 min
def generate_synthetic_csv_task(self, synthetic_job_id_str):
    """
    Task Celery per generare un dataset CSV sintetico usando OpenAI e salvarlo nel Resource Manager.
    """
    task_id_log_prefix = f"[SyntheticCSV Task ID: {self.request.id or 'N/A'}]" # Gestisce se self.request.id è None
    print(f"{task_id_log_prefix} Starting generation for SyntheticDatasetJob ID: {synthetic_job_id_str}")
    start_time = time.time()
    job = None # Inizializza per poterlo usare nel blocco except finale

    try:
        # --- 1. Recupera Job e imposta stato a GENERATING_DATA ---
        with transaction.atomic():
            try:
                job = SyntheticDatasetJob.objects.select_for_update().get(pk=synthetic_job_id_str)
            except SyntheticDatasetJob.DoesNotExist:
                print(f"{task_id_log_prefix} Error: SyntheticDatasetJob {synthetic_job_id_str} not found. Aborting task.")
                return f"Aborted: Job {synthetic_job_id_str} not found." # Non ritentare
            
            if job.status != SyntheticDatasetJob.Status.PENDING:
                print(f"{task_id_log_prefix} Job {synthetic_job_id_str} not PENDING (Status: {job.status}). Aborting.")
                return f"Aborted: Job {synthetic_job_id_str} not PENDING." # Non ritentare
            
            job.status = SyntheticDatasetJob.Status.GENERATING_DATA
            job.error_message = None # Pulisci errori precedenti
            job.save(update_fields=['status', 'updated_at', 'error_message'])
        print(f"{task_id_log_prefix} Job status set to GENERATING_DATA.")

        # --- 2. Prepara Prompt per OpenAI ---
        if not openai_client:
            raise Exception("OpenAI client is not initialized in tasks.py. Cannot generate synthetic data.")

        user_prompt = job.user_prompt
        num_rows = job.num_rows_requested

        system_prompt = f"""You are an AI assistant that generates synthetic tabular data in CSV format.
The user will provide a description of the dataset and the desired number of data rows.
Your task is to:
1. Understand the user's request.
2. Infer a reasonable set of column headers based on the user's prompt. The first row of your output MUST be these headers.
3. Generate {num_rows} rows of realistic-looking but entirely fictional data that fits the description and the headers.
4. Ensure the data types for each column are consistent (e.g., numbers for age/price, strings for names/categories, dates if appropriate).
5. Format the entire output STRICTLY as a CSV string, with comma (,) as the delimiter.
6. DO NOT include any explanations, introductions, summaries, or any text other than the CSV data itself.
7. IMPORTANT: If a data field itself contains a comma (,), newlines, or double quotes ("), ensure that ENTIRE field is enclosed in double quotes. Any double quote character (") within such an enclosed field must be escaped by preceding it with another double quote (e.g., "This field contains a ""quote"" and, a comma.").
8. Each data row MUST have the exact same number of columns as the header row. Ensure all quoted strings are properly terminated.
Your output should start directly with the header row and be followed by the data rows.
"""
        
        print(f"{task_id_log_prefix} Sending prompt to OpenAI. User prompt (first 100 chars): '{user_prompt[:100]}...', Num rows: {num_rows}")

        # --- 3. Chiama OpenAI ---
        completion = openai_client.chat.completions.create(
            model="gpt-3.5-turbo", # O gpt-4 se budget e necessità lo richiedono
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate a CSV dataset with {num_rows} data rows based on this description: {user_prompt}"}
            ],
            temperature=0.5, # Un po' di variabilità, ma non troppa per dati strutturati
            max_tokens=3500  # Calcola in base a num_rows e complessità attesa. 1 riga CSV ~10-50 token.
        )
        raw_csv_string = completion.choices[0].message.content
        print(f"{task_id_log_prefix} OpenAI Raw Response (first 200 chars): {raw_csv_string[:200]}...")

        # --- 4. Valida e Pulisci CSV ---
        # Rimuovi eventuali ```csv ... ``` markdown wrappers o testo extra
        if "```csv" in raw_csv_string:
            raw_csv_string = raw_csv_string.split("```csv", 1)[-1]
        if "```" in raw_csv_string:
            raw_csv_string = raw_csv_string.split("```", 1)[0]
        raw_csv_string = raw_csv_string.strip() # Rimuovi spazi bianchi iniziali/finali e newline

        if not raw_csv_string or len(raw_csv_string.splitlines()) < 2: # Header + almeno 1 riga dati
            raise ValueError("OpenAI did not return valid CSV data (too short or empty after cleaning).")

        df_generated = None
        try:
            # Usa StringIO per trattare la stringa come un file
            csv_io = StringIO(raw_csv_string)
            df_generated = pd.read_csv(csv_io, quoting=csv.QUOTE_MINIMAL, on_bad_lines='warn')
            
            if df_generated.empty or len(df_generated.columns) == 0:
                raise ValueError("Parsed CSV from OpenAI is empty or has no columns.")
            
            print(f"{task_id_log_prefix}   Successfully parsed CSV from OpenAI. Shape: {df_generated.shape}")
            # Ricostruisci la stringa CSV da Pandas per assicurare un formato pulito e standard
            clean_csv_string = df_generated.to_csv(index=False) # index=False è importante
        except pd.errors.ParserError as pe:
            print(f"{task_id_log_prefix}   Pandas parsing error on OpenAI output: {pe}")
            raise ValueError(f"OpenAI output could not be parsed as valid CSV: {pe}")
        except Exception as e_parse:
            print(f"{task_id_log_prefix}   Unexpected error parsing OpenAI CSV: {e_parse}")
            raise ValueError(f"Unexpected error parsing OpenAI CSV: {e_parse}")

        # --- NUOVO: Analizza il DataFrame generato per potential_uses e altri metadati ---
        print(f"{task_id_log_prefix}   Analyzing generated DataFrame for potential uses...")
        # Qui df_generated è il DataFrame pulito
        extracted_metadata = analyze_dataframe_for_potential_uses(df_generated)
        print(f"{task_id_log_prefix}   Analysis complete. Potential uses: {extracted_metadata.get('potential_uses')}")
        # --- FINE NUOVO ---

        # --- 5. Aggiorna stato Job ---
        with transaction.atomic():
            # Rileggi il job per evitare di sovrascrivere eventuali aggiornamenti concorrenti (improbabile per task Celery)
            job_to_update_status = SyntheticDatasetJob.objects.get(pk=synthetic_job_id_str)
            job_to_update_status.status = SyntheticDatasetJob.Status.SAVING_TO_RESOURCES
            job_to_update_status.save(update_fields=['status', 'updated_at'])
        print(f"{task_id_log_prefix} Job status set to SAVING_TO_RESOURCES.")

        # --- 6. Salva CSV nel Resource Manager ---
        # Determina nome file
        final_csv_filename = job.generated_dataset_name # Nome già determinato nella vista
        if not final_csv_filename.lower().endswith('.csv'): # Assicura estensione
            final_csv_filename += '.csv'
        
        csv_bytes = clean_csv_string.encode('utf-8')
        csv_file_in_memory = ContentFile(csv_bytes, name=final_csv_filename)

        form_data_payload = {
            'name': final_csv_filename,
            'description': f"Synthetic dataset (AI): {job.user_prompt[:100]}... Job ID: {job.id.hex[:8]}",
            'owner_id': str(job.owner_id), # Invia come stringa
            'metadata_json': json.dumps(extracted_metadata) # Invia i metadati pre-analizzati
        }
        files_payload = {'file': (final_csv_filename, BytesIO(csv_bytes), 'text/csv')} # Usa BytesIO per 'file'
        
        print(f"{task_id_log_prefix}   Uploading synthetic CSV '{final_csv_filename}' to RM. Metadata: {extracted_metadata.get('potential_uses')}")
        rm_upload_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/upload-synthetic-content/"
        internal_headers = {} # requests imposterà Content-Type multipart
        if INTERNAL_API_SECRET: internal_headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET

        rm_response = requests.post(rm_upload_url, headers=internal_headers, data=form_data_payload, files=files_payload, timeout=60)
        print(f"{task_id_log_prefix}   RM Internal Upload API response status: {rm_response.status_code}")
        rm_response.raise_for_status() # Solleva eccezione per errori 4xx/5xx
        
        rm_response_data = rm_response.json()
        uploaded_resource_id = rm_response_data.get('id') # L'endpoint interno dovrebbe restituire l'oggetto Resource completo

        if not uploaded_resource_id:
            raise Exception("Resource Manager internal endpoint did not return a resource ID after upload.")
        
        print(f"{task_id_log_prefix}   CSV successfully saved by Resource Manager. Resource ID: {uploaded_resource_id}")

        # --- 7. Aggiorna Job Finale ---
        with transaction.atomic():
            final_job = SyntheticDatasetJob.objects.get(pk=synthetic_job_id_str) # Rileggi per sicurezza
            final_job.status = SyntheticDatasetJob.Status.COMPLETED
            final_job.resource_id = uuid.UUID(uploaded_resource_id) if isinstance(uploaded_resource_id, str) else uploaded_resource_id # Assicura tipo UUID
            final_job.generated_dataset_name = final_csv_filename # Salva il nome effettivo
            final_job.error_message = None # Pulisci eventuali errori precedenti
            final_job.save()

        end_time = time.time()
        print(f"{task_id_log_prefix} Successfully completed for Job ID: {synthetic_job_id_str}. Resource ID: {uploaded_resource_id}. Time: {end_time - start_time:.2f}s")
        return f"Completed SyntheticDatasetJob ID: {synthetic_job_id_str}. Resource ID: {uploaded_resource_id}"

    except Exception as exc:
        print(f"{task_id_log_prefix} FATAL Error processing SyntheticDatasetJob ID {synthetic_job_id_str}: {exc}")
        traceback.print_exc() # Stampa lo stack trace completo
        try:
            # Assicurati che 'job' sia l'istanza corretta o ricaricala
            # Il blocco 'job = None' all'inizio e il try/except per il primo get gestiscono questo
            if job is None and synthetic_job_id_str: # Prova a ricaricare se job non è stato assegnato
                job = SyntheticDatasetJob.objects.filter(pk=synthetic_job_id_str).first()

            if job: # Se il job esiste, aggiorna lo stato
                with transaction.atomic():
                    # Rileggi per essere sicuro di avere l'ultima versione, specialmente per lo stato
                    job_to_fail = SyntheticDatasetJob.objects.get(pk=job.id)
                    job_to_fail.status = SyntheticDatasetJob.Status.FAILED
                    job_to_fail.error_message = f"Generation failed: {str(exc)[:1000]}" # Limita lunghezza
                    job_to_fail.save(update_fields=['status', 'error_message', 'updated_at'])
            else:
                 print(f"{task_id_log_prefix} Could not find job {synthetic_job_id_str} to mark as FAILED after an error.")
        except Exception as update_exc:
            print(f"{task_id_log_prefix} FATAL: Could not update status to FAILED for Job {synthetic_job_id_str}: {update_exc}")
        
        # Rilancia l'eccezione per far sì che Celery la gestisca (es. ritentativi, dead letter queue)
        # La configurazione max_retries=1 significa che ritenterà una volta.
        raise self.retry(exc=exc, countdown=int(os.getenv('CELERY_TASK_RETRY_COUNTDOWN', 120)) * (self.request.retries + 1))