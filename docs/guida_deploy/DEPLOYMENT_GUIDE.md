# 🚀 GUIDA COMPLETA AL DEPLOYMENT MULTI-AMBIENTE

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Prerequisiti](#prerequisiti)
3. [Setup Automatico Ambiente](#setup-automatico-ambiente)
4. [Configurazione Domini](#configurazione-domini)
5. [Setup SSL/TLS](#setup-ssltls)
6. [Configurazione API Keys](#configurazione-api-keys)
7. [Deployment Automatizzato](#deployment-automatizzato)
8. [Monitoraggio e Logging](#monitoraggio-e-logging)
9. [Backup e Recovery](#backup-e-recovery)
10. [Gestione Avanzata](#gestione-avanzata)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Panoramica

Questa guida ti aiuterà a implementare un sistema di deployment completo per la tua applicazione AI-PlayGround su server IONOS con due ambienti distinti:

- **Produzione**: `pl-ai.it`
- **Sviluppo**: `dev.pl-ai.it`

### Architettura del Sistema (25 Servizi)

```
┌─────────────────┐    ┌─────────────────┐
│   PRODUZIONE    │    │   SVILUPPO      │
│   pl-ai.it      │    │   dev.pl-ai.it  │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│            IONOS SERVER                 │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │    NGINX    │  │    DOCKER       │   │
│  │ (Reverse    │  │  25 CONTAINERS  │   │
│  │  Proxy)     │  │   - 9 Database  │   │
│  │             │  │   - 9 Backend   │   │
│  │             │  │   - 4 Workers   │   │
│  │             │  │   - 3 Infra     │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

### 🆕 Nuovi Script di Automazione

- 🛠️ **setup-env.sh** - Setup automatico completo dell'ambiente
- 🚀 **deploy.sh** - Deployment automatizzato multi-ambiente
- 🔐 **ssl-setup.sh** - Configurazione automatica SSL/TLS
- 🎛️ **manage.sh** - Interfaccia di gestione interattiva

---

## 🔧 Prerequisiti

### Software Richiesto

1. **Docker & Docker Compose V2**
   ```bash
   # Installa Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   
   # Verifica installazione Docker Compose V2
   docker compose version
   ```

2. **Git**
   ```bash
   sudo apt-get update
   sudo apt-get install -y git
   ```

3. **Certbot (per SSL)**
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   ```

4. **OpenSSL (per generazione password)**
   ```bash
   sudo apt-get install -y openssl
   ```

### Risorse Server IONOS

- **CPU**: Minimo 4 core (8 core consigliati per produzione)
- **RAM**: Minimo 8GB (16GB consigliati per produzione)
- **Storage**: Minimo 100GB SSD
- **Banda**: Illimitata
- **OS**: Ubuntu 22.04 LTS

---

## 🛠️ Setup Automatico Ambiente

### 1. Configurazione Automatica Completa

Il nuovo script `setup-env.sh` automatizza completamente la configurazione:

```bash
# Rendi eseguibile lo script
chmod +x setup-env.sh

# Avvia setup automatico
./setup-env.sh
```

### 2. Cosa fa lo Script Automaticamente

✅ **Verifica File Environment**: Controlla che `.env.dev` e `.env.prod` esistano
✅ **Genera Password Sicure**: Crea password uniche per tutti i 9 database
✅ **Crea Directory Secrets**: Setup automatico `.secrets/dev/` e `.secrets/prod/`
✅ **Template API Keys**: Genera file template per tutte le API keys
✅ **Permessi Sicuri**: Imposta permessi 700 per directory, 600 per file
✅ **Configurazione Domini**: Personalizzazione interattiva domini

### 3. Setup Personalizzato (Opzionale)

Se vuoi personalizzare domini durante il setup:

```bash
# Durante l'esecuzione di setup-env.sh
# Scegli opzione "2" per configurazione personalizzata
# Inserisci i tuoi domini:
# - Dominio principale: tuodominio.it
# - Dominio sviluppo: dev.tuodominio.it
# - Email SSL: tua-email@tuodominio.it
```

---

## 🌐 Configurazione Domini

### 1. Setup DNS su IONOS

Accedi al pannello IONOS e configura i seguenti record DNS:

```
Tipo    Nome         Valore              TTL
A       @           [IP_DEL_TUO_SERVER]  3600
A       www         [IP_DEL_TUO_SERVER]  3600
A       dev         [IP_DEL_TUO_SERVER]  3600
```

### 2. Verifica Propagazione DNS

```bash
# Controlla i domini
nslookup pl-ai.it
nslookup dev.pl-ai.it
nslookup www.pl-ai.it

# Test con dig
dig +short pl-ai.it
dig +short dev.pl-ai.it
```

---

## 🔐 Setup SSL/TLS

### 1. Configurazione Automatica

Usa lo script fornito per configurare automaticamente SSL:

```bash
# Rendi eseguibile lo script
chmod +x ssl-setup.sh

# Setup SSL per sviluppo (test prima con staging)
./ssl-setup.sh dev --staging

# Setup SSL per produzione
./ssl-setup.sh prod
```

### 2. Funzionalità dello Script SSL

✅ **Installazione Automatica Certbot**: Se non presente
✅ **Backup Certificati**: Backup automatico certificati esistenti
✅ **Generazione Certificati**: Let's Encrypt automatico
✅ **Rinnovo Automatico**: Cron job per auto-rinnovo
✅ **Verifica SSL**: Test automatico configurazione
✅ **Restart Services**: Riavvio automatico servizi

### 3. Rinnovo Automatico

Il rinnovo automatico è configurato automaticamente:

```bash
# Verifica il cron job
sudo crontab -l | grep certbot

# Test rinnovo
sudo certbot renew --dry-run
```

---

## 🔑 Configurazione API Keys

### 1. File Template Auto-Generati

Dopo aver eseguito `setup-env.sh`, troverai i template in:

```bash
.secrets/
├── dev/
│   ├── openai_api_key.txt
│   ├── anthropic_api_key.txt
│   ├── gemini_api_key.txt
│   └── stability_api_key.txt
└── prod/
    ├── openai_api_key.txt
    ├── anthropic_api_key.txt
    ├── gemini_api_key.txt
    └── stability_api_key.txt
```

### 2. Configurazione API Keys

```bash
# Sviluppo
echo "sk-proj-YOUR_DEV_OPENAI_KEY" > .secrets/dev/openai_api_key.txt
echo "sk-ant-api03-YOUR_DEV_ANTHROPIC_KEY" > .secrets/dev/anthropic_api_key.txt
echo "AIzaSy_YOUR_DEV_GEMINI_KEY" > .secrets/dev/gemini_api_key.txt
echo "sk-YOUR_DEV_STABILITY_KEY" > .secrets/dev/stability_api_key.txt

# Produzione (usa chiavi separate!)
echo "sk-proj-YOUR_PROD_OPENAI_KEY" > .secrets/prod/openai_api_key.txt
echo "sk-ant-api03-YOUR_PROD_ANTHROPIC_KEY" > .secrets/prod/anthropic_api_key.txt
echo "AIzaSy_YOUR_PROD_GEMINI_KEY" > .secrets/prod/gemini_api_key.txt
echo "sk-YOUR_PROD_STABILITY_KEY" > .secrets/prod/stability_api_key.txt
```

### 3. Verifica Permessi

```bash
# I permessi sono già configurati da setup-env.sh
ls -la .secrets/dev/
# -rw------- 1 user user  52 date openai_api_key.txt
```

---

## 🚀 Deployment Automatizzato

### 1. Script di Deploy

Il nuovo `deploy.sh` gestisce completamente il deployment:

```bash
# Rendi eseguibile lo script
chmod +x deploy.sh

# Visualizza help
./deploy.sh --help
```

### 2. Primo Deploy Sviluppo

```bash
# Build e avvio ambiente di sviluppo
./deploy.sh dev up --build

# Verifica stato servizi (25 servizi totali)
./deploy.sh dev status

# Visualizza logs
./deploy.sh dev logs
```

### 3. Primo Deploy Produzione

```bash
# Build e avvio ambiente di produzione
./deploy.sh prod up --build

# Verifica stato servizi
./deploy.sh prod status

# Migrazioni database
./deploy.sh prod migrate
```

### 4. Architettura Servizi Deployati

#### 🗄️ Database Layer (9 PostgreSQL):
- `auth_db` - Autenticazione utenti
- `user_db` - Gestione profili utente
- `chatbot_db` - Chat e conversazioni
- `image_generator_db` - Generazione immagini
- `resource_db` - Gestione risorse
- `classifier_db` - Classificazione immagini
- `analysis_db` - Analisi dati
- `rag_db` - RAG e documenti
- `learning_db` - Sistema learning

#### 🔧 Backend Services (9 Django/FastAPI):
- `auth_service` - API autenticazione
- `user_service` - API gestione utenti
- `chatbot_service` - API chatbot
- `image_generator_service` - API generazione immagini
- `resource_manager_service` - API gestione risorse
- `image_classifier_service` - API classificazione
- `data_analysis_service` - API analisi dati
- `rag_service` - API RAG e documenti
- `learning_service` - API learning

#### ⚙️ Worker Services (4 Celery):
- `rag_worker` - Processing documenti
- `data_analysis_worker` - Processing analisi
- `image_classifier_worker` - Processing classificazione
- `resource_manager_worker` - Processing risorse

#### 🌐 Infrastructure (3):
- `rabbitmq` - Message broker
- `frontend` - React application
- `nginx` - Reverse proxy e SSL

---

## 📊 Monitoraggio e Logging

### 1. Interfaccia di Gestione Completa

```bash
# Avvia interfaccia interattiva
./manage.sh

# Menu disponibili:
# 1. 🚀 Deploy & Management
# 2. 🔐 SSL Management  
# 3. 📊 Monitoring & Logs
# 4. 💾 Backup & Recovery
# 5. ⚙️ System Maintenance
# 6. 🔧 Troubleshooting
# 7. 📖 Info & Status
```

### 2. Comandi di Monitoraggio

```bash
# Status completo servizi
./deploy.sh [env] status

# Logs in tempo reale
./deploy.sh [env] logs -f

# Logs servizio specifico
./deploy.sh [env] logs nginx
./deploy.sh [env] logs auth_service

# Health check Docker Compose V2
docker compose ps

# Risorse sistema
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### 3. Configurazione Logging Avanzata

```bash
# Setup rotazione log automatica
sudo tee /etc/logrotate.d/ai-playground << EOF
/var/log/ai-playground/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker compose restart nginx
    endscript
}
EOF
```

---

## 💾 Backup e Recovery

### 1. Backup Automatico (Tutti i 9 Database)

```bash
# Backup ambiente specifico
./deploy.sh dev backup
./deploy.sh prod backup

# Il sistema farà backup di:
# ✅ auth_db, user_db, chatbot_db
# ✅ image_generator_db, resource_db, classifier_db  
# ✅ analysis_db, rag_db, learning_db
# ✅ Compressione automatica in .tar.gz
```

### 2. Backup Programmato

```bash
# Setup backup automatico via cron
crontab -e

# Aggiungi per backup giornaliero alle 2:00
0 2 * * * cd /path/to/ai-playground && ./deploy.sh prod backup
```

### 3. Recovery

```bash
# Lista backup disponibili
ls -la ./backups/prod/

# Per restore manuale (esempio)
docker compose exec auth_db psql -U postgres -d postgres < backup_file.sql
```

---

## 🎛️ Gestione Avanzata

### 1. Scaling Worker Services

```bash
# Scala worker services per maggior throughput
docker compose up -d --scale data_analysis_worker=3
docker compose up -d --scale rag_worker=2
docker compose up -d --scale image_classifier_worker=2
```

### 2. Configurazioni Ambiente

#### Development (.env.dev):
- ✅ Debug abilitato
- ✅ Porte esposte per debugging (8001-8009)
- ✅ Hot reload abilitato
- ✅ Logging verboso
- ✅ Rate limiting permissivo (100/1000)

#### Production (.env.prod):
- ✅ Debug disabilitato
- ✅ SSL forzato
- ✅ Security headers
- ✅ Resource limits
- ✅ Worker replicas (2x)
- ✅ Rate limiting restrittivo (50/500)

### 3. Resource Management

```bash
# Monitoraggio risorse in tempo reale
docker stats

# Pulizia sistema
./manage.sh
# Scegli: 5. ⚙️ System Maintenance > 1. 🧹 Clean Docker System
```

---

## 🔧 Troubleshooting

### 1. Diagnostica Automatica

```bash
# Avvia interfaccia troubleshooting
./manage.sh
# Scegli: 6. 🔧 Troubleshooting > 1. 🔍 Diagnose Issues
```

### 2. Problemi Comuni

#### SSL non funziona

```bash
# Verifica certificati
sudo certbot certificates

# Rinnova forzato
./ssl-setup.sh [env] --force

# Riavvia nginx
docker compose restart nginx
```

#### Servizi non si avviano

```bash
# Controlla logs dettagliati
./deploy.sh [env] logs [service]

# Verifica configurazione Docker Compose V2
docker compose -f docker-compose.yml -f docker-compose.[env].yml --env-file .env.[env] config --quiet

# Ricostruisci con cleanup
./deploy.sh [env] down --clean
./deploy.sh [env] up --build
```

#### Database connection issues

```bash
# Test connettività database
./manage.sh
# Scegli: 6. 🔧 Troubleshooting > 4. 💾 Database Connection Test

# Verifica credenziali in .env.[env]
grep DB_PASSWORD .env.dev
```

#### Network issues

```bash
# Verifica network Docker
docker network ls

# Test connettività interna
docker compose exec frontend ping auth_service
docker compose exec auth_service ping auth_db
```

### 3. Debug Export

```bash
# Export completo informazioni debug
./manage.sh
# Scegli: 6. 🔧 Troubleshooting > 7. 📁 Export Debug Info

# Export manuale
docker compose logs > debug_$(date +%Y%m%d_%H%M%S).log
```

---

## 🛡️ Sicurezza e Performance

### Sicurezza Implementata

- 🔒 **SSL/TLS forzato** con certificati Let's Encrypt
- 🛡️ **Security headers** (HSTS, CSP, X-Frame-Options)
- 🔐 **Secrets management** automatico con permessi sicuri
- 🚫 **Rate limiting** differenziato per ambiente
- 🔍 **Container security** con user non-root
- 📊 **Audit logging** completo
- 🔑 **Password generation** sicuro con OpenSSL

### Performance Ottimizzata

- **NGINX**: Compressione gzip, caching, HTTP/2
- **Database**: Connection pooling, query optimization
- **Docker**: Resource limits e health checks
- **Workers**: Auto-scaling in produzione
- **SSL**: Session caching e OCSP stapling

---

## 🎉 Conclusioni

Il sistema di deployment AI-PlayGround è ora completamente automatizzato con:

✅ **Setup automatico** completo tramite `setup-env.sh`
✅ **25 servizi orchestrati** con configurazioni ottimizzate
✅ **SSL automatico** con rinnovo programmato
✅ **Backup automatizzato** di tutti i database
✅ **Monitoraggio completo** tramite interfaccia interattiva
✅ **Scaling automatico** per produzione
✅ **Troubleshooting integrato** per risoluzione rapida problemi

### Comandi Essenziali

```bash
# Setup iniziale completo
./setup-env.sh

# Configurazione SSL
./ssl-setup.sh dev --staging && ./ssl-setup.sh prod

# Deploy
./deploy.sh dev up --build && ./deploy.sh prod up --build

# Gestione quotidiana
./manage.sh
```

Il tuo ambiente AI-PlayGround è pronto per la produzione! 🚀

---

**Made with ❤️ for AI-PlayGround** 