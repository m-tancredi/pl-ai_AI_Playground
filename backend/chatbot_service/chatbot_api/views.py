from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Chat, ChatMessage, ChatSettings
from .serializers import ChatSerializer
from .ai_clients import process_ai_message

# Create your views here.

class ChatHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def get(self, request):
        user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
        chats = Chat.objects.filter(user_id=user_id).order_by('-created_at')
        serializer = ChatSerializer(chats, many=True)
        return Response(serializer.data)

class ChatDetailView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def get(self, request, chat_id):
        user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
        chat = Chat.objects.get(id=chat_id, user_id=user_id)
        serializer = ChatSerializer(chat)
        return Response(serializer.data)
    def delete(self, request, chat_id):
        user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
        chat = Chat.objects.get(id=chat_id, user_id=user_id)
        chat.delete()
        return Response({'success': True})

class ChatListDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def delete(self, request):
        user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
        Chat.objects.filter(user_id=user_id).delete()
        return Response({'success': True})

class ChatMessageView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def post(self, request):
        print("DEBUG ChatMessageView POST - USER:", request.user, "AUTH:", getattr(request.user, 'is_authenticated', None))
        data = request.data
        message = data.get('message')
        context = data.get('context', {})
        chat_id = data.get('chatId')
        user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
        response_data = process_ai_message(message, context, chat_id, user_id)
        return Response(response_data)
