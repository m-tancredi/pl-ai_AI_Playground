from django.urls import path
from .views import ModelListView, ChatCompletionView, GenerateView

urlpatterns = [
    path('models/', ModelListView.as_view(), name='llm-models'),
    path('chat/completions/', ChatCompletionView.as_view(), name='llm-chat-completions'),
    path('generate/', GenerateView.as_view(), name='llm-generate'),
] 