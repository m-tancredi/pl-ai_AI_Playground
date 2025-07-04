#!/bin/bash

# Funzione per aspettare che il database sia pronto
wait_for_db() {
    echo "Aspettando che il database sia pronto..."
    while ! python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_config.settings')
django.setup()
from django.db import connection
try:
    connection.ensure_connection()
    print('Database connesso')
except Exception as e:
    print(f'Database non pronto: {e}')
    exit(1)
" > /dev/null 2>&1; do
        echo "Database non ancora pronto, aspetto 2 secondi..."
        sleep 2
    done
    echo "Database pronto!"
}

# Funzione per aspettare RabbitMQ
wait_for_rabbitmq() {
    echo "Aspettando RabbitMQ..."
    while ! python -c "
import pika
import os
# Usa le credenziali dalle variabili d'ambiente
rabbitmq_user = os.environ.get('RABBITMQ_USER', 'guest')
rabbitmq_password = os.environ.get('RABBITMQ_PASSWORD', 'guest')
rabbitmq_host = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
rabbitmq_port = int(os.environ.get('RABBITMQ_PORT', '5672'))

credentials = pika.PlainCredentials(rabbitmq_user, rabbitmq_password)
connection_params = pika.ConnectionParameters(
    host=rabbitmq_host,
    port=rabbitmq_port,
    credentials=credentials
)
pika.BlockingConnection(connection_params)
" > /dev/null 2>&1; do
        echo "RabbitMQ non ancora pronto, aspetto 2 secondi..."
        sleep 2
    done
    echo "RabbitMQ pronto!"
}

# Determina il tipo di processo e avvia il servizio appropriato
if [ "$SERVICE_PROCESS_TYPE" = "worker" ]; then
    echo "Avviando Celery worker per RAG..."
    # Per i worker, aspetta solo RabbitMQ
    wait_for_rabbitmq
    
    # Scarica il modello Sentence Transformers se necessario
    echo "Verificando modello Sentence Transformers..."
    python -c "
from sentence_transformers import SentenceTransformer
import os
model_name = os.environ.get('SENTENCE_TRANSFORMER_MODEL_NAME', 'all-MiniLM-L6-v2')
print(f'Caricando modello: {model_name}')
SentenceTransformer(model_name)
print('Modello caricato con successo!')
"
    
    exec celery -A service_config worker --loglevel=INFO -Q rag_tasks -c 1
else
    echo "Avviando il servizio RAG web..."
    
    # Per il web server, aspetta tutti i servizi
    wait_for_db
    wait_for_rabbitmq

    # Esegui le migrazioni
    echo "Eseguendo le migrazioni..."
    python manage.py makemigrations
    python manage.py migrate

    # Scarica il modello Sentence Transformers se necessario
    echo "Verificando modello Sentence Transformers..."
    python -c "
from sentence_transformers import SentenceTransformer
import os
model_name = os.environ.get('SENTENCE_TRANSFORMER_MODEL_NAME', 'all-MiniLM-L6-v2')
print(f'Caricando modello: {model_name}')
SentenceTransformer(model_name)
print('Modello caricato con successo!')
"
    
    # Se non ci sono argomenti, usa il comando di default per il web server
    if [ $# -eq 0 ]; then
        exec gunicorn --bind 0.0.0.0:8000 service_config.wsgi:application
    else
        exec "$@"
    fi
fi 