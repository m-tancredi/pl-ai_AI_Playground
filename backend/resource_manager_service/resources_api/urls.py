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
    path('internal/resources/upload-synthetic-content/', views.InternalSyntheticContentUploadView.as_view(), name='internal-synthetic-upload'),
    path('internal/resources/<int:resource_id>/content/', views.InternalContentView.as_view(), name='internal-resource-content'),
    
    # Nuovi endpoint interni per RAG
    path('internal/rag/resources/', views.InternalRagResourcesView.as_view(), name='internal-rag-resources'),
    path('internal/rag/resources/<int:resource_id>/content/', views.InternalRagContentView.as_view(), name='internal-rag-content'),

    # Include le URL del router (relative a '')
    path('', include(router.urls)),
]