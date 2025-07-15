from rest_framework import serializers
from .models import Resource, Tag # Importa i modelli aggiornati

class TagSerializer(serializers.ModelSerializer):
    """Serializer per il modello Tag."""
    
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

class ResourceSerializer(serializers.ModelSerializer):
    """Serializer per il modello Resource."""
    owner_id = serializers.IntegerField(read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, style={'base_template': 'textarea.html'})
    # Rendi metadata leggibile
    metadata = serializers.JSONField(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="Lista di ID dei tag da associare alla risorsa"
    )

    class Meta:
        model = Resource
        fields = [
            'id', 'owner_id', 'name', 'description', 'original_filename',
            'status', 'mime_type', 'size', 'metadata', # Aggiunto metadata
            'error_message', 'file_url', 'thumbnail_url',
            'tags', 'tag_ids',  # Campi per i tag
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'owner_id', 'original_filename', 'status', 'mime_type',
            'size', 'metadata', # Metadata è read-only
            'error_message', 'file_url', 'thumbnail_url',
            'created_at', 'updated_at',
        ]

    def update(self, instance, validated_data):
        """Override update per gestire i tag."""
        tag_ids = validated_data.pop('tag_ids', None)
        
        # Aggiorna i campi normali
        instance = super().update(instance, validated_data)
        
        # Gestisci i tag se forniti
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        
        return instance

    def get_file_url(self, obj):
        request = self.context.get('request')
        # Verifica che il file esista prima di generare l'URL
        if obj.file and hasattr(obj.file, 'url') and request:
            try: 
                # Debug temporaneo
                print(f"DEBUG: request.is_secure() = {request.is_secure()}")
                print(f"DEBUG: request.META.get('HTTP_X_FORWARDED_PROTO') = {request.META.get('HTTP_X_FORWARDED_PROTO')}")
                print(f"DEBUG: request.get_host() = {request.get_host()}")
                
                absolute_url = request.build_absolute_uri(obj.file.url)
                print(f"DEBUG: Generated URL = {absolute_url}")
                return absolute_url
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
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Lista di ID dei tag da associare alla risorsa"
    )

# Serializer per la risposta dopo l'upload iniziale
class UploadResponseSerializer(serializers.ModelSerializer):
    """Mostra i dati iniziali della risorsa dopo l'upload."""
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Resource
        fields = ['id', 'owner_id', 'original_filename', 'status', 'created_at', 'name', 'description', 'size', 'tags'] # Aggiunto size e tags
        read_only_fields = fields


# --- NUOVO SERIALIZER PER UPLOAD INTERNO DI CONTENUTO SINTETICO ---
class InternalSyntheticContentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True, help_text="Il file CSV generato da caricare.")
    name = serializers.CharField(max_length=255, required=False, help_text="Nome del file suggerito.")
    description = serializers.CharField(required=False, allow_blank=True, help_text="Descrizione opzionale.")
    owner_id = serializers.IntegerField(required=True, help_text="ID dell'utente proprietario.")
    metadata_json = serializers.CharField(required=False, allow_blank=True, help_text="JSON string of pre-analyzed metadata (headers, potential_uses, etc.)")
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Lista di ID dei tag da associare alla risorsa"
    )
    # Potremmo aggiungere altri metadati che il data_analysis_service conosce già
    # come potential_uses, num_rows, num_cols, headers per evitare che
    # il Resource Manager debba ri-processare (ma questo richiederebbe più logica qui)