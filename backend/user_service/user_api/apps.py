from django.apps import AppConfig


class UserApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'user_api'
    verbose_name = 'User API'
    
    def ready(self):
        # Import signal handlers
        import user_api.signals 