# 🚀 AI-PlayGround - Sistema di Deployment Multi-Ambiente

## 📋 Panoramica

Questo repository ora include un sistema completo di deployment multi-ambiente per la gestione di due ambienti distinti:

- **🏭 Produzione**: `pl-ai.it`
- **🔧 Sviluppo**: `dev.pl-ai.it`

## 🎯 Caratteristiche Principali

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
├── 📄 docker-compose.dev.yml      # Override sviluppo
├── 📄 docker-compose.prod.yml     # Override produzione
├── 📄 env.dev.template            # Template variabili sviluppo
├── 📄 env.prod.template           # Template variabili produzione
├── 🔧 deploy.sh                   # Script deployment automatizzato
├── 🔐 ssl-setup.sh               # Setup automatico SSL
├── 🎛️  manage.sh                  # Interfaccia gestione generale
├── 📖 DEPLOYMENT_GUIDE.md         # Guida completa implementazione
├── 📄 README_DEPLOYMENT.md        # Questo file
└── nginx/
    ├── nginx.conf                 # Configurazione base NGINX
    ├── nginx.dev.conf            # Configurazione sviluppo
    └── nginx.prod.conf           # Configurazione produzione
```

## 🚀 Quick Start

### 1. Setup Iniziale

```bash
# 1. Configura i file di environment
cp env.dev.template .env.dev
cp env.prod.template .env.prod

# 2. Modifica le configurazioni
nano .env.dev    # Personalizza per sviluppo
nano .env.prod   # Personalizza per produzione

# 3. Crea le directory secrets
mkdir -p .secrets/dev .secrets/prod

# 4. Aggiungi le tue API keys
echo "sk-your-openai-key-dev" > .secrets/dev/openai_api_key.txt
echo "sk-your-openai-key-prod" > .secrets/prod/openai_api_key.txt
# ... altre API keys
```

### 2. Setup SSL

```bash
# Setup SSL per sviluppo (test prima con staging)
./ssl-setup.sh dev --staging

# Setup SSL per produzione
./ssl-setup.sh prod
```

### 3. Deploy

```bash
# Deploy ambiente di sviluppo
./deploy.sh dev up --build

# Deploy ambiente di produzione  
./deploy.sh prod up --build
```

### 4. Gestione Quotidiana

```bash
# Interfaccia di gestione interattiva
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
docker-compose ps

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
# Backup ambiente specifico
./deploy.sh dev backup
./deploy.sh prod backup
```

### Backup Automatico

Configurato via cron per backup giornaliero:

```bash
# Visualizza cron jobs
crontab -l

# Backup salvati in
/backups/ai-playground/[environment]/
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
docker-compose restart nginx
```

#### 2. Servizi non si avviano

```bash
# Controlla logs
./deploy.sh [env] logs [service]

# Verifica configurazione
docker-compose config

# Ricostruisci immagini
./deploy.sh [env] up --build
```

#### 3. Problemi di rete

```bash
# Verifica network
docker network ls

# Test connettività interna
docker-compose exec frontend ping auth_service
```

## 📈 Performance

### Ottimizzazioni Implementate

- **NGINX**: Compressione gzip, caching, keep-alive
- **Database**: Connection pooling, query optimization
- **Docker**: Resource limits e health checks
- **SSL**: HTTP/2, session caching

### Scaling

```bash
# Scala worker services
docker-compose up -d --scale data_analysis_worker=3

# Monitora risorse
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

## 🛡️ Sicurezza

### Caratteristiche di Sicurezza

- 🔒 **SSL/TLS forzato** per tutti i domini
- 🛡️ **Security headers** (HSTS, CSP, etc.)
- 🔐 **Secrets management** separato per ambiente
- 🚫 **Rate limiting** su API endpoints
- 🔍 **Container security** con user non-root
- 📊 **Logging** dettagliato per audit

### Best Practices Implementate

- ✅ Password complesse separate per ambiente
- ✅ Porte database non esposte in produzione
- ✅ Volumi read-only dove possibile
- ✅ Health checks per tutti i servizi
- ✅ Resource limits per prevenire DoS

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
# Status completo sistema
./manage.sh

# Export informazioni debug
docker-compose logs > debug_$(date +%Y%m%d).log

# Verifica configurazione
docker-compose config

# Test connettività
curl -I https://pl-ai.it
curl -I https://dev.pl-ai.it
```

### File di Configurazione Chiave

- `.env.dev` / `.env.prod` - Variabili ambiente
- `nginx/*.conf` - Configurazioni reverse proxy
- `docker-compose.*.yml` - Orchestrazione servizi
- `.secrets/*/` - API keys e credenziali

## 🎉 Conclusioni

Il sistema di deployment è ora completo e pronto per l'uso in produzione. Include:

✅ **Automazione completa** del processo di deploy
✅ **Configurazioni ottimizzate** per performance e sicurezza  
✅ **Monitoraggio e logging** integrati
✅ **Backup automatizzati** per disaster recovery
✅ **Gestione semplificata** tramite interfaccia interattiva

Per la guida completa di implementazione, consulta: **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

---

**Made with ❤️ for AI-PlayGround** 