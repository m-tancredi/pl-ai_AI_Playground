import os
from pathlib import Path

def get_docker_secret(secret_name, default=None):
    """
    Legge un Docker Secret dal filesystem.
    Docker monta i secrets in /run/secrets/
    """
    secret_path = Path(f'/run/secrets/{secret_name}')
    
    if secret_path.exists():
        try:
            with open(secret_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Errore nella lettura del secret {secret_name}: {e}")
            return default
    else:
        print(f"Docker secret {secret_name} non trovato")
        return default 