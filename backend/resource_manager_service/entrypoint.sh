#!/bin/sh

# Versione semplificata: Avvia solo il web server.
# Il worker Celery verrà avviato da un container separato.

set -e

echo "Resource Manager Service Entrypoint (Web Process)"

# --- Attendere DB ---
echo "Waiting for Resource DB at $RESOURCE_DB_HOST:$RESOURCE_DB_PORT..."
while ! nc -z $RESOURCE_DB_HOST $RESOURCE_DB_PORT; do sleep 1; done
echo "Resource DB is up!"

# --- Attendere Broker (solo se il web server ne ha bisogno all'avvio) ---
# Di solito non è strettamente necessario per il web server attendere il broker
# a meno che non faccia operazioni sincrone con Celery all'avvio (raro).
# BROKER_URI=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1)
# BROKER_HOST=$(echo $BROKER_URI | cut -d':' -f1)
# BROKER_PORT=$(echo $BROKER_URI | cut -d':' -f2); if [ -z "$BROKER_PORT" ]; then BROKER_PORT=5672; fi
# echo "Waiting for Broker at $BROKER_HOST:$BROKER_PORT..."
# while ! nc -z $BROKER_HOST $BROKER_PORT; do sleep 1; done
# echo "Broker is up!"

# --- Applica Migrazioni DB (solo il web server lo fa) ---
echo "Applying database migrations..."
python manage.py migrate --noinput

# --- Avvio Web Server ---
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8003..."
    # Esegui in foreground, questo sarà l'unico processo principale
    exec python manage.py runserver 0.0.0.0:8003
else
    echo "Starting Gunicorn production server on port 8003..."
    # Esegui in foreground
    exec gunicorn service_config.wsgi:application --bind 0.0.0.0:8003 --workers 4
fi

echo "Web server process exited." # Non dovrebbe arrivare qui con exec