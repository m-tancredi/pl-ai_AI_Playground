import os
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

def get_secret(secret_name):
    """
    Legge un segreto Docker dal percorso standard /run/secrets/.
    Lancia ImproperlyConfigured se il file non esiste.
    """
    try:
        # Determina il path del file segreto basato sul nome logico
        # Ad esempio, se secret_name è 'openai_api_key', cerca il file mappato
        # a 'openai_api_key_secret' in docker-compose.yml
        secret_file_var_name = f"{secret_name.upper()}_SECRET_FILE" # Es: OPENAI_API_KEY_SECRET_FILE
        secret_file_path = getattr(settings, secret_file_var_name, None)

        if not secret_file_path:
             # Fallback se il path non è esplicitamente in settings, usa una convenzione
             # basata sul nome logico del segreto in docker-compose
             secret_compose_name = f"{secret_name}_secret" # Es: openai_api_key_secret
             secret_file_path = f'/run/secrets/{secret_compose_name}'
             # Alternativa: Mappare direttamente i nomi in settings
             # if secret_name == 'openai_api_key':
             #     secret_file_path = settings.OPENAI_SECRET_FILE
             # elif secret_name == 'stability_api_key':
             #     secret_file_path = settings.STABILITY_SECRET_FILE
             # else:
             #     raise ValueError(f"Unknown secret name: {secret_name}")

        print(f"Attempting to read secret '{secret_name}' from {secret_file_path}") # Debug print
        with open(secret_file_path, 'r') as f:
            secret_value = f.read().strip()
            if not secret_value:
                 print(f"Warning: Secret file {secret_file_path} for '{secret_name}' is empty.")
            return secret_value
    except FileNotFoundError:
        error_msg = f"Secret file not found at {secret_file_path}. Ensure the secret '{secret_compose_name}' is defined in docker-compose.yml and mapped correctly."
        print(f"Error: {error_msg}")
        raise ImproperlyConfigured(error_msg)
    except Exception as e:
        error_msg = f"Error reading secret '{secret_name}' from {secret_file_path}: {e}"
        print(f"Error: {error_msg}")
        raise ImproperlyConfigured(error_msg)