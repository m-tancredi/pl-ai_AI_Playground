import os
from django.db import models
from django.conf import settings # Per MEDIA_ROOT

def get_user_image_path(instance, filename):
    """Genera il percorso di upload per le immagini salvate."""
    user_dir = settings.SAVED_IMAGE_DIR_FORMAT.format(user_id=instance.owner_id)
    # Assicura che il filename sia unico se necessario, qui usiamo solo il nome base
    base, ext = os.path.splitext(filename)
    # Potresti aggiungere uuid al nome file: filename = f"{base}_{uuid.uuid4()}{ext}"
    return os.path.join(user_dir, filename)

class GeneratedImage(models.Model):
    """Modello per memorizzare informazioni sulle immagini salvate."""
    owner_id = models.PositiveBigIntegerField(
        db_index=True,
        help_text="User ID from the authentication service"
    )
    name = models.CharField(max_length=255, blank=True, help_text="Optional user-defined name")
    description = models.TextField(blank=True, help_text="Optional user-defined description")
    prompt = models.TextField(blank=True, help_text="Prompt used for generation")
    style = models.CharField(max_length=100, blank=True, null=True, help_text="Style parameter used")
    model_used = models.CharField(max_length=50, blank=True, help_text="Model used (e.g., dalle, stability)")

    image_file = models.ImageField( # Usiamo ImageField per validazione e metadati
        upload_to=get_user_image_path,
        max_length=500, # Permetti path più lunghi
        help_text="Path to the saved image file relative to MEDIA_ROOT"
    )
    width = models.PositiveIntegerField(null=True, blank=True, help_text="Image width")
    height = models.PositiveIntegerField(null=True, blank=True, help_text="Image height")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f"Image {self.id} by User {self.owner_id}"

    # Override save per popolare width/height (richiede Pillow)
    def save(self, *args, **kwargs):
        if self.image_file and not (self.width and self.height):
            try:
                # L'accesso a width/height di ImageField legge l'immagine
                self.width = self.image_file.width
                self.height = self.image_file.height
            except Exception as e:
                 # Non bloccare il salvataggio se non si possono leggere le dimensioni
                 print(f"Warning: Could not read image dimensions for {self.image_file.name}: {e}")
                 self.width = None
                 self.height = None
        super().save(*args, **kwargs)

    # Override delete per rimuovere il file fisico
    def delete(self, *args, **kwargs):
        # Prima elimina il file fisico, poi il record DB
        if self.image_file:
            storage, path = self.image_file.storage, self.image_file.path
            # Verifica esistenza prima di cancellare
            if storage.exists(path):
                 print(f"Deleting image file: {path}")
                 storage.delete(path)
            else:
                 print(f"Warning: Image file not found for deletion: {path}")
        super().delete(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']