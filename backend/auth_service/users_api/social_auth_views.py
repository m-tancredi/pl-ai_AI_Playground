"""
Viste per l'autenticazione sociale tramite Supabase
"""

import logging
from typing import Dict, Any

from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .supabase_service import supabase_service
from .serializers import UserSerializer

logger = logging.getLogger(__name__)


class SocialAuthConfigView(APIView):
    """
    Vista per ottenere la configurazione dell'autenticazione sociale
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        """
        Restituisce la configurazione dei provider di autenticazione sociale abilitati
        """
        try:
            enabled_providers = {}
            
            for provider, config in settings.SOCIAL_AUTH_PROVIDERS.items():
                if config.get('enabled'):
                    enabled_providers[provider] = {
                        'name': provider.title(),
                        'client_id': config.get('client_id'),
                        'enabled': True
                    }
            
            return Response({
                'providers': enabled_providers,
                'supabase_url': settings.SUPABASE_URL,
                'supabase_anon_key': settings.SUPABASE_KEY,
                'redirect_url': settings.SOCIAL_AUTH_SUCCESS_URL
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel recupero configurazione social auth: {str(e)}")
            return Response({
                'error': 'Errore interno del server'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SocialAuthInitView(APIView):
    """
    Vista per iniziare il flusso di autenticazione sociale
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """
        Inizia il flusso di autenticazione per il provider specificato
        
        Body:
        - provider: string (google, apple, github)
        - redirect_url: string (opzionale)
        """
        try:
            provider = request.data.get('provider')
            redirect_url = request.data.get('redirect_url')
            
            if not provider:
                return Response({
                    'error': 'Provider richiesto'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if provider not in settings.SOCIAL_AUTH_PROVIDERS:
                return Response({
                    'error': f'Provider {provider} non supportato'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            provider_config = settings.SOCIAL_AUTH_PROVIDERS[provider]
            if not provider_config.get('enabled'):
                return Response({
                    'error': f'Provider {provider} non abilitato'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Genera la configurazione per il frontend
            auth_config = {
                'provider': provider,
                'supabase_url': settings.SUPABASE_URL,
                'supabase_anon_key': settings.SUPABASE_KEY,
                'redirect_url': redirect_url or settings.SOCIAL_AUTH_SUCCESS_URL,
                'client_id': provider_config.get('client_id') if provider != 'apple' else None
            }
            
            return Response({
                'auth_config': auth_config,
                'message': f'Configurazione per {provider} generata con successo'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nell'inizializzazione social auth: {str(e)}")
            return Response({
                'error': 'Errore interno del server'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SocialAuthCallbackView(APIView):
    """
    Vista per gestire il callback dell'autenticazione sociale
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """
        Gestisce il callback dopo l'autenticazione sociale
        
        Body:
        - access_token: string (token di accesso di Supabase)
        - refresh_token: string (token di refresh di Supabase)
        - provider: string (provider utilizzato)
        """
        try:
            access_token = request.data.get('access_token')
            refresh_token = request.data.get('refresh_token')
            provider = request.data.get('provider', 'unknown')
            
            if not access_token:
                return Response({
                    'error': 'Access token richiesto'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verifica il token di Supabase
            try:
                token_data = supabase_service.verify_supabase_token(access_token)
            except Exception as e:
                logger.error(f"Token Supabase non valido: {str(e)}")
                return Response({
                    'error': 'Token non valido'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # Crea o aggiorna l'utente
            try:
                user = supabase_service.get_or_create_user_from_supabase(token_data)
                
                # Crea il profilo base in user_service per utenti social
                from .user_service_client import user_service_client
                
                try:
                    # Per l'autenticazione sociale, il profilo è sempre incompleto inizialmente
                    user_profile_data = {
                        'user_id': user.id,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'username': user.username,
                        'email': user.email,
                        'registration_completed': False  # Sempre False per auth sociale
                    }
                    
                    # Verifica se il profilo esiste già
                    existing_profile = user_service_client.get_user_profile(str(user.id))
                    if not existing_profile:
                        profile_result = user_service_client.create_user_profile(user_profile_data)
                        if profile_result:
                            logger.info(f"User profile created in user_service for social user {user.id}")
                        else:
                            logger.warning(f"Failed to create user profile in user_service for social user {user.id}")
                    else:
                        logger.info(f"User profile already exists for social user {user.id}")
                        
                except Exception as profile_error:
                    logger.error(f"Error handling user profile for social user {user.id}: {str(profile_error)}")
                    # Non bloccare il flusso di autenticazione se la creazione del profilo fallisce
                
            except Exception as e:
                logger.error(f"Errore nella creazione utente: {str(e)}")
                return Response({
                    'error': 'Errore nella creazione dell\'utente'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Genera i token JWT per il nostro sistema
            refresh = RefreshToken.for_user(user)
            
            # Serializza i dati dell'utente
            user_serializer = UserSerializer(user)
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user_serializer.data,
                'provider': provider,
                'message': f'Autenticazione tramite {provider} completata con successo'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel callback social auth: {str(e)}")
            return Response({
                'error': 'Errore interno del server'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SocialAuthStatusView(APIView):
    """
    Vista per verificare lo stato dell'autenticazione sociale
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Restituisce informazioni sull'utente autenticato tramite social auth
        """
        try:
            user = request.user
            user_serializer = UserSerializer(user)
            
            return Response({
                'user': user_serializer.data,
                'is_social_auth': True,  # In futuro si può tracciare il metodo di auth
                'message': 'Utente autenticato'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Errore nel controllo stato social auth: {str(e)}")
            return Response({
                'error': 'Errore interno del server'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Viste basate su funzioni per compatibilità
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def social_auth_providers(request):
    """
    Restituisce la lista dei provider di autenticazione sociale abilitati
    """
    try:
        enabled_providers = []
        
        for provider, config in settings.SOCIAL_AUTH_PROVIDERS.items():
            if config.get('enabled'):
                enabled_providers.append({
                    'id': provider,
                    'name': provider.title(),
                    'enabled': True
                })
        
        return Response({
            'providers': enabled_providers
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Errore nel recupero provider: {str(e)}")
        return Response({
            'error': 'Errore interno del server'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 