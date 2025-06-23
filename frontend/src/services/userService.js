import apiClient from './apiClient';

// User Service API Endpoints per user_service microservizio
const USER_ENDPOINTS = {
  list: '/api/users/',
  detail: '/api/users/{id}/',
  me: '/api/users/me/',
  preferences: '/api/users/{id}/preferences/',
  uploadAvatar: '/api/users/{id}/upload-avatar/',
  public: '/api/users/{id}/public/',
  publicList: '/api/users-public/',
  stats: '/api/users/stats/',
  activityLogs: '/api/users/{id}/activity-logs/',
  status: '/api/users/{id}/status/',
};

/**
 * User Service - Integrazione con user_service microservizio
 * Gestisce profili utente, preferenze, avatar e attività
 */
export const userService = {
  
  // === PROFILO UTENTE ===
  
  /**
   * Recupera il profilo dell'utente corrente
   */
  getMyProfile: async () => {
    try {
      const response = await apiClient.get(USER_ENDPOINTS.me);
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero profilo:', error);
      throw error;
    }
  },

  /**
   * Recupera profilo utente specifico (per admin o visualizzazione pubblica)
   */
  getUserProfile: async (userId) => {
    try {
      const response = await apiClient.get(
        USER_ENDPOINTS.detail.replace('{id}', userId)
      );
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero profilo utente:', error);
      throw error;
    }
  },

  /**
   * Aggiorna il profilo dell'utente corrente
   */
  updateProfile: async (profileData) => {
    try {
      const response = await apiClient.patch(USER_ENDPOINTS.me, profileData);
      return response.data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento profilo:', error);
      throw error;
    }
  },

  /**
   * Crea un nuovo profilo utente (solitamente chiamato dopo registrazione)
   */
  createProfile: async (profileData) => {
    try {
      const response = await apiClient.post(USER_ENDPOINTS.list, profileData);
      return response.data;
    } catch (error) {
      console.error('Errore nella creazione profilo:', error);
      throw error;
    }
  },

  // === PREFERENZE UTENTE ===

  /**
   * Recupera le preferenze dell'utente
   */
  getUserPreferences: async (userId = null) => {
    try {
      const endpoint = userId 
        ? USER_ENDPOINTS.preferences.replace('{id}', userId)
        : USER_ENDPOINTS.me + 'preferences/';
      
      const response = await apiClient.get(endpoint);
      return response.data.preferences || {};
    } catch (error) {
      console.error('Errore nel recupero preferenze:', error);
      throw error;
    }
  },

  /**
   * Aggiorna le preferenze dell'utente
   */
  updatePreferences: async (preferences, userId = null) => {
    try {
      const endpoint = userId 
        ? USER_ENDPOINTS.preferences.replace('{id}', userId)
        : USER_ENDPOINTS.me + 'preferences/';
      
      const response = await apiClient.put(endpoint, { preferences });
      return response.data.preferences;
    } catch (error) {
      console.error('Errore nell\'aggiornamento preferenze:', error);
      throw error;
    }
  },

  /**
   * Aggiorna una preferenza specifica
   */
  updateSinglePreference: async (key, value, userId = null) => {
    try {
      const currentPrefs = await userService.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs, [key]: value };
      return await userService.updatePreferences(updatedPrefs, userId);
    } catch (error) {
      console.error('Errore nell\'aggiornamento preferenza:', error);
      throw error;
    }
  },

  // === AVATAR E MEDIA ===

  /**
   * Carica un nuovo avatar per l'utente
   */
  uploadAvatar: async (file, userId = null) => {
    try {
      if (!file) {
        throw new Error('File avatar richiesto');
      }

      // Validazione client-side
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Formato file non supportato. Usa JPG, PNG o GIF.');
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File troppo grande. Massimo 5MB.');
      }

      const formData = new FormData();
      formData.append('avatar', file);

      const endpoint = userId 
        ? USER_ENDPOINTS.uploadAvatar.replace('{id}', userId)
        : USER_ENDPOINTS.me + 'upload-avatar/';

      const response = await apiClient.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Errore nel caricamento avatar:', error);
      throw error;
    }
  },

  // === PROFILI PUBBLICI ===

  /**
   * Recupera la vista pubblica di un profilo
   */
  getPublicProfile: async (userId) => {
    try {
      const response = await apiClient.get(
        USER_ENDPOINTS.public.replace('{id}', userId)
      );
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero profilo pubblico:', error);
      throw error;
    }
  },

  /**
   * Recupera lista profili pubblici (con filtri)
   */
  getPublicProfiles: async (filters = {}) => {
    try {
      const response = await apiClient.get(USER_ENDPOINTS.publicList, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero profili pubblici:', error);
      throw error;
    }
  },

  // === AMMINISTRAZIONE ===

  /**
   * Recupera statistiche utenti (solo admin)
   */
  getUserStats: async () => {
    try {
      const response = await apiClient.get(USER_ENDPOINTS.stats);
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero statistiche:', error);
      throw error;
    }
  },

  /**
   * Aggiorna lo stato di un utente (solo admin)
   */
  updateUserStatus: async (userId, status) => {
    try {
      const response = await apiClient.patch(
        USER_ENDPOINTS.status.replace('{id}', userId),
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento stato:', error);
      throw error;
    }
  },

  /**
   * Recupera lista completa utenti (solo admin)
   */
  getAllUsers: async (filters = {}) => {
    try {
      const response = await apiClient.get(USER_ENDPOINTS.list, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero lista utenti:', error);
      throw error;
    }
  },

  // === LOG ATTIVITÀ ===

  /**
   * Recupera log delle attività dell'utente
   */
  getUserActivityLogs: async (userId = null, page = 1) => {
    try {
      const endpoint = userId 
        ? USER_ENDPOINTS.activityLogs.replace('{id}', userId)
        : USER_ENDPOINTS.me + 'activity-logs/';

      const response = await apiClient.get(endpoint, {
        params: { page }
      });
      return response.data;
    } catch (error) {
      console.error('Errore nel recupero log attività:', error);
      throw error;
    }
  },

  // === UTILITY FUNCTIONS ===

  /**
   * Valida i dati del profilo prima dell'invio
   */
  validateProfileData: (profileData) => {
    const errors = {};

    if (!profileData.first_name || profileData.first_name.trim().length < 2) {
      errors.first_name = 'Nome deve essere di almeno 2 caratteri';
    }

    if (!profileData.last_name || profileData.last_name.trim().length < 2) {
      errors.last_name = 'Cognome deve essere di almeno 2 caratteri';
    }

    if (profileData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.email = 'Email non valida';
    }

    if (profileData.phone_number && !/^\+?[\d\s\-\(\)]+$/.test(profileData.phone_number)) {
      errors.phone_number = 'Numero di telefono non valido';
    }

    if (profileData.bio && profileData.bio.length > 500) {
      errors.bio = 'Biografia non può superare i 500 caratteri';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Formatta i dati del profilo per la visualizzazione
   */
  formatProfileData: (profile) => {
    return {
      ...profile,
      fullName: `${profile.first_name} ${profile.last_name}`.trim(),
      displayName: profile.display_name || `${profile.first_name} ${profile.last_name}`.trim(),
      initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase(),
      isActive: profile.status === 'active',
      lastActivityFormatted: profile.last_activity 
        ? new Date(profile.last_activity).toLocaleDateString('it-IT')
        : 'Mai',
    };
  },

  /**
   * Helper per aggiornare le preferenze del tema
   */
  setThemePreference: async (theme) => {
    return await userService.updateSinglePreference('theme', theme);
  },

  /**
   * Helper per aggiornare le preferenze di notifica
   */
  setNotificationPreferences: async (notifications) => {
    return await userService.updateSinglePreference('notifications', notifications);
  },

  /**
   * Helper per aggiornare le preferenze di privacy
   */
  setPrivacyPreferences: async (privacy) => {
    return await userService.updateSinglePreference('privacy', privacy);
  }
};

export default userService; 