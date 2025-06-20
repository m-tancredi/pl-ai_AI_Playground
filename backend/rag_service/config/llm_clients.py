"""
Client per l'interazione con l'API OpenAI
"""
import logging
from typing import List, Dict, Any, Optional
from openai import OpenAI
from django.conf import settings
from .secrets_reader import get_openai_api_key
import numpy as np

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
            system_prompt = """Sei un assistente intelligente e utile. La tua priorità è fornire risposte accurate e utili agli utenti.

REGOLE PER LE RISPOSTE:
1. Se viene fornito un contesto rilevante, utilizzalo come base primaria per la risposta e cita le fonti
2. Per domande generali di conoscenza comune (saluti, definizioni basilari, concetti generali), puoi rispondere usando la tua conoscenza anche senza contesto specifico
3. Per domande specifiche su documenti o argomenti tecnici dettagliati, se il contesto non contiene informazioni sufficienti, indica chiaramente questa limitazione
4. Mantieni sempre un tono professionale, amichevole e utile
5. Rispondi sempre in italiano
6. Se non sei sicuro di una risposta, sii onesto e suggerisci alternative

Ricorda: l'obiettivo è essere utile all'utente, bilanciando accuratezza e disponibilità.

Il contesto dai documenti sarà fornito nel messaggio dell'utente preceduto da "CONTESTO:"."""

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
            system_prompt = """Sei un assistente intelligente e utile. La tua priorità è fornire risposte accurate e utili agli utenti.

REGOLE PER LE RISPOSTE:
1. Se viene fornito un contesto rilevante, utilizzalo come base primaria per la risposta e cita le fonti
2. Per domande generali di conoscenza comune (saluti, definizioni basilari, concetti generali), puoi rispondere usando la tua conoscenza anche senza contesto specifico
3. Per domande specifiche su documenti o argomenti tecnici dettagliati, se il contesto non contiene informazioni sufficienti, indica chiaramente questa limitazione
4. Mantieni sempre un tono professionale, amichevole e utile
5. Rispondi sempre in italiano
6. Se non sei sicuro di una risposta, sii onesto e suggerisci alternative

Ricorda: l'obiettivo è essere utile all'utente, bilanciando accuratezza e disponibilità."""

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

class OpenAIEmbeddingClient:
    """
    Client specifico per gli embeddings OpenAI con i nuovi modelli.
    """
    
    def __init__(self):
        """
        Inizializza il client per embeddings OpenAI.
        """
        try:
            self.api_key = get_openai_api_key()
            self.client = OpenAI(api_key=self.api_key)
            
            # Configurazioni per i nuovi modelli di embedding
            self.embedding_model = getattr(settings, 'OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')
            self.embedding_dimensions = getattr(settings, 'OPENAI_EMBEDDING_DIMENSIONS', None)
            
            # Mapping delle dimensioni predefinite per i modelli
            self.model_dimensions = {
                'text-embedding-3-small': 1536,
                'text-embedding-3-large': 3072,
                'text-embedding-ada-002': 1536,  # Legacy model
            }
            
            logger.info(f"OpenAI Embedding Client inizializzato con modello: {self.embedding_model}")
            
            if self.embedding_dimensions:
                logger.info(f"Dimensioni embeddings personalizzate: {self.embedding_dimensions}")
            else:
                default_dims = self.model_dimensions.get(self.embedding_model, 1536)
                logger.info(f"Dimensioni embeddings predefinite: {default_dims}")
                
        except Exception as e:
            logger.error(f"Errore nell'inizializzazione del client OpenAI Embeddings: {str(e)}")
            raise
    
    def create_embedding(self, text: str) -> List[float]:
        """
        Crea un embedding per un singolo testo.
        
        Args:
            text (str): Il testo da processare
            
        Returns:
            List[float]: L'embedding del testo
        """
        try:
            # Prepara i parametri per la chiamata API
            params = {
                'model': self.embedding_model,
                'input': text,
                'encoding_format': 'float'
            }
            
            # Aggiungi dimensioni personalizzate se supportate
            if (self.embedding_dimensions and 
                self.embedding_model in ['text-embedding-3-small', 'text-embedding-3-large']):
                params['dimensions'] = self.embedding_dimensions
            
            response = self.client.embeddings.create(**params)
            embedding = response.data[0].embedding
            
            logger.debug(f"Embedding creato: dimensioni {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Errore nella creazione dell'embedding: {str(e)}")
            raise Exception(f"Errore nella creazione dell'embedding: {str(e)}")
    
    def create_embeddings_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        """
        Crea embeddings per una lista di testi in batch.
        
        Args:
            texts (List[str]): Lista di testi da processare
            batch_size (int): Numero di testi per batch
            
        Returns:
            List[List[float]]: Lista di embeddings
        """
        try:
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                
                # Prepara i parametri per la chiamata API
                params = {
                    'model': self.embedding_model,
                    'input': batch,
                    'encoding_format': 'float'
                }
                
                # Aggiungi dimensioni personalizzate se supportate
                if (self.embedding_dimensions and 
                    self.embedding_model in ['text-embedding-3-small', 'text-embedding-3-large']):
                    params['dimensions'] = self.embedding_dimensions
                
                response = self.client.embeddings.create(**params)
                batch_embeddings = [data.embedding for data in response.data]
                all_embeddings.extend(batch_embeddings)
                
                logger.debug(f"Batch {i//batch_size + 1}: {len(batch)} embeddings creati")
            
            logger.info(f"Totale embeddings creati: {len(all_embeddings)}")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Errore nella creazione degli embeddings in batch: {str(e)}")
            raise Exception(f"Errore nella creazione degli embeddings in batch: {str(e)}")
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calcola la similarità del coseno tra due vettori.
        
        Args:
            vec1 (List[float]): Primo vettore
            vec2 (List[float]): Secondo vettore
            
        Returns:
            float: Similarità del coseno (-1 a 1)
        """
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Restituisce informazioni sul modello configurato.
        
        Returns:
            Dict[str, Any]: Informazioni sul modello
        """
        default_dims = self.model_dimensions.get(self.embedding_model, 1536)
        actual_dims = self.embedding_dimensions or default_dims
        
        return {
            'model': self.embedding_model,
            'dimensions': actual_dims,
            'default_dimensions': default_dims,
            'supports_custom_dimensions': self.embedding_model in ['text-embedding-3-small', 'text-embedding-3-large'],
            'api_version': '2024-01'
        }


# Istanze globali dei client (singleton pattern)
_openai_client = None
_openai_embedding_client = None

def get_openai_client() -> OpenAIClient:
    """
    Ottieni l'istanza del client OpenAI per chat (singleton)
    
    Returns:
        OpenAIClient: L'istanza del client
    """
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client

def get_openai_embedding_client() -> OpenAIEmbeddingClient:
    """
    Ottieni l'istanza del client OpenAI per embeddings (singleton)
    
    Returns:
        OpenAIEmbeddingClient: L'istanza del client per embeddings
    """
    global _openai_embedding_client
    if _openai_embedding_client is None:
        _openai_embedding_client = OpenAIEmbeddingClient()
    return _openai_embedding_client