#!/bin/sh
# Versione semplificata senza attesa DB o migrazioni

set -e

echo "Regression Service Entrypoint"

# Non c'è più bisogno di attendere il DB per questo servizio

# Avvia il server
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8001..."
    exec python manage.py runserver 0.0.0.0:8001
else
    echo "Starting Gunicorn production server on port 8001..."
    exec gunicorn regression_project.wsgi:application --bind 0.0.0.0:8001 --workers 4
fi