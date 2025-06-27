#!/bin/sh
set -e
echo "Data Analysis Service Entrypoint"

# Wait for DB
echo "Waiting for Analysis DB at $ANALYSIS_DB_HOST:$ANALYSIS_DB_PORT..."
while ! nc -z $ANALYSIS_DB_HOST $ANALYSIS_DB_PORT; do sleep 1; done
echo "Analysis DB is up!"

# Wait for Broker
BROKER_HOST=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1 | cut -d':' -f1)
BROKER_PORT=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1 | cut -d':' -f2)
if [ -z "$BROKER_PORT" ]; then BROKER_PORT=5672; fi
echo "Waiting for Broker at $BROKER_HOST:$BROKER_PORT..."
while ! nc -z $BROKER_HOST $BROKER_PORT; do sleep 1; done
echo "Broker is up!"

# Check for OpenAI Secret (se usata in questo servizio, altrimenti rimuovere)
SECRET_PATH="/run/secrets/openai_api_key_secret"
if [ -f "$SECRET_PATH" ]; then
  echo "OpenAI secret found."
else
  echo "Warning: OpenAI secret NOT found at $SECRET_PATH"
fi


echo "Applying database migrations..."
python manage.py migrate --noinput

PROCESS_TYPE=${SERVICE_PROCESS_TYPE:-all}
echo "Starting process type: $PROCESS_TYPE"
WEBPID=""
WORKERPID=""

if [ "$PROCESS_TYPE" = "web" ] || [ "$PROCESS_TYPE" = "all" ]; then
  if [ "$DJANGO_DEBUG" = "True" ]; then
              echo "Starting Django development server on port 8000..."
              python manage.py runserver 0.0.0.0:8000 & WEBPID=$!
  else
              echo "Starting Gunicorn production server on port 8000..."
              gunicorn service_config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-2} & WEBPID=$!
  fi
fi

if [ "$PROCESS_TYPE" = "worker" ] || [ "$PROCESS_TYPE" = "all" ]; then
  echo "Starting Celery worker for data_analysis_service..."
  celery -A service_config worker --loglevel=INFO -Q analysis_tasks -c 1 & WORKERPID=$! # Usa coda dedicata
fi

# Wait logic (semplificata, per produzione usare supervisor o container separati)
if [ "$PROCESS_TYPE" = "web" ]; then wait $WEBPID;
elif [ "$PROCESS_TYPE" = "worker" ]; then wait $WORKERPID;
elif [ "$PROCESS_TYPE" = "all" ]; then wait -n $WEBPID $WORKERPID; fi
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE. Terminating container."
kill -TERM $WEBPID $WORKERPID 2>/dev/null || true
exit $EXIT_CODE