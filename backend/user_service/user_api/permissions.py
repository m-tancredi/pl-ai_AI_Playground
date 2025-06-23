from rest_framework import permissions
from django.utils.translation import gettext_lazy as _

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permesso personalizzato per consentire solo ai proprietari di un oggetto di modificarlo.
    Lettura consentita per tutti gli utenti autenticati.
    """
    
    def has_object_permission(self, request, view, obj):
        # Permessi di lettura per tutti gli utenti autenticati
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Permessi di scrittura solo per il proprietario dell'oggetto
        # Nel caso del UserProfile, confrontiamo user_id
        if hasattr(obj, 'user_id'):
            return str(obj.user_id) == str(request.user.id)
        
        return False

class IsAdminOrOwner(permissions.BasePermission):
    """
    Permesso personalizzato per consentire l'accesso agli amministratori o ai proprietari.
    """
    
    def has_permission(self, request, view):
        # Deve essere autenticato
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin ha sempre accesso
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Per le azioni che non richiedono un oggetto specifico
        return True
    
    def has_object_permission(self, request, view, obj):
        # Admin ha sempre accesso
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Proprietario ha accesso al proprio oggetto
        if hasattr(obj, 'user_id'):
            return str(obj.user_id) == str(request.user.id)
        
        return False

class IsOwnerOnly(permissions.BasePermission):
    """
    Permesso che consente l'accesso solo al proprietario dell'oggetto.
    """
    
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'user_id'):
            return str(obj.user_id) == str(request.user.id)
        
        return False

class IsAdminOnly(permissions.BasePermission):
    """
    Permesso che consente l'accesso solo agli amministratori.
    """
    
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)

class IsActiveUser(permissions.BasePermission):
    """
    Permesso che verifica se l'utente ha un profilo attivo.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin ha sempre accesso
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Verifica se l'utente ha un profilo attivo
        from .models import UserProfile
        try:
            profile = UserProfile.objects.get(user_id=request.user.id)
            return profile.is_active_user()
        except UserProfile.DoesNotExist:
            # Se non ha un profilo, può comunque accedere per crearlo
            return True

class CanModifyProfile(permissions.BasePermission):
    """
    Permesso composito che verifica multiple condizioni per la modifica del profilo.
    """
    
    def has_object_permission(self, request, view, obj):
        # Admin può sempre modificare
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Solo il proprietario può modificare il proprio profilo
        if not (hasattr(obj, 'user_id') and str(obj.user_id) == str(request.user.id)):
            return False
        
        # Verifica che il profilo non sia sospeso (eccetto per admin)
        if hasattr(obj, 'status') and obj.status == 'suspended':
            return False
        
        return True

class InternalServicePermission(permissions.BasePermission):
    """
    Permesso per comunicazioni interne tra servizi.
    Verifica l'header X-Internal-Secret.
    """
    
    def has_permission(self, request, view):
        from django.conf import settings
        
        internal_header = request.headers.get(settings.INTERNAL_API_SECRET_HEADER_NAME)
        
        if not internal_header:
            return False
        
        return internal_header == settings.INTERNAL_API_SECRET_VALUE 