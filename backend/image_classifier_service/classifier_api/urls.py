from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router per la gestione opzionale dei modelli
router = DefaultRouter()
# Nota: Usiamo retrieve, list, partial_update, destroy ma non create
router.register(r'models', views.TrainedModelViewSet, basename='trainedmodel')

urlpatterns = [
    # Endpoint per avviare l'addestramento
    path('train/', views.TrainView.as_view(), name='classifier-train'),
    # Endpoint per la predizione
    path('predict/', views.PredictView.as_view(), name='classifier-predict'),

    # Include le URL del router per la gestione dei modelli (GET, PATCH, DELETE su /models/{id}/)
    path('', include(router.urls)),
]