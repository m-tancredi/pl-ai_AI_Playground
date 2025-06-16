"""
URL configuration per l'API RAG.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RAGChatView, RAGDocumentViewSet, RAGStatusView, RAGClearKnowledgeBaseView
)

# Router per i ViewSet
router = DefaultRouter()
router.register(r'documents', RAGDocumentViewSet, basename='documents')

urlpatterns = [
    # Endpoint principale per la chat RAG
    path('chat/', RAGChatView.as_view(), name='rag-chat'),
    
    # Endpoint per lo stato del sistema
    path('status/', RAGStatusView.as_view(), name='rag-status'),
    
    # Endpoint per svuotare la knowledge base
    path('clear/', RAGClearKnowledgeBaseView.as_view(), name='rag-clear'),
    
    # Include le route del router (documenti)
    path('', include(router.urls)),
]

# Le route generate dal router saranno:
# GET    /api/documents/           - Lista documenti
# POST   /api/documents/           - Crea nuovo documento  
# GET    /api/documents/{id}/      - Dettagli documento
# PUT    /api/documents/{id}/      - Aggiorna documento
# DELETE /api/documents/{id}/      - Elimina documento
# POST   /api/documents/upload/    - Upload nuovo documento
# POST   /api/documents/bulk_delete/ - Eliminazione in blocco 