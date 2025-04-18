# pl-ai/backend/image_generator_service/service_config/urls.py
from django.contrib import admin # <-- Assicurati che admin sia importato
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls), # <-- DEVE ESSERE PRESENTE E CORRETTO
    path('api/', include('generator_api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)