import os
import magic # python-magic
import pandas as pd
from io import BytesIO
from PIL import Image as PillowImage # Rinomina per evitare conflitto con modello
from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.db import transaction


from .models import Resource

@shared_task(bind=True, max_retries=3, default_retry_delay=60) # bind=True per accedere a self
def process_uploaded_resource(self, resource_id):
    """
    Task Celery per processare un file dopo l'upload.
    Estrae metadati, genera thumbnail, aggiorna lo stato nel DB.
    """
    print(f"Starting processing for Resource ID: {resource_id}")
    try:
        # Usa transaction.atomic per assicurare che gli aggiornamenti DB siano consistenti
        with transaction.atomic():
            # Ottieni la risorsa (usa select_for_update per bloccare la riga se necessario)
            # resource = Resource.objects.select_for_update().get(pk=resource_id)
            resource = Resource.objects.get(pk=resource_id)

            # Verifica stato iniziale (evita riprocessamento accidentale)
            if resource.status != Resource.Status.PROCESSING:
                print(f"Resource {resource_id} is not in PROCESSING state (current: {resource.status}). Skipping.")
                return f"Skipped: Resource {resource_id} not in PROCESSING state."

            # --- Accesso al File ---
            if not resource.file or not default_storage.exists(resource.file.name):
                raise FileNotFoundError(f"Resource file not found in storage for ID {resource_id} at path {resource.file.name}")

            file_content = None
            file_path_physical = None # Utile per python-magic se su filesystem
            metadata_extracted = resource.metadata or {}

            # Determina se leggere da storage locale o remoto
            if hasattr(default_storage, 'path'): # Probabilmente FileSystemStorage
                try:
                    file_path_physical = default_storage.path(resource.file.name)
                    print(f"  Accessing file via local path: {file_path_physical}")
                except NotImplementedError:
                    # Alcuni storage (come S3 senza collectstatic locale) non supportano .path()
                    print(f"  Storage does not support direct path access. Reading file content.")
                    with default_storage.open(resource.file.name, 'rb') as f:
                        file_content = f.read()
            else: # Storage remoto (es. S3)
                 print(f"  Reading file content from remote storage: {resource.file.name}")
                 with default_storage.open(resource.file.name, 'rb') as f:
                    file_content = f.read()

            # Aggiorna dimensione file se non già presente
            if resource.size is None:
                resource.size = default_storage.size(resource.file.name)
                print(f"  Updated file size: {resource.size} bytes")

            # --- Rilevamento MIME Type ---
            try:
                if file_path_physical: # Usa il path se possibile (più efficiente per magic)
                     detected_mime = magic.from_file(file_path_physical, mime=True)
                elif file_content: # Altrimenti usa il buffer letto
                     detected_mime = magic.from_buffer(file_content, mime=True)
                else:
                     detected_mime = 'application/octet-stream' # Fallback
                resource.mime_type = detected_mime
                print(f"  Detected MIME type: {resource.mime_type}")
            except Exception as mime_exc:
                 print(f"  Warning: MIME type detection failed: {mime_exc}")
                 resource.mime_type = 'application/octet-stream' # Fallback

            # --- Processamento Specifico per Tipo (Immagini) ---
            if resource.mime_type and resource.mime_type.startswith('image/'):
                print("  Processing as image...")
                try:
                    # Usa il contenuto letto o riapri il file
                    img_content_buffer = BytesIO(file_content) if file_content else default_storage.open(resource.file.name, 'rb')
                    with PillowImage.open(img_content_buffer) as img:
                        # Estrai dimensioni
                        resource.width = img.width
                        resource.height = img.height
                        metadata_extracted['format'] = img.format
                        metadata_extracted['mode'] = img.mode
                        print(f"  Extracted image dimensions: {img.width}x{img.height}")

                        # Genera Thumbnail
                        img.thumbnail(settings.THUMBNAIL_SIZE)
                        thumb_io = BytesIO()
                        thumb_format = 'PNG' if img.format == 'PNG' else 'JPEG' # Mantieni trasparenza PNG
                        img.save(thumb_io, format=thumb_format)
                        thumb_io.seek(0)

                        # Salva thumbnail usando lo storage
                        base, ext = os.path.splitext(os.path.basename(resource.file.name))
                        thumb_filename = f"{base}_thumb.{thumb_format.lower()}"
                        # upload_to di ImageField costruirà il path completo
                        resource.thumbnail.save(thumb_filename, ContentFile(thumb_io.read()), save=False) # save=False qui
                        print(f"  Generated and saved thumbnail: {resource.thumbnail.name}")

                    # Chiudi il buffer se è stato aperto esplicitamente
                    if not file_content and hasattr(img_content_buffer, 'close'):
                         img_content_buffer.close()

                except Exception as img_exc:
                     print(f"  Warning: Image processing/thumbnail generation failed: {img_exc}")
                     # Non impostare lo stato FAILED solo per errore thumbnail? Dipende dai requisiti.
                     resource.error_message = (resource.error_message or "") + f"Image processing error: {img_exc}\n"


            # --- Processamento Specifico per Tipo (CSV) ---
            elif resource.mime_type and ('csv' in resource.mime_type or resource.original_filename.lower().endswith('.csv')):
                 print("  Processing as CSV...")
                 try:
                      content_buffer = BytesIO(file_content) if file_content else default_storage.open(resource.file.name, 'rb')
                      # Leggi solo header
                      # Aumenta sniff size se necessario per file con commenti iniziali
                      df_head = pd.read_csv(content_buffer, nrows=5, encoding='utf-8', on_bad_lines='skip')
                      metadata_extracted['headers'] = list(df_head.columns)
                      metadata_extracted['sample_rows'] = df_head.to_dict(orient='records')
                      # Potresti aggiungere conteggio righe (leggendo tutto il file o stimando)
                      print(f"  Extracted CSV headers: {metadata_extracted['headers']}")
                      if hasattr(content_buffer, 'close'): content_buffer.close() # Chiudi se aperto qui
                 except Exception as csv_exc:
                     print(f"  Warning: CSV processing failed: {csv_exc}")
                     resource.error_message = (resource.error_message or "") + f"CSV processing error: {csv_exc}\n"


            # --- Altri Tipi di File (PDF, etc.) ---
            # Aggiungere qui logica specifica se necessario


            # --- Aggiornamento Finale ---
            resource.metadata = metadata_extracted
            resource.status = Resource.Status.COMPLETED
            resource.error_message = None # Cancella errori se il processo principale è ok
            resource.save() # Salva tutte le modifiche (inclusa thumbnail se salvata con save=False prima)

            print(f"Successfully processed Resource ID: {resource_id}")
            return f"Processed Resource ID: {resource_id}"

    except Resource.DoesNotExist:
        print(f"Error: Resource {resource_id} not found.")
        # Non ritentare se la risorsa non esiste
        return f"Error: Resource {resource_id} not found."
    except FileNotFoundError as e:
         print(f"Error processing Resource {resource_id}: File not found - {e}")
         with transaction.atomic(): # Aggiorna stato anche se file non trovato
             resource = Resource.objects.get(pk=resource_id)
             resource.status = Resource.Status.FAILED
             resource.error_message = f"File not found during processing: {e}"
             resource.save()
         # Non ritentare se il file non c'è
         return f"Error: File not found for Resource {resource_id}."
    except Exception as exc:
        print(f"Error processing Resource {resource_id}: {exc}")
        # Logga l'errore e imposta lo stato a FAILED
        try:
             with transaction.atomic():
                 resource = Resource.objects.get(pk=resource_id)
                 resource.status = Resource.Status.FAILED
                 resource.error_message = f"Processing failed: {exc}"
                 resource.save()
        except Exception as update_exc:
             print(f"FATAL: Could not update status to FAILED for Resource {resource_id}: {update_exc}")

        # Rilancia l'eccezione per far ritentare Celery (se configurato)
        # self.retry(exc=exc) # Usare con cautela, potrebbe causare loop
        raise exc # Solleva di nuovo per indicare fallimento a Celery