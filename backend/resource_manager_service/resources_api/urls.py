from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router per il ViewSet principale delle risorse
router = DefaultRouter()
router.register(r'resources', views.ResourceViewSet, basename='resource')
# Questo crea:
# GET /api/resources/ -> Lista (filtrata per utente)
# GET /api/resources/{pk}/ -> Dettaglio
# PATCH /api/resources/{pk}/ -> Aggiorna (nome/descrizione)
# DELETE /api/resources/{pk}/ -> Elimina
# GET /api/resources/{pk}/download/ -> Azione custom download

urlpatterns = [
    # Endpoint per l'upload iniziale
    path('resources/upload/', views.UploadView.as_view(), name='resource-upload'),

    # Endpoint interno per accedere al contenuto (usare con cautela)
    path('internal/resources/<int:resource_id>/content/', views.InternalContentView.as_view(), name='internal-resource-content'),

    # Include le URL generate dal router (devono venire dopo le view specifiche se ci sono conflitti di path)
    path('', include(router.urls)),
]