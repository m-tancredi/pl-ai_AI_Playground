import os
import magic  # python-magic
import pandas as pd
import docx   # python-docx
from io import BytesIO
from PyPDF2 import PdfReader  # pypdf2
from PIL import Image as PillowImage, UnidentifiedImageError
from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.db import transaction

from .models import Resource

# --- Costanti per Analisi ---
CSV_SAMPLE_ROWS = 1000  # Leggi le prime N righe per analisi CSV
TEXT_WORD_THRESHOLD_RAG = 50 # Minimo parole per suggerire RAG
CATEGORICAL_THRESHOLD_RATIO = 0.2 # Max % di valori unici per considerare una colonna categorica
MAX_CATEGORIES_SAMPLE = 10 # Max categorie da elencare nei metadati

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_uploaded_resource(self, resource_id):
    """
    Task Celery per processare un file dopo l'upload.
    Estrae metadati, genera thumbnail, analizza contenuto, suggerisce usi,
    e aggiorna lo stato nel DB.
    """
    print(f"[Task ID: {self.request.id}] Starting processing for Resource ID: {resource_id}")
    processing_errors = [] # Lista per collezionare errori non fatali

    try:
        with transaction.atomic():
            # Ottieni la risorsa bloccandola per evitare race conditions se necessario
            # resource = Resource.objects.select_for_update().get(pk=resource_id)
            try:
                resource = Resource.objects.get(pk=resource_id)
            except Resource.DoesNotExist:
                 print(f"[Task ID: {self.request.id}] Error: Resource {resource_id} not found. Task aborted.")
                 # Non ritentare se la risorsa non esiste più
                 return f"Aborted: Resource {resource_id} not found."

            # Evita riprocessamento
            if resource.status != Resource.Status.PROCESSING:
                print(f"[Task ID: {self.request.id}] Resource {resource_id} not PROCESSING (status: {resource.status}). Skipping.")
                return f"Skipped: Resource {resource_id} not PROCESSING."

            # Inizializza/Resetta campi
            resource.mime_type = None
            resource.metadata = {}
            resource.thumbnail = None # Cancella vecchia thumbnail se presente? Dipende dalla logica
            resource.error_message = None
            potential_uses = set() # Usiamo un set per evitare duplicati

            # --- Accesso al File ---
            file_content = None
            file_path_physical = None
            file_exists = False
            try:
                if not resource.file or not resource.file.name:
                     raise FileNotFoundError("Resource record has no associated file name.")
                file_exists = default_storage.exists(resource.file.name)
                if not file_exists:
                     raise FileNotFoundError(f"File path '{resource.file.name}' not found in storage.")

                # Ottieni dimensione
                resource.size = default_storage.size(resource.file.name)
                print(f"[Task ID: {self.request.id}] File: {resource.file.name}, Size: {resource.size} bytes")

                # Prova ad accedere al path fisico (più efficiente per magic)
                try:
                    file_path_physical = default_storage.path(resource.file.name)
                    print(f"[Task ID: {self.request.id}]   Accessing via local path: {file_path_physical}")
                except (NotImplementedError, AttributeError):
                    print(f"[Task ID: {self.request.id}]   Storage does not support direct path access. Reading content.")
                    with default_storage.open(resource.file.name, 'rb') as f:
                        # Leggi tutto il contenuto solo se necessario (es. per buffer magic o Pillow)
                        # Per CSV grandi, eviteremo di leggerlo tutto qui
                        pass # Non leggiamo ancora, lo faremo se serve

            except FileNotFoundError as fnf_exc:
                 raise fnf_exc # Rilancia per bloccare il task e impostare FAILED
            except Exception as storage_exc:
                 print(f"[Task ID: {self.request.id}]   Error accessing storage: {storage_exc}")
                 processing_errors.append(f"Storage access error: {storage_exc}")
                 # Continua se possibile (es. MIME type da nome file?) o fallisci? Decidiamo di fallire.
                 raise IOError(f"Storage access error for {resource.file.name}") from storage_exc

            # --- Rilevamento MIME Type ---
            try:
                if file_path_physical:
                    resource.mime_type = magic.from_file(file_path_physical, mime=True)
                else: # Se non abbiamo path fisico, dobbiamo leggere il buffer
                    with default_storage.open(resource.file.name, 'rb') as f:
                         # Leggi solo i primi bytes sufficienti per magic
                         # Di default python-magic legge abbastanza, non serve limitare qui
                         file_buffer = f.read()
                    resource.mime_type = magic.from_buffer(file_buffer, mime=True)
                print(f"[Task ID: {self.request.id}]   Detected MIME type: {resource.mime_type}")
            except Exception as mime_exc:
                 print(f"[Task ID: {self.request.id}]   Warning: MIME detection failed: {mime_exc}")
                 processing_errors.append(f"MIME detection failed: {mime_exc}")
                 resource.mime_type = 'application/octet-stream' # Fallback

            # --- Analisi Contenuto e Suggerimenti ---
            metadata_extracted = {}
            content_buffer = None # Riusato per diversi tipi

            # 1. Analisi CSV
            if resource.mime_type == 'text/csv' or resource.original_filename.lower().endswith('.csv'):
                print(f"[Task ID: {self.request.id}]   Processing as CSV...")
                try:
                     with default_storage.open(resource.file.name, 'rb') as f:
                        # Leggi campione o tutto? Per ora campione. Gestire encoding!
                        # Prova con encoding comuni
                        encodings_to_try = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
                        df_sample = None
                        detected_encoding = None
                        for enc in encodings_to_try:
                            try:
                                # Riapri o seek(0) se leggi da buffer
                                f.seek(0)
                                df_sample = pd.read_csv(f, nrows=CSV_SAMPLE_ROWS, encoding=enc, low_memory=False)
                                detected_encoding = enc
                                print(f"[Task ID: {self.request.id}]     CSV read successfully with encoding: {enc}")
                                break # Esci al primo successo
                            except UnicodeDecodeError:
                                print(f"[Task ID: {self.request.id}]     CSV decode failed with {enc}, trying next...")
                                continue # Prova prossimo encoding
                            except Exception as pd_read_exc: # Altri errori pandas
                                 print(f"[Task ID: {self.request.id}]     Pandas read error ({enc}): {pd_read_exc}")
                                 # Non interrompere per un encoding, ma logga se falliscono tutti
                                 if enc == encodings_to_try[-1]: # Se era l'ultimo tentativo
                                     raise pd_read_exc # Rilancia l'ultimo errore pandas

                        if df_sample is not None:
                            metadata_extracted['num_rows_sample'] = len(df_sample)
                            metadata_extracted['num_cols'] = len(df_sample.columns)
                            metadata_extracted['headers'] = list(df_sample.columns)
                            metadata_extracted['encoding_detected'] = detected_encoding
                            # Analisi tipi colonna e suggerimenti
                            col_types = {}
                            numeric_cols = []
                            categorical_cols = []
                            for col in df_sample.columns:
                                dtype_str = str(df_sample[col].dtype)
                                col_types[col] = dtype_str
                                if pd.api.types.is_numeric_dtype(df_sample[col]):
                                    numeric_cols.append(col)
                                elif pd.api.types.is_string_dtype(df_sample[col]) or pd.api.types.is_object_dtype(df_sample[col]):
                                     unique_vals = df_sample[col].nunique()
                                     if unique_vals / len(df_sample) < CATEGORICAL_THRESHOLD_RATIO:
                                         categorical_cols.append(col)
                                         # Opzionale: aggiungi valori unici (pochi) ai metadati
                                         if unique_vals <= MAX_CATEGORIES_SAMPLE:
                                              metadata_extracted.setdefault('sample_categories', {})[col] = df_sample[col].unique().tolist()

                            metadata_extracted['column_types'] = col_types
                            print(f"[Task ID: {self.request.id}]     Numeric cols: {numeric_cols}")
                            print(f"[Task ID: {self.request.id}]     Categorical cols: {categorical_cols}")

                            # Logica suggerimenti
                            if len(numeric_cols) >= 2: potential_uses.add("regression")
                            if len(categorical_cols) >= 1 and len(df_sample.columns) > 1 : potential_uses.add("classification")
                            if len(numeric_cols) >= 2: potential_uses.add("clustering") # Esempio clustering
                            # Aggiungere logica time series se necessario

                        else: # Se nessun encoding ha funzionato
                             processing_errors.append("Could not read CSV data due to encoding or parsing errors.")

                except Exception as csv_exc:
                     print(f"[Task ID: {self.request.id}]   Warning: CSV processing failed: {csv_exc}")
                     processing_errors.append(f"CSV processing error: {csv_exc}")

            # 2. Analisi Immagini
            elif resource.mime_type and resource.mime_type.startswith('image/'):
                 print(f"[Task ID: {self.request.id}]   Processing as Image...")
                 try:
                     with default_storage.open(resource.file.name, 'rb') as f:
                        content_buffer = BytesIO(f.read()) # Leggi in memoria per Pillow

                     with PillowImage.open(content_buffer) as img:
                         resource.width = img.width
                         resource.height = img.height
                         metadata_extracted['format'] = img.format
                         metadata_extracted['mode'] = img.mode
                         print(f"[Task ID: {self.request.id}]     Image dimensions: {img.width}x{img.height}")

                         # Genera Thumbnail
                         img.thumbnail(settings.THUMBNAIL_SIZE)
                         thumb_io = BytesIO()
                         thumb_format = 'PNG' if img.mode == 'RGBA' else 'JPEG'
                         img.save(thumb_io, format=thumb_format, quality=85) # Qualità per JPEG
                         thumb_io.seek(0)

                         base, ext = os.path.splitext(os.path.basename(resource.file.name))
                         thumb_filename = f"{base}_thumb.{thumb_format.lower()}"
                         # Salva thumbnail (save=False perché salviamo il modello alla fine)
                         resource.thumbnail.save(thumb_filename, ContentFile(thumb_io.read()), save=False)
                         print(f"[Task ID: {self.request.id}]     Generated thumbnail: {resource.thumbnail.name}")

                     potential_uses.add("image_generation_input")

                 except UnidentifiedImageError:
                     print(f"[Task ID: {self.request.id}]   Warning: Pillow could not identify image file.")
                     processing_errors.append("Could not identify image format.")
                 except Exception as img_exc:
                     print(f"[Task ID: {self.request.id}]   Warning: Image processing/thumbnail failed: {img_exc}")
                     processing_errors.append(f"Image processing error: {img_exc}")

            # 3. Analisi Testo (PDF, DOCX, TXT)
            elif resource.mime_type == 'application/pdf':
                print(f"[Task ID: {self.request.id}]   Processing as PDF...")
                try:
                    text_content = ""
                    page_count = 0
                    with default_storage.open(resource.file.name, 'rb') as f:
                        reader = PdfReader(f)
                        page_count = len(reader.pages)
                        for page in reader.pages:
                            text_content += page.extract_text() + "\n"

                    word_count = len(text_content.split())
                    metadata_extracted['page_count'] = page_count
                    metadata_extracted['word_count_approx'] = word_count
                    print(f"[Task ID: {self.request.id}]     PDF Pages: {page_count}, Approx words: {word_count}")
                    if word_count > TEXT_WORD_THRESHOLD_RAG:
                        potential_uses.add("rag")
                except Exception as pdf_exc:
                    print(f"[Task ID: {self.request.id}]   Warning: PDF processing failed: {pdf_exc}")
                    processing_errors.append(f"PDF processing error: {pdf_exc}")

            elif resource.mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'] or resource.original_filename.lower().endswith(('.docx')):
                print(f"[Task ID: {self.request.id}]   Processing as DOCX...")
                try:
                     text_content = ""
                     with default_storage.open(resource.file.name, 'rb') as f:
                         # python-docx legge direttamente dal file-like object
                         document = docx.Document(f)
                         for para in document.paragraphs:
                             text_content += para.text + "\n"
                         # TODO: Estrarre testo da tabelle se necessario
                     word_count = len(text_content.split())
                     # page_count non facilmente ottenibile da python-docx
                     metadata_extracted['word_count_approx'] = word_count
                     print(f"[Task ID: {self.request.id}]     DOCX Approx words: {word_count}")
                     if word_count > TEXT_WORD_THRESHOLD_RAG:
                         potential_uses.add("rag")
                except Exception as docx_exc:
                    print(f"[Task ID: {self.request.id}]   Warning: DOCX processing failed: {docx_exc}")
                    processing_errors.append(f"DOCX processing error: {docx_exc}")

            elif resource.mime_type and resource.mime_type.startswith('text/'):
                print(f"[Task ID: {self.request.id}]   Processing as generic TEXT...")
                try:
                     with default_storage.open(resource.file.name, 'rb') as f:
                         # Leggi come bytes e decodifica manualmente
                         content_bytes = f.read()
                         try:
                             text_content = content_bytes.decode('utf-8')
                         except UnicodeDecodeError:
                             # Fallback con latin-1 se UTF-8 fallisce
                             text_content = content_bytes.decode('latin-1', errors='ignore')
                     
                     word_count = len(text_content.split())
                     metadata_extracted['word_count_approx'] = word_count
                     print(f"[Task ID: {self.request.id}]     TXT Approx words: {word_count}")
                     if word_count > TEXT_WORD_THRESHOLD_RAG:
                         potential_uses.add("rag")
                except Exception as txt_exc:
                    print(f"[Task ID: {self.request.id}]   Warning: Text file processing failed: {txt_exc}")
                    processing_errors.append(f"Text file processing error: {txt_exc}")


            # --- Finalizzazione ---
            metadata_extracted['potential_uses'] = sorted(list(potential_uses)) # Salva come lista ordinata
            resource.metadata = metadata_extracted
            resource.status = Resource.Status.COMPLETED
            # Concatena errori non fatali se ce ne sono stati
            if processing_errors:
                 resource.error_message = "\n".join(processing_errors)
                 # Decidi se questi errori devono portare a FAILED o COMPLETED con warning
                 # Per ora, consideriamoli non fatali se siamo arrivati qui
                 print(f"[Task ID: {self.request.id}]   Completed with warnings: {processing_errors}")

            # --- Auto-Tagging per RAG ---
            # Se il file è compatibile con RAG, aggiungi automaticamente il tag "RAG"
            if "rag" in potential_uses:
                try:
                    from .models import Tag
                    # Ottieni o crea il tag "RAG"
                    rag_tag, created = Tag.objects.get_or_create(
                        name='RAG',
                        defaults={
                            'color': '#28a745',
                            'description': 'Documenti adatti per Retrieval Augmented Generation'
                        }
                    )
                    # Aggiungi il tag alla risorsa
                    resource.tags.add(rag_tag)
                    if created:
                        print(f"[Task ID: {self.request.id}]   Created new RAG tag")
                    print(f"[Task ID: {self.request.id}]   🏷️ Auto-tagged resource as RAG-compatible")
                except Exception as tag_exc:
                    print(f"[Task ID: {self.request.id}]   Warning: Auto-tagging failed: {tag_exc}")
                    processing_errors.append(f"Auto-tagging error: {tag_exc}")

            resource.save() # Salva tutte le modifiche
            print(f"[Task ID: {self.request.id}] Successfully processed Resource ID: {resource_id}, Status: {resource.status}")
            return f"Processed Resource ID: {resource_id}"

    except FileNotFoundError as e:
         print(f"[Task ID: {self.request.id}] Error processing Resource {resource_id}: File not found - {e}")
         # Aggiorna stato a FAILED se il file non viene trovato all'inizio
         try:
             with transaction.atomic():
                 resource = Resource.objects.get(pk=resource_id)
                 resource.status = Resource.Status.FAILED
                 resource.error_message = f"File not found during processing: {e}"
                 resource.save()
         except Resource.DoesNotExist: pass # Già gestito sopra
         except Exception as update_exc: print(f"FATAL: Could not update FAILED status for {resource_id}: {update_exc}")
         # Non ritentare
         return f"Error: File not found for Resource {resource_id}."
    except Exception as exc:
        print(f"[Task ID: {self.request.id}] FATAL Error processing Resource {resource_id}: {exc}")
        # Logga l'errore e imposta lo stato a FAILED
        try:
             with transaction.atomic():
                 resource = Resource.objects.get(pk=resource_id)
                 resource.status = Resource.Status.FAILED
                 resource.error_message = f"Fatal processing error: {exc}"
                 resource.save()
        except Resource.DoesNotExist: pass
        except Exception as update_exc: print(f"FATAL: Could not update FAILED status for {resource_id}: {update_exc}")
        # Rilancia per far ritentare Celery (se max_retries non raggiunto)
        # Potrebbe essere utile aggiungere un cooldown esponenziale
        print(f"[Task ID: {self.request.id}] Retrying task (attempt {self.request.retries + 1})...")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) # Esempio backoff esponenziale