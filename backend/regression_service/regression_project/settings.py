import os
from pathlib import Path
import dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = BASE_DIR / '.env'
if dotenv_path.exists():
    dotenv.load_dotenv(dotenv_path)

# Stessa SECRET_KEY di auth_service
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-secret-key')
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS_STRING = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]

INSTALLED_APPS = [
    # Rimosse app Django standard non necessarie senza DB/Admin
    # 'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages', # Può essere utile per DRF
    'django.contrib.staticfiles', # Per DRF browsable API
    'rest_framework',
    'corsheaders',
    'regression_api.apps.RegressionApiConfig', # La nuova app
    # Rimosso 'datasets_api'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    #'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'regression_project.urls' # Assicurati che il nome progetto sia corretto

TEMPLATES = [ # Necessario per DRF browsable API
    { 'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
      'OPTIONS': { 'context_processors': [ 'django.template.context_processors.debug',
            'django.template.context_processors.request',
            # 'django.contrib.auth.context_processors.auth', # Non serve più
            'django.contrib.messages.context_processors.messages',],},},]

WSGI_APPLICATION = 'regression_project.wsgi.application'

# --- Database Configuration (Dummy SQLite se richiesto) ---
# Django potrebbe lamentarsi se DATABASES non è definito.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'dummy_regression_db.sqlite3', # Non verrà usato attivamente
    }
}
# Commenta la sezione DATABASES se Django non si lamenta all'avvio.

# --- Password Validators (Non più necessari) ---
AUTH_PASSWORD_VALIDATORS = []

# --- Internationalization ---
LANGUAGE_CODE = 'en-us'; TIME_ZONE = 'UTC'; USE_I18N = True; USE_TZ = True

# --- Static Files ---
STATIC_URL = 'static/'

# --- Media Files (Non gestiti direttamente da questo servizio) ---
# MEDIA_ROOT = ... # Non necessario
# MEDIA_URL = ... # Non necessario

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# AUTH_USER_MODEL = ... # Non necessario

# --- DRF Settings ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'regression_api.authentication.JWTCustomAuthentication', # Auth nella nuova app
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
     'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        ('rest_framework.renderers.BrowsableAPIRenderer' if DEBUG else None),
    ],
     'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
}

# --- Simple JWT (Validation Only) ---
SIMPLE_JWT = { "ALGORITHM": "HS256", "SIGNING_KEY": SECRET_KEY, # ... (uguale agli altri servizi) ...
               "VERIFYING_KEY": None, "AUDIENCE": None, "ISSUER": None, "JWK_URL": None, "LEEWAY": 0,
               "AUTH_HEADER_TYPES": ("Bearer",), "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
               "USER_ID_FIELD": "id", "USER_ID_CLAIM": "user_id", }

# --- CORS Settings ---
CORS_ALLOWED_ORIGINS_STRING = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STRING.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True



INTERNAL_API_SECRET_HEADER_NAME = 'X-Internal-Secret' # Puoi cambiare il nome se preferisci
INTERNAL_API_SECRET_VALUE = os.getenv('INTERNAL_API_SECRET', None)
RESOURCE_MANAGER_INTERNAL_URL = os.getenv('RESOURCE_MANAGER_INTERNAL_URL', 'http://pl-ai-resource-manager-web:8003')
