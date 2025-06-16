"""
Task Celery per il processamento asincrono dei documenti RAG.
"""
import os
import logging
import time
from typing import List, Dict, Any
from celery import shared_task
from django.utils import timezone
from django.conf import settings

from .models import RAGDocument, RAGChunk, RAGProcessingLog
from .utils.text_extraction import TextExtractor, extract_text
from .utils.embedding_utils import get_embedding_manager
from config.llm_clients import get_openai_client

logger = logging.getLogger(__name__)

@shared_task(bind=True)
def process_rag_document_task(self, document_id: int):
    """
    Task principale per processare un documento RAG.
    
    Questo task coordina:
    1. Estrazione del testo
    2. Chunking del testo
    3. Creazione degli embeddings
    4. Salvataggio dei chunk nel database
    
    Args:
        document_id (int): ID del documento da processare
        
    Returns:
        dict: Risultato del processamento
    """
    start_time = time.time()
    document = None
    
    try:
        # Recupera il documento
        document = RAGDocument.objects.get(id=document_id)
        
        logger.info(f"Inizio processamento documento {document_id}: {document.original_filename}")
        
        # Aggiorna lo stato a 'processing'
        document.status = 'processing'
        document.processing_started_at = timezone.now()
        document.processing_error = ''
        document.save(update_fields=['status', 'processing_started_at', 'processing_error'])
        
        # Log iniziale
        _create_processing_log(document, 'info', 'Inizio processamento', 'initialization')
        
        # Step 1: Estrazione del testo
        extracted_text = _extract_text_from_document(document)
        
        # Step 2: Chunking del testo
        chunks = _chunk_document_text(document, extracted_text)
        
        # Step 3: Creazione degli embeddings
        _create_and_save_embeddings(document, chunks)
        
        # Step 4: Salvataggio dei chunk nel database
        _save_chunks_to_database(document, chunks)
        
        # Aggiorna le statistiche del documento
        document.extracted_text = extracted_text
        document.text_length = len(extracted_text)
        document.num_chunks = len(chunks)
        document.embeddings_created = True
        document.status = 'processed'
        document.processing_completed_at = timezone.now()
        document.save(update_fields=[
            'extracted_text', 'text_length', 'num_chunks', 
            'embeddings_created', 'status', 'processing_completed_at'
        ])
        
        processing_time = time.time() - start_time
        
        # Log finale
        _create_processing_log(
            document, 
            'info', 
            f'Processamento completato con successo in {processing_time:.2f}s', 
            'completion',
            extra_data={
                'processing_time': processing_time,
                'text_length': len(extracted_text),
                'num_chunks': len(chunks)
            }
        )
        
        logger.info(f"Documento {document_id} processato con successo in {processing_time:.2f}s")
        
        return {
            'success': True,
            'document_id': document_id,
            'processing_time': processing_time,
            'text_length': len(extracted_text),
            'num_chunks': len(chunks)
        }
        
    except RAGDocument.DoesNotExist:
        error_msg = f"Documento {document_id} non trovato"
        logger.error(error_msg)
        return {'success': False, 'error': error_msg}
        
    except Exception as e:
        error_msg = f"Errore nel processamento del documento {document_id}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        # Aggiorna lo stato del documento a 'failed'
        if document:
            try:
                document.status = 'failed'
                document.processing_error = str(e)
                document.processing_completed_at = timezone.now()
                document.save(update_fields=['status', 'processing_error', 'processing_completed_at'])
                
                _create_processing_log(document, 'error', str(e), 'error')
                
            except Exception as save_error:
                logger.error(f"Errore nel salvataggio dello stato di errore: {str(save_error)}")
        
        return {'success': False, 'error': str(e)}

def _extract_text_from_document(document: RAGDocument) -> str:
    """
    Estrae il testo dal file del documento.
    
    Args:
        document (RAGDocument): Documento da processare
        
    Returns:
        str: Testo estratto
        
    Raises:
        Exception: Se l'estrazione fallisce
    """
    try:
        _create_processing_log(document, 'info', 'Inizio estrazione testo', 'text_extraction')
        
        # Verifica che il file esista
        if not os.path.exists(document.file_path):
            raise FileNotFoundError(f"File non trovato: {document.file_path}")
        
        # Inizializza l'estrattore di testo
        extractor = TextExtractor()
        
        # Verifica se il formato è supportato
        if not extractor.is_supported_format(document.file_path):
            raise Exception(f"Formato file non supportato: {document.file_type}")
        
        # Estrai il testo
        extracted_text = extractor.extract_text(document.file_path)
        
        if not extracted_text.strip():
            raise Exception("Nessun testo estratto dal documento")
        
        _create_processing_log(
            document, 
            'info', 
            f'Testo estratto con successo: {len(extracted_text)} caratteri', 
            'text_extraction',
            extra_data={'text_length': len(extracted_text)}
        )
        
        return extracted_text
        
    except Exception as e:
        error_msg = f"Errore nell'estrazione del testo: {str(e)}"
        _create_processing_log(document, 'error', error_msg, 'text_extraction')
        raise Exception(error_msg)

def _chunk_document_text(document: RAGDocument, text: str) -> List[str]:
    """
    Divide il testo in chunk.
    
    Args:
        document (RAGDocument): Documento
        text (str): Testo da dividere
        
    Returns:
        List[str]: Lista di chunk
    """
    try:
        _create_processing_log(document, 'info', 'Inizio chunking del testo', 'chunking')
        
        # Usa le configurazioni dalle impostazioni o valori di default
        chunk_size = getattr(settings, 'RAG_MAX_CHUNK_SIZE', 1000)
        chunk_overlap = getattr(settings, 'RAG_CHUNK_OVERLAP', 200)
        
        # Inizializza l'estrattore e crea i chunk
        extractor = TextExtractor()
        chunks = extractor.chunk_text(text, chunk_size, chunk_overlap)
        
        if not chunks:
            raise Exception("Nessun chunk creato dal testo")
        
        _create_processing_log(
            document,
            'info',
            f'Chunking completato: {len(chunks)} chunk creati',
            'chunking',
            extra_data={
                'num_chunks': len(chunks),
                'chunk_size': chunk_size,
                'chunk_overlap': chunk_overlap
            }
        )
        
        return chunks
        
    except Exception as e:
        error_msg = f"Errore nel chunking del testo: {str(e)}"
        _create_processing_log(document, 'error', error_msg, 'chunking')
        raise Exception(error_msg)

def _create_and_save_embeddings(document: RAGDocument, chunks: List[str]):
    """
    Crea e salva gli embeddings per i chunk.
    
    Args:
        document (RAGDocument): Documento
        chunks (List[str]): Lista di chunk di testo
    """
    try:
        _create_processing_log(document, 'info', 'Inizio creazione embeddings', 'embedding_creation')
        
        # Ottieni il manager degli embeddings
        embedding_manager = get_embedding_manager()
        
        # Crea gli embeddings
        embeddings = embedding_manager.create_embeddings(chunks)
        
        if embeddings.size == 0:
            raise Exception("Nessun embedding creato")
        
        # Prepara i metadati
        metadata = {
            'document_id': document.id,
            'filename': document.original_filename,
            'file_type': document.file_type,
            'model_name': embedding_manager.model_name,
            'created_at': timezone.now().isoformat()
        }
        
        # Salva gli embeddings su disco
        embedding_manager.save_embeddings(document.id, embeddings, chunks, metadata)
        
        _create_processing_log(
            document,
            'info',
            f'Embeddings creati e salvati: {embeddings.shape}',
            'embedding_creation',
            extra_data={
                'embedding_shape': embeddings.shape,
                'model_name': embedding_manager.model_name
            }
        )
        
    except Exception as e:
        error_msg = f"Errore nella creazione degli embeddings: {str(e)}"
        _create_processing_log(document, 'error', error_msg, 'embedding_creation')
        raise Exception(error_msg)

def _save_chunks_to_database(document: RAGDocument, chunks: List[str]):
    """
    Salva i chunk nel database.
    
    Args:
        document (RAGDocument): Documento
        chunks (List[str]): Lista di chunk di testo
    """
    try:
        _create_processing_log(document, 'info', 'Salvataggio chunk nel database', 'database_save')
        
        # Elimina eventuali chunk esistenti
        RAGChunk.objects.filter(document=document).delete()
        
        # Crea i nuovi chunk
        chunk_objects = []
        current_position = 0
        
        for i, chunk_text in enumerate(chunks):
            chunk_obj = RAGChunk(
                document=document,
                text=chunk_text,
                chunk_index=i,
                start_position=current_position,
                end_position=current_position + len(chunk_text),
                text_length=len(chunk_text),
                embedding_created=True,
                embedding_dimension=384  # Dimensione tipica per all-MiniLM-L6-v2
            )
            chunk_objects.append(chunk_obj)
            current_position += len(chunk_text)
        
        # Salvataggio in batch
        RAGChunk.objects.bulk_create(chunk_objects)
        
        _create_processing_log(
            document,
            'info',
            f'{len(chunk_objects)} chunk salvati nel database',
            'database_save',
            extra_data={'num_chunks_saved': len(chunk_objects)}
        )
        
    except Exception as e:
        error_msg = f"Errore nel salvataggio dei chunk: {str(e)}"
        _create_processing_log(document, 'error', error_msg, 'database_save')
        raise Exception(error_msg)

def _create_processing_log(document: RAGDocument, level: str, message: str, 
                          step: str = '', extra_data: Dict[str, Any] = None):
    """
    Crea un log di processamento.
    
    Args:
        document (RAGDocument): Documento
        level (str): Livello del log ('debug', 'info', 'warning', 'error')
        message (str): Messaggio del log
        step (str): Step del processamento
        extra_data (Dict): Dati aggiuntivi
    """
    try:
        RAGProcessingLog.objects.create(
            document=document,
            level=level,
            message=message,
            step=step,
            extra_data=extra_data or {}
        )
    except Exception as e:
        logger.error(f"Errore nella creazione del log: {str(e)}")

@shared_task
def cleanup_failed_documents():
    """
    Task di pulizia per rimuovere documenti falliti più vecchi di un certo tempo.
    """
    try:
        from datetime import timedelta
        
        # Rimuovi documenti falliti più vecchi di 7 giorni
        cutoff_date = timezone.now() - timedelta(days=7)
        
        failed_documents = RAGDocument.objects.filter(
            status='failed',
            processing_completed_at__lt=cutoff_date
        )
        
        count = failed_documents.count()
        
        if count > 0:
            # Elimina i documenti (che elimineranno anche file ed embeddings)
            for doc in failed_documents:
                doc.delete()
            
            logger.info(f"Eliminati {count} documenti falliti durante la pulizia")
        
        return {'cleaned_documents': count}
        
    except Exception as e:
        logger.error(f"Errore nella pulizia dei documenti falliti: {str(e)}")
        return {'error': str(e)}

@shared_task
def reprocess_document_task(document_id: int, force: bool = False):
    """
    Task per riprocessare un documento esistente.
    
    Args:
        document_id (int): ID del documento da riprocessare
        force (bool): Se True, riprocessa anche se già processato
        
    Returns:
        dict: Risultato del riprocessamento
    """
    try:
        document = RAGDocument.objects.get(id=document_id)
        
        # Controlla se il documento è già processato
        if document.status == 'processed' and not force:
            return {
                'success': False,
                'error': 'Documento già processato. Usa force=True per riprocessare.'
            }
        
        # Elimina embeddings esistenti se presenti
        try:
            embedding_manager = get_embedding_manager()
            embedding_manager.delete_embeddings(document_id)
        except Exception as e:
            logger.warning(f"Errore nell'eliminazione degli embeddings esistenti: {str(e)}")
        
        # Elimina chunk esistenti
        RAGChunk.objects.filter(document=document).delete()
        
        # Reset dello stato del documento
        document.status = 'uploaded'
        document.processing_started_at = None
        document.processing_completed_at = None
        document.processing_error = ''
        document.extracted_text = ''
        document.text_length = 0
        document.num_chunks = 0
        document.embeddings_created = False
        document.save()
        
        # Avvia il processamento
        return process_rag_document_task(document_id)
        
    except RAGDocument.DoesNotExist:
        return {'success': False, 'error': f'Documento {document_id} non trovato'}
    except Exception as e:
        logger.error(f"Errore nel riprocessamento del documento {document_id}: {str(e)}")
        return {'success': False, 'error': str(e)}

@shared_task
def process_document(document_id):
    """
    Task per elaborare un documento:
    1. Estrae il testo
    2. Divide in chunk
    3. Genera gli embedding
    4. Salva i chunk nel database
    """
    try:
        document = RAGDocument.objects.get(id=document_id)
        document.status = 'processing'
        document.save()

        # Estrai il testo dal documento
        text = extract_text(document.file_path)
        if not text:
            raise Exception("Impossibile estrarre il testo dal documento")

        # Dividi il testo in chunk
        chunks = split_text_into_chunks(text)
        
        # Genera gli embedding per ogni chunk
        embedding_manager = get_embedding_manager()
        for chunk in chunks:
            embedding = embedding_manager.get_embedding(chunk)
            
            # Crea il chunk nel database
            DocumentChunk.objects.create(
                document=document,
                content=chunk,
                embedding=embedding
            )

        document.status = 'completed'
        document.save()
        
        return True

    except Exception as e:
        logger.error(f"Errore nell'elaborazione del documento {document_id}: {str(e)}")
        document.status = 'failed'
        document.error_message = str(e)
        document.save()
        raise

@shared_task
def process_query(query_id):
    """
    Task per elaborare una query:
    1. Genera l'embedding della query
    2. Trova i chunk più rilevanti
    3. Genera la risposta usando il LLM
    """
    try:
        query = Query.objects.get(id=query_id)
        query.status = 'processing'
        query.save()

        # Genera l'embedding della query
        embedding_manager = get_embedding_manager()
        query_embedding = embedding_manager.get_embedding(query.text)

        # Trova i chunk più rilevanti
        relevant_chunks = find_relevant_chunks(query_embedding)
        
        # Prepara il contesto per il LLM
        context = "\n".join([chunk.content for chunk in relevant_chunks])
        
        # Genera la risposta usando il LLM
        llm_client = get_openai_client()
        response = llm_client.generate_response(
            query=query.text,
            context=context
        )

        # Salva la risposta
        query.response = response
        query.status = 'completed'
        query.save()
        
        return True

    except Exception as e:
        logger.error(f"Errore nell'elaborazione della query {query_id}: {str(e)}")
        query.status = 'failed'
        query.error_message = str(e)
        query.save()
        raise

def split_text_into_chunks(text, chunk_size=1000, overlap=200):
    """
    Divide il testo in chunk sovrapposti.
    """
    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size
        if end > text_length:
            end = text_length
        
        chunk = text[start:end]
        chunks.append(chunk)
        
        start = end - overlap

    return chunks

def find_relevant_chunks(query_embedding, top_k=5):
    """
    Trova i chunk più rilevanti per la query usando la similarità del coseno.
    """
    chunks = DocumentChunk.objects.all()
    relevant_chunks = []
    
    for chunk in chunks:
        similarity = cosine_similarity(query_embedding, chunk.embedding)
        relevant_chunks.append((chunk, similarity))
    
    # Ordina per similarità e prendi i top_k
    relevant_chunks.sort(key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in relevant_chunks[:top_k]]

def cosine_similarity(vec1, vec2):
    """
    Calcola la similarità del coseno tra due vettori.
    """
    import numpy as np
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    return dot_product / (norm1 * norm2) 