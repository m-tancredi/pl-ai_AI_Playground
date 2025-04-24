# pl-ai/backend/resource_manager_service/service_config/settings.py

import os  # <-- Importazione necessaria per os.getenv
from pathlib import Path
import dotenv
import dj_database_url # Importa se usi DATABASE_URL

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
dotenv_path = BASE_DIR / '.env'
if dotenv_path.exists():
    dotenv.load_dotenv(dotenv_path)

# --- Core Django Settings ---
# SECURITY WARNING: keep the secret key used in production secret!
# Deve essere la stessa usata da auth_service per validare JWT
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-secret-key-please-set-in-env')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'

ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]


# --- Application definition ---
INSTALLED_APPS = [
    'django.contrib.admin',         # Per interfaccia admin (opzionale se non usata)
    'django.contrib.auth',          # Necessario per admin e ForeignKey (anche se fittizio)
    'django.contrib.contenttypes',  # Necessario per admin/auth
    'django.contrib.sessions',      # Necessario per admin/messages
    'django.contrib.messages',      # Necessario per admin
    'django.contrib.staticfiles',   # Per servire static files (es. admin, DRF browsable)

    # Third-party apps
    'rest_framework',
    # 'rest_framework_simplejwt', # Non serve registrare l'app, solo usare le classi
    'corsheaders',
    # 'django_celery_results',    # Aggiungere se si usa il backend DB per Celery

    # Local apps
    'resources_api.apps.ResourcesApiConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',         # Necessario per admin/messages
    'corsheaders.middleware.CorsMiddleware',                        # Prima di CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',    # Necessario per admin
    'django.contrib.messages.middleware.MessageMiddleware',         # Necessario per admin
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
                'django.contrib.auth.context_processors.auth', # Per admin
                'django.contrib.messages.context_processors.messages', # Per admin
            ],
        },
    },
]

WSGI_APPLICATION = 'service_config.wsgi.application'


# --- Database Configuration ---
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
RESOURCE_DB_NAME = os.getenv('RESOURCE_DB_NAME', 'resource_db')
RESOURCE_DB_USER = os.getenv('RESOURCE_DB_USER', 'resource_user')
RESOURCE_DB_PASSWORD = os.getenv('RESOURCE_DB_PASSWORD', 'resource_password') # Default debole!
RESOURCE_DB_HOST = os.getenv('RESOURCE_DB_HOST', 'resource_db') # Nome servizio Docker
RESOURCE_DB_PORT = os.getenv('RESOURCE_DB_PORT', '5432')

# DATABASE_URL ha la priorità se definito nel file .env
DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
    print(f"Using DATABASE_URL: {DATABASE_URL[:DATABASE_URL.find('@')+1]}...") # Log senza password
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': RESOURCE_DB_NAME,
            'USER': RESOURCE_DB_USER,
            'PASSWORD': RESOURCE_DB_PASSWORD,
            'HOST': RESOURCE_DB_HOST,
            'PORT': RESOURCE_DB_PORT,
        }
    }
    print(f"Using separate DB variables: dbname={RESOURCE_DB_NAME} user={RESOURCE_DB_USER} host={RESOURCE_DB_HOST}")


# --- Password validation ---
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators
# Necessari solo se usi l'admin per creare/gestire utenti locali (improbabile qui)
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- Internationalization ---
# https://docs.djangoproject.com/en/4.2/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# --- Static files (CSS, JavaScript, Images for Admin/DRF) ---
# https://docs.djangoproject.com/en/4.2/howto/static-files/
STATIC_URL = 'static/'
# STATIC_ROOT = BASE_DIR / 'staticfiles' # Scommenta se devi eseguire collectstatic

# --- Media files (User uploaded content) ---
# https://docs.djangoproject.com/en/4.2/topics/files/
MEDIA_ROOT = BASE_DIR / 'mediafiles'
MEDIA_URL = '/media/' # URL base accessibile esternamente (via Nginx)

# --- Default primary key field type ---
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Authentication Model (per Admin e ForeignKey) ---
AUTH_USER_MODEL = 'auth.User'


# --- Django REST Framework Settings ---
# https://www.django-rest-framework.org/api-guide/settings/
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # Usa il nostro backend custom per validare JWT senza query al DB locale
        'resources_api.authentication.JWTCustomAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        # Richiede che un token valido sia presente
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        # Aggiungi BrowsableAPIRenderer solo in DEBUG
        ('rest_framework.renderers.BrowsableAPIRenderer' if DEBUG else None),
    ],
     'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser', # Per upload file
    ],
    # Aggiungi paginazione per le viste lista
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20 # Numero di elementi per pagina
}

# --- Simple JWT Settings (per validazione token) ---
# https://django-rest-framework-simplejwt.readthedocs.io/en/latest/settings.html
SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY, # La chiave segreta condivisa con auth_service!
    "VERIFYING_KEY": None, # Non necessario per HS256
    "AUDIENCE": None,
    "ISSUER": None,
    "JWK_URL": None,
    "LEEWAY": 0, # Tolleranza scadenza (secondi)

    "AUTH_HEADER_TYPES": ("Bearer",), # Standard: Bearer <token>
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION", # Nome header HTTP
    "USER_ID_FIELD": "id", # Nome campo nel modello User usato da auth_service (assumiamo 'id')
    "USER_ID_CLAIM": "user_id", # Nome claim nel payload JWT che contiene l'ID utente

    # Le opzioni seguenti non sono rilevanti qui perché validiamo solo access token
    # "ACCESS_TOKEN_LIFETIME": timedelta(minutes=5),
    # "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    # "ROTATE_REFRESH_TOKENS": False,
    # "BLACKLIST_AFTER_ROTATION": False,
    # "UPDATE_LAST_LOGIN": False,
    # "TOKEN_OBTAIN_SERIALIZER": "...",
    # "TOKEN_REFRESH_SERIALIZER": "...",
    # etc.
}

# --- CORS Settings ---
# https://github.com/adamchainz/django-cors-headers
CORS_ALLOWED_ORIGINS_STRING = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STRING.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True # Permette invio cookie/auth headers da frontend
# Potrebbe essere necessario aggiungere header custom permessi se il frontend li invia:
# CORS_ALLOW_HEADERS = [...]

# --- Celery Configuration ---
# https://docs.celeryq.dev/en/stable/userguide/configuration.html
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'amqp://guest:guest@rabbitmq:5672//') # Default punta al container RabbitMQ
CELERY_ACCEPT_CONTENT = ['json'] # Formato messaggi
CELERY_TASK_SERIALIZER = 'json' # Serializzazione task
CELERY_RESULT_SERIALIZER = 'json' # Serializzazione risultati (se usati)
CELERY_TIMEZONE = TIME_ZONE # Usa lo stesso timezone di Django
CELERY_TASK_TRACK_STARTED = True # Logga quando un task inizia
CELERY_TASK_TIME_LIMIT = 600  # Hard time limit (secondi) per task (es. 10 minuti per elaborazione file)
CELERY_TASK_SOFT_TIME_LIMIT = 540 # Soft time limit (secondi)

# Opzionale: Backend per Risultati Celery
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', None)
# if CELERY_RESULT_BACKEND == 'django-db':
#     CELERY_RESULT_BACKEND = 'django_celery_results.backends.DatabaseBackend'
# elif CELERY_RESULT_BACKEND == 'django-cache':
#     CELERY_RESULT_BACKEND = 'django_celery_results.backends.CacheBackend'
# elif CELERY_RESULT_BACKEND: # Assume sia un URL valido (redis, rpc, etc.)
#     pass # Usa il valore direttamente
# else: # Se non definito, i risultati non vengono salvati (ok per molti casi)
#     CELERY_IGNORE_RESULT = True

# Se usi django-celery-results con DB
# CELERY_RESULT_EXTENDED = True # Salva argomenti, kwargs, ecc.


# --- File Storage Configuration ---
# Di default usa il file system locale (configurato tramite MEDIA_ROOT)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# Esempio per storage S3 (scommenta e configura se necessario)
# Vedi .env.example per le variabili d'ambiente AWS_*
# USE_S3 = os.getenv('USE_S3_STORAGE', 'False') == 'True'
# if USE_S3:
#     AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
#     AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
#     AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
#     AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME')
#     AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL') # Per MinIO o altri compatibili S3
#     AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN', f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com')
#     AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
#     AWS_LOCATION = 'media' # Sottocartella nel bucket
#     MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_LOCATION}/'
#     DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
#     AWS_DEFAULT_ACL = os.getenv('AWS_DEFAULT_ACL', None) # Es. 'public-read' o None (privato)
#     AWS_QUERYSTRING_AUTH = False # Se gli URL devono essere pubblici senza firma
#     AWS_S3_FILE_OVERWRITE = False # Non sovrascrivere file con lo stesso nome
#     AWS_S3_VERIFY = True # Verifica certificato SSL endpoint S3
# else:
#     # Assicurati che MEDIA_ROOT/URL siano definiti per FileSystemStorage
#     MEDIA_ROOT = BASE_DIR / 'mediafiles'
#     MEDIA_URL = '/media/'


# --- Impostazioni Specifiche dell'App ---
THUMBNAIL_SIZE = (256, 256) # Dimensione thumbnail (larghezza, altezza)