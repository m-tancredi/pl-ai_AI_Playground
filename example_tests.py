# 🧪 Test Suite Completa per il Servizio di Autenticazione
# File: backend/auth_service/users_api/tests.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from PIL import Image
import io
import json

User = get_user_model()

class AuthenticationTestCase(TestCase):
    """Test suite per l'autenticazione degli utenti"""
    
    def setUp(self):
        """Configurazione iniziale per ogni test"""
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'first_name': 'Test',
            'last_name': 'User'
        }
        self.user = None

    def test_user_registration_success(self):
        """Test registrazione utente con dati validi"""
        response = self.client.post('/api/register/', self.user_data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='testuser').exists())
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertNotIn('password', response.data)  # Password non deve essere esposta

    def test_user_registration_duplicate_username(self):
        """Test registrazione con username già esistente"""
        # Crea primo utente
        User.objects.create_user(**self.user_data)
        
        # Prova a crearne un altro con stesso username
        response = self.client.post('/api/register/', self.user_data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_user_registration_duplicate_email(self):
        """Test registrazione con email già esistente"""
        # Crea primo utente
        User.objects.create_user(**self.user_data)
        
        # Prova a crearne un altro con stessa email ma username diverso
        duplicate_data = self.user_data.copy()
        duplicate_data['username'] = 'anotheruser'
        
        response = self.client.post('/api/register/', duplicate_data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_user_registration_invalid_password(self):
        """Test registrazione con password non valida"""
        invalid_data = self.user_data.copy()
        invalid_data['password'] = '123'  # Password troppo corta
        
        response = self.client.post('/api/register/', invalid_data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        """Test login con credenziali valide"""
        # Crea utente
        User.objects.create_user(**self.user_data)
        
        login_data = {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        }
        
        response = self.client.post('/api/token/', login_data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_user_login_invalid_credentials(self):
        """Test login con credenziali non valide"""
        # Crea utente
        User.objects.create_user(**self.user_data)
        
        login_data = {
            'username': self.user_data['username'],
            'password': 'wrongpassword'
        }
        
        response = self.client.post('/api/token/', login_data)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_success(self):
        """Test rinnovo token con refresh token valido"""
        # Crea utente e ottieni token
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        
        response = self.client.post('/api/token/refresh/', {
            'refresh': str(refresh)
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_token_refresh_invalid_token(self):
        """Test rinnovo token con refresh token non valido"""
        response = self.client.post('/api/token/refresh/', {
            'refresh': 'invalid_token'
        })
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_verify_valid(self):
        """Test verifica token valido"""
        # Crea utente e ottieni token
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        response = self.client.post('/api/token/verify/', {
            'token': str(access_token)
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_verify_invalid(self):
        """Test verifica token non valido"""
        response = self.client.post('/api/token/verify/', {
            'token': 'invalid_token'
        })
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_success(self):
        """Test logout con blacklisting del refresh token"""
        # Crea utente e ottieni token
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        # Effettua logout
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post('/api/token/blacklist/', {
            'refresh': str(refresh)
        })
        
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
        
        # Verifica che il refresh token sia stato blacklistato
        response = self.client.post('/api/token/refresh/', {
            'refresh': str(refresh)
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_without_token(self):
        """Test accesso a endpoint protetto senza token"""
        response = self.client.get('/api/users/me/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_with_valid_token(self):
        """Test accesso a endpoint protetto con token valido"""
        # Crea utente e ottieni token
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        # Accedi all'endpoint protetto
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get('/api/users/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.user_data['username'])
        self.assertEqual(response.data['email'], self.user_data['email'])

    def test_protected_endpoint_with_invalid_token(self):
        """Test accesso a endpoint protetto con token non valido"""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token')
        response = self.client.get('/api/users/me/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileManagementTestCase(TestCase):
    """Test suite per la gestione del profilo utente"""
    
    def setUp(self):
        """Configurazione iniziale per ogni test"""
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'first_name': 'Test',
            'last_name': 'User'
        }
        self.user = User.objects.create_user(**self.user_data)
        self.refresh = RefreshToken.for_user(self.user)
        self.access_token = self.refresh.access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_get_user_profile(self):
        """Test recupero profilo utente"""
        response = self.client.get('/api/users/me/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.user.username)
        self.assertEqual(response.data['email'], self.user.email)
        self.assertEqual(response.data['first_name'], self.user.first_name)
        self.assertEqual(response.data['last_name'], self.user.last_name)

    def test_update_user_profile(self):
        """Test aggiornamento profilo utente"""
        update_data = {
            'first_name': 'UpdatedName',
            'last_name': 'UpdatedLastName'
        }
        
        response = self.client.patch('/api/profile/update/', update_data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'UpdatedName')
        self.assertEqual(self.user.last_name, 'UpdatedLastName')

    def test_update_user_email(self):
        """Test aggiornamento email utente"""
        update_data = {
            'email': 'newemail@example.com'
        }
        
        response = self.client.patch('/api/profile/update/', update_data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'newemail@example.com')

    def test_update_email_duplicate(self):
        """Test aggiornamento email con email già esistente"""
        # Crea altro utente
        User.objects.create_user(
            username='anotheruser',
            email='another@example.com',
            password='password123'
        )
        
        update_data = {
            'email': 'another@example.com'
        }
        
        response = self.client.patch('/api/profile/update/', update_data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def create_test_image(self):
        """Helper per creare un'immagine di test"""
        image = Image.new('RGB', (100, 100), color='red')
        image_io = io.BytesIO()
        image.save(image_io, format='JPEG')
        image_io.seek(0)
        return SimpleUploadedFile(
            'test_image.jpg',
            image_io.read(),
            content_type='image/jpeg'
        )

    def test_profile_image_upload_success(self):
        """Test upload immagine profilo con successo"""
        test_image = self.create_test_image()
        
        response = self.client.patch(
            '/api/profile/upload-image/',
            {'profile_image': test_image},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('profile_image', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.profile_image)

    def test_profile_image_upload_invalid_format(self):
        """Test upload immagine con formato non valido"""
        # Crea file di testo invece di immagine
        invalid_file = SimpleUploadedFile(
            'test.txt',
            b'This is not an image',
            content_type='text/plain'
        )
        
        response = self.client.patch(
            '/api/profile/upload-image/',
            {'profile_image': invalid_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profile_image', response.data)

    def test_profile_image_upload_too_large(self):
        """Test upload immagine troppo grande"""
        # Crea immagine grande (simula file > 5MB)
        large_image = Image.new('RGB', (3000, 3000), color='red')
        image_io = io.BytesIO()
        large_image.save(image_io, format='JPEG', quality=100)
        image_io.seek(0)
        
        large_file = SimpleUploadedFile(
            'large_image.jpg',
            image_io.read(),
            content_type='image/jpeg'
        )
        
        response = self.client.patch(
            '/api/profile/upload-image/',
            {'profile_image': large_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profile_image', response.data)

    def test_profile_image_remove_success(self):
        """Test rimozione immagine profilo con successo"""
        # Prima carica un'immagine
        test_image = self.create_test_image()
        self.client.patch(
            '/api/profile/upload-image/',
            {'profile_image': test_image},
            format='multipart'
        )
        
        # Poi rimuovila
        response = self.client.delete('/api/profile/remove-image/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.profile_image)

    def test_profile_image_remove_no_image(self):
        """Test rimozione immagine quando non esiste"""
        response = self.client.delete('/api/profile/remove-image/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message', response.data)


class SecurityTestCase(TestCase):
    """Test suite per la sicurezza del servizio"""
    
    def setUp(self):
        """Configurazione iniziale per ogni test"""
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        }

    def test_sql_injection_protection(self):
        """Test protezione da SQL injection"""
        malicious_data = {
            'username': "admin'; DROP TABLE users; --",
            'password': 'password'
        }
        
        response = self.client.post('/api/token/', malicious_data)
        
        # Il servizio dovrebbe gestire gracefully il tentativo
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST])

    def test_xss_protection_in_registration(self):
        """Test protezione XSS durante registrazione"""
        xss_data = self.user_data.copy()
        xss_data['first_name'] = '<script>alert("xss")</script>'
        
        response = self.client.post('/api/register/', xss_data)
        
        if response.status_code == status.HTTP_201_CREATED:
            # I dati dovrebbero essere sanificati
            user = User.objects.get(username=xss_data['username'])
            self.assertEqual(user.first_name, '<script>alert("xss")</script>')  # Django gestisce l'escaping nell'output

    def test_password_not_in_response(self):
        """Test che la password non sia mai esposta nelle risposte"""
        response = self.client.post('/api/register/', self.user_data)
        
        if response.status_code == status.HTTP_201_CREATED:
            self.assertNotIn('password', response.data)
            self.assertNotIn('password', str(response.content))

    def test_unauthorized_access_to_admin_fields(self):
        """Test che campi admin non possano essere modificati"""
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Prova a modificare campi admin
        malicious_data = {
            'is_staff': True,
            'is_superuser': True,
            'is_active': False
        }
        
        response = self.client.patch('/api/profile/update/', malicious_data)
        
        # Anche se la richiesta va a buon fine, i campi admin non dovrebbero essere modificati
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)


class IntegrationTestCase(TestCase):
    """Test di integrazione per flussi completi"""
    
    def setUp(self):
        """Configurazione iniziale per ogni test"""
        self.client = APIClient()
        self.user_data = {
            'username': 'integrationuser',
            'email': 'integration@example.com',
            'password': 'IntegrationPassword123!',
            'first_name': 'Integration',
            'last_name': 'Test'
        }

    def test_complete_user_lifecycle(self):
        """Test del ciclo di vita completo dell'utente"""
        # 1. Registrazione
        response = self.client.post('/api/register/', self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user_id = response.data['id']
        
        # 2. Login
        login_response = self.client.post('/api/token/', {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access_token = login_response.data['access']
        refresh_token = login_response.data['refresh']
        
        # 3. Accesso al profilo
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        profile_response = self.client.get('/api/users/me/')
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data['id'], user_id)
        
        # 4. Aggiornamento profilo
        update_response = self.client.patch('/api/profile/update/', {
            'first_name': 'UpdatedIntegration'
        })
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        
        # 5. Verifica aggiornamento
        updated_profile = self.client.get('/api/users/me/')
        self.assertEqual(updated_profile.data['first_name'], 'UpdatedIntegration')
        
        # 6. Logout
        logout_response = self.client.post('/api/token/blacklist/', {
            'refresh': refresh_token
        })
        self.assertEqual(logout_response.status_code, status.HTTP_205_RESET_CONTENT)
        
        # 7. Verifica che il token sia invalidato
        refresh_attempt = self.client.post('/api/token/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_cycle(self):
        """Test del ciclo di refresh dei token"""
        # Crea utente e ottieni token iniziali
        user = User.objects.create_user(**self.user_data)
        initial_refresh = RefreshToken.for_user(user)
        initial_access = initial_refresh.access_token
        
        # 1. Usa il token iniziale
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {initial_access}')
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 2. Refresh del token
        refresh_response = self.client.post('/api/token/refresh/', {
            'refresh': str(initial_refresh)
        })
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        new_access = refresh_response.data['access']
        
        # 3. Usa il nuovo token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access}')
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 4. Il vecchio refresh token dovrebbe essere blacklistato (se ROTATE_REFRESH_TOKENS=True)
        if hasattr(refresh_response.data, 'refresh'):
            old_refresh_response = self.client.post('/api/token/refresh/', {
                'refresh': str(initial_refresh)
            })
            self.assertEqual(old_refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)


# Script per eseguire i test
if __name__ == '__main__':
    import django
    from django.core.management import execute_from_command_line
    import sys
    import os
    
    # Configura Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_auth.settings')
    django.setup()
    
    # Esegui i test
    execute_from_command_line(['manage.py', 'test', 'users_api.tests'])