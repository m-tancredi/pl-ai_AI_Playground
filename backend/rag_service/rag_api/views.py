"""
Views per l'API RAG - Endpoint principali per chat, upload e gestione documenti.
"""
import os
import time
import logging
from pathlib import Path
from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse, Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.core.files.storage import default_storage
import uuid
import mimetypes
import requests
import tempfile

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
                # Per domande senza contesto rilevante, usa comunque l'AI con prompt appropriato
                context_empty = "Nessun documento rilevante trovato nella knowledge base."
                response_text = self._generate_openai_response(context_empty, message, max_tokens)
                
                return Response({
                    'message': message,
                    'response': response_text,
                    'context_chunks': [],
                    'sources': [],
                    'processing_time': time.time() - start_time,
                    'model_used': getattr(settings, 'OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo'),
                    'note': 'Risposta basata su conoscenza generale (nessun documento rilevante trovato)'
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
        Endpoint per l'upload di documenti o per processare risorse dal Resource Manager.
        """
        try:
            serializer = RAGDocumentUploadSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            uploaded_file = serializer.validated_data.get('file')
            resource_id = serializer.validated_data.get('resource_id')
            
            document = None
            
            if uploaded_file:
                # Flusso tradizionale: upload diretto del file
                document = self._process_uploaded_file(request, uploaded_file)
                
            elif resource_id:
                # Flusso nuovo: processo risorsa dal Resource Manager
                document = self._process_resource_from_manager(request, resource_id)
            
            if not document:
                return Response({
                    'error': 'Errore durante la creazione del documento'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Avvia il processamento asincrono
            process_rag_document_task.delay(document.id)
            
            # Restituisci la risposta
            response_serializer = RAGDocumentSerializer(document)
            return Response({
                'message': 'Documento creato con successo. Processamento avviato.',
                'document': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Errore nell'upload del documento: {str(e)}")
            return Response({
                'error': 'Errore interno durante l\'elaborazione'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_uploaded_file(self, request, uploaded_file):
        """
        Processa un file caricato direttamente.
        """
        # Salva il file
        file_path = self._save_uploaded_file(uploaded_file)
        
        # Crea il documento nel database
        document = RAGDocument.objects.create(
            user_id=request.user.id if request.user.is_authenticated else None,
            resource_id=None,  # Nessuna risorsa del Resource Manager
            filename=os.path.basename(file_path),
            original_filename=uploaded_file.name,
            file_path=file_path,
            file_size=uploaded_file.size,
            file_type=uploaded_file.content_type or 'application/octet-stream',
            status='uploaded'
        )
        
        return document
    
    def _process_resource_from_manager(self, request, resource_id):
        """
        Processa una risorsa esistente dal Resource Manager.
        """
        from django.conf import settings
        import requests
        import tempfile
        
        # Costanti per header interno
        INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
        INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE
        
        try:
            user_id = request.user.id if request.user.is_authenticated else None
            
            logger.info(f"Recupero risorsa {resource_id} dal Resource Manager per utente {user_id}")
            
            # Chiama l'endpoint interno del Resource Manager per ottenere il contenuto
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/rag/resources/{resource_id}/content/"
            internal_headers = {}
            if INTERNAL_API_SECRET:
                internal_headers[INTERNAL_API_HEADER] = INTERNAL_API_SECRET
            
            response = requests.get(resource_url, headers=internal_headers, timeout=30)
            response.raise_for_status()
            
            # Ottieni informazioni dal Resource Manager sulla risorsa
            resource_info_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/rag/resources/"
            info_params = {'user_id': user_id, 'limit': 1}
            
            info_response = requests.get(resource_info_url, headers=internal_headers, params=info_params, timeout=30)
            info_response.raise_for_status()
            
            resource_info_data = info_response.json()
            resource_info = None
            
            # Trova la risorsa specifica
            for res in resource_info_data.get('resources', []):
                if res['id'] == resource_id:
                    resource_info = res
                    break
            
            if not resource_info:
                raise Exception(f"Resource {resource_id} not found or not accessible")
            
            # Verifica che sia compatibile con RAG (dovrebbe già essere filtrata, ma double-check)
            rag_compatible_types = {
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'text/plain',
                'text/markdown',
                'text/rtf',
                'application/rtf',
                'text/x-markdown',
            }
            
            if resource_info['mime_type'] not in rag_compatible_types:
                raise Exception(f"Resource type '{resource_info['mime_type']}' is not compatible with RAG")
            
            # Salva temporaneamente il file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{resource_info['original_filename']}") as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
            
            # Sposta il file nella directory di upload del RAG
            final_file_path = self._save_file_content(
                response.content, 
                resource_info['original_filename'],
                resource_info['mime_type']
            )
            
            # Pulisci il file temporaneo
            os.unlink(temp_file_path)
            
            # Crea il documento nel database
            document = RAGDocument.objects.create(
                user_id=user_id,
                resource_id=resource_id,  # Referenzia la risorsa del Resource Manager
                filename=os.path.basename(final_file_path),
                original_filename=resource_info['original_filename'],
                file_path=final_file_path,
                file_size=resource_info['size'],
                file_type=resource_info['mime_type'],
                status='uploaded'
            )
            
            logger.info(f"Documento RAG creato dal Resource Manager: {document.id} (risorsa {resource_id})")
            
            return document
            
        except requests.exceptions.HTTPError as http_err:
            error_msg = f"HTTP error accessing Resource Manager: {http_err.response.status_code if http_err.response else 'N/A'}"
            if http_err.response:
                try:
                    error_data = http_err.response.json()
                    error_msg += f" - {error_data.get('error', 'Unknown error')}"
                except:
                    error_msg += f" - {http_err.response.text[:200]}"
            logger.error(error_msg)
            raise Exception(error_msg)
            
        except requests.exceptions.RequestException as req_exc:
            error_msg = f"Request error accessing Resource Manager: {req_exc}"
            logger.error(error_msg)
            raise Exception(error_msg)
            
        except Exception as e:
            error_msg = f"Unexpected error processing resource from Resource Manager: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)
    
    def _save_file_content(self, content, filename, content_type):
        """
        Salva il contenuto del file nella directory di upload del RAG.
        """
        import uuid
        from pathlib import Path
        
        # Crea directory se non esiste
        upload_dir = Path(settings.RAG_UPLOADS_ROOT)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Genera nome file unico
        file_extension = Path(filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Salva il contenuto
        with open(file_path, 'wb') as f:
            f.write(content)
        
        return str(file_path)
    
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
    
    @action(detail=False, methods=['post'])
    def search_content(self, request):
        """
        🧠 Ricerca AI Ultra-Intelligente usando OpenAI embeddings.
        Supporta ricerca semantica avanzata, clustering e analisi contesto.
        """
        try:
            document_id = request.data.get('document_id')
            query = request.data.get('query', '').strip()
            search_options = request.data.get('options', {})
            
            # 🎯 Opzioni di ricerca avanzate
            top_k = search_options.get('top_k', 10)  # Aumentato per migliori risultati
            include_context = search_options.get('include_context', True)
            similarity_threshold = search_options.get('similarity_threshold', 0.4)  # 🔥 Soglia ridotta per più risultati
            enable_clustering = search_options.get('enable_clustering', True)
            
            if not document_id:
                return Response({
                    'error': 'ID documento richiesto'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not query:
                return Response({
                    'error': 'Query di ricerca richiesta'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verifica che il documento esista e appartenga all'utente
            try:
                document = RAGDocument.objects.get(
                    id=document_id,
                    user_id=request.user.id if request.user.is_authenticated else None
                )
            except RAGDocument.DoesNotExist:
                return Response({
                    'error': 'Documento non trovato'
                }, status=status.HTTP_404_NOT_FOUND)
            
            if not document.extracted_text:
                return Response({
                    'error': 'Contenuto del documento non disponibile'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 🚀 RICERCA AI ULTRA-INTELLIGENTE
            try:
                embedding_manager = get_embedding_manager()
                
                # ⚡ Verifica provider OpenAI
                provider_info = embedding_manager.get_embedding_info()
                logger.info(f"🔥 Ricerca con provider: {provider_info['provider']} - Modello: {provider_info.get('model', 'N/A')}")
                
                # 🧠 Ricerca semantica potenziata
                relevant_chunks = embedding_manager.search_similar_chunks(
                    query=query,
                    document_ids=[document.id],
                    top_k=top_k
                )
                
                if not relevant_chunks:
                    # 🔄 Fallback intelligente
                    logger.warning(f"Nessun chunk trovato con ricerca semantica per documento {document_id}")
                    results = self._enhanced_text_search(document.extracted_text, query)
                    return Response({
                        'results': results,
                        'search_type': 'enhanced_fallback',
                        'provider_info': provider_info,
                        'message': 'Ricerca testuale potenziata utilizzata come fallback'
                    }, status=status.HTTP_200_OK)
                
                # 📊 Log dettagliato dei chunk trovati
                logger.info(f"🔍 Chunk trovati: {len(relevant_chunks)}")
                for i, (chunk_text, score, doc_id) in enumerate(relevant_chunks[:3]):  # Log primi 3
                    logger.info(f"  Chunk {i+1}: score={score:.4f}, text_preview='{chunk_text[:100]}...'")
                logger.info(f"🎯 Soglia similarità: {similarity_threshold}")
                
                # 🎯 Elaborazione risultati con AI insights
                results = self._process_semantic_results(
                    relevant_chunks, 
                    query, 
                    document, 
                    similarity_threshold,
                    include_context,
                    enable_clustering
                )
                
                # 📊 Statistiche ricerca
                search_stats = {
                    'total_chunks_analyzed': len(relevant_chunks),
                    'high_confidence_results': len([r for r in results if r.get('confidence', 0) > 0.8]),
                    'avg_relevance': sum(r.get('relevance', 0) for r in results) / len(results) if results else 0,
                    'semantic_clusters': len(set(r.get('cluster_id', 0) for r in results)) if enable_clustering else 0
                }
                
                return Response({
                    'results': results,
                    'search_type': 'semantic_ultra_intelligent',
                    'provider_info': provider_info,
                    'search_stats': search_stats,
                    'query_analysis': self._analyze_query_intent(query),
                    'message': f'🧠 Ricerca AI completata con {provider_info["provider"]} embeddings'
                }, status=status.HTTP_200_OK)
                
            except Exception as e:
                logger.warning(f"Errore nella ricerca semantica: {str(e)}")
                # 🔄 Fallback ultra-smart
                results = self._enhanced_text_search(document.extracted_text, query)
                return Response({
                    'results': results,
                    'search_type': 'enhanced_fallback',
                    'error_info': str(e),
                    'message': 'Fallback a ricerca testuale potenziata'
                }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nella ricerca del contenuto: {str(e)}")
            return Response({
                'error': 'Errore durante la ricerca AI'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_semantic_results(self, relevant_chunks, query, document, similarity_threshold, include_context, enable_clustering):
        """
        🎯 Elaborazione intelligente dei risultati di ricerca semantica.
        """
        results = []
        clusters = {}
        
        logger.info(f"🎯 Processamento {len(relevant_chunks)} chunk con soglia {similarity_threshold}")
        
        for i, (chunk_text, score, doc_id) in enumerate(relevant_chunks):
            # 🔍 Analisi chunk
            chunk_analysis = self._analyze_chunk_relevance(chunk_text, query, score)
            
            # 🎨 Clustering semantico
            cluster_id = 0
            if enable_clustering:
                cluster_id = self._assign_semantic_cluster(chunk_text, clusters)
            
            # 📍 Posizione nel documento
            position_info = self._find_chunk_position(chunk_text, document.extracted_text)
            
            # 🎯 Converti highlight spans da posizioni relative a assolute
            absolute_highlight_spans = []
            if chunk_analysis['highlight_spans'] and position_info['start'] != -1:
                for span in chunk_analysis['highlight_spans']:
                    absolute_highlight_spans.append({
                        'start': position_info['start'] + span['start'],
                        'end': position_info['start'] + span['end'],
                        'type': span['type'],
                        'word': span.get('word', '')
                    })
            
            result = {
                'text': chunk_text,
                'relevance': float(score),
                'confidence': chunk_analysis['confidence'],
                'chunk_index': i,
                'start_position': position_info['start'],
                'end_position': position_info['end'],
                'cluster_id': cluster_id,
                'semantic_score': chunk_analysis['semantic_score'],
                'keyword_matches': chunk_analysis['keyword_matches'],
                'context_snippet': self._extract_context_snippet(chunk_text, document.extracted_text) if include_context else None,
                'highlight_spans': absolute_highlight_spans  # Posizioni assolute nel documento
            }
            
            # 🎯 Filtra per soglia di similarità
            if score >= similarity_threshold:
                results.append(result)
                logger.debug(f"✅ Chunk {i+1} accettato: score={score:.4f} >= {similarity_threshold}")
            else:
                logger.debug(f"❌ Chunk {i+1} rifiutato: score={score:.4f} < {similarity_threshold}")
        
        # 🏆 Ordina per rilevanza composita
        results.sort(key=lambda x: x['semantic_score'], reverse=True)
        
        logger.info(f"🏆 Risultati finali: {len(results)} chunk accettati su {len(relevant_chunks)} analizzati")
        
        return results[:10]  # Top 10 risultati
    
    def _analyze_chunk_relevance(self, chunk_text, query, base_score):
        """
        🧠 Analisi intelligente della rilevanza del chunk.
        """
        chunk_lower = chunk_text.lower()
        query_lower = query.lower()
        query_words = query_lower.split()
        
        # 🔍 Analisi keyword
        keyword_matches = []
        total_matches = 0
        
        for word in query_words:
            if len(word) > 2:  # Ignora parole troppo corte
                matches = chunk_lower.count(word)
                if matches > 0:
                    keyword_matches.append({
                        'word': word,
                        'count': matches,
                        'positions': [i for i in range(len(chunk_text)) if chunk_text.lower().startswith(word, i)]
                    })
                    total_matches += matches
        
        # 📊 Calcolo confidence composita
        keyword_boost = min(total_matches * 0.1, 0.3)  # Max boost 0.3
        length_penalty = max(0, (len(chunk_text) - 1000) * -0.0001)  # Penalizza chunk troppo lunghi
        
        confidence = base_score + keyword_boost + length_penalty
        confidence = max(0.0, min(1.0, confidence))  # Clamp tra 0 e 1
        
        # 🎯 Score semantico potenziato
        semantic_multiplier = 1.0
        if any('definizione' in word or 'cos\'' in word for word in query_words):
            semantic_multiplier = 1.2  # Boost per query definitive
        
        semantic_score = confidence * semantic_multiplier
        
        # 🖍️ Highlight spans per evidenziazione (posizioni relative al chunk)
        highlight_spans = []
        for match in keyword_matches:
            for pos in match['positions']:
                if pos < len(chunk_text):  # Verifica validità posizione
                    highlight_spans.append({
                        'start': pos,
                        'end': min(pos + len(match['word']), len(chunk_text)),
                        'type': 'keyword',
                        'word': match['word']
                    })
        
        return {
            'confidence': confidence,
            'semantic_score': semantic_score,
            'keyword_matches': keyword_matches,
            'highlight_spans': highlight_spans
        }
    
    def _assign_semantic_cluster(self, chunk_text, clusters):
        """
        🎨 Clustering semantico intelligente.
        """
        # Semplice clustering basato su argomenti chiave
        keywords = {
            'tecnico': ['tecnico', 'sistema', 'processo', 'metodo', 'algoritmo'],
            'business': ['costo', 'prezzo', 'business', 'commerciale', 'vendita'],
            'legale': ['legale', 'normativa', 'regolamento', 'privacy', 'gdpr'],
            'generale': []  # Default cluster
        }
        
        chunk_lower = chunk_text.lower()
        
        for cluster_name, cluster_keywords in keywords.items():
            if any(keyword in chunk_lower for keyword in cluster_keywords):
                cluster_id = hash(cluster_name) % 100  # ID numerico per cluster
                clusters[cluster_id] = cluster_name
                return cluster_id
        
        return 0  # Cluster generale
    
    def _find_chunk_position(self, chunk_text, full_text):
        """
        📍 Trova la posizione del chunk nel testo completo con ricerca intelligente.
        """
        try:
            # Ricerca diretta
            start_pos = full_text.find(chunk_text)
            if start_pos != -1:
                return {
                    'start': start_pos,
                    'end': start_pos + len(chunk_text)
                }
            
            # 🔍 Ricerca parziale se il chunk non è trovato esattamente
            # Prova con le prime e ultime parole del chunk
            chunk_words = chunk_text.strip().split()
            if len(chunk_words) >= 3:
                # Cerca usando le prime 3 parole
                first_words = ' '.join(chunk_words[:3])
                start_pos = full_text.find(first_words)
                if start_pos != -1:
                    return {
                        'start': start_pos,
                        'end': start_pos + len(chunk_text)
                    }
                
                # Cerca usando le ultime 3 parole
                last_words = ' '.join(chunk_words[-3:])
                end_pos = full_text.find(last_words)
                if end_pos != -1:
                    estimated_start = max(0, end_pos - len(chunk_text) + len(last_words))
                    return {
                        'start': estimated_start,
                        'end': estimated_start + len(chunk_text)
                    }
            
        except Exception as e:
            logger.warning(f"Errore nella ricerca posizione chunk: {e}")
        
        # Fallback: posizione non trovata
        return {'start': -1, 'end': -1}
    
    def _extract_context_snippet(self, chunk_text, full_text, context_length=200):
        """
        📝 Estrae snippet di contesto attorno al chunk.
        """
        try:
            start_pos = full_text.find(chunk_text)
            if start_pos != -1:
                context_start = max(0, start_pos - context_length)
                context_end = min(len(full_text), start_pos + len(chunk_text) + context_length)
                
                context = full_text[context_start:context_end]
                
                # Aggiungi indicatori se il contesto è troncato
                if context_start > 0:
                    context = "..." + context
                if context_end < len(full_text):
                    context = context + "..."
                
                return context
        except:
            pass
        
        return chunk_text[:context_length] + "..." if len(chunk_text) > context_length else chunk_text
    
    def _analyze_query_intent(self, query):
        """
        🎯 Analizza l'intento della query per ottimizzare la ricerca.
        """
        query_lower = query.lower()
        
        intent_patterns = {
            'definition': ['cos\'è', 'cosa è', 'definizione', 'significato', 'che cosa'],
            'comparison': ['differenza', 'confronto', 'versus', 'vs', 'migliore'],
            'procedure': ['come', 'procedura', 'passi', 'step', 'istruzioni'],
            'quantitative': ['quanto', 'prezzo', 'costo', 'numero', 'percentuale'],
            'temporal': ['quando', 'data', 'scadenza', 'tempo', 'periodo']
        }
        
        detected_intents = []
        for intent, patterns in intent_patterns.items():
            if any(pattern in query_lower for pattern in patterns):
                detected_intents.append(intent)
        
        return {
            'detected_intents': detected_intents,
            'primary_intent': detected_intents[0] if detected_intents else 'general',
            'query_complexity': 'complex' if len(query.split()) > 5 else 'simple',
            'contains_question_words': any(word in query_lower for word in ['chi', 'cosa', 'come', 'quando', 'dove', 'perché'])
        }
    
    def _enhanced_text_search(self, text, query):
        """
        🔄 Ricerca testuale potenziata con analisi intelligente.
        """
        query_lower = query.lower()
        query_words = query_lower.split()
        
        # 📚 Divide in frasi più intelligentemente
        import re
        sentences = re.split(r'[.!?]+', text)
        results = []
        
        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if len(sentence) < 20:  # Ignora frasi troppo corte
                continue
            
            sentence_lower = sentence.lower()
            
            # 🎯 Calcolo relevance avanzato
            word_matches = sum(1 for word in query_words if word in sentence_lower)
            phrase_match = query_lower in sentence_lower
            
            relevance = 0
            if phrase_match:
                relevance = 0.9  # Boost per match esatto
            elif word_matches > 0:
                relevance = min(0.8, word_matches * 0.2)  # Boost per parole matchate
            
            if relevance > 0:
                results.append({
                    'text': sentence,
                    'relevance': relevance,
                    'confidence': relevance * 0.9,  # Confidence leggermente inferiore
                    'chunk_index': i,
                    'start_position': text.find(sentence),
                    'end_position': text.find(sentence) + len(sentence),
                    'search_type': 'textual_enhanced',
                    'word_matches': word_matches,
                    'exact_phrase_match': phrase_match
                })
        
        # 🏆 Ordina per rilevanza
        results.sort(key=lambda x: x['relevance'], reverse=True)
        return results[:8]  # Top 8 risultati
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """
        Scarica il file PDF originale del documento.
        Supporta autenticazione tramite token nel query parameter per embedding in iframe.
        """
        try:
            # Autenticazione alternativa tramite query parameter per iframe
            token = request.GET.get('token')
            if token and not hasattr(request, 'user') or not request.user.is_authenticated:
                try:
                    from rest_framework_simplejwt.tokens import UntypedToken
                    from rest_framework_simplejwt.exceptions import InvalidToken
                    from django.contrib.auth.models import AnonymousUser
                    from users_api.models import User
                    
                    # Verifica token
                    UntypedToken(token)
                    # Decodifica token per ottenere user_id
                    import jwt
                    from django.conf import settings
                    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                    user_id = payload.get('user_id')
                    
                    if user_id:
                        request.user = User.objects.get(id=user_id)
                    else:
                        request.user = AnonymousUser()
                        
                except (InvalidToken, jwt.DecodeError, User.DoesNotExist):
                    return HttpResponse('Token non valido', status=401)
            
            document = self.get_object()
            
            # Verifica che il file esista
            if not document.file_path or not os.path.exists(document.file_path):
                return HttpResponse('File non trovato', status=404)
            
            # Verifica che sia un PDF
            if not document.file_type or not document.file_type.startswith('application/pdf'):
                return HttpResponse('Il file non è un PDF', status=400)
            
            # Determina il content type
            content_type = document.file_type or 'application/pdf'
            
            # Leggi il file
            try:
                with open(document.file_path, 'rb') as pdf_file:
                    response = HttpResponse(pdf_file.read(), content_type=content_type)
                    response['Content-Disposition'] = f'inline; filename="{document.original_filename}"'
                    response['Content-Length'] = document.file_size
                    
                    # Headers per supportare l'anteprima PDF nel browser
                    response['Accept-Ranges'] = 'bytes'
                    response['Cache-Control'] = 'private, max-age=3600'
                    
                    # Headers CORS per iframe
                    response['X-Frame-Options'] = 'SAMEORIGIN'
                    response['Access-Control-Allow-Origin'] = '*'
                    
                    return response
                    
            except Exception as e:
                logger.error(f"Errore nella lettura del file PDF {document.id}: {str(e)}")
                return HttpResponse('Errore nella lettura del file', status=500)
                
        except Exception as e:
            logger.error(f"Errore nel download del PDF: {str(e)}")
            return HttpResponse('Errore durante il download', status=500)

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
                # Per domande senza contesto rilevante nella KB, usa comunque l'AI
                context_empty = f'Nessun documento rilevante trovato nella knowledge base "{kb.name}" per questa domanda.'
                response_text = chat_view._generate_openai_response(context_empty, message, max_tokens)
                
                return Response({
                    'message': message,
                    'response': response_text,
                    'context_chunks': [],
                    'sources': [],
                    'knowledge_base': {
                        'id': kb.id,
                        'name': kb.name
                    },
                    'note': f'Risposta basata su conoscenza generale (nessun documento rilevante nella KB "{kb.name}")'
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
        🎯 RICHIEDE KNOWLEDGE BASE - NO CHAT GLOBALE
        """
        # Verifica che sia stata specificata una Knowledge Base
        if not serializer.validated_data.get('knowledge_base'):
            raise ValidationError({
                'knowledge_base': 'È obbligatorio specificare una Knowledge Base. La chat globale è stata eliminata.'
            })
        
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
                # 🎯 SOLO CHAT SPECIFICHE PER KB - NO CHAT GLOBALE
                if not session.knowledge_base:
                    return Response({
                        'error': 'Ogni chat deve essere associata a una Knowledge Base specifica. La chat globale è stata eliminata per migliorare la contestualizzazione.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Chat specifica per KB
                document_ids = list(session.knowledge_base.documents.filter(
                    status='processed',
                    embeddings_created=True
                ).values_list('id', flat=True))
                
                if not document_ids:
                    ai_response = f'Non ci sono documenti processati nella knowledge base "{session.knowledge_base.name}". Aggiungi e processa alcuni documenti per iniziare a chattare!'
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
                        # Usa l'AI anche senza contesto specifico dalla KB
                        context_empty = f'Nessun documento rilevante trovato nella knowledge base "{session.knowledge_base.name}" per questa domanda.'
                        ai_response = chat_view._generate_openai_response(context_empty, message_content, 1000)
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
        Restituisce le sessioni di chat dell'utente per Knowledge Base.
        🎯 SOLO CHAT SPECIFICHE PER KB - NO CHAT GLOBALE
        """
        try:
            # Solo sessioni associate a Knowledge Base
            kb_sessions = RAGChatSession.objects.filter(
                user_id=request.user.id,
                knowledge_base__isnull=False  # Solo sessioni con KB
            ).order_by('-last_activity')
            
            # Organizza per Knowledge Base
            kb_sessions_by_kb = {}
            for session in kb_sessions:
                kb_id = session.knowledge_base.id
                if kb_id not in kb_sessions_by_kb:
                    kb_sessions_by_kb[kb_id] = []
                kb_sessions_by_kb[kb_id].append(session)
            
            # Serializza le sessioni per ogni KB
            kb_data = []
            for kb_id, sessions in kb_sessions_by_kb.items():
                if sessions:  # Prendi la sessione più recente per ogni KB
                    recent_session = sessions[0]  # È già ordinata per -last_activity
                    kb_data.append(RAGChatSessionSerializer(recent_session).data)
            
            return Response({
                'kb_sessions': kb_data,
                'total_sessions': len(kb_data)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero sessioni chat: {str(e)}")
            return Response({
                'error': 'Errore nel recupero delle sessioni'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RAGEmbeddingInfoView(APIView):
    """
    View per ottenere informazioni sui modelli di embedding e consentire il cambio di provider.
    """
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Ottiene informazioni dettagliate sul sistema di embedding attualmente configurato.
        """
        try:
            embedding_manager = get_embedding_manager()
            info = embedding_manager.get_embedding_info()
            
            # Aggiungi statistiche sui documenti
            total_documents = RAGDocument.objects.filter(
                user_id=request.user.id,
                status='processed'
            ).count()
            
            documents_with_embeddings = RAGDocument.objects.filter(
                user_id=request.user.id,
                status='processed',
                embeddings_created=True
            ).count()
            
            info.update({
                'statistics': {
                    'total_processed_documents': total_documents,
                    'documents_with_embeddings': documents_with_embeddings,
                    'embedding_coverage': round(
                        (documents_with_embeddings / total_documents * 100) if total_documents > 0 else 0, 2
                    )
                },
                'available_providers': ['openai', 'sentence_transformers'],
                'available_openai_models': [
                    {
                        'name': 'text-embedding-3-small',
                        'description': 'Nuovo modello compatto e veloce (1536D)',
                        'dimensions': 1536,
                        'supports_custom_dimensions': True,
                        'recommended': True
                    },
                    {
                        'name': 'text-embedding-3-large',
                        'description': 'Nuovo modello ad alta performance (3072D)',
                        'dimensions': 3072,
                        'supports_custom_dimensions': True,
                        'premium': True
                    },
                    {
                        'name': 'text-embedding-ada-002',
                        'description': 'Modello legacy (1536D)',
                        'dimensions': 1536,
                        'supports_custom_dimensions': False,
                        'legacy': True
                    }
                ]
            })
            
            return Response(info, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero delle informazioni embedding: {str(e)}")
            return Response({
                'error': 'Errore nel recupero delle informazioni sui modelli di embedding'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """
        Cambia il provider di embedding a runtime.
        """
        try:
            provider = request.data.get('provider')
            if not provider:
                return Response({
                    'error': 'Provider richiesto'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if provider not in ['openai', 'sentence_transformers']:
                return Response({
                    'error': 'Provider non supportato. Utilizza "openai" o "sentence_transformers"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            embedding_manager = get_embedding_manager()
            success = embedding_manager.switch_provider(provider)
            
            if success:
                new_info = embedding_manager.get_embedding_info()
                return Response({
                    'message': f'Provider cambiato con successo a: {provider}',
                    'embedding_info': new_info
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': f'Impossibile cambiare provider a: {provider}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Errore nel cambio provider embedding: {str(e)}")
            return Response({
                'error': 'Errore nel cambio del provider di embedding'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RAGEmbeddingBenchmarkView(APIView):
    """
    View per testare e confrontare le performance dei diversi modelli di embedding.
    """
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Esegue un benchmark sui modelli di embedding disponibili.
        """
        try:
            test_text = request.data.get('test_text', 'Questo è un testo di prova per testare le performance dei modelli di embedding.')
            
            if len(test_text) > 1000:
                return Response({
                    'error': 'Testo di test troppo lungo (max 1000 caratteri)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            embedding_manager = get_embedding_manager()
            current_provider = embedding_manager.provider
            
            results = {}
            
            # Test OpenAI se disponibile
            try:
                if embedding_manager.switch_provider('openai'):
                    start_time = time.time()
                    openai_embedding = embedding_manager.get_embedding(test_text)
                    openai_time = time.time() - start_time
                    
                    results['openai'] = {
                        'success': True,
                        'dimensions': len(openai_embedding),
                        'processing_time': round(openai_time, 3),
                        'model_info': embedding_manager.get_embedding_info()
                    }
                else:
                    results['openai'] = {
                        'success': False,
                        'error': 'OpenAI non disponibile'
                    }
            except Exception as e:
                results['openai'] = {
                    'success': False,
                    'error': str(e)
                }
            
            # Test Sentence Transformers
            try:
                if embedding_manager.switch_provider('sentence_transformers'):
                    start_time = time.time()
                    st_embedding = embedding_manager.get_embedding(test_text)
                    st_time = time.time() - start_time
                    
                    results['sentence_transformers'] = {
                        'success': True,
                        'dimensions': len(st_embedding),
                        'processing_time': round(st_time, 3),
                        'model_info': embedding_manager.get_embedding_info()
                    }
                else:
                    results['sentence_transformers'] = {
                        'success': False,
                        'error': 'Sentence Transformers non disponibile'
                    }
            except Exception as e:
                results['sentence_transformers'] = {
                    'success': False,
                    'error': str(e)
                }
            
            # Ripristina il provider originale
            embedding_manager.switch_provider(current_provider)
            
            return Response({
                'test_text': test_text,
                'results': results,
                'current_provider': current_provider,
                'recommendation': self._get_provider_recommendation(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel benchmark embedding: {str(e)}")
            return Response({
                'error': 'Errore nell\'esecuzione del benchmark'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_provider_recommendation(self, results):
        """
        Fornisce una raccomandazione basata sui risultati del benchmark.
        """
        if results.get('openai', {}).get('success'):
            return {
                'provider': 'openai',
                'reason': 'OpenAI offre embeddings di alta qualità e dimensioni personalizzabili con i nuovi modelli'
            }
        elif results.get('sentence_transformers', {}).get('success'):
            return {
                'provider': 'sentence_transformers',
                'reason': 'Sentence Transformers è disponibile e funziona offline senza costi API'
            }
        else:
            return {
                'provider': None,
                'reason': 'Nessun provider disponibile'
            }

class RAGResourceManagerView(APIView):
    """
    View per interagire con il Resource Manager e ottenere risorse compatibili con RAG.
    """
    authentication_classes = [JWTCustomAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Ottiene l'elenco delle risorse compatibili con RAG dal Resource Manager.
        """
        from django.conf import settings
        import requests
        
        try:
            user_id = request.user.id if request.user.is_authenticated else None
            
            if not user_id:
                return Response({
                    'error': 'Utente non autenticato'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # Costanti per header interno
            INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
            INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE
            
            if not settings.RESOURCE_MANAGER_INTERNAL_URL or not INTERNAL_API_SECRET:
                return Response({
                    'error': 'Resource Manager non configurato'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            logger.info(f"Recupero risorse RAG-compatibili per utente {user_id}")
            
            # Chiama l'endpoint interno del Resource Manager
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/rag/resources/"
            internal_headers = {INTERNAL_API_HEADER: INTERNAL_API_SECRET}
            params = {
                'user_id': user_id,
                'status': 'COMPLETED',
                'limit': int(request.GET.get('limit', 50))
            }
            
            response = requests.get(resource_url, headers=internal_headers, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Aggiungi informazioni sui documenti già processati nel RAG
            resources = data.get('resources', [])
            for resource in resources:
                # Controlla se esiste già un documento RAG per questa risorsa
                existing_rag_doc = RAGDocument.objects.filter(
                    resource_id=resource['id'],
                    user_id=user_id
                ).first()
                
                if existing_rag_doc:
                    resource['rag_status'] = existing_rag_doc.status
                    resource['rag_document_id'] = existing_rag_doc.id
                    resource['rag_processed'] = existing_rag_doc.status == 'processed'
                else:
                    resource['rag_status'] = None
                    resource['rag_document_id'] = None
                    resource['rag_processed'] = False
            
            logger.info(f"Trovate {len(resources)} risorse RAG-compatibili per utente {user_id}")
            
            return Response({
                'count': data.get('count', len(resources)),
                'resources': resources,
                'compatible_types': data.get('compatible_types', [])
            }, status=status.HTTP_200_OK)
            
        except requests.exceptions.HTTPError as http_err:
            error_msg = f"HTTP error accessing Resource Manager: {http_err.response.status_code if http_err.response else 'N/A'}"
            if http_err.response:
                try:
                    error_data = http_err.response.json()
                    error_msg += f" - {error_data.get('error', 'Unknown error')}"
                except:
                    error_msg += f" - {http_err.response.text[:200]}"
            logger.error(error_msg)
            return Response({
                'error': 'Errore nella comunicazione con Resource Manager'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
        except requests.exceptions.RequestException as req_exc:
            error_msg = f"Request error accessing Resource Manager: {req_exc}"
            logger.error(error_msg)
            return Response({
                'error': 'Errore nella comunicazione con Resource Manager'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
        except Exception as e:
            logger.error(f"Unexpected error fetching RAG resources: {e}")
            return Response({
                'error': 'Errore interno'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
