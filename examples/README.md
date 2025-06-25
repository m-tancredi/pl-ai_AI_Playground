# Esempi di Configurazione Multi-Environment

Questa cartella contiene esempi pratici per implementare ambienti di sviluppo, staging e produzione per il progetto AI-PlayGround.

## 📁 Contenuti

- `docker-compose.dev.yml` - Override per ambiente di sviluppo
- `docker-compose.prod.yml` - Override per ambiente di produzione
- `deploy.sh` - Script automatizzato per deployment e gestione

## 🚀 Utilizzo Rapido

### 1. Setup Iniziale

Copia i file nella root del progetto:

```bash
cp examples/docker-compose.dev.yml .
cp examples/docker-compose.prod.yml .
cp examples/deploy.sh .
chmod +x deploy.sh
```

### 2. Creazione File di Ambiente

Crea i file di configurazione per ogni ambiente:

```bash
# Development
cp .env .env.dev

# Staging (se necessario)
cp .env .env.staging

# Production
cp .env .env.prod
```

### 3. Configurazione Secrets

Per ambienti di staging e produzione, crea le directory dei secrets:

```bash
mkdir -p .secrets/staging
mkdir -p .secrets/prod

# Aggiungi le chiavi API
echo "your_openai_key" > .secrets/prod/openai_api_key.txt
echo "your_anthropic_key" > .secrets/prod/anthropic_api_key.txt
# ... altri secrets
```

### 4. Deployment

Usa lo script di deployment per gestire i diversi ambienti:

```bash
# Avvia ambiente di sviluppo
./deploy.sh dev up --build

# Controlla lo status
./deploy.sh dev status

# Vedi i log
./deploy.sh dev logs

# Esegui migrazioni
./deploy.sh dev migrate

# Backup database
./deploy.sh dev backup

# Arresta ambiente
./deploy.sh dev down
```

## 🔧 Personalizzazione

### File Environment (.env.*)

Modifica i file `.env.dev`, `.env.staging`, `.env.prod` con le configurazioni specifiche per ogni ambiente:

**Esempio .env.dev:**
```bash
# Database Development
AUTH_DB_NAME=plai_db_dev
AUTH_DB_USER=plai_user_dev
AUTH_DB_PASSWORD=dev_password_123

# API URLs
FRONTEND_API_URL=http://localhost:8080

# Debug Settings
DEBUG=True
LOG_LEVEL=DEBUG
```

**Esempio .env.prod:**
```bash
# Database Production
AUTH_DB_NAME=plai_db_prod
AUTH_DB_USER=plai_user_prod
AUTH_DB_PASSWORD=super_secure_password_here

# API URLs
FRONTEND_API_URL=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Security Settings
DEBUG=False
LOG_LEVEL=INFO
```

### Override Docker Compose

Modifica i file `docker-compose.*.yml` per adattarli alle tue esigenze:

- **Development**: Aggiungi port exposure, volume mounts per hot reload
- **Production**: Configura resource limits, security settings, SSL

### Script di Deployment

Lo script `deploy.sh` supporta le seguenti funzionalità:

```bash
# Sintassi generale
./deploy.sh [ENVIRONMENT] [ACTION] [OPTIONS]

# Ambienti disponibili
dev, staging, prod

# Azioni disponibili
up, down, restart, logs, status, backup, migrate

# Opzioni
--build    # Force rebuild delle immagini
--clean    # Rimuovi volumi e pulisci dati
```

## 🔍 Troubleshooting

### Problemi Comuni

1. **Port già in uso**
   ```bash
   # Controlla porte occupate
   netstat -tulpn | grep :8080
   
   # Cambia porta nel file override
   ```

2. **Problemi di permissions**
   ```bash
   # Fix permissions per script
   chmod +x deploy.sh
   
   # Fix ownership per volumi Docker
   sudo chown -R $USER:$USER ./dev-data
   ```

3. **Database connection issues**
   ```bash
   # Verifica logs del database
   ./deploy.sh dev logs auth_db
   
   # Reset database
   ./deploy.sh dev down --clean
   ./deploy.sh dev up --build
   ./deploy.sh dev migrate
   ```

4. **Out of memory/disk space**
   ```bash
   # Pulisci risorse Docker
   docker system prune -af
   docker volume prune -f
   
   # Controlla spazio disco
   df -h
   ```

### Debug Services

Per debuggare servizi specifici:

```bash
# Logs di un servizio specifico
./deploy.sh dev logs auth_service

# Accesso shell dentro container
docker exec -it ai-playground-dev_auth_service_1 /bin/bash

# Restart di un servizio specifico
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart auth_service
```

## 📊 Monitoring

### Health Checks

I servizi includono health checks automatici. Controlla lo stato con:

```bash
./deploy.sh dev status
```

### Resource Usage

Monitora l'utilizzo delle risorse:

```bash
# Stats in tempo reale
docker stats

# Utilizzo disco
docker system df
```

## 🔒 Security Notes

- **Mai committare file `.env.*` o `.secrets/`** nel repository
- Usa password forti per ambienti di staging/produzione
- Configura SSL/TLS per ambienti pubblici
- Limita l'accesso alle porte di debug in produzione
- Esegui backup regolari dei database

## 📚 Prossimi Passi

Dopo aver testato la configurazione Docker Compose multi-environment, considera:

1. **Migrazione a Kubernetes** per scalabilità avanzata
2. **Implementazione CI/CD** con GitHub Actions
3. **Monitoraggio avanzato** con Prometheus/Grafana
4. **Gestione secrets** con HashiCorp Vault

---

Per domande o supporto, consulta la documentazione principale: `DEPLOYMENT_ENVIRONMENTS_GUIDE.md` 