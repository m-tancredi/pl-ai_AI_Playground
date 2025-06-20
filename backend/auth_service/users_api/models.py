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

    # Profile image field
    profile_image = models.ImageField(
        upload_to='profile_images/', 
        null=True, 
        blank=True,
        help_text=_('Upload a profile image (max 5MB)')
    )

    # Additional fields for future use
    # bio = models.TextField(blank=True, null=True)

    # If you use email as the main identifier for login instead of username:
    # USERNAME_FIELD = 'email'
    # REQUIRED_FIELDS = ['username'] # username might still be needed by AbstractUser

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        """
        Override save method to handle profile image cleanup.
        Removes old profile image when a new one is uploaded.
        """
        # Check if this is an update (not a new user)
        if self.pk:
            try:
                old_user = User.objects.get(pk=self.pk)
                # If profile image has changed and old image exists
                if old_user.profile_image and old_user.profile_image != self.profile_image:
                    # Delete old image file
                    if old_user.profile_image.name:
                        old_user.profile_image.delete(save=False)
            except User.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)

    def delete_profile_image(self):
        """
        Method to delete the current profile image.
        """
        if self.profile_image:
            self.profile_image.delete(save=False)
            self.profile_image = None
            self.save()

    # Add any custom methods for your user model here