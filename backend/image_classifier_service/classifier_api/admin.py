from django.contrib import admin
from .models import TrainedModel

@admin.register(TrainedModel)
class TrainedModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'owner_id', 'status', 'accuracy', 'class_names_list', 'created_at', 'training_finished_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'owner_id', 'class_names')
    readonly_fields = ('owner_id', 'status', 'accuracy', 'loss', 'class_names', 'model_path', 'class_names_path', 'created_at', 'training_started_at', 'training_finished_at', 'error_message')

    def class_names_list(self, obj):
        return ", ".join(obj.class_names or [])
    class_names_list.short_description = 'Class Names'