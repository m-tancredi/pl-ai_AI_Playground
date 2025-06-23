import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

class SimpleUser:
    """Utente semplificato per microservizi senza database utenti."""
    
    def __init__(self, user_data):
        self.id = user_data.get('user_id')
        self.username = user_data.get('username', '')
        self.email = user_data.get('email', '')
        self.is_staff = user_data.get('is_staff', False)
        self.is_superuser = user_data.get('is_superuser', False)
        self.is_authenticated = True
        self.is_anonymous = False
        self.is_active = True

class JWTCustomAuthentication(BaseAuthentication):
    """Autenticazione JWT personalizzata per microservizi."""
    
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = SimpleUser(payload)
            return (user, token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token scaduto')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Token non valido')
        except Exception as e:
            raise AuthenticationFailed(f'Errore autenticazione: {str(e)}') 