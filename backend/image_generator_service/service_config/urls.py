from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # path('admin/', admin.site.urls), # Admin non usato inizialmente
    path('api/', include('generator_api.urls')), # API della nostra app
]

# Servi file media in DEBUG mode
if settings.DEBUG:
    # Nota: Questo serve tutti i file sotto MEDIA_ROOT via Django.
    # In produzione, Nginx gestirà /media/
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)