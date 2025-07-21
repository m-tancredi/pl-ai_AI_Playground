from django.urls import path
from .views import ChatHistoryView, ChatDetailView, ChatListDeleteView, ChatMessageView, ServiceUsageTrackingView

urlpatterns = [
    path('chat-history/', ChatHistoryView.as_view()),
    path('chat/<int:chat_id>/', ChatDetailView.as_view()),
    path('chats/', ChatListDeleteView.as_view()),
    path('chat/', ChatMessageView.as_view()),
    path('usage/', ServiceUsageTrackingView.as_view(), name='chatbot_usage_tracking'),
] 