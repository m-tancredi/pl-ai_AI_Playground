#!/bin/bash

# Start Learning Service Script
echo "🎓 Avvio Learning Service..."

# Set environment variables
export DJANGO_SETTINGS_MODULE=service_config.settings
export PYTHONPATH=/app:$PYTHONPATH

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo -e "${RED}❌ manage.py non trovato. Assicurati di essere nella directory del learning service${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Controllo dipendenze...${NC}"

# Install requirements if they don't exist
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

echo -e "${YELLOW}🔑 Controllo configurazione OpenAI...${NC}"

# Check OpenAI API key configuration
if [ -f "/run/secrets/openai_api_key_secret" ]; then
    echo "✅ Trovato secret OpenAI (Docker)"
elif [ ! -z "${OPENAI_API_KEY}" ]; then
    echo "✅ Trovata variabile d'ambiente OPENAI_API_KEY"
else
    echo -e "${YELLOW}⚠️ ATTENZIONE: OpenAI API key non configurata${NC}"
    echo "Per lo sviluppo locale, imposta la variabile d'ambiente:"
    echo "export OPENAI_API_KEY=sk-your-openai-key-here"
    echo ""
fi

echo -e "${YELLOW}🗄️ Controllo database...${NC}"

# Wait for database to be ready
echo "Attendo che il database sia pronto..."
python -c "
import os, time, psycopg2
from django.core.management import execute_from_command_line

def wait_for_db():
    db_ready = False
    attempts = 0
    max_attempts = 30
    
    while not db_ready and attempts < max_attempts:
        try:
            import django
            from django.conf import settings
            django.setup()
            from django.db import connection
            connection.ensure_connection()
            db_ready = True
            print('✅ Database connesso!')
        except Exception as e:
            attempts += 1
            print(f'⏳ Tentativo {attempts}/{max_attempts}: {e}')
            time.sleep(2)
    
    return db_ready

if not wait_for_db():
    print('❌ Impossibile connettersi al database')
    exit(1)
"

echo -e "${YELLOW}🔄 Applicazione migrazioni...${NC}"

# Run migrations
python manage.py makemigrations
python manage.py migrate

echo -e "${YELLOW}👤 Creazione superuser...${NC}"

# Create superuser if it doesn't exist
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('✅ Superuser creato: admin/admin123')
else:
    print('ℹ️ Superuser già esistente')
EOF

echo -e "${YELLOW}📁 Raccolta file statici...${NC}"

# Collect static files
python manage.py collectstatic --noinput

echo -e "${GREEN}🚀 Avvio del server di sviluppo...${NC}"
echo -e "${GREEN}📡 Learning Service disponibile su: http://localhost:8007${NC}"
echo -e "${GREEN}🔧 Admin panel: http://localhost:8007/admin${NC}"
echo -e "${GREEN}📚 API Docs: http://localhost:8007/api/docs${NC}"

# Start development server
python manage.py runserver 0.0.0.0:8007 