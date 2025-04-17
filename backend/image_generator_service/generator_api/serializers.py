from rest_framework import serializers

# --- Serializers per Text-to-Image ---
class TextToImageRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True, max_length=1000)
    model = serializers.ChoiceField(choices=['dalle', 'stability'], required=True)
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    # DALL-E usa 'size', Stability 'aspect_ratio' - gestiamo aspect_ratio come input comune
    aspect_ratio = serializers.ChoiceField(choices=['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], required=False, default='1:1')
    # high_quality = serializers.BooleanField(required=False, default=False) # Meno comune, opzionale

class ImageResponseSerializer(serializers.Serializer):
    image_url = serializers.CharField(read_only=True) # URL locale temporaneo
    prompt_used = serializers.CharField(read_only=True)
    model_used = serializers.CharField(read_only=True)

# --- Serializers per Image-to-Image ---
class ImageToImageRequestSerializer(serializers.Serializer):
    # Non possiamo usare Serializer per multipart, la validazione avverrà nella view
    # Ma definiamo i campi attesi per documentazione/possibile validazione parziale
    prompt = serializers.CharField(required=True, max_length=1000)
    image = serializers.ImageField(required=True) # Campo file immagine
    style = serializers.CharField(required=False, allow_blank=True, max_length=100)
    aspect_ratio = serializers.ChoiceField(choices=['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], required=False) # Stability può derivarlo dall'immagine
    image_strength = serializers.FloatField(required=False, min_value=0.0, max_value=1.0, default=0.35)
    # model è implicito (stability)

# --- Serializers per Prompt Enhancement ---
class PromptEnhanceRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True, max_length=500)

class PromptEnhanceResponseSerializer(serializers.Serializer):
    original_prompt = serializers.CharField(read_only=True)
    enhanced_prompt = serializers.CharField(read_only=True)

# --- Serializers per Salvataggio Immagine ---
class ImageSaveRequestSerializer(serializers.Serializer):
    image_url = serializers.CharField(required=True, help_text="Temporary local URL of the image to save")
    prompt = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, allow_blank=True)
    style = serializers.CharField(required=False, allow_blank=True)
    # Aggiungere altri metadati se si implementa un DB

class ImageSaveResponseSerializer(serializers.Serializer):
    saved_url = serializers.CharField(read_only=True) # URL persistente
    message = serializers.CharField(read_only=True)