# pl-ai/backend/resource_manager_service/resources_api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Il basename rimane 'resource', il prefisso URL è vuoto qui ('')
router.register(r'', views.ResourceViewSet, basename='resource')
# Questo crea:
# GET '' -> Lista (diventa /api/resources/ in totale)
# GET '{pk}/' -> Dettaglio (diventa /api/resources/{pk}/)
# PATCH '{pk}/' -> Aggiorna
# DELETE '{pk}/' -> Elimina
# GET '{pk}/download/' -> Azione download

urlpatterns = [
    # Rimuovi 'resources/' da questi path
    path('upload/', views.UploadView.as_view(), name='resource-upload'),
    path('storage-info/', views.UserStorageInfoView.as_view(), name='storage-info'),
    path('internal/<int:resource_id>/content/', views.InternalContentView.as_view(), name='internal-resource-content'),

    # Include le URL del router (relative a '')
    path('', include(router.urls)),
]