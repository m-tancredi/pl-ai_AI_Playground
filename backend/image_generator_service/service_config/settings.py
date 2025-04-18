# pl-ai/backend/image_generator_service/service_config/settings.py
import os
from pathlib import Path
import dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = BASE_DIR / '.env'
if dotenv_path.exists():
    dotenv.load_dotenv(dotenv_path)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-secret-key-if-not-set-in-env')
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]

# --- RIPRISTINA INSTALLED_APPS FONDAMENTALI ---
INSTALLED_APPS = [
    'django.contrib.admin', # Riabilita se vuoi l'admin per il nuovo modello
    'django.contrib.auth', # Necessario per admin
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'generator_api.apps.GeneratorApiConfig',
]

# --- RIPRISTINA MIDDLEWARE FONDAMENTALI ---
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', # Per admin
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', # Per admin
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'service_config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth', # Ripristinato
                'django.contrib.messages.context_processors.messages', # Ripristinato
            ],
        },
    },
]

WSGI_APPLICATION = 'service_config.wsgi.application'

DB_NAME = os.getenv('IMAGE_GEN_DB_NAME', 'imagegen_db')
DB_USER = os.getenv('IMAGE_GEN_DB_USER', 'imagegen_user')
DB_PASSWORD = os.getenv('IMAGE_GEN_DB_PASSWORD', 'password')
DB_HOST = os.getenv('IMAGE_GEN_DB_HOST', 'localhost')
DB_PORT = os.getenv('IMAGE_GEN_DB_PORT', '5432')

DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql', # <-- Engine PostgreSQL
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
        }
    }

# Password validation - NECESSARIO ora che 'auth' è installato
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'auth.User'

# --- Il resto delle impostazioni (Internationalization, Static, Media, REST_FRAMEWORK, SIMPLE_JWT, CORS, Secrets, API URLs) rimane invariato rispetto alla versione precedente ---
# ... (assicurati che siano presenti) ...
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'

MEDIA_ROOT = BASE_DIR / 'mediafiles'
MEDIA_URL = '/media/'
TEMP_IMAGE_DIR = 'temp_generated'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('generator_api.authentication.JWTCustomAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    # ... (renderers, parsers) ...
}
SIMPLE_JWT = {
    "ALGORITHM": "HS256", "SIGNING_KEY": SECRET_KEY, "VERIFYING_KEY": None,
    "USER_ID_FIELD": "id", "USER_ID_CLAIM": "user_id",
    "AUTH_HEADER_TYPES": ("Bearer",), "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    # ... (altre impostazioni JWT non rilevanti qui) ...
}
CORS_ALLOWED_ORIGINS_STRING = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STRING.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
OPENAI_SECRET_FILE = '/run/secrets/openai_api_key_secret'
STABILITY_SECRET_FILE = '/run/secrets/stability_api_key_secret'
OPENAI_API_BASE_URL = "https://api.openai.com/v1"
STABILITY_API_BASE_URL = "https://api.stability.ai/v1"
TEMP_IMAGE_DIR = 'temp_generated'
SAVED_IMAGE_DIR_FORMAT = 'saved_images/user_{user_id}'
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True # Importante per includere la porta :8080
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') # Se userai HTTPS in futuro