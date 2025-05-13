# service_config/secrets_helper.py
import os

def get_docker_secret(secret_name, default=None, secret_dir='/run/secrets'):
    """
    Legge un segreto Docker.
    Il nome del segreto qui è il nome del file creato da Docker.
    """
    try:
        with open(os.path.join(secret_dir, secret_name), 'r') as secret_file:
            return secret_file.read().strip()
    except IOError:
        if default is not None:
            print(f"Warning: Secret '{secret_name}' not found. Using default.")
            return default
        else:
            # Potresti sollevare un'eccezione qui se il segreto è mandatorio
            print(f"Error: Secret '{secret_name}' not found and no default provided.")
            return None