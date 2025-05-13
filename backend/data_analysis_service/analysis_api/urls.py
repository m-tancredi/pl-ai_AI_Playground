from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router per il modello AnalysisJob (se si vuole CRUD completo, altrimenti solo retrieve/list)
# router = DefaultRouter()
# router.register(r'jobs', views.AnalysisJobViewSet, basename='analysisjob')

urlpatterns = [
    path('suggest-algorithm/', views.SuggestAlgorithmView.as_view(), name='suggest-algorithm'),
    path('run/', views.RunAnalysisView.as_view(), name='run-analysis'),
    path('results/<uuid:analysis_job_id>/', views.AnalysisResultView.as_view(), name='analysis-results'),
    # path('', include(router.urls)), # Se usi un ViewSet per i jobs
]