#!/bin/sh

# Attendi che il database sia pronto
if [ "$DB_HOST" != "" ]; then
  echo "Aspetto che il database sia pronto... ($DB_HOST:$DB_PORT)"
  while ! nc -z $DB_HOST $DB_PORT; do
    sleep 1
  done
  echo "Database pronto!"
fi

# Applica le migrazioni
python manage.py migrate --noinput

# Avvia il server Django
exec python manage.py runserver 0.0.0.0:8000 