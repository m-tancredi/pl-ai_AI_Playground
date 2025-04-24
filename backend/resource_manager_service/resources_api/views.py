import os
from pathlib import Path
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.conf import settings
from django.core.files.storage import default_storage

from rest_framework import viewsets, status, permissions, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Resource
from .serializers import ResourceSerializer, UploadRequestSerializer, UploadResponseSerializer
from .authentication import JWTCustomAuthentication
from .tasks import process_uploaded_resource # Importa il task Celery

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

# --- Vista Interna (Esempio, da proteggere ulteriormente se necessario) ---
class InternalContentView(views.APIView):
    """
    Endpoint INTERNO per altri microservizi per ottenere il contenuto raw.
    Richiede meccanismi di autenticazione/autorizzazione interni (es. API key, IP check).
    PER ORA, usa la stessa autenticazione JWT per semplicità, ma NON è ideale.
    """
    permission_classes = [permissions.IsAuthenticated] # SOLO PER TEST INIZIALE
    authentication_classes = [JWTCustomAuthentication]

    def get(self, request, resource_id, *args, **kwargs):
        # NON filtrare per utente qui, assume che il servizio chiamante sia autorizzato
        resource = get_object_or_404(Resource, pk=resource_id)

        if resource.status != Resource.Status.COMPLETED:
            return Response({"error": "Resource not processed."}, status=status.HTTP_409_CONFLICT)

        if not resource.file or not default_storage.exists(resource.file.name):
             raise Http404("Resource file not found.")

        try:
            response = FileResponse(default_storage.open(resource.file.name, 'rb'))
            if resource.mime_type: response['Content-Type'] = resource.mime_type
            try: response['Content-Length'] = default_storage.size(resource.file.name)
            except NotImplementedError: pass
            return response
        except Exception as e:
            print(f"Error serving internal content for resource {resource_id}: {e}")
            return Response({"error": "Could not serve file content."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)