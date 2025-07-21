# pl-ai/backend/image_classifier_service/classifier_api/tasks.py

import os
import time
import json
import numpy as np
import tensorflow as tf # Assicurati che sia installato
from tensorflow import keras
from PIL import Image as PillowImage, UnidentifiedImageError
from io import BytesIO
import base64
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction
import requests  # <-- AGGIUNGO PER CHIAMATE HTTP AL RM

from .models import TrainedModel # Assumendo che il modello sia in .models

# --- Costanti e Impostazioni (potrebbero anche venire da settings.py) ---
# Queste sono usate se non specificate diversamente nei training_params
DEFAULT_EPOCHS = 15
DEFAULT_BATCH_SIZE = 32
DEFAULT_VALIDATION_SPLIT = 0.2 # Usa 20% dei dati per validazione interna al fit

# --- Funzioni Helper ML ---

def preprocess_image(img_bytes, target_height=None, target_width=None, target_channels=None):
    """
    Preprocessa i bytes dell'immagine per il modello Keras.
    Normalizza i pixel a [0, 1].
    """
    height = target_height if target_height is not None else settings.IMG_HEIGHT
    width = target_width if target_width is not None else settings.IMG_WIDTH
    channels = target_channels if target_channels is not None else settings.IMG_CHANNELS

    try:
        img = PillowImage.open(BytesIO(img_bytes))
        # Converti in RGB se ha 4 canali (RGBA) o è in scala di grigi
        if img.mode == 'RGBA' or img.mode == 'P': # P è per palette, spesso PNG
            img = img.convert('RGB')
        elif img.mode == 'L': # Scala di grigi
            img = img.convert('RGB') # O addestra un modello per scala di grigi

        if img.size != (width, height):
            img = img.resize((width, height), PillowImage.Resampling.LANCZOS) # Usa un buon filtro di resampling

        img_array = tf.keras.utils.img_to_array(img)
        # La normalizzazione può essere fatta qui o con un layer Rescaling nel modello
        # Se il modello ha un layer Rescaling, non normalizzare qui.
        # Per build_simple_cnn che ha Rescaling, questa riga non serve.
        # img_array = img_array / 255.0 # Normalizza a [0,1]

        img_array = tf.expand_dims(img_array, 0) # Crea un batch di 1 immagine
        return img_array
    except UnidentifiedImageError:
        print(f"Error: Pillow cannot identify image format.")
        return None
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None

def build_simple_cnn(num_classes, img_height=None, img_width=None, img_channels=None):
    """Costruisce un semplice modello CNN Keras per classificazione."""
    height = img_height if img_height is not None else settings.IMG_HEIGHT
    width = img_width if img_width is not None else settings.IMG_WIDTH
    channels = img_channels if img_channels is not None else settings.IMG_CHANNELS

    model = keras.Sequential([
        keras.layers.Input(shape=(height, width, channels), name="input_layer"),
        keras.layers.Rescaling(1./255, name="rescaling_layer"), # Normalizza pixel a [0,1]

        keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv2d_1"),
        keras.layers.MaxPooling2D((2, 2), name="maxpool_1"),

        keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same', name="conv2d_2"),
        keras.layers.MaxPooling2D((2, 2), name="maxpool_2"),

        keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same', name="conv2d_3"),
        keras.layers.MaxPooling2D((2, 2), name="maxpool_3"),

        keras.layers.Flatten(name="flatten_layer"),
        keras.layers.Dense(128, activation='relu', name="dense_1"),
        keras.layers.Dropout(0.5, name="dropout_layer"), # Dropout per regolarizzazione
        keras.layers.Dense(num_classes, activation='softmax', name="output_layer") # Softmax per classificazione multi-classe
    ])

    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001),
                  loss='sparse_categorical_crossentropy', # Per labels intere (0, 1, 2...)
                  metrics=['accuracy'])
    return model

# --- Esempio Transfer Learning (Commentato, da attivare se si vuole usare) ---
# from tensorflow.keras.applications import MobileNetV2
# from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, Input
# from tensorflow.keras.models import Model

# def build_transfer_learning_model(num_classes, img_height=None, img_width=None, img_channels=None):
#     height = img_height if img_height is not None else settings.IMG_HEIGHT
#     width = img_width if img_width is not None else settings.IMG_WIDTH
#     channels = img_channels if img_channels is not None else settings.IMG_CHANNELS

#     base_model = MobileNetV2(input_shape=(height, width, channels),
#                              include_top=False, # Rimuovi il classificatore originale
#                              weights='imagenet') # Carica pesi pre-addestrati

#     # Congela i pesi del modello base
#     base_model.trainable = False

#     # Definisci il nuovo input
#     inputs = Input(shape=(height, width, channels))

#     # Data Augmentation (opzionale ma consigliato)
#     # data_augmentation_layers = keras.Sequential([
#     #     keras.layers.RandomFlip("horizontal"),
#     #     keras.layers.RandomRotation(0.1),
#     #     keras.layers.RandomZoom(0.1),
#     # ], name="data_augmentation")
#     # x = data_augmentation_layers(inputs)
#     # x = base_model(x, training=False) # Passa x se usi data_augmentation

#     # Se non usi data augmentation custom qui (MobileNetV2 ha già rescaling)
#     x = inputs
#     # Il layer Rescaling è già in MobileNetV2 o si può applicare prima
#     # x = keras.layers.Rescaling(1./127.5, offset=-1)(x) # MobileNetV2 si aspetta [-1, 1]

#     x = base_model(x, training=False) # training=False per i layer BatchNormalization
#     x = GlobalAveragePooling2D()(x)
#     x = Dense(128, activation='relu')(x)
#     x = Dropout(0.5)(x)
#     outputs = Dense(num_classes, activation='softmax')(x)
#     model = Model(inputs, outputs)

#     model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001),
#                   loss='sparse_categorical_crossentropy',
#                   metrics=['accuracy'])
#     return model
# --- Fine Esempio Transfer Learning ---

def upload_model_to_resource_manager(model_record):
    """
    Carica automaticamente un modello addestrato sul Resource Manager Service.
    Questa funzione viene chiamata dopo il completamento del training.
    
    Args:
        model_record (TrainedModel): Il record del modello completato
        
    Returns:
        dict: Informazioni sulla risorsa creata o None se fallita
    """
    try:
        print(f"[RM Upload] Starting upload for model {model_record.id} to Resource Manager...")
        
        # Verifica che il modello sia completo e i file esistano
        if model_record.status != TrainedModel.Status.COMPLETED:
            print(f"[RM Upload] Model {model_record.id} not COMPLETED, skipping upload")
            return None
            
        model_full_path = model_record.get_full_model_path()
        if not model_full_path or not os.path.exists(model_full_path):
            print(f"[RM Upload] Model file not found: {model_full_path}")
            return None

        # Prepara i metadati del modello
        metadata = {
            'model_id': str(model_record.id),
            'class_names': model_record.class_names,
            'accuracy': model_record.accuracy,
            'loss': model_record.loss,
            'training_params': model_record.training_params,
            'training_duration': None,
            'model_type': 'image_classifier',
            'framework': 'tensorflow',
            'format': 'keras'
        }
        
        # Calcola durata training se disponibile
        if model_record.training_started_at and model_record.training_finished_at:
            duration = (model_record.training_finished_at - model_record.training_started_at).total_seconds()
            metadata['training_duration_seconds'] = duration
            
        # Prepara nome e descrizione
        model_name = f"{model_record.name}.keras"
        description = f"Modello di classificazione immagini addestrato con {len(model_record.class_names)} classi: {', '.join(model_record.class_names[:5])}{'...' if len(model_record.class_names) > 5 else ''}"
        if model_record.accuracy:
            description += f". Accuratezza: {model_record.accuracy:.2%}"

        # Leggi il file del modello
        with open(model_full_path, 'rb') as model_file:
            files = {
                'file': (model_name, model_file, 'application/octet-stream')
            }
            
            data = {
                'owner_id': model_record.owner_id,
                'name': model_name,
                'description': description,
                'metadata_json': json.dumps(metadata)
            }
            
            # Endpoint interno del Resource Manager
            rm_internal_url = getattr(settings, 'RESOURCE_MANAGER_INTERNAL_URL', 'http://pl-ai-resource-manager-service:8000')
            upload_endpoint = f"{rm_internal_url}/api/internal/resources/upload-synthetic-content/"
            
            # Headers per autenticazione interna
            headers = {
                'X-Internal-Secret': getattr(settings, 'INTERNAL_API_SECRET', 'django-insecure-replace-me-later-!@#$%^&*()_+')
            }
            
            print(f"[RM Upload] Uploading to: {upload_endpoint}")
            
            # Effettua la chiamata HTTP
            response = requests.post(
                upload_endpoint,
                files=files,
                data=data,
                headers=headers,
                timeout=30  # 30 secondi timeout
            )
            
            if response.status_code == 201:
                resource_data = response.json()
                resource_id = resource_data.get('id')
                print(f"[RM Upload] Successfully uploaded model {model_record.id} to Resource Manager. Resource ID: {resource_id}")
                
                # Salva l'ID nel record del modello
                model_record.resource_manager_id = resource_id
                model_record.save(update_fields=['resource_manager_id'])
                
                return resource_data
            else:
                print(f"[RM Upload] Failed to upload model {model_record.id}. Status: {response.status_code}, Response: {response.text}")
                return None
                
    except requests.exceptions.Timeout:
        print(f"[RM Upload] Timeout uploading model {model_record.id} to Resource Manager")
        return None
    except requests.exceptions.ConnectionError:
        print(f"[RM Upload] Connection error uploading model {model_record.id} to Resource Manager")
        return None
    except Exception as e:
        print(f"[RM Upload] Unexpected error uploading model {model_record.id} to Resource Manager: {e}")
        import traceback
        traceback.print_exc()
        return None


# --- Task Celery ---
@shared_task(bind=True, max_retries=1, default_retry_delay=300) # Riprova solo 1 volta dopo 5 min
def train_classifier_task(self, model_id, image_data_list, labels, class_names, training_params):
    """
    Task Celery per addestrare un modello di classificazione immagini.
    """
    task_id_str = f"[Task ID: {self.request.id or 'N/A'}]" # Gestisce se self.request.id è None
    model_id_str = str(model_id) # Assicura sia stringa
    print(f"{task_id_str} Starting training for Model ID: {model_id_str}")
    start_time = time.time()

    try:
        # Ottieni il record del modello dal DB
        with transaction.atomic():
             model_record = TrainedModel.objects.select_for_update().get(pk=model_id_str)
             if model_record.status != TrainedModel.Status.PENDING:
                 print(f"{task_id_str} Model {model_id_str} not PENDING (Status: {model_record.status}). Aborting.")
                 return f"Aborted: Model {model_id_str} not PENDING."
             model_record.status = TrainedModel.Status.TRAINING
             model_record.training_started_at = timezone.now()
             model_record.class_names = class_names # Già impostato alla creazione, ma riconferma
             model_record.training_params = training_params # Già impostato
             model_record.save()

        print(f"{task_id_str} Model status set to TRAINING. Preprocessing images...")

        # --- Preprocessing Dati ---
        processed_images_list = []
        valid_labels_list = []
        num_classes = len(class_names)

        for i, img_base64_data_url in enumerate(image_data_list):
            try:
                if isinstance(img_base64_data_url, str) and img_base64_data_url.startswith('data:image'):
                    try:
                        img_str = img_base64_data_url.split(';base64,', 1)[1]
                        img_bytes = base64.b64decode(img_str)
                    except (IndexError, TypeError, base64.binascii.Error) as decode_err:
                         raise ValueError(f"Invalid base64 data URL format for image {i}: {decode_err}")
                else:
                     raise ValueError(f"Image {i} is not a valid data URL string.")

                preprocessed_img_tensor = preprocess_image(img_bytes)
                if preprocessed_img_tensor is not None:
                    processed_images_list.append(preprocessed_img_tensor)
                    valid_labels_list.append(labels[i])
                else:
                     print(f"{task_id_str}   Warning: Skipping image at index {i} due to preprocessing error.")
            except Exception as img_proc_err:
                 print(f"{task_id_str}   Warning: Skipping image at index {i} due to error: {img_proc_err}")

        if not processed_images_list:
            raise ValueError("No valid images could be preprocessed for training.")

        # Converti in array NumPy
        # tf.concat aspetta una lista di tensori, vstack per array numpy
        train_images_np = np.concatenate(processed_images_list, axis=0)
        train_labels_np = np.array(valid_labels_list)

        print(f"{task_id_str} Preprocessing complete. Images shape: {train_images_np.shape}, Labels shape: {train_labels_np.shape}")

        # --- Costruzione e Addestramento Modello ---
        print(f"{task_id_str} Building model for {num_classes} classes...")
        # Scegli il modello da usare:
        model = build_simple_cnn(num_classes)
        # model = build_transfer_learning_model(num_classes) # Se vuoi provare transfer learning

        model.summary(print_fn=lambda x: print(f"{task_id_str}   {x}")) # Stampa riassunto nei log

        epochs = training_params.get('epochs', DEFAULT_EPOCHS)
        batch_size = training_params.get('batch_size', DEFAULT_BATCH_SIZE)
        validation_split = training_params.get('validation_split', DEFAULT_VALIDATION_SPLIT)

        print(f"{task_id_str} Starting training for {epochs} epochs, batch size {batch_size}, val split {validation_split}...")
        history = model.fit(
            train_images_np,
            train_labels_np,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            verbose=2 # 0 = silent, 1 = progress bar, 2 = one line per epoch (meglio per log Celery)
        )
        print(f"{task_id_str} Training finished.")

        # --- Salvataggio Modello e Risultati ---
        final_accuracy = history.history['accuracy'][-1] if 'accuracy' in history.history else None
        final_loss = history.history['loss'][-1] if 'loss' in history.history else None
        val_accuracy = history.history.get('val_accuracy', [None])[-1]
        val_loss = history.history.get('val_loss', [None])[-1]

        # Path relativi a settings.MODELS_STORAGE_ROOT
        # Il modello TrainedModel usa get_model_upload_path che include instance.id,
        # ma qui non possiamo usarlo direttamente per il path.
        # Costruiamo il path relativo basandoci sulla logica di TrainedModel.
        model_dir_rel = f"user_{model_record.owner_id}/model_{model_id_str}"
        model_filename = f"model.{'keras'}" # Keras format
        class_names_filename = f"class_names.json"

        model_rel_path = os.path.join(model_dir_rel, model_filename)
        class_names_rel_path = os.path.join(model_dir_rel, class_names_filename)

        model_full_path = os.path.join(settings.MODELS_STORAGE_ROOT, model_rel_path)
        class_names_full_path = os.path.join(settings.MODELS_STORAGE_ROOT, class_names_rel_path)

        Path(model_full_path).parent.mkdir(parents=True, exist_ok=True)

        print(f"{task_id_str} Saving model to: {model_full_path}")
        model.save(model_full_path) # Salva modello

        print(f"{task_id_str} Saving class names to: {class_names_full_path}")
        with open(class_names_full_path, 'w') as f:
            json.dump(class_names, f)

        # --- Aggiorna Record DB ---
        with transaction.atomic():
            final_record = TrainedModel.objects.get(pk=model_id_str) # Rileggi
            final_record.status = TrainedModel.Status.COMPLETED
            final_record.accuracy = final_accuracy
            final_record.loss = final_loss
            current_training_params = final_record.training_params or {}
            current_training_params['final_val_accuracy'] = val_accuracy
            current_training_params['final_val_loss'] = val_loss
            final_record.training_params = current_training_params
            final_record.model_path = model_rel_path
            final_record.class_names_path = class_names_rel_path
            final_record.training_finished_at = timezone.now()
            final_record.error_message = None
            final_record.save()

        # NOTA: Upload al Resource Manager rimosso dal training task
        # L'upload ora avviene quando l'utente salva il modello con il nome scelto

        end_time = time.time()
        print(f"{task_id_str} Successfully trained and saved model {model_id_str}. Time: {end_time - start_time:.2f}s")
        return f"Trained model {model_id_str} successfully."

    except Exception as exc:
        print(f"{task_id_str} FATAL Error during training for Model ID {model_id_str}: {exc}")
        import traceback
        traceback.print_exc()
        try:
            with transaction.atomic():
                 failed_record = TrainedModel.objects.get(pk=model_id_str)
                 failed_record.status = TrainedModel.Status.FAILED
                 failed_record.error_message = f"Training failed: {str(exc)[:1000]}" # Limita lunghezza errore
                 failed_record.training_finished_at = timezone.now()
                 failed_record.save()
        except Exception as update_exc:
             print(f"{task_id_str} FATAL: Could not update status to FAILED for Model {model_id_str}: {update_exc}")
        # Non ritentare automaticamente per errori di training complessi a meno che non sia gestibile
        # raise self.retry(exc=exc, countdown=...)
        raise exc # Indica fallimento del task a Celery