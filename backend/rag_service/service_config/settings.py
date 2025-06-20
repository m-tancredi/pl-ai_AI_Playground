"""
Django settings per rag_service.
"""

import os
from pathlib import Path
import dotenv
from config.secrets_reader import get_secret

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Carica variabili d'ambiente da .env se presente
dotenv.load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or get_secret('DJANGO_SECRET_KEY', 'django-insecure-fallback-key-for-development-only')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'rag_api',
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

WSGI_APPLICATION = 'service_config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('RAG_DB_NAME', 'rag_db'),
        'USER': os.getenv('RAG_DB_USER', 'rag_user'),
        'PASSWORD': os.getenv('RAG_DB_PASSWORD', 'rag_password'),
        'HOST': os.getenv('RAG_DB_HOST', 'rag_db'),
        'PORT': os.getenv('RAG_DB_PORT', '5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'it-it'
TIME_ZONE = 'Europe/Rome'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'mediafiles')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rag_api.authentication.JWTCustomAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

# CORS settings
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '*').split(',')

# Configurazione SIMPLE_JWT allineata agli altri servizi
SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": None,
    "AUDIENCE": None,
    "ISSUER": None,
    "JWK_URL": None,
    "LEEWAY": 0,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Celery settings
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'amqp://guest:guest@rabbitmq:5672//')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'rpc://')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Task routing per RAG
CELERY_TASK_ROUTES = {
    'rag_api.tasks.*': {'queue': 'rag_tasks'},
}

# Configurazioni aggiuntive Celery
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_MAX_TASKS_PER_CHILD = 50
CELERY_TASK_ALWAYS_EAGER = False  # Importante: non eseguire task in modo sincrono
CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

# RAG settings
RAG_UPLOADS_ROOT = os.path.join(MEDIA_ROOT, 'rag_uploads')
RAG_EMBEDDINGS_ROOT = os.path.join(MEDIA_ROOT, 'rag_embeddings')

# Configurazioni RAG per chunking
RAG_MAX_CHUNK_SIZE = int(os.getenv('RAG_MAX_CHUNK_SIZE', '1000'))
RAG_CHUNK_OVERLAP = int(os.getenv('RAG_CHUNK_OVERLAP', '200'))

# OpenAI settings
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') or get_secret('OPENAI_API_KEY', '')
OPENAI_CHAT_MODEL_NAME = os.getenv('OPENAI_CHAT_MODEL_NAME', 'gpt-3.5-turbo')

# OpenAI Embedding Settings (New Models 2024)
OPENAI_EMBEDDING_MODEL = os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')
OPENAI_EMBEDDING_DIMENSIONS = os.getenv('OPENAI_EMBEDDING_DIMENSIONS')  # None = usa dimensioni predefinite
if OPENAI_EMBEDDING_DIMENSIONS:
    OPENAI_EMBEDDING_DIMENSIONS = int(OPENAI_EMBEDDING_DIMENSIONS)

# Embedding Provider Configuration
EMBEDDING_PROVIDER = os.getenv('EMBEDDING_PROVIDER', 'openai')  # 'openai' o 'sentence_transformers'

# Sentence Transformers settings (fallback)
SENTENCE_TRANSFORMER_MODEL_NAME = os.getenv('SENTENCE_TRANSFORMER_MODEL_NAME', 'all-MiniLM-L6-v2')
EMBEDDING_DIMENSION = int(os.getenv('EMBEDDING_DIMENSION', '384'))  # Fallback per Sentence Transformers

# File upload settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'rag_service.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'rag_api': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'config': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Crea directory per i log se non esiste
os.makedirs(BASE_DIR / 'logs', exist_ok=True) 