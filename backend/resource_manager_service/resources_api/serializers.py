from rest_framework import serializers
from .models import Resource

class ResourceSerializer(serializers.ModelSerializer):
    """Serializer per il modello Resource."""
    # Rendi owner_id leggibile
    owner_id = serializers.IntegerField(read_only=True)
    # Costruisci URL completi per file e thumbnail
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    # Permetti modifica di name e description
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, style={'base_template': 'textarea.html'})

    class Meta:
        model = Resource
        fields = [
            'id', 'owner_id', 'name', 'description', 'original_filename',
            'status', 'mime_type', 'size', 'metadata', 'error_message',
            'file_url', 'thumbnail_url', 'created_at', 'updated_at',
            # Escludi 'file' e 'thumbnail' (campi FileField diretti)
        ]
        read_only_fields = [
            'id', 'owner_id', 'original_filename', 'status', 'mime_type',
            'size', 'metadata', 'error_message', 'file_url', 'thumbnail_url',
            'created_at', 'updated_at',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url') and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and hasattr(obj.thumbnail, 'url') and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

# Serializer specifico per la richiesta di Upload (solo metadati opzionali)
class UploadRequestSerializer(serializers.Serializer):
    # Il file viene gestito come request.FILES, non qui
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    # Altri metadati iniziali che l'utente potrebbe fornire?

# Serializer per la risposta dopo l'upload iniziale (stato PROCESSING)
class UploadResponseSerializer(serializers.ModelSerializer):
    """Mostra i dati iniziali della risorsa dopo l'upload."""
    class Meta:
        model = Resource
        fields = ['id', 'owner_id', 'original_filename', 'status', 'created_at', 'name', 'description']
        read_only_fields = fields