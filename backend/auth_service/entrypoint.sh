#!/bin/sh

set -e # Exit immediately if a command exits with a non-zero status.

# Attendere che il database PostgreSQL sia disponibile
# Estrae host e porta da DATABASE_URL (assumendo formato postgres://user:pass@host:port/db)
DB_URI=$(echo $DATABASE_URL | cut -d'/' -f3) # user:pass@host:port
DB_HOST=$(echo $DB_URI | cut -d'@' -f2 | cut -d':' -f1) # host (service name)
DB_PORT=$(echo $DB_URI | cut -d':' -f3) # port

echo "Waiting for database at $DB_HOST:$DB_PORT..."

# Usa netcat (nc) per verificare la connessione. Richiede 'netcat-openbsd' o simile installato.
# Aggiungi 'netcat-openbsd' a Dockerfile se non già presente
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1 # wait for 1 second before check again
done

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