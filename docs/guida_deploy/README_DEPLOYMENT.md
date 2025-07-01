# 🚀 AI-PlayGround - Sistema di Deployment Multi-Ambiente

## 📋 Panoramica

Questo repository include un sistema completo di deployment multi-ambiente per la gestione di due ambienti distinti:

- **🏭 Produzione**: `pl-ai.it`
- **🔧 Sviluppo**: `dev.pl-ai.it`

## 🎯 Caratteristiche Principali

✅ **Setup Automatizzato** - Configurazione completa con un comando
✅ **Deployment Automatizzato** - Script per deployment con un comando
✅ **SSL/TLS Automatico** - Configurazione automatica Let's Encrypt
✅ **Ambienti Isolati** - Configurazioni separate per dev/prod
✅ **Reverse Proxy** - NGINX con configurazioni ottimizzate
✅ **Backup Automatizzato** - Sistema di backup e recovery
✅ **Monitoring** - Logging e monitoraggio integrati
✅ **Sicurezza** - Best practices di sicurezza implementate

## 🗂️ Struttura Files

```
pl-ai_AI-PlayGround/
├── 📄 docker-compose.yml          # Configurazione base
├── 📄 docker-compose.dev.yml      # Override sviluppo (AGGIORNATO)
├── 📄 docker-compose.prod.yml     # Override produzione (AGGIORNATO)
├── 📄 .env.dev                    # Variabili ambiente sviluppo (COMPLETO)
├── 📄 .env.prod                   # Variabili ambiente produzione (COMPLETO)
├── 🛠️ setup-env.sh               # Setup automatico environment (NUOVO!)
├── 🚀 deploy.sh                   # Script deployment automatizzato
├── 🔐 ssl-setup.sh               # Setup automatico SSL
├── 🎛️ manage.sh                   # Interfaccia gestione generale
├── 📖 DEPLOYMENT_GUIDE.md         # Guida completa implementazione
├── 📄 README_DEPLOYMENT.md        # Questo file
├── .secrets/                      # Directory secrets (AUTO-CREATA)
│   ├── dev/                      # Secrets sviluppo
│   └── prod/                     # Secrets produzione
└── nginx/
    ├── nginx.conf                 # Configurazione base NGINX
    ├── nginx.dev.conf            # Configurazione sviluppo
    └── nginx.prod.conf           # Configurazione produzione
```

## 🚀 Quick Start (NUOVO WORKFLOW)

### 1. Setup Automatico Completo

```bash
# 🎯 NUOVO! Setup automatico di tutto l'ambiente
./setup-env.sh

# Lo script farà automaticamente:
# ✅ Verifica file .env.dev e .env.prod esistenti
# ✅ Genera password sicure uniche per tutti i database
# ✅ Crea directory .secrets/ con permessi corretti
# ✅ Genera template per API keys
# ✅ Configurazione personalizzabile domini
```

### 2. Configurazione API Keys

```bash
# Modifica i file secrets con le tue API keys:
nano .secrets/dev/openai_api_key.txt      # sk-proj-YOUR_DEV_KEY
nano .secrets/dev/anthropic_api_key.txt   # sk-ant-api03-YOUR_DEV_KEY
nano .secrets/dev/gemini_api_key.txt      # AIzaSy_YOUR_DEV_KEY
nano .secrets/dev/stability_api_key.txt   # sk-YOUR_DEV_KEY

# Ripeti per produzione:
nano .secrets/prod/openai_api_key.txt     # sk-proj-YOUR_PROD_KEY
# ... altre API keys per produzione
```

### 3. Setup SSL

```bash
# Setup SSL per sviluppo (test prima con staging)
./ssl-setup.sh dev --staging

# Setup SSL per produzione
./ssl-setup.sh prod
```

### 4. Deploy

```bash
# Deploy ambiente di sviluppo
./deploy.sh dev up --build

# Deploy ambiente di produzione  
./deploy.sh prod up --build
```

### 5. Gestione Quotidiana

```bash
# Interfaccia di gestione interattiva completa
./manage.sh
```

## 🌐 Configurazione Domini IONOS

Nel pannello IONOS, configura questi record DNS:

```
Tipo    Nome    Valore              TTL
A       @       [IP_SERVER]         3600
A       www     [IP_SERVER]         3600  
A       dev     [IP_SERVER]         3600
```

## 🔐 Configurazione SSL

Il sistema usa Let's Encrypt per SSL automatico:

- ✅ Rinnovo automatico configurato
- ✅ Certificati separati per ogni ambiente  
- ✅ Configurazioni di sicurezza moderne
- ✅ HSTS e security headers

## 📊 Monitoraggio

### Comandi Utili

```bash
# Status servizi
./deploy.sh [env] status

# Logs in tempo reale
./deploy.sh [env] logs -f

# Health check
docker compose ps

# Risorse sistema
docker stats
```

### Logs Localizzazione

- **NGINX**: `/var/log/nginx/`
- **Docker**: `docker logs [container]`
- **Sistema**: `/var/log/`

## 💾 Backup

### Backup Manuale

```bash
# Backup ambiente specifico (TUTTI i 9 database)
./deploy.sh dev backup
./deploy.sh prod backup
```

### Backup Automatico

Configurato via cron per backup giornaliero:

```bash
# Visualizza cron jobs
crontab -l

# Backup salvati in
./backups/[environment]/[timestamp]/
```

## 🔧 Troubleshooting

### Problemi Comuni

#### 1. SSL non funziona

```bash
# Verifica certificati
sudo certbot certificates

# Rinnova certificati
sudo certbot renew --dry-run

# Riavvia nginx
docker compose restart nginx
```

#### 2. Servizi non si avviano

```bash
# Controlla logs
./deploy.sh [env] logs [service]

# Verifica configurazione (NUOVO! Docker Compose v2)
docker compose -f docker-compose.yml -f docker-compose.[env].yml --env-file .env.[env] config

# Ricostruisci immagini
./deploy.sh [env] up --build
```

#### 3. Problemi di rete

```bash
# Verifica network
docker network ls

# Test connettività interna
docker compose exec frontend ping auth_service
```

## 📈 Performance

### Ottimizzazioni Implementate

- **NGINX**: Compressione gzip, caching, keep-alive
- **Database**: Connection pooling, query optimization, PostgreSQL tuning
- **Docker**: Resource limits e health checks
- **SSL**: HTTP/2, session caching
- **Workers**: Scaling automatico in produzione (2x replicas)

### Scaling

```bash
# Scala worker services (AGGIORNATO con nuovi servizi)
docker compose up -d --scale data_analysis_worker=3
docker compose up -d --scale rag_worker=2

# Monitora risorse
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

## 🛡️ Sicurezza

### Caratteristiche di Sicurezza

- 🔒 **SSL/TLS forzato** per tutti i domini
- 🛡️ **Security headers** (HSTS, CSP, etc.)
- 🔐 **Secrets management** automatico e separato per ambiente
- 🚫 **Rate limiting** su API endpoints (100/1000 dev, 50/500 prod)
- 🔍 **Container security** con user non-root
- 📊 **Logging** dettagliato per audit
- 🔑 **Password generation** automatico con OpenSSL

### Best Practices Implementate

- ✅ Password complesse generate automaticamente per ambiente
- ✅ Porte database non esposte in produzione
- ✅ Volumi read-only dove possibile
- ✅ Health checks per tutti i servizi
- ✅ Resource limits per prevenire DoS
- ✅ Separazione completa secrets dev/prod

## 🎛️ Interfaccia di Gestione

Lo script `./manage.sh` fornisce un'interfaccia interattiva per:

- 🚀 **Deploy & Management**: Deploy, restart, scale servizi
- 🔐 **SSL Management**: Setup e rinnovo certificati
- 📊 **Monitoring**: Status, logs, performance
- 💾 **Backup & Recovery**: Backup automatici e restore
- ⚙️ **Maintenance**: Pulizia sistema, aggiornamenti
- 🔧 **Troubleshooting**: Diagnosi e risoluzione problemi

## 📞 Supporto

### Comandi di Debug

```bash
# Status completo sistema tramite interfaccia
./manage.sh

# Export informazioni debug
docker compose logs > debug_$(date +%Y%m%d).log

# Verifica configurazione (AGGIORNATO)
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev config --quiet

# Test connettività
curl -I https://pl-ai.it
curl -I https://dev.pl-ai.it
```

### File di Configurazione Chiave

- ✅ `.env.dev` / `.env.prod` - Variabili ambiente (COMPLETI E PRONTI)
- ✅ `.secrets/dev/` / `.secrets/prod/` - API keys e credenziali (AUTO-GENERATI)
- ✅ `nginx/*.conf` - Configurazioni reverse proxy
- ✅ `docker-compose.*.yml` - Orchestrazione servizi (COMPLETI CON 25 SERVIZI)

## 🚀 Architettura Completa

### Servizi Inclusi (25 TOTALI):

#### 🗄️ Database Layer (9 PostgreSQL):
- `auth_db`, `user_db`, `chatbot_db`
- `image_generator_db`, `resource_db`, `classifier_db`
- `analysis_db`, `rag_db`, `learning_db`

#### 🔧 Backend Services (9 Django/FastAPI):
- `auth_service`, `user_service`, `chatbot_service`
- `image_generator_service`, `resource_manager_service`
- `image_classifier_service`, `data_analysis_service`
- `rag_service`, `learning_service`

#### ⚙️ Worker Services (4 Celery):
- `rag_worker`, `data_analysis_worker`
- `image_classifier_worker`, `resource_manager_worker`

#### 🌐 Infrastructure (3):
- `rabbitmq` (message broker)
- `frontend` (React)
- `nginx` (reverse proxy)

## 🎉 Conclusioni

Il sistema di deployment è ora completo e pronto per l'uso in produzione. Include:

✅ **Setup automatizzato completo** tramite `setup-env.sh`
✅ **Automazione completa** del processo di deploy
✅ **Configurazioni ottimizzate** per performance e sicurezza  
✅ **Monitoraggio e logging** integrati
✅ **Backup automatizzati** per disaster recovery
✅ **Gestione semplificata** tramite interfaccia interattiva
✅ **25 servizi orchestrati** con configurazioni separate per ambiente

Per la guida completa di implementazione, consulta: **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

---

**Made with ❤️ for AI-PlayGround** 