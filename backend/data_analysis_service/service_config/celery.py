# service_config/celery.py
import os
from celery import Celery
# 'service_config' è il nome del modulo del progetto Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_config.settings')
app = Celery('service_config') # Il nome qui è importante per Celery
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks() # Cerca tasks.py in tutte le INSTALLED_APPS