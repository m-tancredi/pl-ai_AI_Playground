"""
Servizio per l'integrazione con Supabase
Gestisce l'autenticazione sociale e la sincronizzazione degli utenti
"""

import os
import jwt
import logging
from typing import Dict, Optional, Any
from datetime import datetime, timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from supabase import create_client, Client
import httpx

User = get_user_model()
logger = logging.getLogger(__name__)


class SupabaseService:
    """
    Servizio per gestire l'autenticazione con Supabase
    """
    
    def __init__(self):
        """Inizializza il client Supabase"""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL e SUPABASE_KEY devono essere configurati")
        
        self.supabase: Client = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_KEY
        )
        self.service_key = settings.SUPABASE_SERVICE_KEY
    
    def verify_supabase_token(self, token: str) -> Dict[str, Any]:
        """
        Verifica un token JWT di Supabase
        
        Args:
            token: Il token JWT da verificare
            
        Returns:
            I dati decodificati del token
            
        Raises:
            AuthenticationFailed: Se il token non è valido
        """
        try:
            if not settings.SUPABASE_JWT_SECRET:
                raise AuthenticationFailed("SUPABASE_JWT_SECRET non configurato")
            
            decoded_token = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=[settings.SUPABASE_JWT_ALGORITHM],
                options={"verify_aud": False}  # Supabase tokens might not have audience
            )
            
            # Verifica la scadenza
            exp = decoded_token.get('exp')
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                raise AuthenticationFailed("Token scaduto")
            
            return decoded_token
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token scaduto")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Token non valido: {str(e)}")
    
    def get_or_create_user_from_supabase(self, supabase_user_data: Dict[str, Any]) -> User:
        """
        Crea o aggiorna un utente basandosi sui dati di Supabase
        
        Args:
            supabase_user_data: Dati dell'utente provenienti da Supabase
            
        Returns:
            L'istanza dell'utente Django
        """
        try:
            # Estrai informazioni base
            supabase_id = supabase_user_data.get('sub') or supabase_user_data.get('id')
            email = supabase_user_data.get('email')
            
            # Estrai metadati utente
            user_metadata = supabase_user_data.get('user_metadata', {})
            app_metadata = supabase_user_data.get('app_metadata', {})
            
            # Estrai informazioni dal provider
            provider = app_metadata.get('provider', 'email')
            providers = app_metadata.get('providers', [])
            
            if not email:
                raise ValueError("Email mancante nei dati di Supabase")
            
            # Cerca l'utente esistente per email
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': self._generate_username_from_email(email),
                    'first_name': user_metadata.get('full_name', '').split(' ')[0] if user_metadata.get('full_name') else '',
                    'last_name': ' '.join(user_metadata.get('full_name', '').split(' ')[1:]) if user_metadata.get('full_name') and len(user_metadata.get('full_name', '').split(' ')) > 1 else '',
                    'is_active': True,
                }
            )
            
            # Aggiorna i dati dell'utente se necessario
            if not created and settings.SOCIAL_AUTH_UPDATE_USER_DATA:
                updated = False
                
                # Aggiorna nome e cognome se disponibili e non già impostati
                if user_metadata.get('full_name') and not user.first_name:
                    names = user_metadata['full_name'].split(' ')
                    user.first_name = names[0]
                    if len(names) > 1:
                        user.last_name = ' '.join(names[1:])
                    updated = True
                
                if updated:
                    user.save()
            
            # Salva informazioni aggiuntive se necessario
            self._save_social_auth_data(user, supabase_id, provider, supabase_user_data)
            
            logger.info(f"Utente {'creato' if created else 'aggiornato'}: {user.email} tramite {provider}")
            
            return user
            
        except Exception as e:
            logger.error(f"Errore nella creazione/aggiornamento utente: {str(e)}")
            raise
    
    def _generate_username_from_email(self, email: str) -> str:
        """
        Genera un username univoco basandosi sull'email
        
        Args:
            email: L'indirizzo email
            
        Returns:
            Un username univoco
        """
        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1
        
        return username
    
    def _save_social_auth_data(self, user: User, supabase_id: str, provider: str, user_data: Dict[str, Any]):
        """
        Salva dati aggiuntivi dell'autenticazione sociale
        
        Args:
            user: L'utente Django
            supabase_id: L'ID di Supabase
            provider: Il provider di autenticazione (google, apple, github)
            user_data: Tutti i dati dell'utente da Supabase
        """
        # Per ora salviamo solo le informazioni base
        # In futuro si potrebbe creare un modello dedicato per i dati social
        pass
    
    async def get_social_auth_url(self, provider: str, redirect_url: str = None) -> str:
        """
        Genera URL per l'autenticazione sociale
        
        Args:
            provider: Il provider (google, apple, github)
            redirect_url: URL di redirect dopo l'autenticazione
            
        Returns:
            L'URL per iniziare il flusso di autenticazione
        """
        if provider not in settings.SOCIAL_AUTH_PROVIDERS:
            raise ValueError(f"Provider {provider} non supportato")
        
        provider_config = settings.SOCIAL_AUTH_PROVIDERS[provider]
        if not provider_config.get('enabled'):
            raise ValueError(f"Provider {provider} non abilitato")
        
        try:
            # Per Supabase, l'URL viene generato lato client
            # Qui ritorniamo le configurazioni necessarie
            base_url = settings.SUPABASE_URL
            redirect_to = redirect_url or settings.SOCIAL_AUTH_SUCCESS_URL
            
            # URL base per il provider specifico
            auth_url = f"{base_url}/auth/v1/authorize"
            
            return {
                'auth_url': auth_url,
                'provider': provider,
                'redirect_to': redirect_to,
                'client_id': provider_config.get('client_id')
            }
            
        except Exception as e:
            logger.error(f"Errore nella generazione URL per {provider}: {str(e)}")
            raise
    
    def exchange_code_for_tokens(self, code: str, provider: str) -> Dict[str, Any]:
        """
        Scambia il codice di autorizzazione con i token
        
        Args:
            code: Il codice di autorizzazione
            provider: Il provider di autenticazione
            
        Returns:
            I token e i dati dell'utente
        """
        try:
            # Utilizziamo Supabase per gestire lo scambio
            response = self.supabase.auth.exchange_code_for_session(code)
            
            if not response.session:
                raise AuthenticationFailed("Impossibile ottenere la sessione da Supabase")
            
            return {
                'access_token': response.session.access_token,
                'refresh_token': response.session.refresh_token,
                'user_data': response.user.__dict__ if response.user else None
            }
            
        except Exception as e:
            logger.error(f"Errore nello scambio codice per {provider}: {str(e)}")
            raise AuthenticationFailed(f"Errore nell'autenticazione: {str(e)}")


# Istanza globale del servizio
supabase_service = SupabaseService() 