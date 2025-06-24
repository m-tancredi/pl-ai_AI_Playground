import os
from pathlib import Path
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Sum
from rest_framework.renderers import BaseRenderer # <-- IMPORTA
import traceback   # <-- AGGIUNGI QUESTO IMPORT
from django.db import transaction # <-- AGGIUNGI QUESTO IMPORT
import magic # <-- AGGIUNGI QUESTO IMPORT
import json
import logging
import pandas as pd
from io import BytesIO

logger = logging.getLogger(__name__)
from rest_framework import viewsets, status, permissions, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated

from django.http import Http404, HttpResponse # Importa HttpResponse

from .models import Resource, Tag
from .serializers import ResourceSerializer, UploadRequestSerializer, UploadResponseSerializer, InternalSyntheticContentUploadSerializer, TagSerializer
from .authentication import JWTCustomAuthentication
from .tasks import process_uploaded_resource # Importa il task Celery
from .permissions import AllowInternalOnly # <-- Importa il nuovo permesso

class UploadView(views.APIView):
    """Gestisce l'upload iniziale dei file."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [MultiPartParser, FormParser] # Accetta upload file

    def post(self, request, *args, **kwargs):
        # 1. Validazione Input Base
        if 'file' not in request.FILES:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES['file']
        user_id = request.user.id

        # Validazione metadati opzionali dal form
        metadata_serializer = UploadRequestSerializer(data=request.data)
        metadata_serializer.is_valid() # Non solleva eccezione, controlla .validated_data
        user_provided_name = metadata_serializer.validated_data.get('name')
        user_provided_desc = metadata_serializer.validated_data.get('description')

        # 2. Crea Record Preliminare nel DB
        try:
            resource = Resource.objects.create(
                owner_id=user_id,
                original_filename=uploaded_file.name,
                name=user_provided_name or uploaded_file.name, # Usa nome fornito o nome file
                description=user_provided_desc or '',
                status=Resource.Status.PROCESSING,
                size=uploaded_file.size, # Salva dimensione iniziale
                # Il campo 'file' verrà popolato da Django durante il save() sotto
            )
            # Associa il file caricato all'istanza del modello.
            # Django gestirà il salvataggio nello storage corretto (FileSystem/S3)
            # e popolerà il campo 'file' con il path relativo.
            resource.file.save(uploaded_file.name, uploaded_file, save=True)

            print(f"Resource {resource.id} created, file saved to: {resource.file.name}")

            # 3. Invia Task Celery
            # Usiamo .delay() per inviare il task alla coda
            process_uploaded_resource.delay(resource.id)
            print(f"Dispatched Celery task for Resource ID: {resource.id}")

            # 4. Restituisci HTTP 202 Accepted
            response_serializer = UploadResponseSerializer(resource)
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
             print(f"Error during initial upload or task dispatch for file {uploaded_file.name}: {e}")
             # Se la risorsa è stata creata ma il task fallisce, potremmo volerla cancellare?
             # O impostare lo stato a FAILED qui? Dipende dalla logica desiderata.
             # if 'resource' in locals() and resource.pk: resource.delete()
             return Response({"error": "Failed to initiate resource processing."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResourceViewSet(viewsets.ModelViewSet): # <-- CAMBIA DA ReadOnlyModelViewSet a ModelViewSet
    """
    ViewSet per listare, recuperare, aggiornare (parzialmente) e cancellare
    le risorse utente.
    """
    serializer_class = ResourceSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    # Ora ModelViewSet rispetterà http_method_names se vuoi limitare,
    # ma di default include GET, POST, PUT, PATCH, DELETE. Limitiamoli.
    http_method_names = ['get', 'patch', 'delete', 'head', 'options'] # Permetti solo GET, PATCH, DELETE

    def get_queryset(self):
        """Filtra le immagini per l'utente autenticato."""
        user = self.request.user
        return Resource.objects.filter(owner_id=user.id).order_by('-created_at')

    # Le azioni retrieve, list, partial_update, destroy sono fornite da ModelViewSet.
    # Non c'è bisogno di implementarle manualmente a meno di override specifici.
    # La cancellazione del file avviene nel metodo .delete() del modello.
    # L'aggiornamento (PATCH) usa il ResourceSerializer per validare e salvare name/description.

    # Azione custom per il download (rimane uguale)
    @action(detail=True, methods=['get'], url_path='download')
    def download_file(self, request, pk=None):
        # ... (codice download invariato) ...
        resource = self.get_object()
        if resource.status != Resource.Status.COMPLETED:
             return Response({"error": f"Resource is not ready (status: {resource.status})."}, status=status.HTTP_409_CONFLICT)
        if not resource.file or not default_storage.exists(resource.file.name):
             raise Http404("Resource file not found in storage.")
        try:
            response = FileResponse(default_storage.open(resource.file.name, 'rb'), as_attachment=True, filename=resource.original_filename)
            if resource.mime_type: response['Content-Type'] = resource.mime_type
            try: response['Content-Length'] = default_storage.size(resource.file.name)
            except NotImplementedError: pass
            return response
        except Exception as e:
            print(f"Error serving file download for resource {pk}: {e}")
            return Response({"error": "Could not serve the file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PassthroughRenderer(BaseRenderer):
    """
    A custom renderer that does not actually render the data
    but returns it as is. Needed for binary file responses via APIView.
    """
    media_type = '*/*' # Accetta qualsiasi media type
    format = None # Nessun formato specifico
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Se i dati sono già bytes (come da HttpResponse), restituiscili
        if isinstance(data, bytes):
            return data
        # Se è un oggetto HttpResponse (come nel nostro caso), restituisci il suo contenuto
        if isinstance(data, HttpResponse):
             # Potremmo voler copiare gli header da HttpResponse a DRF Response?
             # Per ora, restituiamo solo il contenuto.
             return data.content
        # Altrimenti, non fare nulla (o solleva errore se non previsto)
        return data

class InternalContentView(views.APIView):
    """
    Endpoint INTERNO per ottenere il contenuto raw.
    Usa un renderer pass-through per evitare problemi di content negotiation.
    """
    permission_classes = [AllowInternalOnly] # <-- Deve usare il permesso corretto
    authentication_classes = [JWTCustomAuthentication]
    renderer_classes = [PassthroughRenderer] # <-- SPECIFICA IL RENDERER

    def get(self, request, resource_id, *args, **kwargs):
        resource = get_object_or_404(Resource, pk=resource_id)

        if resource.status != Resource.Status.COMPLETED:
            # Restituisci un errore DRF standard (verrà renderizzato come JSON se il client lo accetta)
            return Response({"error": f"Resource not processed (status: {resource.status})."},
                            status=status.HTTP_409_CONFLICT)

        if not resource.file or not default_storage.exists(resource.file.name):
             return Response({"error": "Resource file not found."},
                             status=status.HTTP_404_NOT_FOUND)

        try:
            with default_storage.open(resource.file.name, 'rb') as f:
                file_content = f.read()

            content_type = resource.mime_type or 'application/octet-stream'

            # --- Usa ANCORA HttpResponse per impostare Content-Type e Disposition ---
            # Il PassthroughRenderer estrarrà il contenuto da questo oggetto
            response = HttpResponse(file_content, content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{resource.original_filename}"'
            try: response['Content-Length'] = default_storage.size(resource.file.name)
            except NotImplementedError: pass

            # Restituisci l'oggetto HttpResponse. Il renderer lo gestirà.
            return response
            # --- FINE MODIFICA ---

        except Exception as e:
            print(f"Error serving internal content for resource {resource_id}: {e}")
            return Response({"error": "Could not serve file content."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserStorageInfoView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        # Calcola somma size per risorse completate dell'utente
        usage_agg = Resource.objects.filter(
            owner_id=user_id,
            status=Resource.Status.COMPLETED
        ).aggregate(total_size=Sum('size'))

        used_bytes = usage_agg.get('total_size') or 0

        # Limite - Per ora fisso, potrebbe venire da settings o profilo utente
        limit_bytes = 1 * 1024 * 1024 * 1024 # 1 GB

        data = {
            "storage_used": used_bytes,
            "storage_limit": limit_bytes,
        }
        return Response(data, status=status.HTTP_200_OK)
    
class AllowInternalOnlyWithSecret(permissions.BasePermission):
    """
    Permette accesso solo se un header segreto specifico è presente e corretto.
    """
    message = 'Invalid or missing internal access secret.'

    def has_permission(self, request, view):
        print("--- Internal Permission Check (Resource Manager) ---")
        # settings.INTERNAL_API_SECRET_HEADER_NAME e settings.INTERNAL_API_SECRET_VALUE
        # dovrebbero essere definiti nel settings.py del resource_manager_service
        # e letti dal suo file .env
        expected_secret_value = getattr(settings, 'INTERNAL_API_SECRET_VALUE', None)
        header_name_http = f"HTTP_{settings.INTERNAL_API_SECRET_HEADER_NAME.upper().replace('-', '_')}"
        provided_secret = request.META.get(header_name_http)

        print(f"  Expected Secret Value (is set): {bool(expected_secret_value)}")
        print(f"  Header Name Checked: {header_name_http}")
        print(f"  Provided Secret in Header: {' vorhanden' if provided_secret else 'NICHT vorhanden'}")

        if not expected_secret_value:
            print("  Internal secret not configured on this service. Denying access.")
            return False # Se il segreto non è configurato nel RM, nega per sicurezza
        
        is_allowed = provided_secret == expected_secret_value
        if not is_allowed:
            print(f"  Permission Denied. Provided: '{provided_secret}', Expected: '{expected_secret_value}' (comparison failed)")
        else:
            print("  Permission Granted.")
        return is_allowed

# ... (UploadView, ResourceViewSet, DownloadView, InternalContentView come prima) ...


class InternalSyntheticContentUploadView(views.APIView):
    """
    Endpoint interno per caricare contenuto CSV sintetico generato da altri servizi (es. DataAnalysisService).
    Questo endpoint salva il file e i metadati forniti direttamente, impostando lo stato a COMPLETED.
    """
    permission_classes = [AllowInternalOnlyWithSecret] # Proteggi questo endpoint
    authentication_classes = [] # Nessuna autenticazione utente JWT necessaria per chiamate interne server-to-server
    parser_classes = [MultiPartParser, FormParser] # Per ricevere FormData

    def post(self, request, *args, **kwargs):
        print("--- RM: InternalSyntheticContentUploadView Received Request ---")
        print(f"  request.data (form fields): {request.data}")
        print(f"  request.FILES (uploaded files): {request.FILES}")
        print("--- RM: End Received Request Data ---")

        # Serializer valida i campi non-file da request.data
        # e si aspetta 'file' in request.FILES
        serializer = InternalSyntheticContentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            print(f"  RM: Validation errors for InternalSyntheticContentUploadSerializer: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        uploaded_file = validated_data['file'] # Ottenuto da request.FILES grazie a FileField nel serializer
        owner_id = validated_data['owner_id']
        file_name = validated_data.get('name') or uploaded_file.name # Usa nome fornito o nome originale del file
        description = validated_data.get('description', '')
        metadata_json_str = validated_data.get('metadata_json')

        print(f"  Processing file: '{file_name}', Owner ID: {owner_id}, Description: '{description[:50]}...'")
        if metadata_json_str:
            print(f"  Received metadata_json (first 100 chars): {metadata_json_str[:100]}...")
        else:
            print("  No pre-analyzed metadata_json provided.")

        try:
            # Usare transaction.atomic per assicurare che la creazione del record
            # e il salvataggio del file siano atomici (o entrambi o nessuno).
            with transaction.atomic():
                resource = Resource(
                    owner_id=owner_id,
                    original_filename=file_name, # Per file sintetici, il nome fornito è l'originale
                    name=file_name, # L'utente può cambiarlo dopo se vuole
                    description=description,
                    status=Resource.Status.PROCESSING, # Inizia come PROCESSING, verrà aggiornato sotto
                    size=uploaded_file.size
                )
                # Il metodo save di FileField gestisce il salvataggio effettivo del file
                # usando la funzione `user_resource_path` definita nel modello.
                # `save=False` qui perché salveremo l'istanza completa dopo.
                resource.file.save(file_name, uploaded_file, save=False)
                print(f"  File '{resource.file.name}' (size: {resource.size}) prepared for saving to storage.")

                # 1. Determinazione MIME Type (anche se ci aspettiamo CSV)
                try:
                    # Leggi i primi bytes del file per la rilevazione MIME
                    # Non possiamo usare default_storage.path() prima che il file sia committato
                    # quindi leggiamo direttamente da uploaded_file (InMemoryUploadedFile o TemporaryUploadedFile)
                    uploaded_file.seek(0) # Assicura di leggere dall'inizio
                    buffer = uploaded_file.read(2048) # Leggi i primi 2KB
                    uploaded_file.seek(0) # Riporta il puntatore all'inizio per il salvataggio successivo
                    resource.mime_type = magic.from_buffer(buffer, mime=True)
                    print(f"    Detected MIME type (sync): {resource.mime_type}")
                except Exception as mime_exc:
                    print(f"    Warning: MIME detection failed (sync): {mime_exc}. Defaulting to 'text/csv'.")
                    resource.mime_type = 'text/csv' # Sicuro default per questo endpoint

                # 2. Popolamento Metadati
                final_metadata = {}
                if metadata_json_str:
                    try:
                        pre_analyzed_metadata = json.loads(metadata_json_str)
                        # Applica direttamente i metadati forniti
                        final_metadata = pre_analyzed_metadata
                        print(f"    Applied pre-analyzed metadata. Potential uses: {final_metadata.get('potential_uses')}")
                    except json.JSONDecodeError:
                        print(f"    Warning: Could not parse provided metadata_json: {metadata_json_str}")
                        # Fallback a estrazione header base se metadata_json fallisce
                        if resource.mime_type == 'text/csv':
                            try:
                                uploaded_file.seek(0)
                                df_preview = pd.read_csv(BytesIO(uploaded_file.read()), nrows=0)
                                final_metadata['headers'] = list(df_preview.columns)
                                print(f"    Fallback: Extracted CSV headers: {final_metadata['headers']}")
                                uploaded_file.seek(0)
                            except Exception as csv_exc:
                                print(f"    Fallback: CSV header extraction failed: {csv_exc}")
                                final_metadata['headers'] = []
                elif resource.mime_type == 'text/csv': # Se non ci sono metadata_json, prova a estrarre almeno gli header
                     try:
                        uploaded_file.seek(0)
                        df_preview = pd.read_csv(BytesIO(uploaded_file.read()), nrows=0)
                        final_metadata['headers'] = list(df_preview.columns)
                        print(f"    No pre-analyzed metadata, extracted CSV headers: {final_metadata['headers']}")
                        uploaded_file.seek(0)
                     except Exception as csv_exc:
                         print(f"    No pre-analyzed metadata, CSV header extraction failed: {csv_exc}")
                         final_metadata['headers'] = []

                resource.metadata = final_metadata
                resource.status = Resource.Status.COMPLETED # File e metadati base sono pronti
                
                # Salva l'istanza del modello, che ora committerà anche il file allo storage
                resource.save()
            
            print(f"  Resource {resource.id} created and set to COMPLETED. Path: {resource.file.name}")
            response_serializer = ResourceSerializer(resource, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"  Error in InternalSyntheticContentUploadView during resource creation or saving: {e}")
            traceback.print_exc()
            return Response({"error": f"Failed to create synthetic resource: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class InternalRagResourcesView(views.APIView):
    """
    Endpoint INTERNO per ottenere l'elenco delle risorse compatibili con RAG.
    Filtra solo documenti adatti al RAG (PDF, TXT, DOCX, MD, RTF, etc. - NO CSV, immagini, video).
    Ora include anche filtro per tag "RAG".
    """
    permission_classes = [AllowInternalOnlyWithSecret]
    authentication_classes = []  # Nessuna autenticazione utente JWT per chiamate interne
    
    # Tipi MIME compatibili con RAG
    RAG_COMPATIBLE_MIME_TYPES = {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # DOCX
        'application/msword',  # DOC
        'text/plain',  # TXT
        'text/markdown',  # MD
        'text/rtf',  # RTF
        'application/rtf',  # RTF (alternativo)
        'text/x-markdown',  # MD (alternativo)
    }
    
    def get(self, request):
        """
        Ottiene le risorse compatibili con RAG, filtrate per tag "RAG" se esiste.
        """
        try:
            # Parametri di query opzionali
            user_id = request.GET.get('user_id')  # Filtra per utente specifico
            limit = request.GET.get('limit', 50)
            
            # Query base: solo documenti compatibili con RAG
            queryset = Resource.objects.filter(
                status='COMPLETED',
                mime_type__in=self.RAG_COMPATIBLE_MIME_TYPES
            ).prefetch_related('tags').select_related().order_by('-created_at')
            
            # Filtra per tag "RAG" se esiste
            rag_tag_exists = Tag.objects.filter(name__iexact='RAG').exists()
            if rag_tag_exists:
                queryset = queryset.filter(tags__name__iexact='RAG').distinct()
            
            # Filtra per utente se specificato
            if user_id:
                queryset = queryset.filter(owner_id=user_id)
            
            # Limita i risultati
            try:
                limit = min(int(limit), 100)  # Max 100 documenti
            except (ValueError, TypeError):
                limit = 50
            
            resources = queryset[:limit]
            
            # Serializza i dati
            serializer = ResourceSerializer(resources, many=True, context={'request': request})
            
            return Response({
                'status': 'success',
                'count': len(serializer.data),
                'has_rag_tag': rag_tag_exists,
                'filter_applied': 'RAG tag + RAG-compatible MIME types' if rag_tag_exists else 'RAG-compatible MIME types only',
                'resources': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero risorse RAG: {str(e)}")
            return Response({
                'error': 'Errore interno del server',
                'details': str(e) if settings.DEBUG else 'Dettagli non disponibili'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TagViewSet(viewsets.ModelViewSet):
    """
    ViewSet per gestire i tag delle risorse.
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    
    def get_queryset(self):
        """
        Restituisce tutti i tag disponibili.
        """
        return Tag.objects.all().order_by('name')

class ResourceTagsUpdateView(views.APIView):
    """
    Endpoint per aggiornare i tag di una risorsa specifica.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    
    def patch(self, request, resource_id):
        """
        Aggiorna i tag di una risorsa.
        """
        try:
            # Recupera la risorsa
            resource = get_object_or_404(Resource, id=resource_id, owner_id=request.user.id)
            
            # Valida i tag_ids
            tag_ids = request.data.get('tag_ids', [])
            if not isinstance(tag_ids, list):
                return Response({
                    'error': 'tag_ids deve essere una lista'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verifica che tutti i tag esistano
            existing_tags = Tag.objects.filter(id__in=tag_ids)
            if len(existing_tags) != len(tag_ids):
                return Response({
                    'error': 'Alcuni tag specificati non esistono'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Aggiorna i tag
            resource.tags.set(tag_ids)
            
            # Restituisci la risorsa aggiornata
            serializer = ResourceSerializer(resource, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nell'aggiornamento tag risorsa {resource_id}: {str(e)}")
            return Response({
                'error': 'Errore interno del server'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class InternalRagContentView(views.APIView):
    """
    Endpoint INTERNO per ottenere il contenuto di una risorsa compatibile con RAG.
    Verifica che la risorsa sia adatta al RAG prima di servirla.
    """
    permission_classes = [AllowInternalOnlyWithSecret]
    authentication_classes = []
    renderer_classes = [PassthroughRenderer]
    
    # Stessi tipi MIME della vista precedente
    RAG_COMPATIBLE_MIME_TYPES = {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/markdown',
        'text/rtf',
        'application/rtf',
        'text/x-markdown',
    }
    
    def get(self, request, resource_id, *args, **kwargs):
        """
        Restituisce il contenuto di una risorsa se è compatibile con RAG.
        """
        logger.info(f"--- RM: InternalRagContentView for resource_id: {resource_id} ---")
        
        resource = get_object_or_404(Resource, pk=resource_id)
        
        # Verifica che la risorsa sia completata
        if resource.status != Resource.Status.COMPLETED:
            return Response({
                "error": f"Resource not processed (status: {resource.status})."
            }, status=status.HTTP_409_CONFLICT)
        
        # Verifica che sia compatibile con RAG
        if resource.mime_type not in self.RAG_COMPATIBLE_MIME_TYPES:
            return Response({
            "error": f"Resource type '{resource.mime_type}' is not compatible with RAG. Compatible types: {list(self.RAG_COMPATIBLE_MIME_TYPES)}"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verifica che il file esista
        if not resource.file or not default_storage.exists(resource.file.name):
            return Response({
            "error": "Resource file not found."
        }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            logger.info(f"  Serving RAG-compatible file: {resource.original_filename} ({resource.mime_type})")
            
            with default_storage.open(resource.file.name, 'rb') as f:
                file_content = f.read()
            
            content_type = resource.mime_type or 'application/octet-stream'
            
            # Usa HttpResponse per impostare Content-Type e Disposition
            response = HttpResponse(file_content, content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{resource.original_filename}"'
            
            try:
                response['Content-Length'] = default_storage.size(resource.file.name)
            except NotImplementedError:
                pass
            
            return response
            
        except Exception as e:
            logger.error(f"  Error serving RAG content for resource {resource_id}: {e}")
            return Response({
                "error": "Could not serve file content."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)