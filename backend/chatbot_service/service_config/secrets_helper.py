# service_config/secrets_helper.py
import os

def get_docker_secret(secret_file_name, default=None, secret_dir='/run/secrets'):
    """
    Legge un segreto Docker.
    Il nome del segreto qui è il nome del file creato da Docker (es. openai_api_key_secret).
    """
    try:
        with open(os.path.join(secret_dir, secret_file_name), 'r') as secret_file:
            return secret_file.read().strip()
    except IOError:
        if default is not None:
            print(f"Warning: Secret '{secret_file_name}' not found at {os.path.join(secret_dir, secret_file_name)}. Using default.")
            return default
        else:
            print(f"Error: Secret '{secret_file_name}' not found at {os.path.join(secret_dir, secret_file_name)} and no default provided.")
            # In produzione, potresti voler sollevare un'eccezione:
            # from django.core.exceptions import ImproperlyConfigured
            # raise ImproperlyConfigured(f"Secret '{secret_file_name}' not found.")
            return None # Per sviluppo, restituisci None se non trovato