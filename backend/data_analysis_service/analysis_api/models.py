import os
import uuid
import json
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

def analysis_upload_path(instance, filename):
    # Salva risultati/modelli in una cartella specifica per job
    return f"analysis_jobs/user_{instance.owner_id}/job_{instance.id}/{filename}"

class AnalysisJob(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pending')
        PROCESSING = 'PROCESSING', _('Processing') # Task Celery in esecuzione
        COMPLETED = 'COMPLETED', _('Completed')
        FAILED = 'FAILED', _('Failed')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.PositiveBigIntegerField(db_index=True)
    # Info sulla risorsa originale usata (dal Resource Manager)
    resource_id = models.PositiveBigIntegerField(null=True, blank=True, help_text="ID of the resource in ResourceManager") # <-- CAMBIATO (o IntegerField)
    original_filename = models.CharField(max_length=255, blank=True, null=True)

    # Parametri dell'analisi
    task_type = models.CharField(max_length=50, choices=[('regression', 'Regression'), ('classification', 'Classification')], blank=True, null=True)
    selected_algorithm_key = models.CharField(max_length=100, blank=True, null=True)
    input_parameters = models.JSONField(default=dict, help_text="Features, target, algorithm params, etc.")

    # Stato e risultati
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    results = models.JSONField(default=dict, blank=True, null=True, help_text="Metrics and other textual results")
    plot_data = models.JSONField(default=dict, blank=True, null=True, help_text="Data prepared for frontend plotting")
    model_path = models.FileField(upload_to=analysis_upload_path, max_length=512, blank=True, null=True, help_text="Path to the saved trained model (if any)")
    error_message = models.TextField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    job_started_at = models.DateTimeField(null=True, blank=True)
    job_finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Analysis {self.id} for user {self.owner_id} ({self.status})"

    class Meta:
        ordering = ['-created_at']


class SyntheticDatasetJob(models.Model):
    """Modello per tracciare i job di generazione di dataset sintetici."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pending Submission')
        GENERATING_DATA = 'GENERATING_DATA', _('Generating Data with AI')
        SAVING_TO_RESOURCES = 'SAVING_TO_RESOURCES', _('Saving to Resource Manager')
        COMPLETED = 'COMPLETED', _('Completed Successfully')
        FAILED = 'FAILED', _('Failed')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.PositiveBigIntegerField(db_index=True, help_text="User ID from the authentication service")
    
    user_prompt = models.TextField(help_text="The user's description of the desired dataset")
    num_rows_requested = models.IntegerField(default=100, help_text="Number of data rows to generate")
    generated_dataset_name = models.CharField(max_length=255, help_text="Filename for the generated CSV")
    
    # Campi per il flusso e i risultati
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING, db_index=True)
    error_message = models.TextField(blank=True, null=True, help_text="Details if generation or saving failed")
    # ID della risorsa creata nel Resource Manager dopo il salvataggio
    resource_id = models.UUIDField(blank=True, null=True, help_text="ID of the Resource created in ResourceManager")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True) # Traccia l'ultimo aggiornamento di stato

    def __str__(self):
        return f"Synthetic CSV Job {self.id} for user {self.owner_id} ({self.status})"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Synthetic Dataset Job"
        verbose_name_plural = "Synthetic Dataset Jobs"