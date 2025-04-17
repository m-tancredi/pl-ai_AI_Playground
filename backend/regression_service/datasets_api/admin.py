# pl-ai/backend/regression_service/datasets_api/admin.py
from django.contrib import admin
from .models import Dataset

@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    # Usa owner_id invece della funzione custom
    list_display = ('id', 'name', 'owner_id', 'uploaded_at', 'is_example', 'csv_file')
    list_filter = ('is_example', 'uploaded_at')
    # Rimuovi owner__username da search_fields perché non c'è relazione diretta
    search_fields = ('name', 'description',)
    readonly_fields = ('uploaded_at', 'headers')

# Rimuovi la funzione owner_id(self, obj) se presente