# 🚀 AI-PlayGround - Biblia del Deployment Multi-Ambiente VPS IONOS

> **La guida completa per il deployment multi-ambiente su VPS IONOS del tuo AI-PlayGround**

## 📋 Indice Navigabile

### 🚀 [Quick Start VPS](#-quick-start-vps)
### 📖 [Guida Completa](#-guida-completa)
### 🔧 [Riferimento Quotidiano](#-riferimento-quotidiano) 
### 🚨 [Troubleshooting](#-troubleshooting)

> **⚠️ IMPORTANTE**: Questa guida supporta deployment multi-ambiente su VPS IONOS con coesistenza di altri siti (blackix.it e twinelib.it).

---

## ⚡ Quick Start VPS

> **Tempo richiesto: 10 minuti** | Setup rapido per VPS IONOS

### 🔧 **PREREQUISITO**: Clone del Repository

**Prima di tutto, devi clonare il progetto sulla VPS IONOS:**

```bash
# 1. Connettiti alla VPS IONOS
ssh root@[IP_DELLA_TUA_VPS]

# 2. Vai nella directory dei progetti
cd /opt

# 3. Clona il repository
git clone https://github.com/[TUO-USERNAME]/pl-ai_AI-PlayGround.git
cd pl-ai_AI-PlayGround

# 4. Verifica clone completo
ls -la
# Dovresti vedere: docker-compose.yml, frontend/, backend/, nginx/, etc.
```

### 1️⃣ Setup Automatico VPS
```bash
# Rendi eseguibile lo script di setup
chmod +x setup-vps.sh

# 🎯 Setup automatico per VPS (2 min)
./setup-vps.sh
```

### 2️⃣ Configurazione API Keys
```bash
# Crea directory secrets se non esiste
mkdir -p .secrets

# Inserisci le tue API keys
echo "sk-proj-YOUR-OPENAI-API-KEY-HERE" > .secrets/openai_api_key.txt
echo "sk-ant-api03-YOUR-ANTHROPIC-API-KEY-HERE" > .secrets/anthropic_api_key.txt
echo "AIzaSy-YOUR-GEMINI-API-KEY-HERE" > .secrets/gemini_api_key.txt
echo "sk-YOUR-STABILITY-API-KEY-HERE" > .secrets/stability_api_key.txt

# Imposta permessi sicuri
chmod 600 .secrets/*.txt
```

### 3️⃣ Configurazione DNS
Nel pannello IONOS, aggiungi questo record:
```
A    dev    [IP_SERVER]    3600
```

### 4️⃣ Configurazione NGINX VPS
```bash
# Copia la configurazione NGINX per la VPS
sudo cp nginx/dev.pl-ai.it.conf /etc/nginx/sites-available/dev.pl-ai.it

# Attiva il sito
sudo ln -s /etc/nginx/sites-available/dev.pl-ai.it /etc/nginx/sites-enabled/

# Test configurazione NGINX
sudo nginx -t

# Ricarica NGINX
sudo systemctl reload nginx
```

### 5️⃣ Setup SSL
```bash
# Genera certificato SSL per dev.pl-ai.it
sudo certbot --nginx -d dev.pl-ai.it

# Verifica certificato
sudo certbot certificates
```

### 6️⃣ Deploy
```bash
# Deploy ambiente sviluppo (5 min)
./deploy.sh up -d --build

# Verifica servizi
docker compose ps
```

### 7️⃣ Verifica
```bash
# Test connessioni sviluppo
curl -k https://dev.pl-ai.it/health
curl -k https://dev.pl-ai.it/api/auth/health

# 🎉 FATTO! Il tuo ambiente di sviluppo è online su dev.pl-ai.it!

# Per PRODUZIONE, ripeti il processo sostituendo 'dev' con 'prod':
# ./deploy.sh prod up -d --build
# curl -k https://pl-ai.it/health
```

---

## 📖 Guida Completa

### 🎯 Panoramica Sistema VPS

Questa guida implementa un sistema di deployment multi-ambiente per AI-PlayGround su VPS IONOS con:

- **🔧 Sviluppo**: `dev.pl-ai.it` - Ambiente di sviluppo e test
- **🏭 Produzione**: `pl-ai.it` - Ambiente live per utenti finali
- **🏠 Coesistenza**: Con `blackix.it` e `twinelib.it` già presenti

#### Architettura VPS Multi-Ambiente (25+ Servizi Containerizzati)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               VPS IONOS                                      │
│                                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────────┐ │
│  │    NGINX    │    │                   DOCKER                           │ │
│  │   (Host)    │    │              50+ CONTAINERS                        │ │
│  │             │    │                                                     │ │
│  │ blackix.it  │    │  ┌─────────────────────────────────────────────────┐ │ │
│  │ twinelib.it │    │  │              SVILUPPO                           │ │ │
│  │ dev.pl-ai.it ────┼─▶│      NGINX Container (Port 8081)                │ │ │
│  │ pl-ai.it    ─────┼─▶│                                                 │ │ │
│  │             │    │  │  ┌─────────────────────────────────────────────┐ │ │ │
│  │  Port 80/443│    │  │  │          AI-PlayGround DEV                  │ │ │ │
│  │             │    │  │  │                                             │ │ │ │
│  │             │    │  │  │  • 10 Database                              │ │ │ │
│  │             │    │  │  │  • 10 Backend APIs                          │ │ │ │
│  │             │    │  │  │  • 4 Workers                                │ │ │ │
│  │             │    │  │  │  • 1 Frontend                               │ │ │ │
│  │             │    │  │  │  • 1 RabbitMQ                               │ │ │ │
│  │             │    │  │  └─────────────────────────────────────────────┘ │ │ │
│  │             │    │  └─────────────────────────────────────────────────┘ │ │
│  │             │    │                                                     │ │
│  │             │    │  ┌─────────────────────────────────────────────────┐ │ │
│  │             │    │  │             PRODUZIONE                          │ │ │
│  │             │    │  │       NGINX Container (Port 80/443)             │ │ │
│  │             │    │  │                                                 │ │ │
│  │             │    │  │  ┌─────────────────────────────────────────────┐ │ │ │
│  │             │    │  │  │          AI-PlayGround PROD                 │ │ │ │
│  │             │    │  │  │                                             │ │ │ │
│  │             │    │  │  │  • 10 Database (SSL/TLS)                    │ │ │ │
│  │             │    │  │  │  • 10 Backend APIs (Secure)                 │ │ │ │
│  │             │    │  │  │  • 4 Workers (Scaled)                       │ │ │ │
│  │             │    │  │  │  • 1 Frontend (Optimized)                   │ │ │ │
│  │             │    │  │  │  • 1 RabbitMQ (Secure)                      │ │ │ │
│  │             │    │  │  └─────────────────────────────────────────────┘ │ │ │
│  │             │    │  └─────────────────────────────────────────────────┘ │ │
│  │             │    └─────────────────────────────────────────────────────┘ │
│  └─────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 🎯 Funzionalità Chiave

✅ **Setup Automatizzato** - Configurazione completa con un comando  
✅ **Deployment Automatizzato** - Script per deployment multi-ambiente  
✅ **SSL/TLS Automatico** - Let's Encrypt con rinnovo automatico  
✅ **Ambienti Isolati** - Configurazioni separate dev/prod  
✅ **Reverse Proxy** - NGINX ottimizzato per performance  
✅ **Backup Automatizzato** - Sistema backup/recovery  
✅ **Monitoring** - Logging e health checks integrati  
✅ **Sicurezza** - Best practices di sicurezza implementate  

### 🗂️ Struttura Files VPS Multi-Ambiente

```
pl-ai_AI-PlayGround/
├── 📄 docker-compose.yml          # Configurazione base
├── 📄 docker-compose.dev.yml      # Override sviluppo VPS (dev.pl-ai.it)
├── 📄 docker-compose.prod.yml     # Override produzione (pl-ai.it)
├── 📄 .env.dev                    # Variabili ambiente sviluppo 
├── 📄 .env.prod                   # Variabili ambiente produzione
├── 🛠️ setup-vps.sh               # Setup automatico VPS
├── 🚀 deploy.sh                   # Script deployment multi-ambiente
├── 📖 docs/DEPLOY_VPS_INSTRUCTIONS.md  # Istruzioni specifiche VPS
├── 📖 docs/guida_deploy/DEPLOYMENT_BIBLE.md  # Questa guida completa
├── .secrets/                      # Directory secrets
│   ├── dev/                      # Secrets sviluppo
│   │   ├── openai_api_key.txt
│   │   ├── anthropic_api_key.txt
│   │   ├── gemini_api_key.txt
│   │   └── stability_api_key.txt
│   └── prod/                     # Secrets produzione
│       ├── openai_api_key.txt
│       ├── anthropic_api_key.txt
│       ├── gemini_api_key.txt
│       └── stability_api_key.txt
└── nginx/
    ├── dev.pl-ai.it.conf         # Configurazione NGINX VPS (sviluppo)
    ├── pl-ai.it.conf             # Configurazione NGINX VPS (produzione)
    ├── nginx.dev.vps.conf        # Configurazione NGINX Container (sviluppo)
    └── nginx.prod.conf           # Configurazione NGINX Container (produzione)
```

### 🔧 Prerequisiti VPS

#### Software Server IONOS

1. **Docker & Docker Compose V2**
   ```bash
   # Installa Docker (se non già installato)
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   newgrp docker
   
   # Verifica installazione
   docker --version
   docker compose version
   ```

2. **NGINX** (già installato sulla VPS)
   ```bash
   # Verifica NGINX
   sudo systemctl status nginx
   
   # Test configurazione
   sudo nginx -t
   ```

3. **Certbot per SSL**
   ```bash
   # Installa Certbot se non presente
   sudo apt-get update
   sudo apt-get install -y certbot python3-certbot-nginx
   ```

#### Porte Utilizzate Multi-Ambiente

| Servizio | Porta VPS | Porta Container | Scopo |
|----------|-----------|----------------|-------|
| **Reverse Proxy** | | | |
| NGINX VPS | 80, 443 | - | Reverse proxy principale per tutti i domini |
| **Sviluppo** | | | |
| AI-PlayGround DEV | 8081 | 80 | Container NGINX per dev.pl-ai.it |
| **Produzione** | | | |
| AI-PlayGround PROD | 80, 443 | 80, 443 | Container NGINX per pl-ai.it (diretto) |
| **Sicurezza** | | | |
| Database | - | 5432 | Solo comunicazione interna Docker |
| API Services | - | 8000 | Solo comunicazione interna Docker |
| RabbitMQ | - | 5672 | Solo comunicazione interna Docker |

#### Risorse Server Consigliate

| Risorsa | Minimo | Consigliato | 
|---------|--------|-------------|
| CPU     | 4 core | 8 core      |
| RAM     | 8GB    | 16GB        |
| Storage | 100GB  | 200GB SSD   |
| Banda   | 1GB    | Illimitata  |

### 🛠️ Setup Dettagliato VPS

#### 1. Setup Automatico VPS

Lo script `setup-vps.sh` automatizza la configurazione iniziale per la VPS:

```bash
# Rendilo eseguibile
chmod +x setup-vps.sh

# Avvia il setup
./setup-vps.sh
```

**Cosa fa automaticamente:**
- ✅ Crea file `.env.dev` con variabili per VPS
- ✅ Genera password sicure per tutti i database PostgreSQL
- ✅ Crea struttura directory `.secrets/` con permessi sicuri (700/600)
- ✅ Configura docker-compose per VPS (porta 8081)
- ✅ Prepara configurazioni NGINX per coesistenza
- ✅ Include configurazioni complete per tutti i microservizi

#### 2. Configurazione DNS IONOS

Accedi al **Pannello IONOS** → **Domini** → **pl-ai.it** → **DNS**

Aggiungi questi record per entrambi gli ambienti:

```
Tipo  Nome  Valore                TTL   Priorità
A     @     [IP_DEL_TUO_SERVER]   3600  -    # pl-ai.it (produzione)
A     www   [IP_DEL_TUO_SERVER]   3600  -    # www.pl-ai.it
A     dev   [IP_DEL_TUO_SERVER]   3600  -    # dev.pl-ai.it (sviluppo)
```

**Verifica propagazione DNS:**
```bash
# Test risoluzione dominio
nslookup dev.pl-ai.it
dig +short dev.pl-ai.it

# Test da esterni
curl -I http://dev.pl-ai.it
```

#### 3. Configurazione NGINX VPS Multi-Ambiente

Configura NGINX sulla VPS per il reverse proxy multi-ambiente:

```bash
# Copia le configurazioni NGINX per entrambi gli ambienti
sudo cp nginx/dev.pl-ai.it.conf /etc/nginx/sites-available/dev.pl-ai.it
sudo cp nginx/pl-ai.it.conf /etc/nginx/sites-available/pl-ai.it

# Attiva entrambi i siti
sudo ln -s /etc/nginx/sites-available/dev.pl-ai.it /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/pl-ai.it /etc/nginx/sites-enabled/

# Test configurazione
sudo nginx -t

# Ricarica NGINX
sudo systemctl reload nginx
```

#### 4. Setup SSL/TLS Multi-Ambiente

Configura certificati Let's Encrypt per entrambi gli ambienti:

```bash
# Genera certificati SSL per entrambi i domini
sudo certbot --nginx -d dev.pl-ai.it
sudo certbot --nginx -d pl-ai.it -d www.pl-ai.it

# Verifica certificati
sudo certbot certificates

# Test rinnovo automatico
sudo certbot renew --dry-run
```

#### 5. Configurazione API Keys Multi-Ambiente

Configura le API keys per entrambi gli ambienti:

```bash
# Crea directory secrets per entrambi gli ambienti
mkdir -p .secrets/dev .secrets/prod

# Inserisci le API keys SVILUPPO (possono essere di test/lower-tier)
echo "sk-proj-YOUR-DEV-OPENAI-KEY" > .secrets/dev/openai_api_key.txt
echo "sk-ant-api03-YOUR-DEV-ANTHROPIC-KEY" > .secrets/dev/anthropic_api_key.txt
echo "AIzaSy-YOUR-DEV-GEMINI-KEY" > .secrets/dev/gemini_api_key.txt
echo "sk-YOUR-DEV-STABILITY-KEY" > .secrets/dev/stability_api_key.txt

# Inserisci le API keys PRODUZIONE (SEPARATE e con rate limit alto)
echo "sk-proj-YOUR-PROD-OPENAI-KEY" > .secrets/prod/openai_api_key.txt
echo "sk-ant-api03-YOUR-PROD-ANTHROPIC-KEY" > .secrets/prod/anthropic_api_key.txt
echo "AIzaSy-YOUR-PROD-GEMINI-KEY" > .secrets/prod/gemini_api_key.txt
echo "sk-YOUR-PROD-STABILITY-KEY" > .secrets/prod/stability_api_key.txt

# Imposta permessi sicuri
chmod 600 .secrets/dev/*.txt .secrets/prod/*.txt
```

**Struttura secrets multi-ambiente:**
```
.secrets/
├── dev/                          # Ambiente sviluppo
│   ├── openai_api_key.txt
│   ├── anthropic_api_key.txt
│   ├── gemini_api_key.txt
│   └── stability_api_key.txt
└── prod/                         # Ambiente produzione
    ├── openai_api_key.txt
    ├── anthropic_api_key.txt
    ├── gemini_api_key.txt
    └── stability_api_key.txt
```

**Best Practices API Keys:**
- 🔒 **Permessi sicuri** sui file (600)
- 💰 **Rate limiting** configurato
- 📊 **Monitoring** utilizzo
- 🔄 **Rotazione** periodica delle chiavi
- 🚫 **Mai committare** in git

### 🚀 Deployment VPS Multi-Ambiente

#### Script di Deployment

Il deployment è gestito dallo script `deploy.sh` per entrambi gli ambienti:

```bash
# Rendilo eseguibile
chmod +x deploy.sh

# Sintassi base per VPS multi-ambiente
./deploy.sh [ambiente] [comando] [opzioni]

# Esempi SVILUPPO
./deploy.sh dev up --build      # Deploy sviluppo con build
./deploy.sh dev up -d           # Deploy sviluppo in background
./deploy.sh dev down            # Stop sviluppo
./deploy.sh dev restart         # Restart sviluppo
./deploy.sh dev logs -f         # Logs sviluppo in tempo reale

# Esempi PRODUZIONE
./deploy.sh prod up --build -d  # Deploy produzione con build
./deploy.sh prod down           # Stop produzione
./deploy.sh prod restart        # Restart produzione
./deploy.sh prod logs -f        # Logs produzione in tempo reale
```

#### Processo Deployment Completo

**Deployment Sviluppo:**
```bash
# 1. Deploy ambiente sviluppo
./deploy.sh dev up --build -d

# 2. Verifica servizi
./deploy.sh dev ps

# 3. Test health check
curl -k https://dev.pl-ai.it/health

# 4. Logs in tempo reale
./deploy.sh dev logs -f

# 5. Monitoring
docker stats --no-stream
```

**Deployment Produzione:**
```bash
# 1. Deploy ambiente produzione
./deploy.sh prod up --build -d

# 2. Verifica servizi
./deploy.sh prod ps

# 3. Test health check completo
curl -k https://pl-ai.it/health
curl -k https://pl-ai.it/api/auth/health
curl -k https://pl-ai.it/api/users/health

# 4. Logs produzione
./deploy.sh prod logs -f

# 5. Monitoring avanzato
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

#### Configurazioni Environment Multi-Ambiente

**File `.env.dev` (Sviluppo VPS) - Variabili principali:**
```bash
# Debug attivo per sviluppo
DJANGO_DEBUG=true
LOG_LEVEL=DEBUG

# Dominio sviluppo
DOMAIN=dev.pl-ai.it
CORS_ALLOWED_ORIGINS=https://dev.pl-ai.it,http://localhost:3000

# Configurazione porte VPS sviluppo
NGINX_HOST_PORT=8081
NGINX_CONTAINER_PORT=80

# Database sviluppo
AUTH_DB_NAME=auth_db_dev
USER_DB_NAME=user_db_dev
CHATBOT_DB_NAME=chatbot_db_dev
# ... altri database

# Configurazioni less restrictive per sviluppo
RATE_LIMIT_ANON=100/hour
RATE_LIMIT_USER=1000/hour
```

**File `.env.prod` (Produzione) - Variabili principali:**
```bash
# Debug disattivato per produzione
DJANGO_DEBUG=false
LOG_LEVEL=WARNING

# Domini produzione
DOMAIN=pl-ai.it
CORS_ALLOWED_ORIGINS=https://pl-ai.it,https://www.pl-ai.it

# Configurazione porte produzione (diretto)
NGINX_HOST_PORT=80,443
NGINX_CONTAINER_PORT=80,443

# Database produzione (nomi separati)
AUTH_DB_NAME=auth_db_prod
USER_DB_NAME=user_db_prod
CHATBOT_DB_NAME=chatbot_db_prod
# ... altri database

# Sicurezza produzione
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
SECURE_HSTS_SECONDS=31536000

# Rate limiting produzione
RATE_LIMIT_ANON=50/hour
RATE_LIMIT_USER=500/hour
```

### 🧪 Test di Validazione

#### Test Configurazioni NGINX

Prima del deployment, è fondamentale validare le configurazioni NGINX:

**Script di Test Automatico:**
```bash
# Esegui test completo configurazioni NGINX
./test-nginx-simple.sh
```

**Output atteso:**
```
🧪 Test Semplificato NGINX - Solo Sintassi
==========================================
🔍 Test sintassi DEVELOPMENT...
✅ DEVELOPMENT: Sintassi base VALIDA

🔍 Test sintassi PRODUCTION...
✅ PRODUCTION: Sintassi base VALIDA

📋 Riepilogo Finale
==================
✅ nginx.dev.conf: Configurazione completa per sviluppo
✅ nginx.prod.conf: Configurazione avanzata per produzione

🔧 Funzionalità Verificate:
   • SSL/TLS configurato correttamente
   • HTTP2 configurato (senza warning)
   • Rate limiting (solo prod)
   • Security headers
   • Media file serving
   • API routing completo
   • Frontend SPA support
```

**Test Manuali Aggiuntivi:**
```bash
# Test sintassi diretta NGINX (in caso di problemi)
docker run --rm -v $(pwd)/nginx/nginx.dev.conf:/tmp/nginx.conf nginx:alpine nginx -t -c /tmp/nginx.conf

# Verifica configurazioni specifiche
grep -n "server_name" nginx/nginx.*.conf
grep -n "ssl_certificate" nginx/nginx.*.conf
grep -n "limit_req" nginx/nginx.prod.conf
```

### 🔍 Monitoraggio e Logging

#### Health Checks Automatici

Ogni servizio ha health checks configurati:

```bash
# Verifica stato servizi
./deploy.sh dev status
./deploy.sh prod status

# Health check manuale
curl -k https://dev.pl-ai.it/health
curl -k https://pl-ai.it/health

# Health check specifico servizio  
curl -k https://pl-ai.it/api/auth/health
curl -k https://pl-ai.it/api/chatbot/health
```

#### Logging Centralizzato

**Logs in tempo reale:**
```bash
# Tutti i servizi
./deploy.sh dev logs -f

# Servizio specifico
./deploy.sh dev logs -f auth_service
./deploy.sh prod logs -f nginx

# Ultimi 100 log
./deploy.sh dev logs --tail=100 frontend
```

**Localizzazione Logs:**
- **NGINX**: Container logs via `docker logs`
- **Backend Services**: Container logs + file logs interni
- **Database**: Container logs + PostgreSQL logs
- **Workers**: Celery logs + task logs

#### Monitoring Risorse

```bash
# Utilizzo risorse in tempo reale
docker stats

# Formatato per leggibilità  
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Disk usage
docker system df

# Cleanup spazio
docker system prune -f
```

### 💾 Backup e Recovery

#### Backup Automatico

Lo script `deploy.sh` include funzionalità di backup:

```bash
# Backup ambiente sviluppo (tutti gli 11 database)
./deploy.sh dev backup

# Backup ambiente produzione
./deploy.sh prod backup

# Backup con timestamp personalizzato
./deploy.sh prod backup --timestamp="2024-12-manual"
```

**Cosa viene salvato:**
- ✅ Tutti gli 11 database PostgreSQL
- ✅ Volumi Docker persistenti  
- ✅ File di configurazione
- ✅ Certificati SSL
- ✅ Logs di sistema

#### Recovery

```bash
# Lista backup disponibili
ls -la backups/

# Restore da backup specifico
./deploy.sh prod restore --backup="backups/prod/2024-12-19_14-30-00"

# Restore solo database specifico
./deploy.sh dev restore --backup="backups/dev/latest" --db="auth_db"
```

### 🔒 Sicurezza Avanzata

#### Configurazioni Sicurezza Implementate

**NGINX Security Headers:**
```nginx
# nginx.prod.conf ha headers di sicurezza completi
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "default-src 'self'";
```

**Database Security:**
- 🔒 **Password complesse** generate automaticamente (32+ caratteri)
- 🚫 **Porte non esposte** esternamente in produzione
- 🔐 **Connessioni SSL** tra servizi
- 📊 **Connection pooling** configurato

**Container Security:**
- 👤 **User non-root** in tutti i container
- 🔒 **Resource limits** per prevenire DoS
- 📊 **Health checks** per tutti i servizi
- 🔄 **Restart policies** configurate

#### Gestione Secrets

I secrets sono gestiti in modo sicuro:

```bash
# Verifica permessi
ls -la .secrets/
# drwx------ 2 user user 4096 .secrets/dev/
# drwx------ 2 user user 4096 .secrets/prod/

ls -la .secrets/dev/
# -rw------- 1 user user 52 openai_api_key.txt
```

**Best Practices Secrets:**
- 🔒 **Permessi 700** per directory, **600** per file
- 🚫 **Mai in git** (già configurato in .gitignore)
- 🔄 **Rotazione periodica** API keys
- 📊 **Audit trail** per accessi

---

## 🔧 Riferimento Quotidiano

> **Comandi frequenti per gestione quotidiana**

### 🎛️ Interfaccia di Gestione

Usa l'interfaccia interattiva per gestioni rapide:

```bash
# Avvia interfaccia di gestione
./manage.sh

# Menu interattivo:
# 1. 📊 Status servizi
# 2. 🚀 Deploy/Restart
# 3. 📋 Logs
# 4. 💾 Backup
# 5. 🔧 Manutenzione
# 6. 📈 Monitoring
```

### ⚡ Comandi Rapidi

**Status e Monitoring:**
```bash
# Status rapido tutti gli ambienti  
./deploy.sh dev status && ./deploy.sh prod status

# Logs rapidi errori
./deploy.sh prod logs --tail=50 | grep ERROR

# Utilizzo risorse
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

**Deploy Rapido:**
```bash
# Restart rapido servizio
./deploy.sh prod restart [servizio]

# Deploy solo frontend
./deploy.sh dev up --build frontend

# Scale workers
./deploy.sh prod up --scale data_analysis_worker=3 -d
```

**Manutenzione:**
```bash
# Cleanup Docker
docker system prune -f

# Test configurazioni NGINX
./test-nginx-simple.sh

# Restart NGINX (per nuovi SSL)
./deploy.sh prod restart nginx
```

### 📊 Dashboard Monitoring

**Metriche Sistema:**
```bash
# CPU e RAM
top -p $(docker ps -q | tr '\n' ',' | sed 's/,$//')

# Disk usage
df -h
docker system df

# Network activity
netstat -tulpn | grep :443
netstat -tulpn | grep :80
```

**Metriche Applicazione:**
```bash
# Response time
curl -w "@curl-format.txt" -o /dev/null -s https://pl-ai.it/

# Database connections
./deploy.sh prod exec auth_db psql -U auth_admin -c "SELECT count(*) FROM pg_stat_activity;"

# Queue status (RabbitMQ)  
./deploy.sh prod exec rabbitmq rabbitmqctl list_queues
```

### 🔄 Routine Manutenzione

**Giornaliera:**
```bash
# Check status
./manage.sh → opzione 1

# Review logs errori
./deploy.sh prod logs --tail=100 | grep -i error

# Backup manuale se necessario
./deploy.sh prod backup
```

**Settimanale:**
```bash
# Cleanup system
docker system prune -f

# Update certificati SSL
sudo certbot renew

# Review disk usage
df -h && docker system df
```

**Mensile:**
```bash
# Update immagini Docker
./deploy.sh prod down
./deploy.sh prod up --build -d

# Backup completo di sicurezza
./deploy.sh prod backup --timestamp="monthly-$(date +%Y-%m)"
```

---

## 🚨 Troubleshooting

### 🔥 Problemi Comuni e Soluzioni

#### 1. SSL/TLS Non Funziona

**Sintomi:**
- Errore "Your connection is not private"
- Certificati scaduti
- Mixed content warnings

**Diagnosi:**
```bash
# Verifica certificati
sudo certbot certificates

# Test SSL
openssl s_client -connect pl-ai.it:443 -servername pl-ai.it

# Check NGINX config
./deploy.sh prod exec nginx nginx -t
```

**Soluzioni:**
```bash
# Test configurazioni NGINX
./test-nginx-simple.sh

# Rinnova certificati
sudo certbot renew --force-renewal

# Riavvia NGINX
./deploy.sh prod restart nginx

# Re-run SSL setup
./ssl-setup.sh prod

# Verifica DNS
dig +short pl-ai.it
```

#### 2. Servizi Non Si Avviano

**Sintomi:**
- Container in stato "Exited"
- Errori di connessione
- Timeout durante startup

**Diagnosi:**
```bash
# Status dettagliato
./deploy.sh prod status

# Logs specifici errori
./deploy.sh prod logs [servizio_problema]

# Verifica configurazione
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod config
```

**Soluzioni:**
```bash
# Riavvio servizio specifico
./deploy.sh prod restart [servizio]

# Rebuild immagine
./deploy.sh prod up --build [servizio]

# Reset completo
./deploy.sh prod down
./deploy.sh prod up --build -d
```

#### 3. Database Non Accessibili

**Sintomi:**
- Errori connessione database
- "Password authentication failed"
- Connection timeout

**Diagnosi:**
```bash
# Verifica container database
./deploy.sh prod status | grep _db

# Test connessione diretta
./deploy.sh prod exec auth_db psql -U auth_admin -d auth_db_prod

# Verifica variabili environment
./deploy.sh prod exec auth_service printenv | grep DB_
```

**Soluzioni:**
```bash
# Reset password database
./setup-env.sh  # Rigenera password

# Riavvio database
./deploy.sh prod restart auth_db

# Verifica volumi
docker volume ls | grep ai_playground
```

#### 4. Performance Problemi

**Sintomi:**
- Sito lento
- Timeout requests
- High CPU/Memory usage

**Diagnosi:**
```bash
# Monitoring risorse
docker stats --no-stream

# Check disk space
df -h
docker system df

# Network connectivity
./deploy.sh prod exec frontend ping auth_service
```

**Soluzioni:**
```bash
# Scale workers
./deploy.sh prod up --scale data_analysis_worker=3 -d

# Cleanup system
docker system prune -f

# Restart services
./deploy.sh prod restart
```

#### 5. Frontend Non Carica

**Sintomi:**
- Pagina bianca
- 404 errors
- Assets non caricano

**Diagnosi:**
```bash
# Verifica frontend container
./deploy.sh prod logs frontend

# Verifica NGINX config
./deploy.sh prod exec nginx cat /etc/nginx/conf.d/default.conf
```

**Soluzioni:**
```bash
# Rebuild frontend
./deploy.sh prod up --build frontend

# Clear browser cache
# Verifica CORS settings in .env.prod

# Check build process
./deploy.sh prod logs frontend | grep -i build
```

### 🆘 Emergency Procedures

#### Rollback Rapido

```bash
# Stop ambiente problematico
./deploy.sh prod down

# Restore da backup recente
./deploy.sh prod restore --backup="backups/prod/latest"

# Deploy ambiente pulito
./deploy.sh prod up -d
```

#### Recovery Disastro

```bash
# 1. Backup corrente (anche se danneggiato)
./deploy.sh prod backup --timestamp="emergency-$(date +%s)"

# 2. Reset completo
./deploy.sh prod down -v  # ATTENZIONE: cancella volumi!

# 3. Restore da backup noto funzionante
./deploy.sh prod restore --backup="backups/prod/[timestamp-sicuro]"

# 4. Rebuild da zero
./deploy.sh prod up --build -d
```

### 📋 Checklist Debugging

**Prima di ogni sessione debug:**
- [ ] Backup corrente dell'ambiente
- [ ] Identificazione timestamp problema
- [ ] Raccolta logs rilevanti
- [ ] Verifica status tutti i servizi
- [ ] Check risorse sistema

**Per ogni problema:**
- [ ] Logs dettagliati del servizio specifico
- [ ] Verifica configurazione environment
- [ ] Test connettività di rete
- [ ] Verifica permessi e secrets
- [ ] Test su ambiente sviluppo se possibile

---

## 🎯 Performance e Ottimizzazione

### 📈 Configurazioni Performance

#### NGINX Ottimizzazioni

```nginx
# Configurazioni già implementate in nginx.prod.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 100M;

# Compression
gzip on;
gzip_types text/plain application/json application/javascript text/css;

# Caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### Database Tuning

Le configurazioni database sono ottimizzate per:
- **Connection pooling**: Max 20 connessioni per service
- **Query optimization**: Indexing automatico
- **Memory settings**: Shared buffers ottimizzati

#### Container Resource Limits

```yaml
# Configurazioni in docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2.0'        # Per servizi backend
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### 🔄 Scaling VPS

#### Horizontal Scaling Workers

```bash
# Scale data analysis workers
./deploy.sh up --scale data_analysis_worker=4 -d

# Scale RAG workers
./deploy.sh up --scale rag_worker=3 -d

# Monitor performance
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

#### Load Balancing

NGINX è configurato per load balancing automatico tra servizi replicati.

---

## 📚 Appendici

### 📄 File Configurazione VPS

Tutti i file sono disponibili nella repository:
- `docker-compose.yml` - Configurazione base
- `docker-compose.dev.yml` - Override sviluppo VPS
- `.env.dev` - Environment sviluppo VPS
- `setup-vps.sh` - Script setup automatico VPS
- `nginx/dev.pl-ai.it.conf` - NGINX VPS host
- `nginx/nginx.dev.vps.conf` - NGINX container

### 🔧 Script Automatizzazione

- `setup-vps.sh` - Setup automatico VPS
- `deploy.sh` - Deployment VPS
- `docs/DEPLOY_VPS_INSTRUCTIONS.md` - Istruzioni dettagliate

### 🌐 URLs e Endpoint VPS Multi-Ambiente

**Sviluppo VPS:**
- Frontend: https://dev.pl-ai.it
- API Base: https://dev.pl-ai.it/api
- Health Check: https://dev.pl-ai.it/health

**Produzione:**
- Frontend: https://pl-ai.it
- Frontend Alt: https://www.pl-ai.it  
- API Base: https://pl-ai.it/api
- Health Check: https://pl-ai.it/health

**Coesistenza VPS:**
- blackix.it - Sito esistente via socket Unix
- twinelib.it - Sito esistente via localhost:8080
- dev.pl-ai.it - AI-PlayGround sviluppo via localhost:8081
- pl-ai.it - AI-PlayGround produzione via porte 80/443 dirette

### 🔑 Microservizi Configurati

Il sistema include 11 microservizi backend completamente configurati:
1. **Auth Service** - Autenticazione e autorizzazione
2. **User Service** - Gestione profili utente
3. **Chatbot Service** - Servizio chat AI
4. **RAG Service** - Retrieval Augmented Generation
5. **LLM Service** - Large Language Models
6. **Image Generator Service** - Generazione immagini AI
7. **Image Classifier Service** - Classificazione immagini
8. **Data Analysis Service** - Analisi dati e dataset
9. **Resource Manager Service** - Gestione file e risorse
10. **Learning Service** - Sistema di apprendimento
11. **Cost Monitoring Service** - Monitoraggio costi API

---

## 🎉 Conclusione

Hai ora implementato un sistema di deployment professionale multi-ambiente per AI-PlayGround su VPS IONOS con:

✅ **Multi-Ambiente** - Sviluppo (dev.pl-ai.it) e Produzione (pl-ai.it)  
✅ **Automazione VPS** - Setup e deployment con script dedicato  
✅ **Sicurezza enterprise** - SSL, NGINX reverse proxy, secrets management separati  
✅ **Monitoring robusto** - Logs, health checks, metriche Docker per entrambi gli ambienti  
✅ **Coesistenza** - Funziona con blackix.it e twinelib.it esistenti  
✅ **Performance ottimizzate** - NGINX tuning, container optimization, resource limits  
✅ **Scalabilità** - Horizontal scaling ready con worker replicati  
✅ **Configurazione consolidata** - Sistema completo e professionale per entrambi gli ambienti

**Prossimi passi consigliati:**
1. Setup monitoring avanzato (Prometheus/Grafana)
2. Implementazione CI/CD pipeline per entrambi gli ambienti
3. Test automatizzati deployment
4. Backup automatico database per produzione
5. Load balancer per alta disponibilità

---

## 📞 Supporto

Per problemi o domande:
1. Consulta la sezione [Troubleshooting](#-troubleshooting)
2. Verifica logs ambiente specifico: `./deploy.sh [dev|prod] logs`
3. Controlla status: `./deploy.sh [dev|prod] ps`
4. Controlla configurazione NGINX: `sudo nginx -t`

**Sistema AI-PlayGround multi-ambiente su VPS IONOS pronto! 🚀**

## 📊 **Configurazione Port Binding VPS**

### 🔧 **AMBIENTE VPS MULTI-AMBIENTE**

| Servizio | Host Port | Container Port | Scopo |
|----------|-----------|----------------|-------|
| **Reverse Proxy VPS** |  |  |  |
| `NGINX VPS` | `80, 443` | - | 🌐 Host principale (tutti i domini) |
| **Sviluppo (dev.pl-ai.it)** |  |  |  |
| `NGINX Container DEV` | `8081` | `80` | 🌐 Container AI-PlayGround sviluppo |
| **Produzione (pl-ai.it)** |  |  |  |
| `NGINX Container PROD` | `80, 443` | `80, 443` | 🌐 Container AI-PlayGround produzione (diretto) |
| **Sicurezza (entrambi)** |  |  |  |
| `Database` | `❌ NESSUNA` | `5432 (solo interno)` | 🔒 Sicurezza - accesso solo via API |
| `API Services` | `❌ NESSUNA` | `8000 (solo interno)` | 🔒 Sicurezza - accesso solo via NGINX |
| `Frontend` | `❌ NESSUNA` | `3000 (solo interno)` | 🔒 Sicurezza - servito solo via NGINX |
| `RabbitMQ` | `❌ NESSUNA` | `5672 (solo interno)` | 🔒 Sicurezza - management UI disabilitato |

## 🎯 **Esempi Pratici di Accesso VPS**

### 🌐 **Accesso Pubblico Multi-Ambiente:**

```bash
# Accesso SVILUPPO via NGINX VPS
curl https://dev.pl-ai.it/
curl https://dev.pl-ai.it/api/auth/
curl https://dev.pl-ai.it/api/users/

# Accesso PRODUZIONE via NGINX VPS
curl https://pl-ai.it/
curl https://pl-ai.it/api/auth/
curl https://pl-ai.it/api/users/
curl https://www.pl-ai.it/

# Altri siti coesistenti
curl https://blackix.it/
curl https://twinelib.it/
```

### 🔧 **Accesso Interno per Debug Multi-Ambiente:**

```bash
# SSH sulla VPS per debug
ssh root@[VPS_IP]

# Test container interno SVILUPPO
docker exec -it [dev_container_name] /bin/bash

# Test container interno PRODUZIONE
docker exec -it [prod_container_name] /bin/bash

# Logs di debug SVILUPPO
./deploy.sh dev logs -f auth_service
./deploy.sh dev logs -f frontend

# Logs di debug PRODUZIONE
./deploy.sh prod logs -f auth_service
./deploy.sh prod logs -f frontend

# Monitoring per ambiente specifico
./deploy.sh dev ps
./deploy.sh prod ps
```

## 🔐 **Logica di Sicurezza VPS**

### **🔒 Sicurezza Massima**
- **Scopo**: Ambiente sicuro per sviluppo
- **Porte esposte**: Solo NGINX VPS (80/443)
- **Vantaggi**:
  - Superficie d'attacco minimale
  - SSL terminato su NGINX VPS
  - Coesistenza con altri siti
  - Zero esposizione database/API diretta

### **🏠 Coesistenza Multi-Sito**
- **blackix.it**: Sito esistente via socket Unix
- **twinelib.it**: Sito esistente via localhost:8080
- **dev.pl-ai.it**: AI-PlayGround sviluppo via localhost:8081
- **pl-ai.it**: AI-PlayGround produzione via porte 80/443 dirette

## 🌐 **Comunicazione Interna**

**Tutti i servizi comunicano internamente usando la rete Docker:**

```yaml
# Esempio: chatbot_service → auth_service
internal_url: "http://auth_service:8000/api/"

# Esempio: API → Database  
database_url: "postgres://user:pass@auth_db:5432/db"

# Esempio: Workers → RabbitMQ
broker_url: "amqp://user:pass@rabbitmq:5672//"
```

**🎯 La rete interna Docker (`pl-ai-network`) permette sempre la comunicazione tra container usando i nomi dei servizi come hostname.**

Questa architettura garantisce **sicurezza enterprise** e **coesistenza multi-sito** su VPS IONOS! 🚀