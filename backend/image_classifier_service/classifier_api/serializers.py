import base64
from rest_framework import serializers
from .models import TrainedModel
import uuid # <-- AGGIUNGI QUESTO IMPORT
from django.core.files.base import ContentFile

MIN_CLASSES = 2
MIN_IMAGES_PER_CLASS = 10
# --- Serializers per Training ---

class Base64ImageField(serializers.Field):
    def to_internal_value(self, data):
        # Aggiungi un log per vedere l'input
        # ATTENZIONE: Questo stamperà l'intera stringa base64! Rimuovi dopo debug.
        # print(f"--- Base64ImageField processing input starting with: {str(data)[:80]}...")

        if not isinstance(data, str):
            raise serializers.ValidationError("Input must be a base64 encoded string.")
        try:
            if not data.startswith('data:image'):
                raise ValueError("String is not a valid data URL (missing 'data:image' prefix).")

            header, imgstr = data.split(';base64,', 1)
            mime_type = header.split(':')[1]
            if not mime_type or not mime_type.startswith('image/'):
                 raise ValueError(f"Invalid image MIME type found: {mime_type}")
            ext = mime_type.split('/')[-1].lower() # Metti in minuscolo per confronto
            if ext not in ['jpeg', 'jpg', 'png', 'gif', 'webp']:
                 # Considera di essere meno restrittivo o solo warning
                 # raise serializers.ValidationError(f"Unsupported image extension: {ext}")
                 print(f"Warning: Potentially unsupported image extension '{ext}' received.")
                 # Usa 'bin' come estensione generica se non supportata?
                 # ext = 'bin'

            file_name = f"{uuid.uuid4()}.{ext}"

            # Log prima della decodifica
            # print(f"   Attempting to decode base64 string (length: {len(imgstr)})...")
            decoded_bytes = base64.b64decode(imgstr)
            # Log dopo la decodifica
            print(f"   Successfully decoded base64. Bytes length: {len(decoded_bytes)}. Filename: {file_name}")

            if len(decoded_bytes) == 0:
                 raise ValueError("Decoded image resulted in zero bytes.")

            decoded_file = ContentFile(decoded_bytes, name=file_name)
            return decoded_file

        except (ValueError, TypeError, IndexError, base64.binascii.Error) as e:
            print(f"ERROR in Base64ImageField (Format/Decode): {e}. Input started with: {str(data)[:80]}...") # Log con errore
            # Rendi l'errore più specifico
            raise serializers.ValidationError(f"Invalid base64 data URL format or content for image starting with '{str(data)[:30]}...': {e}") from e
        except Exception as e:
             print(f"ERROR in Base64ImageField (Unexpected): {e}. Input started with: {str(data)[:80]}...") # Log con errore
             raise serializers.ValidationError(f"Failed to process image data for image starting with '{str(data)[:30]}...': {e}")

    def to_representation(self, value): return None

class TrainRequestSerializer(serializers.Serializer):
    images = serializers.ListField(child=Base64ImageField(), min_length=MIN_IMAGES_PER_CLASS, allow_empty=False) # Usa costante
    labels = serializers.ListField(child=serializers.IntegerField(min_value=0), allow_empty=False)
    class_names = serializers.ListField(child=serializers.CharField(max_length=100), min_length=MIN_CLASSES, allow_empty=False) # Usa costante
    model_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="My Classifier")
    epochs = serializers.IntegerField(min_value=1, max_value=50, default=10, required=False)
    batch_size = serializers.IntegerField(min_value=4, max_value=64, default=32, required=False)

    def validate(self, data):
        if len(data['images']) != len(data['labels']):
            raise serializers.ValidationError("Number of images must match number of labels.")
        # La validazione del numero di classi rispetto alle etichette è complessa
        # perché non sappiamo a priori quali etichette sono presenti.
        # Potremmo farla dopo, o fidarci che il frontend invii dati consistenti.
        # Semplifichiamo: assicuriamoci solo che le etichette non superino gli indici possibili
        max_label = -1
        if data['labels']:
            max_label = max(data['labels'])
        if max_label >= len(data['class_names']):
             raise serializers.ValidationError(f"A label value ({max_label}) is out of bounds for the provided class names (indices 0 to {len(data['class_names']) - 1}).")

        if len(set(data['class_names'])) != len(data['class_names']):
             raise serializers.ValidationError("Class names must be unique.")
        return data

class TrainSubmitResponseSerializer(serializers.Serializer):
    model_id = serializers.UUIDField(read_only=True)
    status = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)


# --- Serializers per Predizione ---

class PredictRequestSerializer(serializers.Serializer):
    image = Base64ImageField(required=True)
    model_id = serializers.UUIDField(required=True)

class PredictionSerializer(serializers.Serializer):
    """ Rappresenta una singola predizione."""
    label = serializers.CharField()
    confidence = serializers.FloatField()

class PredictResponseSerializer(serializers.Serializer):
    model_id = serializers.UUIDField(read_only=True)
    predictions = PredictionSerializer(many=True, read_only=True) # Lista di predizioni ordinate
    status = serializers.CharField(read_only=True, default="success")


# --- Serializer per Gestione Modelli ---

class TrainedModelSerializer(serializers.ModelSerializer):
    """Serializer per listare e vedere dettagli dei modelli addestrati."""
    # Non esponiamo i path dei file direttamente
    class Meta:
        model = TrainedModel
        fields = [
            'id', 'owner_id', 'name', 'description', 'status',
            'class_names', 'accuracy', 'loss', 'training_params',
            'error_message', 'created_at', 'training_started_at',
            'training_finished_at'
        ]
        read_only_fields = fields # In sola lettura per la lista/dettaglio