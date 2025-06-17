"""
Modelli per il RAG service.
"""
import os
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from pathlib import Path

class RAGDocument(models.Model):
    """
    Modello per rappresentare un documento nella knowledge base RAG.
    """
    
    # Stati del processamento
    STATUS_CHOICES = [
        ('uploaded', 'Caricato'),
        ('processing', 'In elaborazione'),
        ('processed', 'Elaborato'),
        ('failed', 'Fallito'),
    ]
    
    # Utente proprietario (opzionale per autenticazione) - usa IntegerField per compatibilità con auth service
    user_id = models.IntegerField(null=True, blank=True)
    
    # Informazioni del file
    filename = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()  # Dimensione in bytes
    file_type = models.CharField(max_length=100)  # MIME type
    
    # Contenuto estratto
    extracted_text = models.TextField(blank=True)
    text_length = models.IntegerField(default=0)
    
    # Metadati elaborazione
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploaded')
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(blank=True)
    
    # Statistiche embedding
    num_chunks = models.IntegerField(default=0)
    embeddings_created = models.BooleanField(default=False)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.original_filename} ({self.status})"
    
    @property
    def file_size_mb(self):
        """Dimensione del file in MB."""
        return round(self.file_size / (1024 * 1024), 2)
    
    @property
    def processing_duration(self):
        """Durata del processamento."""
        if self.processing_started_at and self.processing_completed_at:
            return self.processing_completed_at - self.processing_started_at
        return None
    
    def delete_file(self):
        """Elimina il file fisico dal disco."""
        try:
            if self.file_path and os.path.exists(self.file_path):
                os.remove(self.file_path)
        except Exception:
            pass  # Ignora errori nella cancellazione del file
    
    def delete(self, *args, **kwargs):
        """Override del metodo delete per rimuovere anche il file."""
        self.delete_file()
        
        # Elimina anche gli embeddings
        from .utils.embedding_utils import get_embedding_manager
        try:
            embedding_manager = get_embedding_manager()
            embedding_manager.delete_embeddings(self.id)
        except Exception:
            pass  # Ignora errori nella cancellazione degli embeddings
        
        super().delete(*args, **kwargs)

class RAGChunk(models.Model):
    """
    Modello per rappresentare un chunk di testo estratto da un documento.
    """
    
    # Riferimento al documento
    document = models.ForeignKey(RAGDocument, on_delete=models.CASCADE, related_name='chunks')
    
    # Contenuto del chunk
    text = models.TextField()
    chunk_index = models.IntegerField()  # Indice del chunk nel documento
    
    # Metadati del chunk
    start_position = models.IntegerField(default=0)  # Posizione di inizio nel testo originale
    end_position = models.IntegerField(default=0)    # Posizione di fine nel testo originale
    text_length = models.IntegerField()
    
    # Informazioni embedding
    embedding_created = models.BooleanField(default=False)
    embedding_dimension = models.IntegerField(null=True, blank=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['document', 'chunk_index']
        indexes = [
            models.Index(fields=['document', 'chunk_index']),
            models.Index(fields=['document', 'embedding_created']),
        ]
        unique_together = ['document', 'chunk_index']
    
    def __str__(self):
        return f"Chunk {self.chunk_index} di {self.document.filename}"
    
    @property
    def text_preview(self):
        """Anteprima del testo (primi 100 caratteri)."""
        if len(self.text) > 100:
            return self.text[:100] + "..."
        return self.text

class RAGProcessingLog(models.Model):
    """
    Modello per i log del processamento RAG.
    """
    
    LOG_LEVEL_CHOICES = [
        ('debug', 'Debug'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    
    # Riferimento al documento (opzionale)
    document = models.ForeignKey(RAGDocument, on_delete=models.CASCADE, null=True, blank=True, related_name='logs')
    
    # Informazioni del log
    level = models.CharField(max_length=10, choices=LOG_LEVEL_CHOICES)
    message = models.TextField()
    step = models.CharField(max_length=100, blank=True)  # es: 'text_extraction', 'embedding_creation'
    
    # Dati aggiuntivi (JSON serialized)
    extra_data = models.JSONField(default=dict, blank=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['document', 'level']),
            models.Index(fields=['level', 'created_at']),
        ]
    
    def __str__(self):
        doc_info = f" - {self.document.filename}" if self.document else ""
        return f"{self.level.upper()}: {self.message[:50]}...{doc_info}"

class RAGKnowledgeBase(models.Model):
    """
    Modello per gestire le knowledge base (collezioni di documenti).
    """
    
    # Proprietario - usa IntegerField per compatibilità con auth service
    user_id = models.IntegerField(null=True, blank=True)
    
    # Informazioni di base
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Documenti nella knowledge base
    documents = models.ManyToManyField(RAGDocument, blank=True)
    
    # Configurazioni
    chunk_size = models.IntegerField(default=1000)
    chunk_overlap = models.IntegerField(default=200)
    embedding_model = models.CharField(max_length=100, default='all-MiniLM-L6-v2')
    
    # Statistiche
    total_documents = models.IntegerField(default=0)
    total_chunks = models.IntegerField(default=0)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
        ]
    
    def __str__(self):
        return self.name
    
    def update_statistics(self):
        """Aggiorna le statistiche della knowledge base."""
        self.total_documents = self.documents.count()
        self.total_chunks = sum(doc.num_chunks for doc in self.documents.all())
        self.save(update_fields=['total_documents', 'total_chunks', 'updated_at'])
    
    @property
    def processed_documents_count(self):
        """Numero di documenti processati."""
        return self.documents.filter(status='processed').count()
    
    @property
    def processing_documents_count(self):
        """Numero di documenti in elaborazione."""
        return self.documents.filter(status='processing').count()
    
    @property
    def failed_documents_count(self):
        """Numero di documenti falliti."""
        return self.documents.filter(status='failed').count()


class RAGChatSession(models.Model):
    """
    Modello per rappresentare una sessione di chat RAG.
    """
    
    # Proprietario - usa IntegerField per compatibilità con auth service
    user_id = models.IntegerField()
    
    # Knowledge Base associata (None per chat globale)
    knowledge_base = models.ForeignKey(RAGKnowledgeBase, on_delete=models.CASCADE, null=True, blank=True)
    
    # Informazioni sessione
    title = models.CharField(max_length=200, blank=True)  # Titolo generato automaticamente
    mode = models.CharField(max_length=50, default='global')  # 'global' o 'kb-{id}'
    
    # Statistiche
    message_count = models.IntegerField(default=0)
    last_activity = models.DateTimeField(auto_now=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-last_activity']
        indexes = [
            models.Index(fields=['user_id', 'knowledge_base']),
            models.Index(fields=['user_id', 'mode']),
            models.Index(fields=['last_activity']),
        ]
    
    def __str__(self):
        kb_info = f" - {self.knowledge_base.name}" if self.knowledge_base else " - Globale"
        return f"Chat {self.id}{kb_info} ({self.message_count} messaggi)"
    
    def generate_title(self):
        """Genera un titolo automatico basato sui primi messaggi."""
        first_user_message = self.messages.filter(is_user=True).first()
        if first_user_message and first_user_message.content:
            # Prendi le prime 50 caratteri del primo messaggio utente
            title = first_user_message.content[:50]
            if len(first_user_message.content) > 50:
                title += "..."
            self.title = title
            self.save()
        return self.title


class RAGChatMessage(models.Model):
    """
    Modello per rappresentare un singolo messaggio in una chat RAG.
    """
    
    # Sessione di appartenenza
    session = models.ForeignKey(RAGChatSession, on_delete=models.CASCADE, related_name='messages')
    
    # Contenuto del messaggio
    content = models.TextField()
    is_user = models.BooleanField()  # True se messaggio utente, False se AI
    
    # Metadati per messaggi AI
    sources = models.JSONField(default=list, blank=True)  # Fonti utilizzate per la risposta
    processing_time = models.FloatField(null=True, blank=True)  # Tempo di elaborazione in secondi
    model_used = models.CharField(max_length=100, blank=True)  # Modello AI utilizzato
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
            models.Index(fields=['session', 'is_user']),
        ]
    
    def __str__(self):
        sender = "Utente" if self.is_user else "AI"
        preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"{sender}: {preview}"