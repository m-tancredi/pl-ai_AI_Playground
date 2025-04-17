import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as simple_jwt_settings

# Ottieni il modello User definito in settings (anche se non lo useremo per query)
User = get_user_model()

# Un semplice oggetto utente in-memory per DRF
class SimpleUser(AnonymousUser):
    """
    Utente fittizio in memoria che ha solo un ID e viene considerato autenticato.
    Necessario per far funzionare request.user e IsAuthenticated senza query al DB.
    """
    def __init__(self, user_id=None):
        self.id = user_id
        # AnonymousUser ha is_authenticated = False di default, lo sovrascriviamo
        self._is_authenticated = True

    @property
    def is_authenticated(self):
        return self._is_authenticated

    # Potresti aggiungere altri attributi se necessari alle tue permission/logiche
    # Esempio: username, email se presenti nel token e vuoi usarli
    # self.username = payload.get('username')

class JWTCustomAuthentication(authentication.BaseAuthentication):
    """
    Autenticazione JWT custom per validare token dall'auth_service
    senza fare query sul DB utenti locale. Crea un utente fittizio in memoria.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None # Nessun header di autenticazione

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None # Header presente ma nessun token trovato

        # Usa le funzioni di validazione di SimpleJWT ma intercetta le eccezioni
        try:
            validated_token = AccessToken(raw_token)
            # Verifica la firma e la scadenza usando la SECRET_KEY dalle settings
            # NOTA: AccessToken(token) NON verifica la firma da solo inizialmente,
            # ma metodi come .payload lo fanno implicitamente.
            # Forziamo la verifica se necessario o ci affidiamo all'accesso al payload.
            # Una verifica esplicita può essere fatta con:
            # from rest_framework_simplejwt.state import token_backend
            # token_backend.decode(raw_token, verify=True)

            # Estrai l'ID utente dal payload del token valido
            user_id_claim = simple_jwt_settings.USER_ID_CLAIM
            user_id = validated_token.payload.get(user_id_claim)

            if user_id is None:
                raise InvalidToken("Token does not contain user identification")

            # Crea l'utente fittizio
            user = SimpleUser(user_id=user_id)

            # Restituisce l'utente fittizio e il token validato
            return (user, validated_token)

        except TokenError as e:
            # Cattura errori di validazione specifici di SimpleJWT (firma, scadenza, formato)
            raise InvalidToken(f"Token validation error: {e}") from e
        except Exception as e:
            # Cattura altri errori imprevisti durante la validazione/decodifica
            print(f"Unexpected error during JWT authentication: {e}")
            raise exceptions.AuthenticationFailed("Unexpected error processing token.")


    def get_header(self, request):
        """Estrae l'header di autorizzazione dalla richiesta."""
        header = request.META.get(simple_jwt_settings.AUTH_HEADER_NAME)
        if isinstance(header, str):
            header = header.encode('iso-8859-1') # Codifica in byte se è stringa
        return header

    def get_raw_token(self, header):
        """Estrae il token JWT raw dall'header."""
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