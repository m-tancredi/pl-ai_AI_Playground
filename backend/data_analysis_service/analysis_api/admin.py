from django.contrib import admin
from .models import AnalysisJob

@admin.register(AnalysisJob)
class AnalysisJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner_id', 'task_type', 'selected_algorithm_key', 'status', 'created_at', 'job_started_at', 'job_finished_at')
    list_filter = ('status', 'task_type', 'selected_algorithm_key', 'created_at')
    search_fields = ('id', 'owner_id', 'input_parameters', 'results')
    readonly_fields = ('id', 'owner_id', 'input_parameters', 'results', 'plot_data', 'model_path', 'created_at', 'job_started_at', 'job_finished_at', 'error_message')