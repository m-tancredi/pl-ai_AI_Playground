from django.contrib import admin
from django.urls import path, include
from django.conf import settings
# from django.conf.urls.static import static # Not serving media/static from here

urlpatterns = [
    path('admin/', admin.site.urls),
    # Include API URLs under /api/classifier/ prefix
    path('api/classifier/', include('classifier_api.urls')),
]

# No need for static/media URL patterns if not serving directly
# if settings.DEBUG:
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)