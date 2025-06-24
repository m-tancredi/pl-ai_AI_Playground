# 🛡️ Guida ai Miglioramenti di Sicurezza - Auth Service

## 📋 Indice dei Miglioramenti

1. [Sicurezza Applicativa Avanzata](#sicurezza-applicativa-avanzata)
2. [Autenticazione Multi-Fattore](#autenticazione-multi-fattore)
3. [Rate Limiting e Protezione DDoS](#rate-limiting-e-protezione-ddos)
4. [Crittografia e Hashing Avanzati](#crittografia-e-hashing-avanzati)
5. [Hardening Container e Infrastructure](#hardening-container-e-infrastructure)
6. [Monitoring e Alerting](#monitoring-e-alerting)
7. [Backup e Disaster Recovery](#backup-e-disaster-recovery)
8. [Compliance e Audit](#compliance-e-audit)

---

## 🔐 Sicurezza Applicativa Avanzata

### 1. Input Validation e Sanitization

```python
# users_api/validators.py
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

class SecurePasswordValidator:
    """Validatore password avanzato con controlli di sicurezza"""
    
    def __init__(self):
        self.min_length = 12
        self.require_uppercase = True
        self.require_lowercase = True
        self.require_digits = True
        self.require_special = True
        self.forbidden_patterns = [
            r'(.)\1{2,}',  # Caratteri ripetuti
            r'123456|abcdef|qwerty',  # Pattern comuni
            r'password|admin|user',  # Parole comuni
        ]
    
    def validate(self, password, user=None):
        if len(password) < self.min_length:
            raise ValidationError(
                f"Password deve essere lunga almeno {self.min_length} caratteri."
            )
        
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            raise ValidationError("Password deve contenere almeno una maiuscola.")
        
        if self.require_lowercase and not re.search(r'[a-z]', password):
            raise ValidationError("Password deve contenere almeno una minuscola.")
        
        if self.require_digits and not re.search(r'\d', password):
            raise ValidationError("Password deve contenere almeno un numero.")
        
        if self.require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError("Password deve contenere almeno un carattere speciale.")
        
        # Controlla pattern proibiti
        for pattern in self.forbidden_patterns:
            if re.search(pattern, password.lower()):
                raise ValidationError("Password contiene pattern non sicuri.")
        
        # Controlla se contiene info dell'utente
        if user:
            user_info = [user.username, user.email, user.first_name, user.last_name]
            for info in user_info:
                if info and info.lower() in password.lower():
                    raise ValidationError("Password non può contenere informazioni personali.")

class InputSanitizer:
    """Sanitizza input per prevenire attacchi XSS e injection"""
    
    @staticmethod
    def sanitize_text(text):
        """Sanitizza testo rimuovendo script e HTML pericolosi"""
        if not text:
            return text
        
        # Rimuovi script tags
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
        
        # Rimuovi event handlers
        text = re.sub(r'on\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
        
        # Rimuovi javascript: URLs
        text = re.sub(r'javascript\s*:', '', text, flags=re.IGNORECASE)
        
        return text.strip()
    
    @staticmethod
    def sanitize_email(email):
        """Valida e sanitizza email"""
        if not email:
            return email
        
        # Pattern email robusto
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValidationError("Formato email non valido.")
        
        return email.lower().strip()
```

### 2. Protezione CSRF e Headers di Sicurezza

```python
# settings.py - Miglioramenti sicurezza
import os

# CSRF Protection
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Strict'
CSRF_TRUSTED_ORIGINS = [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
]

# Session Security
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
SESSION_COOKIE_AGE = 3600  # 1 ora

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
X_FRAME_OPTIONS = 'DENY'

# Security Middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'users_api.middleware.SecurityHeadersMiddleware',
    'users_api.middleware.RateLimitMiddleware',
    # ... altri middleware
]

# Content Security Policy
CSP_DEFAULT_SRC = ["'self'"]
CSP_SCRIPT_SRC = ["'self'", "'unsafe-inline'"]
CSP_STYLE_SRC = ["'self'", "'unsafe-inline'"]
CSP_IMG_SRC = ["'self'", "data:", "https:"]
```

---

## 🔑 Autenticazione Multi-Fattore

### Implementazione TOTP (Time-based One-Time Password)

```python
# users_api/models.py - Aggiunta 2FA
import pyotp
from django.db import models

class User(AbstractUser):
    # ... campi esistenti ...
    
    # 2FA Fields
    totp_secret = models.CharField(max_length=32, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)
    backup_codes = models.JSONField(default=list, blank=True)
    
    def generate_totp_secret(self):
        """Genera secret key per TOTP"""
        self.totp_secret = pyotp.random_base32()
        self.save()
        return self.totp_secret
    
    def get_totp_uri(self):
        """Genera URI per QR code"""
        if not self.totp_secret:
            self.generate_totp_secret()
        
        totp = pyotp.TOTP(self.totp_secret)
        return totp.provisioning_uri(
            name=self.email,
            issuer_name="AI PlayGround"
        )
    
    def verify_totp(self, token):
        """Verifica token TOTP"""
        if not self.totp_secret:
            return False
        
        totp = pyotp.TOTP(self.totp_secret)
        return totp.verify(token, valid_window=1)
    
    def generate_backup_codes(self):
        """Genera codici di backup"""
        import secrets
        codes = [secrets.token_hex(4).upper() for _ in range(10)]
        self.backup_codes = codes
        self.save()
        return codes
    
    def use_backup_code(self, code):
        """Usa un codice di backup"""
        if code.upper() in self.backup_codes:
            self.backup_codes.remove(code.upper())
            self.save()
            return True
        return False

# users_api/views.py - Views per 2FA
from django.http import JsonResponse
import qrcode
import io
import base64

class Setup2FAView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Setup 2FA per l'utente"""
        user = request.user
        
        if user.is_2fa_enabled:
            return Response({
                'error': '2FA già abilitato per questo utente'
            }, status=400)
        
        # Genera secret e QR code
        secret = user.generate_totp_secret()
        uri = user.get_totp_uri()
        
        # Genera QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return Response({
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_code_base64}',
            'manual_entry_key': secret
        })

class Verify2FAView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Verifica e abilita 2FA"""
        user = request.user
        token = request.data.get('token')
        
        if not token:
            return Response({'error': 'Token richiesto'}, status=400)
        
        if user.verify_totp(token):
            user.is_2fa_enabled = True
            backup_codes = user.generate_backup_codes()
            user.save()
            
            return Response({
                'message': '2FA abilitato con successo',
                'backup_codes': backup_codes
            })
        
        return Response({'error': 'Token non valido'}, status=400)

class TwoFactorLoginView(TokenObtainPairView):
    """Login con supporto 2FA"""
    
    def post(self, request, *args, **kwargs):
        # Prima fase: verifica username/password
        serializer = self.get_serializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({'error': 'Credenziali non valide'}, status=401)
        
        user = serializer.user
        
        # Se 2FA non è abilitato, procedi normalmente
        if not user.is_2fa_enabled:
            return super().post(request, *args, **kwargs)
        
        # Se 2FA è abilitato, richiedi token
        totp_token = request.data.get('totp_token')
        backup_code = request.data.get('backup_code')
        
        if totp_token and user.verify_totp(totp_token):
            return super().post(request, *args, **kwargs)
        elif backup_code and user.use_backup_code(backup_code):
            return super().post(request, *args, **kwargs)
        
        return Response({
            'error': '2FA token richiesto',
            'requires_2fa': True
        }, status=200)
```

---

## 🚫 Rate Limiting e Protezione DDoS

```python
# users_api/middleware.py
import time
import json
from django.core.cache import cache
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

class RateLimitMiddleware(MiddlewareMixin):
    """Middleware per rate limiting avanzato"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.rules = {
            # Endpoint: (requests, window_seconds, block_seconds)
            '/api/token/': (5, 300, 900),  # 5 tentativi in 5 min, blocco 15 min
            '/api/register/': (3, 3600, 3600),  # 3 registrazioni all'ora
            '/api/token/refresh/': (10, 60, 300),  # 10 refresh al minuto
            '/api/profile/upload-image/': (5, 300, 600),  # 5 upload in 5 min
        }
    
    def process_request(self, request):
        # Ottieni IP client (considera proxy)
        client_ip = self.get_client_ip(request)
        endpoint = request.path
        
        # Controlla se l'endpoint ha regole di rate limiting
        if endpoint in self.rules:
            max_requests, window, block_time = self.rules[endpoint]
            
            # Chiave cache per tracking
            cache_key = f'rate_limit:{client_ip}:{endpoint}'
            blocked_key = f'blocked:{client_ip}:{endpoint}'
            
            # Controlla se l'IP è bloccato
            if cache.get(blocked_key):
                return JsonResponse({
                    'error': 'IP temporaneamente bloccato per troppi tentativi',
                    'retry_after': cache.ttl(blocked_key)
                }, status=429)
            
            # Ottieni contatore richieste
            current_requests = cache.get(cache_key, [])
            now = time.time()
            
            # Rimuovi richieste vecchie
            current_requests = [req_time for req_time in current_requests 
                              if now - req_time < window]
            
            # Controlla limite
            if len(current_requests) >= max_requests:
                # Blocca IP
                cache.set(blocked_key, True, block_time)
                
                # Log tentativo sospetto
                self.log_suspicious_activity(client_ip, endpoint, request)
                
                return JsonResponse({
                    'error': 'Troppi tentativi. IP bloccato temporaneamente.',
                    'retry_after': block_time
                }, status=429)
            
            # Aggiungi richiesta corrente
            current_requests.append(now)
            cache.set(cache_key, current_requests, window)
    
    def get_client_ip(self, request):
        """Ottieni IP client reale considerando proxy"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def log_suspicious_activity(self, ip, endpoint, request):
        """Log attività sospette"""
        import logging
        logger = logging.getLogger('security')
        
        logger.warning(f'Rate limit exceeded - IP: {ip}, Endpoint: {endpoint}, '
                      f'User-Agent: {request.META.get("HTTP_USER_AGENT", "Unknown")}')

# users_api/decorators.py
from functools import wraps
from django.core.cache import cache
from django.http import JsonResponse

def rate_limit(max_requests=60, window=60, key_func=None):
    """Decorator per rate limiting per view specifiche"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Determina chiave per rate limiting
            if key_func:
                cache_key = key_func(request)
            else:
                cache_key = f'rate_limit_view:{request.META.get("REMOTE_ADDR")}:{view_func.__name__}'
            
            # Ottieni contatore
            current_count = cache.get(cache_key, 0)
            
            if current_count >= max_requests:
                return JsonResponse({
                    'error': 'Rate limit exceeded',
                    'retry_after': cache.ttl(cache_key)
                }, status=429)
            
            # Incrementa contatore
            cache.set(cache_key, current_count + 1, window)
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
```

---

## 🔒 Crittografia e Hashing Avanzati

```python
# users_api/crypto.py
import hashlib
import hmac
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
import base64

class AdvancedCrypto:
    """Classe per operazioni crittografiche avanzate"""
    
    @staticmethod
    def generate_salt():
        """Genera salt casuale per hashing"""
        return secrets.token_hex(32)
    
    @staticmethod
    def hash_password_advanced(password, salt=None):
        """Hash password con Argon2 o PBKDF2"""
        if not salt:
            salt = AdvancedCrypto.generate_salt()
        
        # Usa PBKDF2 con SHA-256
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt.encode('utf-8'),
            iterations=100000,
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode('utf-8')))
        return f"{salt}:{key.decode('utf-8')}"
    
    @staticmethod
    def verify_password_advanced(password, hashed):
        """Verifica password con hash avanzato"""
        try:
            salt, key = hashed.split(':')
            return AdvancedCrypto.hash_password_advanced(password, salt) == hashed
        except:
            return False
    
    @staticmethod
    def encrypt_sensitive_data(data):
        """Cripta dati sensibili"""
        if not hasattr(settings, 'ENCRYPTION_KEY'):
            raise ValueError("ENCRYPTION_KEY non configurata")
        
        f = Fernet(settings.ENCRYPTION_KEY.encode())
        return f.encrypt(data.encode()).decode()
    
    @staticmethod
    def decrypt_sensitive_data(encrypted_data):
        """Decripta dati sensibili"""
        if not hasattr(settings, 'ENCRYPTION_KEY'):
            raise ValueError("ENCRYPTION_KEY non configurata")
        
        f = Fernet(settings.ENCRYPTION_KEY.encode())
        return f.decrypt(encrypted_data.encode()).decode()
    
    @staticmethod
    def generate_secure_token(length=32):
        """Genera token sicuro"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def hash_file(file_path):
        """Calcola hash di un file"""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

# users_api/models.py - Miglioramenti crittografici
class User(AbstractUser):
    # ... campi esistenti ...
    
    # Campi crittografati
    encrypted_phone = models.TextField(blank=True, null=True)
    password_history = models.JSONField(default=list, blank=True)
    
    def set_phone(self, phone_number):
        """Imposta numero di telefono crittografato"""
        if phone_number:
            self.encrypted_phone = AdvancedCrypto.encrypt_sensitive_data(phone_number)
        else:
            self.encrypted_phone = None
    
    def get_phone(self):
        """Ottieni numero di telefono decrittografato"""
        if self.encrypted_phone:
            return AdvancedCrypto.decrypt_sensitive_data(self.encrypted_phone)
        return None
    
    def add_to_password_history(self, password_hash):
        """Aggiungi password alla cronologia (per prevenire riuso)"""
        if not self.password_history:
            self.password_history = []
        
        self.password_history.append({
            'hash': password_hash,
            'created_at': timezone.now().isoformat()
        })
        
        # Mantieni solo le ultime 5 password
        self.password_history = self.password_history[-5:]
        self.save()
    
    def check_password_history(self, password):
        """Controlla se la password è stata usata recentemente"""
        if not self.password_history:
            return False
        
        for entry in self.password_history:
            if AdvancedCrypto.verify_password_advanced(password, entry['hash']):
                return True
        return False
```

Continuiamo con la seconda parte del documento per non superare i limiti di token... 