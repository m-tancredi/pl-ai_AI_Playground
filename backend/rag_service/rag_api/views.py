"""
Views per l'API RAG - Endpoint principali per chat, upload e gestione documenti.
"""
import os
import time
import logging
from pathlib import Path
from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from django.core.files.storage import default_storage
import uuid

from .models import RAGDocument, RAGChunk, RAGProcessingLog, RAGKnowledgeBase
from .serializers import (
    RAGDocumentSerializer, RAGDocumentDetailSerializer, RAGChatSerializer,
    RAGDocumentUploadSerializer, RAGStatusSerializer, BulkDeleteSerializer
)
from .tasks import process_rag_document_task
from .utils.embedding_utils import get_embedding_manager
from config.llm_clients import get_openai_client
from .authentication import JWTCustomAuthentication

logger = logging.getLogger(__name__)

class RAGChatView(APIView):
    """
    View principale per la chat RAG con integrazione OpenAI.
    """
    
    def post(self, request):
        """
        Endpoint principale per la chat RAG.
        
        Questo endpoint:
        1. Riceve una domanda dall'utente
        2. Cerca i chunk più rilevanti nei documenti
        3. Crea un contesto dai chunk trovati
        4. Usa OpenAI per generare una risposta basata sul contesto
        """
        start_time = time.time()
        
        try:
            # Valida i dati di input
            serializer = RAGChatSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            message = serializer.validated_data['message']
            document_ids = serializer.validated_data.get('document_ids', [])
            top_k = serializer.validated_data.get('top_k', 5)
            max_tokens = serializer.validated_data.get('max_tokens', 1000)
            
            logger.info(f"Richiesta chat RAG: '{message[:50]}...'")
            
            # Determina i documenti da cercare
            search_document_ids = self._get_search_document_ids(request.user, document_ids)
            
            if not search_document_ids:
                return Response({
                    'error': 'Nessun documento processato disponibile per la ricerca'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Cerca i chunk più rilevanti
            relevant_chunks = self._search_relevant_chunks(message, search_document_ids, top_k)
            
            if not relevant_chunks:
                return Response({
                    'message': message,
                    'response': 'Non ho trovato informazioni rilevanti nei documenti per rispondere alla tua domanda.',
                    'context_chunks': [],
                    'sources': [],
                    'processing_time': time.time() - start_time,
                    'model_used': getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
                }, status=status.HTTP_200_OK)
            
            # Crea il contesto dai chunk trovati
            context = self._build_context_from_chunks(relevant_chunks)
            
            # Genera la risposta con OpenAI
            response_text = self._generate_openai_response(context, message, max_tokens)
            
            # Prepara le informazioni sui chunk e le fonti
            context_chunks_info = self._prepare_context_chunks_info(relevant_chunks)
            sources_info = self._prepare_sources_info(relevant_chunks)
            
            processing_time = time.time() - start_time
            
            logger.info(f"Chat RAG completata in {processing_time:.2f}s")
            
            # Restituisci la risposta
            response_data = {
                'message': message,
                'response': response_text,
                'context_chunks': context_chunks_info,
                'sources': sources_info,
                'processing_time': processing_time,
                'model_used': getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nella chat RAG: {str(e)}", exc_info=True)
            return Response({
                'error': 'Errore interno nella generazione della risposta'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_search_document_ids(self, user, document_ids):
        """
        Determina gli ID dei documenti in cui cercare.
        """
        if document_ids:
            return document_ids
        else:
            # Usa tutti i documenti dell'utente
            return list(RAGDocument.objects.filter(
                user_id=user.id if user.is_authenticated else None,
                status='processed',
                embeddings_created=True
            ).values_list('id', flat=True))
    
    def _search_relevant_chunks(self, query, document_ids, top_k):
        """
        Cerca i chunk più rilevanti per la query.
        """
        try:
            embedding_manager = get_embedding_manager()
            return embedding_manager.search_similar_chunks(query, document_ids, top_k)
        except Exception as e:
            logger.error(f"Errore nella ricerca di chunk rilevanti: {str(e)}")
            return []
    
    def _build_context_from_chunks(self, relevant_chunks):
        """
        Costruisce il contesto concatenando i chunk rilevanti.
        """
        context_parts = []
        
        for i, (chunk_text, score, doc_id) in enumerate(relevant_chunks):
            # Ottieni informazioni sul documento
            try:
                document = RAGDocument.objects.get(id=doc_id)
                source_info = f"[Fonte: {document.original_filename}]"
            except RAGDocument.DoesNotExist:
                source_info = f"[Fonte: Documento {doc_id}]"
            
            context_parts.append(f"{source_info}\n{chunk_text}")
        
        return "\n\n---\n\n".join(context_parts)
    
    def _generate_openai_response(self, context, question, max_tokens):
        """
        Genera la risposta usando OpenAI.
        """
        try:
            openai_client = get_openai_client()
            return openai_client.generate_rag_response(context, question, max_tokens)
        except Exception as e:
            logger.error(f"Errore nella generazione della risposta OpenAI: {str(e)}")
            raise Exception(f"Errore nella generazione della risposta: {str(e)}")
    
    def _prepare_context_chunks_info(self, relevant_chunks):
        """
        Prepara le informazioni sui chunk di contesto per la risposta.
        """
        chunks_info = []
        
        for chunk_text, score, doc_id in relevant_chunks:
            chunks_info.append({
                'text': chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text,
                'score': round(score, 4),
                'document_id': doc_id
            })
        
        return chunks_info
    
    def _prepare_sources_info(self, relevant_chunks):
        """
        Prepara le informazioni sulle fonti per la risposta.
        """
        # Ottieni i documenti unici referenziati
        referenced_doc_ids = list(set(doc_id for _, _, doc_id in relevant_chunks))
        
        sources = []
        documents = RAGDocument.objects.filter(id__in=referenced_doc_ids)
        
        for document in documents:
            sources.append({
                'document_id': document.id,
                'filename': document.original_filename,
                'file_type': document.file_type,
                'created_at': document.created_at.isoformat()
            })
        
        return sources

class RAGDocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet per la gestione dei documenti RAG.
    """
    serializer_class = RAGDocumentSerializer
    parser_classes = [MultiPartParser, JSONParser]
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Restituisce i documenti filtrati per utente."""
        queryset = RAGDocument.objects.all()
        
        if self.request.user.is_authenticated:
            # Usa l'ID dell'utente per la query invece dell'oggetto utente
            queryset = queryset.filter(user_id=self.request.user.id)
        
        # Filtri opzionali
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        """Restituisce il serializer appropriato."""
        if self.action == 'retrieve':
            return RAGDocumentDetailSerializer
        return RAGDocumentSerializer
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Endpoint per l'upload di documenti.
        """
        try:
            serializer = RAGDocumentUploadSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            uploaded_file = serializer.validated_data['file']
            
            # Salva il file
            file_path = self._save_uploaded_file(uploaded_file)
            
            # Crea il documento nel database
            document = RAGDocument.objects.create(
                user_id=request.user.id if request.user.is_authenticated else None,
                filename=os.path.basename(file_path),
                original_filename=uploaded_file.name,
                file_path=file_path,
                file_size=uploaded_file.size,
                file_type=uploaded_file.content_type or 'application/octet-stream',
                status='uploaded'
            )
            
            # Avvia il processamento asincrono
            process_rag_document_task.delay(document.id)
            
            # Restituisci la risposta
            response_serializer = RAGDocumentSerializer(document)
            return Response({
                'message': 'File caricato con successo. Processamento avviato.',
                'document': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Errore nell'upload del documento: {str(e)}")
            return Response({
                'error': 'Errore interno durante l\'upload del file'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _save_uploaded_file(self, uploaded_file):
        """
        Salva il file caricato nella directory di upload.
        """
        # Crea la directory di upload se non esiste
        upload_dir = Path(settings.RAG_UPLOADS_ROOT)
        upload_dir.mkdir(exist_ok=True)
        
        # Genera un nome file unico
        timestamp = int(time.time())
        filename = f"{timestamp}_{uploaded_file.name}"
        file_path = upload_dir / filename
        
        # Salva il file
        with open(file_path, 'wb') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        
        return str(file_path)
    
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        Elimina più documenti in una sola richiesta.
        """
        try:
            serializer = BulkDeleteSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            document_ids = serializer.validated_data['document_ids']
            documents = RAGDocument.objects.filter(id__in=document_ids)
            
            deleted_count = 0
            for document in documents:
                document.delete()
                deleted_count += 1
            
            return Response({
                'message': f'{deleted_count} documenti eliminati con successo',
                'deleted_count': deleted_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nell'eliminazione in blocco: {str(e)}")
            return Response({
                'error': 'Errore nell\'eliminazione dei documenti'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RAGStatusView(APIView):
    """
    View per ottenere lo stato del sistema RAG.
    """
    
    def get(self, request):
        """
        Restituisce statistiche e stato del sistema RAG.
        """
        try:
            user = request.user if request.user.is_authenticated else None
            
            # Filtra per utente se autenticato
            documents_queryset = RAGDocument.objects.all()
            if user:
                documents_queryset = documents_queryset.filter(user_id=user.id)
            
            # Statistiche sui documenti
            total_documents = documents_queryset.count()
            processed_documents = documents_queryset.filter(status='processed').count()
            processing_documents = documents_queryset.filter(status='processing').count()
            failed_documents = documents_queryset.filter(status='failed').count()
            
            # Statistiche sui chunk
            total_chunks = sum(
                doc.num_chunks for doc in documents_queryset.filter(status='processed')
            )
            
            # Configurazione del sistema
            embedding_model = getattr(settings, 'SENTENCE_TRANSFORMER_MODEL_NAME', 'all-MiniLM-L6-v2')
            openai_model = getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
            
            # Stato del sistema
            system_status = 'healthy'
            if processing_documents > 0:
                system_status = 'processing'
            elif failed_documents > total_documents * 0.1:  # Se più del 10% è fallito
                system_status = 'degraded'
            
            status_data = {
                'total_documents': total_documents,
                'processed_documents': processed_documents,
                'processing_documents': processing_documents,
                'failed_documents': failed_documents,
                'total_chunks': total_chunks,
                'embedding_model': embedding_model,
                'openai_model': openai_model,
                'system_status': system_status
            }
            
            serializer = RAGStatusSerializer(status_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero dello stato del sistema: {str(e)}")
            return Response({
                'error': 'Errore nel recupero dello stato del sistema'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RAGClearKnowledgeBaseView(APIView):
    """
    View per svuotare completamente la knowledge base.
    """
    
    def post(self, request):
        """
        Elimina tutti i documenti dell'utente e pulisce la knowledge base.
        """
        try:
            user = request.user if request.user.is_authenticated else None
            
            # Conferma richiesta dall'utente
            confirm = request.data.get('confirm', False)
            if not confirm:
                return Response({
                    'error': 'Conferma richiesta. Invia "confirm": true per procedere.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Conta i documenti da eliminare
            documents_to_delete = RAGDocument.objects.filter(user_id=user.id) if user else RAGDocument.objects.all()
            count = documents_to_delete.count()
            
            if count == 0:
                return Response({
                    'message': 'Nessun documento da eliminare'
                }, status=status.HTTP_200_OK)
            
            # Elimina i documenti (questo eliminerà anche file ed embeddings)
            for document in documents_to_delete:
                document.delete()
            
            # Pulisce la cache degli embeddings
            try:
                embedding_manager = get_embedding_manager()
                embedding_manager.clear_cache()
            except Exception as e:
                logger.warning(f"Errore nella pulizia della cache embeddings: {str(e)}")
            
            return Response({
                'message': f'{count} documenti eliminati. Knowledge base svuotata.',
                'deleted_count': count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nello svuotamento della knowledge base: {str(e)}")
            return Response({
                'error': 'Errore nello svuotamento della knowledge base'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ViewSet per gestire i documenti - attualmente gestiti tramite RAGDocumentViewSet
