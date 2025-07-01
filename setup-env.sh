#!/bin/bash

# =============================================================================
# Script Setup Environment per AI-PlayGround
# Configura automaticamente file .env e secrets
# =============================================================================

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Banner
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║               AI-PLAYGROUND ENVIRONMENT SETUP               ║"
echo "║                Configurazione Automatica                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

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

# Funzione per generare password sicure
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Funzione per generare Django secret key
generate_django_secret() {
    python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" 2>/dev/null || \
    openssl rand -base64 50 | tr -d "=+/" | cut -c1-50
}

# Verifica prerequisiti
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required but not installed."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup file environment
setup_env_files() {
    log_info "Checking environment files..."
    
    # Verifica che i file esistano
    if [[ -f ".env.dev" ]]; then
        log_success ".env.dev already exists"
    else
        log_error ".env.dev not found! Please ensure the file exists."
        exit 1
    fi
    
    if [[ -f ".env.prod" ]]; then
        log_success ".env.prod already exists"
    else
        log_error ".env.prod not found! Please ensure the file exists."
        exit 1
    fi
}

# Genera password sicure personalizzate
customize_passwords() {
    log_info "Generating secure passwords..."
    
    # Development passwords
    local dev_auth_pass=$(generate_password 24)
    local dev_user_pass=$(generate_password 24)
    local dev_chatbot_pass=$(generate_password 24)
    local dev_imagegen_pass=$(generate_password 24)
    local dev_resource_pass=$(generate_password 24)
    local dev_classifier_pass=$(generate_password 24)
    local dev_analysis_pass=$(generate_password 24)
    local dev_rag_pass=$(generate_password 24)
    local dev_learning_pass=$(generate_password 24)
    local dev_rabbitmq_pass=$(generate_password 24)
    local dev_django_secret=$(generate_django_secret)
    
    # Production passwords (più lunghe)
    local prod_auth_pass=$(generate_password 32)
    local prod_user_pass=$(generate_password 32)
    local prod_chatbot_pass=$(generate_password 32)
    local prod_imagegen_pass=$(generate_password 32)
    local prod_resource_pass=$(generate_password 32)
    local prod_classifier_pass=$(generate_password 32)
    local prod_analysis_pass=$(generate_password 32)
    local prod_rag_pass=$(generate_password 32)
    local prod_learning_pass=$(generate_password 32)
    local prod_rabbitmq_pass=$(generate_password 32)
    local prod_django_secret=$(generate_django_secret)
    
    # Aggiorna file development
    sed -i "s/DevAuth2024!K7mN9pQ3xR8vW2sE/DevAuth2024!$dev_auth_pass/g" .env.dev
    sed -i "s/DevUser2024!A4hT6uY9oP1zM5kL/DevUser2024!$dev_user_pass/g" .env.dev
    sed -i "s/DevChatbot2024!D3fG7jH2nB9vC6xZ/DevChatbot2024!$dev_chatbot_pass/g" .env.dev
    sed -i "s/DevImageGen2024!X8kM4pW7qR3tY5uI/DevImageGen2024!$dev_imagegen_pass/g" .env.dev
    sed -i "s/DevResource2024!V2sF9hJ6mK1nL8pQ/DevResource2024!$dev_resource_pass/g" .env.dev
    sed -i "s/DevClassifier2024!Z5xC8vB3nM6kH9jG/DevClassifier2024!$dev_classifier_pass/g" .env.dev
    sed -i "s/DevAnalysis2024!T4yU7iO0pA3sD6fG/DevAnalysis2024!$dev_analysis_pass/g" .env.dev
    sed -i "s/DevRag2024!H9jK2lZ5xC8vB1nM/DevRag2024!$dev_rag_pass/g" .env.dev
    sed -i "s/DevLearning2024!Q6wE9rT2yU5iO8pA/DevLearning2024!$dev_learning_pass/g" .env.dev
    sed -i "s/DevRabbitMQ2024!S3dF6gH9jK2lZ5xC/DevRabbitMQ2024!$dev_rabbitmq_pass/g" .env.dev
    sed -i "s/dev-secret-key-x8k3m7p2q5w9r6t4y7u0i3o6p9a2s5d8f1g4h7j0k3l6z9x2c5v8b/$dev_django_secret/g" .env.dev
    
    # Aggiorna anche Celery URL in development
    sed -i "s/DevRabbitMQ2024!S3dF6gH9jK2lZ5xC/DevRabbitMQ2024!$dev_rabbitmq_pass/g" .env.dev
    
    # Aggiorna file production
    sed -i "s/ProdAuth2024#Kx9Mn7Pq5Xr2Wv8Sg4Tl6Yh1Uj3Zn/ProdAuth2024#$prod_auth_pass/g" .env.prod
    sed -i "s/ProdUser2024#Az8Ht4Uy7Op9Zm1Lk5Pg3Qw6Vb2Nx/ProdUser2024#$prod_user_pass/g" .env.prod
    sed -i "s/ProdChatbot2024#Df1Gj5Hm8Nb7Vx3Zc9Kw2Qt6Yr4Eu/ProdChatbot2024#$prod_chatbot_pass/g" .env.prod
    sed -i "s/ProdImageGen2024#Xk3Mp8Wq5Rt7Yu2Io9Ap6Sd1Fg4Hj/ProdImageGen2024#$prod_imagegen_pass/g" .env.prod
    sed -i "s/ProdResource2024#Vs7Fh4Jm9Kn1Lp8Qz3Xc6Vb2Nt5Gr/ProdResource2024#$prod_resource_pass/g" .env.prod
    sed -i "s/ProdClassifier2024#Z2Xc5Vb8Nm6Kh9Jg1Tp4Yr7Ew3Qu/ProdClassifier2024#$prod_classifier_pass/g" .env.prod
    sed -i "s/ProdAnalysis2024#Tl9Yu4Io8Pa3Sd6Fg1Hj5Km2Zx7Cv/ProdAnalysis2024#$prod_analysis_pass/g" .env.prod
    sed -i "s/ProdRag2024#Hj6Km2Lz1Xc8Vb3Nm9Qw5Er7Ty4Ui/ProdRag2024#$prod_rag_pass/g" .env.prod
    sed -i "s/ProdLearning2024#Qw8Er5Ty2Ui9Op3As6Df1Gh4Jk7Zx/ProdLearning2024#$prod_learning_pass/g" .env.prod
    sed -i "s/ProdRabbitMQ2024#Sd9Fg2Hj5Kl8Zx1Cv4Vb7Nm0Qt3Wr/ProdRabbitMQ2024#$prod_rabbitmq_pass/g" .env.prod
    sed -i "s/prod-ultra-secure-key-n8m2k5j9h6g3f0d1s4a7p0q9w8e5r2t7y4u1i6o3p9a8s5d2f7g0h3j6k9l2z5x8c1v4b/$prod_django_secret/g" .env.prod
    
    # Aggiorna anche Celery URL in production
    sed -i "s/ProdRabbitMQ2024#Sd9Fg2Hj5Kl8Zx1Cv4Vb7Nm0Qt3Wr/ProdRabbitMQ2024#$prod_rabbitmq_pass/g" .env.prod
    
    log_success "Generated unique secure passwords for both environments"
}

# Setup directories secrets
setup_secrets_directories() {
    log_info "Creating secrets directories..."
    
    mkdir -p .secrets/dev
    mkdir -p .secrets/prod
    
    # Imposta permessi sicuri
    chmod 700 .secrets
    chmod 700 .secrets/dev
    chmod 700 .secrets/prod
    
    log_success "Created secrets directories with secure permissions"
}

# Crea file secrets template
create_secrets_templates() {
    log_info "Creating secrets template files..."
    
    # Development secrets
    cat > .secrets/dev/openai_api_key.txt << 'EOF'
# Inserisci qui la tua chiave OpenAI per sviluppo
# Esempio: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

    cat > .secrets/dev/anthropic_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Anthropic per sviluppo
# Esempio: sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

    cat > .secrets/dev/gemini_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Gemini per sviluppo
# Esempio: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

    cat > .secrets/dev/stability_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Stability AI per sviluppo
# Esempio: sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

    # Production secrets
    cat > .secrets/prod/openai_api_key.txt << 'EOF'
# Inserisci qui la tua chiave OpenAI per produzione
# Esempio: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

    cat > .secrets/prod/anthropic_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Anthropic per produzione
# Esempio: sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

    cat > .secrets/prod/gemini_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Gemini per produzione
# Esempio: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

    cat > .secrets/prod/stability_api_key.txt << 'EOF'
# Inserisci qui la tua chiave Stability AI per produzione
# Esempio: sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

    # Imposta permessi
    chmod 600 .secrets/dev/*.txt
    chmod 600 .secrets/prod/*.txt
    
    log_success "Created secrets template files"
}

# Mostra riepilogo
show_summary() {
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo -e "║                    SETUP COMPLETATO!                        ║"
    echo -e "╚══════════════════════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${YELLOW}File creati:${NC}"
    echo -e "✅ .env.dev - Configurazione ambiente sviluppo"
    echo -e "✅ .env.prod - Configurazione ambiente produzione"
    echo -e "✅ .secrets/dev/ - Directory secrets sviluppo"
    echo -e "✅ .secrets/prod/ - Directory secrets produzione"
    
    echo -e "\n${YELLOW}PROSSIMI PASSI:${NC}"
    echo -e "1. 🔑 Modifica i file secrets con le tue API keys:"
    echo -e "   nano .secrets/dev/openai_api_key.txt"
    echo -e "   nano .secrets/prod/openai_api_key.txt"
    echo -e "   # Ripeti per tutte le API keys..."
    
    echo -e "\n2. ⚙️ Personalizza ulteriormente i file .env se necessario:"
    echo -e "   nano .env.dev"
    echo -e "   nano .env.prod"
    
    echo -e "\n3. 🌐 Configura i record DNS su IONOS"
    echo -e "   A    @     [IP_SERVER]"
    echo -e "   A    www   [IP_SERVER]"
    echo -e "   A    dev   [IP_SERVER]"
    
    echo -e "\n4. 🔐 Configura SSL:"
    echo -e "   ./ssl-setup.sh dev --staging  # Test"
    echo -e "   ./ssl-setup.sh prod"
    
    echo -e "\n5. 🚀 Deploy:"
    echo -e "   ./deploy.sh dev up --build"
    echo -e "   ./deploy.sh prod up --build"
    
    echo -e "\n${GREEN}Il tuo ambiente è pronto per essere configurato!${NC}"
}

# Menu interattivo
interactive_setup() {
    echo -e "${BLUE}Vuoi procedere con la configurazione automatica?${NC}"
    echo "1. ✅ Sì, configura tutto automaticamente"
    echo "2. 🔧 Sì, ma fammi personalizzare alcuni valori"
    echo "3. ❌ No, esco"
    
    read -p "Scelta: " choice
    
    case $choice in
        1)
            return 0
            ;;
        2)
            echo -e "\n${YELLOW}Configurazione personalizzata:${NC}"
            read -p "Inserisci il tuo dominio principale (default: pl-ai.it): " main_domain
            read -p "Inserisci il tuo dominio di sviluppo (default: dev.pl-ai.it): " dev_domain
            read -p "Inserisci la tua email per SSL (default: admin@pl-ai.it): " ssl_email
            
            # Aggiorna domini se specificati
            if [[ -n "$main_domain" && "$main_domain" != "pl-ai.it" ]]; then
                sed -i "s/pl-ai.it/$main_domain/g" .env.prod
            fi
            
            if [[ -n "$dev_domain" && "$dev_domain" != "dev.pl-ai.it" ]]; then
                sed -i "s/dev.pl-ai.it/$dev_domain/g" .env.dev
            fi
            
            if [[ -n "$ssl_email" && "$ssl_email" != "admin@pl-ai.it" ]]; then
                sed -i "s/admin@pl-ai.it/$ssl_email/g" .env.dev .env.prod
            fi
            
            return 0
            ;;
        3)
            log_info "Setup annullato dall'utente"
            exit 0
            ;;
        *)
            log_error "Scelta non valida"
            interactive_setup
            ;;
    esac
}

# Funzione principale
main() {
    # Verifica prerequisiti
    check_prerequisites
    
    # Menu interattivo
    interactive_setup
    
    # Setup file environment
    setup_env_files
    
    # Genera password personalizzate
    customize_passwords
    
    # Setup directories secrets
    setup_secrets_directories
    
    # Crea template secrets
    create_secrets_templates
    
    # Mostra riepilogo
    show_summary
}

# Esegui main
main "$@" 