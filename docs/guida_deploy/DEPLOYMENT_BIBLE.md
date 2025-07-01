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

> **Tempo richiesto: 20 minuti** | Per chi vuole partire subito

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
chmod +x setup-env.sh ssl-setup.sh deploy.sh manage.sh

# 🎯 Setup automatico di tutto l'ambiente (2 min)
./setup-env.sh
```

### 2️⃣ Configurazione API Keys
```bash
# Inserisci le tue API keys (1 min)
echo "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" > .secrets/dev/openai_api_key.txt
echo "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" > .secrets/dev/anthropic_api_key.txt
echo "AIzaSyDtoR6fNWH29y8AQ50hmHfkg6e_iV5dq30" > .secrets/dev/gemini_api_key.txt
echo "sk-ldUaHff4pjVxRDI8WWcRvRKmJVM7RsyVF0GxEMkPShWPaZa3" > .secrets/dev/stability_api_key.txt

# Ripeti per produzione con chiavi diverse
echo "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" > .secrets/prod/openai_api_key.txt
echo "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" > .secrets/prod/anthropic_api_key.txt
echo "AIzaSyDtoR6fNWH29y8AQ50hmHfkg6e_iV5dq30" > .secrets/prod/gemini_api_key.txt
echo "sk-ldUaHff4pjVxRDI8WWcRvRKmJVM7RsyVF0GxEMkPShWPaZa3" > .secrets/prod/stability_api_key.txt
# ... altre chiavi prod
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

#### Architettura (25 Servizi Containerizzati)

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
│  │  SSL/TLS    │  │   - 9 Backend   │   │
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
├── 📄 .env.dev                    # Variabili ambiente sviluppo
├── 📄 .env.prod                   # Variabili ambiente produzione
├── 🛠️ setup-env.sh               # Setup automatico environment
├── 🚀 deploy.sh                   # Script deployment automatizzato
├── 🔐 ssl-setup.sh               # Setup automatico SSL
├── 🎛️ manage.sh                   # Interfaccia gestione generale
├── 📖 DEPLOYMENT_BIBLE.md         # Questa guida completa
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
   
   # Verifica installazione
   docker --version
   docker compose version  # Deve essere V2!
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
| CPU     | 2 core | 4 core      | 8 core     |
| RAM     | 4GB    | 8GB         | 16GB       |
| Storage | 50GB   | 100GB SSD   | 200GB SSD  |
| Banda   | 100MB  | 1GB         | Illimitata |

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

**🔧 Setup Posizionamento:**
```bash
# Percorso finale consigliato:
# /home/aiplayground/pl-ai_AI-PlayGround/

# Crea link simbolico per accesso rapido (opzionale)
sudo ln -s /home/aiplayground/pl-ai_AI-PlayGround /opt/pl-ai
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
- ✅ Verifica presenza file `.env.dev` e `.env.prod`
- ✅ Genera password sicure per tutti i 9 database
- ✅ Crea struttura directory `.secrets/` con permessi sicuri (700/600)
- ✅ Genera template per API keys di sviluppo e produzione
- ✅ Configura domini personalizzabili
- ✅ Valida configurazione Docker Compose

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
./deploy.sh dev ps

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
./deploy.sh prod ps

# 3. Test completo
curl -k https://pl-ai.it/health
curl -k https://pl-ai.it/api/auth/health
curl -k https://pl-ai.it/api/user/health

# 4. Monitoring
./deploy.sh prod stats
```

#### Configurazioni Environment

**File `.env.dev` (Sviluppo):**
```bash
# Debug attivo
DEBUG=true
LOG_LEVEL=DEBUG

# Domini sviluppo
DOMAIN=dev.pl-ai.it
CORS_ALLOWED_ORIGINS=https://dev.pl-ai.it,http://localhost:3000

# Rate limiting rilassato
RATE_LIMIT_PER_MINUTE=1000
RATE_LIMIT_BURST=100

# Database con prefisso dev
AUTH_DB_NAME=dev_auth_db
USER_DB_NAME=dev_user_db
# ... altri DB
```

**File `.env.prod` (Produzione):**
```bash
# Debug disattivato
DEBUG=false
LOG_LEVEL=INFO

# Domini produzione
DOMAIN=pl-ai.it
CORS_ALLOWED_ORIGINS=https://pl-ai.it,https://www.pl-ai.it

# Rate limiting severo
RATE_LIMIT_PER_MINUTE=500
RATE_LIMIT_BURST=50

# Database produzione
AUTH_DB_NAME=prod_auth_db
USER_DB_NAME=prod_user_db
# ... altri DB
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

⚠️  Note per il deployment:
   • I certificati SSL verranno generati da Let's Encrypt
   • Gli upstream Docker funzioneranno nel compose
   • Configurazioni testate e pronte per la produzione
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

**Checklist Pre-Deployment:**
- [ ] Test script NGINX passa ✅
- [ ] Configurazioni SSL verificate
- [ ] Rate limiting configurato (prod)
- [ ] Security headers presenti
- [ ] Routing API completo
- [ ] Upstream services mappati

### 🔍 Monitoraggio e Logging

#### Health Checks Automatici

Ogni servizio ha health checks configurati:

```bash
# Verifica stato servizi
docker compose ps

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
# Backup ambiente sviluppo (tutti i 9 database)
./deploy.sh dev backup

# Backup ambiente produzione
./deploy.sh prod backup

# Backup con timestamp personalizzato
./deploy.sh prod backup --timestamp="2024-12-manual"
```

**Cosa viene salvato:**
- ✅ Tutti i 9 database PostgreSQL
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

#### Backup Automatico Schedulato

Configura backup automatico giornaliero:

```bash
# Aggiungi a crontab
crontab -e

# Backup giornaliero alle 2:00 AM
0 2 * * * /path/to/pl-ai_AI-PlayGround/deploy.sh prod backup >/dev/null 2>&1

# Backup sviluppo settimanale (domenica alle 1:00 AM)
0 1 * * 0 /path/to/pl-ai_AI-PlayGround/deploy.sh dev backup >/dev/null 2>&1
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

#### Rate Limiting

**Sviluppo (.env.dev):**
```bash
RATE_LIMIT_PER_MINUTE=1000  # Rilassato per testing
RATE_LIMIT_BURST=100
```

**Produzione (.env.prod):**
```bash
RATE_LIMIT_PER_MINUTE=500   # Più severo
RATE_LIMIT_BURST=50
```

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
./deploy.sh dev ps && ./deploy.sh prod ps

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
./deploy.sh prod up --scale data_analysis_worker=3
```

**Manutenzione:**
```bash
# Cleanup Docker
docker system prune -f

# Test configurazioni NGINX
./test-nginx-simple.sh

# Cleanup logs vecchi
./deploy.sh dev logs --tail=0

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
./deploy.sh prod exec auth_db psql -U user -c "SELECT count(*) FROM pg_stat_activity;"

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
# Rotazione logs
./deploy.sh prod logs --tail=0

# Update immagini Docker
./deploy.sh prod pull
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
./deploy.sh prod ps

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
./deploy.sh prod ps | grep _db

# Test connessione diretta
./deploy.sh prod exec auth_db psql -U auth_user -d auth_db

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

# Test direct access
curl -I http://localhost:3000  # Se frontend espone porta

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

#### Contatto Emergenza

Se hai problemi critici non risolvibili:

1. **Documenta il problema**: Logs, errori, timestamp
2. **Backup immediato**: `./deploy.sh prod backup --timestamp="emergency"`
3. **Notifica utenti**: Usa pagina manutenzione se necessario
4. **Recovery plan**: Identifica backup funzionante più recente

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
      cpus: '0.5'        # Per servizi standard
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
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
- `.env.dev` - Environment sviluppo
- `.env.prod` - Environment produzione
- `nginx/nginx.dev.conf` - NGINX sviluppo
- `nginx/nginx.prod.conf` - NGINX produzione

### 🔧 Script Automatizzazione

- `setup-env.sh` - Setup automatico environment
- `deploy.sh` - Deployment multi-ambiente
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

---

## 🎉 Conclusione

Hai ora implementato un sistema di deployment professionale multi-ambiente per AI-PlayGround con:

✅ **Automazione completa** - Setup e deployment con un comando  
✅ **Sicurezza enterprise** - SSL, rate limiting, secrets management  
✅ **Monitoring robusto** - Logs, health checks, metriche  
✅ **Backup affidabile** - Sistema backup/recovery automatico  
✅ **Performance ottimizzate** - NGINX tuning, container optimization  
✅ **Scalabilità** - Horizontal scaling ready  

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

**Buon deployment! 🚀**