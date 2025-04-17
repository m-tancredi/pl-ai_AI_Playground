from django.urls import path
from . import views

urlpatterns = [
    path('generate/text-to-image/', views.TextToImageView.as_view(), name='generate_text_to_image'),
    path('generate/image-to-image/', views.ImageToImageView.as_view(), name='generate_image_to_image'),
    path('enhance-prompt/', views.PromptEnhanceView.as_view(), name='enhance_prompt'),
    path('save/', views.ImageSaveView.as_view(), name='save_image'),
]