#!/bin/sh

set -e # Exit immediately if a command exits with a non-zero status.

# Attendere che il database PostgreSQL di questo servizio sia disponibile
# Usa le variabili d'ambiente specifiche per questo DB
echo "Waiting for regression database at $REGRESSION_DB_HOST:$REGRESSION_DB_PORT..."

# Usa netcat (nc) per verificare la connessione.
while ! nc -z $REGRESSION_DB_HOST $REGRESSION_DB_PORT; do
  sleep 1 # wait for 1 second before check again
done

echo "Regression database is up!"

# Applica migrazioni del database
echo "Applying database migrations..."
python manage.py migrate --noinput

# Raccogli file statici (se necessario in produzione)
# if [ "$DJANGO_DEBUG" = "False" ]; then
#     echo "Collecting static files..."
#     python manage.py collectstatic --noinput --clear
# fi

# Avvia il server
if [ "$DJANGO_DEBUG" = "True" ]; then
    echo "Starting Django development server on port 8001..."
    python manage.py runserver 0.0.0.0:8001
else
    echo "Starting Gunicorn production server on port 8001..."
    gunicorn regression_project.wsgi:application --bind 0.0.0.0:8001 --workers 4
fi