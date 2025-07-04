#!/bin/bash

# =============================================================================
# 🚀 AI-PlayGround VPS Setup Script
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting AI-PlayGround VPS Setup..."

# =============================================================================
# VARIABLES
# =============================================================================
DOMAIN="dev.pl-ai.it"
PROJECT_DIR="/opt/pl-ai_AI-PlayGround"
NGINX_CONFIG_PATH="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED_PATH="/etc/nginx/sites-enabled/$DOMAIN"

# =============================================================================
# FUNCTIONS
# =============================================================================

check_root() {
    if [[ $EUID -eq 0 ]]; then
        echo "❌ This script should not be run as root!"
        echo "🔧 Run with a sudo-enabled user instead."
        exit 1
    fi
}

check_docker() {
    echo "🐳 Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found! Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose not found! Please install Docker Compose first."
        exit 1
    fi
    
    echo "✅ Docker found!"
}

setup_nginx_config() {
    echo "🔧 Setting up NGINX configuration..."
    
    # Copy NGINX config
    if [[ -f "nginx/dev.pl-ai.it.conf" ]]; then
        sudo cp nginx/dev.pl-ai.it.conf $NGINX_CONFIG_PATH
        echo "✅ NGINX config copied to $NGINX_CONFIG_PATH"
    else
        echo "❌ NGINX config file not found!"
        exit 1
    fi
    
    # Enable site
    if [[ ! -L $NGINX_ENABLED_PATH ]]; then
        sudo ln -s $NGINX_CONFIG_PATH $NGINX_ENABLED_PATH
        echo "✅ Site enabled"
    else
        echo "✅ Site already enabled"
    fi
    
    # Test NGINX config
    echo "🧪 Testing NGINX configuration..."
    if sudo nginx -t; then
        echo "✅ NGINX config is valid"
        sudo systemctl reload nginx
        echo "✅ NGINX reloaded"
    else
        echo "❌ NGINX config has errors!"
        exit 1
    fi
}

setup_ssl() {
    echo "🔐 Setting up SSL certificate..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    # Generate certificate
    echo "🔐 Generating SSL certificate for $DOMAIN..."
    if sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
        echo "✅ SSL certificate generated successfully!"
    else
        echo "⚠️ SSL certificate generation failed, but continuing..."
        echo "💡 You can run 'sudo certbot --nginx -d $DOMAIN' manually later"
    fi
}

start_containers() {
    echo "🐳 Starting AI-PlayGround containers..."
    
    # Check if .env.dev exists
    if [[ ! -f ".env.dev" ]]; then
        echo "❌ .env.dev file not found!"
        exit 1
    fi
    
    # Start containers
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d
    
    echo "⏳ Waiting for containers to start..."
    sleep 30
    
    # Check container status
    echo "📊 Container status:"
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev ps
}

verify_setup() {
    echo "🧪 Verifying setup..."
    
    # Check if containers are healthy
    echo "🔍 Checking container health..."
    
    # Check NGINX VPS
    if sudo systemctl is-active --quiet nginx; then
        echo "✅ NGINX VPS is running"
    else
        echo "❌ NGINX VPS is not running"
    fi
    
    # Check if port 8081 is listening
    if ss -tulpn | grep -q :8081; then
        echo "✅ AI-PlayGround is listening on port 8081"
    else
        echo "❌ AI-PlayGround is not listening on port 8081"
    fi
    
    echo "🌐 Testing connection to $DOMAIN..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 | grep -q "200\|302\|301"; then
        echo "✅ Local connection successful"
    else
        echo "⚠️ Local connection failed"
    fi
}

print_summary() {
    echo ""
    echo "🎉 Setup completed!"
    echo ""
    echo "📋 Summary:"
    echo "  🌐 Website: https://$DOMAIN"
    echo "  🐳 Container port: 8081"
    echo "  📁 Project dir: $PROJECT_DIR"
    echo ""
    echo "🔧 Useful commands:"
    echo "  📊 Check status: docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev ps"
    echo "  📋 View logs: docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev logs -f"
    echo "  🔄 Restart: docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev restart"
    echo "  🛑 Stop: docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev down"
    echo ""
    echo "🛡️ Security: Only NGINX VPS has access to external ports 80/443"
    echo "📱 Access your AI-PlayGround at: https://$DOMAIN"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    echo "🚀 AI-PlayGround VPS Setup Script"
    echo "=================================="
    
    check_root
    check_docker
    setup_nginx_config
    setup_ssl
    start_containers
    verify_setup
    print_summary
    
    echo ""
    echo "✅ All done! Your AI-PlayGround is ready! 🎉"
}

# Run main function
main "$@" 