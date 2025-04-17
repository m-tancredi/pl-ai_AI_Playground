import os
import pandas as pd
from django.db import models
from django.core.exceptions import ValidationError

def validate_is_csv(value):
    """Valida che l'estensione del file sia .csv"""
    ext = os.path.splitext(value.name)[1]  # [0] returns path+filename
    valid_extensions = ['.csv']
    if not ext.lower() in valid_extensions:
        raise ValidationError('Unsupported file extension. Only .csv files are allowed.')

class Dataset(models.Model):
    """Modello per rappresentare un dataset CSV caricato o di esempio."""
    # Cambiato da ForeignKey a PositiveBigIntegerField
    owner_id = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        db_index=True, # Importante per le query
        help_text="User ID from the authentication service (no DB constraint)"
    )
    name = models.CharField(max_length=255, help_text="Display name for the dataset")
    description = models.TextField(blank=True, null=True, help_text="Optional description")
    csv_file = models.FileField(
        upload_to='datasets/%Y/%m/%d/',
        validators=[validate_is_csv],
        help_text="The uploaded CSV file"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    headers = models.JSONField(
        null=True,
        blank=True,
        help_text="List of header names extracted from the CSV file"
    )
    is_example = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Is this an example dataset available to all users?"
    )

    def __str__(self):
        return self.name or f"Dataset {self.id}"

    def extract_headers(self):
        """Legge il file CSV e salva gli header nel campo JSONField."""
        if not self.csv_file:
            return None
        try:
            # Leggi solo la prima riga per ottenere gli header
            df = pd.read_csv(self.csv_file.path, nrows=0)
            self.headers = list(df.columns)
            self.save(update_fields=['headers']) # Salva solo questo campo
            return self.headers
        except Exception as e:
            print(f"Error extracting headers for {self.csv_file.name}: {e}")
            # Potresti voler loggare l'errore o impostare headers a un valore speciale
            self.headers = None
            self.save(update_fields=['headers'])
            return None

    def get_dataframe(self):
        """Restituisce un DataFrame Pandas dal file CSV."""
        if not self.csv_file:
            return None
        try:
            return pd.read_csv(self.csv_file.path)
        except FileNotFoundError:
            print(f"File not found for dataset {self.id}: {self.csv_file.name}")
            return None
        except Exception as e:
            print(f"Error reading CSV for dataset {self.id}: {e}")
            return None

    class Meta:
        ordering = ['-uploaded_at']