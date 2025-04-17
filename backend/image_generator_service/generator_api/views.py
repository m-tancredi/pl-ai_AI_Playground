import os
import uuid
import base64
import requests
import shutil
from pathlib import Path
from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import views, status, permissions, exceptions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .serializers import (
    TextToImageRequestSerializer, ImageResponseSerializer,
    PromptEnhanceRequestSerializer, PromptEnhanceResponseSerializer,
    ImageSaveRequestSerializer, ImageSaveResponseSerializer
    # ImageToImageRequestSerializer non usato per deserializzare multipart direttamente
)
from .authentication import JWTCustomAuthentication
from .config.secrets import get_secret # Importa l'helper per leggere i segreti

# --- Costanti API e Helper ---
ASPECT_RATIO_MAP_STABILITY = {
    '1:1': (1024, 1024), '16:9': (1536, 864), '9:16': (864, 1536),
    '4:3': (1344, 1024), '3:4': (1024, 1344), '3:2': (1536, 1024),
    '2:3': (1024, 1536), # Add more if needed
}
ASPECT_RATIO_MAP_DALLE = { # DALL-E 3 supporta solo questi, DALL-E 2 altri
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792'
}

def format_prompt(prompt, style=None):
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
            raise ValueError("Invalid model name")
    except Exception as e: # Cattura ImproperlyConfigured o altri errori
        print(f"Error retrieving API key for {model_name}: {e}")
        # Lancia eccezione DRF che verrà catturata dalla view
        raise exceptions.APIException(f"Could not load API key for model '{model_name}'. Check configuration.", code=status.HTTP_503_SERVICE_UNAVAILABLE)

def save_temp_image(image_data, model_name, user_id):
    """Salva dati immagine (bytes o base64) in una locazione temporanea."""
    try:
        if isinstance(image_data, str): # Assumiamo base64
            img_bytes = base64.b64decode(image_data)
        elif isinstance(image_data, bytes):
            img_bytes = image_data
        else:
            raise TypeError("Invalid image data type for saving.")

        # Crea filename unico
        filename = f"{model_name}_{user_id}_{uuid.uuid4()}.png"
        temp_dir_path = Path(settings.MEDIA_ROOT) / settings.TEMP_IMAGE_DIR
        temp_dir_path.mkdir(parents=True, exist_ok=True) # Assicura che la dir esista
        file_path = temp_dir_path / filename

        with open(file_path, 'wb') as f:
            f.write(img_bytes)

        # Costruisci l'URL locale relativo a MEDIA_URL
        local_url = f"{settings.MEDIA_URL}{settings.TEMP_IMAGE_DIR}/{filename}"
        print(f"Saved temp image to {file_path}, URL: {local_url}")
        return local_url, file_path # Restituisce URL e path fisico

    except (TypeError, base64.binascii.Error) as e:
         print(f"Error decoding/saving base64 image: {e}")
         raise ValueError("Invalid base64 image data received from API.")
    except Exception as e:
        print(f"Error saving temporary image: {e}")
        raise exceptions.APIException("Failed to save temporary image.", code=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Viste API ---

class TextToImageView(views.APIView):
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
        user_id = request.user.id # Dall'utente fittizio creato da JWTCustomAuth

        api_key = get_api_key(model_name) # Gestisce errore chiave non trovata
        formatted_prompt = format_prompt(prompt, style)

        try:
            if model_name == 'dalle':
                image_url = self._call_dalle(api_key, formatted_prompt, aspect_ratio)
                # DALL-E di solito restituisce URL, non base64
                # Se restituisse base64, dovremmo scaricare e salvare o processarlo
                # Per ora assumiamo restituisca URL direttamente utilizzabile (magari temporaneo)
                # *** MODIFICA NECESSARIA: DALL-E API restituisce b64_json o url ***
                # Assumiamo b64_json per salvarlo localmente
                if isinstance(image_url, dict) and 'b64_json' in image_url:
                     local_url, _ = save_temp_image(image_url['b64_json'], model_name, user_id)
                elif isinstance(image_url, dict) and 'url' in image_url:
                     # Se è un URL esterno, non lo salviamo temp, lo restituiamo diretto?
                     # O lo scarichiamo e salviamo temp? Scarichiamo per coerenza.
                     print(f"DALL-E returned URL: {image_url['url']}. Downloading...")
                     response_img = requests.get(image_url['url'], timeout=30)
                     response_img.raise_for_status()
                     local_url, _ = save_temp_image(response_img.content, model_name, user_id)
                else:
                     raise ValueError("Unexpected response format from DALL-E API")

            elif model_name == 'stability':
                img_base64 = self._call_stability_text(api_key, formatted_prompt, aspect_ratio)
                local_url, _ = save_temp_image(img_base64, model_name, user_id)

            else: # Già validato dal serializer, ma per sicurezza
                 return Response({"error": "Invalid model specified"}, status=status.HTTP_400_BAD_REQUEST)

            response_serializer = ImageResponseSerializer(data={
                'image_url': request.build_absolute_uri(local_url), # Costruisci URL completo
                'prompt_used': formatted_prompt,
                'model_used': model_name
            })
            response_serializer.is_valid() # Dovrebbe essere sempre valido
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error ({model_name}): {e}")
            return Response({"error": f"Failed to connect to {model_name} API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as e: # Cattura errori da save_temp_image o formattazione
             print(f"Value Error ({model_name}): {e}")
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except exceptions.APIException as e: # Cattura errori da get_api_key o interni
             return Response({"error": str(e.detail)}, status=e.status_code)
        except Exception as e:
            print(f"Unexpected Error ({model_name}): {e}")
            return Response({"error": "An unexpected error occurred during image generation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_dalle(self, api_key, prompt, aspect_ratio):
        # Usa DALL-E 3 (più recente) o DALL-E 2
        api_url = f"{settings.OPENAI_API_BASE_URL}/images/generations"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        size = ASPECT_RATIO_MAP_DALLE.get(aspect_ratio)
        if not size: size = '1024x1024' # Default DALL-E 3

        payload = {
            "model": "dall-e-3", # O "dall-e-2"
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json" # O 'url'
            # "quality": "hd" # Per DALL-E 3 se high_quality è richiesto
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=60) # Timeout più lungo per immagini
            response.raise_for_status() # Lancia eccezione per errori HTTP 4xx/5xx
            data = response.json()
            # Estrai b64_json o url
            if data.get('data') and len(data['data']) > 0:
                return data['data'][0] # Restituisce {'b64_json': '...'} o {'url': '...'}
            else:
                raise ValueError("No image data found in DALL-E response.")
        except requests.exceptions.HTTPError as e:
             print(f"DALL-E API HTTP Error: {e.response.status_code} - {e.response.text}")
             error_detail = f"DALL-E API Error ({e.response.status_code})"
             try: # Prova a parsare il JSON dell'errore
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('error', {}).get('message', e.response.text)}"
             except: pass # Ignora se non è JSON
             raise exceptions.APIException(error_detail, code=e.response.status_code)

    def _call_stability_text(self, api_key, prompt, aspect_ratio):
        api_url = f"{settings.STABILITY_API_BASE_URL}/generation/stable-diffusion-xl-1024-v1-0/text-to-image" # O altro engine
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json", "Content-Type": "application/json"}
        width, height = ASPECT_RATIO_MAP_STABILITY.get(aspect_ratio, (1024, 1024))

        payload = {
            "text_prompts": [{"text": prompt}],
            "cfg_scale": 7,
            "height": height,
            "width": width,
            "samples": 1,
            "steps": 30, # O 50
            # Aggiungere altri parametri Stability AI se necessario (seed, style_preset, etc.)
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            # Stability API restituisce base64 nell'array 'artifacts'
            if data.get('artifacts') and len(data['artifacts']) > 0:
                return data['artifacts'][0]['base64']
            else:
                raise ValueError("No image artifacts found in Stability AI response.")
        except requests.exceptions.HTTPError as e:
            print(f"Stability API HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"Stability API Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)


class ImageToImageView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    parser_classes = [MultiPartParser, FormParser] # Per gestire upload file

    def post(self, request, *args, **kwargs):
        # Validazione manuale input multipart
        prompt = request.data.get('prompt')
        image_file = request.FILES.get('image')
        style = request.data.get('style')
        image_strength = request.data.get('image_strength', 0.35) # Default
        user_id = request.user.id

        if not prompt: return Response({"error": "Prompt is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not image_file: return Response({"error": "Image file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            image_strength = float(image_strength)
            if not (0.0 <= image_strength <= 1.0): raise ValueError()
        except (TypeError, ValueError):
             return Response({"error": "Invalid image_strength value (must be float between 0.0 and 1.0)."}, status=status.HTTP_400_BAD_REQUEST)

        api_key = get_api_key('stability')
        formatted_prompt = format_prompt(prompt, style)

        try:
            img_base64 = self._call_stability_image(api_key, formatted_prompt, image_file, image_strength)
            local_url, _ = save_temp_image(img_base64, 'stability_img2img', user_id)

            response_serializer = ImageResponseSerializer(data={
                'image_url': request.build_absolute_uri(local_url),
                'prompt_used': formatted_prompt,
                'model_used': 'stability_img2img'
            })
            response_serializer.is_valid()
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error (Stability Img2Img): {e}")
            return Response({"error": "Failed to connect to Stability API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as e:
             print(f"Value Error (Stability Img2Img): {e}")
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except exceptions.APIException as e:
             return Response({"error": str(e.detail)}, status=e.status_code)
        except Exception as e:
            print(f"Unexpected Error (Stability Img2Img): {e}")
            return Response({"error": "An unexpected error occurred during image-to-image generation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_stability_image(self, api_key, prompt, image_file, image_strength):
        # Nota: l'engine potrebbe essere diverso per image-to-image
        api_url = f"{settings.STABILITY_API_BASE_URL}/generation/stable-diffusion-v1-6/image-to-image" # Verifica engine corretto
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
        files = {
            'init_image': image_file, # Passa l'oggetto file caricato
        }
        data = {
            "image_strength": image_strength,
            "init_image_mode": "IMAGE_STRENGTH",
            "text_prompts[0][text]": prompt,
            "cfg_scale": 7,
            "samples": 1,
            "steps": 30,
        }

        try:
            response = requests.post(api_url, headers=headers, files=files, data=data, timeout=60)
            response.raise_for_status()
            res_data = response.json()
            if res_data.get('artifacts') and len(res_data['artifacts']) > 0:
                return res_data['artifacts'][0]['base64']
            else:
                raise ValueError("No image artifacts found in Stability AI image-to-image response.")
        except requests.exceptions.HTTPError as e:
            print(f"Stability API Img2Img HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"Stability API Img2Img Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)


class PromptEnhanceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = PromptEnhanceRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        original_prompt = serializer.validated_data['prompt']
        api_key = get_api_key('dalle') # Usiamo chiave OpenAI

        try:
            enhanced_prompt = self._call_openai_chat(api_key, original_prompt)
            response_serializer = PromptEnhanceResponseSerializer(data={
                'original_prompt': original_prompt,
                'enhanced_prompt': enhanced_prompt
            })
            response_serializer.is_valid()
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException as e:
            print(f"API Connection Error (OpenAI Chat): {e}")
            return Response({"error": "Failed to connect to OpenAI API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except exceptions.APIException as e:
             return Response({"error": str(e.detail)}, status=e.status_code)
        except Exception as e:
            print(f"Unexpected Error (OpenAI Chat): {e}")
            return Response({"error": "An unexpected error occurred during prompt enhancement."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _call_openai_chat(self, api_key, prompt):
        api_url = f"{settings.OPENAI_API_BASE_URL}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # System prompt definito come nel codice Flask originale
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
            "temperature": 0.7, # Un po' di creatività
            "max_tokens": 150 # Limita lunghezza output
        }
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            print("--- OpenAI Chat API Raw Response ---") # DEBUG START
            print(f"Status Code: {response.status_code}")
            try:
                print(f"Response JSON: {response.json()}")
            except Exception as json_err:
                print(f"Response Text (not JSON): {response.text}")
            print("--- End OpenAI Chat API Raw Response ---") # DEBUG END
            response.raise_for_status()
            data = response.json()
            if data.get('choices') and len(data['choices']) > 0:
                message_content = data['choices'][0].get('message', {}).get('content') # Prendi prima il contenuto
                print(f"Extracted content before strip: '{message_content}'") # DEBUG
                if message_content:
                    enhanced = message_content.strip()
                    print(f"Content after strip: '{enhanced}'") # DEBUG
                    # Pulisci virgolette
                    if enhanced.startswith('"') and enhanced.endswith('"'):
                        enhanced = enhanced[1:-1].strip() # Aggiungi strip anche qui
                        print(f"Content after quote removal: '{enhanced}'") # DEBUG
                    # Restituisci solo se non è vuoto dopo tutta la pulizia
                    return enhanced if enhanced else None # Restituisci None se vuoto
                else:
                    print("Warning: message.content is missing or empty in OpenAI response.")
                    return None # Restituisci None se il contenuto è vuoto/mancante
            else:
                print("Warning: No 'choices' found in OpenAI response.")
                raise ValueError("No completion choices found in OpenAI response.")
        except requests.exceptions.HTTPError as e:
            print(f"OpenAI Chat API HTTP Error: {e.response.status_code} - {e.response.text}")
            error_detail = f"OpenAI Chat API Error ({e.response.status_code})"
            try:
                 error_json = e.response.json()
                 error_detail += f": {error_json.get('error', {}).get('message', e.response.text)}"
            except: pass
            raise exceptions.APIException(error_detail, code=e.response.status_code)


class ImageSaveView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def post(self, request, *args, **kwargs):
        serializer = ImageSaveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        temp_url = serializer.validated_data['image_url']
        # Estrai metadati (opzionali, non salvati attivamente senza DB)
        # prompt = serializer.validated_data.get('prompt')
        # model = serializer.validated_data.get('model')
        # style = serializer.validated_data.get('style')
        user_id = request.user.id

        # Logica per copiare il file temporaneo in una locazione persistente
        try:
            # 1. Estrai il nome del file dall'URL temporaneo
            if not temp_url.startswith(settings.MEDIA_URL):
                raise ValueError("Invalid temporary URL format.")
            relative_path = temp_url[len(settings.MEDIA_URL):]
            # Assicura che il path sia sicuro (evita ../ etc.)
            if ".." in relative_path or relative_path.startswith("/"):
                 raise ValueError("Invalid path in temporary URL.")

            source_path = Path(settings.MEDIA_ROOT) / relative_path
            filename = source_path.name

            # 2. Costruisci il percorso di destinazione
            save_dir_format = settings.SAVED_IMAGE_DIR_FORMAT.format(user_id=user_id)
            dest_dir_path = Path(settings.MEDIA_ROOT) / save_dir_format
            dest_dir_path.mkdir(parents=True, exist_ok=True) # Crea la directory utente se non esiste
            dest_path = dest_dir_path / filename

            # 3. Copia o Sposta il file
            if source_path.exists() and source_path.is_file():
                shutil.move(str(source_path), str(dest_path)) # Sposta per evitare duplicati temporanei
                # shutil.copy(str(source_path), str(dest_path)) # O copia se vuoi mantenere il temp
                print(f"Moved image from {source_path} to {dest_path}")
            else:
                print(f"Temporary file not found at {source_path}")
                raise FileNotFoundError("Temporary image file not found. It might have expired or been deleted.")

            # 4. Costruisci l'URL persistente
            saved_relative_path = f"{save_dir_format}/{filename}"
            saved_url = f"{settings.MEDIA_URL}{saved_relative_path}"

            response_serializer = ImageSaveResponseSerializer(data={
                'saved_url': request.build_absolute_uri(saved_url),
                'message': 'Image saved successfully.'
            })
            response_serializer.is_valid()
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except FileNotFoundError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error saving image: {e}")
            return Response({"error": "Failed to save image."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)