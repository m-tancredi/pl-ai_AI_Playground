"""
URL configuration for service_auth project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Include users_api urls under the /api/v1/ prefix
    path('api/v1/', include('users_api.urls')),
    # Include social auth urls under the /api/auth/ prefix
    path('api/auth/', include('users_api.urls')),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)