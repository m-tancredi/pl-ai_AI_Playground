# 🛡️ Miglioramenti di Sicurezza - Parte 2

## 🐳 Hardening Container e Infrastructure

### 1. Dockerfile Sicuro

```dockerfile
# Dockerfile migliorato per sicurezza
FROM python:3.11-slim-bullseye

# Crea utente non-root
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Aggiorna sistema e installa solo pacchetti necessari
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    netcat-openbsd \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Configura directory di lavoro
WORKDIR /app

# Copia e installa dipendenze
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn[gevent] \
    && rm -rf ~/.cache/pip/*

# Copia codice applicazione
COPY --chown=appuser:appuser . /app/

# Configura permessi sicuri
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/logs /app/media \
    && chown -R appuser:appuser /app \
    && chmod 755 /app/logs /app/media

# Security labels
LABEL security.scan="enabled" \
      maintainer="security@yourcompany.com"

# Passa a utente non-root
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
```

### 2. Docker Compose con Sicurezza

```yaml
# docker-compose.secure.yml
version: '3.8'

services:
  auth_service:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pl-ai-auth-service
    restart: unless-stopped
    
    # Security options
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # Environment variables da file sicuro
    env_file:
      - .env.production
    
    # Network security
    networks:
      - auth_network
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    
    # Volume mounting sicuro
    volumes:
      - ./logs:/app/logs:rw
      - ./media:/app/media:rw
      - /etc/localtime:/etc/localtime:ro

  auth_db:
    image: postgres:15-alpine
    container_name: pl-ai-auth-db
    restart: unless-stopped
    
    # Security configuration
    security_opt:
      - no-new-privileges:true
    
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      PGDATA: /var/lib/postgresql/data/pgdata
    
    # Secrets management
    secrets:
      - db_password
    
    # Volume con backup
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups:rw
    
    networks:
      - auth_network

  redis:
    image: redis:7-alpine
    container_name: pl-ai-redis
    restart: unless-stopped
    
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    
    volumes:
      - redis_data:/data
    
    networks:
      - auth_network

networks:
  auth_network:
    driver: bridge
    internal: false
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### 3. Secrets Management

```python
# config/secrets_manager.py
import os
import json
from pathlib import Path
from cryptography.fernet import Fernet

class SecretsManager:
    """Gestione sicura dei secrets"""
    
    def __init__(self):
        self.secrets_path = Path('/app/secrets')
        self.encryption_key = os.environ.get('MASTER_KEY')
        
        if self.encryption_key:
            self.cipher = Fernet(self.encryption_key.encode())
    
    def get_secret(self, secret_name):
        """Ottieni secret decriptato"""
        try:
            # Prova prima da variabili d'ambiente
            env_value = os.environ.get(secret_name.upper())
            if env_value:
                return env_value
            
            # Poi da file secrets
            secret_file = self.secrets_path / f"{secret_name}.enc"
            if secret_file.exists():
                with open(secret_file, 'rb') as f:
                    encrypted_data = f.read()
                return self.cipher.decrypt(encrypted_data).decode()
            
            # Fallback a file plain text (solo per sviluppo)
            plain_file = self.secrets_path / f"{secret_name}.txt"
            if plain_file.exists():
                with open(plain_file, 'r') as f:
                    return f.read().strip()
            
            raise ValueError(f"Secret {secret_name} not found")
        
        except Exception as e:
            raise ValueError(f"Error retrieving secret {secret_name}: {str(e)}")
    
    def set_secret(self, secret_name, secret_value):
        """Imposta secret crittografato"""
        if not self.cipher:
            raise ValueError("Encryption key not configured")
        
        encrypted_data = self.cipher.encrypt(secret_value.encode())
        secret_file = self.secrets_path / f"{secret_name}.enc"
        
        # Crea directory se non esiste
        self.secrets_path.mkdir(exist_ok=True)
        
        with open(secret_file, 'wb') as f:
            f.write(encrypted_data)
        
        # Imposta permessi sicuri
        os.chmod(secret_file, 0o600)

# settings.py - Uso sicuro dei secrets
secrets_manager = SecretsManager()

SECRET_KEY = secrets_manager.get_secret('django_secret_key')
DATABASE_URL = secrets_manager.get_secret('database_url')

# JWT Settings con secrets
SIMPLE_JWT.update({
    'SIGNING_KEY': secrets_manager.get_secret('jwt_signing_key'),
    'ENCRYPTION_KEY': secrets_manager.get_secret('jwt_encryption_key'),
})
```

---

## 📊 Monitoring e Alerting

### 1. Health Checks Avanzati

```python
# users_api/health.py
from django.http import JsonResponse
from django.db import connections
from django.core.cache import cache
from django.conf import settings
import time
import psutil

class HealthCheckView:
    """Health check completo del servizio"""
    
    def __call__(self, request):
        health_data = {
            'status': 'healthy',
            'timestamp': time.time(),
            'checks': {}
        }
        
        # Database check
        try:
            db_conn = connections['default']
            db_conn.cursor().execute('SELECT 1')
            health_data['checks']['database'] = {'status': 'healthy'}
        except Exception as e:
            health_data['status'] = 'unhealthy'
            health_data['checks']['database'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
        
        # Cache check
        try:
            cache.set('health_check', 'test', 10)
            cache.get('health_check')
            health_data['checks']['cache'] = {'status': 'healthy'}
        except Exception as e:
            health_data['status'] = 'unhealthy'
            health_data['checks']['cache'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
        
        # System resources
        try:
            cpu_percent = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            health_data['checks']['resources'] = {
                'status': 'healthy',
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'disk_percent': (disk.used / disk.total) * 100
            }
            
            # Alert se risorse critiche
            if cpu_percent > 90 or memory.percent > 90:
                health_data['status'] = 'degraded'
        
        except Exception as e:
            health_data['checks']['resources'] = {
                'status': 'unknown',
                'error': str(e)
            }
        
        status_code = 200 if health_data['status'] == 'healthy' else 503
        return JsonResponse(health_data, status=status_code)

# users_api/monitoring.py
import logging
import time
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import threading

class MetricsMiddleware(MiddlewareMixin):
    """Middleware per raccolta metriche"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.metrics = {
            'request_count': 0,
            'response_times': [],
            'error_count': 0,
            'active_sessions': 0
        }
        self.lock = threading.Lock()
    
    def process_request(self, request):
        request.start_time = time.time()
        
        with self.lock:
            self.metrics['request_count'] += 1
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            response_time = time.time() - request.start_time
            
            with self.lock:
                self.metrics['response_times'].append(response_time)
                
                # Mantieni solo ultimi 1000 tempi di risposta
                if len(self.metrics['response_times']) > 1000:
                    self.metrics['response_times'] = self.metrics['response_times'][-1000:]
                
                if response.status_code >= 400:
                    self.metrics['error_count'] += 1
        
        return response
    
    def get_metrics(self):
        """Ottieni metriche correnti"""
        with self.lock:
            if self.metrics['response_times']:
                avg_response_time = sum(self.metrics['response_times']) / len(self.metrics['response_times'])
            else:
                avg_response_time = 0
            
            return {
                'request_count': self.metrics['request_count'],
                'error_count': self.metrics['error_count'],
                'avg_response_time': avg_response_time,
                'active_sessions': self.metrics['active_sessions']
            }
```

### 2. Logging Strutturato per Security

```python
# users_api/logging_config.py
import logging
import json
from datetime import datetime

class SecurityFormatter(logging.Formatter):
    """Formatter per log di sicurezza strutturati"""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'service': 'auth_service',
            'message': record.getMessage(),
        }
        
        # Aggiungi campi specifici se presenti
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'ip_address'):
            log_entry['ip_address'] = record.ip_address
        if hasattr(record, 'user_agent'):
            log_entry['user_agent'] = record.user_agent
        if hasattr(record, 'endpoint'):
            log_entry['endpoint'] = record.endpoint
        if hasattr(record, 'event_type'):
            log_entry['event_type'] = record.event_type
        
        return json.dumps(log_entry)

# settings.py - Configurazione logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'security': {
            '()': 'users_api.logging_config.SecurityFormatter',
        },
        'standard': {
            'format': '{levelname} {asctime} {name} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'security_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/app/logs/security.log',
            'formatter': 'security',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
        },
        'audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': '/app/logs/audit.log',
            'formatter': 'security',
            'when': 'midnight',
            'backupCount': 30,
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'loggers': {
        'security': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'audit': {
            'handlers': ['audit_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}

# users_api/audit.py
import logging
from functools import wraps

def audit_log(event_type):
    """Decorator per logging di audit"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            logger = logging.getLogger('audit')
            
            # Info pre-esecuzione
            logger.info(
                f'Audit: {event_type}',
                extra={
                    'event_type': event_type,
                    'user_id': getattr(request.user, 'id', None),
                    'ip_address': request.META.get('REMOTE_ADDR'),
                    'user_agent': request.META.get('HTTP_USER_AGENT'),
                    'endpoint': request.path,
                    'method': request.method
                }
            )
            
            try:
                response = view_func(request, *args, **kwargs)
                
                # Log successo
                logger.info(
                    f'Audit: {event_type} - SUCCESS',
                    extra={
                        'event_type': f'{event_type}_success',
                        'user_id': getattr(request.user, 'id', None),
                        'status_code': response.status_code
                    }
                )
                
                return response
            
            except Exception as e:
                # Log errore
                logger.error(
                    f'Audit: {event_type} - ERROR',
                    extra={
                        'event_type': f'{event_type}_error',
                        'user_id': getattr(request.user, 'id', None),
                        'error': str(e)
                    }
                )
                raise
        
        return wrapper
    return decorator
```

---

## 💾 Backup e Disaster Recovery

```bash
#!/bin/bash
# scripts/backup.sh - Script di backup sicuro

set -euo pipefail

# Configurazione
BACKUP_DIR="/backups"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
RETENTION_DAYS=30

# Crea directory backup
mkdir -p "${BACKUP_DIR}"

# Timestamp per backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/auth_db_${TIMESTAMP}.sql"

echo "Starting backup at $(date)"

# Dump database
pg_dump -h auth_db -U "${DB_USER}" -d "${DB_NAME}" > "${BACKUP_FILE}"

# Comprimi e cripta backup
gpg --symmetric --cipher-algo AES256 --compress-algo 1 \
    --passphrase "${ENCRYPTION_KEY}" \
    --batch --yes \
    "${BACKUP_FILE}"

# Rimuovi file non crittografato
rm "${BACKUP_FILE}"

echo "Backup completed: ${BACKUP_FILE}.gpg"

# Pulizia backup vecchi
find "${BACKUP_DIR}" -name "*.gpg" -mtime +${RETENTION_DAYS} -delete

# Upload a storage remoto (opzionale)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
    aws s3 cp "${BACKUP_FILE}.gpg" "s3://${AWS_S3_BUCKET}/backups/"
    echo "Backup uploaded to S3"
fi

echo "Backup process completed at $(date)"
```

```python
# management/commands/restore_backup.py
from django.core.management.base import BaseCommand
from django.db import connection
import subprocess
import os

class Command(BaseCommand):
    help = 'Restore database from encrypted backup'
    
    def add_arguments(self, parser):
        parser.add_argument('backup_file', type=str)
        parser.add_argument('--encryption-key', type=str, required=True)
    
    def handle(self, *args, **options):
        backup_file = options['backup_file']
        encryption_key = options['encryption_key']
        
        if not os.path.exists(backup_file):
            self.stdout.write(
                self.style.ERROR(f'Backup file not found: {backup_file}')
            )
            return
        
        try:
            # Decripta backup
            decrypted_file = backup_file.replace('.gpg', '')
            subprocess.run([
                'gpg', '--decrypt', '--batch', '--yes',
                '--passphrase', encryption_key,
                '--output', decrypted_file,
                backup_file
            ], check=True)
            
            # Restore database
            with connection.cursor() as cursor:
                with open(decrypted_file, 'r') as f:
                    cursor.execute(f.read())
            
            self.stdout.write(
                self.style.SUCCESS('Database restored successfully')
            )
            
        except subprocess.CalledProcessError as e:
            self.stdout.write(
                self.style.ERROR(f'Decryption failed: {e}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Restore failed: {e}')
            )
        finally:
            # Rimuovi file temporaneo
            if os.path.exists(decrypted_file):
                os.remove(decrypted_file)
```

---

## 📋 Compliance GDPR e Audit

```python
# users_api/gdpr.py
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import get_user_model
import json
from datetime import datetime

User = get_user_model()

class GDPRDataExportView(View):
    """Esportazione dati utente per GDPR"""
    
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        
        user = request.user
        
        # Raccogli tutti i dati dell'utente
        user_data = {
            'personal_info': {
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date_joined': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
            },
            'security_info': {
                'is_2fa_enabled': user.is_2fa_enabled,
                'password_last_changed': None,  # Implementa tracking
            },
            'activity_log': self.get_user_activity(user),
            'export_timestamp': datetime.utcnow().isoformat()
        }
        
        # Log richiesta esportazione
        logger = logging.getLogger('audit')
        logger.info('GDPR data export requested', extra={
            'event_type': 'gdpr_export',
            'user_id': user.id,
            'ip_address': request.META.get('REMOTE_ADDR')
        })
        
        return JsonResponse(user_data, json_dumps_params={'indent': 2})
    
    def get_user_activity(self, user):
        """Ottieni log attività utente (implementa secondo le tue esigenze)"""
        # Placeholder - implementa raccolta log attività
        return []

class GDPRDataDeletionView(View):
    """Cancellazione dati utente per GDPR"""
    
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        
        user = request.user
        confirmation = request.POST.get('confirmation')
        
        if confirmation != 'DELETE_MY_DATA':
            return JsonResponse({
                'error': 'Confirmation required. Send "DELETE_MY_DATA" in confirmation field'
            }, status=400)
        
        # Log richiesta cancellazione
        logger = logging.getLogger('audit')
        logger.info('GDPR data deletion requested', extra={
            'event_type': 'gdpr_deletion',
            'user_id': user.id,
            'ip_address': request.META.get('REMOTE_ADDR')
        })
        
        # Pseudonimizza invece di cancellare (per conformità audit)
        user.username = f'deleted_user_{user.id}'
        user.email = f'deleted_{user.id}@example.com'
        user.first_name = 'DELETED'
        user.last_name = 'USER'
        user.is_active = False
        user.profile_image = None
        user.save()
        
        return JsonResponse({
            'message': 'Account successfully deleted and data pseudonymized'
        })
```

Questa guida completa ti fornisce strumenti avanzati per migliorare significativamente la sicurezza del tuo microservizio di autenticazione. I miglioramenti includono:

🔐 **Sicurezza Applicativa**: Validazione avanzata, protezione XSS/CSRF, input sanitization
🔑 **2FA/MFA**: Implementazione TOTP con codici di backup
🚫 **Rate Limiting**: Protezione DDoS e brute force
🔒 **Crittografia**: Hashing avanzato, crittografia dati sensibili
🐳 **Container Security**: Hardening Docker, secrets management
📊 **Monitoring**: Health checks, metriche, logging strutturato
💾 **Backup**: Disaster recovery con crittografia
📋 **Compliance**: GDPR, audit trail, data protection

Implementa questi miglioramenti gradualmente, iniziando dalle aree più critiche per la tua applicazione.