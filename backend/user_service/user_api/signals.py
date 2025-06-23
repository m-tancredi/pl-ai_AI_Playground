from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.contrib.auth import get_user_model
import logging

from .models import UserProfile, UserActivityLog

User = get_user_model()
logger = logging.getLogger('user_api')

@receiver(post_save, sender=UserProfile)
def user_profile_post_save(sender, instance, created, **kwargs):
    """
    Signal handler che viene eseguito dopo il salvataggio di un UserProfile.
    """
    if created:
        # Log della creazione del profilo
        logger.info(f"Nuovo profilo utente creato: {instance.user_id}")
        
        # Imposta le preferenze di default se non specificate
        if not instance.preferences:
            default_preferences = {
                'theme': 'light',
                'language': 'it',
                'notifications': {
                    'email': True,
                    'push': True,
                    'sms': False
                },
                'privacy': {
                    'profile_visible': True,
                    'show_email': False,
                    'show_phone': False
                }
            }
            instance.preferences = default_preferences
            instance.save(update_fields=['preferences'])
            
            logger.info(f"Preferenze di default impostate per utente {instance.user_id}")
    else:
        # Log dell'aggiornamento del profilo
        logger.info(f"Profilo utente aggiornato: {instance.user_id}")

@receiver(pre_save, sender=UserProfile)
def user_profile_pre_save(sender, instance, **kwargs):
    """
    Signal handler che viene eseguito prima del salvataggio di un UserProfile.
    """
    # Normalizza i campi stringa
    if instance.first_name:
        instance.first_name = instance.first_name.strip().title()
    if instance.last_name:
        instance.last_name = instance.last_name.strip().title()
    if instance.display_name:
        instance.display_name = instance.display_name.strip()
    if instance.location:
        instance.location = instance.location.strip()
    
    # Controlla se lo stato è cambiato
    if instance.pk:
        try:
            old_instance = UserProfile.objects.get(pk=instance.pk)
            if old_instance.status != instance.status:
                logger.info(f"Stato utente {instance.user_id} cambiato da {old_instance.status} a {instance.status}")
                
                # Log automatico del cambio stato
                try:
                    UserActivityLog.objects.create(
                        user_profile=instance,
                        action='status_change',
                        description=f'Stato cambiato da {old_instance.status} a {instance.status}',
                        metadata={
                            'old_status': old_instance.status,
                            'new_status': instance.status,
                            'changed_at': timezone.now().isoformat()
                        }
                    )
                except Exception as e:
                    logger.error(f"Errore nel creare log attività per cambio stato: {e}")
        except UserProfile.DoesNotExist:
            pass

@receiver(post_delete, sender=UserProfile)
def user_profile_post_delete(sender, instance, **kwargs):
    """
    Signal handler che viene eseguito dopo l'eliminazione di un UserProfile.
    """
    logger.warning(f"Profilo utente eliminato: {instance.user_id}")
    
    # Nota: I log delle attività verranno eliminati automaticamente 
    # grazie alla relazione CASCADE nel modello

# Signal personalizzati per comunicazione inter-service
from django.dispatch import Signal

# Signal che viene emesso quando un profilo utente viene creato
user_profile_created = Signal()

# Signal che viene emesso quando un profilo utente viene aggiornato  
user_profile_updated = Signal()

# Signal che viene emesso quando lo stato di un utente cambia
user_status_changed = Signal()

@receiver(post_save, sender=UserProfile)
def emit_user_profile_signals(sender, instance, created, **kwargs):
    """
    Emette signal personalizzati per comunicazione inter-service.
    """
    if created:
        user_profile_created.send(
            sender=sender,
            user_profile=instance,
            user_id=instance.user_id
        )
        logger.debug(f"Signal user_profile_created emesso per {instance.user_id}")
    else:
        user_profile_updated.send(
            sender=sender,
            user_profile=instance,
            user_id=instance.user_id
        )
        logger.debug(f"Signal user_profile_updated emesso per {instance.user_id}")

# Handler per comunicazione con altri servizi
def notify_auth_service_user_updated(sender, user_profile, user_id, **kwargs):
    """
    Notifica l'auth_service quando un profilo utente viene aggiornato.
    Questo è un esempio di come implementare la comunicazione inter-service.
    """
    try:
        # Qui implementeresti la logica per notificare l'auth_service
        # Es. chiamata HTTP, messaggio in coda, etc.
        
        logger.info(f"Notificando auth_service dell'aggiornamento utente {user_id}")
        
        # Esempio di payload che potresti inviare
        payload = {
            'user_id': str(user_id),
            'action': 'profile_updated',
            'data': {
                'email': user_profile.email,
                'status': user_profile.status,
                'last_activity': user_profile.last_activity.isoformat() if user_profile.last_activity else None
            }
        }
        
        # Implementa qui la logica di comunicazione
        # requests.post(f"{settings.AUTH_SERVICE_INTERNAL_URL}/api/users/{user_id}/sync/", json=payload)
        
    except Exception as e:
        logger.error(f"Errore nella notifica ad auth_service: {e}")

# Collega il handler al signal
user_profile_updated.connect(notify_auth_service_user_updated)

def create_activity_log_from_signal(sender, user_profile, action, description, metadata=None, **kwargs):
    """
    Crea un log delle attività da un signal.
    """
    try:
        UserActivityLog.objects.create(
            user_profile=user_profile,
            action=action,
            description=description,
            metadata=metadata or {}
        )
        logger.debug(f"Log attività creato: {action} per utente {user_profile.user_id}")
    except Exception as e:
        logger.error(f"Errore nella creazione del log attività: {e}")

# Esempi di utilizzo dei signal personalizzati:
# user_profile_created.connect(handler_function)
# user_status_changed.connect(another_handler_function) 