from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
import logging
import uuid
import os

from .models import UserProfile, UserActivityLog
from .serializers import (
    UserProfileSerializer,
    UserProfileCreateSerializer,
    UserProfileUpdateSerializer,
    UserPreferencesSerializer,
    UserProfilePublicSerializer,
    UserActivityLogSerializer,
    UserStatusUpdateSerializer,
    UserProfileSummarySerializer
)
from .permissions import IsOwnerOrReadOnly, IsAdminOrOwner, InternalServicePermission

logger = logging.getLogger('user_api')

class UserProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet per la gestione completa dei profili utente.
    
    Fornisce endpoint per:
    - CRUD completo sui profili utente
    - Gestione preferenze
    - Upload avatar
    - Gestione stato utente
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = 'user_id'
    
    def get_permissions(self):
        """
        Restituisce i permessi appropriati per l'azione.
        Per le operazioni di creazione, consente chiamate inter-service.
        """
        if self.action == 'create':
            # Per la creazione, consenti sia autenticazione normale che inter-service
            return [permissions.AllowAny()]
        return super().get_permissions()
    
    def get_queryset(self):
        """
        Filtra i profili in base al ruolo dell'utente.
        Gli utenti normali vedono solo il proprio profilo.
        Gli admin vedono tutti i profili.
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return UserProfile.objects.all()
        else:
            # Gli utenti normali vedono solo il proprio profilo
            return UserProfile.objects.filter(user_id=user.id)
    
    def get_serializer_class(self):
        """
        Restituisce il serializer appropriato per l'azione.
        """
        if self.action == 'create':
            return UserProfileCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserProfileUpdateSerializer
        elif self.action == 'preferences':
            return UserPreferencesSerializer
        elif self.action == 'public_profile':
            return UserProfilePublicSerializer
        elif self.action == 'status_update':
            return UserStatusUpdateSerializer
        elif self.action == 'list':
            return UserProfileSummarySerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        """
        Crea un nuovo profilo utente.
        L'user_id viene preso dal token JWT o può essere specificato per comunicazioni interne.
        """
        user_id = serializer.validated_data.get('user_id')
        
        # Se user_id non è specificato, usa l'ID dell'utente autenticato
        if not user_id:
            user_id = self.request.user.id
        
        # Verifica che il profilo non esista già
        if UserProfile.objects.filter(user_id=user_id).exists():
            logger.warning(f"Tentativo di creare profilo duplicato per utente {user_id}")
            raise ValidationError(_('Profilo utente già esistente'))
        
        serializer.save(user_id=user_id)
        
        # Log dell'attività
        self._log_activity(
            user_id=user_id,
            action='profile_create',
            description='Profilo utente creato'
        )
        
        logger.info(f"Profilo utente creato per {user_id}")
    
    def perform_update(self, serializer):
        """
        Aggiorna un profilo utente esistente.
        """
        instance = serializer.save()
        
        # Log dell'attività
        self._log_activity(
            user_id=instance.user_id,
            action='profile_update',
            description='Profilo utente aggiornato'
        )
        
        logger.info(f"Profilo utente aggiornato per {instance.user_id}")
    
    @action(detail=True, methods=['get', 'put'], url_path='preferences')
    def preferences(self, request, user_id=None):
        """
        Endpoint per gestire le preferenze utente.
        GET: Recupera le preferenze
        PUT: Aggiorna le preferenze
        """
        profile = self.get_object()
        
        if request.method == 'GET':
            return Response({'preferences': profile.preferences})
        
        elif request.method == 'PUT':
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # Log dell'attività
            self._log_activity(
                user_id=profile.user_id,
                action='preference_update',
                description='Preferenze utente aggiornate'
            )
            
            return Response({'preferences': profile.preferences})
    
    @action(detail=True, methods=['post'], url_path='upload-avatar')
    def upload_avatar(self, request, user_id=None):
        """
        Endpoint per il caricamento dell'avatar utente.
        """
        profile = self.get_object()
        
        if 'avatar' not in request.FILES:
            return Response(
                {'error': _('Nessun file avatar fornito')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        avatar_file = request.FILES['avatar']
        
        # Validazione dimensione file
        if avatar_file.size > settings.MAX_PROFILE_PICTURE_SIZE:
            return Response(
                {'error': _('File troppo grande. Dimensione massima: %(size)s MB') % {
                    'size': settings.MAX_PROFILE_PICTURE_SIZE // (1024 * 1024)
                }},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validazione formato file
        file_extension = avatar_file.name.split('.')[-1].lower()
        if file_extension not in settings.ALLOWED_IMAGE_FORMATS:
            return Response(
                {'error': _('Formato file non supportato. Formati consentiti: %(formats)s') % {
                    'formats': ', '.join(settings.ALLOWED_IMAGE_FORMATS)
                }},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Qui dovresti integrare con il resource_manager_service per salvare il file
        # Per ora simulo il salvataggio
        avatar_url = f"/media/avatars/{profile.user_id}_{avatar_file.name}"
        
        profile.profile_picture_url = avatar_url
        profile.save(update_fields=['profile_picture_url'])
        
        # Log dell'attività
        self._log_activity(
            user_id=profile.user_id,
            action='avatar_upload',
            description=f'Avatar caricato: {avatar_file.name}'
        )
        
        return Response({
            'message': _('Avatar caricato con successo'),
            'avatar_url': avatar_url
        })
    
    @action(detail=True, methods=['get'], url_path='public')
    def public_profile(self, request, user_id=None):
        """
        Endpoint per visualizzare informazioni pubbliche del profilo.
        """
        profile = self.get_object()
        serializer = self.get_serializer(profile)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'], url_path='status', 
            permission_classes=[permissions.IsAuthenticated, permissions.IsAdminUser])
    def status_update(self, request, user_id=None):
        """
        Endpoint per aggiornare lo stato dell'utente.
        Solo per amministratori.
        """
        profile = self.get_object()
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        old_status = profile.status
        serializer.save()
        
        # Log dell'attività
        self._log_activity(
            user_id=profile.user_id,
            action='status_update',
            description=f'Stato cambiato da {old_status} a {profile.status}'
        )
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='activity-logs')
    def activity_logs(self, request, user_id=None):
        """
        Endpoint per recuperare i log delle attività dell'utente.
        """
        profile = self.get_object()
        logs = UserActivityLog.objects.filter(user_profile=profile).order_by('-created_at')
        
        # Paginazione
        page = self.paginate_queryset(logs)
        serializer = UserActivityLogSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
    
    @action(detail=False, methods=['get', 'patch', 'put'], url_path='me')
    def me(self, request):
        """
        Endpoint per gestire il profilo dell'utente corrente.
        GET: Recupera il profilo
        PATCH/PUT: Aggiorna il profilo
        Crea automaticamente il profilo se non esiste.
        """
        profile, created = UserProfile.objects.get_or_create(
            user_id=request.user.id,
            defaults={
                'status': settings.DEFAULT_USER_STATUS,
                'preferences': {}
            }
        )
        
        if created:
            logger.info(f"Profilo creato automaticamente per utente {request.user.id}")
            self._log_activity(
                user_id=request.user.id,
                action='profile_auto_create',
                description='Profilo utente creato automaticamente'
            )
        
        if request.method == 'GET':
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        
        elif request.method in ['PATCH', 'PUT']:
            # Usa il serializer di aggiornamento
            partial = request.method == 'PATCH'
            serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=partial)
            
            if not serializer.is_valid():
                logger.error(f"Errore validazione profilo per utente {profile.user_id}: {serializer.errors}")
                logger.error(f"Dati ricevuti: {request.data}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            serializer.save()
            
            # Log dell'attività
            self._log_activity(
                user_id=profile.user_id,
                action='profile_update',
                description='Profilo utente aggiornato tramite /me'
            )
            
            logger.info(f"Profilo utente aggiornato per {profile.user_id}")
            
            # Restituisci il profilo aggiornato con il serializer completo
            response_serializer = self.get_serializer(profile)
            return Response(response_serializer.data)
    
    @action(detail=False, methods=['post'], url_path='me/upload-avatar')
    def me_upload_avatar(self, request):
        """
        Endpoint per il caricamento dell'avatar dell'utente corrente.
        """
        profile, created = UserProfile.objects.get_or_create(
            user_id=request.user.id,
            defaults={
                'status': settings.DEFAULT_USER_STATUS,
                'preferences': {}
            }
        )
        
        if 'avatar' not in request.FILES:
            return Response(
                {'error': _('Nessun file avatar fornito')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        avatar_file = request.FILES['avatar']
        
        # Validazione dimensione file
        max_size = getattr(settings, 'MAX_PROFILE_PICTURE_SIZE', 5 * 1024 * 1024)  # Default 5MB
        if avatar_file.size > max_size:
            return Response(
                {'error': _('File troppo grande. Dimensione massima: %(size)s MB') % {
                    'size': max_size // (1024 * 1024)
                }},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validazione formato file
        file_extension = avatar_file.name.split('.')[-1].lower()
        allowed_formats = getattr(settings, 'ALLOWED_IMAGE_FORMATS', ['jpg', 'jpeg', 'png', 'gif'])
        if file_extension not in allowed_formats:
            return Response(
                {'error': _('Formato file non supportato. Formati consentiti: %(formats)s') % {
                    'formats': ', '.join(allowed_formats)
                }},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Salva il file nella directory media
        # Crea la directory avatars se non esiste
        avatar_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
        os.makedirs(avatar_dir, exist_ok=True)
        
        # Nome file sicuro
        safe_filename = f"{profile.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = os.path.join(avatar_dir, safe_filename)
        
        # Salva il file
        with open(file_path, 'wb+') as destination:
            for chunk in avatar_file.chunks():
                destination.write(chunk)
        
        avatar_url = f"/media/avatars/{safe_filename}"
        profile.profile_picture_url = avatar_url
        profile.save(update_fields=['profile_picture_url'])
        
        # Log dell'attività
        self._log_activity(
            user_id=profile.user_id,
            action='avatar_upload',
            description=f'Avatar caricato: {avatar_file.name}'
        )
        
        logger.info(f"Avatar caricato per utente {profile.user_id}: {avatar_file.name}")
        
        return Response({
            'message': _('Avatar caricato con successo'),
            'profile_picture_url': avatar_url
        })

    @action(detail=False, methods=['get', 'put'], url_path='me/preferences')
    def me_preferences(self, request):
        """
        Endpoint per gestire le preferenze dell'utente corrente.
        GET: Recupera le preferenze
        PUT: Aggiorna le preferenze
        """
        profile, created = UserProfile.objects.get_or_create(
            user_id=request.user.id,
            defaults={
                'status': settings.DEFAULT_USER_STATUS,
                'preferences': {}
            }
        )
        
        if request.method == 'GET':
            return Response({'preferences': profile.preferences})
        
        elif request.method == 'PUT':
            if 'preferences' in request.data:
                profile.preferences = request.data['preferences']
                profile.save(update_fields=['preferences'])
                
                # Log dell'attività
                self._log_activity(
                    user_id=profile.user_id,
                    action='preference_update',
                    description='Preferenze utente aggiornate'
                )
                
                return Response({'preferences': profile.preferences})
            else:
                return Response(
                    {'error': _('Campo preferences richiesto')},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        Endpoint per ottenere statistiche sui profili utente.
        Solo per amministratori.
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'error': _('Permessi non sufficienti')},
                status=status.HTTP_403_FORBIDDEN
            )
        
        queryset = UserProfile.objects.all()
        stats = {
            'total_users': queryset.count(),
            'active_users': queryset.filter(status='active').count(),
            'inactive_users': queryset.filter(status='inactive').count(),
            'suspended_users': queryset.filter(status='suspended').count(),
            'pending_users': queryset.filter(status='pending').count(),
        }
        
        return Response(stats)
    
    def _log_activity(self, user_id, action, description, metadata=None):
        """
        Helper method per loggare le attività dell'utente.
        """
        try:
            profile = UserProfile.objects.get(user_id=user_id)
            UserActivityLog.objects.create(
                user_profile=profile,
                action=action,
                description=description,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata=metadata or {}
            )
        except UserProfile.DoesNotExist:
            logger.warning(f"Tentativo di loggare attività per profilo inesistente: {user_id}")

class UserProfilePublicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet per la visualizzazione pubblica dei profili utente.
    Solo informazioni pubbliche, senza autenticazione richiesta.
    """
    serializer_class = UserProfilePublicSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'user_id'
    
    def get_queryset(self):
        """
        Restituisce solo i profili attivi per visualizzazione pubblica.
        """
        return UserProfile.objects.filter(status='active')

class UserActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet per la visualizzazione dei log delle attività.
    Solo lettura, per amministratori.
    """
    serializer_class = UserActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    
    def get_queryset(self):
        """
        Filtra i log per utente se specificato.
        """
        queryset = UserActivityLog.objects.all().order_by('-created_at')
        user_id = self.request.query_params.get('user_id')
        
        if user_id:
            try:
                profile = UserProfile.objects.get(user_id=user_id)
                queryset = queryset.filter(user_profile=profile)
            except UserProfile.DoesNotExist:
                queryset = queryset.none()
        
        return queryset 