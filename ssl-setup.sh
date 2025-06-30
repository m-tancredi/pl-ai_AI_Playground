#!/bin/bash

# =============================================================================
# Script Setup SSL per AI-PlayGround
# Configura automaticamente i certificati SSL con Let's Encrypt
# =============================================================================

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
    echo "Usage: $0 [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  dev       - Setup SSL for dev.pl-ai.it"
    echo "  prod      - Setup SSL for pl-ai.it"
    echo ""
    echo "OPTIONS:"
    echo "  --staging - Use Let's Encrypt staging environment (for testing)"
    echo "  --force   - Force certificate renewal"
    echo "  --help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 prod --force"
    echo "  $0 dev --staging"
}

# Configurazione ambiente
setup_environment() {
    local env=$1
    local staging=$2
    
    case $env in
        dev)
            DOMAIN="dev.pl-ai.it"
            EMAIL="admin@pl-ai.it"
            ;;
        prod)
            DOMAIN="pl-ai.it"
            EMAIL="admin@pl-ai.it"
            EXTRA_DOMAINS="-d www.pl-ai.it"
            ;;
        *)
            log_error "Invalid environment: $env"
            exit 1
            ;;
    esac
    
    if [[ "$staging" == "true" ]]; then
        STAGING_FLAG="--staging"
        log_warning "Using Let's Encrypt STAGING environment"
    else
        STAGING_FLAG=""
    fi
    
    log_info "Environment: $env"
    log_info "Domain: $DOMAIN"
    log_info "Email: $EMAIL"
}

# Installa certbot se non presente
install_certbot() {
    if command -v certbot &> /dev/null; then
        log_info "Certbot already installed"
        return
    fi
    
    log_info "Installing Certbot..."
    
    # Rileva il sistema operativo
    if [[ -f /etc/debian_version ]]; then
        # Debian/Ubuntu
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    elif [[ -f /etc/redhat-release ]]; then
        # CentOS/RHEL/Fedora
        sudo yum install -y certbot python3-certbot-nginx || sudo dnf install -y certbot python3-certbot-nginx
    else
        log_error "Unsupported operating system. Please install certbot manually."
        exit 1
    fi
    
    log_success "Certbot installed successfully"
}

# Crea backup dei certificati esistenti
backup_existing_certs() {
    local domain=$1
    local backup_dir="/etc/letsencrypt/backup/$(date +%Y%m%d_%H%M%S)"
    
    if [[ -d "/etc/letsencrypt/live/$domain" ]]; then
        log_info "Creating backup of existing certificates..."
        sudo mkdir -p "$backup_dir"
        sudo cp -r "/etc/letsencrypt/live/$domain" "$backup_dir/"
        sudo cp -r "/etc/letsencrypt/archive/$domain" "$backup_dir/" 2>/dev/null || true
        log_success "Backup created at $backup_dir"
    fi
}

# Genera certificati SSL
generate_ssl_certificate() {
    local domain=$1
    local email=$2
    local extra_domains=$3
    local staging_flag=$4
    local force_flag=$5
    
    log_info "Generating SSL certificate for $domain..."
    
    # Costruisci il comando certbot
    local certbot_cmd="sudo certbot certonly --standalone"
    certbot_cmd="$certbot_cmd --email $email"
    certbot_cmd="$certbot_cmd --agree-tos"
    certbot_cmd="$certbot_cmd --no-eff-email"
    certbot_cmd="$certbot_cmd -d $domain"
    
    if [[ -n "$extra_domains" ]]; then
        certbot_cmd="$certbot_cmd $extra_domains"
    fi
    
    if [[ -n "$staging_flag" ]]; then
        certbot_cmd="$certbot_cmd $staging_flag"
    fi
    
    if [[ "$force_flag" == "true" ]]; then
        certbot_cmd="$certbot_cmd --force-renewal"
    fi
    
    # Ferma nginx temporaneamente se è in esecuzione
    if sudo systemctl is-active nginx &>/dev/null; then
        log_info "Stopping nginx temporarily..."
        sudo systemctl stop nginx
        NGINX_WAS_RUNNING=true
    fi
    
    # Esegui certbot
    if eval $certbot_cmd; then
        log_success "SSL certificate generated successfully for $domain"
    else
        log_error "Failed to generate SSL certificate"
        exit 1
    fi
    
    # Riavvia nginx se era in esecuzione
    if [[ "$NGINX_WAS_RUNNING" == "true" ]]; then
        log_info "Starting nginx..."
        sudo systemctl start nginx
    fi
}

# Configura il rinnovo automatico
setup_auto_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Crea script di rinnovo personalizzato
    sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-services.sh > /dev/null << 'EOF'
#!/bin/bash
# Script eseguito dopo il rinnovo dei certificati

# Riavvia nginx
if systemctl is-active nginx &>/dev/null; then
    systemctl reload nginx
fi

# Riavvia docker containers se stanno girando
if docker-compose -f /path/to/your/docker-compose.yml ps | grep -q "Up"; then
    docker-compose -f /path/to/your/docker-compose.yml restart nginx
fi

# Log del rinnovo
echo "$(date): Certificate renewed and services restarted" >> /var/log/letsencrypt-renewal.log
EOF
    
    sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-services.sh
    
    # Aggiorna il path nel script
    local current_dir=$(pwd)
    sudo sed -i "s|/path/to/your|$current_dir|g" /etc/letsencrypt/renewal-hooks/deploy/restart-services.sh
    
    # Verifica che il cron job per certbot esista
    if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
        log_info "Adding certbot renewal to crontab..."
        (sudo crontab -l 2>/dev/null; echo "0 2 * * * certbot renew --quiet --deploy-hook '/etc/letsencrypt/renewal-hooks/deploy/restart-services.sh'") | sudo crontab -
    fi
    
    log_success "Automatic renewal configured"
}

# Verifica la configurazione SSL
verify_ssl_configuration() {
    local domain=$1
    
    log_info "Verifying SSL configuration for $domain..."
    
    # Verifica che i certificati esistano
    if [[ ! -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
        log_error "Certificate not found at /etc/letsencrypt/live/$domain/fullchain.pem"
        return 1
    fi
    
    if [[ ! -f "/etc/letsencrypt/live/$domain/privkey.pem" ]]; then
        log_error "Private key not found at /etc/letsencrypt/live/$domain/privkey.pem"
        return 1
    fi
    
    # Verifica la validità del certificato
    local cert_info=$(sudo openssl x509 -in "/etc/letsencrypt/live/$domain/fullchain.pem" -noout -dates)
    log_info "Certificate validity: $cert_info"
    
    # Test SSL connection (se il dominio è raggiungibile)
    if command -v curl &> /dev/null; then
        if curl -I "https://$domain" --connect-timeout 5 &>/dev/null; then
            log_success "SSL connection test passed for $domain"
        else
            log_warning "SSL connection test failed for $domain (domain might not be pointing to this server yet)"
        fi
    fi
    
    log_success "SSL configuration verified"
}

# Imposta i permessi corretti
set_permissions() {
    log_info "Setting correct permissions for SSL certificates..."
    
    # Assicurati che i certificati siano leggibili da nginx
    sudo chmod -R 755 /etc/letsencrypt/live/
    sudo chmod -R 755 /etc/letsencrypt/archive/
    
    log_success "Permissions set correctly"
}

# Funzione principale
main() {
    local environment=""
    local staging_flag="false"
    local force_flag="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|prod)
                environment="$1"
                shift
                ;;
            --staging)
                staging_flag="true"
                shift
                ;;
            --force)
                force_flag="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Verifica che l'ambiente sia specificato
    if [[ -z "$environment" ]]; then
        log_error "Environment not specified"
        show_help
        exit 1
    fi
    
    # Verifica permessi root
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root. Use sudo when needed."
        exit 1
    fi
    
    log_info "Starting SSL setup for $environment environment..."
    
    # Setup environment variables
    setup_environment "$environment" "$staging_flag"
    
    # Install certbot
    install_certbot
    
    # Backup existing certificates
    backup_existing_certs "$DOMAIN"
    
    # Generate SSL certificate
    generate_ssl_certificate "$DOMAIN" "$EMAIL" "$EXTRA_DOMAINS" "$STAGING_FLAG" "$force_flag"
    
    # Set permissions
    set_permissions
    
    # Setup auto renewal
    setup_auto_renewal
    
    # Verify configuration
    verify_ssl_configuration "$DOMAIN"
    
    log_success "SSL setup completed successfully!"
    log_info "Next steps:"
    log_info "1. Make sure your domain points to this server"
    log_info "2. Run: ./deploy.sh $environment up"
    log_info "3. Test your site at https://$DOMAIN"
}

# Esegui la funzione principale
main "$@" 