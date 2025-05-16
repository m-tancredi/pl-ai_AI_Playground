# pl-ai/backend/data_analysis_service/analysis_api/serializers.py
import base64
import uuid
from rest_framework import serializers
from .models import AnalysisJob, SyntheticDatasetJob # Assicurati che AnalysisJob sia importato
from django.core.files.base import ContentFile

# Costanti (se non già definite o importate da altrove)
MIN_CLASSES = 2
MIN_IMAGES_PER_CLASS = 10 # Esempio

# --- Serializers per Suggerimento Algoritmo (come prima) ---
class AlgorithmSuggestionRequestSerializer(serializers.Serializer):
    resource_id = serializers.IntegerField(required=False, allow_null=True, help_text="ID of an existing CSV resource in Resource Manager.")
    file = serializers.FileField(required=False, allow_null=True, help_text="Alternatively, upload a new CSV file directly for suggestion.")
    task_type_preference = serializers.ChoiceField(choices=["regression", "classification"], required=False, allow_null=True)

    def validate(self, data):
        if not data.get('resource_id') and not data.get('file'):
            raise serializers.ValidationError("Either 'resource_id' or 'file' must be provided.")
        if data.get('resource_id') and data.get('file'):
            raise serializers.ValidationError("Provide either 'resource_id' or 'file', not both.")
        return data

class DatasetPreviewSerializer(serializers.Serializer):
    headers = serializers.ListField(child=serializers.CharField())
    sample_rows = serializers.ListField(child=serializers.DictField())
    num_rows_sample = serializers.IntegerField()
    num_cols = serializers.IntegerField()

class AlgorithmSuggestionSerializer(serializers.Serializer):
    algorithm_name = serializers.CharField()
    algorithm_key = serializers.CharField()
    task_type = serializers.CharField()
    motivation = serializers.CharField()
    suggested_features = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    suggested_target = serializers.CharField(allow_null=True, required=False)

class SuggestionResponseSerializer(serializers.Serializer):
    analysis_session_id = serializers.UUIDField()
    dataset_preview = DatasetPreviewSerializer()
    suggestions = AlgorithmSuggestionSerializer(many=True)


# --- Serializers per Esecuzione Analisi (come prima) ---
class AnalysisRunRequestSerializer(serializers.Serializer):
    analysis_session_id = serializers.UUIDField(required=True)
    selected_algorithm_key = serializers.CharField(required=True, max_length=100)
    selected_features = serializers.ListField(child=serializers.CharField(), min_length=1, allow_empty=False)
    selected_target = serializers.CharField(required=True, max_length=255)
    task_type = serializers.ChoiceField(choices=["regression", "classification"], required=True)
    algorithm_params = serializers.JSONField(required=False, default=dict)

    def validate(self, data): # Esempio validazione
        if data['task_type'] == 'regression' and len(data['selected_features']) > 1:
            # Per la predizione interattiva semplice nel frontend, limitiamo a una feature
            # Questa validazione potrebbe essere più flessibile
            # print("Warning: Regression with multiple features selected. Interactive frontend prediction might only use the first one for plotting.")
            pass
        return data


class AnalysisJobSubmitResponseSerializer(serializers.Serializer):
    analysis_job_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()


# --- Serializer per Risultati Analisi (Modello AnalysisJob - come prima) ---
class AnalysisJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisJob
        fields = [
            'id', 'owner_id', 'resource_id', 'original_filename',
            'task_type', 'selected_algorithm_key', 'input_parameters',
            'status', 'results', 'plot_data', 'model_path',
            'error_message', 'created_at', 'job_started_at', 'job_finished_at'
        ]
        read_only_fields = fields


# --- Serializers per Predizione Istanza (come prima, ma aggiungiamo RegressionPredictionSerializer) ---
class InstanceFeaturesSerializer(serializers.Serializer):
    features = serializers.DictField(child=serializers.CharField(allow_blank=True, allow_null=True), required=True) # Permetti null per gestire input vuoti prima della conversione

class ClassificationPredictionSerializer(serializers.Serializer):
    predicted_class = serializers.CharField()
    probabilities = serializers.DictField(child=serializers.FloatField(), required=False, allow_null=True)
    plot_coordinates = serializers.ListField(child=serializers.FloatField(), required=False, allow_null=True)

# --- NUOVO SERIALIZER per Regression Prediction Output ---
class RegressionPredictionSerializer(serializers.Serializer):
    predicted_value = serializers.FloatField()
    # plot_coordinates non è strettamente necessario qui se il frontend calcola il punto
    # usando X originale e Y predetto, e il backend non restituisce coordinate trasformate per questo.
    # Se il backend dovesse restituire coordinate trasformate anche per la regressione (es. per plot 3D), aggiungilo:
    # plot_coordinates = serializers.ListField(child=serializers.FloatField(), required=False, allow_null=True)
# --- FINE NUOVO SERIALIZER ---


class SyntheticCsvRequestSerializer(serializers.Serializer):
    user_prompt = serializers.CharField(required=True, min_length=10, max_length=2000)
    num_rows = serializers.IntegerField(required=True, min_value=10, max_value=1000) # Limiti esempio
    dataset_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    # target_columns = serializers.ListField(child=serializers.DictField(), required=False) # Per futuro

class SyntheticDatasetJobSubmitResponseSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()

class SyntheticDatasetJobSerializer(serializers.ModelSerializer):
    """Serializer per visualizzare lo stato e i risultati di un SyntheticDatasetJob."""
    class Meta:
        model = SyntheticDatasetJob
        fields = [
            'id', 'owner_id', 'user_prompt', 'num_rows_requested',
            'generated_dataset_name', 'status', 'error_message',
            'resource_id', 'created_at', 'updated_at'
        ]
        read_only_fields = fields # Tutti i campi sono di sola lettura quando si recupera un job

