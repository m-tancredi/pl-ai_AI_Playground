from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Include le URL dell'app resources_api sotto il prefisso /api/
    path('api/', include('resources_api.urls')),
]

# Servi file media e statici durante lo sviluppo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Potrebbe servire anche per static files se usi l'admin o DRF browsable API
    # urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)