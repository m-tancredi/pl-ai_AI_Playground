# 🏗️ Template Microservizi PL-AI

## 📋 Panoramica

Questo template fornisce una guida completa per creare nuovi microservizi nell'architettura PL-AI, basata sui pattern consolidati dei servizi esistenti.

## 🏛️ Architettura Standard

### Struttura Directory
```
backend/
└── nome_service/
    ├── Dockerfile
    ├── entrypoint.sh
    ├── manage.py
    ├── requirements.txt
    ├── .env
    ├── mediafiles/
    ├── logs/
    ├── service_config/
    │   ├── __init__.py
    │   ├── asgi.py
    │   ├── settings.py
    │   ├── urls.py
    │   ├── wsgi.py
    │   └── celery.py (se necessario)
    └── nome_api/
        ├── __init__.py
        ├── admin.py
        ├── apps.py
        ├── models.py
        ├── views.py
        ├── serializers.py
        ├── urls.py
        ├── permissions.py
        ├── authentication.py
        ├── utils.py
        ├── config/
        │   └── __init__.py
        ├── migrations/
        │   └── __init__.py
        └── tests/
            └── __init__.py
```

## ⚙️ Configurazioni Standard

### 1. `.env` Template
```env
# Database Configuration
SERVICE_DB_NAME=nome_service_db
SERVICE_DB_USER=nome_service_user
SERVICE_DB_PASSWORD=password_sicura
SERVICE_DB_HOST=postgres
SERVICE_DB_PORT=5432

# Django Configuration
DJANGO_SECRET_KEY=chiave_segreta_django_molto_lunga_e_sicura
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,nome_service

# Internal Communication
INTERNAL_API_SECRET=chiave_segreta_per_comunicazioni_interne

# Media/Static Files
MEDIA_URL=/media/
STATIC_URL=/static/

# Optional: External Services
# OPENAI_API_KEY=sk-...
# OTHER_SERVICE_URL=http://other_service:8000
```

### 2. `settings.py` Template
```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')

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
    'nome_api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'service_config.urls'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('SERVICE_DB_NAME'),
        'USER': os.environ.get('SERVICE_DB_USER'),
        'PASSWORD': os.environ.get('SERVICE_DB_PASSWORD'),
        'HOST': os.environ.get('SERVICE_DB_HOST'),
        'PORT': os.environ.get('SERVICE_DB_PORT'),
    }
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'nome_api.authentication.JWTCustomAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
]

CORS_ALLOW_CREDENTIALS = True

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'mediafiles')

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Internationalization
LANGUAGE_CODE = 'it-it'
TIME_ZONE = 'Europe/Rome'
USE_I18N = True
USE_TZ = True

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Internal API Secret
INTERNAL_API_SECRET = os.environ.get('INTERNAL_API_SECRET')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'nome_api': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
```

### 3. `authentication.py` Template Standard
```python
import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

class SimpleUser(AnonymousUser):
    """Utente semplificato per microservizi senza database utenti."""
    
    def __init__(self, user_data):
        self.id = user_data.get('user_id')
        self.username = user_data.get('username', '')
        self.email = user_data.get('email', '')
        self.is_staff = user_data.get('is_staff', False)
        self.is_superuser = user_data.get('is_superuser', False)
        self.is_authenticated = True
        self.is_anonymous = False

class JWTCustomAuthentication(BaseAuthentication):
    """Autenticazione JWT personalizzata per microservizi."""
    
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = SimpleUser(payload)
            return (user, token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token scaduto')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Token non valido')
        except Exception as e:
            raise AuthenticationFailed(f'Errore autenticazione: {str(e)}')
```

### 4. `models.py` Template
```python
from django.db import models
from django.utils import timezone
import uuid

class BaseModel(models.Model):
    """Modello base con campi comuni."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        abstract = True

class NomeModello(BaseModel):
    """Descrizione del modello."""
    user_id = models.IntegerField(help_text="ID utente dal servizio auth")
    nome = models.CharField(max_length=255)
    descrizione = models.TextField(blank=True)
    
    # Campi specifici del servizio
    # ...
    
    class Meta:
        db_table = 'nome_modello'
        verbose_name = 'Nome Modello'
        verbose_name_plural = 'Nomi Modelli'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.nome} ({self.user_id})"

class ActivityLog(BaseModel):
    """Log delle attività per auditing."""
    user_id = models.IntegerField()
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        db_table = 'activity_log'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} by User {self.user_id}"
```

### 5. `serializers.py` Template
```python
from rest_framework import serializers
from .models import NomeModello, ActivityLog

class NomeModelloSerializer(serializers.ModelSerializer):
    """Serializer completo per NomeModello."""
    
    class Meta:
        model = NomeModello
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_id')
    
    def validate_nome(self, value):
        """Validazione personalizzata per il campo nome."""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Il nome deve avere almeno 2 caratteri")
        return value.strip()

class NomeModelloCreateSerializer(serializers.ModelSerializer):
    """Serializer per creazione NomeModello."""
    
    class Meta:
        model = NomeModello
        fields = ('nome', 'descrizione')
    
    def create(self, validated_data):
        # Aggiungi user_id dal context
        validated_data['user_id'] = self.context['request'].user.id
        return super().create(validated_data)

class NomeModelloUpdateSerializer(serializers.ModelSerializer):
    """Serializer per aggiornamento NomeModello."""
    
    class Meta:
        model = NomeModello
        fields = ('nome', 'descrizione')

class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer per ActivityLog."""
    
    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ('id', 'created_at')
```

### 6. `views.py` Template
```python
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import NomeModello, ActivityLog
from .serializers import (
    NomeModelloSerializer, 
    NomeModelloCreateSerializer,
    NomeModelloUpdateSerializer,
    ActivityLogSerializer
)
from .permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NomeModelloViewSet(viewsets.ModelViewSet):
    """ViewSet per gestione NomeModello."""
    
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        return NomeModello.objects.filter(
            user_id=self.request.user.id,
            is_active=True
        )
    
    def get_serializer_class(self):
        """Sceglie il serializer in base all'azione."""
        if self.action == 'create':
            return NomeModelloCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return NomeModelloUpdateSerializer
        return NomeModelloSerializer
    
    def perform_create(self, serializer):
        """Crea oggetto con logging."""
        instance = serializer.save()
        self._log_activity('CREATE', instance)
        logger.info(f"Utente {self.request.user.id} ha creato {instance}")
    
    def perform_update(self, serializer):
        """Aggiorna oggetto con logging."""
        instance = serializer.save()
        self._log_activity('UPDATE', instance)
        logger.info(f"Utente {self.request.user.id} ha aggiornato {instance}")
    
    def perform_destroy(self, instance):
        """Soft delete con logging."""
        instance.is_active = False
        instance.save()
        self._log_activity('DELETE', instance)
        logger.info(f"Utente {self.request.user.id} ha eliminato {instance}")
    
    @action(detail=False, methods=['get'])
    def my_items(self, request):
        """Endpoint per elementi dell'utente corrente."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Ricerca negli elementi."""
        query = request.query_params.get('q', '')
        if not query:
            return Response({'error': 'Parametro q richiesto'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        queryset = self.get_queryset().filter(
            Q(nome__icontains=query) | Q(descrizione__icontains=query)
        )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @method_decorator(cache_page(60 * 5))  # Cache per 5 minuti
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        """Statistiche utente."""
        if not request.user.is_staff:
            return Response({'error': 'Accesso negato'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        stats = {
            'total_items': NomeModello.objects.filter(is_active=True).count(),
            'user_items': self.get_queryset().count(),
            'recent_activities': ActivityLog.objects.filter(
                user_id=request.user.id
            )[:10].values()
        }
        
        return Response(stats)
    
    def _log_activity(self, action, instance):
        """Helper per logging attività."""
        ActivityLog.objects.create(
            user_id=self.request.user.id,
            action=action,
            resource_type=instance.__class__.__name__,
            resource_id=str(instance.id),
            details={
                'nome': getattr(instance, 'nome', ''),
                'timestamp': instance.updated_at.isoformat()
            },
            ip_address=self._get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
    
    def _get_client_ip(self):
        """Ottiene IP del client."""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return self.request.META.get('REMOTE_ADDR')
```

### 7. `permissions.py` Template
```python
from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permesso personalizzato per permettere solo ai proprietari di modificare.
    """
    
    def has_object_permission(self, request, view, obj):
        # Permessi di lettura per tutti gli utenti autenticati
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Permessi di scrittura solo per il proprietario
        return obj.user_id == request.user.id

class IsAdminOrOwner(permissions.BasePermission):
    """
    Permesso per admin o proprietario dell'oggetto.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Admin può fare tutto
        if request.user.is_staff:
            return True
        
        # Proprietario può modificare i propri oggetti
        return obj.user_id == request.user.id

class IsOwnerOnly(permissions.BasePermission):
    """
    Solo il proprietario può accedere.
    """
    
    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
```

### 8. `urls.py` Template
```python
# service_config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('nome_api.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# nome_api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NomeModelloViewSet

router = DefaultRouter()
router.register(r'nome-modelli', NomeModelloViewSet, basename='nome-modelli')

urlpatterns = [
    path('', include(router.urls)),
]
```

### 9. `Dockerfile` Template
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 8000

# Use entrypoint
ENTRYPOINT ["./entrypoint.sh"]
```

### 10. `entrypoint.sh` Template
```bash
#!/bin/bash

# Wait for database
echo "Waiting for database..."
while ! nc -z $SERVICE_DB_HOST $SERVICE_DB_PORT; do
  sleep 0.1
done
echo "Database connected!"

# Run migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if not exists
echo "Creating superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created')
else:
    print('Superuser already exists')
"

# Collect static files
python manage.py collectstatic --noinput

# Start server
echo "Starting server..."
python manage.py runserver 0.0.0.0:8000
```

### 11. `requirements.txt` Template
```txt
Django==4.2.7
djangorestframework==3.14.0
django-cors-headers==4.3.1
psycopg2-binary==2.9.7
celery==5.3.4
redis==5.0.1
PyJWT==2.8.0
Pillow==10.1.0
python-decouple==3.8
django-extensions==3.2.3
```

## 🐳 Docker Compose Integration

### Aggiunta al `docker-compose.yml`
```yaml
  nome_service:
    build: ./backend/nome_service
    container_name: pl-ai-nome-service
    environment:
      - SERVICE_DB_NAME=nome_service_db
      - SERVICE_DB_USER=nome_service_user
      - SERVICE_DB_PASSWORD=password_sicura
      - SERVICE_DB_HOST=postgres
      - SERVICE_DB_PORT=5432
      - DJANGO_SECRET_KEY=chiave_segreta_django
      - DEBUG=False
      - ALLOWED_HOSTS=localhost,127.0.0.1,nome_service
      - INTERNAL_API_SECRET=chiave_segreta_interna
    volumes:
      - ./backend/nome_service/mediafiles:/mediafiles
      - ./backend/nome_service/logs:/app/logs
    depends_on:
      - postgres
      - redis
    networks:
      - pl-ai-network
    restart: unless-stopped

  # Aggiungi database se necessario
  postgres:
    environment:
      - POSTGRES_MULTIPLE_DATABASES=nome_service_db
```

## 🌐 Nginx Configuration

### Aggiunta a `nginx.conf`
```nginx
# Nome Service
location /api/nome-service/ {
    proxy_pass http://nome_service:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Media files per Nome Service
location /media/nome-service/ {
    alias /media_nome_service/;
    expires 30d;
    add_header Cache-Control "private";
    access_log off;
}
```

## 🧪 Testing Template

### `tests/test_models.py`
```python
from django.test import TestCase
from django.core.exceptions import ValidationError
from nome_api.models import NomeModello

class NomeModelloTestCase(TestCase):
    def setUp(self):
        self.user_id = 1
        self.nome_modello = NomeModello.objects.create(
            user_id=self.user_id,
            nome="Test Nome",
            descrizione="Test descrizione"
        )
    
    def test_str_representation(self):
        self.assertEqual(str(self.nome_modello), f"Test Nome ({self.user_id})")
    
    def test_nome_required(self):
        with self.assertRaises(ValidationError):
            nome_modello = NomeModello(user_id=self.user_id, nome="")
            nome_modello.full_clean()
```

### `tests/test_views.py`
```python
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from nome_api.models import NomeModello

class NomeModelloViewSetTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_create_nome_modello(self):
        data = {
            'nome': 'Test Nome',
            'descrizione': 'Test descrizione'
        }
        response = self.client.post('/api/nome-modelli/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NomeModello.objects.count(), 1)
```

## 📚 Frontend Integration

### Service Template (`frontend/src/services/nomeService.js`)
```javascript
import apiClient from './apiClient';

export const getNomeModelli = async () => {
  const response = await apiClient.get('/api/nome-service/nome-modelli/');
  return response.data;
};

export const createNomeModello = async (data) => {
  const response = await apiClient.post('/api/nome-service/nome-modelli/', data);
  return response.data;
};

export const updateNomeModello = async (id, data) => {
  const response = await apiClient.patch(`/api/nome-service/nome-modelli/${id}/`, data);
  return response.data;
};

export const deleteNomeModello = async (id) => {
  const response = await apiClient.delete(`/api/nome-service/nome-modelli/${id}/`);
  return response.data;
};

export const searchNomeModelli = async (query) => {
  const response = await apiClient.get(`/api/nome-service/nome-modelli/search/?q=${query}`);
  return response.data;
};
```

### Hook Template (`frontend/src/hooks/useNomeService.js`)
```javascript
import { useState } from 'react';
import * as nomeService from '../services/nomeService';

const useNomeService = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRequest = async (requestFn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestFn();
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante la richiesta');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getNomeModelli: () => handleRequest(nomeService.getNomeModelli),
    createNomeModello: (data) => handleRequest(() => nomeService.createNomeModello(data)),
    updateNomeModello: (id, data) => handleRequest(() => nomeService.updateNomeModello(id, data)),
    deleteNomeModello: (id) => handleRequest(() => nomeService.deleteNomeModello(id)),
    searchNomeModelli: (query) => handleRequest(() => nomeService.searchNomeModelli(query)),
  };
};

export default useNomeService;
```

## 🚀 Deployment Checklist

### Pre-Deploy
- [ ] Configurare variabili ambiente
- [ ] Testare connessione database
- [ ] Verificare autenticazione JWT
- [ ] Testare endpoint API
- [ ] Configurare nginx
- [ ] Verificare volumi Docker

### Post-Deploy
- [ ] Verificare logs
- [ ] Testare endpoint da frontend
- [ ] Verificare performance
- [ ] Monitorare errori
- [ ] Backup database

## 🔧 Troubleshooting

### Problemi Comuni

1. **Errore Database Connection**
   - Verificare variabili ENV
   - Controllare che il database sia avviato
   - Verificare credenziali

2. **Errore JWT Authentication**
   - Verificare DJANGO_SECRET_KEY
   - Controllare formato token
   - Verificare header Authorization

3. **Errore 404 su endpoint**
   - Verificare configurazione nginx
   - Controllare urls.py
   - Verificare router registration

4. **Errore CORS**
   - Aggiornare CORS_ALLOWED_ORIGINS
   - Verificare middleware order

## 📖 Best Practices

1. **Security**
   - Usare sempre HTTPS in produzione
   - Validare input utente
   - Implementare rate limiting
   - Logging delle attività sensibili

2. **Performance**
   - Usare cache per query frequenti
   - Paginazione per liste lunghe
   - Ottimizzare query database
   - Compressione response

3. **Monitoring**
   - Logging strutturato
   - Metriche di performance
   - Health checks
   - Alerting per errori

4. **Development**
   - Test automatizzati
   - Code review
   - Documentazione API
   - Versioning API

---

## 📝 Note Finali

Questo template è basato sui pattern consolidati dei microservizi PL-AI esistenti. Personalizza i nomi e le funzionalità secondo le esigenze specifiche del tuo servizio.

Per domande o miglioramenti, consulta la documentazione dei servizi esistenti o contatta il team di sviluppo. 