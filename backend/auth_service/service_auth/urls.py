"""
URL configuration for service_auth project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # Include users_api urls under the /api/v1/ prefix
    path('api/v1/', include('users_api.urls')),
]