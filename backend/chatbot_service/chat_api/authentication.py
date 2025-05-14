# chat_api/authentication.py
import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings

class SimpleUser(AnonymousUser):
    def __init__(self, user_id=None):
        self.id = user_id
        self._is_authenticated = True

    @property
    def is_authenticated(self):
        return self._is_authenticated

class JWTCustomAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None
        try:
            validated_token = AccessToken(raw_token)
            # La verifica della firma e della scadenza avviene implicitamente
            # quando si accede a `validated_token.payload`
            user_id_claim = simple_jwt_settings.USER_ID_CLAIM
            user_id = validated_token.payload.get(user_id_claim)

            if user_id is None:
                raise InvalidToken("Token does not contain user identification")

            user = SimpleUser(user_id=user_id)
            return (user, validated_token) # Restituisce utente e token
        except TokenError as e:
            raise InvalidToken(f"Token validation error: {e}") from e
        except Exception as e:
            # Logga l'eccezione per debug
            print(f"Unexpected error during JWT authentication: {e}")
            raise exceptions.AuthenticationFailed("Unexpected error processing token.")


    def get_header(self, request):
        header = request.META.get(simple_jwt_settings.AUTH_HEADER_NAME)
        if isinstance(header, str):
            header = header.encode('iso-8859-1') # Codifica standard HTTP
        return header

    def get_raw_token(self, header):
        parts = header.split()
        auth_header_types = simple_jwt_settings.AUTH_HEADER_TYPES

        if len(parts) == 0:
            return None # Header vuoto

        if parts[0].decode('iso-8859-1') not in auth_header_types:
             # Ignora header che non iniziano con "Bearer" (o tipi configurati)
            return None

        if len(parts) != 2:
            raise exceptions.AuthenticationFailed(
                "Authorization header must contain two parts", code="bad_authorization_header"
            )
        return parts[1] # La parte del token raw