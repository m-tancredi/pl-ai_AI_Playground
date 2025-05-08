import os
import uuid
import json
from pathlib import Path
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone # Per timestamp training

def get_model_upload_path(instance, filename):
    """Genera path per file modello (.h5 o .keras)"""
    # Salva in una sottocartella per ID modello per organizzazione
    model_dir = f"user_{instance.owner_id}/model_{instance.id}"
    # Non cambiare filename qui, usa quello generato nel task
    return os.path.join(model_dir, filename)

def get_classfile_upload_path(instance, filename):
    """Genera path per file nomi classi (.json)"""
    model_dir = f"user_{instance.owner_id}/model_{instance.id}"
    # Usa un nome standard
    return os.path.join(model_dir, "class_names.json")

class TrainedModel(models.Model):
    """Modello per memorizzare i classificatori di immagini addestrati."""
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pending') # Appena creato, task non ancora partito
        TRAINING = 'TRAINING', _('Training')
        COMPLETED = 'COMPLETED', _('Completed')
        FAILED = 'FAILED', _('Failed')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.PositiveBigIntegerField(db_index=True)
    name = models.CharField(max_length=255, blank=True, default="Untitled Model")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    # Percorsi relativi a MODELS_STORAGE_ROOT (non FileFields diretti per semplicità)
    # Salviamo solo i path relativi; il caricamento userà os.path.join(settings.MODELS_STORAGE_ROOT, path)
    model_path = models.CharField(max_length=512, blank=True, null=True, help_text="Relative path to the saved Keras model file (.h5 or .keras)")
    class_names_path = models.CharField(max_length=512, blank=True, null=True, help_text="Relative path to the class names JSON file")

    # Metadati del training
    class_names = models.JSONField(default=list, help_text="List of class names used during training")
    accuracy = models.FloatField(null=True, blank=True, help_text="Training accuracy")
    loss = models.FloatField(null=True, blank=True, help_text="Training loss")
    training_params = models.JSONField(default=dict, help_text="Parameters used for training (e.g., epochs, batch_size)")
    error_message = models.TextField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    training_started_at = models.DateTimeField(null=True, blank=True)
    training_finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name or f"Model {self.id} by User {self.owner_id}"

    def get_full_model_path(self):
        if not self.model_path: return None
        return os.path.join(settings.MODELS_STORAGE_ROOT, self.model_path)

    def get_full_class_names_path(self):
        if not self.class_names_path: return None
        return os.path.join(settings.MODELS_STORAGE_ROOT, self.class_names_path)

    def load_class_names(self):
        """Carica i nomi delle classi dal file JSON."""
        full_path = self.get_full_class_names_path()
        if full_path and os.path.exists(full_path):
            try:
                with open(full_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading class names from {full_path}: {e}")
        # Fallback ai nomi salvati nel JSONField se il file non esiste
        return self.class_names or []


    # Override delete per cancellare file modello
    def delete(self, *args, **kwargs):
        print(f"Deleting TrainedModel {self.id}...")
        # Cancella file modello
        model_path = self.get_full_model_path()
        if model_path and os.path.exists(model_path):
             try:
                 print(f"  Deleting model file: {model_path}")
                 os.remove(model_path)
             except OSError as e: print(f"  Error deleting model file {model_path}: {e}")
        # Cancella file class names
        class_names_path = self.get_full_class_names_path()
        if class_names_path and os.path.exists(class_names_path):
             try:
                 print(f"  Deleting class names file: {class_names_path}")
                 os.remove(class_names_path)
             except OSError as e: print(f"  Error deleting class names file {class_names_path}: {e}")
        # Cancella la directory se vuota? Opzionale e più complesso
        # try:
        #     model_dir = os.path.dirname(model_path)
        #     if not os.listdir(model_dir): os.rmdir(model_dir)
        # except: pass

        super().delete(*args, **kwargs)
        print(f"TrainedModel {self.id} deleted from DB.")


    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner_id', 'status']),
        ]