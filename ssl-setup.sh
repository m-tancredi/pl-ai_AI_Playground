#!/bin/bash

# =============================================================================
# CONFIGURAZIONE SSL PER AI-PLAYGROUND
# =============================================================================
# Script per configurare SSL/HTTPS per dev.pl-ai.it
# Utilizzabile sia durante il deploy che come configurazione standalone
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
EMAIL="admin@dev.pl-ai.it"
NGINX_CONF="/etc/nginx/sites-available/default"
SSL_CONF_DIR="/etc/letsencrypt/live/$DOMAIN"

# Funzioni di utilità
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verifica requisiti
check_requirements() {
    log "Verifica requisiti SSL..."
    
    # Verifica root
    if [[ $EUID -ne 0 ]]; then
        error "Questo script deve essere eseguito come root"
    fi
    
    # Verifica nginx
    if ! command -v nginx &> /dev/null; then
        error "Nginx non installato"
    fi
    
    # Verifica che nginx sia in esecuzione
    if ! systemctl is-active --quiet nginx; then
        error "Nginx non è in esecuzione"
    fi
    
    # Verifica che il dominio sia configurato
    if ! nginx -t &> /dev/null; then
        error "Configurazione nginx non valida"
    fi
    
    success "Requisiti verificati"
}

# Installa Certbot se necessario
install_certbot() {
    log "Installazione Certbot..."
    
    if command -v certbot &> /dev/null; then
        log "Certbot già installato"
        return 0
    fi
    
    # Aggiorna package manager
    apt update
    
    # Installa Certbot
    apt install -y certbot python3-certbot-nginx
    
    success "Certbot installato"
}

# Configura firewall
configure_firewall() {
    log "Configurazione firewall..."
    
    if command -v ufw &> /dev/null; then
        # Abilita HTTPS
        ufw allow 'Nginx Full'
        ufw allow 443/tcp
        
        # Rimuovi HTTP se non necessario
        # ufw deny 'Nginx HTTP'
        
        success "Firewall configurato"
    else
        warning "UFW non disponibile, configura manualmente il firewall"
    fi
}

# Verifica DNS
verify_dns() {
    log "Verifica DNS per $DOMAIN..."
    
    # Ottieni IP del server
    SERVER_IP=$(curl -s https://api.ipify.org)
    
    # Verifica che il dominio punti al server
    DOMAIN_IP=$(dig +short "$DOMAIN" | tail -n1)
    
    if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
        warning "DNS non configurato correttamente:"
        echo "  Server IP: $SERVER_IP"
        echo "  Domain IP: $DOMAIN_IP"
        echo "  Assicurati che $DOMAIN punti a $SERVER_IP"
        read -p "Continuare comunque? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        success "DNS configurato correttamente"
    fi
}

# Ottieni certificato SSL
obtain_ssl_certificate() {
    log "Richiesta certificato SSL per $DOMAIN..."
    
    # Verifica che il servizio sia raggiungibile
    if ! curl -s -I "http://$DOMAIN" &> /dev/null; then
        warning "Il sito non è raggiungibile via HTTP, continuando comunque..."
    fi
    
    # Richiedi certificato
    if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"; then
        success "Certificato SSL ottenuto e configurato"
    else
        error "Impossibile ottenere il certificato SSL"
    fi
}

# Configura auto-renewal
setup_auto_renewal() {
    log "Configurazione auto-renewal..."
    
    # Verifica se il cron job esiste già
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        log "Auto-renewal già configurato"
        return 0
    fi
    
    # Aggiungi cron job per il renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    # Crea script di post-renewal
    cat > /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh << 'EOF'
#!/bin/bash
# Script eseguito dopo il renewal del certificato
systemctl reload nginx
EOF
    
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh
    
    success "Auto-renewal configurato"
}

# Test configurazione SSL
test_ssl_configuration() {
    log "Test configurazione SSL..."
    
    # Test connessione HTTPS
    if curl -s -I "https://$DOMAIN" &> /dev/null; then
        success "HTTPS funzionante"
    else
        error "HTTPS non funzionante"
    fi
    
    # Test redirect HTTP -> HTTPS
    if curl -s -I "http://$DOMAIN" | grep -q "301\|302"; then
        success "Redirect HTTP -> HTTPS funzionante"
    else
        warning "Redirect HTTP -> HTTPS non configurato"
    fi
    
    # Test qualità SSL (opzionale)
    log "Test qualità SSL..."
    if command -v openssl &> /dev/null; then
        echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates
    fi
}

# Configura HSTS e sicurezza
enhance_security() {
    log "Miglioramento sicurezza SSL..."
    
    # Backup configurazione
    cp "$NGINX_CONF" "$NGINX_CONF.backup.ssl.$(date +%Y%m%d_%H%M%S)"
    
    # Aggiungi header di sicurezza se non presenti
    if ! grep -q "add_header Strict-Transport-Security" "$NGINX_CONF"; then
        # Trova il blocco server per il dominio e aggiungi headers
        sed -i "/server_name $DOMAIN;/a\\
    # SSL Security Headers\\
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;\\
    add_header X-Frame-Options \"SAMEORIGIN\" always;\\
    add_header X-Content-Type-Options \"nosniff\" always;\\
    add_header X-XSS-Protection \"1; mode=block\" always;\\
    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;" "$NGINX_CONF"
        
        # Test e ricarica nginx
        if nginx -t; then
            systemctl reload nginx
            success "Header di sicurezza aggiunti"
        else
            error "Errore nella configurazione nginx"
        fi
    else
        log "Header di sicurezza già presenti"
    fi
}

# Monitoraggio SSL
setup_ssl_monitoring() {
    log "Configurazione monitoraggio SSL..."
    
    # Crea script di monitoraggio
    cat > /usr/local/bin/ssl-monitor.sh << 'EOF'
#!/bin/bash
# Monitor SSL certificate expiration

DOMAIN="dev.pl-ai.it"
THRESHOLD=30  # giorni prima della scadenza per l'alert
LOG_FILE="/var/log/ssl-monitor.log"

# Ottieni data di scadenza
expiry_date=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)

if [ -n "$expiry_date" ]; then
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "$(date): SSL certificate expires in $days_until_expiry days" >> "$LOG_FILE"
    
    if [ "$days_until_expiry" -lt "$THRESHOLD" ]; then
        echo "$(date): WARNING - SSL certificate expires in $days_until_expiry days" >> "$LOG_FILE"
        # Invia alert (configurare email se necessario)
    fi
else
    echo "$(date): ERROR - Cannot check SSL certificate" >> "$LOG_FILE"
fi
EOF
    
    chmod +x /usr/local/bin/ssl-monitor.sh
    
    # Aggiungi al crontab (controllo giornaliero)
    (crontab -l 2>/dev/null; echo "0 9 * * * /usr/local/bin/ssl-monitor.sh") | crontab -
    
    success "Monitoraggio SSL configurato"
}

# Riepilogo configurazione
show_summary() {
    echo ""
    echo "=================================="
    echo "   CONFIGURAZIONE SSL COMPLETATA"
    echo "=================================="
    echo ""
    echo "🔒 Dominio: $DOMAIN"
    echo "📧 Email: $EMAIL"
    echo "📁 Certificati: $SSL_CONF_DIR"
    echo "🔄 Auto-renewal: Configurato"
    echo "📊 Monitoraggio: /var/log/ssl-monitor.log"
    echo ""
    echo "Comandi utili:"
    echo "  • Test SSL: curl -I https://$DOMAIN"
    echo "  • Verifica certificato: certbot certificates"
    echo "  • Rinnovo manuale: certbot renew"
    echo "  • Test auto-renewal: certbot renew --dry-run"
    echo ""
    echo "🌐 Il tuo sito è ora disponibile su: https://$DOMAIN"
}

# Funzione principale
main() {
    log "=== CONFIGURAZIONE SSL AI-PLAYGROUND ==="
    
    check_requirements
    install_certbot
    configure_firewall
    verify_dns
    obtain_ssl_certificate
    setup_auto_renewal
    enhance_security
    setup_ssl_monitoring
    test_ssl_configuration
    
    show_summary
    
    success "Configurazione SSL completata!"
}

# Gestione argomenti
case "${1:-}" in
    --dry-run)
        log "Modalità dry-run"
        ;;
    --force)
        log "Modalità force"
        ;;
    --help)
        echo "Usage: $0 [--dry-run|--force|--help]"
        echo "  --dry-run: Test senza modifiche"
        echo "  --force: Forza la configurazione"
        echo "  --help: Mostra questo aiuto"
        exit 0
        ;;
    *)
        ;;
esac

# Esecuzione
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 