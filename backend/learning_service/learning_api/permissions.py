from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permesso personalizzato per permettere solo ai proprietari di modificare.
    """
    
    def has_object_permission(self, request, view, obj):
        # Permessi di lettura per tutti gli utenti autenticati
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Permessi di scrittura solo per il proprietario
        # Gestisce oggetti con user_id diretto o tramite lesson
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
        elif hasattr(obj, 'lesson') and hasattr(obj.lesson, 'user_id'):
            return obj.lesson.user_id == request.user.id
        else:
            return False


class IsOwnerOnly(permissions.BasePermission):
    """
    Solo il proprietario può accedere.
    """
    
    def has_object_permission(self, request, view, obj):
        # Gestisce oggetti con user_id diretto o tramite lesson
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
        elif hasattr(obj, 'lesson') and hasattr(obj.lesson, 'user_id'):
            return obj.lesson.user_id == request.user.id
        else:
            return False


class IsAdminOrOwner(permissions.BasePermission):
    """
    Permesso per admin o proprietario dell'oggetto.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Admin può fare tutto
        if request.user.is_staff:
            return True
        
        # Proprietario può modificare i propri oggetti
        # Gestisce oggetti con user_id diretto o tramite lesson
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
        elif hasattr(obj, 'lesson') and hasattr(obj.lesson, 'user_id'):
            return obj.lesson.user_id == request.user.id
        else:
            return False


class CanAccessLearningService(permissions.BasePermission):
    """
    Permesso base per accedere al Learning Service.
    """
    
    def has_permission(self, request, view):
        return (request.user and 
                request.user.is_authenticated and 
                hasattr(request.user, 'id'))


class CanGenerateContent(permissions.BasePermission):
    """
    Permesso per generare contenuti AI (lezioni, quiz, approfondimenti).
    """
    
    def has_permission(self, request, view):
        # Solo utenti autenticati possono generare contenuti
        if not (request.user and request.user.is_authenticated):
            return False
        
        # Qui si potrebbero aggiungere controlli aggiuntivi come:
        # - Limite giornaliero di generazioni
        # - Tipo di piano utente
        # - Rate limiting per prevenire abusi
        
        return True


class CanViewUserProgress(permissions.BasePermission):
    """
    Permesso per visualizzare i progressi utente.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # L'utente può vedere solo i propri progressi, admin può vedere tutti
        return (request.user.is_staff or 
                obj.user_id == request.user.id)


class CanSubmitQuizAnswers(permissions.BasePermission):
    """
    Permesso per inviare risposte ai quiz.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Verifica che l'utente possa rispondere al quiz
        # (il quiz appartiene a una lezione dell'utente)
        if hasattr(obj, 'quiz'):
            return obj.quiz.lesson.user_id == request.user.id
        return False 