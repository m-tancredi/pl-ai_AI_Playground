# pl-ai/backend/image_generator_service/generator_api/authentication.py
import jwt
from django.conf import settings
# Rimuovi: from django.contrib.auth.models import AnonymousUser
# Rimuovi: from django.contrib.auth import get_user_model (se presente)
# Rimuovi: from django.utils.functional import SimpleLazyObject (se presente)
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings

# --- Definisci una classe Utente Fittizia minimale ---
# Non eredita da nulla di Django Auth per evitare import problematici
class JWTSimpleUser:
    """
    Un oggetto utente fittizio, minimale e in-memory per DRF.
    Ha solo 'id' e 'is_authenticated = True'.
    """
    def __init__(self, user_id=None):
        self.id = user_id
        self.pk = user_id # Alias comune per id, usato da alcune parti di DRF/Django

    # La property is_authenticated è fondamentale per le permission checks
    @property
    def is_authenticated(self):
        return True

    # Definisci altri metodi/proprietà richiesti da DRF/Django se necessario,
    # ma per IsAuthenticated e accedere a request.user.id questo basta.
    # Ad esempio, is_anonymous potrebbe essere utile definirlo come False.
    @property
    def is_anonymous(self):
        return False

    # Metodo __str__ per rappresentazione
    def __str__(self):
        return f"JWTSimpleUser(id={self.id})"
# --- Fine classe utente fittizia ---


class JWTCustomAuthentication(authentication.BaseAuthentication):
    """
    Autenticazione JWT custom per validare token dall'auth_service
    senza fare query sul DB utenti locale. Crea un utente fittizio in memoria.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None: return None
        raw_token = self.get_raw_token(header)
        if raw_token is None: return None

        try:
            validated_token = AccessToken(raw_token)
            # Verifica implicita o esplicita se necessario
            user_id_claim = simple_jwt_settings.USER_ID_CLAIM
            user_id = validated_token.payload.get(user_id_claim)

            if user_id is None:
                raise InvalidToken("Token does not contain user identification")

            # --- Usa la nuova classe utente fittizia ---
            user = JWTSimpleUser(user_id=user_id)
            # --- Fine modifica ---

            return (user, validated_token)

        except TokenError as e:
            raise InvalidToken(f"Token validation error: {e}") from e
        except Exception as e:
            print(f"Unexpected error during JWT authentication: {e}")
            raise exceptions.AuthenticationFailed("Unexpected error processing token.")

    def get_header(self, request):
        # ... (invariato) ...
        header = request.META.get(simple_jwt_settings.AUTH_HEADER_NAME)
        if isinstance(header, str): header = header.encode('iso-8859-1')
        return header

    def get_raw_token(self, header):
        # ... (invariato) ...
        parts = header.split()
        auth_header_types = simple_jwt_settings.AUTH_HEADER_TYPES
        if len(parts) == 0: return None
        if parts[0].decode('iso-8859-1') not in auth_header_types: return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Bad authorization header", code="bad_authorization_header")
        return parts[1]