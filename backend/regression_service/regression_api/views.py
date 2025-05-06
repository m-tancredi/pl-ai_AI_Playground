import requests
import pandas as pd
import io # Per leggere stringhe/bytes come file
from sklearn.linear_model import LinearRegression

from django.conf import settings
from rest_framework import views, status, permissions, exceptions
from rest_framework.response import Response

from .serializers import (
    RegressionRunSerializer, RegressionResultSerializer,
    PredictRequestSerializer, PredictResponseSerializer
)
from .authentication import JWTCustomAuthentication

# Costante per header interno (o leggerla da settings?)
INTERNAL_API_HEADER = settings.INTERNAL_API_SECRET_HEADER_NAME
INTERNAL_API_SECRET = settings.INTERNAL_API_SECRET_VALUE

class RunRegressionView(views.APIView):
    """Esegue la regressione lineare leggendo dati dal Resource Manager."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        run_serializer = RegressionRunSerializer(data=request.data)
        if not run_serializer.is_valid():
            return Response(run_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = run_serializer.validated_data
        resource_id = validated_data['resource_id']
        feature_col = validated_data['feature_column']
        target_col = validated_data['target_column']

        print(f"Regression request for resource_id: {resource_id}, X={feature_col}, Y={target_col}")

        # --- Chiamata API Interna a Resource Manager ---
        try:
            resource_url = f"{settings.RESOURCE_MANAGER_INTERNAL_URL}/api/internal/resources/{resource_id}/content/"
            headers = {'Accept': 'text/csv'} # Richiedi CSV
            # Aggiungi header segreto se configurato
                        # --- DEBUG: Stampa il segreto prima di inviarlo ---
            secret_to_send = settings.INTERNAL_API_SECRET_VALUE
            header_name_to_send = settings.INTERNAL_API_SECRET_HEADER_NAME
            print(f"\n--- Sending Internal Request ---")
            print(f"DEBUG: Secret read from settings ('INTERNAL_API_SECRET_VALUE'): '{secret_to_send}'")
            print(f"DEBUG: Header to send: '{header_name_to_send}'")
            # --- FINE DEBUG ---

            if secret_to_send:
                 headers[header_name_to_send] = secret_to_send
                 print(f"DEBUG: Header added to request: {headers}")
            else:
                 print("WARNING: INTERNAL_API_SECRET not configured in regression_service settings. Sending request without secret header.")

            print(f"Calling internal API: GET {resource_url}")
            response = requests.get(resource_url, headers=headers, timeout=30, stream=True)
            print(f"Internal API Response Status: {response.status_code}") # Logga anche status risposta
            response.raise_for_status()
            
            if settings.INTERNAL_API_SECRET_VALUE:
                headers[settings.INTERNAL_API_SECRET_HEADER_NAME] = settings.INTERNAL_API_SECRET_VALUE
            else:
                print("WARNING: INTERNAL_API_SECRET not configured in regression_service settings. Internal call might fail.")

            print(f"Calling internal API: GET {resource_url}")
            response = requests.get(resource_url, headers=headers, timeout=30, stream=True) # Usa stream per file potenzialmente grandi
            response.raise_for_status() # Solleva eccezione per 4xx/5xx

            # Leggi contenuto CSV in Pandas DataFrame
            # Usiamo response.content se il file non è enorme, o response.iter_content se grande
            # Per semplicità iniziale, usiamo response.text assumendo sia testo e non gigante
            csv_content = response.text
            if not csv_content:
                 print(f"Resource Manager returned empty content for {resource_id}")
                 return Response({"error": "Resource file content is empty."}, status=status.HTTP_404_NOT_FOUND)

            # Usa io.StringIO per leggere la stringa come un file
            csv_file_like = io.StringIO(csv_content)
            df = pd.read_csv(csv_file_like)

        except requests.exceptions.ConnectionError as e:
             print(f"Internal API Error: Cannot connect to Resource Manager at {settings.RESOURCE_MANAGER_INTERNAL_URL}. Details: {e}")
             return Response({"error": "Could not connect to resource service."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except requests.exceptions.Timeout as e:
             print(f"Internal API Error: Timeout connecting to Resource Manager. Details: {e}")
             return Response({"error": "Timeout connecting to resource service."}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            error_detail = f"Resource Manager API error ({status_code})"
            try: error_detail += f": {e.response.json().get('detail', e.response.text)}"
            except: error_detail += f": {e.response.text}"
            print(f"Internal API Error: {error_detail}")
            # Traduci errore backend in errore appropriato per il client
            if status_code == 404:
                 return Response({"error": f"Resource with ID {resource_id} not found or not ready."}, status=status.HTTP_404_NOT_FOUND)
            elif status_code == 403: # Possibile errore di autenticazione interna?
                  return Response({"error": "Internal authorization failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                 return Response({"error": "Failed to retrieve resource data."}, status=status.HTTP_502_BAD_GATEWAY)
        except pd.errors.ParserError as e:
             print(f"Pandas parsing error for resource {resource_id}: {e}")
             return Response({"error": "Failed to parse the CSV data from the resource."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             print(f"Unexpected error retrieving or parsing resource {resource_id}: {e}")
             return Response({"error": "An unexpected error occurred while getting resource data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        # --- Logica di Regressione (come prima, ma su df letto da API) ---
        print(f"Running regression on DataFrame with shape {df.shape}")
        if feature_col not in df.columns or target_col not in df.columns:
            return Response({"error": f"Columns '{feature_col}' or '{target_col}' not found in the dataset."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df_clean = df[[feature_col, target_col]].dropna()
            df_clean[feature_col] = pd.to_numeric(df_clean[feature_col], errors='coerce')
            df_clean[target_col] = pd.to_numeric(df_clean[target_col], errors='coerce')
            df_clean = df_clean.dropna()

            if df_clean.empty or len(df_clean) < 2:
                 return Response({"error": "Not enough valid numeric data for regression after cleaning."}, status=status.HTTP_400_BAD_REQUEST)

            X = df_clean[[feature_col]]
            y = df_clean[target_col]

            model = LinearRegression()
            model.fit(X, y)

            result_data = {
                'feature_column': feature_col,
                'target_column': target_col,
                'slope': model.coef_[0],
                'intercept': model.intercept_,
                'r_squared': model.score(X, y),
                'data_points_used': len(df_clean),
                'message': 'Regression successful.'
            }
            result_serializer = RegressionResultSerializer(result_data)
            return Response(result_serializer.data, status=status.HTTP_200_OK)

        except ValueError as e:
             print(f"Data type error during regression for resource {resource_id}: {e}")
             return Response({"error": f"Data type error: {e}. Ensure selected columns contain numeric data."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Unexpected error during regression calculation for resource {resource_id}: {e}")
            return Response({"error": "An unexpected error occurred during regression calculation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PredictView(views.APIView):
    """Esegue una predizione dati i parametri del modello e un valore."""
    permission_classes = [permissions.IsAuthenticated] # Manteniamo autenticazione
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = PredictRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        slope = serializer.validated_data['slope']
        intercept = serializer.validated_data['intercept']
        feature_value = serializer.validated_data['feature_value']

        prediction = intercept + slope * feature_value
        response_serializer = PredictResponseSerializer({'predicted_value': prediction})
        return Response(response_serializer.data, status=status.HTTP_200_OK)