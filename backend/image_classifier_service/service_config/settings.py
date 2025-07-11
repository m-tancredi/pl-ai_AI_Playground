import os
from pathlib import Path
import dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = BASE_DIR / '.env'
if dotenv_path.exists(): dotenv.load_dotenv(dotenv_path)

# Core Django Settings
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-classifier-secret') # MUST MATCH auth_service
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'corsheaders',
    'classifier_api.apps.ClassifierApiConfig', # Your app
    # 'django_celery_results', # If using DB result backend
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
TEMPLATES = [ { 'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
      'OPTIONS': { 'context_processors': [ 'django.template.context_processors.debug',
            'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',],},},]
WSGI_APPLICATION = 'service_config.wsgi.application'

# Database (PostgreSQL)
CLASSIFIER_DB_NAME = os.getenv('CLASSIFIER_DB_NAME', 'classifier_db')
CLASSIFIER_DB_USER = os.getenv('CLASSIFIER_DB_USER', 'classifier_user')
CLASSIFIER_DB_PASSWORD = os.getenv('CLASSIFIER_DB_PASSWORD', 'password')
CLASSIFIER_DB_HOST = os.getenv('CLASSIFIER_DB_HOST', 'classifier_db')
CLASSIFIER_DB_PORT = os.getenv('CLASSIFIER_DB_PORT', '5432')
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL: DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
else: DATABASES = { 'default': {
            'ENGINE': 'django.db.backends.postgresql', 'NAME': CLASSIFIER_DB_NAME,
            'USER': CLASSIFIER_DB_USER, 'PASSWORD': CLASSIFIER_DB_PASSWORD,
            'HOST': CLASSIFIER_DB_HOST, 'PORT': CLASSIFIER_DB_PORT, } }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
 ]

# Internationalization
LANGUAGE_CODE = 'en-us'; TIME_ZONE = 'UTC'; USE_I18N = True; USE_TZ = True

# Static files
STATIC_URL = 'static/'
# Media files (not directly managed here, but define for potential future use/admin)
# MEDIA_ROOT = BASE_DIR / 'mediafiles'
# MEDIA_URL = '/media/'

# Models Storage Path (Relative to BASE_DIR)
MODELS_STORAGE_ROOT = BASE_DIR / 'models_storage'
MODELS_STORAGE_ROOT.mkdir(parents=True, exist_ok=True) # Ensure directory exists

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'auth.User'

# DRF Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('classifier_api.authentication.JWTCustomAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_RENDERER_CLASSES': [
    'rest_framework.renderers.JSONRenderer',
] + (['rest_framework.renderers.BrowsableAPIRenderer'] if DEBUG else []),
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser', 'rest_framework.parsers.FormParser', 'rest_framework.parsers.MultiPartParser'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination', 'PAGE_SIZE': 20
}

# Simple JWT (Validation Only)
SIMPLE_JWT = { "ALGORITHM": "HS256", "SIGNING_KEY": SECRET_KEY, "VERIFYING_KEY": None, "AUDIENCE": None,
               "ISSUER": None, "JWK_URL": None, "LEEWAY": 0, "AUTH_HEADER_TYPES": ("Bearer",),
               "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION", "USER_ID_FIELD": "id", "USER_ID_CLAIM": "user_id", }

# CORS Settings
CORS_ALLOWED_ORIGINS_STRING = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STRING.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

# Celery Configuration
# Costruisci la URL di RabbitMQ usando le variabili d'ambiente
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'guest')
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_PORT = os.getenv('RABBITMQ_PORT', '5672')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')

# Prova prima la variabile d'ambiente completa, poi costruisci dinamicamente
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', f'amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@{RABBITMQ_HOST}:{RABBITMQ_PORT}/{RABBITMQ_VHOST}')
# Imposta la coda di default per questo servizio
CELERY_DEFAULT_QUEUE = 'classifier_tasks'
CELERY_TASK_DEFAULT_QUEUE = 'classifier_tasks'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 1800  # 30 minutes for training? Adjust as needed
CELERY_TASK_SOFT_TIME_LIMIT = 1740 # Slightly less than hard limit

# Optional: Result Backend
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', None)
# if CELERY_RESULT_BACKEND == 'django-db': CELERY_RESULT_BACKEND = 'django_celery_results.backends.DatabaseBackend'
# elif CELERY_RESULT_BACKEND: pass # Assume URL
# else: CELERY_IGNORE_RESULT = True

# ML Model Settings
IMG_HEIGHT = 180 # Example image size for model input
IMG_WIDTH = 180
IMG_CHANNELS = 3 # RGB