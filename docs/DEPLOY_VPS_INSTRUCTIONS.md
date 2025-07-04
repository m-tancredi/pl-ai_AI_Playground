# 🚀 Deploy AI-PlayGround su VPS IONOS (dev.pl-ai.it)

## 📋 **Situazione VPS:**
- NGINX principale gestisce: `blackix.it`, `twinelib.it`
- Porte 80/443 occupate dall'NGINX principale
- AI-PlayGround girerà su porta 8081 interno container

## 🛠️ **Step 1: Setup progetto sulla VPS**

```bash
# Connettiti alla VPS
ssh your-username@your-vps-ip

# Clona il repository
cd /opt
sudo git clone https://github.com/your-username/pl-ai_AI-PlayGround.git
sudo chown -R $USER:$USER pl-ai_AI-PlayGround
cd pl-ai_AI-PlayGround

# Copia il file di configurazione
cp .env.dev .env.dev.vps
```

## 🔧 **Step 2: Configurazione NGINX VPS**

```bash
# Copia la configurazione NGINX per dev.pl-ai.it
sudo cp nginx/dev.pl-ai.it.conf /etc/nginx/sites-available/dev.pl-ai.it

# Abilita il sito
sudo ln -s /etc/nginx/sites-available/dev.pl-ai.it /etc/nginx/sites-enabled/

# Testa la configurazione
sudo nginx -t

# Ricarica NGINX
sudo systemctl reload nginx
```

## 🔐 **Step 3: Configurazione Let's Encrypt**

```bash
# Installa Certbot se non presente
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Genera certificato SSL per dev.pl-ai.it
sudo certbot --nginx -d dev.pl-ai.it

# Il certificato verrà aggiunto automaticamente alla configurazione
```

## 🐳 **Step 4: Avvio AI-PlayGround**

```bash
# Assicurati che Docker e Docker Compose siano installati
docker --version
docker compose --version

# Avvia il sistema AI-PlayGround
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d

# Verifica che tutti i servizi siano attivi
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev ps
```

## 🎯 **Step 5: Verifica funzionamento**

1. **Controlla container:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev logs nginx
   ```

2. **Controlla NGINX VPS:**
   ```bash
   sudo systemctl status nginx
   sudo nginx -t
   ```

3. **Testa il sito:**
   - Apri browser: https://dev.pl-ai.it
   - Verifica che carichi l'AI-PlayGround

## 🏗️ **Architettura finale:**

```
Internet (443/80) 
    ↓
NGINX VPS 
    ├── blackix.it → /opt/photoblog/photoblog.sock
    ├── twinelib.it → localhost:8080
    └── dev.pl-ai.it → localhost:8081
                        ↓
                    Docker Container AI-PlayGround
                        ├── NGINX (port 80 interno)
                        ├── 10 API Services
                        ├── 4 Workers
                        ├── 10 Databases
                        └── React Frontend
```

## 🔄 **Comandi utili:**

```bash
# Stato servizi
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev ps

# Logs
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev logs -f

# Restart
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev restart

# Stop
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev down

# Update dal repository
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev down
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

## 🛡️ **Sicurezza:**

- Porta 8081 accessibile solo da localhost
- SSL gestito dall'NGINX principale
- Certificati Let's Encrypt automatici
- Accesso esterno solo tramite NGINX VPS

## 📱 **Accesso:**

- **Sito principale:** https://dev.pl-ai.it
- **API dirette:** (non accessibili dall'esterno)
- **Admin Django:** https://dev.pl-ai.it/admin/ 