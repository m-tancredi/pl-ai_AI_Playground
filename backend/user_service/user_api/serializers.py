from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.core.validators import validate_email
import phonenumbers
from phonenumbers import NumberParseException
from datetime import date
from .models import UserProfile, UserActivityLog

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer completo per il profilo utente.
    Utilizzato per le operazioni di lettura e aggiornamento completo.
    """
    full_name = serializers.ReadOnlyField()
    public_name = serializers.ReadOnlyField()
    
    class Meta:
        model = UserProfile
        fields = [
            'user_id', 'first_name', 'last_name', 'display_name',
            'email', 'phone_number', 'profile_picture_url', 'bio',
            'location', 'date_of_birth', 'preferences', 'status',
            'last_activity', 'created_at', 'updated_at',
            'full_name', 'public_name'
        ]
        read_only_fields = [
            'user_id', 'created_at', 'updated_at', 'last_activity',
            'full_name', 'public_name'
        ]
    
    def validate_email(self, value):
        """Validazione personalizzata per l'email."""
        if value:
            validate_email(value)
            # Verifica unicità dell'email
            if self.instance:
                # Update: escludiamo l'istanza corrente
                if UserProfile.objects.exclude(pk=self.instance.pk).filter(email=value).exists():
                    raise serializers.ValidationError(_('Un utente con questa email esiste già.'))
            else:
                # Create: verifica semplice
                if UserProfile.objects.filter(email=value).exists():
                    raise serializers.ValidationError(_('Un utente con questa email esiste già.'))
        return value
    
    def validate_phone_number(self, value):
        """Validazione del numero di telefono."""
        if value:
            try:
                phone_number = phonenumbers.parse(value, None)
                if not phonenumbers.is_valid_number(phone_number):
                    raise serializers.ValidationError(_('Numero di telefono non valido.'))
                # Formatta il numero in formato internazionale
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
            except NumberParseException:
                raise serializers.ValidationError(_('Formato numero di telefono non valido.'))
        return value
    
    def validate_date_of_birth(self, value):
        """Validazione della data di nascita."""
        if value:
            today = date.today()
            if value > today:
                raise serializers.ValidationError(_('La data di nascita non può essere nel futuro.'))
            # Verifica età minima (es. 13 anni)
            min_age = today.replace(year=today.year - 13)
            if value > min_age:
                raise serializers.ValidationError(_('L\'età minima richiesta è di 13 anni.'))
        return value
    
    def validate_bio(self, value):
        """Validazione della biografia."""
        if value and len(value.strip()) > 500:
            raise serializers.ValidationError(_('La biografia non può superare i 500 caratteri.'))
        return value.strip() if value else value
    
    def validate_preferences(self, value):
        """Validazione delle preferenze."""
        if not isinstance(value, dict):
            raise serializers.ValidationError(_('Le preferenze devono essere un oggetto JSON valido.'))
        return value

class UserProfileCreateSerializer(serializers.ModelSerializer):
    """
    Serializer per la creazione di un nuovo profilo utente.
    """
    class Meta:
        model = UserProfile
        fields = [
            'user_id', 'first_name', 'last_name', 'display_name',
            'email', 'phone_number', 'bio', 'location', 'date_of_birth'
        ]
    
    def validate_first_name(self, value):
        """Validazione del nome."""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError(_('Il nome deve essere di almeno 2 caratteri.'))
        return value.strip()
    
    def validate_last_name(self, value):
        """Validazione del cognome."""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError(_('Il cognome deve essere di almeno 2 caratteri.'))
        return value.strip()
    
    def validate_display_name(self, value):
        """Validazione del nome visualizzato."""
        if value and len(value.strip()) < 3:
            raise serializers.ValidationError(_('Il nome visualizzato deve essere di almeno 3 caratteri.'))
        return value.strip() if value else value

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer per l'aggiornamento parziale del profilo utente.
    """
    class Meta:
        model = UserProfile
        fields = [
            'first_name', 'last_name', 'display_name', 'email', 'phone_number',
            'profile_picture_url', 'bio', 'location', 'date_of_birth'
        ]
    
    def validate_first_name(self, value):
        if value and value.strip() and len(value.strip()) < 2:
            raise serializers.ValidationError(_('Il nome deve essere di almeno 2 caratteri.'))
        return value.strip() if value else value
    
    def validate_last_name(self, value):
        if value and value.strip() and len(value.strip()) < 2:
            raise serializers.ValidationError(_('Il cognome deve essere di almeno 2 caratteri.'))
        return value.strip() if value else value
    
    def validate_email(self, value):
        """Validazione personalizzata per l'email."""
        if value and value.strip():
            validate_email(value)
            # Verifica unicità dell'email (escludendo l'istanza corrente)
            if self.instance and UserProfile.objects.exclude(pk=self.instance.pk).filter(email=value).exists():
                raise serializers.ValidationError(_('Un utente con questa email esiste già.'))
        return value.strip() if value else value
    
    def validate_phone_number(self, value):
        """Validazione del numero di telefono."""
        if value and value.strip():
            try:
                phone_number = phonenumbers.parse(value.strip(), None)
                if not phonenumbers.is_valid_number(phone_number):
                    raise serializers.ValidationError(_('Numero di telefono non valido.'))
                # Formatta il numero in formato internazionale
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
            except NumberParseException:
                raise serializers.ValidationError(_('Formato numero di telefono non valido.'))
        return value.strip() if value else value
    
    def validate_date_of_birth(self, value):
        """Validazione della data di nascita."""
        if value:
            today = date.today()
            if value > today:
                raise serializers.ValidationError(_('La data di nascita non può essere nel futuro.'))
            # Verifica età minima (es. 13 anni)
            min_age = today.replace(year=today.year - 13)
            if value > min_age:
                raise serializers.ValidationError(_('L\'età minima richiesta è di 13 anni.'))
        return value
    
    def validate_bio(self, value):
        """Validazione della biografia."""
        if value and len(value.strip()) > 500:
            raise serializers.ValidationError(_('La biografia non può superare i 500 caratteri.'))
        return value.strip() if value else value

class UserPreferencesSerializer(serializers.ModelSerializer):
    """
    Serializer specifico per le preferenze utente.
    """
    class Meta:
        model = UserProfile
        fields = ['preferences']
    
    def validate_preferences(self, value):
        """Validazione avanzata delle preferenze."""
        if not isinstance(value, dict):
            raise serializers.ValidationError(_('Le preferenze devono essere un oggetto JSON valido.'))
        
        # Validazione struttura preferenze comuni
        allowed_themes = ['light', 'dark', 'auto']
        if 'theme' in value and value['theme'] not in allowed_themes:
            raise serializers.ValidationError(
                _('Tema non valido. Valori consentiti: %(themes)s') % {'themes': ', '.join(allowed_themes)}
            )
        
        if 'language' in value:
            allowed_languages = ['it', 'en', 'es', 'fr', 'de']
            if value['language'] not in allowed_languages:
                raise serializers.ValidationError(
                    _('Lingua non valida. Valori consentiti: %(languages)s') % {'languages': ', '.join(allowed_languages)}
                )
        
        if 'notifications' in value:
            if not isinstance(value['notifications'], dict):
                raise serializers.ValidationError(_('Le impostazioni notifiche devono essere un oggetto.'))
        
        return value

class UserProfilePublicSerializer(serializers.ModelSerializer):
    """
    Serializer per informazioni pubbliche del profilo utente.
    Utilizzato per visualizzazioni pubbliche limitate.
    """
    full_name = serializers.ReadOnlyField()
    public_name = serializers.ReadOnlyField()
    
    class Meta:
        model = UserProfile
        fields = [
            'user_id', 'public_name', 'display_name', 'profile_picture_url',
            'bio', 'location', 'status', 'created_at'
        ]
        read_only_fields = '__all__'

class UserActivityLogSerializer(serializers.ModelSerializer):
    """
    Serializer per i log delle attività utente.
    """
    user_profile_name = serializers.CharField(source='user_profile.public_name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'user_profile', 'user_profile_name', 'action', 'action_display',
            'description', 'ip_address', 'user_agent', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'user_profile_name', 'action_display']

class UserStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer per l'aggiornamento dello stato utente.
    Utilizzato tipicamente da amministratori.
    """
    class Meta:
        model = UserProfile
        fields = ['status']
    
    def validate_status(self, value):
        """Validazione dello stato."""
        valid_statuses = [choice[0] for choice in UserProfile.STATUS_CHOICES]
        if value not in valid_statuses:
            raise serializers.ValidationError(
                _('Stato non valido. Valori consentiti: %(statuses)s') % {'statuses': ', '.join(valid_statuses)}
            )
        return value

class UserProfileSummarySerializer(serializers.ModelSerializer):
    """
    Serializer per riassunto del profilo utente.
    Utilizzato per liste e overview.
    """
    full_name = serializers.ReadOnlyField()
    public_name = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'user_id', 'full_name', 'public_name', 'email', 'status',
            'status_display', 'last_activity', 'created_at'
        ]
        read_only_fields = '__all__' 