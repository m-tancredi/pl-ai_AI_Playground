import os
from pathlib import Path
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Sum
from rest_framework.renderers import BaseRenderer # <-- IMPORTA

from rest_framework import viewsets, status, permissions, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from django.http import Http404, HttpResponse # Importa HttpResponse

from .models import Resource
from .serializers import ResourceSerializer, UploadRequestSerializer, UploadResponseSerializer
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