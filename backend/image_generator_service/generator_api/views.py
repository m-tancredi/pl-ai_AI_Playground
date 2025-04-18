# pl-ai/backend/image_generator_service/generator_api/views.py

import os
import uuid
import base64
import requests
import shutil
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError # Per distinguerlo da DRF

from rest_framework import views, status, permissions, exceptions, viewsets
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

# Importa tutti i Serializers necessari
from .serializers import (
    TextToImageRequestSerializer, ImageResponseSerializer,
    PromptEnhanceRequestSerializer, PromptEnhanceResponseSerializer,
    ImageSaveRequestSerializer, ImageSaveResponseSerializer,
    GeneratedImageSerializer
)
# Importa il Modello
from .models import GeneratedImage
# Importa l'autenticazione custom
from .authentication import JWTCustomAuthentication
# Importa l'helper per i segreti
from .config.secrets import get_secret

# --- Costanti API e Helper ---
ASPECT_RATIO_MAP_STABILITY = {
    '1:1': (1024, 1024), '16:9': (1536, 864), '9:16': (864, 1536),
    '4:3': (1344, 1024), '3:4': (1024, 1344), '3:2': (1536, 1024),
    '2:3': (1024, 1536),
}
ASPECT_RATIO_MAP_DALLE = {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792'
}

def format_prompt(prompt, style=None):
    """Aggiunge lo stile al prompt se fornito."""
    if style:
        return f"{prompt}, style: {style}"
    return prompt

def get_api_key(model_name):
    """Ottiene la chiave API corretta usando l'helper dei segreti."""
    try:
        if model_name == 'dalle':
            return get_secret('openai_api_key')
        elif model_name == 'stability':
            return get_secret('stability_api_key')
        else:
            raise ValueError("Invalid model name provided to get_api_key")
    except Exception as e:
        print(f"Error retrieving API key for {model_name}: {e}")
        raise exceptions.APIException(
            f"Could not load API key for model '{model_name}'. Check configuration and secrets.",
            code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

def save_temp_image(image_data, model_name, user_id):
    """
    Salva dati immagine (bytes o base64) in una locazione temporanea.
    Restituisce l'URL locale relativo e il path fisico del file salvato.
    """
    try:
        if isinstance(image_data, str): # Assumiamo base64
            img_bytes = base64.b64decode(image_data)
        elif isinstance(image_data, bytes):
            img_bytes = image_data
        else:
            raise TypeError("Invalid image data type provided for saving.")

        # Valida dimensione (opzionale ma buona idea)
        if len(img_bytes) == 0:
            raise ValueError("Cannot save empty image data.")
        # max_size = 10 * 1024 * 1024 # Esempio: 10MB
        # if len(img_bytes) > max_size:
        #     raise ValueError(f"Image size exceeds maximum limit of {max_size // 1024 // 1024}MB.")

        filename = f"{model_name}_{user_id}_{uuid.uuid4()}.png"
        temp_dir_path = Path(settings.MEDIA_ROOT) / settings.TEMP_IMAGE_DIR
        temp_dir_path.mkdir(parents=True, exist_ok=True)
        file_path = temp_dir_path / filename

        with open(file_path, 'wb') as f:
            f.write(img_bytes)

        # Costruisci l'URL relativo a MEDIA_URL
        local_url = f"{settings.MEDIA_URL}{settings.TEMP_IMAGE_DIR}/{filename}"
        print(f"Saved temp image to {file_path}, URL: {local_url}")
        return local_url, file_path # Restituisce URL relativo e path fisico

    except (TypeError, base64.binascii.Error) as e:
         print(f"Error decoding/saving base64 image: {e}")
         raise ValueError("Invalid base64 image data received from API.")
    except Exception as e:
        print(f"Error saving temporary image: {e}")
        raise IOError(f"Failed to save temporary image: {e}")


# --- Viste API ---

class TextToImageView(views.APIView):
    """Genera un'immagine da testo usando DALL-E o Stability AI."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = TextToImageRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        prompt = validated_data['prompt']
        model_name = validated_data['model']
        style = validated_data.get('style')
        aspect_ratio = validated_data.get('aspect_ratio', '1:1')
        user_id = request.user.id

        try:
            api_key = get_api_key(model_name)
            formatted_prompt = format_prompt(prompt, style)

            if model_name == 'dalle':
                api_response = self._call_dalle(api_key, formatted_prompt, aspect_ratio)
                if isinstance(api_response, dict) and 'b64_json' in api_response:
                     local_url_relative, _ = save_temp_image(api_response['b64_json'], model_name, user_id)
                # Se DALL-E restituisse URL esterni e volessimo scaricarli:
                # elif isinstance(api_response, dict) and 'url' in api_response:
                #      print(f"DALL-E returned URL: {api_response['url']}. Downloading...")
                #      response_img = requests.get(api_response['url'], timeout=30)
                #      response_img.raise_for_status()
                #      local_url_relative, _ = save_temp_image(response_img.content, model_name, user_id)
                else:
                     raise ValueError("Unexpected or missing image data in DALL-E API response.")

            elif model_name == 'stability':
                img_base64 = self._call_stability_text(api_key, formatted_prompt, aspect_ratio)
                local_url_relative, _ = save_temp_image(img_base64, model_name, user_id)

            else:
                 # Già validato dal serializer, ma per robustezza
                 return Response({"error": "Invalid model specified"}, status=status.HTTP_400_BAD_REQUEST)

            # --- CORREZIONE: Costruisci il dizionario e passalo direttamente a Response ---
            response_data = {
                'image_url': local_url_relative,
                'prompt_used': formatted_prompt,
                'model_used': model_name
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
            # --- FINE CORREZIONE ---

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error ({model_name}): {e}")
            return Response({"error": f"Failed to connect to {model_name} API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as e: # Cattura errori da API response parsing o save_temp_image
             print(f"Data or Response Format Error ({model_name}): {e}")
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except IOError as e: # Errore specifico da save_temp_image I/O
             print(f"File Saving Error ({model_name}): {e}")
             return Response({"error": "Failed to save generated image locally."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except exceptions.APIException as e: # Cattura errori gestiti (es. chiave, errori API specifici)
             return Response({"error": str(e.detail)}, status=e.status_code)
        except Exception as e:
            print(f"Unexpected Error in TextToImageView ({model_name}): {e}")
            # Considera logging più dettagliato in produzione
            # import traceback; traceback.print_exc();
            return Response({"error": "An unexpected error occurred during image generation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_dalle(self, api_key, prompt, aspect_ratio):
        """Chiama l'API DALL-E (v3 o v2)."""
        api_url = f"{settings.OPENAI_API_BASE_URL}/images/generations"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        size = ASPECT_RATIO_MAP_DALLE.get(aspect_ratio, '1024x1024') # Default

        payload = {
            "model": "dall-e-3", # O "dall-e-2"
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json" # Richiedi base64 per salvarlo localmente
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=90) # Timeout più lungo
            response.raise_for_status()
            data = response.json()
            if data.get('data') and len(data['data']) > 0:
                # Restituisce il primo risultato (es. {'b64_json': '...'})
                return data['data'][0]
            else:
                raise ValueError("No image data found in DALL-E response.")
        except requests.exceptions.HTTPError as e:
             print(f"DALL-E API HTTP Error: {e.response.status_code} - {e.response.text}")
             error_detail = f"DALL-E API Error ({e.response.status_code})"
             try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('error', {}).get('message', e.response.text)}"
             except: pass
             # Lancia eccezione DRF per essere catturata dalla view chiamante
             raise exceptions.APIException(error_detail, code=e.response.status_code)
        # Altre eccezioni (Timeout, ConnectionError) verranno catturate dalla view

    def _call_stability_text(self, api_key, prompt, aspect_ratio):
        """Chiama l'API Stability AI text-to-image."""
        # Considera di rendere l'engine configurabile tramite settings.py
        api_url = f"{settings.STABILITY_API_BASE_URL}/generation/stable-diffusion-xl-1024-v1-0/text-to-image"
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json", "Content-Type": "application/json"}
        width, height = ASPECT_RATIO_MAP_STABILITY.get(aspect_ratio, (1024, 1024))

        payload = {
            "text_prompts": [{"text": prompt}],
            "cfg_scale": 7, "height": height, "width": width,
            "samples": 1, "steps": 30,
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=90) # Timeout più lungo
            response.raise_for_status()
            data = response.json()
            if data.get('artifacts') and len(data['artifacts']) > 0 and 'base64' in data['artifacts'][0]:
                return data['artifacts'][0]['base64']
            else:
                raise ValueError("No valid image artifacts found in Stability AI response.")
        except requests.exceptions.HTTPError as e:
            print(f"Stability API HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"Stability API Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)


class ImageToImageView(views.APIView):
    """Genera un'immagine da un'immagine iniziale e un prompt usando Stability AI."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        prompt = request.data.get('prompt')
        image_file = request.FILES.get('image')
        style = request.data.get('style')
        image_strength_str = request.data.get('image_strength', '0.35')
        user_id = request.user.id

        # Validazione Input
        errors = {}
        if not prompt: errors['prompt'] = "This field is required."
        if not image_file: errors['image'] = "Image file is required."
        try:
            image_strength = float(image_strength_str)
            if not (0.0 <= image_strength <= 1.0):
                 errors['image_strength'] = "Must be a float between 0.0 and 1.0."
        except (TypeError, ValueError):
             errors['image_strength'] = "Invalid number format for image strength."

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            api_key = get_api_key('stability')
            formatted_prompt = format_prompt(prompt, style)

            img_base64 = self._call_stability_image(api_key, formatted_prompt, image_file, image_strength)
            local_url_relative, _ = save_temp_image(img_base64, 'stability_img2img', user_id)

            # --- CORREZIONE: Costruisci il dizionario e passalo direttamente a Response ---
            response_data = {
                'image_url': local_url_relative,
                'prompt_used': formatted_prompt,
                'model_used': 'stability_img2img' # O engine specifico
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
            # --- FINE CORREZIONE ---

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error (Stability Img2Img): {e}")
            return Response({"error": "Failed to connect to Stability API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as e:
             print(f"Data or Response Format Error (Stability Img2Img): {e}")
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except IOError as e:
             print(f"File Saving Error (Stability Img2Img): {e}")
             return Response({"error": "Failed to save generated image locally."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except exceptions.APIException as e:
             return Response({"error": str(e.detail)}, status=e.status_code)
        except Exception as e:
            print(f"Unexpected Error in ImageToImageView: {e}")
            return Response({"error": "An unexpected error occurred during image-to-image generation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_stability_image(self, api_key, prompt, image_file, image_strength):
        """Chiama l'API Stability AI image-to-image."""
        # Verifica engine corretto per img2img
        api_url = f"{settings.STABILITY_API_BASE_URL}/generation/stable-diffusion-v1-6/image-to-image"
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
        # NOTA: Leggi il file in memoria per passarlo correttamente a requests
        # Questo evita potenziali problemi con il modo in cui Django gestisce UploadedFile
        files = {'init_image': image_file.read()}
        data = {
            "image_strength": image_strength,
            "init_image_mode": "IMAGE_STRENGTH",
            "text_prompts[0][text]": prompt,
            "cfg_scale": 7, "samples": 1, "steps": 30,
        }
        try:
            response = requests.post(api_url, headers=headers, files=files, data=data, timeout=90) # Timeout più lungo
            response.raise_for_status()
            res_data = response.json()
            if res_data.get('artifacts') and len(res_data['artifacts']) > 0 and 'base64' in res_data['artifacts'][0]:
                return res_data['artifacts'][0]['base64']
            else:
                raise ValueError("No valid image artifacts found in Stability AI image-to-image response.")
        except requests.exceptions.HTTPError as e:
            print(f"Stability API Img2Img HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"Stability API Img2Img Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)


class PromptEnhanceView(views.APIView):
    """Migliora un prompt utente usando OpenAI Chat API."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = PromptEnhanceRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        original_prompt = serializer.validated_data['prompt']

        try:
             api_key = get_api_key('dalle') # Usa chiave OpenAI
             enhanced_prompt = self._call_openai_chat(api_key, original_prompt)

             if enhanced_prompt:
                 response_data = {
                     'original_prompt': original_prompt,
                     'enhanced_prompt': enhanced_prompt
                 }
                 # Restituisci direttamente il dizionario
                 return Response(response_data, status=status.HTTP_200_OK)
             else:
                  print("Prompt enhancement resulted in empty string or failed.")
                  # Restituisci un errore se l'AI non ha dato output utile
                  return Response({"error": "Could not enhance prompt. AI returned an empty response."}, status=status.HTTP_400_BAD_REQUEST)

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error (OpenAI Chat): {e}")
            return Response({"error": "Failed to connect to OpenAI API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except exceptions.APIException as e: # Cattura errori API OpenAI o chiave non trovata
             return Response({"error": str(e.detail)}, status=e.status_code)
        except ValueError as e: # Es. se _call_openai_chat solleva errore
             print(f"Value Error (OpenAI Chat): {e}")
             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            print(f"Unexpected Error in PromptEnhanceView: {e}")
            return Response({"error": "An unexpected error occurred during prompt enhancement."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_openai_chat(self, api_key, prompt):
        """Chiama OpenAI Chat Completion API per migliorare il prompt."""
        api_url = f"{settings.OPENAI_API_BASE_URL}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        system_message = """You are an assistant specialized in translating and improving user prompts for image generation AIs like DALL-E and Stable Diffusion. Your task is to:
        1. Translate the user's prompt into English if it's not already.
        2. Enhance the prompt by adding descriptive details, specifying artistic style (e.g., photorealistic, cartoon, watercolor, cyberpunk), mood (e.g., dramatic, serene, joyful), and composition (e.g., wide angle, close-up, bird's eye view) based on the original request's intent. Aim for a concise yet evocative prompt.
        3. IMPORTANT: Your final output MUST be ONLY the enhanced English prompt, nothing else. No introductory phrases, explanations, or conversational text."""

        payload = {
            "model": "gpt-4", # O gpt-3.5-turbo
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7, "max_tokens": 150
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get('choices') and len(data['choices']) > 0:
                message_content = data['choices'][0].get('message', {}).get('content')
                if message_content:
                    enhanced = message_content.strip()
                    # Rimuovi virgolette esterne se presenti
                    if len(enhanced) >= 2 and enhanced.startswith('"') and enhanced.endswith('"'):
                        enhanced = enhanced[1:-1].strip()
                    # Restituisci None se vuoto dopo pulizia
                    return enhanced if enhanced else None
                else: return None # Contenuto vuoto o mancante
            else:
                # L'AI potrebbe non aver generato nulla
                print("Warning: No completion choices found in OpenAI response.")
                return None # Restituisci None invece di sollevare errore qui
        except requests.exceptions.HTTPError as e:
            print(f"OpenAI Chat API HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"OpenAI Chat API Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('error', {}).get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)
        # Altre eccezioni requests verranno catturate dalla vista


class ImageSaveView(views.APIView):
    """Salva un'immagine generata (precedentemente temporanea) nel DB e sposta il file."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = ImageSaveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        temp_url_relative = validated_data['image_url'] # Es: /media/temp_generated/...
        user_id = request.user.id

        try:
            # 1. Verifica e ottieni path fisico sorgente
            if not temp_url_relative or not temp_url_relative.startswith(settings.MEDIA_URL):
                raise ValueError("Invalid temporary URL format provided.")

            # Rimuovi MEDIA_URL per ottenere path relativo a MEDIA_ROOT
            relative_temp_path = temp_url_relative[len(settings.MEDIA_URL):]

            # Validazione di sicurezza sul path relativo
            if ".." in relative_temp_path or relative_temp_path.startswith("/"):
                 raise ValueError("Invalid path characters in temporary URL.")

            source_physical_path = (Path(settings.MEDIA_ROOT) / relative_temp_path).resolve()

            # Assicurati che il path sorgente sia effettivamente dentro MEDIA_ROOT/temp
            temp_dir_physical = (Path(settings.MEDIA_ROOT) / settings.TEMP_IMAGE_DIR).resolve()
            if not source_physical_path.is_relative_to(temp_dir_physical):
                 raise ValueError("Temporary file path is outside the allowed temporary directory.")

            filename = source_physical_path.name

            if not source_physical_path.exists() or not source_physical_path.is_file():
                print(f"Temporary file not found at {source_physical_path}")
                raise FileNotFoundError("Temporary image file not found. It may have expired or been deleted.")

            # 2. Determina path destinazione e sposta/rinomina se necessario
            user_save_dir_relative = settings.SAVED_IMAGE_DIR_FORMAT.format(user_id=user_id)
            user_save_dir_physical = (Path(settings.MEDIA_ROOT) / user_save_dir_relative).resolve()
            user_save_dir_physical.mkdir(parents=True, exist_ok=True)
            dest_physical_path = user_save_dir_physical / filename

            # Gestione collisione nomi
            if dest_physical_path.exists():
                base, ext = os.path.splitext(filename)
                new_filename = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
                dest_physical_path = user_save_dir_physical / new_filename
                filename = new_filename # Aggiorna per DB
                print(f"Destination file existed, renaming to {new_filename}")

            shutil.move(str(source_physical_path), str(dest_physical_path))
            print(f"Moved image from {source_physical_path} to {dest_physical_path}")

            # 3. Crea record DB
            # Il path per ImageField è relativo a MEDIA_ROOT
            relative_save_path = os.path.join(user_save_dir_relative, filename)

            new_image = GeneratedImage(
                owner_id=user_id,
                prompt=validated_data.get('prompt', ''),
                style=validated_data.get('style'),
                model_used=validated_data.get('model', ''),
                # Usa nome dal form se fornito, altrimenti il nome file
                name=validated_data.get('name') or filename,
                description=validated_data.get('description', ''),
                image_file=relative_save_path
            )
            new_image.full_clean() # Valida il modello
            new_image.save() # Salva e popola width/height

            # 4. Serializza e restituisci
            response_serializer = ImageSaveResponseSerializer(new_image, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except FileNotFoundError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, DjangoValidationError) as e: # Cattura anche errori di validazione modello
             # Se è un errore di validazione, potremmo voler restituire i dettagli
             error_msg = getattr(e, 'message_dict', str(e))
             print(f"Validation or Value Error saving image: {error_msg}")
             return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error saving image or moving file: {e}")
            # Considera logica di rollback (cancellare file spostato se DB fallisce)
            return Response({"error": "Failed to save image record."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- ViewSet per Galleria Immagini ---
class UserGalleryViewSet(viewsets.ModelViewSet):
    """
    API endpoint per la galleria utente (lista, dettaglio, aggiornamento, eliminazione).
    """
    serializer_class = GeneratedImageSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    # Metodi permessi
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """Filtra le immagini per l'utente autenticato."""
        user = self.request.user
        # Non c'è bisogno di controllare user.is_authenticated perché permission_classes lo fa
        # JWTCustomAuth assicura che user.id esista se IsAuthenticated passa
        return GeneratedImage.objects.filter(owner_id=user.id).order_by('-created_at')

    # DRF gestisce retrieve (GET /gallery/{pk}/)
    # DRF gestisce partial_update (PATCH /gallery/{pk}/) usando il serializer
    # DRF gestisce destroy (DELETE /gallery/{pk}/) chiamando instance.delete() (che cancella il file)

    # Esempio override per loggare l'eliminazione (opzionale)
    # def perform_destroy(self, instance):
    #     print(f"User {self.request.user.id} deleting image {instance.id}")
    #     # La cancellazione file avviene nel modello .delete()
    #     instance.delete()