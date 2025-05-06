from django.urls import path
from . import views

# Prefisso /api/regression/ gestito da Nginx e urls.py del progetto
urlpatterns = [
    path('run/', views.RunRegressionView.as_view(), name='run-regression'),
    path('predict/', views.PredictView.as_view(), name='predict-regression'),
]