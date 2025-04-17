import os
import pandas as pd # <-- Importa Pandas qui
from pathlib import Path
from django.db import migrations
from django.conf import settings
from django.core.files import File

INITIAL_DATA_DIR = Path(settings.BASE_DIR) / 'initial_data'

def populate_example_datasets(apps, schema_editor):
    """Crea i record per i Dataset di esempio leggendo i file CSV."""
    Dataset = apps.get_model('datasets_api', 'Dataset')
    print(f"\nLooking for example datasets in: {INITIAL_DATA_DIR}")

    if not INITIAL_DATA_DIR.exists():
        print(f"Warning: Directory {INITIAL_DATA_DIR} not found. Skipping population.")
        return

    for i in range(1, 6):
        file_name = f'Esempio{i}.csv'
        file_path = INITIAL_DATA_DIR / file_name
        dataset_name = f'Example Dataset {i}'

        if file_path.exists() and file_path.is_file():
            print(f"  Found {file_name}. Creating dataset '{dataset_name}'...")
            try:
                with open(file_path, 'rb') as f:
                    django_file = File(f, name=file_name)
                    dataset_instance = Dataset.objects.create(
                        name=dataset_name,
                        description=f'An example dataset ({file_name}) preloaded.',
                        csv_file=django_file,
                        is_example=True,
                        owner_id=None # Usiamo owner_id qui perché 'owner' potrebbe non essere definito nel modello storico
                                      # o potrebbe aspettarsi un ID invece di None. owner_id è più sicuro.
                    )
                    print(f"    Dataset '{dataset_name}' created with ID {dataset_instance.id}. Extracting headers...")

                    # --- Logica di estrazione header replicata qui ---
                    headers = None
                    saved_file_path = None
                    try:
                        # Accedi al percorso del file salvato da Django
                        saved_file_path = os.path.join(settings.MEDIA_ROOT, dataset_instance.csv_file.name)
                        if os.path.exists(saved_file_path):
                             # Leggi solo la prima riga per gli header
                             df_headers = pd.read_csv(saved_file_path, nrows=0, encoding='utf-8') # Aggiungi encoding
                             headers = list(df_headers.columns)
                             print(f"      Headers found: {headers}")
                        else:
                             print(f"      Warning: Saved file not found at {saved_file_path} during header extraction.")

                    except Exception as header_exc:
                         print(f"      Error extracting headers for {file_name} from {saved_file_path}: {header_exc}")
                         # Lascia headers a None o imposta un valore di errore se preferisci

                    # Aggiorna l'istanza con gli header estratti
                    dataset_instance.headers = headers
                    dataset_instance.save(update_fields=['headers'])
                    print(f"    Dataset '{dataset_name}' updated with headers.")
                    # --- Fine logica estrazione header ---

            except Exception as e:
                 print(f"    Error creating dataset instance for {file_name}: {e}")
        else:
            print(f"  Warning: File {file_path} not found.")

class Migration(migrations.Migration):

    dependencies = [
        ('datasets_api', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(populate_example_datasets),
    ]