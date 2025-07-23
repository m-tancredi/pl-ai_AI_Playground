"""
Client per comunicare con il user_service
Gestisce la sincronizzazione dei profili utente tra i servizi
"""

import requests
import logging
from django.conf import settings
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

class UserServiceClient:
    """
    Client per comunicare con il user_service
    """
    
    def __init__(self):
        self.base_url = getattr(settings, 'USER_SERVICE_URL', 'http://user_service:8000')
        self.api_secret = getattr(settings, 'INTERNAL_API_SECRET', '')
        self.timeout = getattr(settings, 'INTER_SERVICE_TIMEOUT', 10)
    
    def _get_headers(self) -> Dict[str, str]:
        """
        Restituisce gli headers per le richieste inter-service
        """
        return {
            'Content-Type': 'application/json',
            'X-Internal-Secret': self.api_secret,
            'User-Agent': 'auth-service/1.0'
        }
    
    def create_user_profile(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Crea un profilo utente nel user_service
        
        Args:
            user_data: Dati dell'utente da creare
            
        Returns:
            I dati del profilo creato o None in caso di errore
        """
        try:
            url = f"{self.base_url}/api/users/"
            
            # Prepara i dati per il user_service
            profile_data = {
                'user_id': str(user_data['user_id']),
                'first_name': user_data.get('first_name', ''),
                'last_name': user_data.get('last_name', ''),
                'username': user_data.get('username', ''),
                'email': user_data.get('email', ''),
                'registration_completed': user_data.get('registration_completed', False)
            }
            
            logger.info(f"Creating user profile in user_service for user {profile_data['user_id']}")
            
            response = requests.post(
                url,
                json=profile_data,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            
            if response.status_code == 201:
                logger.info(f"User profile created successfully for user {profile_data['user_id']}")
                return response.json()
            else:
                logger.error(f"Failed to create user profile. Status: {response.status_code}, Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error communicating with user_service: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating user profile: {str(e)}")
            return None
    
    def update_user_profile(self, user_id: str, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Aggiorna un profilo utente nel user_service
        
        Args:
            user_id: ID dell'utente
            user_data: Dati da aggiornare
            
        Returns:
            I dati del profilo aggiornato o None in caso di errore
        """
        try:
            url = f"{self.base_url}/api/users/{user_id}/"
            
            logger.info(f"Updating user profile in user_service for user {user_id}")
            
            response = requests.patch(
                url,
                json=user_data,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                logger.info(f"User profile updated successfully for user {user_id}")
                return response.json()
            else:
                logger.error(f"Failed to update user profile. Status: {response.status_code}, Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error communicating with user_service: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error updating user profile: {str(e)}")
            return None
    
    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Recupera un profilo utente dal user_service
        
        Args:
            user_id: ID dell'utente
            
        Returns:
            I dati del profilo o None in caso di errore
        """
        try:
            url = f"{self.base_url}/api/users/{user_id}/"
            
            response = requests.get(
                url,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                logger.info(f"User profile not found for user {user_id}")
                return None
            else:
                logger.error(f"Failed to get user profile. Status: {response.status_code}, Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error communicating with user_service: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting user profile: {str(e)}")
            return None

# Istanza singleton del client
user_service_client = UserServiceClient() 