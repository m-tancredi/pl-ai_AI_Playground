from django.urls import path
from . import views
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # Login view
    TokenRefreshView,
    TokenVerifyView,
)

# app_name = 'users_api' # Optional: Namespace if needed

urlpatterns = [
    # Registration
    path('register/', views.RegisterView.as_view(), name='auth_register'),

    # JWT Token Endpoints (Login, Refresh, Verify)
    # 'token_obtain_pair' is the standard name for the login endpoint
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # Logout (Token Blacklisting)
    path('token/blacklist/', views.LogoutView.as_view(), name='token_blacklist'),

    # User Profile Endpoints
    # Retrieves or updates the currently authenticated user's profile
    path('users/me/', views.UserProfileView.as_view(), name='user_profile'),
    
    # Profile Image Management Endpoints
    path('profile/upload-image/', views.ProfileImageUploadView.as_view(), name='profile_image_upload'),
    path('profile/remove-image/', views.ProfileImageRemoveView.as_view(), name='profile_image_remove'),
    path('profile/update/', views.ProfileUpdateView.as_view(), name='profile_update'),
]