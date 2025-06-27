#!/bin/sh
# Uses SERVICE_PROCESS_TYPE env var to start web, worker, or all (default)
# Using separate containers (web/worker) is recommended for production

set -e

echo "Image Classifier Service Entrypoint"

# --- Wait for DB ---
echo "Waiting for Classifier DB at $CLASSIFIER_DB_HOST:$CLASSIFIER_DB_PORT..."
while ! nc -z $CLASSIFIER_DB_HOST $CLASSIFIER_DB_PORT; do sleep 1; done
echo "Classifier DB is up!"

# --- Wait for Broker (RabbitMQ) ---
BROKER_URI=$(echo $CELERY_BROKER_URL | cut -d'@' -f2 | cut -d'/' -f1)
BROKER_HOST=$(echo $BROKER_URI | cut -d':' -f1)
BROKER_PORT=$(echo $BROKER_URI | cut -d':' -f2); if [ -z "$BROKER_PORT" ]; then BROKER_PORT=5672; fi
echo "Waiting for Broker at $BROKER_HOST:$BROKER_PORT..."
while ! nc -z $BROKER_HOST $BROKER_PORT; do sleep 1; done
echo "Broker is up!"

# --- Apply DB Migrations (only needed for web usually, but safe here) ---
echo "Applying database migrations..."
python manage.py migrate --noinput

# --- Start Processes ---
PROCESS_TYPE=${SERVICE_PROCESS_TYPE:-all} # Default to starting both
echo "Starting process type: $PROCESS_TYPE"

WEBPID=""
WORKERPID=""

# Start Web Server
if [ "$PROCESS_TYPE" = "web" ] || [ "$PROCESS_TYPE" = "all" ]; then
  if [ "$DJANGO_DEBUG" = "True" ]; then
              echo "Starting Django development server on port 8000..."
              python manage.py runserver 0.0.0.0:8000 ${RUNSERVER_EXTRA_OPTIONS} & WEBPID=$!
  else
              echo "Starting Gunicorn production server on port 8000..."
              gunicorn service_config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-4} & WEBPID=$!
  fi
fi

# Start Celery Worker
if [ "$PROCESS_TYPE" = "worker" ] || [ "$PROCESS_TYPE" = "all" ]; then
  echo "Starting Celery worker..."
  # Adjust concurrency based on your needs (-c 1 might be safer for GPU tasks)
  celery -A service_config worker --loglevel=INFO -Q celery ${CELERY_EXTRA_OPTIONS} & WORKERPID=$!
fi

# --- Process Management (Basic - Supervisor/Systemd recommended for prod) ---
# Function to wait for a specific PID and handle exit
wait_for_process() {
    PID_TO_WAIT=$1
    PROCESS_NAME=$2
    if [ -z "$PID_TO_WAIT" ]; then return 0; fi # No PID to wait for

    wait $PID_TO_WAIT # Wait specifically for this PID
    EXIT_CODE=$?
    echo "$PROCESS_NAME process (PID $PID_TO_WAIT) exited with code $EXIT_CODE."

    # If running 'all' and one process fails, kill the other
    if [ "$PROCESS_TYPE" = "all" ] && [ $EXIT_CODE -ne 0 ]; then
        echo "Terminating other processes due to $PROCESS_NAME failure..."
        # Try to kill gracefully first, then force if needed after a delay
        kill -TERM $WEBPID $WORKERPID 2>/dev/null || true
        sleep 2
        kill -KILL $WEBPID $WORKERPID 2>/dev/null || true
        # Exit with the code of the failed process
        exit $EXIT_CODE
    fi
    return $EXIT_CODE
}

# Wait logic based on PROCESS_TYPE
if [ "$PROCESS_TYPE" = "web" ]; then
    wait_for_process $WEBPID "Web server"
elif [ "$PROCESS_TYPE" = "worker" ]; then
    wait_for_process $WORKERPID "Celery worker"
elif [ "$PROCESS_TYPE" = "all" ]; then
    # Wait for the first process to exit
    wait -p FIRST_EXITED_PID $WEBPID $WORKERPID
    EXIT_CODE=$?
    echo "A process (PID $FIRST_EXITED_PID) exited with code $EXIT_CODE. Terminating container."
    # Terminate remaining processes
    kill -TERM $WEBPID $WORKERPID 2>/dev/null || true
    sleep 2
    kill -KILL $WEBPID $WORKERPID 2>/dev/null || true
    exit $EXIT_CODE
fi

echo "Entrypoint finished."