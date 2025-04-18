#!/bin/sh

set -e

# --- Attendere DB PostgreSQL di questo servizio ---
echo "Waiting for Image Generator DB at $IMAGE_GEN_DB_HOST:$IMAGE_GEN_DB_PORT..."
while ! nc -z $IMAGE_GEN_DB_HOST $IMAGE_GEN_DB_PORT; do
  sleep 1
done
echo "Image Generator DB is up!"

# --- Applica Migrazioni ---
echo "Applying database migrations..."
python manage.py migrate --noinput

# Verifica secrets (invariato)
echo "Checking for secrets..."
# ... (codice verifica secrets) ...

# Avvia server (invariato)
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8002..."
    python manage.py runserver 0.0.0.0:8002
else
    echo "Starting Gunicorn production server on port 8002..."
    gunicorn service_config.wsgi:application --bind 0.0.0.0:8002 --workers 4
fi