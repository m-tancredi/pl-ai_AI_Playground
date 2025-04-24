from django.contrib import admin
from .models import Resource

@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'owner_id', 'status', 'mime_type', 'size', 'created_at', 'file')
    list_filter = ('status', 'mime_type', 'created_at')
    search_fields = ('name', 'description', 'original_filename', 'owner_id')
    readonly_fields = ('owner_id', 'status', 'mime_type', 'size', 'metadata', 'thumbnail_preview', 'file', 'created_at', 'updated_at')
    list_per_page = 50

    # Helper per mostrare l'anteprima nell'admin
    def thumbnail_preview(self, obj):
        from django.utils.html import format_html
        if obj.thumbnail:
            return format_html('<img src="{}" width="100" height="auto" />', obj.thumbnail.url)
        return "No thumbnail"
    thumbnail_preview.short_description = 'Thumbnail'