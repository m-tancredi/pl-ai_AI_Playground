import uuid
from django.db import models
from django.conf import settings # Per foreign key logica a User, sebbene non diretta
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class ChatbotProfile(models.Model):
    """Profilo personalizzato per un'istanza di chatbot."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.PositiveBigIntegerField(db_index=True, help_text="User ID from the auth service")
    name = models.CharField(max_length=100, default="My Chatbot")
    system_prompt = models.TextField(
        blank=True,
        default="You are a helpful AI assistant.",
        help_text="Base instructions defining the chatbot's persona and behavior."
    )
    llm_model_name = models.CharField(
        max_length=100,
        default=settings.DEFAULT_LLM_MODEL_OPENAI, # Prendi default da settings
        help_text="Specific LLM engine to use (e.g., gpt-4o-mini, claude-3-haiku, gemini-1.5-flash)."
    )
    grade_level = models.CharField(max_length=50, blank=True, null=True, help_text="E.g., 'Scuola Primaria', 'Università'")
    mode = models.CharField(max_length=50, blank=True, null=True, help_text="E.g., 'interrogazione', 'intervista', 'rag', 'general_chat'")
    subject = models.CharField(max_length=100, blank=True, null=True, help_text="E.g., 'Storia', 'Scienze'")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (Owner: {self.owner_id})"

    class Meta:
        ordering = ['-created_at']
        # Un utente può avere più profili con lo stesso nome? Per ora sì.
        # unique_together = [['owner_id', 'name']] # Se vuoi nomi unici per utente


class Conversation(models.Model):
    """Una singola sessione di chat tra un utente e un profilo chatbot."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(ChatbotProfile, related_name='conversations', on_delete=models.CASCADE)
    owner_id = models.PositiveBigIntegerField(db_index=True, help_text="User ID from the auth service, matches profile's owner")
    title = models.CharField(max_length=200, blank=True, null=True, help_text="Optional title, e.g., first user message snippet")
    
    # Per RAG: lista di ID delle risorse (dal ResourceManager) usate in questa conversazione
    active_rag_resource_ids = models.JSONField(default=list, blank=True, help_text="List of resource IDs used for RAG in this conversation")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title or f"Conversation {self.id} with {self.profile.name}"

    class Meta:
        ordering = ['-updated_at'] # Ordina per ultimo aggiornamento per mostrare le recenti
        indexes = [
            models.Index(fields=['owner_id', 'profile']),
        ]

    def save(self, *args, **kwargs):
        # Assicura coerenza owner_id con il profilo
        if self.profile and self.profile.owner_id != self.owner_id:
            # In teoria, questo non dovrebbe accadere se la logica API è corretta
            raise ValueError("Conversation owner_id must match the ChatbotProfile owner_id.")
        # Imposta titolo default se vuoto, dal primo messaggio (gestito nella view)
        super().save(*args, **kwargs)


class ChatMessage(models.Model):
    """Un singolo messaggio all'interno di una conversazione."""
    class Role(models.TextChoices):
        USER = 'user', _('User')
        ASSISTANT = 'assistant', _('Assistant')
        SYSTEM = 'system', _('System') # Raramente salvato, di solito dal profilo

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    llm_model_used = models.CharField(max_length=100, blank=True, null=True, help_text="LLM model that generated this assistant message")
    
    # Salva info token per questo specifico scambio (user prompt -> assistant response)
    token_info = models.JSONField(null=True, blank=True, help_text="Token usage: {'input': N, 'output': M, 'total': T}")
    
    timestamp = models.DateTimeField(default=timezone.now, db_index=True) # Usa default=timezone.now

    def __str__(self):
        return f"{self.role.capitalize()}: {self.content[:50]}... (Conv: {self.conversation_id})"

    class Meta:
        ordering = ['timestamp'] # Ordina messaggi cronologicamente