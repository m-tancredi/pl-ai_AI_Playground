from django.db import models
from decimal import Decimal

class Chat(models.Model):
    user_id = models.IntegerField(null=True, blank=True)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    chat = models.ForeignKey(Chat, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=20)  # 'user' o 'assistant'
    content = models.TextField()
    model = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatSettings(models.Model):
    chat = models.OneToOneField(Chat, related_name='settings', on_delete=models.CASCADE)
    grade = models.CharField(max_length=50, null=True, blank=True)
    mode = models.CharField(max_length=50, null=True, blank=True)
    subject = models.CharField(max_length=100, null=True, blank=True)
    model = models.CharField(max_length=100, null=True, blank=True)
    system_prompt = models.TextField(null=True, blank=True)

class ServiceUsageTracking(models.Model):
    """Modello per tracking consumi del Chatbot Service."""
    
    # Informazioni utente
    user_id = models.PositiveBigIntegerField(db_index=True)
    
    # Informazioni operazione
    operation_type = models.CharField(max_length=50, help_text="Tipo di operazione (es: 'conversation', 'system_message')")
    service_name = models.CharField(max_length=50, help_text="Nome del servizio ('chatbot')", default='chatbot')
    model_used = models.CharField(max_length=100, help_text="Modello AI utilizzato")
    
    # Input/Output
    input_data = models.TextField(blank=True, help_text="Messaggio utente o prompt")
    output_summary = models.TextField(blank=True, help_text="Inizio della risposta AI")
    
    # Metriche
    tokens_consumed = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))
    cost_eur = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))
    
    # Metadata
    success = models.BooleanField(default=True)
    response_time_ms = models.PositiveIntegerField(help_text="Tempo di risposta in millisecondi")
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'service_name']),
            models.Index(fields=['created_at']),
        ] 