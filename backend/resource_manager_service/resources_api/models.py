import os
import uuid
from django.db import models
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils.translation import gettext_lazy as _

def user_resource_path(instance, filename):
    """Genera un percorso univoco per la risorsa basato sull'utente e UUID."""
    user_dir = f"resources/user_{instance.owner_id}"
    # Crea un nome file univoco per evitare collisioni
    ext = os.path.splitext(filename)[1].lower()
    new_filename = f"{uuid.uuid4()}{ext}"
    return os.path.join(user_dir, new_filename)

def user_thumbnail_path(instance, filename):
    """Genera un percorso univoco per la thumbnail."""
    user_dir = f"resources/user_{instance.owner_id}/thumbnails"
    # Usa lo stesso UUID del file originale se possibile, o uno nuovo
    base_uuid = os.path.splitext(os.path.basename(instance.file.name))[0]
    ext = os.path.splitext(filename)[1].lower()
    new_filename = f"{base_uuid}_thumb{ext}"
    return os.path.join(user_dir, new_filename)

class Tag(models.Model):
    """Modello per rappresentare i tag delle risorse."""
    
    name = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Nome del tag (es. 'RAG', 'Dataset', 'Image')"
    )
    color = models.CharField(
        max_length=7,
        default='#007bff',
        help_text="Colore esadecimale per la visualizzazione del tag"
    )
    description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Descrizione del tag"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']

class Resource(models.Model):
    """Modello per rappresentare una risorsa utente (file)."""

    class Status(models.TextChoices):
        PROCESSING = 'PROCESSING', _('Processing')
        COMPLETED = 'COMPLETED', _('Completed')
        FAILED = 'FAILED', _('Failed')

    owner_id = models.PositiveBigIntegerField(
        db_index=True,
        help_text="User ID from the authentication service"
    )
    # File principale - usa il percorso dinamico
    file = models.FileField(
        upload_to=user_resource_path,
        max_length=512, # Permetti path più lunghi (S3 etc)
        help_text="The main resource file stored"
    )
    original_filename = models.CharField(
        max_length=255,
        help_text="Original filename as uploaded by the user"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
        db_index=True,
        help_text="Processing status of the resource"
    )
    mime_type = models.CharField(max_length=100, blank=True, null=True, help_text="Detected MIME type")
    size = models.PositiveBigIntegerField(null=True, blank=True, help_text="File size in bytes")

    # Metadati generici e specifici
    name = models.CharField(max_length=255, blank=True, help_text="User-defined name for the resource")
    description = models.TextField(blank=True, help_text="User-defined description")
    metadata = models.JSONField(blank=True, null=True, help_text="Extracted metadata (e.g., image dimensions, CSV headers)")
    thumbnail = models.ImageField(
        upload_to=user_thumbnail_path,
        max_length=512,
        blank=True, null=True,
        help_text="Path to the generated thumbnail (if applicable)"
    )
    error_message = models.TextField(blank=True, null=True, help_text="Details if processing failed")
    
    # Sistema di tagging
    tags = models.ManyToManyField(
        Tag,
        blank=True,
        related_name='resources',
        help_text="Tag associati a questa risorsa"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name or self.original_filename or f"Resource {self.id}"

    # Override delete per cancellare file associati
    def delete(self, *args, **kwargs):
        print(f"Deleting Resource {self.id}...")
        # Cancella thumbnail se esiste
        if self.thumbnail:
            if default_storage.exists(self.thumbnail.name):
                print(f"  Deleting thumbnail file: {self.thumbnail.name}")
                self.thumbnail.delete(save=False) # save=False evita di salvare il modello ora
            else:
                 print(f"  Warning: Thumbnail file not found: {self.thumbnail.name}")
        # Cancella file principale
        if self.file:
            if default_storage.exists(self.file.name):
                print(f"  Deleting main file: {self.file.name}")
                self.file.delete(save=False)
            else:
                print(f"  Warning: Main file not found: {self.file.name}")

        # Chiama il metodo delete originale per cancellare il record DB
        super().delete(*args, **kwargs)
        print(f"Resource {self.id} deleted from DB.")


    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner_id', 'status']),
        ]