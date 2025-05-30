import os
from pathlib import Path
import dotenv
import dj_database_url
from .secrets_helper import get_docker_secret # Importa l'helper

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv.load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') # DEVE ESSERE UGUALE A AUTH_SERVICE
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'corsheaders',
    'chat_api.apps.ChatApiConfig',
    # 'django_celery_results', # Se usi DB backend per Celery
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'service_config.urls'
TEMPLATES = [ { 'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': { 'context_processors': [ 'django.template.context_processors.debug', 'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages',],},},]
WSGI_APPLICATION = 'service_config.wsgi.application'

# Database PostgreSQL
DB_NAME = os.getenv('CHATBOT_DB_NAME')
DB_USER = os.getenv('CHATBOT_DB_USER')
DB_PASSWORD = os.getenv('CHATBOT_DB_PASSWORD')
DB_HOST = os.getenv('CHATBOT_DB_HOST')
DB_PORT = os.getenv('CHATBOT_DB_PORT')
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL: DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
else: DATABASES = { 'default': { 'ENGINE': 'django.db.backends.postgresql', 'NAME': DB_NAME, 'USER': DB_USER, 'PASSWORD': DB_PASSWORD, 'HOST': DB_HOST, 'PORT': DB_PORT, }}

AUTH_PASSWORD_VALIDATORS = [ {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'}, {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'}, {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},]
LANGUAGE_CODE = 'en-us'; TIME_ZONE = 'UTC'; USE_I18N = True; USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'; AUTH_USER_MODEL = 'auth.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('chat_api.authentication.JWTCustomAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer', ('rest_framework.renderers.BrowsableAPIRenderer' if DEBUG else None)],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser','rest_framework.parsers.FormParser','rest_framework.parsers.MultiPartParser'], # MultiPart per RAG file upload
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination', 'PAGE_SIZE': 20
}
SIMPLE_JWT = { "ALGORITHM": "HS256", "SIGNING_KEY": SECRET_KEY, "VERIFYING_KEY": None, "AUDIENCE": None, "ISSUER": None, "JWK_URL": None, "LEEWAY": 0, "AUTH_HEADER_TYPES": ("Bearer",), "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION", "USER_ID_FIELD": "id", "USER_ID_CLAIM": "user_id", }
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

# Celery Configuration (base, worker non attivo di default da questo container)
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND') # Se vuoi salvare risultati
# CELERY_DEFAULT_QUEUE = 'chatbot_tasks' # Se usi worker separato per questo servizio

# API Keys lette da Docker Secrets
OPENAI_API_KEY = get_docker_secret('openai_api_key_secret')
GEMINI_API_KEY = get_docker_secret('gemini_api_key_secret')

# Resource Manager Access (per RAG)
RESOURCE_MANAGER_INTERNAL_URL = os.getenv('RESOURCE_MANAGER_INTERNAL_URL', 'http://resource_manager_service:8003')
INTERNAL_API_SECRET_HEADER_NAME = 'X-Internal-Secret' # Deve corrispondere
INTERNAL_API_SECRET_VALUE = os.getenv('INTERNAL_API_SECRET')

# LLM Configuration (valori di default, possono essere sovrascritti da ChatbotProfile)
DEFAULT_LLM_MODEL_OPENAI = "gpt-4o-mini"
DEFAULT_LLM_MODEL_GEMINI = "gemini-1.5-flash-latest" # Modello Gemini più piccolo/veloce

MAX_CONTEXT_MESSAGES = 10 # Numero di messaggi precedenti da inviare come contesto
MAX_RAG_DOCUMENT_LENGTH = 100000 # Limite caratteri per documento RAG (da adattare)