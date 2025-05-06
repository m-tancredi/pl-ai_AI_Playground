from rest_framework import serializers
from .models import Resource # Importa il modello aggiornato

class ResourceSerializer(serializers.ModelSerializer):
    """Serializer per il modello Resource."""
    owner_id = serializers.IntegerField(read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, style={'base_template': 'textarea.html'})
    # Rendi metadata leggibile
    metadata = serializers.JSONField(read_only=True)

    class Meta:
        model = Resource
        fields = [
            'id', 'owner_id', 'name', 'description', 'original_filename',
            'status', 'mime_type', 'size', 'metadata', # Aggiunto metadata
            'error_message', 'file_url', 'thumbnail_url',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'owner_id', 'original_filename', 'status', 'mime_type',
            'size', 'metadata', # Metadata è read-only
            'error_message', 'file_url', 'thumbnail_url',
            'created_at', 'updated_at',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        # Verifica che il file esista prima di generare l'URL
        if obj.file and hasattr(obj.file, 'url') and request:
            try: return request.build_absolute_uri(obj.file.url)
            except: return obj.file.url if hasattr(obj.file, 'url') else None
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and hasattr(obj.thumbnail, 'url') and request:
             try: return request.build_absolute_uri(obj.thumbnail.url)
             except: return obj.thumbnail.url if hasattr(obj.thumbnail, 'url') else None
        return None

# Serializer specifico per la richiesta di Upload
class UploadRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

# Serializer per la risposta dopo l'upload iniziale
class UploadResponseSerializer(serializers.ModelSerializer):
    """Mostra i dati iniziali della risorsa dopo l'upload."""
    # Non c'è bisogno di campi extra qui, prende quelli dal modello base
    class Meta:
        model = Resource
        fields = ['id', 'owner_id', 'original_filename', 'status', 'created_at', 'name', 'description', 'size'] # Aggiunto size
        read_only_fields = fields