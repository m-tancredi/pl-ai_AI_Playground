# 🚀 Quick Start Deploy - AI-PlayGround

## 🎯 Deploy Rapido su VPS

### Prerequisiti
- VPS con Ubuntu 20.04+ e minimo 8GB RAM
- Dominio `dev.pl-ai.it` puntato all'IP della VPS
- Accesso SSH root/sudo

### 1. Preparazione Veloce

```bash
# Installa dipendenze
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git vim ufw nginx certbot python3-certbot-nginx

# Installa Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configura firewall
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow ssh && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 2. Clona e Configura

```bash
# Clona progetto
cd /opt
sudo git clone [your-repo-url] ai-playground
cd ai-playground && sudo chown -R $USER:$USER .

# Configura variabili ambiente
cp .env.production.template backend/auth_service/.env
cp .env.production.template backend/user_service/.env
cp .env.production.template backend/chatbot_service/.env
# ... ripeti per tutti i servizi

# Configura segreti API
mkdir -p .secrets
echo "your-openai-key" > .secrets/openai_api_key.txt
echo "your-anthropic-key" > .secrets/anthropic_api_key.txt
echo "your-gemini-key" > .secrets/gemini_api_key.txt
echo "your-stability-key" > .secrets/stability_api_key.txt
chmod 600 .secrets/*
```

### 3. Deploy Automatico

```bash
# Esegui script di deploy
chmod +x deploy.sh
sudo ./deploy.sh
```

### 4. Verifica

```bash
# Controlla servizi
docker-compose -f docker-compose.prod.yml ps

# Test endpoint
curl -I https://dev.pl-ai.it

# Health check
./health-check.sh
```

## 🔧 Comandi Utili

```bash
# Stato servizi
docker-compose -f docker-compose.prod.yml ps

# Log servizio
docker-compose -f docker-compose.prod.yml logs -f [service_name]

# Restart servizio
docker-compose -f docker-compose.prod.yml restart [service_name]

# Health check completo
./health-check.sh

# Configurazione SSL
sudo ./ssl-setup.sh

# Monitoraggio
tail -f /var/log/ai-playground-health.log
```

## 📂 File Principali

- `deploy.sh` - Script di deploy automatico
- `docker-compose.prod.yml` - Configurazione produzione
- `nginx-vps.conf` - Configurazione nginx per VPS
- `ssl-setup.sh` - Configurazione SSL
- `health-check.sh` - Monitoraggio sistema
- `.env.production.template` - Template variabili ambiente
- `DEPLOY_DOCUMENTATION.md` - Documentazione completa

## 🆘 Troubleshooting Veloce

### Servizio non si avvia
```bash
docker-compose -f docker-compose.prod.yml logs [service_name]
docker system prune -f
docker-compose -f docker-compose.prod.yml restart [service_name]
```

### SSL non funziona
```bash
sudo certbot certificates
sudo certbot renew
curl -I https://dev.pl-ai.it
```

### Alto uso risorse
```bash
docker stats
htop
./health-check.sh --resources
```

### Reset completo
```bash
docker-compose -f docker-compose.prod.yml down
docker system prune -a -f
sudo ./deploy.sh
```

---

**Per documentazione completa**: `DEPLOY_DOCUMENTATION.md` 