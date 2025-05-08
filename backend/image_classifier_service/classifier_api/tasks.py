import os
import time
import json
import numpy as np
import tensorflow as tf
from tensorflow import keras
from PIL import Image as PillowImage
from io import BytesIO
import base64
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .models import TrainedModel

# --- Funzioni Helper ML ---

def preprocess_image(img_bytes):
    """Preprocessa i bytes dell'immagine per il modello Keras."""
    try:
        img = PillowImage.open(BytesIO(img_bytes)).convert('RGB') # Assicura 3 canali
        img = img.resize((settings.IMG_HEIGHT, settings.IMG_WIDTH))
        img_array = tf.keras.utils.img_to_array(img)
        # Normalizza se il modello lo richiede (spesso /255.)
        img_array = tf.expand_dims(img_array, 0) # Crea un batch
        return img_array / 255.0 # Normalizza a [0,1]
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None

def build_simple_cnn(num_classes):
    """Costruisce un semplice modello CNN Keras per classificazione."""
    # Potresti spostare questo in un file ml_models.py
    model = keras.Sequential([
        keras.layers.Input(shape=(settings.IMG_HEIGHT, settings.IMG_WIDTH, settings.IMG_CHANNELS)),
        keras.layers.Rescaling(1./255), # Alternativa alla normalizzazione manuale
        keras.layers.Conv2D(32, 3, activation='relu'),
        keras.layers.MaxPooling2D(),
        keras.layers.Conv2D(64, 3, activation='relu'),
        keras.layers.MaxPooling2D(),
        keras.layers.Conv2D(128, 3, activation='relu'),
        keras.layers.MaxPooling2D(),
        keras.layers.Flatten(),
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dropout(0.5), # Dropout per regolarizzazione
        keras.layers.Dense(num_classes, activation='softmax') # Softmax per classificazione multi-classe
    ])
    model.compile(optimizer='adam',
                  loss='sparse_categorical_crossentropy', # Per labels intere
                  metrics=['accuracy'])
    return model

# --- Task Celery ---

@shared_task(bind=True, max_retries=1, default_retry_delay=300) # Riprova solo 1 volta dopo 5 min?
def train_classifier_task(self, model_id, image_data_list, labels, class_names, training_params):
    """
    Task Celery per addestrare un modello di classificazione immagini.
    """
    print(f"[Task ID: {self.request.id}] Starting training for Model ID: {model_id}")
    start_time = time.time()

    try:
        # Ottieni il record del modello dal DB
        with transaction.atomic(): # Blocca la riga se necessario
             model_record = TrainedModel.objects.select_for_update().get(pk=model_id)
             if model_record.status != TrainedModel.Status.PENDING:
                 print(f"[Task ID: {self.request.id}] Model {model_id} not PENDING (Status: {model_record.status}). Aborting.")
                 return f"Aborted: Model {model_id} not PENDING."
             # Imposta stato TRAINING e timestamp inizio
             model_record.status = TrainedModel.Status.TRAINING
             model_record.training_started_at = timezone.now()
             model_record.class_names = class_names # Salva i nomi classi subito
             model_record.training_params = training_params
             model_record.save()

        print(f"[Task ID: {self.request.id}] Model status set to TRAINING. Preprocessing images...")

        # --- Preprocessing Dati ---
        processed_images = []
        valid_labels = []
        num_classes = len(class_names)

        for i, img_base64_data_url in enumerate(image_data_list):
            try:
                # Estrai bytes da stringa data:image/...;base64,...
                if isinstance(img_base64_data_url, str) and img_base64_data_url.startswith('data:image'):
                    try:
                        # Rimuovi il prefisso 'data:image/...;base64,'
                        img_str = img_base64_data_url.split(';base64,', 1)[1]
                        img_bytes = base64.b64decode(img_str) # Decodifica
                    except (IndexError, TypeError, base64.binascii.Error) as decode_err:
                         raise ValueError(f"Invalid base64 data URL format: {decode_err}") from decode_err
                else:
                     raise ValueError("Received invalid non-data-URL string in image list.")

                preprocessed = preprocess_image(img_bytes)
                if preprocessed is not None:
                    processed_images.append(preprocessed)
                    valid_labels.append(labels[i])
                else:
                     print(f"[Task ID: {self.request.id}]   Warning: Skipping image at index {i} due to preprocessing error.")
            except Exception as img_proc_err:
                 print(f"[Task ID: {self.request.id}]   Warning: Skipping image at index {i} due to error: {img_proc_err}")

        if not processed_images:
            raise ValueError("No valid images could be preprocessed.")

        # Converti in array NumPy
        # Concatena lungo l'asse del batch (asse 0)
        train_images = np.vstack(processed_images)
        train_labels = np.array(valid_labels)

        print(f"[Task ID: {self.request.id}] Preprocessing complete. Shape: {train_images.shape}, Labels: {len(train_labels)}")

        # --- Costruzione e Addestramento Modello ---
        print(f"[Task ID: {self.request.id}] Building model for {num_classes} classes...")
        model = build_simple_cnn(num_classes)
        model.summary() # Stampa riassunto modello nei log del worker

        epochs = training_params.get('epochs', 10)
        batch_size = training_params.get('batch_size', 32)

        print(f"[Task ID: {self.request.id}] Starting training for {epochs} epochs, batch size {batch_size}...")
        history = model.fit(
            train_images,
            train_labels,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=0.1 # Usa 10% per validazione interna (opzionale)
        )
        print(f"[Task ID: {self.request.id}] Training finished.")

        # --- Salvataggio Modello e Risultati ---
        final_accuracy = history.history['accuracy'][-1]
        final_loss = history.history['loss'][-1]
        val_accuracy = history.history.get('val_accuracy', [None])[-1]
        val_loss = history.history.get('val_loss', [None])[-1]

        # Genera path unici per i file
        model_filename = f"model_{model_id}.keras" # Nuovo formato Keras 3 preferito
        # model_filename = f"model_{model_id}.h5" # Vecchio formato HDF5
        class_names_filename = f"class_names_{model_id}.json"

        model_rel_path = os.path.join(f"user_{model_record.owner_id}/model_{model_id}", model_filename)
        class_names_rel_path = os.path.join(f"user_{model_record.owner_id}/model_{model_id}", class_names_filename)

        model_full_path = os.path.join(settings.MODELS_STORAGE_ROOT, model_rel_path)
        class_names_full_path = os.path.join(settings.MODELS_STORAGE_ROOT, class_names_rel_path)

        # Assicura che la directory esista
        Path(model_full_path).parent.mkdir(parents=True, exist_ok=True)

        print(f"[Task ID: {self.request.id}] Saving model to: {model_full_path}")
        model.save(model_full_path) # Salva modello

        print(f"[Task ID: {self.request.id}] Saving class names to: {class_names_full_path}")
        with open(class_names_full_path, 'w') as f:
            json.dump(class_names, f) # Salva nomi classi

        # --- Aggiorna Record DB ---
        with transaction.atomic():
            # Rileggi il record per sicurezza
            final_record = TrainedModel.objects.get(pk=model_id)
            final_record.status = TrainedModel.Status.COMPLETED
            final_record.accuracy = final_accuracy
            final_record.loss = final_loss
            # Aggiungi validation metrics ai metadati se vuoi
            final_record.training_params['final_val_accuracy'] = val_accuracy
            final_record.training_params['final_val_loss'] = val_loss
            final_record.model_path = model_rel_path # Salva path relativo
            final_record.class_names_path = class_names_rel_path # Salva path relativo
            final_record.training_finished_at = timezone.now()
            final_record.error_message = None # Cancella errori precedenti
            final_record.save()

        end_time = time.time()
        print(f"[Task ID: {self.request.id}] Successfully trained and saved model {model_id}. Time: {end_time - start_time:.2f}s")
        return f"Trained model {model_id} successfully."

    except Exception as exc:
        print(f"[Task ID: {self.request.id}] FATAL Error during training for Model ID {model_id}: {exc}")
        # Logga traceback completo per debug
        import traceback
        traceback.print_exc()
        # Aggiorna stato a FAILED
        try:
            with transaction.atomic():
                 failed_record = TrainedModel.objects.get(pk=model_id)
                 failed_record.status = TrainedModel.Status.FAILED
                 failed_record.error_message = f"Training failed: {exc}"
                 failed_record.training_finished_at = timezone.now()
                 failed_record.save()
        except Exception as update_exc:
             print(f"[Task ID: {self.request.id}] FATAL: Could not update status to FAILED for Model {model_id}: {update_exc}")

        # Rilancia per far ritentare Celery (se configurato e appropriato)
        # Attenzione ai task che manipolano file, i ritentativi potrebbero essere complessi
        # raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        raise exc # Fallisce definitivamente il task