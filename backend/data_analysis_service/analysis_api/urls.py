from django.urls import path, include
# from rest_framework.routers import DefaultRouter # Se usi ViewSet per AnalysisJob
from . import views

# router = DefaultRouter()
# router.register(r'jobs', views.AnalysisJobViewSet, basename='analysisjob') # Esempio

urlpatterns = [
    path('suggest-algorithm/', views.SuggestAlgorithmView.as_view(), name='suggest-algorithm'),
    path('run/', views.RunAnalysisView.as_view(), name='run-analysis'),
    path('results/<uuid:analysis_job_id>/', views.AnalysisResultView.as_view(), name='analysis-results'),
    # --- NUOVA ROUTE ---
    path('jobs/<uuid:analysis_job_id>/predict_instance/', views.PredictInstanceView.as_view(), name='predict-instance'),
    # path('', include(router.urls)), # Se si usa un router per i jobs
    path('jobs/<uuid:analysis_job_id>/predict_instance/', views.PredictInstanceView.as_view(), name='predict-instance'),
]
