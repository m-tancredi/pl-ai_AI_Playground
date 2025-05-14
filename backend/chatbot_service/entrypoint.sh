#!/bin/sh
set -e
echo "Chatbot Service Entrypoint"

# Wait for DB
echo "Waiting for Chatbot DB at $CHATBOT_DB_HOST:$CHATBOT_DB_PORT..."
while ! nc -z $CHATBOT_DB_HOST $CHATBOT_DB_PORT; do sleep 1; done
echo "Chatbot DB is up!"

# Wait for Broker (se Celery è usato attivamente)
# BROKER_HOST=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1 | cut -d':' -f1)
# BROKER_PORT=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1 | cut -d':' -f2)
# if [ -z "$BROKER_PORT" ]; then BROKER_PORT=5672; fi
# echo "Waiting for Broker at $BROKER_HOST:$BROKER_PORT..."
# while ! nc -z $BROKER_HOST $BROKER_PORT; do sleep 1; done
# echo "Broker is up!"

# Check for API Key Secrets
OPENAI_SECRET_PATH="/run/secrets/openai_api_key_secret"
ANTHROPIC_SECRET_PATH="/run/secrets/anthropic_api_key_secret"
GEMINI_SECRET_PATH="/run/secrets/gemini_api_key_secret"

if [ -f "$OPENAI_SECRET_PATH" ]; then echo "OpenAI secret found."; else echo "Warning: OpenAI secret NOT found at $OPENAI_SECRET_PATH"; fi
if [ -f "$ANTHROPIC_SECRET_PATH" ]; then echo "Anthropic secret found."; else echo "Warning: Anthropic secret NOT found at $ANTHROPIC_SECRET_PATH"; fi
if [ -f "$GEMINI_SECRET_PATH" ]; then echo "Gemini secret found."; else echo "Warning: Gemini secret NOT found at $GEMINI_SECRET_PATH"; fi


echo "Applying database migrations..."
python manage.py migrate --noinput

PROCESS_TYPE=${SERVICE_PROCESS_TYPE:-web} # Default to web, worker can be separate
echo "Starting process type: $PROCESS_TYPE"
WEBPID=""
# WORKERPID="" # Se si avvia worker qui

if [ "$PROCESS_TYPE" = "web" ] || [ "$PROCESS_TYPE" = "all" ]; then
  if [ "$DJANGO_DEBUG" = "True" ]; then
      echo "Starting Django development server on port 8006..."
      python manage.py runserver 0.0.0.0:8006 & WEBPID=$!
  else
      echo "Starting Gunicorn production server on port 8006..."
      gunicorn service_config.wsgi:application --bind 0.0.0.0:8006 --workers ${GUNICORN_WORKERS:-2} & WEBPID=$!
  fi
fi

# Se si vuole avviare un worker Celery da questo container (sconsigliato per prod)
# if [ "$PROCESS_TYPE" = "worker" ] || [ "$PROCESS_TYPE" = "all" ]; then
#   echo "Starting Celery worker for chatbot_service..."
#   celery -A service_config worker --loglevel=INFO -Q chatbot_tasks & WORKERPID=$!
# fi

# Wait logic (semplificata se solo web)
if [ -n "$WEBPID" ]; then
    wait $WEBPID
    EXIT_CODE=$?
    echo "Web server process (PID $WEBPID) exited with code $EXIT_CODE."
    exit $EXIT_CODE
# elif [ -n "$WORKERPID" ]; then # Se si avvia worker qui
#    wait $WORKERPID
#    EXIT_CODE=$?
#    echo "Celery worker process (PID $WORKERPID) exited with code $EXIT_CODE."
#    exit $EXIT_CODE
fi

echo "Entrypoint finished or no main process to wait for."