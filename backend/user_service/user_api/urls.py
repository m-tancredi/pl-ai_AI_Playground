from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router per le API RESTful
router = DefaultRouter()
router.register(r'users', views.UserProfileViewSet, basename='userprofile')
router.register(r'users-public', views.UserProfilePublicViewSet, basename='userprofile-public')
router.register(r'activity-logs', views.UserActivityLogViewSet, basename='useractivitylog')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Endpoint personalizzati aggiuntivi se necessari
    # path('custom-endpoint/', views.custom_view, name='custom-endpoint'),
]

# URL patterns per riferimento:
# 
# UserProfile endpoints:
# GET    /api/users/                    -> Lista profili (admin) / proprio profilo (user)
# POST   /api/users/                   -> Crea nuovo profilo
# GET    /api/users/{user_id}/         -> Dettagli profilo specifico
# PUT    /api/users/{user_id}/         -> Aggiorna profilo completo
# PATCH  /api/users/{user_id}/         -> Aggiorna profilo parziale
# DELETE /api/users/{user_id}/         -> Elimina profilo
# GET    /api/users/me/                -> Profilo utente corrente
# GET    /api/users/stats/             -> Statistiche utenti (admin)
# GET    /api/users/{user_id}/preferences/     -> Preferenze utente
# PUT    /api/users/{user_id}/preferences/     -> Aggiorna preferenze
# POST   /api/users/{user_id}/upload-avatar/   -> Carica avatar
# GET    /api/users/{user_id}/public/          -> Profilo pubblico
# PATCH  /api/users/{user_id}/status/          -> Aggiorna stato (admin)
# GET    /api/users/{user_id}/activity-logs/   -> Log attività utente
#
# UserProfilePublic endpoints:
# GET    /api/users-public/            -> Lista profili pubblici
# GET    /api/users-public/{user_id}/  -> Profilo pubblico specifico
#
# UserActivityLog endpoints:
# GET    /api/activity-logs/           -> Lista log attività (admin)
# GET    /api/activity-logs/{id}/      -> Dettagli log specifico (admin) 