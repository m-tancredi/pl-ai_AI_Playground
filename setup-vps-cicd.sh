#!/bin/bash

# =============================================================================
# SETUP CI/CD SULLA VPS - AI PLAYGROUND
# =============================================================================
# Questo script configura il CI/CD automatico sulla VPS
# Esegui sulla VPS: curl -sSL https://raw.githubusercontent.com/m-tancredi/pl-ai_AI_Playground/dev/setup-vps-cicd.sh | bash
# =============================================================================

set -euo pipefail

# Configurazione
PROJECT_DIR="/opt/golinelli-ai"
REPO_URL="https://github.com/m-tancredi/pl-ai_AI_Playground.git"
BRANCH="dev"
CRON_SCHEDULE="*/5 * * * *"  # Ogni 5 minuti
LOG_FILE="/var/log/auto-deploy.log"

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# Verifica prerequisiti
check_prerequisites() {
    log "Verificando prerequisiti..."
    
    # Verifica utente
    if [ "$USER" != "aiplayground" ]; then
        error "Esegui questo script con l'utente aiplayground"
    fi
    
    # Verifica sudo
    if ! sudo -n true 2>/dev/null; then
        error "Necessari privilegi sudo per configurare cron"
    fi
    
    # Verifica directory progetto
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Directory progetto non trovata: $PROJECT_DIR"
    fi
    
    log "Prerequisiti verificati"
}

# Configura repository per il branch dev
setup_repository() {
    log "Configurando repository per branch dev..."
    
    cd "$PROJECT_DIR"
    
    # Verifica e configura remote
    if ! git remote get-url origin &>/dev/null; then
        git remote add origin "$REPO_URL"
    fi
    
    # Fetch e checkout del branch dev
    git fetch origin
    git checkout "$BRANCH" || git checkout -b "$BRANCH" "origin/$BRANCH"
    git pull origin "$BRANCH"
    
    log "Repository configurato per branch dev"
}

# Crea script wrapper per cron
create_cron_wrapper() {
    log "Creando script wrapper per cron..."
    
    cat > "$PROJECT_DIR/cron-auto-deploy.sh" << 'EOF'
#!/bin/bash

# Wrapper per eseguire auto-deploy da cron
# Questo script gestisce l'ambiente e il logging

PROJECT_DIR="/opt/golinelli-ai"
LOG_FILE="/var/log/auto-deploy.log"

# Configura ambiente
export PATH="/usr/local/bin:/usr/bin:/bin"
export SHELL="/bin/bash"
export HOME="/home/aiplayground"

# Vai nella directory del progetto
cd "$PROJECT_DIR" || exit 1

# Esegui auto-deploy con logging
{
    echo "============================================"
    echo "Auto-deploy avviato: $(date)"
    echo "============================================"
    
    # Esegui auto-deploy
    timeout 300 ./auto-deploy.sh
    
    echo "============================================"
    echo "Auto-deploy completato: $(date)"
    echo "============================================"
    echo ""
} >> "$LOG_FILE" 2>&1

# Mantieni log sotto controllo (ultimi 1000 righe)
tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
EOF
    
    chmod +x "$PROJECT_DIR/cron-auto-deploy.sh"
    log "Script wrapper creato"
}

# Configura cron job
setup_cron() {
    log "Configurando cron job..."
    
    # Crea file di log
    sudo touch "$LOG_FILE"
    sudo chown aiplayground:aiplayground "$LOG_FILE"
    
    # Aggiungi cron job
    (crontab -l 2>/dev/null || echo "") | grep -v "auto-deploy" | crontab -
    (crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $PROJECT_DIR/cron-auto-deploy.sh") | crontab -
    
    log "Cron job configurato: $CRON_SCHEDULE"
}

# Crea script di gestione
create_management_script() {
    log "Creando script di gestione CI/CD..."
    
    cat > "$PROJECT_DIR/manage-cicd.sh" << 'EOF'
#!/bin/bash

# Script di gestione CI/CD
case $1 in
    "status")
        echo "=== STATUS CI/CD ==="
        echo "Cron job:"
        crontab -l | grep auto-deploy || echo "Nessun cron job configurato"
        echo ""
        echo "Ultimo deployment:"
        tail -n 20 /var/log/auto-deploy.log | grep -A 5 -B 5 "completato" | tail -10
        echo ""
        echo "Container status:"
        docker-compose ps
        ;;
    "logs")
        echo "=== ULTIMI LOG CI/CD ==="
        tail -n 50 /var/log/auto-deploy.log
        ;;
    "logs-live")
        echo "=== LOG CI/CD IN TEMPO REALE ==="
        tail -f /var/log/auto-deploy.log
        ;;
    "deploy-now")
        echo "=== DEPLOYMENT MANUALE ==="
        ./auto-deploy.sh --force
        ;;
    "enable")
        echo "=== ABILITAZIONE CI/CD ==="
        crontab -l | grep -v auto-deploy | crontab -
        (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/golinelli-ai/cron-auto-deploy.sh") | crontab -
        echo "CI/CD abilitato"
        ;;
    "disable")
        echo "=== DISABILITAZIONE CI/CD ==="
        crontab -l | grep -v auto-deploy | crontab -
        echo "CI/CD disabilitato"
        ;;
    "backup")
        echo "=== BACKUP MANUALE ==="
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_dir="deployments/backups/manual_$timestamp"
        mkdir -p "$backup_dir"
        
        # Backup configurazioni
        cp -r .env* "$backup_dir/" 2>/dev/null || true
        cp -r .secrets "$backup_dir/" 2>/dev/null || true
        cp docker-compose.yml "$backup_dir/" 2>/dev/null || true
        
        # Backup database
        docker-compose exec -T auth_db pg_dump -U golinelli_auth_user golinelli_auth_dev > "$backup_dir/auth_db_backup.sql" 2>/dev/null || true
        
        echo "Backup creato in: $backup_dir"
        ;;
    "cleanup")
        echo "=== PULIZIA SISTEMA ==="
        docker system prune -f
        docker volume prune -f
        find deployments/backups -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
        echo "Pulizia completata"
        ;;
    *)
        echo "Uso: $0 {status|logs|logs-live|deploy-now|enable|disable|backup|cleanup}"
        echo ""
        echo "Comandi disponibili:"
        echo "  status      - Mostra stato CI/CD e container"
        echo "  logs        - Mostra ultimi log deployment"
        echo "  logs-live   - Mostra log in tempo reale"
        echo "  deploy-now  - Forza deployment immediato"
        echo "  enable      - Abilita CI/CD automatico"
        echo "  disable     - Disabilita CI/CD automatico"
        echo "  backup      - Crea backup manuale"
        echo "  cleanup     - Pulizia sistema Docker"
        exit 1
        ;;
esac
EOF
    
    chmod +x "$PROJECT_DIR/manage-cicd.sh"
    log "Script di gestione creato"
}

# Crea webhook receiver (opzionale)
create_webhook_receiver() {
    log "Creando webhook receiver..."
    
    cat > "$PROJECT_DIR/webhook-receiver.py" << 'EOF'
#!/usr/bin/env python3
"""
Webhook receiver per GitHub
Riceve notifiche push e triggera deployment automatico
"""

import json
import subprocess
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import hmac
import hashlib
import os

# Configurazione
PORT = 9999
SECRET = os.environ.get('WEBHOOK_SECRET', 'your-webhook-secret')
PROJECT_DIR = '/opt/golinelli-ai'

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/webhook-receiver.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/webhook':
            self.send_response(404)
            self.end_headers()
            return
        
        # Leggi payload
        content_length = int(self.headers['Content-Length'])
        payload = self.rfile.read(content_length)
        
        # Verifica signature GitHub
        signature = self.headers.get('X-Hub-Signature-256')
        if not self.verify_signature(payload, signature):
            logger.warning("Signature non valida")
            self.send_response(401)
            self.end_headers()
            return
        
        # Parse payload
        try:
            data = json.loads(payload.decode('utf-8'))
        except json.JSONDecodeError:
            logger.error("Payload JSON non valido")
            self.send_response(400)
            self.end_headers()
            return
        
        # Controlla se è un push sul branch dev
        if data.get('ref') == 'refs/heads/dev':
            logger.info("Push rilevato sul branch dev")
            self.trigger_deployment()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "deployment triggered"}).encode())
        else:
            logger.info(f"Push ignorato, branch: {data.get('ref')}")
            self.send_response(200)
            self.end_headers()
    
    def verify_signature(self, payload, signature):
        if not signature:
            return False
        
        expected = hmac.new(
            SECRET.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(f"sha256={expected}", signature)
    
    def trigger_deployment(self):
        try:
            subprocess.Popen([
                '/bin/bash', '-c',
                f'cd {PROJECT_DIR} && ./auto-deploy.sh > /var/log/webhook-deploy.log 2>&1 &'
            ])
            logger.info("Deployment triggerto con successo")
        except Exception as e:
            logger.error(f"Errore triggering deployment: {e}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    logger.info(f"Webhook receiver avviato sulla porta {PORT}")
    server.serve_forever()
EOF
    
    chmod +x "$PROJECT_DIR/webhook-receiver.py"
    log "Webhook receiver creato"
}

# Crea servizio systemd per webhook
create_webhook_service() {
    log "Creando servizio systemd per webhook..."
    
    cat | sudo tee /etc/systemd/system/ai-playground-webhook.service > /dev/null << EOF
[Unit]
Description=AI Playground Webhook Receiver
After=network.target

[Service]
Type=simple
User=aiplayground
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/python3 $PROJECT_DIR/webhook-receiver.py
Restart=always
RestartSec=10
Environment=WEBHOOK_SECRET=your-webhook-secret

[Install]
WantedBy=multi-user.target
EOF
    
    # Abilita servizio
    sudo systemctl daemon-reload
    sudo systemctl enable ai-playground-webhook.service
    
    log "Servizio webhook creato (non avviato)"
}

# Test del sistema
test_system() {
    log "Testing sistema CI/CD..."
    
    cd "$PROJECT_DIR"
    
    # Test auto-deploy
    if ./auto-deploy.sh --help > /dev/null 2>&1; then
        info "✓ Auto-deploy script funzionante"
    else
        warn "✗ Auto-deploy script problematico"
    fi
    
    # Test cron
    if crontab -l | grep -q auto-deploy; then
        info "✓ Cron job configurato"
    else
        warn "✗ Cron job non configurato"
    fi
    
    # Test log
    if [ -f "$LOG_FILE" ] && [ -w "$LOG_FILE" ]; then
        info "✓ File di log configurato"
    else
        warn "✗ File di log non configurato"
    fi
    
    log "Test completato"
}

# Mostra istruzioni finali
show_final_instructions() {
    header "🎉 SETUP CI/CD COMPLETATO"
    
    echo -e "${GREEN}Il sistema CI/CD è ora configurato!${NC}"
    echo ""
    echo -e "${BLUE}📋 COMANDI DISPONIBILI:${NC}"
    echo "  ./manage-cicd.sh status      - Stato del sistema"
    echo "  ./manage-cicd.sh logs        - Ultimi log"
    echo "  ./manage-cicd.sh deploy-now  - Deployment immediato"
    echo "  ./auto-deploy.sh --help      - Guida auto-deploy"
    echo ""
    echo -e "${BLUE}🔄 FUNZIONAMENTO:${NC}"
    echo "  • Controllo automatico ogni 5 minuti"
    echo "  • Backup automatico prima di ogni deployment"
    echo "  • Rollback automatico in caso di errore"
    echo "  • Log dettagliati in: $LOG_FILE"
    echo ""
    echo -e "${BLUE}🎯 PROSSIMI PASSI:${NC}"
    echo "  1. Verifica: ./manage-cicd.sh status"
    echo "  2. Test: ./manage-cicd.sh deploy-now"
    echo "  3. Monitoraggio: ./manage-cicd.sh logs-live"
    echo ""
    echo -e "${YELLOW}💡 PER WEBHOOK GITHUB (opzionale):${NC}"
    echo "  1. Configura secret: sudo systemctl edit ai-playground-webhook"
    echo "  2. Avvia servizio: sudo systemctl start ai-playground-webhook"
    echo "  3. Configura webhook GitHub su: http://VPS_IP:9999/webhook"
    echo ""
    echo -e "${GREEN}🚀 Il tuo CI/CD è pronto!${NC}"
}

# Funzione principale
main() {
    header "🔧 SETUP CI/CD - AI PLAYGROUND"
    
    check_prerequisites
    setup_repository
    create_cron_wrapper
    setup_cron
    create_management_script
    create_webhook_receiver
    create_webhook_service
    test_system
    show_final_instructions
}

# Esecuzione
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 