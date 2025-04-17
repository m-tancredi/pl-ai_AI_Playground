from rest_framework import serializers
from .models import Dataset
import pandas as pd

class DatasetSerializer(serializers.ModelSerializer):
    # Rimosso: owner = serializers.PrimaryKeyRelatedField(read_only=True)
    csv_file_url = serializers.SerializerMethodField()
    headers = serializers.ListField(child=serializers.CharField(), read_only=True, required=False)
    # Aggiungi owner_id se vuoi vederlo nella risposta API
    owner_id = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Dataset
        fields = [
            'id',
            'owner_id', # Aggiunto owner_id
            'name',
            'description',
            'csv_file',
            'csv_file_url',
            'uploaded_at',
            'headers',
            'is_example',
        ]
        # Owner non è più qui
        read_only_fields = ('id', 'owner_id', 'uploaded_at', 'is_example', 'headers')
        extra_kwargs = {
            'csv_file': {'required': True, 'allow_null': False, 'write_only': True},
            'name': {'required': True}
        }

    def get_csv_file_url(self, obj):
        """Restituisce l'URL completo del file CSV se esiste."""
        request = self.context.get('request')
        if obj.csv_file and request:
            return request.build_absolute_uri(obj.csv_file.url)
        return None

    def create(self, validated_data):
        # La logica di owner_id è ora in perform_create della vista
        dataset = super().create(validated_data)
        dataset.extract_headers()
        return dataset

class RegressionParamsSerializer(serializers.Serializer):
    """Serializer per i parametri di input della regressione."""
    feature_column = serializers.CharField(required=True, help_text="Nome della colonna usata come feature (X)")
    target_column = serializers.CharField(required=True, help_text="Nome della colonna usata come target (Y)")

    def validate(self, data):
        # Potresti aggiungere validazione qui per assicurarti che le colonne esistano
        # nel dataset associato (se usato con un dataset specifico)
        if data['feature_column'] == data['target_column']:
            raise serializers.ValidationError("Feature and target columns cannot be the same.")
        return data

class PredictionInputSerializer(serializers.Serializer):
    """Serializer per l'input della predizione."""
    slope = serializers.FloatField(required=True, help_text="Coefficiente (pendenza) del modello")
    intercept = serializers.FloatField(required=True, help_text="Intercetta del modello")
    feature_value = serializers.FloatField(required=True, help_text="Valore della feature per cui fare la predizione")