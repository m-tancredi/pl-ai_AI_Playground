# 🚀 Deployment Guide - AI PlayGround Golinelli su VPS Ionos

## 📋 Panoramica

Questa guida fornisce le istruzioni complete per effettuare il deployment della versione dev del progetto AI PlayGround Golinelli su una VPS Ionos all'indirizzo `dev.pl-ai.it`, mantenendo la coesistenza con i siti esistenti `twinelib.it` e `blackix.it`.

## 🏗️ Architettura del Sistema

### Microservizi
- **Auth Service**: Gestione autenticazione e autorizzazione
- **User Service**: Gestione profili utenti
- **Chatbot Service**: Servizio chatbot AI
- **Image Generator Service**: Generazione immagini AI
- **Resource Manager Service**: Gestione risorse e file
- **Image Classifier Service**: Classificazione immagini
- **Data Analysis Service**: Analisi dati e ML
- **RAG Service**: Retrieval-Augmented Generation
- **Learning Service**: Sistema di apprendimento

### Infrastructure
- **Frontend**: React application
- **Backend**: Django microservizi
- **Database**: PostgreSQL (un DB per servizio)
- **Message Broker**: RabbitMQ
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt
- **Containerizzazione**: Docker & Docker Compose

## 📁 File di Deployment

### File Principali
- `docker-compose.dev.yml` - Configurazione Docker Compose per sviluppo
- `.env.dev` - Variabili d'ambiente di sviluppo
- `nginx-deployment-config.conf` - Configurazione Nginx
- `deploy.sh` - Script di deployment automatizzato
- `deployment-checklist.md` - Checklist di verifica

### Struttura Directory
```
/opt/golinelli-ai/
├── docker-compose.yml
├── .env
├── .secrets/
│   ├── openai_api_key.txt
│   ├── anthropic_api_key.txt
│   ├── gemini_api_key.txt
│   └── stability_api_key.txt
├── volumes/
│   ├── postgres_data/
│   ├── user_media/
│   ├── analysis_results_data/
│   └── ...
├── backend/
├── frontend/
├── nginx/
├── manage.sh
└── backup.sh
```

## 🔧 Prerequisiti

### Sistema
- VPS Ionos con Ubuntu 20.04+
- Utente `aiplayground` con privilegi sudo
- Dominio `dev.pl-ai.it` configurato

### Software
- Docker & Docker Compose
- Nginx
- Certbot (Let's Encrypt)
- Git
- OpenSSL

### Porte Utilizzate
- **80**: HTTP (redirect a HTTPS)
- **443**: HTTPS (nginx principale)
- **8081**: Docker Compose nginx (interno)
- **8080**: twinelib.it (esistente)
- **88**: blackix.it redirect (esistente)

## 🚀 Procedura di Deployment

### 1. Preparazione
```bash
# Connessione alla VPS
ssh aiplayground@YOUR_VPS_IP

# Creazione directory di lavoro
mkdir -p /tmp/golinelli-ai-deployment
cd /tmp/golinelli-ai-deployment

# Clone dei file di deployment
git clone https://github.com/YOUR_USERNAME/pl-ai_AI-PlayGround.git
cd pl-ai_AI-PlayGround

# Copia file di deployment
cp docker-compose.dev.yml .
cp .env.dev .
cp nginx-deployment-config.conf .
cp deploy.sh .
cp deployment-checklist.md .
```

### 2. Personalizzazione Configurazione

#### Modifica .env.dev
```bash
nano .env.dev
```

**Variabili da personalizzare:**
- `SUPABASE_URL` - URL del progetto Supabase
- `SUPABASE_ANON_KEY` - Chiave anonima Supabase
- `SUPABASE_SERVICE_KEY` - Chiave service Supabase
- `SOCIAL_AUTH_GOOGLE_CLIENT_ID` - Client ID Google OAuth
- `SOCIAL_AUTH_GOOGLE_CLIENT_SECRET` - Client Secret Google OAuth
- `EMAIL` in `deploy.sh` - Email per Let's Encrypt

#### Modifica deploy.sh
```bash
nano deploy.sh
```

**Aggiorna:**
- `EMAIL="your-email@example.com"` - Email reale
- Repository URL se necessario

### 3. Esecuzione Deployment
```bash
# Rendi eseguibile lo script
chmod +x deploy.sh

# Esegui deployment
./deploy.sh
```

**Lo script automaticamente:**
1. Verifica prerequisiti
2. Crea directory di progetto
3. Clona repository
4. Richiede API keys (OpenAI, Anthropic, Gemini, Stability)
5. Genera password sicure
6. Configura nginx
7. Avvia servizi Docker
8. Inizializza database
9. Configura SSL
10. Verifica deployment

### 4. Verifica Post-Deployment

Utilizza la checklist completa in `deployment-checklist.md`:

```bash
# Verifica container
docker-compose ps

# Test connettività
curl -I https://dev.pl-ai.it

# Verifica logs
docker-compose logs --tail=50

# Verifica coesistenza siti
curl -I https://twinelib.it
curl -I https://blackix.it
```

## 🛠️ Gestione Post-Deployment

### Script di Gestione
```bash
# Avvia servizi
./manage.sh start

# Ferma servizi
./manage.sh stop

# Riavvia servizi
./manage.sh restart

# Visualizza logs
./manage.sh logs [service_name]

# Status servizi
./manage.sh status

# Backup
./manage.sh backup
```

### Monitoraggio
```bash
# Status container
docker-compose ps

# Utilizzo risorse
docker stats

# Logs in tempo reale
docker-compose logs -f [service_name]

# Logs nginx
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Aggiornamenti

### Aggiornamento Codice
```bash
cd /opt/pl-ai
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### Aggiornamento Configurazione
```bash
# Modifica configurazione
nano .env

# Riavvia servizi interessati
docker-compose restart [service_name]
```

## 🚨 Backup e Recovery

### Backup Automatico
```bash
# Backup database
./backup.sh

# Backup manuale
docker-compose exec auth_db pg_dump -U plai_auth_user plai_auth_prod > backup_auth.sql
```

### Recovery
```bash
# Ripristino database
docker-compose exec auth_db psql -U plai_auth_user plai_auth_prod < backup_auth.sql

# Ripristino completo
docker-compose down
# Ripristina volumi
docker-compose up -d
```

## 🔐 Sicurezza

### SSL/TLS
- Certificato Let's Encrypt automatico
- Redirect HTTP → HTTPS
- Configurazione SSL sicura

### Secrets Management
- API keys in Docker Secrets
- Password generate automaticamente
- Permessi file appropriati

### Network Security
- Porte esposte minimali
- Firewall configurato
- Accesso limitato a utenti autorizzati

## 📊 Monitoraggio

### Metriche Chiave
- Uptime servizi
- Utilizzo CPU/RAM
- Spazio disco
- Tempo di risposta API

### Logs
- Logs applicazione: `docker-compose logs`
- Logs nginx: `/var/log/nginx/`
- Logs sistema: `journalctl`

### Allerte
- Downtime servizi
- Errori critici
- Utilizzo risorse elevato

## 🆘 Troubleshooting

### Problemi Comuni

**Container non si avvia:**
```bash
docker-compose logs [service_name]
docker-compose down && docker-compose up -d
```

**Errore 502 Bad Gateway:**
```bash
sudo nginx -t
sudo systemctl reload nginx
docker-compose ps
```

**Database non raggiungibile:**
```bash
docker-compose exec [service_name] python manage.py dbshell
docker-compose restart [db_service]
```

**SSL non funziona:**
```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

### Log Analysis
```bash
# Errori nginx
sudo grep "error" /var/log/nginx/error.log

# Errori Docker
docker-compose logs --tail=100 | grep -i error

# Controllo spazio disco
df -h
```

## 📞 Supporto

### Contatti
- **Tecnico**: aiplayground@dev.pl-ai.it
- **Emergenze**: +XX XXX XXX XXXX

### Documentazione
- API Documentation: `https://dev.pl-ai.it/api/docs/`
- Admin Panel: `https://dev.pl-ai.it/admin/`
- Monitoring: `https://dev.pl-ai.it/monitoring/`

## 📈 Performance

### Requisiti Minimi
- **CPU**: 4 cores
- **RAM**: 8GB
- **Disco**: 100GB SSD
- **Banda**: 1Gbps

### Ottimizzazioni
- Nginx gzip compression
- Docker image ottimizzate
- Database connection pooling
- CDN per file statici

## 🔮 Sviluppi Futuri

### Roadmap
- [ ] Monitoring avanzato con Prometheus
- [ ] CI/CD pipeline
- [ ] Auto-scaling
- [ ] Multi-region deployment
- [ ] Advanced security scanning

---

## 📋 Checklist Rapida

### Pre-Deployment
- [ ] VPS configurata e accessibile
- [ ] Dominio configurato
- [ ] API keys disponibili
- [ ] File di configurazione personalizzati

### Deployment
- [ ] Script deploy.sh eseguito con successo
- [ ] Tutti i container in esecuzione
- [ ] SSL configurato
- [ ] Database migrati

### Post-Deployment
- [ ] Sito raggiungibile
- [ ] API funzionanti
- [ ] Coesistenza siti verificata
- [ ] Backup configurati
- [ ] Monitoraggio attivo

---

**Versione**: 1.0.0  
**Data**: $(date)  
**Responsabile**: AI PlayGround Team 