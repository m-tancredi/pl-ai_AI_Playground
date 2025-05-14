# chat_api/tasks.py
from celery import shared_task
# from django.conf import settings
# from .models import ...

# Esempio (non usato attivamente per ora, ma per struttura)
# @shared_task
# def example_chatbot_task(some_arg):
#     print(f"Received chatbot task with arg: {some_arg}")
#     # Logica asincrona futura
#     return "Task completed"