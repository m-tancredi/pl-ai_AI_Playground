import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split # Opzionale per split train/test
from rest_framework import viewsets, status, permissions, views, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q # Per query OR

from .models import Dataset
from .serializers import DatasetSerializer, RegressionParamsSerializer, PredictionInputSerializer

class DatasetViewSet(viewsets.ModelViewSet):
    serializer_class = DatasetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not hasattr(user, 'id') or not user.is_authenticated:
             return Dataset.objects.none()

        # Filtra usando owner_id
        return Dataset.objects.filter(Q(owner_id=user.id) | Q(is_example=True))

    def perform_create(self, serializer):
        # Salva usando owner_id
        serializer.save(owner_id=self.request.user.id)

    # Azione custom per recuperare i dati grezzi di un dataset
    @action(detail=True, methods=['get'], url_path='raw-data')
    def raw_data(self, request, pk=None):
        """
        Restituisce i dati contenuti nel file CSV come JSON.
        """
        dataset = self.get_object() # Applica già i filtri di get_queryset
        df = dataset.get_dataframe()
        if df is None:
            return Response({"error": "Could not read dataset file."}, status=status.HTTP_404_NOT_FOUND)

        # Converte in formato JSON orientato ai record (lista di oggetti)
        # Attenzione a file molto grandi! Considera paginazione/streaming se necessario.
        try:
            data = df.to_dict(orient='records')
            return Response(data)
        except Exception as e:
             return Response({"error": f"Error converting data to JSON: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    # Azione custom per addestrare un modello di regressione su un dataset salvato
    @action(detail=True, methods=['post'], url_path='train')
    def train(self, request, pk=None):
        """
        Esegue una regressione lineare su un dataset salvato.
        Richiede 'feature_column' e 'target_column' nel body della richiesta.
        """
        dataset = self.get_object()
        df = dataset.get_dataframe()
        if df is None:
            return Response({"error": "Could not read dataset file."}, status=status.HTTP_404_NOT_FOUND)

        # Validazione input (nomi colonne)
        params_serializer = RegressionParamsSerializer(data=request.data)
        if not params_serializer.is_valid():
            return Response(params_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        feature_col = params_serializer.validated_data['feature_column']
        target_col = params_serializer.validated_data['target_column']

        # Verifica che le colonne esistano e siano numeriche
        if feature_col not in df.columns or target_col not in df.columns:
            return Response({"error": "Specified columns not found in the dataset."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Assicurati che siano numeriche, scarta righe con NaN
            df_clean = df[[feature_col, target_col]].dropna()
            df_clean[feature_col] = pd.to_numeric(df_clean[feature_col], errors='coerce')
            df_clean[target_col] = pd.to_numeric(df_clean[target_col], errors='coerce')
            df_clean = df_clean.dropna()

            if df_clean.empty or len(df_clean) < 2:
                 return Response({"error": "Not enough valid numeric data for regression."}, status=status.HTTP_400_BAD_REQUEST)

            X = df_clean[[feature_col]] # Feature deve essere 2D array-like
            y = df_clean[target_col]

            # Addestramento modello
            model = LinearRegression()
            model.fit(X, y)

            results = {
                'feature_column': feature_col,
                'target_column': target_col,
                'slope': model.coef_[0],
                'intercept': model.intercept_,
                'data_points_used': len(df_clean),
                # Opzionale: R-squared o altre metriche
                'r_squared': model.score(X, y)
            }
            return Response(results)

        except ValueError as e:
             return Response({"error": f"Data type error during regression: {e}. Ensure columns contain numeric data."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Regression training error: {e}")
            return Response({"error": "An unexpected error occurred during model training."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadTrainTemporaryView(views.APIView):
    """
    Vista per caricare un CSV, eseguire regressione al volo e restituire risultati,
    senza salvare il dataset nel DB.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Verifica presenza file
        if 'csv_file' not in request.FILES:
            return Response({"error": "No CSV file provided."}, status=status.HTTP_400_BAD_REQUEST)

        csv_file = request.FILES['csv_file']

        # Validazione estensione (anche se modello ha validator)
        if not csv_file.name.lower().endswith('.csv'):
             return Response({"error": "Invalid file type. Only .csv allowed."}, status=status.HTTP_400_BAD_REQUEST)

        # Validazione nomi colonne dai dati del form (assumendo siano inviati insieme al file)
        params_serializer = RegressionParamsSerializer(data=request.data)
        if not params_serializer.is_valid():
            return Response(params_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        feature_col = params_serializer.validated_data['feature_column']
        target_col = params_serializer.validated_data['target_column']

        try:
            # Leggi CSV direttamente dal file in memoria
            df = pd.read_csv(csv_file)

            # Stessa logica di pulizia e training del @action train
            if feature_col not in df.columns or target_col not in df.columns:
                return Response({"error": "Specified columns not found in the uploaded dataset."}, status=status.HTTP_400_BAD_REQUEST)

            df_clean = df[[feature_col, target_col]].dropna()
            df_clean[feature_col] = pd.to_numeric(df_clean[feature_col], errors='coerce')
            df_clean[target_col] = pd.to_numeric(df_clean[target_col], errors='coerce')
            df_clean = df_clean.dropna()

            if df_clean.empty or len(df_clean) < 2:
                 return Response({"error": "Not enough valid numeric data for regression in the uploaded file."}, status=status.HTTP_400_BAD_REQUEST)

            X = df_clean[[feature_col]]
            y = df_clean[target_col]

            model = LinearRegression()
            model.fit(X, y)

            results = {
                'status': 'Regression performed on temporary data',
                'feature_column': feature_col,
                'target_column': target_col,
                'slope': model.coef_[0],
                'intercept': model.intercept_,
                'data_points_used': len(df_clean),
                'r_squared': model.score(X, y)
                # NON restituiamo ID dataset perché non è stato salvato
            }
            return Response(results)

        except pd.errors.EmptyDataError:
             return Response({"error": "The uploaded CSV file is empty."}, status=status.HTTP_400_BAD_REQUEST)
        except pd.errors.ParserError:
             return Response({"error": "Could not parse the CSV file. Check format."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
             return Response({"error": f"Data type error: {e}. Ensure columns contain numeric data."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Temporary upload/train error: {e}")
            return Response({"error": "An unexpected error occurred processing the file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PredictView(views.APIView):
    """
    Vista per effettuare una predizione usando parametri di un modello lineare.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PredictionInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        slope = serializer.validated_data['slope']
        intercept = serializer.validated_data['intercept']
        feature_value = serializer.validated_data['feature_value']

        # Calcola predizione
        prediction = intercept + slope * feature_value

        return Response({"predicted_value": prediction})