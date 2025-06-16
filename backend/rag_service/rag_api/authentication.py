"""
Autenticazione JWT personalizzata per il rag_service.
"""
import jwt
import logging
from django.contrib.auth.models import User, AnonymousUser
from django.conf import settings
from rest_framework import authentication, exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings

logger = logging.getLogger(__name__)

class SimpleUser(AnonymousUser):
    def __init__(self, user_id=None): 
        self.id = user_id
        self.pk = user_id  # Django usa pk per le query
        self._is_authenticated = True
    
    @property
    def is_authenticated(self): 
        return self._is_authenticated
    
    def __str__(self):
        return f"SimpleUser(id={self.id})"
    
    def __repr__(self):
        return self.__str__()

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
            user_id = validated_token.payload.get(simple_jwt_settings.USER_ID_CLAIM)
            if user_id is None: 
                raise InvalidToken("No user ID in token")
            return (SimpleUser(user_id=user_id), validated_token)
        except TokenError as e: 
            raise InvalidToken(f"Token error: {e}") from e
        except Exception as e: 
            raise exceptions.AuthenticationFailed(f"Token processing error: {e}")
    
    def get_header(self, request):
        header = request.META.get(simple_jwt_settings.AUTH_HEADER_NAME)
        if isinstance(header, str): 
            header = header.encode('iso-8859-1')
        return header
    
    def get_raw_token(self, header):
        parts = header.split()
        if len(parts) == 0 or parts[0].decode('iso-8859-1') not in simple_jwt_settings.AUTH_HEADER_TYPES or len(parts) != 2: 
            return None
        return parts[1]

# Alias per compatibilità
ServiceTokenAuthentication = JWTCustomAuthentication

class LegacyJWTCustomAuthentication(BaseAuthentication):
    """
    Autenticazione JWT personalizzata che valida i token JWT condivisi
    tra i microservizi dell'ecosistema pl-ai.
    """
    
    def authenticate(self, request):
        """
        Autentica l'utente usando il token JWT.
        
        Args:
            request: Richiesta HTTP
            
        Returns:
            tuple: (user, token) se autenticato, None altrimenti
        """
        token = self.get_token_from_request(request)
        
        if not token:
            return None
        
        try:
            payload = self.decode_token(token)
            user = self.get_user_from_payload(payload)
            return (user, token)
            
        except (jwt.InvalidTokenError, AuthenticationFailed) as e:
            logger.warning(f"Autenticazione JWT fallita: {str(e)}")
            raise AuthenticationFailed('Token JWT non valido')
        except Exception as e:
            logger.error(f"Errore durante l'autenticazione JWT: {str(e)}")
            raise AuthenticationFailed('Errore nell\'autenticazione')
    
    def get_token_from_request(self, request):
        """
        Estrae il token JWT dalla richiesta.
        
        Args:
            request: Richiesta HTTP
            
        Returns:
            str: Token JWT o None se non trovato
        """
        # Cerca nell'header Authorization
        authorization_header = request.META.get('HTTP_AUTHORIZATION')
        
        if authorization_header:
            try:
                # Format: "Bearer <token>"
                prefix, token = authorization_header.split(' ', 1)
                if prefix.lower() == 'bearer':
                    return token
            except ValueError:
                pass
        
        # Cerca nei cookie (fallback)
        token = request.COOKIES.get('access_token')
        if token:
            return token
        
        return None
    
    def decode_token(self, token):
        """
        Decodifica e valida il token JWT.
        
        Args:
            token (str): Token JWT
            
        Returns:
            dict: Payload del token
            
        Raises:
            jwt.InvalidTokenError: Se il token non è valido
        """
        try:
            # Usa la stessa chiave segreta condivisa tra i microservizi
            secret_key = settings.JWT_SECRET_KEY
            
            payload = jwt.decode(
                token,
                secret_key,
                algorithms=['HS256']
            )
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token JWT scaduto')
        except jwt.InvalidSignatureError:
            raise AuthenticationFailed('Firma JWT non valida')
        except jwt.DecodeError:
            raise AuthenticationFailed('Token JWT malformato')
        except Exception as e:
            logger.error(f"Errore nella decodifica del token JWT: {str(e)}")
            raise AuthenticationFailed('Token JWT non valido')
    
    def get_user_from_payload(self, payload):
        """
        Ottiene l'utente dal payload del token.
        
        Args:
            payload (dict): Payload del token JWT
            
        Returns:
            User: Istanza dell'utente Django
            
        Raises:
            AuthenticationFailed: Se l'utente non è trovato o non è valido
        """
        try:
            # Estrai l'ID utente dal payload
            user_id = payload.get('user_id')
            if not user_id:
                raise AuthenticationFailed('ID utente mancante nel token')
            
            # Cerca l'utente nel database
            try:
                user = User.objects.get(id=user_id, is_active=True)
                return user
            except User.DoesNotExist:
                raise AuthenticationFailed('Utente non trovato o non attivo')
                
        except KeyError as e:
            logger.error(f"Campo mancante nel payload JWT: {str(e)}")
            raise AuthenticationFailed('Payload JWT incompleto')
        except Exception as e:
            logger.error(f"Errore nel recupero dell'utente: {str(e)}")
            raise AuthenticationFailed('Errore nel recupero dell\'utente')
    
    def authenticate_header(self, request):
        """
        Restituisce l'header WWW-Authenticate per le risposte 401.
        
        Args:
            request: Richiesta HTTP
            
        Returns:
            str: Valore dell'header
        """
        return 'Bearer realm="api"'

class OptionalJWTAuthentication(JWTCustomAuthentication):
    """
    Autenticazione JWT opzionale che non fallisce se il token non è presente.
    Utile per endpoint che possono funzionare sia con che senza autenticazione.
    """
    
    def authenticate(self, request):
        """
        Autentica l'utente se il token è presente, altrimenti restituisce None.
        
        Args:
            request: Richiesta HTTP
            
        Returns:
            tuple: (user, token) se autenticato, None se non c'è token
        """
        token = self.get_token_from_request(request)
        
        if not token:
            return None
        
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            # Se il token è presente ma non valido, solleva comunque l'eccezione
            raise 