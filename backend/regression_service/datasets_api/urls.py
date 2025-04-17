from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DatasetViewSet, UploadTrainTemporaryView, PredictView

# Crea un router per il ViewSet dei Dataset
router = DefaultRouter()
router.register(r'datasets', DatasetViewSet, basename='dataset')

# Le URL specifiche per upload temporaneo e predizione
urlpatterns = [
    path('', include(router.urls)), # Include le URL CRUD e azioni custom del ViewSet (/datasets/, /datasets/{pk}/, /datasets/{pk}/raw-data/, /datasets/{pk}/train/)
    path('upload-train-temporary/', UploadTrainTemporaryView.as_view(), name='upload_train_temporary'),
    path('predict/', PredictView.as_view(), name='predict'),
]

# Esempio URL finali (considerando il prefisso /api/regression/ in Nginx e /api/ in project urls.py):
# POST   /api/regression/datasets/                     (Crea/Salva Dataset)
# GET    /api/regression/datasets/                     (Lista Dataset utente + esempi)
# GET    /api/regression/datasets/{pk}/                (Dettagli Dataset)
# PUT    /api/regression/datasets/{pk}/                (Aggiorna Dataset)
# DELETE /api/regression/datasets/{pk}/                (Elimina Dataset)
# GET    /api/regression/datasets/{pk}/raw-data/       (Dati grezzi del Dataset)
# POST   /api/regression/datasets/{pk}/train/          (Addestra su Dataset salvato)
# POST   /api/regression/upload-train-temporary/       (Upload+Addestra senza salvare)
# POST   /api/regression/predict/                      (Predici con parametri dati)