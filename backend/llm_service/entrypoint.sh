#!/bin/sh

# Applica eventuali migration (anche se non usiamo DB, Django lo richiede)
python manage.py migrate --noinput

# Avvia Gunicorn
exec gunicorn service_config.wsgi:application \
    --bind 0.0.0.0:8003 \
    --workers 2 \
    --timeout 120 