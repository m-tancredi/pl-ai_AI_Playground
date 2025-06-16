"""
Client per l'interazione con l'API OpenAI
"""
import logging
from typing import List, Dict, Any, Optional
from openai import OpenAI
from django.conf import settings
from .secrets_reader import get_openai_api_key

logger = logging.getLogger(__name__)

class OpenAIClient:
    """
    Client per interagire con l'API OpenAI ChatCompletion
    """
    
    def __init__(self):
        """
        Inizializza il client OpenAI con la API Key dai Docker Secrets
        """
        try:
            self.api_key = get_openai_api_key()
            self.client = OpenAI(api_key=self.api_key)
            self.model_name = getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
            logger.info(f"OpenAI Client inizializzato con modello: {self.model_name}")
        except Exception as e:
            logger.error(f"Errore nell'inizializzazione del client OpenAI: {str(e)}")
            raise
    
    def generate_rag_response(self, context: str, question: str, max_tokens: int = 1000) -> str:
        """
        Genera una risposta usando il contesto RAG e la domanda dell'utente
        
        Args:
            context (str): Il contesto estratto dai documenti
            question (str): La domanda dell'utente
            max_tokens (int): Numero massimo di token per la risposta
            
        Returns:
            str: La risposta generata da OpenAI
            
        Raises:
            Exception: In caso di errore nella chiamata API
        """
        try:
            system_prompt = """Sei un assistente intelligente specializzato nel rispondere alle domande basandoti ESCLUSIVAMENTE sul contesto fornito.

REGOLE IMPORTANTI:
1. Rispondi SOLO utilizzando le informazioni contenute nel contesto fornito
2. Se la risposta non è presente nel contesto, dì chiaramente "Non posso rispondere a questa domanda basandomi sul contesto fornito"
3. Non inventare o aggiungere informazioni che non sono nel contesto
4. Cita le parti rilevanti del contesto quando possibile
5. Mantieni un tono professionale e preciso
6. Rispondi in italiano

Il contesto sarà fornito nel messaggio dell'utente preceduto da "CONTESTO:"."""

            user_message = f"""CONTESTO:
{context}

DOMANDA:
{question}"""

            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user", 
                    "content": user_message
                }
            ]
            
            logger.info(f"Chiamata OpenAI API con modello: {self.model_name}")
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9
            )
            
            answer = response.choices[0].message.content.strip()
            
            logger.info("Risposta generata con successo da OpenAI")
            return answer
            
        except Exception as e:
            logger.error(f"Errore nella generazione della risposta OpenAI: {str(e)}")
            raise Exception(f"Errore nella generazione della risposta: {str(e)}")
    
    def generate_rag_response_stream(self, context: str, question: str, max_tokens: int = 1000):
        """
        Genera una risposta in streaming usando il contesto RAG
        
        Args:
            context (str): Il contesto estratto dai documenti
            question (str): La domanda dell'utente
            max_tokens (int): Numero massimo di token per la risposta
            
        Yields:
            str: Chunk della risposta generata
            
        Raises:
            Exception: In caso di errore nella chiamata API
        """
        try:
            system_prompt = """Sei un assistente intelligente specializzato nel rispondere alle domande basandoti ESCLUSIVAMENTE sul contesto fornito.

REGOLE IMPORTANTI:
1. Rispondi SOLO utilizzando le informazioni contenute nel contesto fornito
2. Se la risposta non è presente nel contesto, dì chiaramente "Non posso rispondere a questa domanda basandomi sul contesto fornito"
3. Non inventare o aggiungere informazioni che non sono nel contesto
4. Cita le parti rilevanti del contesto quando possibile
5. Mantieni un tono professionale e preciso
6. Rispondi in italiano"""

            user_message = f"""CONTESTO:
{context}

DOMANDA:
{question}"""

            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ]
            
            logger.info(f"Chiamata OpenAI API in streaming con modello: {self.model_name}")
            
            stream = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Errore nella generazione della risposta OpenAI in streaming: {str(e)}")
            raise Exception(f"Errore nella generazione della risposta: {str(e)}")

# Istanza globale del client (singleton pattern)
_openai_client = None

def get_openai_client() -> OpenAIClient:
    """
    Ottieni l'istanza del client OpenAI (singleton)
    
    Returns:
        OpenAIClient: L'istanza del client
    """
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client 