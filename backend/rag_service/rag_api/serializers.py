"""
Serializers per l'API RAG.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import RAGDocument, RAGChunk, RAGProcessingLog, RAGKnowledgeBase, RAGChatSession, RAGChatMessage

class RAGDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGDocument.
    """
    
    file_size_mb = serializers.ReadOnlyField()
    processing_duration = serializers.ReadOnlyField()
    user_id = serializers.IntegerField(read_only=True)
    has_content = serializers.SerializerMethodField()
    
    class Meta:
        model = RAGDocument
        fields = [
            'id',
            'resource_id',
            'filename',
            'original_filename',
            'file_size',
            'file_size_mb',
            'file_type',
            'text_length',
            'status',
            'processing_started_at',
            'processing_completed_at',
            'processing_duration',
            'processing_error',
            'num_chunks',
            'embeddings_created',
            'has_content',
            'user_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'resource_id',
            'filename',
            'file_size',
            'file_type',
            'text_length',
            'status',
            'processing_started_at',
            'processing_completed_at',
            'processing_error',
            'num_chunks',
            'embeddings_created',
            'has_content',
            'created_at',
            'updated_at',
        ]

    def get_has_content(self, obj):
        """
        Indica se il documento ha contenuto estratto disponibile.
        """
        return bool(obj.extracted_text and len(obj.extracted_text.strip()) > 0)

class RAGDocumentDetailSerializer(RAGDocumentSerializer):
    """
    Serializer dettagliato per RAGDocument con testo estratto.
    """
    
    extracted_text_preview = serializers.SerializerMethodField()
    
    class Meta(RAGDocumentSerializer.Meta):
        fields = RAGDocumentSerializer.Meta.fields + [
            'extracted_text',
            'extracted_text_preview',
        ]
    
    def get_extracted_text_preview(self, obj):
        """
        Restituisce un'anteprima del testo estratto (primi 500 caratteri).
        """
        if obj.extracted_text:
            if len(obj.extracted_text) > 500:
                return obj.extracted_text[:500] + "..."
            return obj.extracted_text
        return ""

class RAGChunkSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGChunk.
    """
    
    text_preview = serializers.ReadOnlyField()
    document_filename = serializers.CharField(source='document.original_filename', read_only=True)
    
    class Meta:
        model = RAGChunk
        fields = [
            'id',
            'chunk_index',
            'text',
            'text_preview',
            'text_length',
            'start_position',
            'end_position',
            'embedding_created',
            'embedding_dimension',
            'document_filename',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'text_length',
            'embedding_created',
            'embedding_dimension',
            'created_at',
        ]

class RAGProcessingLogSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGProcessingLog.
    """
    
    document_filename = serializers.CharField(source='document.original_filename', read_only=True)
    
    class Meta:
        model = RAGProcessingLog
        fields = [
            'id',
            'level',
            'message',
            'step',
            'extra_data',
            'document_filename',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

class RAGKnowledgeBaseSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGKnowledgeBase.
    """
    
    user_id = serializers.IntegerField(read_only=True)
    processed_documents_count = serializers.ReadOnlyField()
    processing_documents_count = serializers.ReadOnlyField()
    failed_documents_count = serializers.ReadOnlyField()
    
    class Meta:
        model = RAGKnowledgeBase
        fields = [
            'id',
            'name',
            'description',
            'chunk_size',
            'chunk_overlap',
            'embedding_model',
            'total_documents',
            'total_chunks',
            'processed_documents_count',
            'processing_documents_count',
            'failed_documents_count',
            'user_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'total_documents',
            'total_chunks',
            'created_at',
            'updated_at',
        ]

class RAGKnowledgeBaseDetailSerializer(RAGKnowledgeBaseSerializer):
    """
    Serializer dettagliato per RAGKnowledgeBase con lista dei documenti.
    """
    
    documents = RAGDocumentSerializer(many=True, read_only=True)
    
    class Meta(RAGKnowledgeBaseSerializer.Meta):
        fields = RAGKnowledgeBaseSerializer.Meta.fields + ['documents']

class RAGDocumentUploadSerializer(serializers.Serializer):
    """
    Serializer per l'upload di documenti o per il processing da Resource Manager.
    """
    
    file = serializers.FileField(required=False)
    resource_id = serializers.IntegerField(required=False, help_text="ID of an existing resource in Resource Manager")
    knowledge_base = serializers.IntegerField(required=False)
    
    def validate(self, data):
        """
        Valida che sia fornito file O resource_id, ma non entrambi.
        """
        file_provided = data.get('file') is not None
        resource_id_provided = data.get('resource_id') is not None
        
        if not file_provided and not resource_id_provided:
            raise serializers.ValidationError(
                "Either 'file' or 'resource_id' must be provided."
            )
        
        if file_provided and resource_id_provided:
            raise serializers.ValidationError(
                "Provide either 'file' or 'resource_id', not both."
            )
        
        return data
    
    def validate_file(self, value):
        """
        Valida il file caricato.
        """
        if value is None:
            return value
            
        # Controlla la dimensione del file (massimo 10MB per default)
        max_size = 10 * 1024 * 1024  # 10MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"Il file è troppo grande. Dimensione massima: {max_size / (1024*1024):.1f}MB"
            )
        
        # Controlla l'estensione del file
        allowed_extensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf']
        file_extension = value.name.lower()
        
        if not any(file_extension.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError(
                f"Formato file non supportato per RAG. Formati consentiti: {', '.join(allowed_extensions)}"
            )
        
        return value
    
    def validate_resource_id(self, value):
        """
        Valida l'ID della risorsa dal Resource Manager.
        """
        if value is not None:
            # La validazione dettagliata verrà fatta nella vista
            # quando chiamiamo il Resource Manager
            if value <= 0:
                raise serializers.ValidationError("resource_id must be a positive integer")
        
        return value
    
    def validate_knowledge_base(self, value):
        """
        Valida l'ID della knowledge base.
        """
        if value is not None:
            try:
                kb = RAGKnowledgeBase.objects.get(id=value)
                # Controlla se l'utente ha accesso alla knowledge base
                user = self.context['request'].user
                if kb.user_id and kb.user_id != user.id:
                    raise serializers.ValidationError("Non hai accesso a questa knowledge base")
            except RAGKnowledgeBase.DoesNotExist:
                raise serializers.ValidationError("Knowledge base non trovata")
        
        return value

class RAGChatSerializer(serializers.Serializer):
    """
    Serializer per le richieste di chat RAG.
    """
    
    message = serializers.CharField(max_length=2000)
    knowledge_base = serializers.IntegerField(required=False)
    document_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=20)
    max_tokens = serializers.IntegerField(default=1000, min_value=100, max_value=2000)
    
    def validate_message(self, value):
        """
        Valida il messaggio.
        """
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Il messaggio deve contenere almeno 3 caratteri")
        
        return value.strip()
    
    def validate_knowledge_base(self, value):
        """
        Valida l'ID della knowledge base.
        """
        if value is not None:
            try:
                kb = RAGKnowledgeBase.objects.get(id=value)
                user = self.context['request'].user
                if kb.user_id and kb.user_id != user.id:
                    raise serializers.ValidationError("Non hai accesso a questa knowledge base")
            except RAGKnowledgeBase.DoesNotExist:
                raise serializers.ValidationError("Knowledge base non trovata")
        
        return value
    
    def validate_document_ids(self, value):
        """
        Valida la lista degli ID dei documenti.
        """
        if value:
            user = self.context['request'].user
            # Verifica che tutti i documenti esistano e appartengano all'utente
            documents = RAGDocument.objects.filter(id__in=value)
            
            if len(documents) != len(value):
                raise serializers.ValidationError("Alcuni documenti non sono stati trovati")
            
            # Controlla i permessi
            for doc in documents:
                if doc.user_id and doc.user_id != user.id:
                    raise serializers.ValidationError(f"Non hai accesso al documento: {doc.original_filename}")
            
            # Controlla che i documenti siano processati
            unprocessed = documents.exclude(status='processed')
            if unprocessed.exists():
                filenames = [doc.original_filename for doc in unprocessed]
                raise serializers.ValidationError(
                    f"I seguenti documenti non sono ancora processati: {', '.join(filenames)}"
                )
        
        return value

class RAGChatResponseSerializer(serializers.Serializer):
    """
    Serializer per le risposte di chat RAG.
    """
    
    message = serializers.CharField()
    response = serializers.CharField()
    context_chunks = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    sources = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    processing_time = serializers.FloatField(required=False)
    model_used = serializers.CharField(required=False)

class RAGStatusSerializer(serializers.Serializer):
    """
    Serializer per lo stato del sistema RAG.
    """
    
    total_documents = serializers.IntegerField()
    processed_documents = serializers.IntegerField()
    processing_documents = serializers.IntegerField()
    failed_documents = serializers.IntegerField()
    total_chunks = serializers.IntegerField()
    embedding_model = serializers.CharField()
    openai_model = serializers.CharField()
    system_status = serializers.CharField()

class BulkDeleteSerializer(serializers.Serializer):
    """
    Serializer per l'eliminazione in blocco.
    """
    
    document_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    
    def validate_document_ids(self, value):
        """
        Valida la lista degli ID dei documenti da eliminare.
        """
        user = self.context['request'].user
        documents = RAGDocument.objects.filter(id__in=value)
        
        if len(documents) != len(value):
            raise serializers.ValidationError("Alcuni documenti non sono stati trovati")
        
        # Controlla i permessi
        for doc in documents:
            if doc.user_id and doc.user_id != user.id:
                raise serializers.ValidationError(f"Non hai accesso al documento: {doc.original_filename}")
        
        return value

class KnowledgeBaseDocumentsSerializer(serializers.Serializer):
    """
    Serializer per aggiungere/rimuovere documenti da una knowledge base.
    """
    
    document_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=100
    )
    
    def validate_document_ids(self, value):
        """
        Valida che i documenti esistano e appartengano all'utente.
        """
        user = self.context['request'].user
        
        # Verifica che tutti i documenti esistano e appartengano all'utente
        existing_docs = RAGDocument.objects.filter(
            id__in=value,
            user_id=user.id if user.is_authenticated else None
        ).count()
        
        if existing_docs != len(value):
            raise serializers.ValidationError(
                "Alcuni documenti non esistono o non appartengono all'utente"
            )
        
        return value

# ===== CHAT SERIALIZERS =====

class RAGChatSessionSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGChatSession.
    """
    
    knowledge_base_name = serializers.CharField(source='knowledge_base.name', read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = RAGChatSession
        fields = [
            'id',
            'title',
            'mode',
            'message_count',
            'knowledge_base',
            'knowledge_base_name',
            'user_id',
            'last_activity',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user_id',
            'message_count',
            'last_activity',
            'created_at',
            'updated_at',
        ]


class RAGChatMessageSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGChatMessage.
    """
    
    class Meta:
        model = RAGChatMessage
        fields = [
            'id',
            'content',
            'is_user',
            'sources',
            'processing_time',
            'model_used',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
        ]


class RAGChatSessionDetailSerializer(RAGChatSessionSerializer):
    """
    Serializer dettagliato per RAGChatSession con messaggi.
    """
    
    messages = RAGChatMessageSerializer(many=True, read_only=True)
    
    class Meta(RAGChatSessionSerializer.Meta):
        fields = RAGChatSessionSerializer.Meta.fields + ['messages']