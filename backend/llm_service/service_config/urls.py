from django.urls import path, include

urlpatterns = [
    path('api/llm/', include('llm_api.urls')),
] 