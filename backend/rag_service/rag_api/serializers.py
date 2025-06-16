"""
Serializers per l'API RAG.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import RAGDocument, RAGChunk, RAGProcessingLog, RAGKnowledgeBase

class RAGDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer per il modello RAGDocument.
    """
    
    file_size_mb = serializers.ReadOnlyField()
    processing_duration = serializers.ReadOnlyField()
    user_id = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = RAGDocument
        fields = [
            'id',
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
            'user_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
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
            'created_at',
            'updated_at',
        ]

class RAGDocumentDetailSerializer(RAGDocumentSerializer):
    """
    Serializer dettagliato per RAGDocument con testo estratto.
    """
    
    extracted_text_preview = serializers.SerializerMethodField()
    
    class Meta(RAGDocumentSerializer.Meta):
        fields = RAGDocumentSerializer.Meta.fields + [
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
    Serializer per l'upload di documenti.
    """
    
    file = serializers.FileField()
    knowledge_base = serializers.IntegerField(required=False)
    
    def validate_file(self, value):
        """
        Valida il file caricato.
        """
        # Controlla la dimensione del file (massimo 10MB per default)
        max_size = 10 * 1024 * 1024  # 10MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"Il file è troppo grande. Dimensione massima: {max_size / (1024*1024):.1f}MB"
            )
        
        # Controlla l'estensione del file
        allowed_extensions = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png', '.xlsx', '.xls']
        file_extension = value.name.lower()
        
        if not any(file_extension.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError(
                f"Formato file non supportato. Formati consentiti: {', '.join(allowed_extensions)}"
            )
        
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