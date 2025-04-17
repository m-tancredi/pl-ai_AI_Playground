import os
from pathlib import Path
from datetime import timedelta
import dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = BASE_DIR / '.env'
if dotenv_path.exists():
    dotenv.load_dotenv(dotenv_path)

# !!! USA LA STESSA SECRET KEY DELL'AUTH_SERVICE !!!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-secret-key-if-not-set-in-env')
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth', # Necessario per ForeignKey a User, anche se non gestiamo utenti qui
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'datasets_api.apps.DatasetsApiConfig', # La nostra app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', # Necessario per admin
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', # <-- RIMETTI QUESTA RIGA
    'django.contrib.messages.middleware.MessageMiddleware', # Necessario per admin
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'regression_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'regression_project.wsgi.application'

# Database (PostgreSQL specifico per questo servizio)
# Legge variabili separate o DATABASE_URL se definito
DB_NAME = os.getenv('REGRESSION_DB_NAME', 'regression_db')
DB_USER = os.getenv('REGRESSION_DB_USER', 'regression_user')
DB_PASSWORD = os.getenv('REGRESSION_DB_PASSWORD', 'password')
DB_HOST = os.getenv('REGRESSION_DB_HOST', 'localhost')
DB_PORT = os.getenv('REGRESSION_DB_PORT', '5432')

# DATABASE_URL ha la priorità se definito in .env
DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
        }
    }


# Password validation (non usato per login, ma buona pratica averlo)
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
# STATIC_ROOT = BASE_DIR / 'staticfiles' # Non necessario per API service senza interfaccia Django

# Media files (per i CSV caricati)
MEDIA_ROOT = BASE_DIR / 'mediafiles' # Directory dove verranno salvati i file
MEDIA_URL = '/media/' # URL base per accedere ai file media

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model (puntiamo a quello standard, ma non lo popoleremo)
AUTH_USER_MODEL = 'auth.User' # O 'users_api.User' se auth_service usa un modello custom
                              # L'importante è che il ForeignKey nel modello Dataset punti a qualcosa

# Django REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # Usa il nostro backend custom per validare JWT senza query al DB locale
        'datasets_api.authentication.JWTCustomAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        # Richiede che un token valido sia presente (IsAuthenticated funziona grazie all'utente fittizio)
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer' if DEBUG else None,
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser', # Necessario per file uploads
    ],
}

# Simple JWT Settings (solo per validazione)
# https://django-rest-framework-simplejwt.readthedocs.io/en/latest/settings.html
SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY, # La chiave segreta condivisa!
    "VERIFYING_KEY": None,
    "AUDIENCE": None,
    "ISSUER": None,
    "JWK_URL": None,
    "LEEWAY": 0,
    "AUTH_HEADER_TYPES": ("Bearer",), # Standard
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id", # Assumendo che auth_service usi 'id' standard
    "USER_ID_CLAIM": "user_id", # Claim nel token che contiene l'ID utente
    # Le altre opzioni (lifetime, refresh, blacklist) non sono rilevanti qui
    # perché validiamo solo access token esistenti
}

# CORS Settings
CORS_ALLOWED_ORIGINS_STRING = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STRING.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
# Potrebbe essere necessario permettere header custom se il frontend li invia
# CORS_ALLOW_HEADERS = [...]