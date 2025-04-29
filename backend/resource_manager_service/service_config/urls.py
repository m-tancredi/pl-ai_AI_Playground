from django.contrib import admin
from django.urls import path, include # include è già qui
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Cambia 'api/' in 'api/resources/'
    path('api/resources/', include('resources_api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)