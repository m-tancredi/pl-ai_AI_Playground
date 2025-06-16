"""
Helper per leggere Docker Secrets in modo sicuro
"""
import os
import logging

logger = logging.getLogger(__name__)

def read_docker_secret(secret_name, default_value=None):
    """
    Legge un Docker Secret dal filesystem.
    
    Args:
        secret_name (str): Nome del secret (corrispondente al file in /run/secrets/)
        default_value (str, optional): Valore di default se il secret non esiste
        
    Returns:
        str: Il contenuto del secret o il valore di default
        
    Raises:
        ValueError: Se il secret non esiste e non c'è un valore di default
    """
    secret_path = f"/run/secrets/{secret_name}"
    
    try:
        if os.path.exists(secret_path):
            with open(secret_path, 'r', encoding='utf-8') as secret_file:
                secret_value = secret_file.read().strip()
                if secret_value:
                    logger.info(f"Docker Secret '{secret_name}' caricato con successo")
                    return secret_value
                else:
                    logger.warning(f"Docker Secret '{secret_name}' è vuoto")
        else:
            logger.warning(f"Docker Secret file non trovato: {secret_path}")
    except Exception as e:
        logger.error(f"Errore nella lettura del Docker Secret '{secret_name}': {str(e)}")
    
    # Fallback al valore di default
    if default_value is not None:
        logger.info(f"Usando valore di default per '{secret_name}'")
        return default_value
    
    # Se non c'è un default, solleva un'eccezione
    raise ValueError(f"Docker Secret '{secret_name}' non trovato e nessun valore di default fornito")

def get_secret(secret_name, default_value=None):
    """
    Funzione wrapper per read_docker_secret per compatibilità con il codice esistente.
    
    Args:
        secret_name (str): Nome del secret
        default_value (str, optional): Valore di default se il secret non esiste
        
    Returns:
        str: Il contenuto del secret o il valore di default
    """
    return read_docker_secret(secret_name, default_value)

def get_openai_api_key():
    """
    Ottieni la API Key di OpenAI dai Docker Secrets.
    
    Returns:
        str: La API Key di OpenAI
        
    Raises:
        ValueError: Se la API Key non è disponibile
    """
    return read_docker_secret("openai_api_key_secret") 