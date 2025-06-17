"""
URL configuration per l'API RAG.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RAGChatView, RAGDocumentViewSet, RAGStatusView, RAGClearKnowledgeBaseView,
    RAGKnowledgeBaseViewSet, RAGChatSessionViewSet, RAGChatSessionListView
)

# Router per i ViewSet
router = DefaultRouter()
router.register(r'documents', RAGDocumentViewSet, basename='documents')
router.register(r'knowledge-bases', RAGKnowledgeBaseViewSet, basename='knowledge-bases')
router.register(r'chat-sessions', RAGChatSessionViewSet, basename='chat-sessions')

urlpatterns = [
    # Endpoint principale per la chat RAG
    path('chat/', RAGChatView.as_view(), name='rag-chat'),
    
    # Endpoint per lo stato del sistema
    path('status/', RAGStatusView.as_view(), name='rag-status'),
    
    # Endpoint per svuotare la knowledge base
    path('clear/', RAGClearKnowledgeBaseView.as_view(), name='rag-clear'),
    
    # Endpoint per le sessioni di chat
    path('chat-sessions/list/', RAGChatSessionListView.as_view(), name='chat-sessions-list'),
    
    # Include le route del router (documenti, KB, chat sessions)
    path('', include(router.urls)),
]

# Le route generate dal router saranno:
# 
# DOCUMENTI:
# GET    /api/documents/           - Lista documenti
# POST   /api/documents/           - Crea nuovo documento  
# GET    /api/documents/{id}/      - Dettagli documento
# PUT    /api/documents/{id}/      - Aggiorna documento
# DELETE /api/documents/{id}/      - Elimina documento
# POST   /api/documents/upload/    - Upload nuovo documento
# POST   /api/documents/bulk_delete/ - Eliminazione in blocco
#
# KNOWLEDGE BASES:
# GET    /api/knowledge-bases/     - Lista knowledge base
# POST   /api/knowledge-bases/     - Crea nuova knowledge base
# GET    /api/knowledge-bases/{id}/ - Dettagli knowledge base
# PUT    /api/knowledge-bases/{id}/ - Aggiorna knowledge base
# DELETE /api/knowledge-bases/{id}/ - Elimina knowledge base
# POST   /api/knowledge-bases/{id}/add_documents/ - Aggiungi documenti alla KB
# POST   /api/knowledge-bases/{id}/remove_documents/ - Rimuovi documenti dalla KB
# GET    /api/knowledge-bases/{id}/statistics/ - Statistiche dettagliate KB
# POST   /api/knowledge-bases/{id}/chat/ - Chat specifica per KB