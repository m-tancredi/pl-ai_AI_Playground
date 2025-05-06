# from django.contrib import admin # Non più necessario
from django.urls import path, include
# from django.conf import settings # Non necessario senza media/static qui
# from django.conf.urls.static import static # Non necessario

urlpatterns = [
    # path('admin/', admin.site.urls), # Rimosso
    # Include le URL della nuova app regression_api
    path('api/regression/', include('regression_api.urls')),
]

# Non serve più servire media/static da qui