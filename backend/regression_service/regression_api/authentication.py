# Identico a JWTCustomAuthentication degli altri servizi
import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings

class SimpleUser(AnonymousUser):
    def __init__(self, user_id=None): self.id = user_id; self._is_authenticated = True
    @property
    def is_authenticated(self): return self._is_authenticated

class JWTCustomAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = self.get_header(request);
        if header is None: return None
        raw_token = self.get_raw_token(header);
        if raw_token is None: return None
        try:
            validated_token = AccessToken(raw_token)
            user_id = validated_token.payload.get(simple_jwt_settings.USER_ID_CLAIM)
            if user_id is None: raise InvalidToken("No user ID in token")
            return (SimpleUser(user_id=user_id), validated_token)
        except TokenError as e: raise InvalidToken(f"Token error: {e}") from e
        except Exception as e: raise exceptions.AuthenticationFailed(f"Token processing error: {e}")
    def get_header(self, request):
        header = request.META.get(simple_jwt_settings.AUTH_HEADER_NAME)
        if isinstance(header, str): header = header.encode('iso-8859-1')
        return header
    def get_raw_token(self, header):
        parts = header.split()
        if len(parts) == 0 or parts[0].decode('iso-8859-1') not in simple_jwt_settings.AUTH_HEADER_TYPES or len(parts) != 2: return None
        return parts[1]