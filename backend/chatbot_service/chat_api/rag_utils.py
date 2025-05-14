# chat_api/rag_utils.py
import os
from io import BytesIO, TextIOWrapper
import pandas as pd
import docx # python-docx
from PyPDF2 import PdfReader # pypdf2
import requests
from django.conf import settings

# Costanti per header interno (devono corrispondere a quelle in settings.py)
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

def _extract_text_from_pdf(file_bytes):
    text = ""
    try:
        reader = PdfReader(BytesIO(file_bytes))
        for page in reader.pages:
            text += page.extract_text() or "" + "\n"
    except Exception as e:
        print(f"RAG Util: Error extracting PDF text: {e}")
    return text

def _extract_text_from_docx(file_bytes):
    text = ""
    try:
        document = docx.Document(BytesIO(file_bytes))
        for para in document.paragraphs:
            text += para.text + "\n"
        # TODO: Estrarre testo da tabelle se necessario
    except Exception as e:
        print(f"RAG Util: Error extracting DOCX text: {e}")
    return text

def _extract_text_from_csv(file_bytes):
    text = ""
    try:
        # Prova con encoding comuni
        encodings_to_try = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
        df = None
        for enc in encodings_to_try:
            try:
                df = pd.read_csv(BytesIO(file_bytes), encoding=enc, low_memory=False)
                break
            except UnicodeDecodeError:
                continue
            except Exception: # Altri errori pandas
                 if enc == encodings_to_try[-1]: raise
                 continue
        if df is not None:
            text = df.to_string(index=False) # Converte tutto il CSV in stringa
    except Exception as e:
        print(f"RAG Util: Error extracting CSV text: {e}")
    return text

def _extract_text_from_txt(file_bytes):
    try:
        # Tenta di decodificare come UTF-8, con fallback a latin-1 o ignorando errori
        return file_bytes.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"RAG Util: Error extracting TXT text: {e}")
    return ""

def get_document_content_from_resource_manager(resource_id: int, resource_mime_type: str = None):
    """
    Recupera il contenuto di un file dal Resource Manager e ne estrae il testo.
    resource_mime_type è opzionale ma aiuta a scegliere il parser corretto.
    """
    print(f"RAG Util: Fetching content for resource_id: {resource_id}")
    if not settings.RESOURCE_MANAGER_INTERNAL_URL:
        print("RAG Util: Error - RESOURCE_MANAGER_INTERNAL_URL not configured.")
        return ""

    resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/{resource_id}/content/"
    headers = {}
    if INTERNAL_API_SECRET:
        headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET

    try:
        response = requests.get(resource_url, headers=headers, timeout=30, stream=True) # stream=True per file grandi
        response.raise_for_status()

        # Determina il tipo di file per scegliere il parser corretto
        # L'ideale sarebbe avere il mime_type corretto dal Resource Manager
        # Per ora, proviamo a indovinarlo o usiamo quello fornito.
        content_type = response.headers.get('Content-Type', resource_mime_type or 'application/octet-stream').lower()
        print(f"RAG Util: Received content-type: {content_type} for resource {resource_id}")

        # Leggi i bytes, non il testo, perché i parser si aspettano bytes o file-like binari
        file_bytes = response.content # Legge tutto il contenuto in memoria

        if 'pdf' in content_type:
            return _extract_text_from_pdf(file_bytes)
        elif 'vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type or \
             (resource_mime_type and resource_mime_type.endswith("docx")): # fallback a mime da DB
            return _extract_text_from_docx(file_bytes)
        elif 'csv' in content_type or \
              (resource_mime_type and resource_mime_type.endswith("csv")):
            return _extract_text_from_csv(file_bytes)
        elif content_type.startswith('text/'):
            return _extract_text_from_txt(file_bytes)
        else:
            print(f"RAG Util: Unsupported content type for text extraction: {content_type}")
            return "" # O prova un'estrazione generica, o solleva errore

    except requests.exceptions.RequestException as e:
        print(f"RAG Util: Error fetching resource {resource_id} from Resource Manager: {e}")
    except Exception as e:
        print(f"RAG Util: Unexpected error processing resource {resource_id}: {e}")
    return ""