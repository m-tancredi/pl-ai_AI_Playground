#!/bin/bash

# Script di Deployment Automatizzato per AI-PlayGround
# Supporta deployment su ambienti DEV, STAGING e PROD

set -e  # Exit on error

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzioni utility
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Funzione per visualizzare l'help
show_help() {
    echo "Usage: $0 [ENVIRONMENT] [ACTION] [OPTIONS]"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  dev       - Deploy to development environment"
    echo "  staging   - Deploy to staging environment"
    echo "  prod      - Deploy to production environment"
    echo ""
    echo "ACTIONS:"
    echo "  up        - Start services"
    echo "  down      - Stop services"
    echo "  restart   - Restart services"
    echo "  logs      - Show logs"
    echo "  status    - Show service status"
    echo "  backup    - Create database backup"
    echo "  migrate   - Run database migrations"
    echo ""
    echo "OPTIONS:"
    echo "  --build   - Force rebuild of images"
    echo "  --clean   - Remove volumes and clean data"
    echo "  --help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev up --build"
    echo "  $0 prod restart"
    echo "  $0 staging logs"
    echo "  $0 prod backup"
}

# Validazione parametri
validate_environment() {
    case $1 in
        dev|staging|prod)
            return 0
            ;;
        *)
            log_error "Invalid environment: $1"
            log_error "Valid environments: dev, staging, prod"
            exit 1
            ;;
    esac
}

validate_action() {
    case $1 in
        up|down|restart|logs|status|backup|migrate)
            return 0
            ;;
        *)
            log_error "Invalid action: $1"
            log_error "Valid actions: up, down, restart, logs, status, backup, migrate"
            exit 1
            ;;
    esac
}

# Configurazione ambiente
set_environment() {
    local env=$1
    
    case $env in
        dev)
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
            ENV_FILE="--env-file .env.dev"
            PROJECT_NAME="ai-playground-dev"
            ;;
        staging)
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
            ENV_FILE="--env-file .env.staging"
            PROJECT_NAME="ai-playground-staging"
            ;;
        prod)
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
            ENV_FILE="--env-file .env.prod"
            PROJECT_NAME="ai-playground-prod"
            ;;
    esac
    
    # Verifica che i file necessari esistano
    if [[ ! -f ".env.$env" ]]; then
        log_error "Environment file .env.$env not found!"
        exit 1
    fi
    
    log_info "Environment set to: $env"
}

# Pre-deployment checks
pre_deployment_checks() {
    local env=$1
    
    log_info "Running pre-deployment checks for $env environment..."
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Verifica spazio disco
    local available_space=$(df / | awk 'NR==2 {print $4}')
    local required_space=5000000  # 5GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log_warning "Low disk space available: $(( available_space / 1024 / 1024 ))GB"
        read -p "Continue anyway? (y/N): " confirm
        if [[ $confirm != [yY] ]]; then
            exit 1
        fi
    fi
    
    # Verifica file di secrets per staging/prod
    if [[ "$env" != "dev" ]]; then
        if [[ ! -d ".secrets/$env" ]]; then
            log_error "Secrets directory .secrets/$env not found!"
            exit 1
        fi
    fi
    
    log_success "Pre-deployment checks passed"
}

# Azioni principali
action_up() {
    local env=$1
    local build_flag=$2
    
    log_info "Starting $env environment..."
    
    local build_option=""
    if [[ "$build_flag" == "--build" ]]; then
        build_option="--build"
        log_info "Force rebuilding images..."
    fi
    
    docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME up -d $build_option
    
    log_success "$env environment started successfully"
    
    # Attendi che i servizi siano pronti
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Verifica salute dei servizi
    check_service_health
}

action_down() {
    local env=$1
    local clean_flag=$2
    
    log_info "Stopping $env environment..."
    
    docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME down
    
    if [[ "$clean_flag" == "--clean" ]]; then
        log_warning "Removing volumes and cleaning data..."
        docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME down -v
        docker system prune -f
    fi
    
    log_success "$env environment stopped successfully"
}

action_restart() {
    local env=$1
    
    log_info "Restarting $env environment..."
    
    docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME restart
    
    log_success "$env environment restarted successfully"
}

action_logs() {
    local env=$1
    local service=$2
    
    if [[ -z "$service" ]]; then
        docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME logs -f --tail=100
    else
        docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME logs -f --tail=100 $service
    fi
}

action_status() {
    local env=$1
    
    log_info "Service status for $env environment:"
    
    docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME ps
    
    echo ""
    log_info "System resources:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

action_backup() {
    local env=$1
    
    log_info "Creating database backup for $env environment..."
    
    local backup_dir="./backups/$env/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Lista dei database da backuppare
    local databases=("auth_db" "user_db" "chatbot_db" "resource_db" "rag_db" "analysis_db" "classifier_db" "image_generator_db" "learning_db")
    
    for db in "${databases[@]}"; do
        log_info "Backing up $db..."
        docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME exec -T $db pg_dump -U postgres -d postgres > "$backup_dir/${db}_backup.sql"
        
        if [[ $? -eq 0 ]]; then
            log_success "Backup created: $backup_dir/${db}_backup.sql"
        else
            log_error "Failed to backup $db"
        fi
    done
    
    # Comprimi i backup
    log_info "Compressing backups..."
    tar -czf "$backup_dir.tar.gz" "$backup_dir"
    rm -rf "$backup_dir"
    
    log_success "Compressed backup created: $backup_dir.tar.gz"
}

action_migrate() {
    local env=$1
    
    log_info "Running database migrations for $env environment..."
    
    # Lista dei servizi con migrazioni Django
    local services=("auth_service" "user_service" "chatbot_service" "resource_manager_service" "rag_service" "data_analysis_service" "image_classifier_service" "image_generator_service" "learning_service")
    
    for service in "${services[@]}"; do
        log_info "Running migrations for $service..."
        docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME exec $service python manage.py migrate --no-input
        
        if [[ $? -eq 0 ]]; then
            log_success "Migrations completed for $service"
        else
            log_error "Migration failed for $service"
        fi
    done
}

# Verifica salute dei servizi
check_service_health() {
    log_info "Checking service health..."
    
    local healthy_services=0
    local total_services=0
    
    while IFS= read -r line; do
        if [[ $line == *"healthy"* ]]; then
            ((healthy_services++))
        fi
        ((total_services++))
    done < <(docker-compose $COMPOSE_FILES $ENV_FILE -p $PROJECT_NAME ps | grep -E "(healthy|unhealthy)")
    
    if [[ $healthy_services -eq $total_services ]]; then
        log_success "All services are healthy ($healthy_services/$total_services)"
    else
        log_warning "Some services are not healthy ($healthy_services/$total_services)"
        log_warning "Run '$0 $ENVIRONMENT logs' to check for issues"
    fi
}

# Main script
main() {
    # Parsing parametri
    if [[ $# -eq 0 ]] || [[ "$1" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    local environment=$1
    local action=$2
    shift 2
    
    # Validazione
    validate_environment $environment
    validate_action $action
    
    # Setup ambiente
    set_environment $environment
    
    # Pre-deployment checks
    pre_deployment_checks $environment
    
    # Esecuzione azione
    case $action in
        up)
            action_up $environment $@
            ;;
        down)
            action_down $environment $@
            ;;
        restart)
            action_restart $environment
            ;;
        logs)
            action_logs $environment $@
            ;;
        status)
            action_status $environment
            ;;
        backup)
            action_backup $environment
            ;;
        migrate)
            action_migrate $environment
            ;;
    esac
}

# Esecuzione
main $@ 