# 🚀 GUIDA COMPLETA AL DEPLOYMENT MULTI-AMBIENTE

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Prerequisiti](#prerequisiti)
3. [Configurazione Domini](#configurazione-domini)
4. [Setup SSL/TLS](#setup-ssltls)
5. [Configurazione Ambienti](#configurazione-ambienti)
6. [Gestione Secrets](#gestione-secrets)
7. [Deployment Automatizzato](#deployment-automatizzato)
8. [Monitoraggio e Logging](#monitoraggio-e-logging)
9. [Backup e Recovery](#backup-e-recovery)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Panoramica

Questa guida ti aiuterà a implementare un sistema di deployment completo per la tua applicazione AI-PlayGround su server IONOS con due ambienti distinti:

- **Produzione**: `pl-ai.it`
- **Sviluppo**: `dev.pl-ai.it`

### Architettura del Sistema

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
│  │ (Reverse    │  │   CONTAINERS    │   │
│  │  Proxy)     │  │                 │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 🔧 Prerequisiti

### Software Richiesto

1. **Docker & Docker Compose**
   ```bash
   # Installa Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   
   # Installa Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
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

### Risorse Server IONOS

- **CPU**: Minimo 4 core (8 core consigliati)
- **RAM**: Minimo 8GB (16GB consigliati)
- **Storage**: Minimo 100GB SSD
- **Banda**: Illimitata
- **OS**: Ubuntu 22.04 LTS

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

### 2. Configurazione Manuale (Alternativa)

```bash
# Per l'ambiente di sviluppo
sudo certbot certonly --standalone \
  --email admin@pl-ai.it \
  --agree-tos \
  --no-eff-email \
  -d dev.pl-ai.it

# Per l'ambiente di produzione
sudo certbot certonly --standalone \
  --email admin@pl-ai.it \
  --agree-tos \
  --no-eff-email \
  -d pl-ai.it \
  -d www.pl-ai.it
```

### 3. Rinnovo Automatico

Il rinnovo automatico è configurato via cron:

```bash
# Verifica il cron job
sudo crontab -l | grep certbot

# Test rinnovo
sudo certbot renew --dry-run
```

---

## ⚙️ Configurazione Ambienti

### 1. File di Configurazione

Crea i file di environment dalle template:

```bash
# Copia i template
cp env.dev.template .env.dev
cp env.prod.template .env.prod

# Modifica le configurazioni
nano .env.dev
nano .env.prod
```

### 2. Configurazione Sviluppo (.env.dev)

Personalizza le seguenti variabili:

```bash
# Domini
DOMAIN=dev.pl-ai.it
FRONTEND_API_URL=https://dev.pl-ai.it

# Database (usa password sicure)
AUTH_DB_PASSWORD=tua_password_sicura_auth_dev
USER_DB_PASSWORD=tua_password_sicura_user_dev
# ... altre password

# RabbitMQ
RABBITMQ_PASSWORD=tua_password_sicura_rabbitmq_dev
```

### 3. Configurazione Produzione (.env.prod)

```bash
# Domini
DOMAIN=pl-ai.it
FRONTEND_API_URL=https://pl-ai.it

# Database (usa password MOLTO sicure)
AUTH_DB_PASSWORD=password_produzione_molto_sicura_auth
USER_DB_PASSWORD=password_produzione_molto_sicura_user
# ... altre password

# Django Secret Key (genera una nuova)
DJANGO_SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
```

---

## 🔑 Gestione Secrets

### 1. Creazione Directory Secrets

```bash
# Crea le directory per i secrets
mkdir -p .secrets/dev
mkdir -p .secrets/prod

# Imposta permessi sicuri
chmod 700 .secrets
```

### 2. Configurazione API Keys

```bash
# Sviluppo
echo "sk-tua-openai-key-dev" > .secrets/dev/openai_api_key.txt
echo "tua-anthropic-key-dev" > .secrets/dev/anthropic_api_key.txt
echo "tua-gemini-key-dev" > .secrets/dev/gemini_api_key.txt
echo "tua-stability-key-dev" > .secrets/dev/stability_api_key.txt

# Produzione (usa chiavi separate!)
echo "sk-tua-openai-key-prod" > .secrets/prod/openai_api_key.txt
echo "tua-anthropic-key-prod" > .secrets/prod/anthropic_api_key.txt
echo "tua-gemini-key-prod" > .secrets/prod/gemini_api_key.txt
echo "tua-stability-key-prod" > .secrets/prod/stability_api_key.txt

# Imposta permessi
chmod 600 .secrets/*/*.txt
```

### 3. Aggiorna Docker Compose per Secrets

Aggiungi al docker-compose.yml:

```yaml
secrets:
  openai_api_key_secret:
    file: ./.secrets/${ENVIRONMENT:-dev}/openai_api_key.txt
  anthropic_api_key_secret:
    file: ./.secrets/${ENVIRONMENT:-dev}/anthropic_api_key.txt
  # ... altri secrets
```

---

## 🚀 Deployment Automatizzato

### 1. Script di Deploy

Rendi eseguibile lo script di deployment:

```bash
chmod +x deploy.sh
```

### 2. Primo Deploy Sviluppo

```bash
# Build e avvio ambiente di sviluppo
./deploy.sh dev up --build

# Verifica stato servizi
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
```

### 4. Script di Deployment CI/CD

Crea un workflow per deployment automatico:

```bash
#!/bin/bash
# deploy-pipeline.sh

set -e

ENVIRONMENT=$1
BRANCH=$2

echo "🚀 Starting deployment pipeline for $ENVIRONMENT..."

# 1. Backup database
./deploy.sh $ENVIRONMENT backup

# 2. Pull latest code
git pull origin $BRANCH

# 3. Build new images
./deploy.sh $ENVIRONMENT down
./deploy.sh $ENVIRONMENT up --build

# 4. Run migrations
docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec auth_service python manage.py migrate

# 5. Collect static files (se necessario)
docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec frontend npm run build

# 6. Health check
sleep 30
./deploy.sh $ENVIRONMENT status

# 7. Warm up application
curl -I https://$(echo $ENVIRONMENT | grep -q "prod" && echo "pl-ai.it" || echo "dev.pl-ai.it")

echo "✅ Deployment completed successfully!"
```

---

## 📊 Monitoraggio e Logging

### 1. Setup Logging

Configura la rotazione dei log:

```bash
# Crea configurazione logrotate
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
        docker kill --signal="USR1" \$(docker ps -q --filter name=pl-ai)
    endscript
}
EOF
```

### 2. Monitoring Stack (Opzionale)

Aggiungi servizi di monitoraggio:

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - pl-ai-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - pl-ai-network

volumes:
  grafana_data:
```

### 3. Health Checks

Configura health checks per tutti i servizi:

```bash
# Crea script di health check
#!/bin/bash
# health-check.sh

ENVIRONMENT=$1
SERVICES=("auth_service" "user_service" "chatbot_service" "frontend" "nginx")

echo "🔍 Checking health for $ENVIRONMENT environment..."

for service in "${SERVICES[@]}"; do
    echo -n "Checking $service... "
    if docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml ps $service | grep -q "Up"; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
        exit 1
    fi
done

echo "✅ All services are healthy!"
```

---

## 💾 Backup e Recovery

### 1. Script di Backup Automatico

```bash
#!/bin/bash
# backup.sh

ENVIRONMENT=$1
BACKUP_DIR="/backups/ai-playground"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR/$ENVIRONMENT

# Backup databases
DATABASES=("auth_db" "user_db" "chatbot_db" "analysis_db" "rag_db" "learning_db")

for db in "${DATABASES[@]}"; do
    echo "Backing up $db..."
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec -T $db pg_dump -U postgres > $BACKUP_DIR/$ENVIRONMENT/${db}_${DATE}.sql
done

# Backup volumes
echo "Backing up volumes..."
tar -czf $BACKUP_DIR/$ENVIRONMENT/volumes_${DATE}.tar.gz -C /var/lib/docker/volumes .

# Backup secrets
echo "Backing up secrets..."
tar -czf $BACKUP_DIR/$ENVIRONMENT/secrets_${DATE}.tar.gz .secrets/$ENVIRONMENT/

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR/$ENVIRONMENT -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR/$ENVIRONMENT -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed for $ENVIRONMENT!"
```

### 2. Cron Job per Backup Automatico

```bash
# Aggiungi al crontab
crontab -e

# Backup giornaliero alle 2:00 AM
0 2 * * * /path/to/your/backup.sh prod
0 3 * * * /path/to/your/backup.sh dev
```

### 3. Recovery Procedure

```bash
#!/bin/bash
# restore.sh

ENVIRONMENT=$1
BACKUP_DATE=$2
BACKUP_DIR="/backups/ai-playground"

echo "🔄 Starting recovery for $ENVIRONMENT environment..."

# Stop services
./deploy.sh $ENVIRONMENT down

# Restore databases
DATABASES=("auth_db" "user_db" "chatbot_db" "analysis_db" "rag_db" "learning_db")

for db in "${DATABASES[@]}"; do
    echo "Restoring $db..."
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml up -d $db
    sleep 10
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec -T $db psql -U postgres -c "DROP DATABASE IF EXISTS $(echo $db | sed 's/_db//');"
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec -T $db psql -U postgres -c "CREATE DATABASE $(echo $db | sed 's/_db//');"
    cat $BACKUP_DIR/$ENVIRONMENT/${db}_${BACKUP_DATE}.sql | docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec -T $db psql -U postgres
done

# Restore volumes
echo "Restoring volumes..."
tar -xzf $BACKUP_DIR/$ENVIRONMENT/volumes_${BACKUP_DATE}.tar.gz -C /var/lib/docker/volumes

# Restore secrets
echo "Restoring secrets..."
tar -xzf $BACKUP_DIR/$ENVIRONMENT/secrets_${BACKUP_DATE}.tar.gz

# Start services
./deploy.sh $ENVIRONMENT up

echo "✅ Recovery completed for $ENVIRONMENT!"
```

---

## 🔧 Troubleshooting

### Problemi Comuni

#### 1. Certificati SSL non funzionano

```bash
# Verifica configurazione
sudo certbot certificates

# Test rinnovo
sudo certbot renew --dry-run

# Riavvia nginx
docker-compose restart nginx
```

#### 2. Servizi non si connettono

```bash
# Verifica network
docker network ls
docker network inspect pl-ai_pl-ai-network

# Verifica DNS container
docker-compose exec frontend nslookup auth_service
```

#### 3. Database connection errors

```bash
# Verifica status database
docker-compose ps | grep db

# Verifica logs
docker-compose logs auth_db

# Test connessione
docker-compose exec auth_db psql -U postgres -c "SELECT 1;"
```

#### 4. Out of Memory

```bash
# Verifica uso memoria
docker stats

# Cleanup immagini inutilizzate
docker system prune -a

# Aggiorna resource limits
nano docker-compose.prod.yml
```

### Log Analysis

```bash
# Visualizza logs in tempo reale
docker-compose logs -f

# Cerca errori specifici
docker-compose logs | grep -i error

# Esporta logs per analisi
docker-compose logs > debug_$(date +%Y%m%d).log
```

### Performance Tuning

```bash
# Ottimizza database
docker-compose exec auth_db psql -U postgres -c "VACUUM ANALYZE;"

# Monitora performance
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Scala servizi worker
docker-compose up -d --scale data_analysis_worker=3
```

---

## 🎯 Checklist Deploy

### Pre-Deploy
- [ ] DNS configurato correttamente
- [ ] SSL certificati installati
- [ ] File .env configurati
- [ ] Secrets creati
- [ ] Backup effettuato

### Deploy
- [ ] ./deploy.sh [env] up --build
- [ ] Verifica status servizi
- [ ] Test endpoints API
- [ ] Test frontend
- [ ] Verifica SSL

### Post-Deploy
- [ ] Monitoring attivo
- [ ] Logs configurati
- [ ] Backup schedulato
- [ ] Health checks OK
- [ ] Performance test

---

## 📞 Supporto

Per supporto aggiuntivo:

1. Controlla i logs: `./deploy.sh [env] logs`
2. Verifica status: `./deploy.sh [env] status`
3. Esegui health check: `./health-check.sh [env]`
4. Consulta questa guida per soluzioni comuni

---

**🎉 Congratulazioni! Il tuo sistema di deployment multi-ambiente è ora configurato e funzionante!**

Per domande specifiche o problemi non coperti in questa guida, puoi creare un issue nel repository del progetto. 