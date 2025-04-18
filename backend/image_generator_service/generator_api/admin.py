from django.contrib import admin
from .models import GeneratedImage

@admin.register(GeneratedImage)
class GeneratedImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'owner_id', 'model_used', 'created_at', 'image_file', 'width', 'height')
    list_filter = ('model_used', 'created_at')
    search_fields = ('name', 'description', 'prompt', 'owner_id')
    readonly_fields = ('owner_id', 'prompt', 'style', 'model_used', 'image_file', 'width', 'height', 'created_at')