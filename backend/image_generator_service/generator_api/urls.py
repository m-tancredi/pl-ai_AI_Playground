from django.urls import path, include
from rest_framework.routers import DefaultRouter # Importa il router
from . import views

# Crea un router per il ViewSet della galleria
router = DefaultRouter()
router.register(r'gallery', views.UserGalleryViewSet, basename='gallery') # Registra il ViewSet

urlpatterns = [
    # Endpoints di generazione e utilità
    path('generate/text-to-image/', views.TextToImageView.as_view(), name='generate_text_to_image'),
    path('generate/image-to-image/', views.ImageToImageView.as_view(), name='generate_image_to_image'),
    path('enhance-prompt/', views.PromptEnhanceView.as_view(), name='enhance_prompt'),
    path('save/', views.ImageSaveView.as_view(), name='save_image'),

    # Include le URL CRUD generate dal router per la galleria
    # Questo creerà automaticamente:
    # GET /api/gallery/ -> Lista immagini utente
    # POST /api/gallery/ -> (Non usato/abilitato qui, la creazione avviene tramite /save)
    # GET /api/gallery/{pk}/ -> Dettaglio immagine
    # PUT /api/gallery/{pk}/ -> Aggiorna immagine (es. nome/descrizione)
    # PATCH /api/gallery/{pk}/ -> Aggiorna parzialmente immagine
    # DELETE /api/gallery/{pk}/ -> Elimina immagine (record + file)
    path('', include(router.urls)),
]