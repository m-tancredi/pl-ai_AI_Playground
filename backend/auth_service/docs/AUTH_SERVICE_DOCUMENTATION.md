# 🔐 Documentazione Tecnica - Servizio di Autenticazione

## 📋 Indice

1. [Panoramica Generale](#panoramica-generale)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Diagrammi di Flusso](#diagrammi-di-flusso)
4. [Schema Database](#schema-database)
5. [API Endpoints](#api-endpoints)
6. [Configurazione e Setup](#configurazione-e-setup)
7. [Esempi Pratici](#esempi-pratici)
8. [Casi d'Uso](#casi-duso)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## 🏗️ Panoramica Generale

Il **Servizio di Autenticazione** è un microservizio basato su Django REST Framework che gestisce l'autenticazione e l'autorizzazione degli utenti nell'ecosistema AI PlayGround. Utilizza JSON Web Tokens (JWT) per l'autenticazione stateless e fornisce funzionalità complete di gestione utenti.

### 🎯 Obiettivi Principali

- **Autenticazione Sicura**: Implementazione JWT con token rotation e blacklisting
- **Gestione Utenti**: Registrazione, login, logout e gestione profili
- **Scalabilità**: Architettura microservizi per alta disponibilità
- **Sicurezza**: Validazione robusta e protezione contro attacchi comuni

### 🛠️ Stack Tecnologico

| Componente | Tecnologia | Versione | Scopo |
|------------|------------|----------|-------|
| **Framework** | Django | 4.x | Backend web framework |
| **API** | Django REST Framework | 3.14+ | API REST |
| **Autenticazione** | SimpleJWT | 5.2+ | Gestione JWT |
| **Database** | PostgreSQL | 13+ | Persistenza dati |
| **Container** | Docker | Latest | Containerizzazione |
| **Immagini** | Pillow | 9.0+ | Gestione immagini profilo |

---

## 🏛️ Architettura del Sistema

Il servizio segue un'architettura a layer con separazione delle responsabilità:

### Layer Architetturali

1. **Presentation Layer**: Endpoint API REST
2. **Business Logic Layer**: Views e serializers Django
3. **Data Access Layer**: Models Django ORM
4. **Persistence Layer**: Database PostgreSQL

### Componenti Principali

- **User Management**: Gestione utenti personalizzata con modello User esteso
- **JWT Manager**: Gestione token con blacklisting e rotation
- **Profile Management**: Gestione profili utente e immagini
- **Authentication Flow**: Flussi di registrazione, login e logout

---

## 🔄 Diagrammi di Flusso

I diagrammi sono stati generati automaticamente e mostrano:

1. **Architettura Generale**: Relazioni tra componenti
2. **Sequence Diagram**: Flussi di autenticazione completi
3. **Database Schema**: Struttura dati e relazioni

---

## 💾 Schema Database

### Modello User

Il modello `User` estende `AbstractUser` di Django con campi aggiuntivi:

```python
class User(AbstractUser):
    # Campo email univoco e obbligatorio
    email = models.EmailField(unique=True, blank=False, null=False)
    
    # Immagine profilo con validazione dimensioni
    profile_image = models.ImageField(
        upload_to='profile_images/', 
        null=True, blank=True,
        help_text='Upload a profile image (max 5MB)'
    )
```

### Tabelle JWT

- **Outstanding Tokens**: Token attivi emessi
- **Blacklisted Tokens**: Token invalidati per logout sicuro

---

## 🌐 API Endpoints

### Base URL
```
http://localhost:8001/api/
```

### Endpoint di Autenticazione

| Endpoint | Metodo | Scopo | Auth Richiesta |
|----------|--------|-------|----------------|
| `/register/` | POST | Registrazione nuovo utente | ❌ |
| `/token/` | POST | Login (ottieni token) | ❌ |
| `/token/refresh/` | POST | Rinnova access token | ❌ |
| `/token/verify/` | POST | Verifica validità token | ❌ |
| `/token/blacklist/` | POST | Logout (invalida token) | ✅ |

### Endpoint Gestione Profilo

| Endpoint | Metodo | Scopo | Auth Richiesta |
|----------|--------|-------|----------------|
| `/users/me/` | GET | Ottieni dati profilo | ✅ |
| `/users/me/` | PUT/PATCH | Aggiorna profilo | ✅ |
| `/profile/upload-image/` | PUT/PATCH | Carica immagine profilo | ✅ |
| `/profile/remove-image/` | DELETE | Rimuovi immagine profilo | ✅ |
| `/profile/update/` | PUT/PATCH | Aggiorna info profilo | ✅ |

---

## ⚙️ Configurazione e Setup

### 1. Prerequisiti

```bash
# Python 3.10+
python --version

# Docker e Docker Compose
docker --version
docker-compose --version
```

### 2. Variabili d'Ambiente

Crea un file `.env` nella root del servizio:

```env
# Django Settings
DJANGO_SECRET_KEY='your-super-secret-key-here'
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Database
DATABASE_URL=postgres://user:password@auth_db:5432/database_name

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com

# JWT Settings
ACCESS_TOKEN_LIFETIME_DAYS=15  # minuti
REFRESH_TOKEN_LIFETIME_DAYS=7  # giorni
```

### 3. Setup con Docker

```bash
# 1. Clona il repository
git clone <repository-url>
cd pl-ai_AI-PlayGround/backend/auth_service

# 2. Avvia il servizio
docker-compose up --build -d

# 3. Esegui le migrazioni
docker-compose exec auth_service python manage.py migrate

# 4. Crea un superuser
docker-compose exec auth_service python manage.py createsuperuser
```

### 4. Setup Sviluppo Locale

```bash
# 1. Crea ambiente virtuale
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# 2. Installa dipendenze
pip install -r requirements.txt

# 3. Configura database
python manage.py migrate

# 4. Avvia server di sviluppo
python manage.py runserver 8001
```

---

## 🧪 Esempi Pratici

### 1. Registrazione Utente

```bash
curl -X POST http://localhost:8001/api/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mario_rossi",
    "email": "mario@example.com",
    "password": "SecurePassword123!",
    "first_name": "Mario",
    "last_name": "Rossi"
  }'
```

**Risposta (201 Created):**
```json
{
  "id": 1,
  "username": "mario_rossi",
  "email": "mario@example.com",
  "first_name": "Mario",
  "last_name": "Rossi"
}
```

### 2. Login Utente

```bash
curl -X POST http://localhost:8001/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mario_rossi",
    "password": "SecurePassword123!"
  }'
```

**Risposta (200 OK):**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### 3. Accesso Profilo Utente

```bash
curl -X GET http://localhost:8001/api/users/me/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

**Risposta (200 OK):**
```json
{
  "id": 1,
  "username": "mario_rossi",
  "email": "mario@example.com",
  "first_name": "Mario",
  "last_name": "Rossi",
  "date_joined": "2024-01-15T10:30:00Z",
  "last_login": "2024-01-15T12:45:00Z",
  "profile_image": null
}
```

### 4. Upload Immagine Profilo

```bash
curl -X PATCH http://localhost:8001/api/profile/upload-image/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -F "profile_image=@/path/to/image.jpg"
```

### 5. Rinnovo Token

```bash
curl -X POST http://localhost:8001/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }'
```

### 6. Logout (Blacklist Token)

```bash
curl -X POST http://localhost:8001/api/token/blacklist/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -d '{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }'
```

---

## 🎭 Casi d'Uso

### Caso d'Uso 1: Integrazione Frontend React

```javascript
// authService.js
class AuthService {
  constructor() {
    this.baseURL = 'http://localhost:8001/api';
    this.token = localStorage.getItem('access_token');
  }

  async register(userData) {
    const response = await fetch(`${this.baseURL}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return await response.json();
  }

  async login(username, password) {
    const response = await fetch(`${this.baseURL}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const tokens = await response.json();
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      this.token = tokens.access;
      return tokens;
    }
    throw new Error('Login failed');
  }

  async getProfile() {
    const response = await fetch(`${this.baseURL}/users/me/`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return await response.json();
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await fetch(`${this.baseURL}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    
    if (response.ok) {
      const { access } = await response.json();
      localStorage.setItem('access_token', access);
      this.token = access;
      return access;
    }
    this.logout();
  }

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    await fetch(`${this.baseURL}/token/blacklist/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ refresh: refreshToken })
    });
    
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.token = null;
  }
}

export default new AuthService();
```

### Caso d'Uso 2: Integrazione con Axios Interceptors

```javascript
// api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8001/api',
});

// Request interceptor per aggiungere token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor per gestire token scaduti
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post('/token/refresh/', {
          refresh: refreshToken
        });
        
        const { access } = response.data;
        localStorage.setItem('access_token', access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### Caso d'Uso 3: Middleware di Autenticazione Personalizzato

```python
# middleware.py
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

User = get_user_model()

class CustomJWTMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Applica autenticazione JWT solo per endpoint protetti
        if request.path.startswith('/api/protected/'):
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(
                    jwt_auth.get_raw_token(
                        jwt_auth.get_header(request)
                    )
                )
                user = jwt_auth.get_user(validated_token)
                request.user = user
            except InvalidToken:
                return JsonResponse({
                    'error': 'Token non valido o scaduto'
                }, status=401)

        response = self.get_response(request)
        return response
```

---

## 🔧 Troubleshooting

### Problema 1: Token JWT non valido

**Sintomo:**
```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [...]
}
```

**Soluzioni:**

1. **Verifica scadenza token:**
```python
# Controlla configurazione in settings.py
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),  # Non troppo breve
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}
```

2. **Verifica formato Authorization header:**
```bash
# Corretto
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Scorretto
Authorization: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

3. **Debug token nel database:**
```python
# Django shell
python manage.py shell

from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
# Verifica se il token è stato blacklistato
BlacklistedToken.objects.filter(token__jti='your-jti-here')
```

### Problema 2: Errori CORS

**Sintomo:**
```
Access to fetch at 'http://localhost:8001/api/token/' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Soluzione:**
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-production-domain.com",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
```

### Problema 3: Database Connection Error

**Sintomo:**
```
django.db.utils.OperationalError: could not connect to server
```

**Soluzioni:**

1. **Verifica configurazione database:**
```env
DATABASE_URL=postgres://user:password@host:5432/database
```

2. **Verifica servizio Docker:**
```bash
docker-compose ps
docker-compose logs auth_db
```

3. **Test connessione manuale:**
```bash
docker-compose exec auth_db psql -U plai_user -d plai_db
```

### Problema 4: Immagini profilo non caricate

**Sintomo:**
```json
{
  "profile_image": ["File troppo grande. Massimo 5MB consentito."]
}
```

**Soluzioni:**

1. **Verifica dimensioni file:**
```python
# serializers.py - personalizza validazione
def validate_profile_image(self, value):
    max_size = 10 * 1024 * 1024  # Aumenta a 10MB
    if value.size > max_size:
        raise serializers.ValidationError(f"File troppo grande. Massimo {max_size//1024//1024}MB consentito.")
```

2. **Verifica permessi cartella media:**
```bash
# Controlla permessi
ls -la media/profile_images/

# Correggi permessi se necessario
chmod 755 media/
chmod 755 media/profile_images/
```

### Problema 5: Rate Limiting

**Implementazione protezione brute force:**

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'django_ratelimit',
]

# views.py
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

@method_decorator(ratelimit(key='ip', rate='5/m', method='POST'), name='post')
class LoginView(TokenObtainPairView):
    pass
```

---

## 🏆 Best Practices

### 1. Sicurezza

#### Token Management
```python
# ✅ Buona pratica - Token rotation
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# ✅ Buona pratica - Durata limitata
"ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
"REFRESH_TOKEN_LIFETIME": timedelta(days=7),
```

#### Password Security
```python
# ✅ Buona pratica - Validatori password robusti
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8}
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
```

### 2. Performance

#### Database Optimization
```python
# ✅ Buona pratica - Indici database
class User(AbstractUser):
    email = models.EmailField(unique=True, db_index=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
        ]
```

#### Caching
```python
# ✅ Buona pratica - Cache per user profile
from django.core.cache import cache

def get_user_profile(user_id):
    cache_key = f'user_profile_{user_id}'
    profile = cache.get(cache_key)
    
    if not profile:
        profile = User.objects.get(id=user_id)
        cache.set(cache_key, profile, 300)  # 5 minuti
    
    return profile
```

### 3. Monitoring e Logging

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': 'auth_service.log',
        },
    },
    'loggers': {
        'users_api': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# views.py
import logging
logger = logging.getLogger('users_api')

class LoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        logger.info(f'Login attempt for user: {request.data.get("username")}')
        return super().post(request, *args, **kwargs)
```

### 4. Testing

```python
# tests.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        }

    def test_user_registration(self):
        response = self.client.post('/api/register/', self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='testuser').exists())

    def test_user_login(self):
        User.objects.create_user(**self.user_data)
        login_data = {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        }
        response = self.client.post('/api/token/', login_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_protected_endpoint_without_token(self):
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

---

## 📖 Conclusioni

Questa documentazione fornisce una guida completa per comprendere, configurare, utilizzare e mantenere il servizio di autenticazione. Il servizio è progettato per essere:

- **Sicuro**: Con JWT, token rotation e blacklisting
- **Scalabile**: Architettura microservizi containerizzata
- **Flessibile**: API REST facilmente integrabile
- **Mantenibile**: Codice ben documentato e testabile

Per supporto aggiuntivo o contributi, consulta il repository del progetto o contatta il team di sviluppo.

---

## 📚 Riferimenti

- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [SimpleJWT Documentation](https://django-rest-framework-simplejwt.readthedocs.io/)
- [JWT.io](https://jwt.io/) - Decodifica e debug JWT
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)