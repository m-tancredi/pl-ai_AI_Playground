"""
Configurazione Django Admin per i modelli RAG.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import RAGDocument, RAGChunk, RAGProcessingLog, RAGKnowledgeBase, RAGChatSession, RAGChatMessage

@admin.register(RAGDocument)
class RAGDocumentAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGDocument.
    """
    list_display = [
        'id', 'original_filename', 'status_colored', 'file_size_mb',
        'num_chunks', 'embeddings_created', 'username', 'created_at'
    ]
    list_filter = ['status', 'embeddings_created', 'file_type', 'created_at']
    search_fields = ['original_filename', 'filename', 'user__username']
    readonly_fields = [
        'filename', 'file_size', 'file_type', 'text_length', 
        'processing_started_at', 'processing_completed_at', 'created_at', 'updated_at',
        'processing_duration_display', 'file_link'
    ]
    
    fieldsets = (
        ('Informazioni File', {
            'fields': ('original_filename', 'filename', 'file_link', 'file_size', 'file_type')
        }),
        ('Contenuto', {
            'fields': ('text_length', 'num_chunks', 'embeddings_created')
        }),
        ('Processamento', {
            'fields': ('status', 'processing_started_at', 'processing_completed_at', 
                      'processing_duration_display', 'processing_error')
        }),
        ('Metadati', {
            'fields': ('user', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def status_colored(self, obj):
        """Restituisce lo stato con colore."""
        colors = {
            'uploaded': 'blue',
            'processing': 'orange', 
            'processed': 'green',
            'failed': 'red'
        }
        color = colors.get(obj.status, 'black')
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            obj.get_status_display()
        )
    status_colored.short_description = 'Status'
    
    def username(self, obj):
        """Restituisce il nome utente."""
        return obj.user.username if obj.user else 'Anonimo'
    username.short_description = 'Utente'
    
    def processing_duration_display(self, obj):
        """Mostra la durata del processamento."""
        duration = obj.processing_duration
        if duration:
            return f"{duration.total_seconds():.2f} secondi"
        return "N/A"
    processing_duration_display.short_description = 'Durata processamento'
    
    def file_link(self, obj):
        """Link al file se esiste."""
        if obj.file_path:
            return format_html('<a href="#" onclick="alert(\'{}\')">📁 Mostra percorso</a>', obj.file_path)
        return "N/A"
    file_link.short_description = 'File'
    
    actions = ['reprocess_documents', 'delete_with_files']
    
    def reprocess_documents(self, request, queryset):
        """Azione per riprocessare documenti selezionati."""
        from .tasks import reprocess_document_task
        
        count = 0
        for document in queryset:
            reprocess_document_task.delay(document.id, force=True)
            count += 1
        
        self.message_user(request, f'{count} documenti inviati per riprocessamento.')
    reprocess_documents.short_description = 'Riprocessa documenti selezionati'
    
    def delete_with_files(self, request, queryset):
        """Elimina i documenti selezionati con i loro file."""
        count = queryset.count()
        for document in queryset:
            document.delete()  # Questo eliminerà anche i file
        
        self.message_user(request, f'{count} documenti eliminati con i relativi file.')
    delete_with_files.short_description = 'Elimina documenti e file'

@admin.register(RAGChunk)
class RAGChunkAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGChunk.
    """
    list_display = [
        'id', 'document_link', 'chunk_index', 'text_preview', 
        'text_length', 'embedding_created', 'created_at'
    ]
    list_filter = ['embedding_created', 'created_at', 'document__status']
    search_fields = ['text', 'document__original_filename']
    readonly_fields = ['text_length', 'created_at']
    
    def document_link(self, obj):
        """Link al documento parent."""
        url = reverse('admin:rag_api_ragdocument_change', args=[obj.document.id])
        return format_html('<a href="{}">{}</a>', url, obj.document.original_filename)
    document_link.short_description = 'Documento'
    
    def get_queryset(self, request):
        """Ottimizza le query."""
        return super().get_queryset(request).select_related('document')

@admin.register(RAGProcessingLog)
class RAGProcessingLogAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGProcessingLog.
    """
    list_display = [
        'id', 'level_colored', 'message_preview', 'step', 
        'document_link', 'created_at'
    ]
    list_filter = ['level', 'step', 'created_at']
    search_fields = ['message', 'document__original_filename']
    readonly_fields = ['created_at']
    
    def level_colored(self, obj):
        """Restituisce il livello con colore."""
        colors = {
            'debug': 'gray',
            'info': 'blue',
            'warning': 'orange',
            'error': 'red'
        }
        color = colors.get(obj.level, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.level.upper()
        )
    level_colored.short_description = 'Livello'
    
    def message_preview(self, obj):
        """Anteprima del messaggio."""
        if len(obj.message) > 50:
            return obj.message[:50] + "..."
        return obj.message
    message_preview.short_description = 'Messaggio'
    
    def document_link(self, obj):
        """Link al documento se presente."""
        if obj.document:
            url = reverse('admin:rag_api_ragdocument_change', args=[obj.document.id])
            return format_html('<a href="{}">{}</a>', url, obj.document.original_filename)
        return "N/A"
    document_link.short_description = 'Documento'
    
    def get_queryset(self, request):
        """Ottimizza le query."""
        return super().get_queryset(request).select_related('document')

@admin.register(RAGKnowledgeBase)
class RAGKnowledgeBaseAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGKnowledgeBase.
    """
    list_display = [
        'id', 'name', 'total_documents', 'total_chunks', 
        'embedding_model', 'username', 'created_at'
    ]
    list_filter = ['embedding_model', 'created_at']
    search_fields = ['name', 'description', 'user__username']
    readonly_fields = ['total_documents', 'total_chunks', 'created_at', 'updated_at']
    filter_horizontal = ['documents']
    
    fieldsets = (
        ('Informazioni Generali', {
            'fields': ('name', 'description', 'user')
        }),
        ('Configurazione', {
            'fields': ('chunk_size', 'chunk_overlap', 'embedding_model')
        }),
        ('Documenti', {
            'fields': ('documents',)
        }),
        ('Statistiche', {
            'fields': ('total_documents', 'total_chunks'),
            'classes': ('collapse',)
        }),
        ('Metadati', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def username(self, obj):
        """Restituisce il nome utente."""
        return obj.user.username if obj.user else 'Anonimo'
    username.short_description = 'Utente'
    
    actions = ['update_statistics']
    
    def update_statistics(self, request, queryset):
        """Aggiorna le statistiche delle knowledge base selezionate."""
        count = 0
        for kb in queryset:
            kb.update_statistics()
            count += 1
        
        self.message_user(request, f'Statistiche aggiornate per {count} knowledge base.')
    update_statistics.short_description = 'Aggiorna statistiche'

@admin.register(RAGChatSession)
class RAGChatSessionAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGChatSession.
    """
    list_display = [
        'id', 'title_preview', 'mode', 'knowledge_base_name', 
        'message_count', 'username', 'last_activity', 'created_at'
    ]
    list_filter = ['mode', 'created_at', 'last_activity']
    search_fields = ['title', 'knowledge_base__name', 'user__username']
    readonly_fields = ['message_count', 'last_activity', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Informazioni Sessione', {
            'fields': ('title', 'mode', 'knowledge_base', 'user')
        }),
        ('Statistiche', {
            'fields': ('message_count', 'last_activity'),
            'classes': ('collapse',)
        }),
        ('Metadati', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def title_preview(self, obj):
        """Anteprima del titolo."""
        if obj.title:
            return obj.title[:50] + "..." if len(obj.title) > 50 else obj.title
        return f"Chat {obj.id}"
    title_preview.short_description = 'Titolo'
    
    def knowledge_base_name(self, obj):
        """Nome della knowledge base."""
        return obj.knowledge_base.name if obj.knowledge_base else 'Globale'
    knowledge_base_name.short_description = 'Knowledge Base'
    
    def username(self, obj):
        """Nome utente."""
        return obj.user.username if obj.user else 'Anonimo'
    username.short_description = 'Utente'
    
    actions = ['clear_messages']
    
    def clear_messages(self, request, queryset):
        """Cancella tutti i messaggi delle sessioni selezionate."""
        total_messages = 0
        for session in queryset:
            count = session.messages.count()
            session.messages.all().delete()
            session.message_count = 0
            session.title = ''
            session.save()
            total_messages += count
        
        self.message_user(request, f'{total_messages} messaggi cancellati da {queryset.count()} sessioni.')
    clear_messages.short_description = 'Cancella messaggi delle sessioni selezionate'

@admin.register(RAGChatMessage)
class RAGChatMessageAdmin(admin.ModelAdmin):
    """
    Admin per il modello RAGChatMessage.
    """
    list_display = [
        'id', 'session_link', 'sender_type', 'content_preview', 
        'processing_time', 'model_used', 'created_at'
    ]
    list_filter = ['is_user', 'model_used', 'created_at']
    search_fields = ['content', 'session__title', 'session__user__username']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Messaggio', {
            'fields': ('session', 'content', 'is_user')
        }),
        ('Metadati AI', {
            'fields': ('sources', 'processing_time', 'model_used'),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def session_link(self, obj):
        """Link alla sessione."""
        url = reverse('admin:rag_api_ragchatsession_change', args=[obj.session.id])
        title = obj.session.title or f"Chat {obj.session.id}"
        return format_html('<a href="{}">{}</a>', url, title)
    session_link.short_description = 'Sessione'
    
    def sender_type(self, obj):
        """Tipo di mittente con colore."""
        if obj.is_user:
            return format_html('<span style="color: blue; font-weight: bold;">👤 Utente</span>')
        else:
            return format_html('<span style="color: green; font-weight: bold;">🤖 AI</span>')
    sender_type.short_description = 'Mittente'
    
    def content_preview(self, obj):
        """Anteprima del contenuto."""
        preview = obj.content[:100] + "..." if len(obj.content) > 100 else obj.content
        return preview
    content_preview.short_description = 'Contenuto'
    
    def get_queryset(self, request):
        """Ottimizza le query."""
        return super().get_queryset(request).select_related('session', 'session__user', 'session__knowledge_base')

# Personalizzazione del titolo dell'admin
admin.site.site_header = "RAG Service Administration"
admin.site.site_title = "RAG Service Admin"
admin.site.index_title = "Gestione Sistema RAG" 