from rest_framework import serializers

class ModelListSerializer(serializers.Serializer):
    models = serializers.ListField(child=serializers.CharField())

class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant", "system"])
    content = serializers.CharField()

class ChatCompletionRequestSerializer(serializers.Serializer):
    model = serializers.CharField()
    messages = serializers.ListField(child=ChatMessageSerializer())
    stream = serializers.BooleanField(default=False)
    options = serializers.DictField(required=False)

class GenerateRequestSerializer(serializers.Serializer):
    model = serializers.CharField()
    prompt = serializers.CharField()
    stream = serializers.BooleanField(default=False)
    options = serializers.DictField(required=False) 