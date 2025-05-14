from rest_framework import serializers
from .models import AnalysisJob

# --- Serializers per Suggerimento Algoritmo ---
class AlgorithmSuggestionRequestSerializer(serializers.Serializer):
    resource_id = serializers.IntegerField(required=False, allow_null=True, help_text="ID of an existing CSV resource in Resource Manager.") # <-- CAMBIATO
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
    sample_rows = serializers.ListField(child=serializers.DictField()) # Lista di dizionari
    num_rows_sample = serializers.IntegerField()
    num_cols = serializers.IntegerField()

class AlgorithmSuggestionSerializer(serializers.Serializer):
    algorithm_name = serializers.CharField()
    algorithm_key = serializers.CharField() # Chiave standardizzata (es. linear_regression)
    task_type = serializers.CharField()     # 'regression' o 'classification'
    motivation = serializers.CharField()
    suggested_features = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    suggested_target = serializers.CharField(allow_null=True, required=False)

class SuggestionResponseSerializer(serializers.Serializer):
    analysis_session_id = serializers.UUIDField()
    dataset_preview = DatasetPreviewSerializer()
    suggestions = AlgorithmSuggestionSerializer(many=True)


# --- Serializers per Esecuzione Analisi ---
class AnalysisRunRequestSerializer(serializers.Serializer):
    analysis_session_id = serializers.UUIDField(required=True)
    selected_algorithm_key = serializers.CharField(required=True, max_length=100)
    selected_features = serializers.ListField(child=serializers.CharField(), min_length=1, allow_empty=False)
    selected_target = serializers.CharField(required=True, max_length=255)
    task_type = serializers.ChoiceField(choices=["regression", "classification"], required=True)
    # Parametri specifici dell'algoritmo (opzionali)
    # Esempio: polynomial_degree per polynomial_regression
    # Esempio: n_estimators, max_depth per RandomForest
    algorithm_params = serializers.JSONField(required=False, default=dict)

    # TODO: Validare che selected_features e selected_target siano presenti negli header
    # (richiederebbe accesso al dataset_preview dalla cache/sessione)

class AnalysisJobSubmitResponseSerializer(serializers.Serializer):
    analysis_job_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()


# --- Serializer per Risultati Analisi (Modello AnalysisJob) ---
class AnalysisJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisJob
        fields = [
            'id', 'owner_id', 'resource_id', 'original_filename',
            'task_type', 'selected_algorithm_key', 'input_parameters',
            'status', 'results', 'plot_data', 'model_path', # Esponi model_path se l'utente può scaricarlo
            'error_message', 'created_at', 'job_started_at', 'job_finished_at'
        ]
        read_only_fields = fields # Tutti i campi sono di sola lettura quando si recupera un job

class InstanceFeaturesSerializer(serializers.Serializer):
    """ Serializer per validare le feature di una singola istanza per la predizione. """
    # Questo serializer si aspetta un dizionario dove le chiavi sono i nomi delle feature
    # e i valori sono i valori di quelle feature.
    # La validazione specifica dei campi (tipo, ecc.) può essere omessa qui
    # se il preprocessor nel backend è robusto, altrimenti aggiungila.
    # Esempio: feature1 = serializers.FloatField(required=True)
    #          feature2 = serializers.CharField(required=True)
    # Per renderlo generico, accettiamo un dizionario.
    features = serializers.DictField(child=serializers.CharField(allow_blank=True), required=True) # CharField per accettare numeri come stringhe e convertirli dopo

class ClassificationPredictionSerializer(serializers.Serializer):
    """ Serializer per l'output della predizione di classificazione. """
    predicted_class = serializers.CharField()
    probabilities = serializers.DictField(child=serializers.FloatField(), required=False, allow_null=True) # Opzionale: {class_name: probability}