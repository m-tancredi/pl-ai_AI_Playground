from rest_framework import serializers
from .models import Chat, ChatMessage, ChatSettings

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'model', 'created_at']

class ChatSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSettings
        fields = ['grade', 'mode', 'subject', 'model', 'system_prompt']

class ChatSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    settings = ChatSettingsSerializer(read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'title', 'created_at', 'messages', 'settings'] 