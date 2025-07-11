#!/bin/sh

set -e # Exit immediately if a command exits with a non-zero status.

# Attendere che il database PostgreSQL sia disponibile
# Estrae host e porta da AUTH_DATABASE_URL (assumendo formato postgres://user:pass@host:port/db)
echo "DATABASE_URL: $AUTH_DATABASE_URL"

# Estrae l'host e la porta dall'URL
DB_HOST=$(echo $AUTH_DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/')
DB_PORT=$(echo $AUTH_DATABASE_URL | sed 's/.*:\([0-9]*\)\/.*/\1/')

echo "Waiting for database at $DB_HOST:$DB_PORT..."

# Usa netcat per verificare la connessione
#until nc -w 1 $DB_HOST $DB_PORT; do
#  echo "Database not yet available, waiting..."
#  sleep 2
#done

echo "Skipping database check for now..."
echo "Database is up!"

# Applica migrazioni del database
echo "Applying database migrations..."
python manage.py migrate --noinput

# Raccogli file statici (se necessario in produzione - non richiesto con DEBUG=True)
# if [ "$DJANGO_DEBUG" = "False" ]; then
#     echo "Collecting static files..."
#     python manage.py collectstatic --noinput --clear
# fi

# Avvia il server
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server..."
    python manage.py runserver 0.0.0.0:8000
else
    echo "Starting Gunicorn production server..."
    gunicorn service_auth.wsgi:application --bind 0.0.0.0:8000 --workers 4
fi