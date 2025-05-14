# chat_api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'profiles', views.ChatbotProfileViewSet, basename='chatbotprofile')
router.register(r'conversations', views.ConversationViewSet, basename='conversation')

urlpatterns = [
    path('', include(router.urls)),
    # Invia messaggio a una nuova conversazione (profile_id nel corpo)
    path('send-message/', views.SendMessageView.as_view(), name='send_message_to_new_conversation'),
    # Invia messaggio a una conversazione esistente (conversation_id nell'URL)
    path('conversations/<uuid:conversation_pk>/send-message/', views.SendMessageView.as_view(), name='send_message_to_existing_conversation'),
    # Lista messaggi di una conversazione
    path('conversations/<uuid:conversation_pk>/messages/', views.ChatMessageListView.as_view(), name='list_chat_messages'),
]