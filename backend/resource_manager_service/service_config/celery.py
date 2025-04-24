import os
from celery import Celery
from django.conf import settings

# Imposta il modulo delle impostazioni di Django per il programma 'celery'.
# Cambia 'service_config' con il nome della cartella del tuo progetto Django.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_config.settings')

# Crea un'istanza dell'applicazione Celery
# Il primo argomento è il nome del modulo principale dove Celery è definito.
# Il secondo argomento è il nome del broker (opzionale se specificato in settings).
app = Celery('service_config')

# Usa una stringa qui significa che il worker non deve serializzare
# l'oggetto di configurazione per processi figli.
# namespace='CELERY' significa che tutte le chiavi di configurazione Celery
# dovrebbero avere un prefisso `CELERY_`. Es: CELERY_BROKER_URL
app.config_from_object('django.conf:settings', namespace='CELERY')

# Carica moduli tasks.py da tutte le app Django registrate in INSTALLED_APPS.
# Celery cercherà un file 'tasks.py' in ogni app.
app.autodiscover_tasks()

# Task di esempio (utile per testare se il worker funziona)
@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')