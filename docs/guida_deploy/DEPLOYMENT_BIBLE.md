# 🚀 AI-PlayGround - Biblia del Deployment Multi-Ambiente

> **La guida completa dalla A alla Z per il deployment multi-ambiente del tuo AI-PlayGround**

## 📋 Indice Navigabile

### 🚀 [Quick Start](#-quick-start---avvio-rapido)
### 📖 [Guida Completa](#-guida-completa)
### 🔧 [Riferimento Quotidiano](#-riferimento-quotidiano) 
### 🚨 [Troubleshooting](#-troubleshooting)

> **⚠️ IMPORTANTE**: Prima di iniziare, assicurati di aver clonato il repository sulla VPS IONOS (vedi [Prerequisito Clone Repository](#-prerequisito-clone-del-repository))

---

## ⚡ Quick Start - Avvio Rapido

> **Tempo richiesto: 15 minuti** | Per chi vuole partire subito

### 🔧 **PREREQUISITO**: Clone del Repository

**Prima di tutto, devi clonare il progetto sulla VPS IONOS:**

```bash
# 1. Connettiti alla VPS IONOS
ssh root@[IP_DELLA_TUA_VPS]

# 2. Crea utente dedicato (consigliato)
sudo adduser aiplayground
sudo usermod -aG docker aiplayground
sudo usermod -aG sudo aiplayground

# 3. Cambia utente e clona repository
su - aiplayground
cd ~
git clone https://github.com/[TUO-USERNAME]/pl-ai_AI-PlayGround.git
cd pl-ai_AI-PlayGround

# 4. Verifica clone completo
ls -la
# Dovresti vedere: docker-compose.yml, frontend/, backend/, nginx/, etc.
```

### 1️⃣ Setup Automatico Completo
```bash
# Rendi eseguibili gli script
chmod +x setup-env.sh ssl-setup.sh deploy.sh manage.sh test-nginx-simple.sh

# 🎯 Setup automatico di tutto l'ambiente (2 min)
./setup-env.sh
```

### 2️⃣ Configurazione API Keys
```bash
# Inserisci le tue API keys (1 min)
echo "your-openai-api-key-here" > .secrets/dev/openai_api_key.txt
echo "your-anthropic-api-key-here" > .secrets/dev/anthropic_api_key.txt
echo "your-gemini-api-key-here" > .secrets/dev/gemini_api_key.txt
echo "your-stability-api-key-here" > .secrets/dev/stability_api_key.txt

# Ripeti per produzione con chiavi diverse (RACCOMANDATO)
echo "your-prod-openai-api-key-here" > .secrets/prod/openai_api_key.txt
echo "your-prod-anthropic-api-key-here" > .secrets/prod/anthropic_api_key.txt
echo "your-prod-gemini-api-key-here" > .secrets/prod/gemini_api_key.txt
echo "your-prod-stability-api-key-here" > .secrets/prod/stability_api_key.txt
```

### 3️⃣ Configurazione DNS
Nel pannello IONOS, aggiungi questi record:
```
A    @      [IP_SERVER]    3600
A    www    [IP_SERVER]    3600  
A    dev    [IP_SERVER]    3600
```

### 4️⃣ Test Configurazioni
```bash
# Test validazione NGINX (30 sec)
./test-nginx-simple.sh
# Deve passare ✅ prima di procedere!
```

### 5️⃣ Setup SSL
```bash
# Test sviluppo con staging (2 min)
./ssl-setup.sh dev --staging

# Produzione (2 min)
./ssl-setup.sh prod
```

### 6️⃣ Deploy
```bash
# Deploy sviluppo (5 min)
./deploy.sh dev up --build

# Deploy produzione (5 min)
./deploy.sh prod up --build
```

### 7️⃣ Verifica
```bash
# Test connessioni
curl -k https://dev.pl-ai.it/health
curl -k https://pl-ai.it/health

# 🎉 FATTO! I tuoi ambienti sono online!
```

---

## 📖 Guida Completa

### 🎯 Panoramica Sistema

Questa guida implementa un sistema di deployment completo per AI-PlayGround con:

- **🏭 Produzione**: `pl-ai.it` - Ambiente live per utenti finali
- **🔧 Sviluppo**: `dev.pl-ai.it` - Ambiente test per sviluppo

#### Architettura (25+ Servizi Containerizzati)

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
│  │ (Reverse    │  │  25+ CONTAINERS │   │
│  │  Proxy)     │  │   - 11 Database │   │
│  │  SSL/TLS    │  │   - 11 Backend  │   │
│  │  Load Bal.) │  │   - 4 Workers   │   │
│  │             │  │   - 3 Infra     │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
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

### 🗂️ Struttura Files

```
pl-ai_AI-PlayGround/
├── 📄 docker-compose.yml          # Configurazione base
├── 📄 docker-compose.dev.yml      # Override sviluppo 
├── 📄 docker-compose.prod.yml     # Override produzione 
├── 📄 .env.dev                    # Variabili ambiente sviluppo (515+ variabili)
├── 📄 .env.prod                   # Variabili ambiente produzione (515+ variabili)
├── 🛠️ setup-env.sh               # Setup automatico environment
├── 🚀 deploy.sh                   # Script deployment automatizzato
├── 🔐 ssl-setup.sh               # Setup automatico SSL
├── 🎛️ manage.sh                   # Interfaccia gestione generale
├── 🧪 test-nginx-simple.sh       # Test validazione NGINX
├── 📖 docs/guida_deploy/DEPLOYMENT_BIBLE.md  # Questa guida completa
├── .secrets/                      # Directory secrets
│   ├── dev/                      # Secrets sviluppo
│   └── prod/                     # Secrets produzione
└── nginx/
    ├── nginx.conf                 # Configurazione base NGINX
    ├── nginx.dev.conf            # Configurazione sviluppo
    └── nginx.prod.conf           # Configurazione produzione
```

### 🔧 Prerequisiti Dettagliati

#### Software Server IONOS

1. **Docker & Docker Compose V2**
   ```bash
   # Installa Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   newgrp docker
   
   # Verifica installazione (Docker Compose V2 integrato)
   docker --version
   docker compose version  # Comando V2 integrato
   ```

2. **Certbot per SSL**
   ```bash
   sudo apt-get update
   sudo apt-get install -y certbot python3-certbot-nginx
   ```

3. **Utilità Sistema**
   ```bash
   sudo apt-get install -y git openssl curl wget
   ```

#### Risorse Server Consigliate

| Risorsa | Minimo | Consigliato | Produzione |
|---------|--------|-------------|------------|
| CPU     | 4 core | 8 core      | 16 core    |
| RAM     | 8GB    | 16GB        | 32GB       |
| Storage | 100GB  | 200GB SSD   | 500GB SSD  |
| Banda   | 1GB    | Illimitata  | Illimitata |

### 🛠️ Setup Dettagliato

#### 0. Clone Repository sulla VPS (PREREQUISITO)

Prima di tutto, devi avere il progetto sulla VPS IONOS:

**🔧 Setup Iniziale VPS:**
```bash
# Connessione SSH alla VPS
ssh root@[IP_DELLA_TUA_VPS]

# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa prerequisiti base
sudo apt install -y git curl wget

# Crea utente dedicato (security best practice)
sudo adduser aiplayground
sudo usermod -aG sudo aiplayground

# Se Docker già installato, aggiungi al gruppo
sudo usermod -aG docker aiplayground
```

**📦 Clone del Repository:**
```bash
# Cambia all'utente dedicato
su - aiplayground
cd ~

# Opzione 1: Repository pubblico (HTTPS)
git clone https://github.com/[TUO-USERNAME]/pl-ai_AI-PlayGround.git

# Opzione 2: Repository privato con token
git clone https://[TOKEN]@github.com/[TUO-USERNAME]/pl-ai_AI-PlayGround.git

# Opzione 3: Repository privato con SSH key
# (genera prima SSH key sulla VPS e aggiungila a GitHub)
ssh-keygen -t ed25519 -C "vps@pl-ai.it"
cat ~/.ssh/id_ed25519.pub  # Copia e aggiungi a GitHub Deploy Keys
git clone git@github.com:[TUO-USERNAME]/pl-ai_AI-PlayGround.git
```

**✅ Verifica Clone:**
```bash
# Entra nella directory
cd pl-ai_AI-PlayGround

# Verifica struttura completa
ls -la
# Output atteso:
# drwxr-xr-x  3 user user 4096 backend/
# drwxr-xr-x  2 user user 4096 frontend/
# drwxr-xr-x  2 user user 4096 nginx/
# -rw-r--r--  1 user user 1234 docker-compose.yml
# -rw-r--r--  1 user user  567 docker-compose.dev.yml
# -rw-r--r--  1 user user  890 docker-compose.prod.yml

# Verifica Git status
git status
git log --oneline -5  # Ultimi 5 commit
```

#### 1. Setup Automatico Environment

Lo script `setup-env.sh` automatizza la configurazione iniziale:

```bash
# Rendilo eseguibile
chmod +x setup-env.sh

# Avvia il setup
./setup-env.sh
```

**Cosa fa automaticamente:**
- ✅ Crea file `.env.dev` e `.env.prod` con **515+ variabili consolidate**
- ✅ Genera password sicure per tutti gli 11 database PostgreSQL
- ✅ Crea struttura directory `.secrets/` con permessi sicuri (700/600)
- ✅ Genera template per API keys di sviluppo e produzione
- ✅ Configura domini personalizzabili
- ✅ Include configurazioni complete per tutti i microservizi

#### 2. Configurazione Personalizzata Domini

Durante il setup puoi personalizzare i domini:

```bash
# Lo script chiederà:
# "Vuoi personalizzare i domini? (y/N)"
# 
# Se sì, inserisci:
# - Dominio principale: tuodominio.it
# - Dominio sviluppo: dev.tuodominio.it  
# - Email per SSL: admin@tuodominio.it
```

#### 3. Configurazione DNS IONOS

Accedi al **Pannello IONOS** → **Domini** → **pl-ai.it** → **DNS**

Aggiungi questi record:

```
Tipo  Nome  Valore                TTL   Priorità
A     @     [IP_DEL_TUO_SERVER]   3600  -
A     www   [IP_DEL_TUO_SERVER]   3600  -
A     dev   [IP_DEL_TUO_SERVER]   3600  -
```

**Verifica propagazione DNS:**
```bash
# Test risoluzione domini
nslookup pl-ai.it
nslookup dev.pl-ai.it
nslookup www.pl-ai.it

# Con dig (più dettagliato)
dig +short pl-ai.it
dig +short dev.pl-ai.it

# Test da esterni
curl -I http://pl-ai.it
curl -I http://dev.pl-ai.it
```

#### 4. Setup SSL/TLS Automatico

Lo script `ssl-setup.sh` gestisce certificati Let's Encrypt:

```bash
# Rendilo eseguibile
chmod +x ssl-setup.sh

# Test con staging (consigliato prima volta)
./ssl-setup.sh dev --staging

# Setup produzione
./ssl-setup.sh prod
```

**Funzionalità SSL Script:**
- ✅ **Installazione automatica Certbot** (se mancante)
- ✅ **Backup certificati esistenti**
- ✅ **Generazione certificati Let's Encrypt**
- ✅ **Configurazione rinnovo automatico**
- ✅ **Test configurazione SSL**
- ✅ **Restart automatico servizi**

**Verifica SSL:**
```bash
# Test certificati
sudo certbot certificates

# Test rinnovo
sudo certbot renew --dry-run

# Verifica configurazione
openssl s_client -connect pl-ai.it:443 -servername pl-ai.it
openssl s_client -connect dev.pl-ai.it:443 -servername dev.pl-ai.it
```

#### 5. Configurazione API Keys Dettagliata

Dopo `setup-env.sh`, configura le API keys:

**Struttura generata:**
```
.secrets/
├── dev/           # API keys sviluppo
│   ├── openai_api_key.txt
│   ├── anthropic_api_key.txt  
│   ├── gemini_api_key.txt
│   └── stability_api_key.txt
└── prod/          # API keys produzione (separate!)
    ├── openai_api_key.txt
    ├── anthropic_api_key.txt
    ├── gemini_api_key.txt
    └── stability_api_key.txt
```

**Configurazione chiavi:**

```bash
# 🔧 SVILUPPO (usa chiavi di test/lower-tier)
echo "sk-proj-DEV_OPENAI_KEY_HERE" > .secrets/dev/openai_api_key.txt
echo "sk-ant-api03-DEV_ANTHROPIC_KEY" > .secrets/dev/anthropic_api_key.txt  
echo "AIzaSy_DEV_GEMINI_KEY_HERE" > .secrets/dev/gemini_api_key.txt
echo "sk-DEV_STABILITY_KEY_HERE" > .secrets/dev/stability_api_key.txt

# 🏭 PRODUZIONE (usa chiavi separate di produzione)
echo "sk-proj-PROD_OPENAI_KEY_HERE" > .secrets/prod/openai_api_key.txt
echo "sk-ant-api03-PROD_ANTHROPIC_KEY" > .secrets/prod/anthropic_api_key.txt
echo "AIzaSy_PROD_GEMINI_KEY_HERE" > .secrets/prod/gemini_api_key.txt  
echo "sk-PROD_STABILITY_KEY_HERE" > .secrets/prod/stability_api_key.txt
```

**Best Practices API Keys:**
- 🔒 **Mai condividere** chiavi tra ambienti
- 💰 **Rate limiting** diverso per dev/prod
- 📊 **Monitoring** separato per usage
- 🔄 **Rotazione** periodica delle chiavi
- 🚫 **Revoca immediata** chiavi compromesse

### 🚀 Deployment Dettagliato

#### Script di Deployment

Il deployment è gestito dallo script `deploy.sh`:

```bash
# Rendilo eseguibile
chmod +x deploy.sh

# Sintassi base
./deploy.sh [ambiente] [comando] [opzioni]

# Esempi
./deploy.sh dev up --build           # Deploy sviluppo con build
./deploy.sh prod up -d              # Deploy produzione in background
./deploy.sh dev down                # Stop sviluppo
./deploy.sh prod restart            # Restart produzione
./deploy.sh dev logs -f frontend    # Logs in tempo reale
```

#### Processo Deployment Completo

**Sviluppo:**
```bash
# 1. Deploy sviluppo
./deploy.sh dev up --build

# 2. Verifica servizi
./deploy.sh dev status

# 3. Test health check
curl -k https://dev.pl-ai.it/health

# 4. Logs in tempo reale
./deploy.sh dev logs -f
```

**Produzione:**
```bash
# 1. Deploy produzione  
./deploy.sh prod up --build -d

# 2. Verifica tutti i servizi
./deploy.sh prod status

# 3. Test completo
curl -k https://pl-ai.it/health
curl -k https://pl-ai.it/api/auth/health
curl -k https://pl-ai.it/api/users/health

# 4. Monitoring
docker stats --no-stream
```

#### Configurazioni Environment

**File `.env.dev` (Sviluppo) - 515+ variabili:**
```bash
# Debug attivo
DJANGO_DEBUG=true
LOG_LEVEL=DEBUG

# Domini sviluppo
DOMAIN=dev.pl-ai.it
CORS_ALLOWED_ORIGINS=https://dev.pl-ai.it,http://localhost:3000

# Database con configurazioni sviluppo
AUTH_DB_NAME=auth_db
USER_DB_NAME=user_db
CHATBOT_DB_NAME=chatbot_db
# ... altri 8 database
```

**File `.env.prod` (Produzione) - 515+ variabili:**
```bash
# Debug disattivato
DJANGO_DEBUG=false
LOG_LEVEL=WARNING

# Domini produzione
DOMAIN=pl-ai.it
CORS_ALLOWED_ORIGINS=https://pl-ai.it,https://www.pl-ai.it

# Database produzione con nomi separati
AUTH_DB_NAME=auth_db_prod
USER_DB_NAME=user_db_prod
CHATBOT_DB_NAME=chatbot_db_prod
# ... altri 8 database
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

### 🔄 Scaling Avanzato

#### Horizontal Scaling Workers

```bash
# Scale data analysis workers
./deploy.sh prod up --scale data_analysis_worker=4 -d

# Scale RAG workers
./deploy.sh prod up --scale rag_worker=3 -d

# Monitor performance
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

#### Load Balancing

NGINX è configurato per load balancing automatico tra servizi replicati.

---

## 📚 Appendici

### 📄 File Configurazione Completi

Tutti i file sono disponibili nella repository:
- `docker-compose.yml` - Configurazione base
- `docker-compose.dev.yml` - Override sviluppo  
- `docker-compose.prod.yml` - Override produzione
- `.env.dev` - Environment sviluppo (515+ variabili)
- `.env.prod` - Environment produzione (515+ variabili)
- `nginx/nginx.dev.conf` - NGINX sviluppo
- `nginx/nginx.prod.conf` - NGINX produzione

### 🔧 Script Automatizzazione

- `setup-env.sh` - Setup automatico environment (515+ variabili)
- `deploy.sh` - Deployment multi-ambiente (dev/staging/prod)
- `ssl-setup.sh` - Configurazione SSL automatica
- `manage.sh` - Interfaccia gestione interattiva
- `test-nginx-simple.sh` - Test validazione configurazioni NGINX

### 🌐 URLs e Endpoint

**Sviluppo:**
- Frontend: https://dev.pl-ai.it
- API Base: https://dev.pl-ai.it/api
- Health Check: https://dev.pl-ai.it/health

**Produzione:**
- Frontend: https://pl-ai.it
- API Base: https://pl-ai.it/api  
- Health Check: https://pl-ai.it/health

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

Hai ora implementato un sistema di deployment professionale multi-ambiente per AI-PlayGround con:

✅ **Automazione completa** - Setup e deployment con un comando  
✅ **Sicurezza enterprise** - SSL, rate limiting, secrets management  
✅ **Monitoring robusto** - Logs, health checks, metriche  
✅ **Backup affidabile** - Sistema backup/recovery automatico  
✅ **Performance ottimizzate** - NGINX tuning, container optimization  
✅ **Scalabilità** - Horizontal scaling ready  
✅ **515+ configurazioni consolidate** - Sistema completo e professionale

**Prossimi passi consigliati:**
1. Setup monitoring avanzato (Prometheus/Grafana)
2. Implementazione CI/CD pipeline
3. Test automatizzati deployment
4. Disaster recovery plan completo
5. Documentation API endpoint

---

## 📞 Supporto

Per problemi o domande:
1. Consulta la sezione [Troubleshooting](#-troubleshooting)
2. Verifica logs: `./deploy.sh [env] logs`
3. Usa interfaccia di gestione: `./manage.sh`
4. Backup preventivo: `./deploy.sh [env] backup`

**Sistema AI-PlayGround pronto per la produzione! 🚀**

## 📊 **Tabella Dettagliata Port Binding**

### 🔧 **AMBIENTE SVILUPPO (DEV)**

| Servizio | Host Port | Container Port | Scopo |
|----------|-----------|----------------|-------|
| **Database** |  |  |  |
| `auth_db` | `5433` | `5432` | 🔍 Debug diretto con client DB |
| `user_db` | `5434` | `5432` | 🔍 Debug diretto con client DB |
| `chatbot_db` | `5435` | `5432` | 🔍 Debug diretto con client DB |
| `image_generator_db` | `5436` | `5432` | 🔍 Debug diretto con client DB |
| `resource_db` | `5437` | `5432` | 🔍 Debug diretto con client DB |
| `classifier_db` | `5438` | `5432` | 🔍 Debug diretto con client DB |
| `analysis_db` | `5439` | `5432` | 🔍 Debug diretto con client DB |
| `rag_db` | `5440` | `5432` | 🔍 Debug diretto con client DB |
| `learning_db` | `5441` | `5432` | 🔍 Debug diretto con client DB |
| **API Services** |  |  |  |
| `auth_service` | `8001` | `8000` | 🔧 Debug e test API diretto |
| `user_service` | `8002` | `8000` | 🔧 Debug e test API diretto |
| `chatbot_service` | `8003` | `8000` | 🔧 Debug e test API diretto |
| `image_generator_service` | `8004` | `8000` | 🔧 Debug e test API diretto |
| `resource_manager_service` | `8005` | `8000` | 🔧 Debug e test API diretto |
| `image_classifier_service` | `8006` | `8000` | 🔧 Debug e test API diretto |
| `data_analysis_service` | `8007` | `8000` | 🔧 Debug e test API diretto |
| `rag_service` | `8008` | `8000` | 🔧 Debug e test API diretto |
| `learning_service` | `8009` | `8000` | 🔧 Debug e test API diretto |
| **Frontend & Infra** |  |  |  |
| `frontend` | `3000` | `3000` | ⚛️ Accesso React dev server |
| `rabbitmq` | `15672` | `15672` | 🐰 Management UI |
| `nginx` | `80, 443` | `80, 443` | 🌐 Reverse proxy |

### 🏭 **AMBIENTE PRODUZIONE (PROD)**

| Servizio | Host Port | Container Port | Scopo |
|----------|-----------|----------------|-------|
| **Database** | `❌ NESSUNA` | `5432 (solo interno)` | 🔒 Sicurezza - accesso solo via API |
| **API Services** | `❌ NESSUNA` | `8000 (solo interno)` | 🔒 Sicurezza - accesso solo via NGINX |
| **Frontend** | `❌ NESSUNA` | `3000 (solo interno)` | 🔒 Sicurezza - servito solo via NGINX |
| **RabbitMQ** | `❌ NESSUNA` | `5672 (solo interno)` | 🔒 Sicurezza - management UI disabilitato |
| **NGINX** | `80, 443` | `80, 443` | 🌐 **UNICO PUNTO DI ACCESSO** |

## 🎯 **Esempi Pratici di Accesso**

### 🔧 **In Sviluppo puoi fare:**

```bash
# Accesso diretto ai database
psql -h localhost -p 5433 -U admin -d auth_db

# Test API diretti 
curl http://localhost:8001/admin/
curl http://localhost:8002/api/users/
curl http://localhost:8003/api/chat/

# Frontend React dev
curl http://localhost:3000

# RabbitMQ Management
curl http://localhost:15672

# Via NGINX (come in produzione)
curl https://dev.pl-ai.it/api/auth/
```

### 🏭 **In Produzione puoi fare SOLO:**

```bash
# UNICO accesso via NGINX
curl https://pl-ai.it/
curl https://pl-ai.it/api/auth/
curl https://pl-ai.it/api/users/

# Tutto il resto è bloccato:
curl http://localhost:8001  # ❌ Connection refused
curl http://localhost:5433  # ❌ Connection refused  
curl http://localhost:3000  # ❌ Connection refused
```

## 🔐 **Logica di Sicurezza**

### **🔧 DEV - Massima Accessibilità**
- **Scopo**: Debugging, sviluppo, test
- **Porte esposte**: Tutte per accesso diretto
- **Vantaggi**: 
  - Debug facile di singoli servizi
  - Test API individuali 
  - Accesso diretto ai database
  - Monitoring RabbitMQ

### **🏭 PROD - Massima Sicurezza**
- **Scopo**: Produzione sicura
- **Porte esposte**: Solo NGINX (80/443)
- **Vantaggi**:
  - Superficie d'attacco minimale
  - SSL terminato su NGINX
  - Rate limiting centralizzato
  - Logging centralizzato
  - Zero esposizione database

## 🌐 **Comunicazione Interna**

**In entrambi gli ambienti**, tutti i servizi comunicano internamente usando la rete Docker:

```yaml
# Esempio: chatbot_service → auth_service
internal_url: "http://auth_service:8000/api/"

# Esempio: API → Database  
database_url: "postgres://user:pass@auth_db:5432/db"

# Esempio: Workers → RabbitMQ
broker_url: "amqp://user:pass@rabbitmq:5672//"
```

**🎯 La rete interna Docker (`pl-ai-network`) permette sempre la comunicazione tra container usando i nomi dei servizi come hostname.**

Questa architettura garantisce **flessibilità in sviluppo** e **sicurezza in produzione**! 🚀