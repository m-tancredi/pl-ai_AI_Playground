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

from .models import RAGDocument, RAGChunk, RAGProcessingLog, RAGKnowledgeBase, RAGChatSession, RAGChatMessage
from .serializers import (
    RAGDocumentSerializer, RAGDocumentDetailSerializer, RAGChatSerializer,
    RAGDocumentUploadSerializer, RAGStatusSerializer, BulkDeleteSerializer,
    RAGKnowledgeBaseSerializer, RAGKnowledgeBaseDetailSerializer,
    RAGChatSessionSerializer, RAGChatSessionDetailSerializer, RAGChatMessageSerializer
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

class RAGKnowledgeBaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet per la gestione delle Knowledge Base.
    """
    serializer_class = RAGKnowledgeBaseSerializer
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filtra le knowledge base per utente.
        """
        user = self.request.user
        if user.is_authenticated:
            return RAGKnowledgeBase.objects.filter(user_id=user.id)
        return RAGKnowledgeBase.objects.none()
    
    def get_serializer_class(self):
        """
        Usa serializer dettagliato per retrieve.
        """
        if self.action == 'retrieve':
            return RAGKnowledgeBaseDetailSerializer
        return RAGKnowledgeBaseSerializer
    
    def perform_create(self, serializer):
        """
        Assegna l'utente corrente alla knowledge base.
        """
        serializer.save(user_id=self.request.user.id)
    
    @action(detail=True, methods=['post'])
    def add_documents(self, request, pk=None):
        """
        Aggiunge documenti alla knowledge base.
        """
        try:
            kb = self.get_object()
            document_ids = request.data.get('document_ids', [])
            
            if not document_ids:
                return Response({
                    'error': 'Nessun documento specificato'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verifica che i documenti appartengano all'utente
            user_documents = RAGDocument.objects.filter(
                id__in=document_ids,
                user_id=request.user.id
            )
            
            if user_documents.count() != len(document_ids):
                return Response({
                    'error': 'Alcuni documenti non sono validi o non appartengono all\'utente'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Aggiunge i documenti alla KB
            kb.documents.add(*user_documents)
            kb.update_statistics()
            
            return Response({
                'message': f'{user_documents.count()} documenti aggiunti alla knowledge base',
                'added_count': user_documents.count()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nell'aggiunta di documenti alla KB: {str(e)}")
            return Response({
                'error': 'Errore nell\'aggiunta dei documenti'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def remove_documents(self, request, pk=None):
        """
        Rimuove documenti dalla knowledge base.
        """
        try:
            kb = self.get_object()
            document_ids = request.data.get('document_ids', [])
            
            if not document_ids:
                return Response({
                    'error': 'Nessun documento specificato'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Rimuove i documenti dalla KB
            removed_count = 0
            for doc_id in document_ids:
                try:
                    document = kb.documents.get(id=doc_id)
                    kb.documents.remove(document)
                    removed_count += 1
                except RAGDocument.DoesNotExist:
                    continue
            
            kb.update_statistics()
            
            return Response({
                'message': f'{removed_count} documenti rimossi dalla knowledge base',
                'removed_count': removed_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nella rimozione di documenti dalla KB: {str(e)}")
            return Response({
                'error': 'Errore nella rimozione dei documenti'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """
        Restituisce statistiche dettagliate della knowledge base.
        """
        try:
            kb = self.get_object()
            
            # Aggiorna le statistiche
            kb.update_statistics()
            
            # Calcola statistiche dettagliate
            documents = kb.documents.all()
            
            stats = {
                'knowledge_base_id': kb.id,
                'name': kb.name,
                'total_documents': documents.count(),
                'processed_documents': documents.filter(status='processed').count(),
                'processing_documents': documents.filter(status='processing').count(),
                'failed_documents': documents.filter(status='failed').count(),
                'total_chunks': kb.total_chunks,
                'total_file_size': sum(doc.file_size for doc in documents),
                'total_text_length': sum(doc.text_length for doc in documents if doc.text_length),
                'file_types': list(documents.values_list('file_type', flat=True).distinct()),
                'created_at': kb.created_at,
                'updated_at': kb.updated_at,
                'embedding_model': kb.embedding_model,
                'chunk_size': kb.chunk_size,
                'chunk_overlap': kb.chunk_overlap,
            }
            
            return Response(stats, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero delle statistiche KB: {str(e)}")
            return Response({
                'error': 'Errore nel recupero delle statistiche'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def chat(self, request, pk=None):
        """
        Chat specifica per questa knowledge base.
        """
        try:
            kb = self.get_object()
            
            # Valida i dati di input
            serializer = RAGChatSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            message = serializer.validated_data['message']
            top_k = serializer.validated_data.get('top_k', 5)
            max_tokens = serializer.validated_data.get('max_tokens', 1000)
            
            # Usa solo i documenti di questa KB
            kb_document_ids = list(kb.documents.filter(
                status='processed',
                embeddings_created=True
            ).values_list('id', flat=True))
            
            if not kb_document_ids:
                return Response({
                    'error': f'Nessun documento processato nella knowledge base "{kb.name}"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Usa la logica di chat esistente ma limitata a questa KB
            chat_view = RAGChatView()
            
            # Cerca i chunk più rilevanti
            relevant_chunks = chat_view._search_relevant_chunks(message, kb_document_ids, top_k)
            
            if not relevant_chunks:
                return Response({
                    'message': message,
                    'response': f'Non ho trovato informazioni rilevanti nella knowledge base "{kb.name}" per rispondere alla tua domanda.',
                    'context_chunks': [],
                    'sources': [],
                    'knowledge_base': {
                        'id': kb.id,
                        'name': kb.name
                    }
                }, status=status.HTTP_200_OK)
            
            # Crea il contesto dai chunk trovati
            context = chat_view._build_context_from_chunks(relevant_chunks)
            
            # Genera la risposta con OpenAI
            response_text = chat_view._generate_openai_response(context, message, max_tokens)
            
            # Prepara le informazioni sui chunk e le fonti
            context_chunks_info = chat_view._prepare_context_chunks_info(relevant_chunks)
            sources_info = chat_view._prepare_sources_info(relevant_chunks)
            
            # Restituisci la risposta
            response_data = {
                'message': message,
                'response': response_text,
                'context_chunks': context_chunks_info,
                'sources': sources_info,
                'knowledge_base': {
                    'id': kb.id,
                    'name': kb.name,
                    'description': kb.description
                },
                'model_used': getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nella chat KB: {str(e)}")
            return Response({
                'error': 'Errore nella generazione della risposta'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RAGChatSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet per la gestione delle sessioni di chat RAG.
    """
    serializer_class = RAGChatSessionSerializer
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filtra le sessioni per l'utente corrente.
        """
        return RAGChatSession.objects.filter(user_id=self.request.user.id)
    
    def get_serializer_class(self):
        """
        Usa serializer dettagliato per retrieve.
        """
        if self.action == 'retrieve':
            return RAGChatSessionDetailSerializer
        return RAGChatSessionSerializer
    
    def perform_create(self, serializer):
        """
        Assegna l'utente corrente alla sessione.
        """
        serializer.save(user_id=self.request.user.id)
    
    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """
        Invia un messaggio in questa sessione di chat.
        """
        try:
            session = self.get_object()
            message_content = request.data.get('message', '').strip()
            
            if not message_content:
                return Response({
                    'error': 'Il messaggio non può essere vuoto'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Salva il messaggio utente
            user_message = RAGChatMessage.objects.create(
                session=session,
                content=message_content,
                is_user=True
            )
            
            # Genera risposta AI
            start_time = time.time()
            
            try:
                # Determina i documenti da usare
                if session.knowledge_base:
                    # Chat specifica per KB
                    document_ids = list(session.knowledge_base.documents.filter(
                        status='processed',
                        embeddings_created=True
                    ).values_list('id', flat=True))
                    
                    if not document_ids:
                        ai_response = f'Non ci sono documenti processati nella knowledge base "{session.knowledge_base.name}".'
                        sources = []
                    else:
                        # Usa la logica di chat esistente
                        chat_view = RAGChatView()
                        relevant_chunks = chat_view._search_relevant_chunks(message_content, document_ids, 5)
                        
                        if relevant_chunks:
                            context = chat_view._build_context_from_chunks(relevant_chunks)
                            ai_response = chat_view._generate_openai_response(context, message_content, 1000)
                            sources = chat_view._prepare_sources_info(relevant_chunks)
                        else:
                            ai_response = f'Non ho trovato informazioni rilevanti nella knowledge base "{session.knowledge_base.name}".'
                            sources = []
                else:
                    # Chat globale
                    user_documents = RAGDocument.objects.filter(
                        user_id=request.user.id,
                        status='processed',
                        embeddings_created=True
                    )
                    
                    if not user_documents.exists():
                        ai_response = 'Non hai ancora documenti processati. Carica alcuni documenti per iniziare a chattare!'
                        sources = []
                    else:
                        document_ids = list(user_documents.values_list('id', flat=True))
                        chat_view = RAGChatView()
                        relevant_chunks = chat_view._search_relevant_chunks(message_content, document_ids, 5)
                        
                        if relevant_chunks:
                            context = chat_view._build_context_from_chunks(relevant_chunks)
                            ai_response = chat_view._generate_openai_response(context, message_content, 1000)
                            sources = chat_view._prepare_sources_info(relevant_chunks)
                        else:
                            ai_response = 'Non ho trovato informazioni rilevanti nei tuoi documenti per rispondere alla domanda.'
                            sources = []
                
                processing_time = time.time() - start_time
                
                # Salva il messaggio AI
                ai_message = RAGChatMessage.objects.create(
                    session=session,
                    content=ai_response,
                    is_user=False,
                    sources=sources,
                    processing_time=processing_time,
                    model_used=getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')
                )
                
                # Aggiorna statistiche sessione
                session.message_count = session.messages.count()
                if not session.title:
                    session.generate_title()
                session.save()
                
                # Serializza i messaggi
                user_msg_data = RAGChatMessageSerializer(user_message).data
                ai_msg_data = RAGChatMessageSerializer(ai_message).data
                
                return Response({
                    'user_message': user_msg_data,
                    'ai_message': ai_msg_data,
                    'session': RAGChatSessionSerializer(session).data
                }, status=status.HTTP_200_OK)
                
            except Exception as e:
                logger.error(f"Errore nella generazione risposta AI: {str(e)}")
                
                # Salva messaggio di errore
                error_message = RAGChatMessage.objects.create(
                    session=session,
                    content='Mi dispiace, si è verificato un errore nella generazione della risposta. Riprova più tardi.',
                    is_user=False,
                    processing_time=time.time() - start_time
                )
                
                session.message_count = session.messages.count()
                session.save()
                
                user_msg_data = RAGChatMessageSerializer(user_message).data
                error_msg_data = RAGChatMessageSerializer(error_message).data
                
                return Response({
                    'user_message': user_msg_data,
                    'ai_message': error_msg_data,
                    'session': RAGChatSessionSerializer(session).data,
                    'error': 'Errore nella generazione della risposta'
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Errore nell'invio messaggio: {str(e)}")
            return Response({
                'error': 'Errore nell\'invio del messaggio'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['delete'])
    def clear_messages(self, request, pk=None):
        """
        Cancella tutti i messaggi di questa sessione.
        """
        try:
            session = self.get_object()
            deleted_count = session.messages.count()
            session.messages.all().delete()
            session.message_count = 0
            session.title = ''
            session.save()
            
            return Response({
                'message': f'{deleted_count} messaggi cancellati',
                'deleted_count': deleted_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nella cancellazione messaggi: {str(e)}")
            return Response({
                'error': 'Errore nella cancellazione dei messaggi'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RAGChatSessionListView(APIView):
    """
    View per ottenere le sessioni di chat raggruppate per modalità.
    """
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Restituisce le sessioni di chat dell'utente raggruppate per modalità.
        """
        try:
            user_sessions = RAGChatSession.objects.filter(user_id=request.user.id)
            
            # Raggruppa per modalità
            global_sessions = user_sessions.filter(mode='global').order_by('-last_activity')
            kb_sessions = user_sessions.exclude(mode='global').order_by('-last_activity')
            
            # Serializza
            global_data = RAGChatSessionSerializer(global_sessions, many=True).data
            kb_data = RAGChatSessionSerializer(kb_sessions, many=True).data
            
            return Response({
                'global_sessions': global_data,
                'kb_sessions': kb_data,
                'total_sessions': user_sessions.count()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero sessioni chat: {str(e)}")
            return Response({
                'error': 'Errore nel recupero delle sessioni'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
