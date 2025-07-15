#!/bin/bash

# =============================================================================
# SCRIPT DI DEPLOY AUTOMATIZZATO - AI-PlayGround
# =============================================================================
# Questo script automatizza il deploy del progetto AI-PlayGround su VPS
# Versione: 1.0
# Autore: AI Assistant
# Data: $(date +%Y-%m-%d)
# =============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurazione
PROJECT_NAME="ai-playground"
DOMAIN="dev.pl-ai.it"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="/etc/nginx/sites-available/default"
BACKUP_DIR="/tmp/ai-playground-backup-$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/var/log/ai-playground-deploy.log"

# Funzioni di utilità
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# Controlli preliminari
check_requirements() {
    log "Verifico i requisiti di sistema..."
    
    # Verifica che lo script sia eseguito come root
    if [[ $EUID -ne 0 ]]; then
        error "Questo script deve essere eseguito come root"
    fi
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        error "Docker non è installato"
    fi
    
    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose non è installato"
    fi
    
    # Verifica Nginx
    if ! command -v nginx &> /dev/null; then
        error "Nginx non è installato"
    fi
    
    # Verifica Certbot
    if ! command -v certbot &> /dev/null; then
        warning "Certbot non è installato. SSL dovrà essere configurato manualmente."
    fi
    
    success "Tutti i requisiti sono soddisfatti"
}

# Backup del sistema
create_backup() {
    log "Creazione backup del sistema..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup configurazione nginx
    if [ -f "$NGINX_CONF" ]; then
        cp "$NGINX_CONF" "$BACKUP_DIR/nginx.conf.backup"
        log "Backup nginx completato"
    fi
    
    # Backup dei volumi Docker esistenti (se presenti)
    if docker volume ls | grep -q "ai-playground"; then
        log "Backup dei volumi Docker..."
        for volume in $(docker volume ls --format "table {{.Name}}" | grep "ai-playground"); do
            docker run --rm -v "$volume":/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/"$volume".tar.gz -C /data .
        done
    fi
    
    success "Backup completato in $BACKUP_DIR"
}

# Controllo porte
check_ports() {
    log "Verifico disponibilità porte..."
    
    REQUIRED_PORTS=(8080)
    
    for port in "${REQUIRED_PORTS[@]}"; do
        if netstat -tuln | grep -q ":$port "; then
            # Controlla se la porta è già utilizzata dal nostro progetto
            if ! docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -q "pl-ai-nginx-prod.*:$port"; then
                error "Porta $port è già in uso da un altro processo"
            fi
        fi
    done
    
    success "Porte disponibili"
}

# Pulizia ambiente precedente
cleanup_old_deployment() {
    log "Pulizia deployment precedente..."
    
    # Ferma i container esistenti
    if docker ps -a --format "table {{.Names}}" | grep -q "pl-ai-.*-prod"; then
        log "Fermo i container esistenti..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans || true
    fi
    
    # Rimuovi immagini non utilizzate
    docker image prune -f || true
    
    success "Pulizia completata"
}

# Configurazione ambiente
setup_environment() {
    log "Configurazione ambiente..."
    
    # Verifica che i file .env esistano
    env_files=(
        "backend/auth_service/.env"
        "backend/user_service/.env"
        "backend/chatbot_service/.env"
        "backend/image_generator_service/.env"
        "backend/resource_manager_service/.env"
        "backend/image_classifier_service/.env"
        "backend/data_analysis_service/.env"
        "backend/rag_service/.env"
        "backend/learning_service/.env"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ ! -f "$env_file" ]; then
            error "File $env_file non trovato"
        fi
    done
    
    # Verifica che la directory .secrets esista
    if [ ! -d ".secrets" ]; then
        error "Directory .secrets non trovata"
    fi
    
    # Verifica che i file dei segreti esistano
    secret_files=(
        ".secrets/openai_api_key.txt"
        ".secrets/anthropic_api_key.txt"
        ".secrets/gemini_api_key.txt"
        ".secrets/stability_api_key.txt"
    )
    
    for secret_file in "${secret_files[@]}"; do
        if [ ! -f "$secret_file" ]; then
            error "File $secret_file non trovato"
        fi
    done
    
    success "Ambiente configurato correttamente"
}

# Build delle immagini
build_images() {
    log "Build delle immagini Docker..."
    
    # Build in parallelo per velocizzare il processo
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --parallel
    
    success "Build completato"
}

# Deploy dei servizi
deploy_services() {
    log "Deploy dei servizi..."
    
    # Avvia i servizi in background
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Attendi che i servizi siano pronti
    log "Attendo che i servizi siano pronti..."
    sleep 30
    
    # Controlla lo stato dei servizi critici
    critical_services=(
        "pl-ai-nginx-prod"
        "pl-ai-frontend-prod"
        "pl-ai-auth-service-prod"
        "pl-ai-user-service-prod"
    )
    
    for service in "${critical_services[@]}"; do
        if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
            error "Servizio $service non è avviato correttamente"
        fi
    done
    
    success "Servizi deployati correttamente"
}

# Configurazione Nginx
configure_nginx() {
    log "Configurazione Nginx..."
    
    # Backup della configurazione attuale
    if [ -f "$NGINX_CONF" ]; then
        cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Copia la nuova configurazione
    cp nginx-vps.conf "$NGINX_CONF"
    
    # Test della configurazione
    if ! nginx -t; then
        error "Configurazione Nginx non valida"
    fi
    
    # Ricarica Nginx
    systemctl reload nginx
    
    success "Nginx configurato correttamente"
}

# Configurazione SSL
configure_ssl() {
    log "Configurazione SSL..."
    
    if command -v certbot &> /dev/null; then
        # Ottieni certificato SSL
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || {
            warning "Impossibile configurare SSL automaticamente. Configura manualmente con:"
            echo "sudo certbot --nginx -d $DOMAIN"
        }
    else
        warning "Certbot non installato. Installa con:"
        echo "sudo apt install certbot python3-certbot-nginx"
        echo "sudo certbot --nginx -d $DOMAIN"
    fi
}

# Health check
health_check() {
    log "Controllo salute dei servizi..."
    
    # Controllo endpoint principale
    if curl -f -s "http://localhost:8080/" > /dev/null; then
        success "Applicazione raggiungibile localmente"
    else
        error "Applicazione non raggiungibile"
    fi
    
    # Controllo servizi specifici
    services_to_check=(
        "auth_service:8000"
        "user_service:8000"
        "frontend:3000"
    )
    
    for service in "${services_to_check[@]}"; do
        service_name=$(echo "$service" | cut -d: -f1)
        port=$(echo "$service" | cut -d: -f2)
        
        if docker exec "pl-ai-${service_name}-prod" curl -f -s "http://localhost:$port/" > /dev/null; then
            success "Servizio $service_name funzionante"
        else
            warning "Servizio $service_name potrebbe avere problemi"
        fi
    done
}

# Monitoraggio post-deploy
setup_monitoring() {
    log "Configurazione monitoraggio..."
    
    # Crea script di monitoraggio
    cat > /usr/local/bin/ai-playground-monitor.sh << 'EOF'
#!/bin/bash
# Script di monitoraggio AI-PlayGround

LOG_FILE="/var/log/ai-playground-monitor.log"
ALERT_EMAIL="admin@dev.pl-ai.it"

check_service() {
    local service=$1
    if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
        echo "$(date): ALERT - Servizio $service non funzionante" >> "$LOG_FILE"
        # Invia email se configurato
        # mail -s "ALERT: $service down" "$ALERT_EMAIL" < /dev/null
        return 1
    fi
    return 0
}

# Controlla servizi critici
critical_services=(
    "pl-ai-nginx-prod"
    "pl-ai-frontend-prod"
    "pl-ai-auth-service-prod"
)

for service in "${critical_services[@]}"; do
    check_service "$service"
done

# Controlla uso disk
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    echo "$(date): WARNING - Disk usage: $disk_usage%" >> "$LOG_FILE"
fi

# Controlla memoria
memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$memory_usage" -gt 80 ]; then
    echo "$(date): WARNING - Memory usage: $memory_usage%" >> "$LOG_FILE"
fi
EOF

    chmod +x /usr/local/bin/ai-playground-monitor.sh
    
    # Aggiungi al crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/ai-playground-monitor.sh") | crontab -
    
    success "Monitoraggio configurato"
}

# Cleanup finale
final_cleanup() {
    log "Pulizia finale..."
    
    # Rimuovi immagini inutilizzate
    docker image prune -f
    
    # Rimuovi volumi orfani
    docker volume prune -f
    
    success "Pulizia completata"
}

# Riepilogo deploy
deployment_summary() {
    echo ""
    echo "=================================="
    echo "   DEPLOY COMPLETATO CON SUCCESSO"
    echo "=================================="
    echo ""
    echo "🌐 Sito: https://$DOMAIN"
    echo "📊 Monitoring: /var/log/ai-playground-monitor.log"
    echo "🔧 Logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo "📂 Backup: $BACKUP_DIR"
    echo ""
    echo "Comandi utili:"
    echo "  • Restart: docker-compose -f $DOCKER_COMPOSE_FILE restart"
    echo "  • Stop: docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "  • Logs: docker-compose -f $DOCKER_COMPOSE_FILE logs [service]"
    echo "  • Status: docker-compose -f $DOCKER_COMPOSE_FILE ps"
    echo ""
}

# Funzione principale
main() {
    log "=== INIZIO DEPLOY AI-PLAYGROUND ==="
    
    check_requirements
    create_backup
    check_ports
    cleanup_old_deployment
    setup_environment
    build_images
    deploy_services
    configure_nginx
    configure_ssl
    health_check
    setup_monitoring
    final_cleanup
    
    deployment_summary
    
    success "Deploy completato con successo!"
}

# Gestione segnali
trap 'error "Deploy interrotto dall'\''utente"' INT TERM

# Esecuzione se lo script è chiamato direttamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 