# 🚀 Documentazione Deploy AI-PlayGround

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Requisiti di Sistema](#requisiti-di-sistema)
3. [Installazione](#installazione)
4. [Configurazione](#configurazione)
5. [Deploy](#deploy)
6. [Monitoraggio](#monitoraggio)
7. [Manutenzione](#manutenzione)
8. [Troubleshooting](#troubleshooting)
9. [Backup e Restore](#backup-e-restore)
10. [Aggiornamenti](#aggiornamenti)

## 🎯 Panoramica

Questo progetto AI-PlayGround è un'applicazione multi-microservizio che include:

- **Frontend**: React (porta 3000)
- **Backend**: 10 microservizi Django indipendenti
- **Database**: PostgreSQL per ogni servizio
- **Message Broker**: RabbitMQ per task asincroni
- **Reverse Proxy**: Nginx per gestione traffico
- **SSL**: Certificati Let's Encrypt automatici

### Architettura

```
Internet → Nginx (VPS) → Docker Nginx → Microservizi
                                      ↓
                               Database cluster
```

## 🖥️ Requisiti di Sistema

### VPS Requirements
- **OS**: Ubuntu 20.04+ o Debian 11+
- **RAM**: Minimo 8GB (16GB raccomandato)
- **Storage**: Minimo 50GB SSD
- **CPU**: 4 core (8 core raccomandato)
- **Network**: Banda minima 100Mbps

### Software Dependencies
- Docker 20.10+
- Docker Compose 2.0+
- Nginx 1.18+
- Certbot (per SSL)
- Git

## 🛠️ Installazione

### 1. Preparazione VPS

```bash
# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa dipendenze base
sudo apt install -y curl wget git vim ufw

# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Installa Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Installa Nginx
sudo apt install -y nginx

# Installa Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Configurazione Firewall

```bash
# Configura UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. Clona Progetto

```bash
# Posizionati nella directory appropriata
cd /opt

# Clona repository
sudo git clone https://github.com/your-repo/ai-playground.git
cd ai-playground

# Imposta permessi
sudo chown -R $USER:$USER .
```

## ⚙️ Configurazione

### 1. Variabili di Ambiente

Per ogni servizio, crea il file `.env` nella directory corrispondente:

```bash
# Esempio per auth_service
cp .env.production.template backend/auth_service/.env
```

**Personalizza le seguenti variabili:**

- `DJANGO_SECRET_KEY`: Chiave segreta unica per Django
- `*_DB_PASSWORD`: Password sicure per ogni database
- `ALLOWED_HOSTS`: Aggiungi `dev.pl-ai.it`
- `CORS_ALLOWED_ORIGINS`: URL del frontend

### 2. Segreti API

Crea directory e file per le API keys:

```bash
mkdir -p .secrets

# Inserisci le tue API keys
echo "your-openai-key" > .secrets/openai_api_key.txt
echo "your-anthropic-key" > .secrets/anthropic_api_key.txt
echo "your-gemini-key" > .secrets/gemini_api_key.txt
echo "your-stability-key" > .secrets/stability_api_key.txt

# Proteggi i file
chmod 600 .secrets/*
```

### 3. Configurazione DNS

Assicurati che il dominio `dev.pl-ai.it` punti all'IP della tua VPS:

```bash
# Verifica DNS
dig +short dev.pl-ai.it

# Dovrebbe restituire l'IP della tua VPS
```

## 🚀 Deploy

### Deploy Automatico

```bash
# Rendi eseguibile lo script
chmod +x deploy.sh

# Esegui deploy
sudo ./deploy.sh
```

### Deploy Manuale

Se preferisci il controllo manuale:

```bash
# 1. Configura Nginx
sudo cp nginx-vps.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx

# 2. Build e avvia servizi
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 3. Configura SSL
sudo ./ssl-setup.sh

# 4. Verifica deploy
docker-compose -f docker-compose.prod.yml ps
curl -I https://dev.pl-ai.it
```

## 📊 Monitoraggio

### Health Check Automatico

```bash
# Esegui health check
./health-check.sh

# Health check interattivo
./health-check.sh --interactive

# Solo report
./health-check.sh --report
```

### Monitoraggio Continuo

Il sistema include monitoraggio automatico via cron:

```bash
# Visualizza cron jobs
crontab -l

# Log di monitoraggio
tail -f /var/log/ai-playground-health.log
tail -f /var/log/ssl-monitor.log
```

### Metriche Principali

- **Servizi Docker**: Stato di tutti i container
- **Risorse Sistema**: CPU, memoria, disco
- **Endpoint**: Tempi di risposta e disponibilità
- **Database**: Connessioni e performance
- **SSL**: Scadenza certificati
- **Logs**: Errori e warning

## 🔧 Manutenzione

### Comandi Utili

```bash
# Stato servizi
docker-compose -f docker-compose.prod.yml ps

# Log servizi
docker-compose -f docker-compose.prod.yml logs -f [service_name]

# Restart servizio
docker-compose -f docker-compose.prod.yml restart [service_name]

# Accesso shell container
docker exec -it pl-ai-[service]-prod bash

# Aggiorna immagine
docker-compose -f docker-compose.prod.yml build [service_name]
docker-compose -f docker-compose.prod.yml up -d [service_name]
```

### Rotazione Log

```bash
# Configura logrotate
sudo tee /etc/logrotate.d/ai-playground << EOF
/var/log/ai-playground*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
```

### Pulizia Periodica

```bash
# Pulizia manuale
docker system prune -f
docker volume prune -f

# Pulizia automatica (già configurata nel deploy)
/usr/local/bin/ai-playground-monitor.sh
```

## 🔍 Troubleshooting

### Problemi Comuni

#### 1. Servizio non si avvia

```bash
# Verifica log
docker-compose -f docker-compose.prod.yml logs [service_name]

# Verifica risorse
docker stats

# Verifica configurazione
docker-compose -f docker-compose.prod.yml config
```

#### 2. Database non connesso

```bash
# Verifica stato DB
docker exec pl-ai-auth-db-prod pg_isready -U postgres

# Accesso DB
docker exec -it pl-ai-auth-db-prod psql -U postgres -d plai_db

# Reset DB (ATTENZIONE: cancella dati!)
docker-compose -f docker-compose.prod.yml down
docker volume rm pl-ai_postgres_data
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Errori SSL

```bash
# Verifica certificato
sudo certbot certificates

# Rinnova certificato
sudo certbot renew

# Test SSL
curl -I https://dev.pl-ai.it
openssl s_client -connect dev.pl-ai.it:443
```

#### 4. Problema performance

```bash
# Monitora risorse
htop
docker stats

# Ottimizza memoria
echo 3 > /proc/sys/vm/drop_caches
docker system prune -f
```

### Log Locations

- **Sistema**: `/var/log/ai-playground-*.log`
- **Nginx**: `/var/log/nginx/dev.pl-ai.it.*.log`
- **Docker**: `docker-compose logs`
- **SSL**: `/var/log/ssl-monitor.log`

## 💾 Backup e Restore

### Backup Automatico

Il sistema crea backup automatici durante il deploy. Location: `/tmp/ai-playground-backup-*`

### Backup Manuale

```bash
# Backup completo
mkdir -p /var/backups/ai-playground/$(date +%Y%m%d)
cd /var/backups/ai-playground/$(date +%Y%m%d)

# Backup volumi Docker
for volume in $(docker volume ls -q | grep ai-playground); do
    docker run --rm -v $volume:/data -v $(pwd):/backup alpine tar czf /backup/$volume.tar.gz -C /data .
done

# Backup configurazioni
cp -r /opt/ai-playground/backend/*/env .
cp /etc/nginx/sites-available/default nginx.conf
```

### Restore

```bash
# Ferma servizi
docker-compose -f docker-compose.prod.yml down

# Ripristina volumi
for backup in *.tar.gz; do
    volume_name=$(basename $backup .tar.gz)
    docker volume create $volume_name
    docker run --rm -v $volume_name:/data -v $(pwd):/backup alpine tar xzf /backup/$backup -C /data
done

# Avvia servizi
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Aggiornamenti

### Aggiornamento Applicazione

```bash
# Backup preventivo
sudo ./deploy.sh  # Crea backup automaticamente

# Pull nuove modifiche
git pull origin dev

# Rebuild e restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verifica
./health-check.sh
```

### Aggiornamento Sistema

```bash
# Aggiorna pacchetti
sudo apt update && sudo apt upgrade -y

# Aggiorna Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Restart servizi se necessario
sudo systemctl restart docker
docker-compose -f docker-compose.prod.yml restart
```

### Aggiornamento SSL

```bash
# Automatico via cron
sudo certbot renew

# Manuale
sudo certbot renew --force-renewal
```

## 📞 Supporto

### Contatti

- **Email**: admin@dev.pl-ai.it
- **Log Sistema**: `/var/log/ai-playground-health.log`
- **Monitoring**: Script automatico ogni 5 minuti

### Comandi Emergenza

```bash
# Stop completo
docker-compose -f docker-compose.prod.yml down

# Restart completo
docker-compose -f docker-compose.prod.yml restart

# Stato sistema
systemctl status nginx docker
df -h
free -h
```

---

**Ultima modifica**: $(date +%Y-%m-%d)
**Versione**: 1.0 