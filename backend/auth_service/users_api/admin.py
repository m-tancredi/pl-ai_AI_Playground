from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

# Register your models here.

# If you don't need to customize the admin for the user model,
# you can simply register it:
# admin.site.register(User)

# Or, if you want to customize the admin interface:
class UserAdmin(BaseUserAdmin):
    # Add any customizations here, for example:
    list_display = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    # If you added custom fields to the User model, add them to fieldsets or list_display
    # fieldsets = BaseUserAdmin.fieldsets + (
    #     (None, {'fields': ('your_custom_field',)}),
    # )
    # add_fieldsets = BaseUserAdmin.add_fieldsets + (
    #     (None, {'fields': ('your_custom_field',)}),
    # )

admin.site.register(User, UserAdmin)