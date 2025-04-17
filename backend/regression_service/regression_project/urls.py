from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Includi le URL dell'app datasets_api sotto il prefisso /api/
    # Useremo /api/regression/ in Nginx, ma internamente qui basta /api/
    path('api/', include('datasets_api.urls')),
]

# Servi i file media durante lo sviluppo (DEBUG=True)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)