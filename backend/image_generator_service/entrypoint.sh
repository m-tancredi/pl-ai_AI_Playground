#!/bin/sh

set -e # Exit immediately if a command exits with a non-zero status.

# --- NESSUNA attesa DB necessaria qui (inizialmente) ---
# echo "Waiting for DB..."
# while ! nc -z $DB_HOST $DB_PORT; do sleep 1; done
# echo "DB is up!"

# --- NESSUNA migrazione DB necessaria qui (inizialmente) ---
# echo "Applying database migrations..."
# python manage.py migrate --noinput

# Verifica esistenza secrets (opzionale ma utile per debug)
echo "Checking for secrets..."
if [ -f "/run/secrets/openai_api_key_secret" ]; then
  echo "OpenAI secret found."
else
  echo "Warning: OpenAI secret NOT found at /run/secrets/openai_api_key_secret"
fi
if [ -f "/run/secrets/stability_api_key_secret" ]; then
  echo "Stability AI secret found."
else
  echo "Warning: Stability AI secret NOT found at /run/secrets/stability_api_key_secret"
fi

# Avvia il server
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8002..."
    # Gestisce anche file media se DEBUG=True e le URL sono configurate
    python manage.py runserver 0.0.0.0:8002
else
    echo "Starting Gunicorn production server on port 8002..."
    # Gunicorn non serve file media di default, Nginx deve farlo
    gunicorn service_config.wsgi:application --bind 0.0.0.0:8002 --workers 4
fi