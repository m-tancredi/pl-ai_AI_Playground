from django.shortcuts import render
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import (
    RegisterSerializer, 
    UserSerializer, 
    ProfileImageUploadSerializer,
    ProfileUpdateSerializer
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    """
    API view for user registration.
    Allows any user (authenticated or not) to create a new account.
    """
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,) # Allow anyone to register
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Optional: Generate tokens immediately upon registration?
        # refresh = RefreshToken.for_user(user)
        # data = {
        #     'refresh': str(refresh),
        #     'access': str(refresh.access_token),
        #     'user': serializer.data # Return user data as well
        # }
        # return Response(data, status=status.HTTP_201_CREATED)

        # Or just return user data (or a success message) and require separate login
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    API view for retrieving and updating the authenticated user's profile.
    Requires authentication.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,) # Only authenticated users

    def get_object(self):
        """
        Override to return the currently authenticated user.
        """
        return self.request.user

    # Update logic is handled by RetrieveUpdateAPIView using the serializer


class LogoutView(views.APIView):
    """
    API view for user logout (blacklisting the refresh token).
    Requires authentication and the refresh token in the request body.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        """
        Blacklists the provided refresh token.
        """
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)
        except TokenError as e:
            # Handle cases where the token is already blacklisted or invalid
            return Response({"detail": f"Token is invalid or expired: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Catch any other unexpected errors
            return Response({"detail": "An error occurred during logout."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Note: The views for TokenObtainPairView (Login), TokenRefreshView, and TokenVerifyView
# are provided by rest_framework_simplejwt and are included directly in urls.py.
# You don't need to implement them here unless you need significant customization
# beyond what serializers and settings allow.


class ProfileImageUploadView(generics.UpdateAPIView):
    """
    API view for uploading profile images.
    Requires authentication and accepts multipart/form-data.
    """
    queryset = User.objects.all()
    serializer_class = ProfileImageUploadSerializer
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    
    def get_object(self):
        """
        Return the currently authenticated user.
        """
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        """
        Handle profile image upload.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            serializer.save()
            # Return user data with the new profile image URL
            user_serializer = UserSerializer(instance)
            return Response({
                'message': 'Immagine del profilo caricata con successo.',
                'user': user_serializer.data,
                'profile_image': instance.profile_image.url if instance.profile_image else None
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileImageRemoveView(views.APIView):
    """
    API view for removing profile images.
    Requires authentication.
    """
    permission_classes = (permissions.IsAuthenticated,)
    
    def delete(self, request):
        """
        Remove the user's profile image.
        """
        user = request.user
        
        if not user.profile_image:
            return Response({
                'message': 'Nessuna immagine del profilo da rimuovere.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Use the model method to delete the image
            user.delete_profile_image()
            
            # Return updated user data
            user_serializer = UserSerializer(user)
            return Response({
                'message': 'Immagine del profilo rimossa con successo.',
                'user': user_serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'message': 'Errore durante la rimozione dell\'immagine del profilo.',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProfileUpdateView(generics.UpdateAPIView):
    """
    API view for updating user profile information.
    Requires authentication.
    """
    queryset = User.objects.all()
    serializer_class = ProfileUpdateSerializer
    permission_classes = (permissions.IsAuthenticated,)
    
    def get_object(self):
        """
        Return the currently authenticated user.
        """
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        """
        Handle profile update.
        """
        partial = kwargs.pop('partial', True)  # Allow partial updates by default
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            serializer.save()
            # Return updated user data
            user_serializer = UserSerializer(instance)
            return Response({
                'message': 'Profilo aggiornato con successo.',
                'user': user_serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)