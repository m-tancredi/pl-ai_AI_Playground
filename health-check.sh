#!/bin/bash

# =============================================================================
# HEALTH CHECK E MONITORAGGIO - AI-PLAYGROUND
# =============================================================================
# Script per monitoraggio completo del sistema AI-PlayGround
# Versione: 1.0
# =============================================================================

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurazione
DOMAIN="dev.pl-ai.it"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="/var/log/ai-playground-health.log"
ALERT_EMAIL="admin@dev.pl-ai.it"
SLACK_WEBHOOK=""  # Configurare se necessario

# Soglie di allarme
MEMORY_THRESHOLD=80
DISK_THRESHOLD=80
CPU_THRESHOLD=80
RESPONSE_TIME_THRESHOLD=5

# Funzioni di utilità
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" >> "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE"
}

# Invio notifiche
send_alert() {
    local message="$1"
    local severity="${2:-WARNING}"
    
    # Log dell'alert
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT [$severity]: $message" >> "$LOG_FILE"
    
    # Email (se configurato)
    if command -v mail &> /dev/null && [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "AI-PlayGround Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # Slack (se configurato)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"AI-PlayGround Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK"
    fi
}

# Controllo servizi Docker
check_docker_services() {
    log "Controllo servizi Docker..."
    
    local failed_services=()
    
    # Servizi critici
    local critical_services=(
        "pl-ai-nginx-prod"
        "pl-ai-frontend-prod"
        "pl-ai-auth-service-prod"
        "pl-ai-user-service-prod"
        "pl-ai-auth-db-prod"
        "pl-ai-user-db-prod"
        "pl-ai-rabbitmq-prod"
    )
    
    # Servizi non critici
    local non_critical_services=(
        "pl-ai-chatbot-service-prod"
        "pl-ai-image-generator-service-prod"
        "pl-ai-rag-service-prod"
        "pl-ai-learning-service-prod"
        "pl-ai-data-analysis-service-prod"
    )
    
    # Controlla servizi critici
    for service in "${critical_services[@]}"; do
        if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
            failed_services+=("$service (CRITICO)")
            send_alert "Servizio critico $service non funzionante" "CRITICAL"
        fi
    done
    
    # Controlla servizi non critici
    for service in "${non_critical_services[@]}"; do
        if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
            failed_services+=("$service")
            send_alert "Servizio $service non funzionante" "WARNING"
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        success "Tutti i servizi Docker sono attivi"
    else
        error "Servizi non funzionanti: ${failed_services[*]}"
        return 1
    fi
}

# Controllo salute endpoint
check_endpoints() {
    log "Controllo endpoint applicazione..."
    
    local endpoints=(
        "http://localhost:8080/"
        "http://localhost:8080/api/v1/health/"
        "https://$DOMAIN/"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local start_time=$(date +%s.%N)
        
        if curl -f -s -m 10 "$endpoint" > /dev/null; then
            local end_time=$(date +%s.%N)
            local response_time=$(echo "$end_time - $start_time" | bc)
            
            if (( $(echo "$response_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
                warning "Endpoint $endpoint lento: ${response_time}s"
            else
                success "Endpoint $endpoint OK (${response_time}s)"
            fi
        else
            error "Endpoint $endpoint non raggiungibile"
            send_alert "Endpoint $endpoint non raggiungibile" "CRITICAL"
        fi
    done
}

# Controllo risorse sistema
check_system_resources() {
    log "Controllo risorse sistema..."
    
    # Memoria
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$memory_usage" -gt "$MEMORY_THRESHOLD" ]; then
        warning "Uso memoria alto: $memory_usage%"
        send_alert "Uso memoria alto: $memory_usage%" "WARNING"
    else
        success "Uso memoria OK: $memory_usage%"
    fi
    
    # Disco
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        warning "Uso disco alto: $disk_usage%"
        send_alert "Uso disco alto: $disk_usage%" "WARNING"
    else
        success "Uso disco OK: $disk_usage%"
    fi
    
    # CPU (media ultimi 5 minuti)
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//' | cut -d'%' -f1)
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l) )); then
        warning "Uso CPU alto: $cpu_usage%"
        send_alert "Uso CPU alto: $cpu_usage%" "WARNING"
    else
        success "Uso CPU OK: $cpu_usage%"
    fi
}

# Controllo database
check_databases() {
    log "Controllo database..."
    
    local databases=(
        "pl-ai-auth-db-prod"
        "pl-ai-user-db-prod"
        "pl-ai-chatbot-db-prod"
        "pl-ai-rag-db-prod"
        "pl-ai-learning-db-prod"
    )
    
    for db in "${databases[@]}"; do
        if docker exec "$db" pg_isready -U postgres > /dev/null 2>&1; then
            success "Database $db OK"
        else
            error "Database $db non disponibile"
            send_alert "Database $db non disponibile" "CRITICAL"
        fi
    done
}

# Controllo log errori
check_error_logs() {
    log "Controllo log errori..."
    
    # Controlla log nginx per errori recenti (ultima ora)
    local nginx_errors=$(docker logs pl-ai-nginx-prod --since="1h" 2>&1 | grep -i error | wc -l)
    if [ "$nginx_errors" -gt 10 ]; then
        warning "Molti errori nginx nell'ultima ora: $nginx_errors"
        send_alert "Molti errori nginx: $nginx_errors" "WARNING"
    fi
    
    # Controlla log Django per errori critici
    local django_errors=$(docker-compose -f "$DOCKER_COMPOSE_FILE" logs --since="1h" 2>&1 | grep -i "error\|exception\|traceback" | wc -l)
    if [ "$django_errors" -gt 5 ]; then
        warning "Errori Django rilevati: $django_errors"
        send_alert "Errori Django rilevati: $django_errors" "WARNING"
    fi
}

# Controllo SSL
check_ssl() {
    log "Controllo SSL..."
    
    # Verifica validità certificato
    local expiry_date=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_epoch=$(date -d "$expiry_date" +%s)
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ "$days_until_expiry" -lt 30 ]; then
            warning "Certificato SSL scade in $days_until_expiry giorni"
            send_alert "Certificato SSL scade in $days_until_expiry giorni" "WARNING"
        else
            success "Certificato SSL valido per $days_until_expiry giorni"
        fi
    else
        error "Impossibile verificare certificato SSL"
        send_alert "Impossibile verificare certificato SSL" "CRITICAL"
    fi
}

# Controllo backup
check_backups() {
    log "Controllo backup..."
    
    # Verifica backup recenti
    local backup_dir="/var/backups/ai-playground"
    if [ -d "$backup_dir" ]; then
        local latest_backup=$(find "$backup_dir" -name "*.tar.gz" -mtime -1 | head -1)
        if [ -n "$latest_backup" ]; then
            success "Backup recente trovato: $latest_backup"
        else
            warning "Nessun backup recente (ultime 24h)"
            send_alert "Nessun backup recente" "WARNING"
        fi
    else
        warning "Directory backup non trovata"
    fi
}

# Controllo aggiornamenti
check_updates() {
    log "Controllo aggiornamenti..."
    
    # Verifica aggiornamenti sistema
    local updates=$(apt list --upgradable 2>/dev/null | wc -l)
    if [ "$updates" -gt 20 ]; then
        warning "Molti aggiornamenti disponibili: $updates"
        send_alert "Molti aggiornamenti disponibili: $updates" "INFO"
    fi
    
    # Verifica aggiornamenti Docker images
    local outdated_images=$(docker images --format "table {{.Repository}}\t{{.Tag}}" | grep -v REPOSITORY | wc -l)
    if [ "$outdated_images" -gt 0 ]; then
        log "Immagini Docker presenti: $outdated_images"
    fi
}

# Controllo sicurezza
check_security() {
    log "Controllo sicurezza..."
    
    # Verifica tentativi di login falliti
    local failed_logins=$(journalctl --since="1 hour ago" | grep -i "failed\|invalid" | wc -l)
    if [ "$failed_logins" -gt 20 ]; then
        warning "Molti tentativi di login falliti: $failed_logins"
        send_alert "Molti tentativi di login falliti: $failed_logins" "WARNING"
    fi
    
    # Verifica connessioni sospette
    local suspicious_connections=$(netstat -an | grep -E ":22|:80|:443" | grep ESTABLISHED | wc -l)
    if [ "$suspicious_connections" -gt 50 ]; then
        warning "Molte connessioni attive: $suspicious_connections"
    fi
}

# Pulizia automatica
auto_cleanup() {
    log "Pulizia automatica..."
    
    # Pulisci log vecchi
    find /var/log -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Pulisci immagini Docker non utilizzate
    docker image prune -f > /dev/null 2>&1 || true
    
    # Pulisci volumi orfani
    docker volume prune -f > /dev/null 2>&1 || true
    
    success "Pulizia completata"
}

# Genera report
generate_report() {
    local report_file="/tmp/ai-playground-health-report.txt"
    
    {
        echo "=================================="
        echo "   AI-PLAYGROUND HEALTH REPORT"
        echo "=================================="
        echo "Data: $(date)"
        echo "Dominio: $DOMAIN"
        echo ""
        
        echo "SERVIZI DOCKER:"
        docker-compose -f "$DOCKER_COMPOSE_FILE" ps
        echo ""
        
        echo "RISORSE SISTEMA:"
        echo "Memoria: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
        echo "Disco: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
        echo ""
        
        echo "RETE:"
        echo "Connessioni attive: $(netstat -an | grep ESTABLISHED | wc -l)"
        echo ""
        
        echo "ULTIMI LOG ERRORI:"
        tail -n 20 "$LOG_FILE" | grep -E "ERROR|WARNING" || echo "Nessun errore recente"
        
    } > "$report_file"
    
    log "Report generato: $report_file"
    
    # Invia report via email se configurato
    if command -v mail &> /dev/null && [ -n "$ALERT_EMAIL" ]; then
        mail -s "AI-PlayGround Health Report" "$ALERT_EMAIL" < "$report_file"
    fi
}

# Modalità interattiva
interactive_mode() {
    while true; do
        echo ""
        echo "=== AI-PLAYGROUND HEALTH CHECK ==="
        echo "1. Controllo completo"
        echo "2. Solo servizi Docker"
        echo "3. Solo risorse sistema"
        echo "4. Solo endpoint"
        echo "5. Genera report"
        echo "6. Esci"
        echo ""
        read -p "Scelta: " choice
        
        case $choice in
            1) main ;;
            2) check_docker_services ;;
            3) check_system_resources ;;
            4) check_endpoints ;;
            5) generate_report ;;
            6) exit 0 ;;
            *) echo "Scelta non valida" ;;
        esac
    done
}

# Funzione principale
main() {
    log "=== HEALTH CHECK AI-PLAYGROUND ==="
    
    check_docker_services
    check_endpoints
    check_system_resources
    check_databases
    check_error_logs
    check_ssl
    check_backups
    check_updates
    check_security
    auto_cleanup
    
    success "Health check completato"
}

# Gestione argomenti
case "${1:-}" in
    --interactive)
        interactive_mode
        ;;
    --report)
        generate_report
        ;;
    --services)
        check_docker_services
        ;;
    --resources)
        check_system_resources
        ;;
    --help)
        echo "Usage: $0 [--interactive|--report|--services|--resources|--help]"
        echo "  --interactive: Modalità interattiva"
        echo "  --report: Genera solo report"
        echo "  --services: Controlla solo servizi"
        echo "  --resources: Controlla solo risorse"
        echo "  --help: Mostra questo aiuto"
        exit 0
        ;;
    *)
        main
        ;;
esac 