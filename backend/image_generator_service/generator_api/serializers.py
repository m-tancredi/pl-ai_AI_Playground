# pl-ai/backend/image_generator_service/generator_api/serializers.py

from rest_framework import serializers
# Importa il modello solo se viene usato (es. per ModelSerializer)
from .models import GeneratedImage

# --- Serializers per Text-to-Image ---
class TextToImageRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta text-to-image."""
    prompt = serializers.CharField(required=True, max_length=1000)
    model = serializers.ChoiceField(
        choices=[
            'dalle-2', 'dalle-3', 'dalle-3-hd', 'gpt-image-1', 'stability'
        ], 
        required=True
    )
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    aspect_ratio = serializers.ChoiceField(
        choices=['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
        required=False,
        default='1:1'
    )
    quality = serializers.ChoiceField(
        choices=['standard', 'hd'],
        required=False,
        default='standard',
        help_text="Quality level for DALL-E models (standard/hd)"
    )
    # high_quality = serializers.BooleanField(required=False, default=False) # Opzionale

class ImageResponseSerializer(serializers.Serializer):
    """Serializer per formattare la risposta dopo la generazione di un'immagine."""
    image_url = serializers.CharField(read_only=True, help_text="URL locale temporaneo o URL persistente")
    prompt_used = serializers.CharField(read_only=True)
    model_used = serializers.CharField(read_only=True)
    quality_used = serializers.CharField(read_only=True, required=False)

# --- Serializers per Image-to-Image ---
# Nota: Non usiamo un serializer DRF standard per deserializzare richieste multipart/form-data
# La validazione avviene nella view, ma questo serve come documentazione dei campi attesi.
class ImageToImageRequestDataDoc(serializers.Serializer):
    prompt = serializers.CharField(required=True, max_length=1000)
    image = serializers.ImageField(required=True, help_text="File immagine iniziale")
    model = serializers.ChoiceField(
        choices=[
            'dalle-2', 'gpt-image-1', 'stability'
        ], 
        required=False,
        default='gpt-image-1',
        help_text="Modelli supportati per image-to-image editing"
    )
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    quality = serializers.ChoiceField(
        choices=['standard', 'hd'],
        required=False,
        default='standard',
        help_text="Quality level for DALL-E models (standard/hd)"
    )
    image_strength = serializers.FloatField(required=False, min_value=0.0, max_value=1.0, default=0.35, help_text="For Stability AI only")

# --- Serializers per Prompt Enhancement ---
class PromptEnhanceRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta di miglioramento prompt."""
    prompt = serializers.CharField(required=True, max_length=500)

class PromptEnhanceResponseSerializer(serializers.Serializer):
    """Serializer per formattare la risposta del miglioramento prompt."""
    original_prompt = serializers.CharField(read_only=True)
    enhanced_prompt = serializers.CharField(read_only=True)

# --- Serializers per Usage Tracking ---
class UsageRecordSerializer(serializers.Serializer):
    """Serializer per un singolo record di consumo."""
    id = serializers.IntegerField(read_only=True)
    operation_type = serializers.CharField()
    model_used = serializers.CharField()
    prompt = serializers.CharField()
    quality = serializers.CharField()
    aspect_ratio = serializers.CharField()
    tokens_consumed = serializers.IntegerField()
    cost_usd = serializers.DecimalField(max_digits=10, decimal_places=6)
    cost_eur = serializers.DecimalField(max_digits=10, decimal_places=6)
    success = serializers.BooleanField()
    response_time_ms = serializers.IntegerField()
    created_at = serializers.DateTimeField()

class UsageSummarySerializer(serializers.Serializer):
    """Serializer per il riassunto dei consumi."""
    total_tokens = serializers.IntegerField()
    total_cost_usd = serializers.DecimalField(max_digits=10, decimal_places=6)
    total_cost_eur = serializers.DecimalField(max_digits=10, decimal_places=6)
    total_calls = serializers.IntegerField()
    by_model = serializers.ListSerializer(child=serializers.DictField())
    by_operation = serializers.ListSerializer(child=serializers.DictField())

class UsageResponseSerializer(serializers.Serializer):
    """Serializer per la risposta completa dell'API di consumo."""
    summary = UsageSummarySerializer()
    recent_records = serializers.ListSerializer(child=UsageRecordSerializer())
    period = serializers.CharField()
    user_id = serializers.IntegerField()

# --- Serializers per Salvataggio Immagine ---
class ImageSaveRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta di salvataggio immagine."""
    image_url = serializers.CharField(required=True, help_text="Temporary local URL (relative to MEDIA_URL) of the image to save")
    prompt = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, allow_blank=True)
    quality = serializers.CharField(required=False, allow_blank=True)


class ImageSaveResponseSerializer(serializers.ModelSerializer):
    """Serializer per la risposta dopo aver salvato un'immagine (usa il modello)."""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedImage
        # Lista completa dei campi da includere nella risposta
        fields = [
            'id', 'owner_id', 'name', 'description', 'prompt',
            'style', 'model_used', 'image_url', 'width', 'height', 'created_at'
        ]
        read_only_fields = fields # Tutti i campi sono letti dal modello appena creato/salvato

    def get_image_url(self, obj):
        """Costruisce l'URL relativo per il file immagine."""
        if obj.image_file and hasattr(obj.image_file, 'url'):
            return obj.image_file.url  # Restituisci sempre URL relativo /media/...
        return None

# --- Serializer per la Galleria (CRUD su GeneratedImage) ---
class GeneratedImageSerializer(serializers.ModelSerializer):
    """Serializer per listare, recuperare e aggiornare le immagini salvate."""
    image_url = serializers.SerializerMethodField()
    # Rendi owner_id leggibile ma non modificabile tramite l'API
    owner_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = GeneratedImage
        fields = [
            'id', 'owner_id', 'name', 'description', 'prompt',
            'style', 'model_used', 'image_url', 'width', 'height', 'created_at'
        ]
        # Definisci quali campi sono read-only per le operazioni di retrieve/list
        # e quali possono essere aggiornati (es. con PATCH)
        read_only_fields = [
            'id', 'owner_id', 'prompt', 'style', 'model_used',
            'image_url', 'width', 'height', 'created_at'
        ]
        # I campi 'name' e 'description' possono essere aggiornati

    def get_image_url(self, obj):
        """Costruisce l'URL assoluto per il file immagine."""
        request = self.context.get('request')
        if obj.image_file and hasattr(obj.image_file, 'url'):
                return obj.image_file.url # Restituisci solo /media/...
        return None
