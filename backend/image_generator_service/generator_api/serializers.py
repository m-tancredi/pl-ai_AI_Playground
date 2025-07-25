# pl-ai/backend/image_generator_service/generator_api/serializers.py

from rest_framework import serializers
# Importa il modello solo se viene usato (es. per ModelSerializer)
from .models import GeneratedImage

# --- Serializers per Text-to-Image ---
class TextToImageRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta text-to-image."""
    prompt = serializers.CharField(required=True, max_length=1000)
    model = serializers.ChoiceField(choices=['dalle', 'stability'], required=True)
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    aspect_ratio = serializers.ChoiceField(
        choices=['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
        required=False,
        default='1:1'
    )
    # high_quality = serializers.BooleanField(required=False, default=False) # Opzionale

class ImageResponseSerializer(serializers.Serializer):
    """Serializer per formattare la risposta dopo la generazione di un'immagine."""
    image_url = serializers.CharField(read_only=True, help_text="URL locale temporaneo o URL persistente")
    prompt_used = serializers.CharField(read_only=True)
    model_used = serializers.CharField(read_only=True)

# --- Serializers per Image-to-Image ---
# Nota: Non usiamo un serializer DRF standard per deserializzare richieste multipart/form-data
# La validazione avviene nella view, ma questo serve come documentazione dei campi attesi.
class ImageToImageRequestDataDoc(serializers.Serializer):
    prompt = serializers.CharField(required=True, max_length=1000)
    image = serializers.ImageField(required=True, help_text="File immagine iniziale")
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    image_strength = serializers.FloatField(required=False, min_value=0.0, max_value=1.0, default=0.35)

# --- Serializers per Prompt Enhancement ---
class PromptEnhanceRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta di miglioramento prompt."""
    prompt = serializers.CharField(required=True, max_length=500)

class PromptEnhanceResponseSerializer(serializers.Serializer):
    """Serializer per formattare la risposta del miglioramento prompt."""
    original_prompt = serializers.CharField(read_only=True)
    enhanced_prompt = serializers.CharField(read_only=True)

# --- Serializers per Salvataggio Immagine ---
class ImageSaveRequestSerializer(serializers.Serializer):
    """Serializer per validare l'input della richiesta di salvataggio immagine."""
    image_url = serializers.CharField(required=True, help_text="Temporary local URL (relative to MEDIA_URL) of the image to save")
    prompt = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, allow_blank=True)
    style = serializers.CharField(required=False, allow_blank=True, allow_null=True)  # <-- Aggiungi allow_null=True
    name = serializers.CharField(required=False, allow_blank=True, max_length=255, help_text="Optional name for the saved image")
    description = serializers.CharField(required=False, allow_blank=True, help_text="Optional description for the saved image")


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
        """Costruisce l'URL assoluto per il file immagine."""
        request = self.context.get('request')
        if obj.image_file and hasattr(obj.image_file, 'url') and request:
            try:
                return request.build_absolute_uri(obj.image_file.url)
            except:
                 if hasattr(obj.image_file, 'url'):
                     return obj.image_file.url
                 else:
                     return None
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
