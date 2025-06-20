from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken # Required for logout serializer
from rest_framework_simplejwt.serializers import TokenBlacklistSerializer
from PIL import Image
import os

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying User information.
    Used for the /users/me/ endpoint.
    """
    profile_image = serializers.ImageField(required=False, allow_null=True)
    
    class Meta:
        model = User
        # Fields to expose in the API response
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'last_login', 'profile_image')
        # Ensure sensitive fields like password are not included
        read_only_fields = ('id', 'date_joined', 'last_login')


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    Handles creation of a new user with username, email, and password.
    """
    # Make password write-only (not included in response) and required
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    # Ensure email is required for registration
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name')
        # Ensure id is read-only (generated automatically)
        read_only_fields = ('id',)
        # Make first_name and last_name optional during registration
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def create(self, validated_data):
        """
        Create and return a new user instance, given the validated data.
        Handles password hashing.
        """
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'], # create_user handles hashing
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        # You could add logic here, e.g., sending a verification email
        return user

    def validate_email(self, value):
        """
        Check that the email is unique.
        """
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        """
        Check that the username is unique.
        (Django's default unique=True handles this at the DB level,
         but early validation is user-friendly).
        """
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value


# Note: SimpleJWT's default serializers (TokenObtainPairSerializer, etc.)
# are generally sufficient and configured in settings.py.
# You only need to create custom ones if you want to add extra claims
# to the token payloads.

# Serializer for the Logout (Blacklist) endpoint
# We can reuse the one from SimpleJWT directly in the view,
# or define it here if needed for customization (currently not needed).
# class LogoutSerializer(serializers.Serializer):
#     refresh = serializers.CharField()

#     default_error_messages = {
#         'bad_token': _('Token is invalid or expired')
#     }

#     def validate(self, attrs):
#         self.token = attrs['refresh']
#         return attrs

#     def save(self, **kwargs):
#         try:
#             RefreshToken(self.token).blacklist()
#         except TokenError:
#             self.fail('bad_token')


class ProfileImageUploadSerializer(serializers.ModelSerializer):
    """
    Serializer for uploading profile images.
    Handles validation of image files.
    """
    profile_image = serializers.ImageField(required=True)
    
    class Meta:
        model = User
        fields = ('profile_image',)
    
    def validate_profile_image(self, value):
        """
        Validate the uploaded image file.
        """
        if not value:
            raise serializers.ValidationError("Nessun file immagine fornito.")
        
        # Check file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError("File troppo grande. Massimo 5MB consentito.")
        
        # Check file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Formato file non supportato. Utilizza JPG, PNG o WebP.")
        
        # Validate image integrity using PIL
        try:
            img = Image.open(value)
            img.verify()  # Verify that this is indeed an image
        except Exception:
            raise serializers.ValidationError("File immagine corrotto o non valido.")
        
        # Reset file pointer after verification
        value.seek(0)
        
        return value
    
    def update(self, instance, validated_data):
        """
        Update the user's profile image.
        """
        instance.profile_image = validated_data.get('profile_image', instance.profile_image)
        instance.save()
        return instance


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile information.
    """
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email')
        
    def validate_email(self, value):
        """
        Check that the email is unique (exclude current user).
        """
        user = self.instance
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Un utente con questa email esiste già.")
        return value