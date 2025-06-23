from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LessonViewSet,
    QuizAnswerViewSet,
    ApprofondimentoViewSet,
    UserProgressViewSet
)

router = DefaultRouter()
router.register(r'lessons', LessonViewSet, basename='lessons')
router.register(r'quiz-answers', QuizAnswerViewSet, basename='quiz-answers')
router.register(r'approfondimenti', ApprofondimentoViewSet, basename='approfondimenti')
router.register(r'progress', UserProgressViewSet, basename='progress')

urlpatterns = [
    path('', include(router.urls)),
] 