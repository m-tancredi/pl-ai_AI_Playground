#!/bin/sh

# User Service Entrypoint
set -e

echo "User Service Entrypoint"

# --- Attendere DB ---
echo "Waiting for User DB at $USER_DB_HOST:$USER_DB_PORT..."
while ! nc -z $USER_DB_HOST $USER_DB_PORT; do sleep 1; done
echo "User DB is up!"

# --- Applica Migrazioni DB ---
echo "Applying database migrations..."
python manage.py migrate --noinput

# --- Crea superuser se necessario (opzionale) ---
# python manage.py createsuperuser --noinput || true

# --- Avvio Web Server ---
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8000..."
    # Esegui in foreground, questo sarà l'unico processo principale
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "Starting Gunicorn production server on port 8000..."
    # Esegui in foreground
    exec gunicorn service_config.wsgi:application --bind 0.0.0.0:8000 --workers 4
fi

echo "Web server process exited." # Non dovrebbe arrivare qui con exec 