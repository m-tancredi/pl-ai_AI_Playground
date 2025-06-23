# User Service - AI PlayGround

Il `user_service` è un microservizio dedicato alla gestione completa dei profili utente nel progetto AI PlayGround.

## 🎯 Obiettivi del Servizio

Gestisce tutti i dati utente non correlati all'autenticazione (già gestita da `auth_service`), inclusi:
- **Profili utente completi** con informazioni dettagliate
- **Preferenze e impostazioni** personalizzate  
- **Cronologia attività** e metadati utente
- **Upload e gestione avatar**

## 🏗️ Architettura

### Struttura del Progetto
```
user_service/
├── .env                           # Variabili d'ambiente
├── .dockerignore                  # File Docker ignore
├── Dockerfile                     # Configurazione container
├── entrypoint.sh                  # Script di inizializzazione
├── manage.py                      # Django management script
├── requirements.txt               # Dipendenze Python
├── user_api/                      # App Django principale
│   ├── __init__.py
│   ├── admin.py                   # Admin Django
│   ├── apps.py                    # Configurazione app
│   ├── authentication.py          # Autenticazione JWT personalizzata
│   ├── models.py                  # Modelli database
│   ├── permissions.py             # Permessi personalizzati
│   ├── serializers.py             # Serializers DRF
│   ├── signals.py                 # Signal handlers Django
│   ├── urls.py                    # URL routing
│   ├── views.py                   # Views API
│   ├── migrations/                # Migrazioni database
│   ├── config/                    # Configurazioni specifiche
│   └── utils/                     # Utilities
├── service_config/                # Configurazione Django
│   ├── __init__.py
│   ├── asgi.py                    # ASGI config
│   ├── celery.py                  # Celery config
│   ├── secrets_helper.py          # Helper per Docker secrets
│   ├── settings.py                # Settings Django
│   ├── urls.py                    # URL routing principale
│   └── wsgi.py                    # WSGI config
├── mediafiles/                    # File media
└── logs/                          # Log files
```

## 📊 Modelli Dati

### UserProfile
Modello principale per i profili utente:

```python
# Campi Principali
user_id            # UUID - Chiave primaria collegata ad auth_service
first_name         # String - Nome utente
last_name          # String - Cognome utente  
display_name       # String - Nome pubblico (opzionale)
email              # Email - Indirizzo email
phone_number       # String - Numero telefono (opzionale)

# Profilo Esteso
profile_picture_url # URL - Immagine profilo
bio                # Text - Biografia (max 500 caratteri)
location           # String - Località
date_of_birth      # Date - Data di nascita

# Sistema
preferences        # JSON - Impostazioni personalizzate
status             # String - Stato account (active/inactive/suspended/pending)
last_activity      # DateTime - Ultima attività
created_at         # DateTime - Data creazione
updated_at         # DateTime - Data aggiornamento
```

### UserActivityLog
Modello per tracciare le attività:

```python
user_profile       # ForeignKey - Profilo utente
action             # String - Tipo azione
description        # Text - Descrizione
ip_address         # IP - Indirizzo IP
user_agent         # Text - User Agent
metadata           # JSON - Metadati aggiuntivi
created_at         # DateTime - Timestamp
```

## 🔌 Endpoint API

### Profili Utente
```
GET    /api/users/                           # Lista profili (admin) / proprio profilo (user)
POST   /api/users/                          # Crea nuovo profilo
GET    /api/users/{user_id}/                # Dettagli profilo specifico
PUT    /api/users/{user_id}/                # Aggiorna profilo completo
PATCH  /api/users/{user_id}/                # Aggiorna profilo parziale
DELETE /api/users/{user_id}/                # Elimina profilo
```

### Endpoint Specializzati
```
GET    /api/users/me/                       # Profilo utente corrente
GET    /api/users/stats/                    # Statistiche utenti (admin)
GET    /api/users/{user_id}/preferences/    # Recupera preferenze
PUT    /api/users/{user_id}/preferences/    # Aggiorna preferenze
POST   /api/users/{user_id}/upload-avatar/  # Carica avatar
GET    /api/users/{user_id}/public/         # Profilo pubblico
PATCH  /api/users/{user_id}/status/         # Aggiorna stato (admin)
GET    /api/users/{user_id}/activity-logs/  # Log attività utente
```

### Profili Pubblici
```
GET    /api/users-public/                   # Lista profili pubblici
GET    /api/users-public/{user_id}/         # Profilo pubblico specifico
```

### Log Attività
```
GET    /api/activity-logs/                  # Lista log attività (admin)
GET    /api/activity-logs/{id}/             # Dettagli log specifico (admin)
```

## 🔐 Autenticazione & Sicurezza

### Autenticazione JWT
- Integrazione con `auth_service` tramite JWT condiviso
- Validazione token e refresh automatico
- Tracking ultima attività utente

### Permessi Personalizzati
- **IsOwnerOrReadOnly**: Lettura per tutti, modifica solo proprietario
- **IsAdminOrOwner**: Accesso admin o proprietario
- **IsActiveUser**: Verifica profilo attivo
- **InternalServicePermission**: Comunicazioni inter-service

### Validazioni
- Validazione email unica
- Validazione numero telefono internazionale
- Validazione immagini (formato e dimensione)
- Validazione età minima (13 anni)
- Sanitizzazione input utente

## 🔄 Integrazione Sistema

### Comunicazione Inter-Service
- **auth_service**: Sincronizzazione dati utente
- **resource_manager_service**: Gestione file e avatar
- Header `X-Internal-Secret` per comunicazioni sicure

### Signal & Eventi
- Signal automatici per creazione/aggiornamento profili
- Log automatico delle attività
- Notifiche ad altri servizi tramite signal personalizzati

### Task Asincroni (Celery)
- Processing immagini avatar
- Sincronizzazione dati
- Notifiche email
- Cleanup automatico

## 🐳 Docker & Deployment

### Build & Run
```bash
# Build immagine
docker build -t user_service .

# Run con docker-compose
docker-compose up user_service

# Run database migration
docker-compose exec user_service python manage.py migrate

# Create superuser
docker-compose exec user_service python manage.py createsuperuser
```

### Configurazione Database
- PostgreSQL 15 Alpine
- Port: 5438 (esterno)
- Volume persistente: `user_db_data`
- Health checks automatici

### Environment Variables
```bash
# Database
USER_DB_NAME=user_db
USER_DB_USER=user_user  
USER_DB_PASSWORD=user_password
USER_DB_HOST=user_db
USER_DB_PORT=5432

# Service specific
MAX_PROFILE_PICTURE_SIZE=5242880  # 5MB
ALLOWED_IMAGE_FORMATS=jpg,jpeg,png,gif
DEFAULT_USER_STATUS=active

# JWT & Security
JWT_SECRET_KEY=jwt-secret-key-shared-between-services
INTERNAL_API_SECRET_VALUE=your-internal-secret-here
```

## 📝 Logging & Monitoring

### Log Levels
- **INFO**: Operazioni normali
- **WARNING**: Situazioni anomale
- **ERROR**: Errori critici
- **DEBUG**: Informazioni dettagliate

### Health Checks
- Endpoint: `/admin/login/`
- Intervallo: 30s
- Timeout: 10s
- Retries: 5

### Metriche
- Numero utenti attivi/inattivi
- Frequenza aggiornamenti profilo
- Upload avatar statistics
- Performance endpoint

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
python manage.py test

# Run specific test
python manage.py test user_api.tests.test_models

# Coverage report
coverage run --source='.' manage.py test
coverage report
```

### API Testing
```bash
# Postman collection disponibile
# Import: UserService.postman_collection.json

# Test endpoints con curl
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/users/me/
```

## 🔧 Sviluppo

### Setup Locale
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run development server
python manage.py runserver 0.0.0.0:8000
```

### Debugging
```bash
# Django shell
python manage.py shell

# Create test data
python manage.py loaddata fixtures/test_data.json

# Database shell
python manage.py dbshell
```

## 📋 TODO & Roadmap

### Immediate
- [ ] Implementare upload real avatar con resource_manager
- [ ] Aggiungere rate limiting
- [ ] Implementare cache Redis
- [ ] Completare test coverage

### Future Features  
- [ ] API per export dati GDPR
- [ ] Integrazione notifiche push
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Backup automatico profili

## 🐛 Troubleshooting

### Problemi Comuni

**Database Connection Error**
```bash
# Check database health
docker-compose exec user_db pg_isready

# Reset database
docker-compose down -v
docker-compose up user_db
```

**JWT Token Invalid**
```bash
# Verify JWT secret matches auth_service
echo $JWT_SECRET_KEY

# Check token in jwt.io debugger
```

**Migration Issues**
```bash
# Reset migrations
python manage.py migrate user_api zero
python manage.py migrate user_api
```

## 📞 Support

Per supporto e domande:
- **Maintainer**: AI PlayGround Team
- **Documentation**: Vedere template MICROSERVICE_TEMPLATE.md
- **Issues**: Aprire ticket nel repository principale

---

**Versione**: 1.0.0  
**Ultima Modifica**: 2024  
**Compatibilità**: Django 4.x, Python 3.10+, PostgreSQL 15+ 