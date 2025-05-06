from rest_framework import serializers

class RegressionRunSerializer(serializers.Serializer):
    """Serializer per validare l'input per eseguire la regressione."""
    resource_id = serializers.IntegerField(required=True, help_text="ID of the resource (CSV) in Resource Manager")
    feature_column = serializers.CharField(required=True, max_length=255, help_text="Name of the feature column (X)")
    target_column = serializers.CharField(required=True, max_length=255, help_text="Name of the target column (Y)")

    def validate(self, data):
        if data['feature_column'] == data['target_column']:
            raise serializers.ValidationError("Feature and target columns cannot be the same.")
        # Aggiungere altre validazioni se necessario (es. nomi colonna validi?)
        return data

class RegressionResultSerializer(serializers.Serializer):
    """Serializer per l'output della regressione."""
    feature_column = serializers.CharField(read_only=True)
    target_column = serializers.CharField(read_only=True)
    slope = serializers.FloatField(read_only=True)
    intercept = serializers.FloatField(read_only=True)
    r_squared = serializers.FloatField(read_only=True)
    data_points_used = serializers.IntegerField(read_only=True)
    message = serializers.CharField(read_only=True, required=False) # Per messaggi aggiuntivi

class PredictRequestSerializer(serializers.Serializer):
    """Serializer per l'input della predizione (invariato)."""
    slope = serializers.FloatField(required=True)
    intercept = serializers.FloatField(required=True)
    feature_value = serializers.FloatField(required=True)

class PredictResponseSerializer(serializers.Serializer):
    """Serializer per l'output della predizione (invariato)."""
    predicted_value = serializers.FloatField(read_only=True)