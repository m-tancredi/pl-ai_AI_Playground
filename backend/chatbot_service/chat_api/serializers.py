# chat_api/serializers.py
from rest_framework import serializers
from .models import ChatbotProfile, Conversation, ChatMessage
from django.conf import settings # Per default LLM model

class ChatbotProfileSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(read_only=True) # Impostato automaticamente

    class Meta:
        model = ChatbotProfile
        fields = [
            'id', 'owner_id', 'name', 'system_prompt', 'llm_model_name',
            'grade_level', 'mode', 'subject', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner_id', 'created_at', 'updated_at']
        extra_kwargs = {
            'name': {'required': True, 'allow_blank': False},
            'llm_model_name': {'default': settings.DEFAULT_LLM_MODEL_OPENAI} # Esempio default
        }

class ConversationSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(read_only=True)
    # profile = ChatbotProfileSerializer(read_only=True) # Mostra dettagli profilo in lista/dettaglio conversazione
    profile_id = serializers.UUIDField(write_only=True, help_text="ID of the ChatbotProfile to associate with.")

    class Meta:
        model = Conversation
        fields = [
            'id', 'profile', 'profile_id', 'owner_id', 'title',
            'active_rag_resource_ids', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'profile', 'owner_id', 'created_at', 'updated_at']
        # title e active_rag_resource_ids possono essere aggiornati se necessario

    def validate_profile_id(self, value):
        """Controlla che il profilo esista e appartenga all'utente."""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            # Questo non dovrebbe accadere se l'autenticazione è attiva
            raise serializers.ValidationError("Request context not available.")

        user_id = request.user.id
        try:
            profile = ChatbotProfile.objects.get(pk=value, owner_id=user_id)
        except ChatbotProfile.DoesNotExist:
            raise serializers.ValidationError("ChatbotProfile not found or you do not have permission.")
        return value # Restituisce l'ID UUID validato

    def create(self, validated_data):
        # L'owner_id e il profile (oggetto) verranno impostati nella vista perform_create
        # profile_id è già validato
        return super().create(validated_data)


class ChatMessageSerializer(serializers.ModelSerializer):
    # Non esponiamo conversation ID qui se viene sempre recuperato nel contesto di una conversazione
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'llm_model_used', 'token_info', 'timestamp']
        read_only_fields = fields # Tutti i campi sono generati dal sistema


class SendMessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField(required=True, allow_blank=False, max_length=4000) # Limite lunghezza input
    profile_id = serializers.UUIDField(required=False, allow_null=True, help_text="ID of ChatbotProfile to use if no conversation_id.")
    # conversation_id è nell'URL per l'endpoint /conversations/{id}/send-message/
    # ma potrebbe essere nel corpo per un endpoint generico /chat/
    # conversation_id = serializers.UUIDField(required=False, allow_null=True)
    rag_resource_ids = serializers.ListField(
        child=serializers.IntegerField(), # Assumendo che Resource Manager usi ID interi
        required=False,
        allow_empty=True,
        default=list,
        help_text="List of Resource IDs from ResourceManager to use for RAG context."
    )
    # Potremmo aggiungere altri parametri qui, es. 'temperature', 'max_tokens' per sovrascrivere il profilo

    def validate(self, data):
        # Se conversation_id non è parte dell'URL e non è nel corpo, profile_id è obbligatorio
        # Questa validazione dipende da come strutturi la view.
        # Per ora, la view gestirà la logica di recupero/creazione conversazione.
        # if not self.context.get('view').kwargs.get('conversation_pk') and not data.get('conversation_id') and not data.get('profile_id'):
        #     raise serializers.ValidationError("Either conversation_id (in URL or body) or profile_id must be provided.")
        return data

class SendMessageResponseSerializer(serializers.Serializer):
    # Non serializziamo oggetti modello qui, ma dizionari semplici
    # per evitare query extra se non necessarie.
    # La vista costruirà questi dizionari.
    user_message = serializers.DictField()    # { role, content, timestamp }
    assistant_message = serializers.DictField() # { role, content, timestamp, model_used, token_info }
    conversation_id = serializers.UUIDField()