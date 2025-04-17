from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken # Required for logout serializer
from rest_framework_simplejwt.serializers import TokenBlacklistSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying User information (read-only).
    Used for the /users/me/ endpoint.
    """
    class Meta:
        model = User
        # Fields to expose in the API response
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'last_login')
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