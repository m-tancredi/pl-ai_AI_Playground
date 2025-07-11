# 🚀 Sistema CI/CD - AI Playground

Sistema di **Continuous Integration/Continuous Deployment** automatico per AI Playground, basato su branch `dev`.

## 📋 Panoramica

Il sistema CI/CD automatizza completamente il processo di deployment:

- **🔄 Controllo automatico**: Ogni 5 minuti verifica modifiche sul branch `dev`
- **📦 Backup automatico**: Prima di ogni deployment 
- **🔧 Rebuild intelligente**: Solo servizi modificati
- **✅ Verifica post-deployment**: Controllo stato servizi
- **🔙 Rollback automatico**: In caso di errore
- **📊 Logging completo**: Tracciamento di tutte le operazioni

## 🏗️ Architettura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Dev    │───▶│   VPS CI/CD     │───▶│   Production    │
│    Branch       │    │    System       │    │    Containers   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Backup &      │              │
         │              │   Monitoring    │              │
         │              └─────────────────┘              │
         │                                                │
         └──────────────── Webhook (opzionale) ──────────┘
```

## 🛠️ Installazione

### 1. Setup Branch Dev (Locale)

```bash
# Clona repository
git clone https://github.com/m-tancredi/pl-ai_AI_Playground.git
cd pl-ai_AI_Playground

# Passa al branch dev
git checkout dev

# Verifica script CI/CD
ls -la auto-deploy.sh setup-vps-cicd.sh
```

### 2. Setup VPS

```bash
# Connetti alla VPS
ssh aiplayground@82.165.73.242

# Scarica e esegui setup CI/CD
curl -sSL https://raw.githubusercontent.com/m-tancredi/pl-ai_AI_Playground/dev/setup-vps-cicd.sh | bash
```

### 3. Verifica Installazione

```bash
# Controlla stato CI/CD
cd /opt/golinelli-ai
./manage-cicd.sh status

# Test deployment manuale
./manage-cicd.sh deploy-now
```

## 🎯 Utilizzo

### Comandi Principali

```bash
# Stato generale sistema
./manage-cicd.sh status

# Deployment immediato
./manage-cicd.sh deploy-now

# Visualizza log
./manage-cicd.sh logs

# Monitoraggio in tempo reale
./manage-cicd.sh logs-live

# Backup manuale
./manage-cicd.sh backup

# Pulizia sistema
./manage-cicd.sh cleanup
```

### Script Auto-Deploy

```bash
# Deployment normale
./auto-deploy.sh

# Deployment forzato
./auto-deploy.sh --force

# Deployment senza backup
./auto-deploy.sh --no-backup

# Guida completa
./auto-deploy.sh --help
```

## 🔄 Workflow di Deployment

### 1. Sviluppo Locale

```bash
# Lavora sul branch dev
git checkout dev

# Apporta modifiche
# ... modifiche al codice ...

# Commit e push
git add .
git commit -m "feat: nuova funzionalità"
git push origin dev
```

### 2. Deployment Automatico

Il sistema VPS:
1. **Rileva modifiche** ogni 5 minuti
2. **Crea backup** del deployment corrente
3. **Fa pull** delle modifiche dal branch dev
4. **Identifica servizi** modificati
5. **Rebuilda** solo i servizi necessari
6. **Verifica** che tutto funzioni
7. **Genera report** di deployment

### 3. Monitoraggio

```bash
# Controlla ultimo deployment
./manage-cicd.sh status

# Vedi log dettagliati
./manage-cicd.sh logs

# Monitoraggio continuo
./manage-cicd.sh logs-live
```

## 🔧 Configurazione

### File di Configurazione

```bash
/opt/golinelli-ai/
├── auto-deploy.sh           # Script principale CI/CD
├── setup-vps-cicd.sh        # Setup iniziale VPS
├── manage-cicd.sh           # Gestione CI/CD
├── cron-auto-deploy.sh      # Wrapper per cron
├── webhook-receiver.py      # Webhook GitHub (opzionale)
└── deployments/backups/     # Directory backup
```

### Personalizzazione

Modifica variabili in `auto-deploy.sh`:

```bash
# Configurazione
PROJECT_DIR="/opt/golinelli-ai"
REPO_URL="https://github.com/m-tancredi/pl-ai_AI_Playground.git"
BRANCH="dev"
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="deployments/backups"
MAX_BACKUPS=10
```

### Cron Job

```bash
# Visualizza cron configurato
crontab -l

# Modifica frequenza (default: ogni 5 minuti)
crontab -e
# */5 * * * * /opt/golinelli-ai/cron-auto-deploy.sh
```

## 🎣 Webhook GitHub (Opzionale)

Per deployment **immediato** su push:

### 1. Configura Webhook Service

```bash
# Configura secret webhook
sudo systemctl edit ai-playground-webhook
# Aggiungi: Environment=WEBHOOK_SECRET=your-strong-secret

# Avvia servizio
sudo systemctl start ai-playground-webhook
sudo systemctl enable ai-playground-webhook
```

### 2. Configura GitHub Webhook

1. Vai su **GitHub → Settings → Webhooks**
2. **Payload URL**: `http://82.165.73.242:9999/webhook`
3. **Content type**: `application/json`
4. **Secret**: `your-strong-secret`
5. **Events**: `Just the push event`

### 3. Verifica Webhook

```bash
# Controlla log webhook
sudo journalctl -u ai-playground-webhook -f

# Test manuale
curl -X POST http://82.165.73.242:9999/webhook \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/dev"}'
```

## 🔍 Monitoraggio e Log

### File di Log

```bash
/var/log/auto-deploy.log         # Log deployment automatico
/var/log/webhook-receiver.log    # Log webhook GitHub
/var/log/webhook-deploy.log      # Log deployment da webhook
```

### Controllo Stato

```bash
# Stato container
docker-compose ps

# Log servizi
docker-compose logs -f [service_name]

# Utilizzo risorse
docker stats

# Spazio disco
df -h
```

## 🚨 Troubleshooting

### Problemi Comuni

#### 1. Deployment Fallito

```bash
# Controlla log errori
./manage-cicd.sh logs | grep ERROR

# Verifica stato container
docker-compose ps

# Rollback manuale
./manage-cicd.sh backup
# poi ripristina da backup
```

#### 2. Cron Non Funziona

```bash
# Verifica cron
crontab -l | grep auto-deploy

# Verifica permessi
ls -la /opt/golinelli-ai/cron-auto-deploy.sh

# Test manuale
cd /opt/golinelli-ai && ./cron-auto-deploy.sh
```

#### 3. Webhook Non Risponde

```bash
# Verifica servizio
sudo systemctl status ai-playground-webhook

# Controlla porta
netstat -tlnp | grep :9999

# Test connessione
curl -I http://82.165.73.242:9999/webhook
```

### Recovery

#### Rollback Completo

```bash
# Vai all'ultimo backup
cd /opt/golinelli-ai/deployments/backups
ls -la

# Ripristina configurazione
cp latest_backup/.env* /opt/golinelli-ai/
cp latest_backup/docker-compose.yml /opt/golinelli-ai/

# Riavvia servizi
cd /opt/golinelli-ai
docker-compose down
docker-compose up -d
```

#### Reset Completo

```bash
# Fai backup completo
./manage-cicd.sh backup

# Reset repository
git reset --hard origin/dev

# Rebuild completo
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📈 Metriche e Performance

### Statistiche Deployment

```bash
# Numero deployment oggi
grep "$(date +%Y-%m-%d)" /var/log/auto-deploy.log | grep -c "completato"

# Tempo medio deployment
grep "completato" /var/log/auto-deploy.log | tail -10

# Errori recenti
grep "ERROR" /var/log/auto-deploy.log | tail -5
```

### Monitoring Avanzato

```bash
# Utilizzo disco backups
du -sh /opt/golinelli-ai/deployments/backups/

# Container con più restart
docker-compose ps | grep "Restarting"

# Servizi più lenti
docker-compose logs | grep "slow"
```

## 🛡️ Sicurezza

### Best Practices

1. **Backup regolari** prima di ogni deployment
2. **Webhook secret** robusto per GitHub
3. **Log rotation** per controllo spazio
4. **Permessi file** appropriati (600 per secrets)
5. **Monitoring continuo** dello stato servizi

### Controlli Sicurezza

```bash
# Verifica permessi
ls -la /opt/golinelli-ai/.secrets/

# Controlla accessi
sudo last | grep aiplayground

# Verifica webhook secret
sudo systemctl show ai-playground-webhook | grep Environment
```

## 🎯 Roadmap

### Funzionalità Future

- [ ] **Notification Slack/Discord** per deployment
- [ ] **Metriche Prometheus** per monitoring
- [ ] **Deployment staging** pre-produzione
- [ ] **A/B Testing** automatico
- [ ] **Performance benchmarking** post-deployment

### Miglioramenti Pianificati

- [ ] **Database migration** automatico
- [ ] **SSL certificate** auto-renewal
- [ ] **Container health checks** avanzati
- [ ] **Multi-branch** deployment support

## 🤝 Contributi

Per contribuire al sistema CI/CD:

1. Fork del repository
2. Crea feature branch: `git checkout -b feature/cicd-improvement`
3. Commit modifiche: `git commit -m "feat: miglioramento CI/CD"`
4. Push branch: `git push origin feature/cicd-improvement`
5. Apri Pull Request

## 🆘 Supporto

- **Issues**: [GitHub Issues](https://github.com/m-tancredi/pl-ai_AI_Playground/issues)
- **Wiki**: [Project Wiki](https://github.com/m-tancredi/pl-ai_AI_Playground/wiki)
- **Documentazione**: [Docs](https://github.com/m-tancredi/pl-ai_AI_Playground/docs)

---

**🚀 Il tuo sistema CI/CD è ora pronto per un deployment completamente automatizzato!** 