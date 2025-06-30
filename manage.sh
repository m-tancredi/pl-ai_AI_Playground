#!/bin/bash

# =============================================================================
# Script di Gestione AI-PlayGround
# Interfaccia unificata per tutte le operazioni di gestione
# =============================================================================

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    AI-PLAYGROUND MANAGER                     ║"
    echo "║                      Sistema Gestione                       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

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

log_action() {
    echo -e "${PURPLE}[ACTION]${NC} $1"
}

# Menu principale
show_main_menu() {
    echo -e "${CYAN}=== MENU PRINCIPALE ===${NC}"
    echo "1. 🚀 Deploy & Management"
    echo "2. 🔐 SSL Management"
    echo "3. 📊 Monitoring & Logs"
    echo "4. 💾 Backup & Recovery"
    echo "5. ⚙️  System Maintenance"
    echo "6. 🔧 Troubleshooting"
    echo "7. 📖 Info & Status"
    echo "0. ❌ Exit"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    case $choice in
        1) show_deploy_menu ;;
        2) show_ssl_menu ;;
        3) show_monitoring_menu ;;
        4) show_backup_menu ;;
        5) show_maintenance_menu ;;
        6) show_troubleshooting_menu ;;
        7) show_info_menu ;;
        0) exit 0 ;;
        *) log_error "Opzione non valida" && show_main_menu ;;
    esac
}

# Menu Deploy
show_deploy_menu() {
    echo -e "${CYAN}=== DEPLOY & MANAGEMENT ===${NC}"
    echo "1. 🏗️  Deploy Development (dev.pl-ai.it)"
    echo "2. 🏭 Deploy Production (pl-ai.it)"
    echo "3. 🔄 Restart Services"
    echo "4. ⏹️  Stop Services"
    echo "5. 🔄 Update & Redeploy"
    echo "6. 📈 Scale Services"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) deploy_environment "dev" ;;
        2) deploy_environment "prod" ;;
        3) restart_services ;;
        4) stop_services ;;
        5) update_and_redeploy ;;
        6) scale_services ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_deploy_menu ;;
    esac
}

# Menu SSL
show_ssl_menu() {
    echo -e "${CYAN}=== SSL MANAGEMENT ===${NC}"
    echo "1. 🔒 Setup SSL Development"
    echo "2. 🔐 Setup SSL Production"
    echo "3. 🔄 Renew SSL Certificates"
    echo "4. ✅ Check SSL Status"
    echo "5. 🧪 Test SSL (Staging)"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) setup_ssl "dev" ;;
        2) setup_ssl "prod" ;;
        3) renew_ssl ;;
        4) check_ssl_status ;;
        5) test_ssl_staging ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_ssl_menu ;;
    esac
}

# Menu Monitoring
show_monitoring_menu() {
    echo -e "${CYAN}=== MONITORING & LOGS ===${NC}"
    echo "1. 📊 System Status"
    echo "2. 📋 View Logs"
    echo "3. ⚡ Real-time Logs"
    echo "4. 🔍 Search Logs"
    echo "5. 💻 Resource Usage"
    echo "6. 🏥 Health Check"
    echo "7. 📈 Performance Stats"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) system_status ;;
        2) view_logs ;;
        3) realtime_logs ;;
        4) search_logs ;;
        5) resource_usage ;;
        6) health_check ;;
        7) performance_stats ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_monitoring_menu ;;
    esac
}

# Menu Backup
show_backup_menu() {
    echo -e "${CYAN}=== BACKUP & RECOVERY ===${NC}"
    echo "1. 💾 Create Backup"
    echo "2. 📦 List Backups"
    echo "3. 🔄 Restore from Backup"
    echo "4. 🗑️  Delete Old Backups"
    echo "5. ⚙️  Setup Automated Backup"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) create_backup ;;
        2) list_backups ;;
        3) restore_backup ;;
        4) cleanup_backups ;;
        5) setup_automated_backup ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_backup_menu ;;
    esac
}

# Menu Maintenance
show_maintenance_menu() {
    echo -e "${CYAN}=== SYSTEM MAINTENANCE ===${NC}"
    echo "1. 🧹 Clean Docker System"
    echo "2. 🔄 Update System Packages"
    echo "3. 📊 Database Maintenance"
    echo "4. 🔧 Optimize Performance"
    echo "5. 🔒 Security Updates"
    echo "6. 💿 Disk Cleanup"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) clean_docker ;;
        2) update_system ;;
        3) database_maintenance ;;
        4) optimize_performance ;;
        5) security_updates ;;
        6) disk_cleanup ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_maintenance_menu ;;
    esac
}

# Menu Troubleshooting
show_troubleshooting_menu() {
    echo -e "${CYAN}=== TROUBLESHOOTING ===${NC}"
    echo "1. 🔍 Diagnose Issues"
    echo "2. 🔄 Restart Failed Services"
    echo "3. 🌐 Network Connectivity Test"
    echo "4. 💾 Database Connection Test"
    echo "5. 🔐 SSL Certificate Check"
    echo "6. 📊 System Resources Check"
    echo "7. 📁 Export Debug Info"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) diagnose_issues ;;
        2) restart_failed_services ;;
        3) network_test ;;
        4) database_test ;;
        5) ssl_check ;;
        6) resources_check ;;
        7) export_debug ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_troubleshooting_menu ;;
    esac
}

# Menu Info
show_info_menu() {
    echo -e "${CYAN}=== INFO & STATUS ===${NC}"
    echo "1. 📊 Current Status"
    echo "2. 🌐 Domain Information"
    echo "3. 🔐 SSL Certificate Info"
    echo "4. 💻 System Information"
    echo "5. 📈 Service Statistics"
    echo "6. 📖 View Documentation"
    echo "0. ⬅️  Back to Main Menu"
    echo
    read -p "Seleziona un'opzione: " choice
    echo
    
    case $choice in
        1) current_status ;;
        2) domain_info ;;
        3) ssl_info ;;
        4) system_info ;;
        5) service_stats ;;
        6) view_docs ;;
        0) show_main_menu ;;
        *) log_error "Opzione non valida" && show_info_menu ;;
    esac
}

# Implementazione funzioni principali

deploy_environment() {
    local env=$1
    log_action "Deploying $env environment..."
    
    read -p "Force rebuild? (y/N): " rebuild
    if [[ $rebuild =~ ^[Yy]$ ]]; then
        ./deploy.sh $env up --build
    else
        ./deploy.sh $env up
    fi
    
    log_success "Deployment completed for $env"
    show_deploy_menu
}

setup_ssl() {
    local env=$1
    log_action "Setting up SSL for $env environment..."
    
    read -p "Use staging environment for testing? (y/N): " staging
    if [[ $staging =~ ^[Yy]$ ]]; then
        ./ssl-setup.sh $env --staging
    else
        ./ssl-setup.sh $env
    fi
    
    log_success "SSL setup completed for $env"
    show_ssl_menu
}

system_status() {
    log_action "Checking system status..."
    
    echo -e "${YELLOW}=== Docker Containers ===${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${YELLOW}=== System Resources ===${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    
    echo -e "\n${YELLOW}=== Disk Usage ===${NC}"
    df -h | grep -E "(Filesystem|/dev/)"
    
    read -p "Press Enter to continue..."
    show_monitoring_menu
}

view_logs() {
    echo "Select environment:"
    echo "1. Development"
    echo "2. Production"
    read -p "Choice: " env_choice
    
    local env
    case $env_choice in
        1) env="dev" ;;
        2) env="prod" ;;
        *) log_error "Invalid choice" && return ;;
    esac
    
    echo "Select service:"
    echo "1. All services"
    echo "2. Nginx"
    echo "3. Auth Service"
    echo "4. Frontend"
    echo "5. Database"
    read -p "Choice: " service_choice
    
    case $service_choice in
        1) ./deploy.sh $env logs ;;
        2) docker-compose -f docker-compose.yml -f docker-compose.$env.yml logs nginx ;;
        3) docker-compose -f docker-compose.yml -f docker-compose.$env.yml logs auth_service ;;
        4) docker-compose -f docker-compose.yml -f docker-compose.$env.yml logs frontend ;;
        5) docker-compose -f docker-compose.yml -f docker-compose.$env.yml logs auth_db ;;
        *) log_error "Invalid choice" ;;
    esac
    
    read -p "Press Enter to continue..."
    show_monitoring_menu
}

create_backup() {
    echo "Select environment to backup:"
    echo "1. Development"
    echo "2. Production"
    echo "3. Both"
    read -p "Choice: " choice
    
    case $choice in
        1) backup_environment "dev" ;;
        2) backup_environment "prod" ;;
        3) backup_environment "dev" && backup_environment "prod" ;;
        *) log_error "Invalid choice" && return ;;
    esac
    
    show_backup_menu
}

backup_environment() {
    local env=$1
    log_action "Creating backup for $env environment..."
    
    # Implementa logica di backup
    ./deploy.sh $env backup
    
    log_success "Backup completed for $env"
}

clean_docker() {
    log_action "Cleaning Docker system..."
    
    echo "This will remove:"
    echo "- Stopped containers"
    echo "- Unused networks"
    echo "- Unused images"
    echo "- Build cache"
    
    read -p "Continue? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        docker system prune -a -f
        log_success "Docker cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
    
    show_maintenance_menu
}

diagnose_issues() {
    log_action "Diagnosing system issues..."
    
    echo -e "${YELLOW}=== Container Health ===${NC}"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Health}}"
    
    echo -e "\n${YELLOW}=== Failed Services ===${NC}"
    docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}"
    
    echo -e "\n${YELLOW}=== Disk Space ===${NC}"
    df -h | grep -E "(Filesystem|/dev/)" | awk '$5 > 80 {print "⚠️  " $0}'
    
    echo -e "\n${YELLOW}=== Memory Usage ===${NC}"
    free -h
    
    echo -e "\n${YELLOW}=== Recent Errors in Logs ===${NC}"
    docker logs nginx 2>&1 | grep -i error | tail -5 || echo "No recent errors found"
    
    read -p "Press Enter to continue..."
    show_troubleshooting_menu
}

current_status() {
    show_banner
    
    echo -e "${YELLOW}=== CURRENT STATUS ===${NC}"
    echo -e "Date: $(date)"
    echo -e "Server: $(hostname)"
    echo -e "Uptime: $(uptime -p)"
    
    echo -e "\n${YELLOW}=== ENVIRONMENTS ===${NC}"
    echo -e "🔧 Development: https://dev.pl-ai.it"
    echo -e "🏭 Production:  https://pl-ai.it"
    
    echo -e "\n${YELLOW}=== SERVICES STATUS ===${NC}"
    docker-compose ps 2>/dev/null | grep -E "(Up|Exit)" || echo "No services running"
    
    echo -e "\n${YELLOW}=== SSL CERTIFICATES ===${NC}"
    if sudo certbot certificates 2>/dev/null | grep -q "pl-ai.it"; then
        echo "✅ SSL certificates are installed"
    else
        echo "❌ SSL certificates not found"
    fi
    
    read -p "Press Enter to continue..."
    show_info_menu
}

# Funzione principale
main() {
    show_banner
    
    # Verifica prerequisiti
    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Avvia menu principale
    show_main_menu
}

# Gestione segnali
trap 'echo -e "\n${YELLOW}Exiting...${NC}"; exit 0' INT

# Esegui main
main "$@" 