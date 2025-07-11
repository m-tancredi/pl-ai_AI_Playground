#!/bin/bash

# =============================================================================
# SCRIPT DI DEPLOYMENT AI PLAYGROUND - VPS IONOS
# =============================================================================

set -euo pipefail

# Configurazione
PROJECT_NAME="golinelli-ai"
PROJECT_DIR="/opt/golinelli-ai"
DOCKER_COMPOSE_FILE="docker-compose.dev.yml"
NGINX_CONFIG_FILE="nginx-deployment-config.conf"
DOMAIN="dev.pl-ai.it"
EMAIL="your-email@example.com"  # Cambiare con email reale per Let's Encrypt

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Verifica prerequisiti
check_prerequisites() {
    log "Verificando prerequisiti..."
    
    # Verifica utente
    if [ "$USER" != "aiplayground" ]; then
        error "Questo script deve essere eseguito con l'utente 'aiplayground'"
    fi
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        error "Docker non è installato"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose non è installato"
    fi
    
    # Verifica nginx
    if ! command -v nginx &> /dev/null; then
        error "Nginx non è installato"
    fi
    
    # Verifica certbot
    if ! command -v certbot &> /dev/null; then
        error "Certbot non è installato"
    fi
    
    # Verifica openssl
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL non è installato"
    fi
    
    log "Prerequisiti verificati con successo"
}

# Creazione directory di progetto
create_project_directories() {
    log "Creando directory di progetto..."
    
    sudo mkdir -p $PROJECT_DIR
    sudo chown -R aiplayground:aiplayground $PROJECT_DIR
    
    # Directory per volumi Docker
    mkdir -p $PROJECT_DIR/volumes/{analysis_db_data,analysis_results_data,chatbot_db_data,classifier_db_data,image_generator_db_data,image_generator_media,models_storage_data,postgres_data,rabbitmq_data,resource_db_data,resource_media_data,rag_db_data,rag_uploads_data,rag_embeddings_data,user_db_data,learning_db_data,user_media,learning_media,learning_logs}
    
    # Directory per media files su nginx
    sudo mkdir -p /opt/golinelli-ai/media_{images,resources,analysis_results,users,rag_uploads}
    sudo chown -R aiplayground:aiplayground /opt/golinelli-ai/media_*
    
    log "Directory create con successo"
}

# Setup del progetto
setup_project() {
    log "Configurando il progetto..."
    
    cd $PROJECT_DIR
    
    # Clona repository se non esiste
    if [ ! -d ".git" ]; then
        info "Clonando repository..."
        git clone https://github.com/YOUR_USERNAME/pl-ai_AI-PlayGround.git .
    else
        info "Aggiornando repository..."
        git pull origin main
    fi
    
    # Copia file di sviluppo
    cp .env.dev .env
    cp $DOCKER_COMPOSE_FILE docker-compose.yml
    
    log "Progetto configurato con successo"
}

# Crea backup dei file di configurazione
create_backup() {
    log "Creando backup dei file di configurazione..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup dei file principali
    for file in .env .env.dev; do
        if [ -f "$file" ]; then
            cp "$file" "$backup_dir/"
            info "Backup creato: $backup_dir/$file"
        fi
    done
    
    # Backup delle secrets se esistono
    if [ -d ".secrets" ]; then
        cp -r .secrets "$backup_dir/"
        info "Backup secrets creato: $backup_dir/.secrets"
    fi
    
    log "Backup completato in: $backup_dir"
}

# Genera o recupera password esistenti
generate_or_recover_passwords() {
    log "Gestione password sicure..."
    
    # File per memorizzare le password generate
    local password_file=".secrets/generated_passwords.txt"
    mkdir -p .secrets
    
    # Funzione per generare o recuperare password
    get_or_generate_password() {
        local key=$1
        local length=${2:-32}
        
        if [ -f "$password_file" ] && grep -q "^$key=" "$password_file"; then
            # Recupera password esistente
            local existing_password=$(grep "^$key=" "$password_file" | cut -d'=' -f2)
            echo "$existing_password"
            info "Password recuperata per $key"
        else
            # Genera nuova password
            local new_password=$(openssl rand -base64 $length | tr -d '\n')
            echo "$key=$new_password" >> "$password_file"
            echo "$new_password"
            info "Password generata per $key"
        fi
    }
    
    # Genera tutte le password necessarie
    declare -A PASSWORDS
    PASSWORDS[AUTH_PASSWORD]=$(get_or_generate_password "AUTH_PASSWORD" 32)
    PASSWORDS[USER_PASSWORD]=$(get_or_generate_password "USER_PASSWORD" 32)
    PASSWORDS[CHATBOT_PASSWORD]=$(get_or_generate_password "CHATBOT_PASSWORD" 32)
    PASSWORDS[IMAGEGEN_PASSWORD]=$(get_or_generate_password "IMAGEGEN_PASSWORD" 32)
    PASSWORDS[RESOURCE_PASSWORD]=$(get_or_generate_password "RESOURCE_PASSWORD" 32)
    PASSWORDS[CLASSIFIER_PASSWORD]=$(get_or_generate_password "CLASSIFIER_PASSWORD" 32)
    PASSWORDS[ANALYSIS_PASSWORD]=$(get_or_generate_password "ANALYSIS_PASSWORD" 32)
    PASSWORDS[RAG_PASSWORD]=$(get_or_generate_password "RAG_PASSWORD" 32)
    PASSWORDS[LEARNING_PASSWORD]=$(get_or_generate_password "LEARNING_PASSWORD" 32)
    PASSWORDS[DJANGO_SECRET]=$(get_or_generate_password "DJANGO_SECRET" 64)
    PASSWORDS[JWT_SECRET]=$(get_or_generate_password "JWT_SECRET" 64)
    PASSWORDS[INTERNAL_SECRET]=$(get_or_generate_password "INTERNAL_SECRET" 64)
    
    # Imposta permessi sicuri
    chmod 600 "$password_file"
    
    log "Password generate/recuperate con successo"
}

# Applica le password ai file di configurazione
apply_passwords_to_config() {
    log "Applicando password ai file di configurazione..."
    
    # Lista dei file da aggiornare
    local files_to_update=(".env" ".env.dev")
    
    for file in "${files_to_update[@]}"; do
        if [ -f "$file" ]; then
            info "Aggiornando $file..."
            
            # Sostituzioni password database
            sed -i "s/CHANGE_ME_AUTH_PASSWORD_STRONG_2024/${PASSWORDS[AUTH_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_USER_PASSWORD_STRONG_2024/${PASSWORDS[USER_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_CHATBOT_PASSWORD_STRONG_2024/${PASSWORDS[CHATBOT_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_IMAGEGEN_PASSWORD_STRONG_2024/${PASSWORDS[IMAGEGEN_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_RESOURCE_PASSWORD_STRONG_2024/${PASSWORDS[RESOURCE_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_CLASSIFIER_PASSWORD_STRONG_2024/${PASSWORDS[CLASSIFIER_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_ANALYSIS_PASSWORD_STRONG_2024/${PASSWORDS[ANALYSIS_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_RAG_PASSWORD_STRONG_2024/${PASSWORDS[RAG_PASSWORD]}/g" "$file"
            sed -i "s/CHANGE_ME_LEARNING_PASSWORD_STRONG_2024/${PASSWORDS[LEARNING_PASSWORD]}/g" "$file"
            
            # Sostituzioni chiavi Django e JWT
            sed -i "s/CHANGE_ME_DJANGO_SECRET_KEY_VERY_LONG_AND_SECURE_FOR_DEVELOPMENT_2024/${PASSWORDS[DJANGO_SECRET]}/g" "$file"
            sed -i "s/CHANGE_ME_JWT_SECRET_KEY_SHARED_BETWEEN_SERVICES_2024/${PASSWORDS[JWT_SECRET]}/g" "$file"
            sed -i "s/CHANGE_ME_INTERNAL_API_SECRET_2024/${PASSWORDS[INTERNAL_SECRET]}/g" "$file"
            
            info "$file aggiornato con successo"
        else
            warn "$file non trovato, saltando..."
        fi
    done
    
    log "Password applicate con successo"
}

# Verifica che tutte le password siano state sostituite
verify_password_substitution() {
    log "Verificando sostituzioni password..."
    
    local files_to_check=(".env" ".env.dev")
    local all_good=true
    
    for file in "${files_to_check[@]}"; do
        if [ -f "$file" ]; then
            info "Verificando $file..."
            
            # Controlla se ci sono ancora pattern da sostituire
            if grep -q "CHANGE_ME_" "$file"; then
                error "Pattern non sostituiti trovati in $file:"
                grep "CHANGE_ME_" "$file" | head -5
                all_good=false
            else
                info "$file: tutte le password sostituite correttamente"
            fi
            
            # Verifica che le password abbiano una lunghezza minima
            local password_count=$(grep -c "PASSWORD.*=" "$file" || true)
            if [ "$password_count" -gt 0 ]; then
                info "$file: trovate $password_count password"
            fi
        fi
    done
    
    if [ "$all_good" = true ]; then
        log "Verifica password completata con successo"
    else
        error "Problemi nella sostituzione delle password"
    fi
}

# Configurazione secrets API
setup_secrets() {
    log "Configurando secrets API..."
    
    mkdir -p .secrets
    
    # Funzione per gestire API key
    setup_api_key() {
        local key_name=$1
        local key_file=$2
        local prompt_message=$3
        
        if [ -f "$key_file" ] && [ -s "$key_file" ]; then
            info "API key $key_name già presente"
            return 0
        fi
        
        # Chiedi all'utente solo se non esiste
        read -p "$prompt_message: " api_key
        if [ -n "$api_key" ]; then
            echo "$api_key" > "$key_file"
            chmod 600 "$key_file"
            info "API key $key_name configurata"
        else
            warn "API key $key_name non configurata"
        fi
    }
    
    # Configura tutte le API keys
    setup_api_key "OpenAI" ".secrets/openai_api_key.txt" "Inserisci OpenAI API Key"
    setup_api_key "Anthropic" ".secrets/anthropic_api_key.txt" "Inserisci Anthropic API Key"
    setup_api_key "Gemini" ".secrets/gemini_api_key.txt" "Inserisci Gemini API Key"
    setup_api_key "Stability" ".secrets/stability_api_key.txt" "Inserisci Stability API Key"
    
    log "Secrets API configurati con successo"
}

# Sincronizza password tra file
sync_passwords_between_files() {
    log "Sincronizzando password tra file..."
    
    # Verifica che i file principali abbiano le stesse password
    if [ -f ".env" ] && [ -f ".env.dev" ]; then
        # Estrai password da .env.dev (source of truth)
        local env_dev_passwords=$(grep "PASSWORD.*=" .env.dev | sort)
        local env_passwords=$(grep "PASSWORD.*=" .env | sort)
        
        if [ "$env_dev_passwords" = "$env_passwords" ]; then
            info "Password sincronizzate tra .env e .env.dev"
        else
            warn "Password non sincronizzate, copiando da .env.dev a .env"
            # Copia le password da .env.dev a .env
            while IFS= read -r line; do
                if [[ $line =~ ^[A-Z_]*PASSWORD.*= ]]; then
                    local key=$(echo "$line" | cut -d'=' -f1)
                    local value=$(echo "$line" | cut -d'=' -f2-)
                    sed -i "s/^$key=.*/$key=$value/" .env
                fi
            done < .env.dev
        fi
    fi
    
    log "Sincronizzazione completata"
}

# Configurazione nginx
setup_nginx() {
    log "Configurando nginx..."
    
    # Copia configurazione
    sudo cp $NGINX_CONFIG_FILE /etc/nginx/sites-available/dev.pl-ai.it
    
    # Abilita sito
    sudo ln -sf /etc/nginx/sites-available/dev.pl-ai.it /etc/nginx/sites-enabled/
    
    # Test configurazione
    sudo nginx -t
    
    log "Nginx configurato con successo"
}

# Configurazione SSL
setup_ssl() {
    log "Configurando SSL con Let's Encrypt..."
    
    # Rimuovi configurazione SSL temporaneamente
    sudo sed -i '/listen 443 ssl/,/ssl_dhparam/d' /etc/nginx/sites-available/dev.pl-ai.it
    sudo sed -i '/# managed by Certbot/d' /etc/nginx/sites-available/dev.pl-ai.it
    
    # Ricarica nginx
    sudo systemctl reload nginx
    
    # Ottieni certificato
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
    
    log "SSL configurato con successo"
}

# Creazione file env specifici per servizi
create_service_env_files() {
    log "Creando file .env specifici per i servizi..."
    
    # Lista dei servizi
    services=("auth_service" "user_service" "chatbot_service" "image_generator_service" "resource_manager_service" "image_classifier_service" "data_analysis_service" "rag_service" "learning_service")
    
    for service in "${services[@]}"; do
        service_dir="backend/$service"
        if [ -d "$service_dir" ]; then
            info "Creando .env.dev per $service..."
            
            # Copia il template base
            cp .env "$service_dir/.env.dev"
            
            # Personalizzazioni specifiche per servizio
            case $service in
                "auth_service")
                    echo "DATABASE_URL=postgres://\${AUTH_DB_USER}:\${AUTH_DB_PASSWORD}@\${AUTH_DB_HOST}:\${AUTH_DB_PORT}/\${AUTH_DB_NAME}" >> "$service_dir/.env.dev"
                    ;;
                "user_service")
                    echo "DATABASE_URL=postgres://\${USER_DB_USER}:\${USER_DB_PASSWORD}@\${USER_DB_HOST}:\${USER_DB_PORT}/\${USER_DB_NAME}" >> "$service_dir/.env.dev"
                    ;;
                "chatbot_service")
                    echo "DATABASE_URL=postgres://\${CHATBOT_DB_USER}:\${CHATBOT_DB_PASSWORD}@\${CHATBOT_DB_HOST}:\${CHATBOT_DB_PORT}/\${CHATBOT_DB_NAME}" >> "$service_dir/.env.dev"
                    ;;
                # Aggiungi altre personalizzazioni se necessario
            esac
        fi
    done
    
    log "File .env dei servizi creati con successo"
}

# Build e avvio servizi
deploy_services() {
    log "Avviando deployment dei servizi..."
    
    # Build delle immagini
    docker-compose build --no-cache
    
    # Avvio dei servizi
    docker-compose up -d
    
    # Attendi che i servizi siano pronti
    sleep 30
    
    log "Servizi avviati con successo"
}

# Inizializzazione database
init_databases() {
    log "Inizializzando database..."
    
    # Lista dei servizi che necessitano migrazioni
    services=("auth_service" "user_service" "chatbot_service" "image_generator_service" "resource_manager_service" "image_classifier_service" "data_analysis_service" "rag_service" "learning_service")
    
    for service in "${services[@]}"; do
        info "Eseguendo migrazioni per $service..."
        docker-compose exec $service python manage.py migrate
    done
    
    log "Database inizializzati con successo"
}

# Verifica deployment
verify_deployment() {
    log "Verificando deployment..."
    
    # Verifica che i container siano in esecuzione
    if ! docker-compose ps | grep -q "Up"; then
        error "Alcuni container non sono in esecuzione"
    fi
    
    # Verifica che nginx sia in esecuzione
    if ! sudo systemctl is-active --quiet nginx; then
        error "Nginx non è in esecuzione"
    fi
    
    # Test connessione
    if curl -f -k https://$DOMAIN > /dev/null 2>&1; then
        log "Sito raggiungibile: https://$DOMAIN"
    else
        warn "Sito non raggiungibile, controllare i log"
    fi
    
    log "Verifica deployment completata"
}

# Creazione script di gestione
create_management_scripts() {
    log "Creando script di gestione..."
    
    cat > manage.sh << 'EOF'
#!/bin/bash
# Script di gestione AI PlayGround

case $1 in
    "start")
        docker-compose up -d
        ;;
    "stop")
        docker-compose down
        ;;
    "restart")
        docker-compose restart
        ;;
    "logs")
        docker-compose logs -f ${2:-}
        ;;
    "status")
        docker-compose ps
        ;;
    "backup")
        ./backup.sh
        ;;
    "passwords")
        echo "Password generate memorizzate in .secrets/generated_passwords.txt"
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|logs|status|backup|passwords}"
        exit 1
        ;;
esac
EOF

    chmod +x manage.sh
    
    log "Script di gestione creati con successo"
}

# Genera report delle password
generate_password_report() {
    log "Generando report delle password..."
    
    local report_file="password_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
AI PLAYGROUND - REPORT PASSWORD
===============================
Generato: $(date)

Password Database:
- Auth Service: [GENERATA]
- User Service: [GENERATA]
- Chatbot Service: [GENERATA]
- Image Generator Service: [GENERATA]
- Resource Manager Service: [GENERATA]
- Classifier Service: [GENERATA]
- Analysis Service: [GENERATA]
- RAG Service: [GENERATA]
- Learning Service: [GENERATA]

Chiavi di Sicurezza:
- Django Secret Key: [GENERATA]
- JWT Secret Key: [GENERATA]
- Internal API Secret: [GENERATA]

API Keys:
- OpenAI: $([ -f .secrets/openai_api_key.txt ] && echo "[CONFIGURATA]" || echo "[NON CONFIGURATA]")
- Anthropic: $([ -f .secrets/anthropic_api_key.txt ] && echo "[CONFIGURATA]" || echo "[NON CONFIGURATA]")
- Gemini: $([ -f .secrets/gemini_api_key.txt ] && echo "[CONFIGURATA]" || echo "[NON CONFIGURATA]")
- Stability: $([ -f .secrets/stability_api_key.txt ] && echo "[CONFIGURATA]" || echo "[NON CONFIGURATA]")

Backup:
- Password generate: .secrets/generated_passwords.txt
- Configurazioni: backups/

IMPORTANTE: Mantieni sicuri i file nella directory .secrets/
EOF

    info "Report generato: $report_file"
}

# Funzione principale
main() {
    log "=== INIZIO DEPLOYMENT AI PLAYGROUND ==="
    
    check_prerequisites
    create_project_directories
    setup_project
    create_backup
    generate_or_recover_passwords
    apply_passwords_to_config
    verify_password_substitution
    sync_passwords_between_files
    setup_secrets
    create_service_env_files
    setup_nginx
    deploy_services
    init_databases
    setup_ssl
    verify_deployment
    create_management_scripts
    generate_password_report
    
    log "=== DEPLOYMENT COMPLETATO CON SUCCESSO ==="
    log "Sito disponibile su: https://$DOMAIN"
    log "Per gestire i servizi usa: ./manage.sh {start|stop|restart|logs|status|backup|passwords}"
    log "Per visualizzare i log: ./manage.sh logs [service_name]"
    log "Report password: $(ls password_report_*.txt | tail -1)"
    log "IMPORTANTE: Mantieni sicuri i file in .secrets/"
}

# Esecuzione dello script
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 