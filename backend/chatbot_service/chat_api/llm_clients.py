# chat_api/llm_clients.py
import os
from django.conf import settings
from openai import OpenAI, APIError as OpenAIAPIError, RateLimitError as OpenAIRateLimitError, AuthenticationError as OpenAIAuthError
from anthropic import Anthropic, APIError as AnthropicAPIError, RateLimitError as AnthropicRateLimitError, AuthenticationError as AnthropicAuthError
import google.generativeai as genai
import tiktoken

# --- Stato Inizializzazione Client ---
# Questo dizionario può essere importato e controllato prima di tentare di usare un client
API_CLIENT_STATUS = {
    'openai': False,
    'anthropic': False,
    'gemini': False,
    'error_messages': {} # Per memorizzare errori di inizializzazione
}

# --- Client OpenAI ---
openai_client = None
if settings.OPENAI_API_KEY:
    try:
        print("Attempting to initialize OpenAI client...")
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # --- CORREZIONE QUI: Rimuovi l'argomento 'limit' ---
        print("Verifying OpenAI API key by listing models...")
        openai_client.models.list() # Chiamata senza argomenti ora
        # --- FINE CORREZIONE ---

        API_CLIENT_STATUS['openai'] = True
        print("OpenAI client initialized successfully.")
    except OpenAIAuthError as e:
        msg = f"OpenAI API Key is invalid or has insufficient permissions: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['openai'] = msg
    except OpenAIAPIError as e: # Altri errori API OpenAI
        msg = f"OpenAI API Error during client initialization: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['openai'] = msg
    except Exception as e: # Catch-all per altri errori
        msg = f"Unexpected error initializing OpenAI client: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['openai'] = msg
else:
    msg = "OPENAI_API_KEY not found in settings (Docker Secret not loaded or empty)."
    print(f"Warning: {msg}")
    API_CLIENT_STATUS['error_messages']['openai'] = msg


# --- Client Anthropic ---
anthropic_client = None
if settings.ANTHROPIC_API_KEY:
    try:
        anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        # Anthropic SDK non ha un metodo semplice come list() per testare la chiave senza fare una chiamata costosa.
        # Si potrebbe fare una chiamata molto piccola a basso costo se necessario.
        API_CLIENT_STATUS['anthropic'] = True
        print("Anthropic client initialized successfully.")
    except AnthropicAuthError as e:
        msg = f"Anthropic API Key is invalid: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['anthropic'] = msg
    except Exception as e:
        msg = f"Unexpected error initializing Anthropic client: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['anthropic'] = msg
else:
    msg = "ANTHROPIC_API_KEY not found in settings."
    print(f"Warning: {msg}")
    API_CLIENT_STATUS['error_messages']['anthropic'] = msg


# --- Client Google Gemini ---
gemini_default_model = None # Inizializzeremo il modello specifico on-demand
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        # Test opzionale: prova a listare i modelli
        # for m in genai.list_models():
        #     if 'generateContent' in m.supported_generation_methods:
        #         print(m.name)
        #         break
        API_CLIENT_STATUS['gemini'] = True
        print("Google Generative AI (Gemini) configured successfully.")
    except Exception as e:
        msg = f"Error configuring Google Generative AI: {e}"
        print(f"ERROR: {msg}")
        API_CLIENT_STATUS['error_messages']['gemini'] = msg
else:
    msg = "GEMINI_API_KEY not found in settings."
    print(f"Warning: {msg}")
    API_CLIENT_STATUS['error_messages']['gemini'] = msg


# --- Funzione Conteggio Token ---
# Mappa modelli a nomi tiktoken (o logica per determinarli)
TIKTOKEN_MODEL_MAP = {
    "gpt-4o-mini": "gpt-4o-mini", # Assumendo che tiktoken lo supporti o usa un alias
    "gpt-4": "gpt-4",
    "gpt-3.5-turbo": "gpt-3.5-turbo",
    # Aggiungere altri modelli OpenAI se necessario
    # Per Claude e Gemini, il conteggio token è diverso e le loro API
    # di solito lo restituiscono nella risposta. Tiktoken è specifico OpenAI.
}

def count_tokens_for_openai(messages, model_name="gpt-3.5-turbo"):
    """Conta i token per un payload di messaggi OpenAI usando tiktoken."""
    tiktoken_model_name = TIKTOKEN_MODEL_MAP.get(model_name, "gpt-3.5-turbo") # Fallback
    try:
        encoding = tiktoken.encoding_for_model(tiktoken_model_name)
    except KeyError:
        print(f"Warning: No tiktoken encoding found for model {tiktoken_model_name}. Using cl100k_base.")
        encoding = tiktoken.get_encoding("cl100k_base") # Un encoding generico

    num_tokens = 0
    # Basato sulla documentazione OpenAI per il formato ChatCompletion
    # https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
    if model_name in ["gpt-3.5-turbo-0613", "gpt-3.5-turbo-16k-0613", "gpt-4-0314", "gpt-4-32k-0314", "gpt-4-0613", "gpt-4-32k-0613", "gpt-4o-mini"]: # Adatta la lista ai tuoi modelli
        tokens_per_message = 3
        tokens_per_name = 1
    elif model_name == "gpt-3.5-turbo-0301":
        tokens_per_message = 4  # ogni messaggio segue <|start|>{role/name}\n{content}<|end|>\n
        tokens_per_name = -1  # se c'è un nome, il ruolo viene omesso
    else: # Default o altri modelli futuri
        tokens_per_message = 3
        tokens_per_name = 1

    for message in messages:
        num_tokens += tokens_per_message
        for key, value in message.items():
            num_tokens += len(encoding.encode(value))
            if key == "name":
                num_tokens += tokens_per_name
    num_tokens += 3  # ogni risposta inizia con <|start|>assistant<|message|>
    return num_tokens

# TODO: Implementare funzioni di conteggio token specifiche se fornite dagli SDK di Anthropic e Gemini,
# altrimenti usare approssimazioni o basarsi sui token restituiti dalle loro API.
# Per ora, questa funzione è orientata a OpenAI.