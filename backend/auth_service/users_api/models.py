from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

# Create your models here.

class User(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.
    Adds email as a required and unique field for login/registration.
    """
    # Override email field to make it required and unique
    email = models.EmailField(_('email address'), unique=True, blank=False, null=False)

    # You can add additional fields here if needed later
    # e.g., profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    # e.g., bio = models.TextField(blank=True, null=True)

    # If you use email as the main identifier for login instead of username:
    # USERNAME_FIELD = 'email'
    # REQUIRED_FIELDS = ['username'] # username might still be needed by AbstractUser

    def __str__(self):
        return self.username

    # Add any custom methods for your user model here