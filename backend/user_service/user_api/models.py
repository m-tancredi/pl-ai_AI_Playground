import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
import phonenumbers
from phonenumbers import NumberParseException

User = get_user_model()

class BaseModel(models.Model):
    """
    Modello base con campi comuni per tutti i modelli.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True

def validate_phone_number(value):
    """
    Valida il numero di telefono usando la libreria phonenumbers.
    """
    try:
        phone_number = phonenumbers.parse(value, None)
        if not phonenumbers.is_valid_number(phone_number):
            raise ValidationError(_('Numero di telefono non valido.'))
    except NumberParseException:
        raise ValidationError(_('Formato numero di telefono non valido.'))

class UserProfile(BaseModel):
    """
    Modello per il profilo utente completo.
    Gestisce tutte le informazioni utente non correlate all'autenticazione.
    """
    STATUS_CHOICES = [
        ('active', _('Attivo')),
        ('inactive', _('Inattivo')),
        ('suspended', _('Sospeso')),
        ('pending', _('In attesa')),
    ]
    
    # Collegamento all'utente di auth_service
    user_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_('ID utente collegato ad auth_service')
    )
    
    # Informazioni personali base
    first_name = models.CharField(
        max_length=150,
        verbose_name=_('Nome'),
        help_text=_('Nome dell\'utente')
    )
    last_name = models.CharField(
        max_length=150,
        verbose_name=_('Cognome'),
        help_text=_('Cognome dell\'utente')
    )
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        verbose_name=_('Username'),
        help_text=_('Nome utente univoco')
    )
    display_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('Nome visualizzato'),
        help_text=_('Nome pubblico visualizzato (opzionale)')
    )
    
    # Contatti
    email = models.EmailField(
        blank=True,
        verbose_name=_('Email'),
        help_text=_('Indirizzo email dell\'utente')
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        validators=[validate_phone_number],
        verbose_name=_('Numero di telefono'),
        help_text=_('Numero di telefono in formato internazionale (es. +39...)')
    )
    
    # Profilo esteso
    profile_picture_url = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name=_('URL immagine profilo'),
        help_text=_('URL o path dell\'immagine del profilo')
    )
    bio = models.TextField(
        blank=True,
        null=True,
        max_length=500,
        verbose_name=_('Biografia'),
        help_text=_('Breve descrizione dell\'utente (max 500 caratteri)')
    )
    location = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('Località'),
        help_text=_('Città o località dell\'utente (es. "Bologna, Italia")')
    )
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        verbose_name=_('Data di nascita'),
        help_text=_('Data di nascita dell\'utente')
    )
    
    # Preferenze e impostazioni (JSON field)
    preferences = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Preferenze'),
        help_text=_('Preferenze e impostazioni personalizzate dell\'utente')
    )
    
    # Stato dell'account
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name=_('Stato'),
        help_text=_('Stato corrente dell\'account utente')
    )
    
    # Metadata
    last_activity = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_('Ultima attività'),
        help_text=_('Timestamp dell\'ultima attività dell\'utente')
    )
    
    # Onboarding Status
    registration_completed = models.BooleanField(
        default=False,
        verbose_name=_('Registrazione completata'),
        help_text=_('Indica se l\'utente ha completato il processo di onboarding')
    )
    
    class Meta:
        db_table = 'user_profiles'
        ordering = ['-created_at']
        verbose_name = _('Profilo Utente')
        verbose_name_plural = _('Profili Utente')
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['status']),
            models.Index(fields=['last_activity']),
        ]
    
    def __str__(self):
        display = self.display_name or f"{self.first_name} {self.last_name}"
        return f"{display} ({self.user_id})"
    
    @property
    def full_name(self):
        """Restituisce il nome completo dell'utente."""
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def public_name(self):
        """Restituisce il nome pubblico (display_name o nome completo)."""
        return self.display_name or self.full_name
    
    def get_preference(self, key, default=None):
        """Recupera una preferenza specifica."""
        return self.preferences.get(key, default)
    
    def set_preference(self, key, value):
        """Imposta una preferenza specifica."""
        if not isinstance(self.preferences, dict):
            self.preferences = {}
        self.preferences[key] = value
    
    def update_last_activity(self):
        """Aggiorna il timestamp dell'ultima attività."""
        from django.utils import timezone
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])
    
    def is_active_user(self):
        """Verifica se l'utente è attivo."""
        return self.status == 'active'

class UserActivityLog(BaseModel):
    """
    Modello per tracciare le attività dell'utente.
    Opzionale - per cronologia e audit.
    """
    ACTION_CHOICES = [
        ('profile_update', _('Aggiornamento profilo')),
        ('preference_update', _('Aggiornamento preferenze')),
        ('avatar_upload', _('Caricamento avatar')),
        ('login', _('Accesso')),
        ('logout', _('Disconnessione')),
    ]
    
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='activity_logs',
        verbose_name=_('Profilo utente')
    )
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        verbose_name=_('Azione')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Descrizione'),
        help_text=_('Descrizione dettagliata dell\'azione')
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name=_('Indirizzo IP')
    )
    user_agent = models.TextField(
        blank=True,
        verbose_name=_('User Agent')
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Metadati'),
        help_text=_('Dati aggiuntivi relativi all\'azione')
    )
    
    class Meta:
        db_table = 'user_activity_logs'
        ordering = ['-created_at']
        verbose_name = _('Log Attività Utente')
        verbose_name_plural = _('Log Attività Utenti')
        indexes = [
            models.Index(fields=['user_profile', '-created_at']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.user_profile.public_name} - {self.get_action_display()} ({self.created_at})" 