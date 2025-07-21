from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Chat, ChatMessage, ChatSettings, ServiceUsageTracking
from .serializers import ChatSerializer
from .ai_clients import process_ai_message
from .utils import calculate_chatbot_usage_summary, calculate_chatbot_usage_summary_v2
from .authentication import JWTCustomAuthentication

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

class ServiceUsageTrackingView(APIView):
    """API endpoint per recuperare i dati di consumo del chatbot service."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def get(self, request, *args, **kwargs):
        """Recupera i dati di consumo dell'utente per il chatbot service."""
        user_id = request.user.id
        
        print(f"[CHATBOT USAGE API] Called by user_id: {user_id}")
        
        # Parametri query per filtro
        period = request.query_params.get('period', 'current_month')  # current_month, all_time, last_30_days
        limit = int(request.query_params.get('limit', 50))  # Limite per i record recenti
        
        print(f"[CHATBOT USAGE API] Period: {period}, Limit: {limit}")
        
        # Filtra per utente
        base_queryset = ServiceUsageTracking.objects.filter(user_id=user_id)
        
        # Filtra per periodo
        if period == 'current_month':
            from django.utils import timezone
            from datetime import datetime
            now = timezone.now()
            start_of_month = datetime(now.year, now.month, 1, tzinfo=now.tzinfo)
            queryset = base_queryset.filter(created_at__gte=start_of_month)
        elif period == 'last_30_days':
            from django.utils import timezone
            from datetime import datetime, timedelta
            now = timezone.now()
            start_date = now - timedelta(days=30)
            queryset = base_queryset.filter(created_at__gte=start_date)
        elif period == 'today':
            from django.utils import timezone
            from datetime import datetime
            now = timezone.now()
            start_of_day = datetime(now.year, now.month, now.day, tzinfo=now.tzinfo)
            queryset = base_queryset.filter(created_at__gte=start_of_day)
        else:  # all_time
            queryset = base_queryset
        
        print(f"[CHATBOT USAGE API] Base queryset count: {base_queryset.count()}, Filtered queryset count: {queryset.count()}")
        
        # Calcola summary usando le utility
        summary = calculate_chatbot_usage_summary_v2(queryset)
        
        # Prendi i record recenti per la cronologia
        recent_records = queryset.order_by('-created_at')[:limit]
        
        print(f"[CHATBOT USAGE API] Recent records count: {recent_records.count()}")
        
        # Serializza i record recenti
        recent_records_data = []
        for record in recent_records:
            recent_records_data.append({
                'id': record.id,
                'operation_type': record.operation_type,
                'model_used': record.model_used,
                'input_data': record.input_data[:100] + '...' if len(record.input_data) > 100 else record.input_data,
                'output_summary': record.output_summary[:100] + '...' if record.output_summary and len(record.output_summary) > 100 else record.output_summary,
                'tokens_consumed': record.tokens_consumed,
                'cost_usd': record.cost_usd,
                'cost_eur': record.cost_eur,
                'success': record.success,
                'response_time_ms': record.response_time_ms,
                'created_at': record.created_at,
            })
        
        response_data = {
            'summary': summary,
            'recent_records': recent_records_data,
            'period': period,
            'user_id': user_id,
            'service_name': 'chatbot'
        }
        
        print(f"[CHATBOT USAGE API] Response prepared with {len(recent_records_data)} records")
        
        return Response(response_data, status=status.HTTP_200_OK)
