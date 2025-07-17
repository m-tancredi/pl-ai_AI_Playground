import base64
import io
from django.http import Http404
import numpy as np
import tensorflow as tf
from tensorflow import keras
from PIL import Image as PillowImage
from pathlib import Path
import os

from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.http import HttpResponse, FileResponse

from rest_framework import views, status, permissions, exceptions, viewsets, generics
from rest_framework.response import Response
from rest_framework.decorators import action

from .models import TrainedModel
from .serializers import (
    TrainRequestSerializer, TrainSubmitResponseSerializer,
    PredictRequestSerializer, PredictResponseSerializer,
    TrainedModelSerializer
)
from .authentication import JWTCustomAuthentication
from .tasks import preprocess_image, train_classifier_task # Importa il task Celery


# --- Vista per Addestramento ---
class TrainView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    # parser_classes = [JSONParser] # DRF usa JSONParser di default

    def post(self, request, *args, **kwargs):
        serializer = TrainRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        user_id = request.user.id

        try:
            # 1. Crea record preliminare nel DB
            model_record = TrainedModel.objects.create(
                owner_id=user_id,
                name=validated_data.get('model_name', 'My Classifier'),
                status=TrainedModel.Status.PENDING,
                class_names=validated_data['class_names'], # Salva subito
                training_params={ # Salva parametri usati
                    'epochs': validated_data['epochs'],
                    'batch_size': validated_data['batch_size'],
                    'num_images': len(validated_data['images']),
                    'num_classes': len(validated_data['class_names']),
                }
            )
            model_id = model_record.id
            print(f"Created TrainedModel record with ID: {model_id}, status PENDING.")

            # Accedi direttamente a request.data['images'] che contiene le stringhe
            image_base64_strings = request.data.get('images', [])
            # Verifica che sia una lista (dovrebbe esserlo se la validazione è passata)
            if not isinstance(image_base64_strings, list):
                 raise TypeError("Input 'images' is not a list in request data.")
            
            # 3. Invia task Celery
            train_classifier_task.delay(
                model_id=str(model_id), # Passa ID come stringa per sicurezza JSON
                image_data_list=image_base64_strings, # <-- CORRETTO: Usa la variabile definita sopra
                labels=validated_data['labels'],
                class_names=validated_data['class_names'],
                training_params=model_record.training_params # Passa i parametri salvati
            )
            print(f"Dispatched training task for model ID: {model_id}")

            # 4. Rispondi con 202 Accepted
            response_serializer = TrainSubmitResponseSerializer({
                'model_id': model_id,
                'status': model_record.status,
                'message': 'Training task submitted successfully. Check model status later.'
            })
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
            print(f"Error submitting training task: {e}")
            # Se il record è stato creato, impostalo come FAILED?
            if 'model_record' in locals() and model_record.pk:
                 try:
                     model_record.status = TrainedModel.Status.FAILED
                     model_record.error_message = f"Failed to dispatch task: {e}"
                     model_record.save()
                 except: pass # Ignora errori nel salvataggio dello stato fallito
            return Response({"error": "Failed to submit training task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Vista per Predizione ---

# Cache semplice in memoria per i modelli caricati (NON adatta a produzione multi-worker!)
# In produzione, usare una cache condivisa (Redis, Memcached) o ricaricare sempre.
MODEL_CACHE = {}
MAX_CACHE_SIZE = 10 # Limita numero modelli in cache

def load_keras_model(model_id_str, owner_id):
    """Carica un modello Keras e i nomi classi, usando una cache semplice."""
    cache_key = model_id_str
    if cache_key in MODEL_CACHE:
        print(f"Loading model {model_id_str} from cache.")
        return MODEL_CACHE[cache_key]['model'], MODEL_CACHE[cache_key]['class_names']

    print(f"Loading model {model_id_str} from storage for owner {owner_id}...")
    try:
        # Trova il record del modello (verifica owner!)
        model_record = TrainedModel.objects.get(pk=model_id_str, owner_id=owner_id)

        if model_record.status != TrainedModel.Status.COMPLETED:
            raise ValueError(f"Model status is {model_record.status}, not COMPLETED.")

        model_full_path = model_record.get_full_model_path()
        # class_names_full_path = model_record.get_full_class_names_path() # Carichiamo dal field json

        if not model_full_path or not os.path.exists(model_full_path):
             raise FileNotFoundError("Model file path not found or does not exist.")

        # Carica modello Keras
        model = keras.models.load_model(model_full_path)
        class_names = model_record.class_names # Usa dal DB

        if not class_names:
             raise ValueError("Class names not found for this model.")

        # Gestione Cache (semplice FIFO)
        if len(MODEL_CACHE) >= MAX_CACHE_SIZE:
             # Rimuovi l'elemento più vecchio (assumendo inserimento ordinato, che non è garantito)
             # Una LRU cache sarebbe meglio.
             oldest_key = next(iter(MODEL_CACHE))
             print(f"Cache full, removing oldest model: {oldest_key}")
             del MODEL_CACHE[oldest_key]

        MODEL_CACHE[cache_key] = {'model': model, 'class_names': class_names}
        print(f"Model {model_id_str} loaded and cached.")
        return model, class_names

    except TrainedModel.DoesNotExist:
        raise Http404("Model not found or access denied.")
    except Exception as e:
        print(f"Error loading model {model_id_str}: {e}")
        raise # Rilancia per gestione errore nella view

class PredictView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = PredictRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        model_id_str = str(validated_data['model_id']) # Usa stringa per cache key
        image_file_obj = validated_data['image'] # Questo è un ContentFile ora
        user_id = request.user.id

        try:
            # 1. Carica Modello e Classi (con cache)
            model, class_names = load_keras_model(model_id_str, user_id)

            # 2. Preprocessa Immagine
            preprocessed_image = preprocess_image(image_file_obj.read()) # Leggi bytes da ContentFile
            if preprocessed_image is None:
                 return Response({"error": "Failed to preprocess image."}, status=status.HTTP_400_BAD_REQUEST)

            # 3. Esegui Predizione
            print(f"Running prediction with model {model_id_str}...")
            predictions = model.predict(preprocessed_image)
            scores = predictions[0] # Risultati per la prima (unica) immagine nel batch

            # 4. Formatta Risultati
            prediction_results = [
                {"label": class_names[i], "confidence": float(scores[i])}
                for i in range(len(scores))
            ]
            # Ordina per confidenza discendente
            prediction_results.sort(key=lambda x: x['confidence'], reverse=True)

            print(f"Prediction results: {prediction_results}")

            # 5. Restituisci Risposta
            response_serializer = PredictResponseSerializer({
                'model_id': model_id_str,
                'predictions': prediction_results
            })
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except Http404 as e:
             return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except FileNotFoundError as e:
             print(f"Model file error for {model_id_str}: {e}")
             return Response({"error": "Model data associated with the ID is missing or corrupted."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ValueError as e: # Es. da load_keras_model o preprocessing
             print(f"Value error during prediction for model {model_id_str}: {e}")
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             print(f"Unexpected error during prediction for model {model_id_str}: {e}")
             # import traceback; traceback.print_exc();
             return Response({"error": "An unexpected error occurred during prediction."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# pl-ai/backend/image_classifier_service/classifier_api/views.py
# ... (altri import) ...

class TrainedModelViewSet(viewsets.ModelViewSet): # Assicurati sia ModelViewSet
    """
    Permette di listare, vedere dettagli, aggiornare (PATCH per nome/descrizione)
    e cancellare i modelli addestrati dall'utente.
    """
    serializer_class = TrainedModelSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    lookup_field = 'id'
    # Definisci i metodi permessi: GET (list, retrieve), PATCH (update), DELETE (destroy)
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        return TrainedModel.objects.filter(owner_id=user.id).order_by('-created_at')

    @action(detail=True, methods=['get'])
    def download(self, request, id=None):
        """
        Scarica il file del modello TensorFlow (.keras)
        """
        try:
            # Ottieni il modello (get_object già controlla l'ownership tramite get_queryset)
            model_instance = self.get_object()
            
            # Verifica che il modello sia completato
            if model_instance.status != TrainedModel.Status.COMPLETED:
                return Response(
                    {"error": "Il modello non è ancora pronto per il download."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Ottieni il path completo del file del modello
            model_path = model_instance.get_full_model_path()
            
            if not model_path or not os.path.exists(model_path):
                return Response(
                    {"error": "File del modello non trovato."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Genera nome file per il download
            filename = f"{model_instance.name.replace(' ', '_')}.keras"
            
            # Ritorna il file come response
            response = FileResponse(
                open(model_path, 'rb'),
                as_attachment=True,
                filename=filename
            )
            response['Content-Type'] = 'application/octet-stream'
            
            return response
            
        except Exception as e:
            return Response(
                {"error": f"Errore durante il download: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )