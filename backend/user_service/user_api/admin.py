from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
import json

from .models import UserProfile, UserActivityLog

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """
    Admin interface per UserProfile con funzionalità avanzate.
    """
    list_display = [
        'user_id', 'full_name', 'email', 'status', 'registration_completed',
        'last_activity', 'created_at', 'profile_picture_preview'
    ]
    list_filter = [
        'status', 'registration_completed', 'created_at', 'last_activity',
        ('date_of_birth', admin.DateFieldListFilter),
    ]
    search_fields = [
        'user_id', 'first_name', 'last_name', 'username', 'display_name',
        'email', 'location'
    ]
    readonly_fields = [
        'user_id', 'created_at', 'updated_at', 'last_activity',
        'full_name', 'public_name', 'preferences_json'
    ]
    
    fieldsets = (
        (_('Informazioni Base'), {
            'fields': ('user_id', 'first_name', 'last_name', 'username', 'display_name')
        }),
        (_('Contatti'), {
            'fields': ('email', 'phone_number')
        }),
        (_('Profilo'), {
            'fields': ('profile_picture_url', 'bio', 'location', 'date_of_birth')
        }),
        (_('Sistema'), {
            'fields': ('status', 'registration_completed', 'last_activity', 'preferences_json'),
            'classes': ('collapse',)
        }),
        (_('Metadata'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    
    def full_name(self, obj):
        """Mostra il nome completo nell'admin."""
        return obj.full_name
    full_name.short_description = _('Nome Completo')
    
    def profile_picture_preview(self, obj):
        """Mostra un'anteprima dell'immagine profilo."""
        if obj.profile_picture_url:
            return format_html(
                '<img src="{}" width="30" height="30" style="border-radius: 50%;" />',
                obj.profile_picture_url
            )
        return _('Nessuna immagine')
    profile_picture_preview.short_description = _('Avatar')
    
    def preferences_json(self, obj):
        """Mostra le preferenze in formato JSON leggibile."""
        if obj.preferences:
            formatted_json = json.dumps(obj.preferences, indent=2, ensure_ascii=False)
            return format_html('<pre>{}</pre>', formatted_json)
        return _('Nessuna preferenza')
    preferences_json.short_description = _('Preferenze')
    
    def get_queryset(self, request):
        """Ottimizza le query per l'admin."""
        return super().get_queryset(request).select_related()
    
    actions = ['activate_users', 'deactivate_users', 'suspend_users']
    
    def activate_users(self, request, queryset):
        """Azione bulk per attivare utenti."""
        updated = queryset.update(status='active')
        self.message_user(
            request,
            _('%(count)d utenti sono stati attivati.') % {'count': updated}
        )
    activate_users.short_description = _('Attiva utenti selezionati')
    
    def deactivate_users(self, request, queryset):
        """Azione bulk per disattivare utenti."""
        updated = queryset.update(status='inactive')
        self.message_user(
            request,
            _('%(count)d utenti sono stati disattivati.') % {'count': updated}
        )
    deactivate_users.short_description = _('Disattiva utenti selezionati')
    
    def suspend_users(self, request, queryset):
        """Azione bulk per sospendere utenti."""
        updated = queryset.update(status='suspended')
        self.message_user(
            request,
            _('%(count)d utenti sono stati sospesi.') % {'count': updated}
        )
    suspend_users.short_description = _('Sospendi utenti selezionati')

@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    """
    Admin interface per UserActivityLog.
    """
    list_display = [
        'user_profile', 'action', 'description', 'ip_address', 'created_at'
    ]
    list_filter = [
        'action', 'created_at',
        ('user_profile', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'user_profile__first_name', 'user_profile__last_name',
        'user_profile__email', 'description', 'ip_address'
    ]
    readonly_fields = [
        'user_profile', 'action', 'description', 'ip_address',
        'user_agent', 'metadata_json', 'created_at'
    ]
    
    fieldsets = (
        (_('Informazioni Log'), {
            'fields': ('user_profile', 'action', 'description', 'created_at')
        }),
        (_('Dettagli Tecnici'), {
            'fields': ('ip_address', 'user_agent', 'metadata_json'),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    
    def metadata_json(self, obj):
        """Mostra i metadati in formato JSON leggibile."""
        if obj.metadata:
            formatted_json = json.dumps(obj.metadata, indent=2, ensure_ascii=False)
            return format_html('<pre>{}</pre>', formatted_json)
        return _('Nessun metadato')
    metadata_json.short_description = _('Metadati')
    
    def get_queryset(self, request):
        """Ottimizza le query per l'admin."""
        return super().get_queryset(request).select_related('user_profile')
    
    def has_add_permission(self, request):
        """Disabilita l'aggiunta manuale di log."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Disabilita la modifica dei log."""
        return False

# Personalizzazione del titolo admin
admin.site.site_header = _('User Service - Amministrazione')
admin.site.site_title = _('User Service Admin')
admin.site.index_title = _('Gestione Profili Utente') 