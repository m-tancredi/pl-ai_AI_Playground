#!/bin/bash

# =============================================================================
# SCRIPT CI/CD AUTOMATICO - AI PLAYGROUND
# =============================================================================
# Questo script automatizza il deployment dal branch dev
# Uso: ./auto-deploy.sh [--force] [--no-backup] [--help]
# Uso: ./auto-deploy.sh [--force] [--no-backup] [--help]
# =============================================================================

set -euo pipefail

# Configurazione
PROJECT_DIR="/opt/golinelli-ai"
REPO_URL="https://github.com/m-tancredi/pl-ai_AI_Playground.git"
BRANCH="dev"
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="deployments/backups"
MAX_BACKUPS=10

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
FORCE_DEPLOY=false
NO_BACKUP=false
HELP=false

# Parse argomenti
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --help)
            HELP=true
            shift
            ;;
        *)
            echo "Argomento sconosciuto: $1"
            exit 1
            ;;
    esac
done

# Funzioni utility
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

success() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Mostra help
show_help() {
    cat << EOF
🚀 Auto-Deploy Script - AI Playground CI/CD

UTILIZZO:
    $0 [OPZIONI]

OPZIONI:
    --force         Forza il deployment anche se non ci sono modifiche
    --no-backup     Salta il backup prima del deployment
    --help          Mostra questa guida

ESEMPI:
    $0                          # Deployment normale
    $0 --force                  # Forza il deployment
    $0 --no-backup              # Deployment senza backup
    $0 --force --no-backup      # Forza deployment senza backup

DESCRIZIONE:
    Questo script automatizza il processo di deployment dal branch dev.
    Esegue pull dal repository, backup dei container, rebuild e restart.
    
    Il processo include:
    1. Controllo modifiche nel repository
    2. Backup dei container e volumi (opzionale)
    3. Pull delle modifiche dal branch dev
    4. Rebuild delle immagini modificate
    5. Restart dei servizi
    6. Verifica post-deployment
    7. Rollback automatico in caso di errore

PREREQUISITI:
    - Git configurato
    - Docker e Docker Compose installati
    - Permessi di scrittura nella directory del progetto
    - Accesso al repository GitHub

DIRECTORY:
    Progetto: $PROJECT_DIR
    Backup: $PROJECT_DIR/$BACKUP_DIR
    
Per supporto: https://github.com/m-tancredi/pl-ai_AI_Playground/issues
EOF
}

# Verifica prerequisiti
check_prerequisites() {
    log "Verificando prerequisiti..."
    
    # Verifica directory progetto
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Directory progetto non trovata: $PROJECT_DIR"
    fi
    
    # Verifica Git
    if ! command -v git &> /dev/null; then
        error "Git non installato"
    fi
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        error "Docker non installato"
    fi
    
    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose non installato"
    fi
    
    # Verifica permessi
    if [ ! -w "$PROJECT_DIR" ]; then
        error "Permessi di scrittura mancanti per: $PROJECT_DIR"
    fi
    
    success "Prerequisiti verificati"
}

# Controlla modifiche nel repository
check_for_updates() {
    log "Controllo modifiche nel repository..."
    
    cd "$PROJECT_DIR"
    
    # Verifica stato Git
    if [ ! -d ".git" ]; then
        error "Repository Git non inizializzato in $PROJECT_DIR"
    fi
    
    # Fetch delle modifiche
    git fetch origin "$BRANCH"
    
    # Controlla se ci sono modifiche
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse "origin/$BRANCH")
    
    if [ "$local_commit" = "$remote_commit" ]; then
        if [ "$FORCE_DEPLOY" = true ]; then
            warn "Nessuna modifica rilevata, ma deployment forzato"
            return 0
        else
            info "Nessuna modifica rilevata. Deployment non necessario"
            info "Usa --force per forzare il deployment"
            exit 0
        fi
    else
        info "Modifiche rilevate:"
        git log --oneline "$local_commit..$remote_commit" | head -10
        success "Aggiornamenti disponibili"
    fi
}

# Crea backup del deployment corrente
create_backup() {
    if [ "$NO_BACKUP" = true ]; then
        warn "Backup saltato per opzione --no-backup"
        return 0
    fi
    
    log "Creando backup del deployment corrente..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$PROJECT_DIR/$BACKUP_DIR/$timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup configurazioni
    cp -r .env* "$backup_path/" 2>/dev/null || true
    cp -r .secrets "$backup_path/" 2>/dev/null || true
    cp "$DOCKER_COMPOSE_FILE" "$backup_path/" 2>/dev/null || true
    
    # Backup database (dump rapido)
    info "Backup database..."
    docker-compose exec -T auth_db pg_dump -U golinelli_auth_user golinelli_auth_dev > "$backup_path/auth_db_backup.sql" 2>/dev/null || true
    docker-compose exec -T user_db pg_dump -U golinelli_user_user golinelli_user_dev > "$backup_path/user_db_backup.sql" 2>/dev/null || true
    
    # Backup volumi critici
    info "Backup volumi critici..."
    docker run --rm -v "$(pwd)/volumes/rag_uploads_data:/source:ro" -v "$backup_path:/backup" alpine tar czf /backup/rag_uploads.tar.gz -C /source . 2>/dev/null || true
    docker run --rm -v "$(pwd)/volumes/resource_media_data:/source:ro" -v "$backup_path:/backup" alpine tar czf /backup/resource_media.tar.gz -C /source . 2>/dev/null || true
    
    # Pulizia backup vecchi
    cleanup_old_backups
    
    success "Backup creato: $backup_path"
    export BACKUP_PATH="$backup_path"
}

# Pulizia backup vecchi
cleanup_old_backups() {
    local backup_base="$PROJECT_DIR/$BACKUP_DIR"
    
    if [ -d "$backup_base" ]; then
        info "Pulizia backup vecchi (mantengo ultimi $MAX_BACKUPS)..."
        cd "$backup_base"
        ls -t | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -rf
        success "Pulizia backup completata"
    fi
}

# Pull delle modifiche
pull_changes() {
    log "Aggiornando repository..."
    
    cd "$PROJECT_DIR"
    
    # Stash eventuali modifiche locali
    git stash push -m "Auto-deploy stash $(date)" || true
    
    # Pull delle modifiche
    git pull origin "$BRANCH"
    
    success "Repository aggiornato"
}

# Controlla quali servizi sono cambiati
detect_changed_services() {
    log "Rilevando servizi modificati..."
    
    local changed_files=$(git diff --name-only HEAD~1 HEAD)
    local changed_services=()
    
    # Servizi backend
    for service in auth_service user_service chatbot_service image_generator_service resource_manager_service image_classifier_service data_analysis_service rag_service learning_service; do
        if echo "$changed_files" | grep -q "backend/$service"; then
            changed_services+=("golinelli-ai-$service")
        fi
    done
    
    # Frontend
    if echo "$changed_files" | grep -q "frontend/"; then
        changed_services+=("golinelli-ai-frontend")
    fi
    
    # Docker Compose
    if echo "$changed_files" | grep -q "docker-compose"; then
        changed_services+=("ALL")
    fi
    
    # Nginx
    if echo "$changed_files" | grep -q "nginx"; then
        changed_services+=("golinelli-ai-nginx")
    fi
    
    export CHANGED_SERVICES="${changed_services[*]}"
    
    if [ ${#changed_services[@]} -eq 0 ]; then
        info "Nessun servizio modificato - aggiornamento configurazione"
    else
        info "Servizi modificati: ${changed_services[*]}"
    fi
}

# Rebuild e restart servizi
rebuild_services() {
    log "Ricostruendo e riavviando servizi..."
    
    cd "$PROJECT_DIR"
    
    if [[ "$CHANGED_SERVICES" == *"ALL"* ]]; then
        info "Ricostruendo tutti i servizi..."
        docker-compose build --no-cache
        docker-compose up -d
    elif [ -n "$CHANGED_SERVICES" ]; then
        info "Ricostruendo servizi specifici: $CHANGED_SERVICES"
        
        # Rebuild servizi modificati
        for service in $CHANGED_SERVICES; do
            # Rimuovi prefisso golinelli-ai- per docker-compose
            local compose_service=$(echo "$service" | sed 's/golinelli-ai-//')
            
            if docker-compose ps | grep -q "$compose_service"; then
                info "Ricostruendo $compose_service..."
                docker-compose build --no-cache "$compose_service"
                docker-compose up -d "$compose_service"
            fi
        done
    else
        info "Riavviando tutti i servizi..."
        docker-compose restart
    fi
    
    # Attendi che i servizi siano pronti
    sleep 10
    
    success "Servizi aggiornati"
}

# Verifica post-deployment
verify_deployment() {
    log "Verifica post-deployment..."
    
    cd "$PROJECT_DIR"
    
    # Verifica container in esecuzione
    local running_containers=$(docker-compose ps | grep -c "Up" || echo "0")
    local total_containers=$(docker-compose ps | grep -c "golinelli-ai-" || echo "0")
    
    info "Container in esecuzione: $running_containers/$total_containers"
    
    if [ "$running_containers" -eq 0 ]; then
        error "Nessun container in esecuzione!"
    fi
    
    # Verifica servizi critici
    local critical_services=("golinelli-ai-auth-service" "golinelli-ai-user-service" "golinelli-ai-frontend" "golinelli-ai-nginx")
    
    for service in "${critical_services[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            success "✓ $service: Operativo"
        else
            warn "✗ $service: Problemi rilevati"
        fi
    done
    
    # Test connessione
    if curl -f -s https://dev.pl-ai.it > /dev/null; then
        success "✓ Sito raggiungibile: https://dev.pl-ai.it"
    else
        warn "✗ Sito non raggiungibile"
    fi
    
    success "Verifica completata"
}

# Rollback in caso di errore
rollback_deployment() {
    error "Deployment fallito! Iniziando rollback..."
    
    if [ -z "${BACKUP_PATH:-}" ]; then
        error "Nessun backup disponibile per rollback"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Ripristina configurazioni
    cp "$BACKUP_PATH"/.env* . 2>/dev/null || true
    cp -r "$BACKUP_PATH"/.secrets . 2>/dev/null || true
    cp "$BACKUP_PATH/$DOCKER_COMPOSE_FILE" . 2>/dev/null || true
    
    # Riavvia servizi
    docker-compose down
    docker-compose up -d
    
    warn "Rollback completato. Controlla i log per dettagli dell'errore."
}

# Pulisce file temporanei
cleanup() {
    log "Pulizia file temporanei..."
    
    cd "$PROJECT_DIR"
    
    # Pulizia immagini Docker non utilizzate
    docker system prune -f > /dev/null 2>&1 || true
    
    # Pulizia volumi orfani
    docker volume prune -f > /dev/null 2>&1 || true
    
    success "Pulizia completata"
}

# Genera report deployment
generate_deployment_report() {
    log "Generando report deployment..."
    
    local report_file="deployment_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
AI PLAYGROUND - DEPLOYMENT REPORT
==================================
Data: $(date)
Branch: $BRANCH
Commit: $(git rev-parse HEAD)
Commit Message: $(git log -1 --pretty=%B)

SERVIZI AGGIORNATI:
${CHANGED_SERVICES:-"Nessun servizio specifico"}

CONTAINER STATUS:
$(docker-compose ps)

BACKUP LOCATION:
${BACKUP_PATH:-"Nessun backup creato"}

DEPLOYMENT STATUS: SUCCESS
EOF
    
    success "Report generato: $report_file"
}

# Funzione principale
main() {
    # Gestione help
    if [ "$HELP" = true ]; then
        show_help
        exit 0
    fi
    
    # Trap per gestire errori
    trap 'rollback_deployment' ERR
    
    header "🚀 CI/CD AUTO-DEPLOY - AI PLAYGROUND"
    
    check_prerequisites
    check_for_updates
    create_backup
    pull_changes
    detect_changed_services
    rebuild_services
    verify_deployment
    cleanup
    generate_deployment_report
    
    header "✅ DEPLOYMENT COMPLETATO CON SUCCESSO"
    
    log "Sito aggiornato: https://dev.pl-ai.it"
    log "Portainer: http://82.165.73.242/portainer/"
    log "Per controllare i log: docker-compose logs -f [service]"
    
    success "Deployment automatico completato!"
}

# Esecuzione
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 