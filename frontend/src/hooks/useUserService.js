import { useState, useCallback } from 'react';
import userService from '../services/userService';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook semplificato per gestire le operazioni del User Service
 */
const useUserService = () => {
  const { user } = useAuth();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cache state per performance
  const [cache, setCache] = useState({
    profile: null,
    preferences: null,
    stats: null,
    publicProfiles: [],
    activityLogs: [],
    allUsers: []
  });

  // === PROFILO UTENTE ===

  const getMyProfile = useCallback(async (forceRefresh = false) => {
    if (cache.profile && !forceRefresh) {
      return cache.profile;
    }

    setLoading(true);
    try {
      const profile = await userService.getMyProfile();
      setCache(prev => ({ ...prev, profile }));
      return profile;
    } catch (error) {
      console.error('Errore nel caricamento del profilo:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [cache.profile]);

  const updateProfile = useCallback(async (profileData) => {
    setSaving(true);
    try {
      const updatedProfile = await userService.updateProfile(profileData);
      setCache(prev => ({ ...prev, profile: updatedProfile }));
      return updatedProfile;
    } catch (error) {
      console.error('Errore nell\'aggiornamento del profilo:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  // === PREFERENZE ===

  const getPreferences = useCallback(async (userId = null, forceRefresh = false) => {
    const cacheKey = userId ? `preferences_${userId}` : 'preferences';
    if (cache[cacheKey] && !forceRefresh) {
      return cache[cacheKey];
    }

    setLoading(true);
    try {
      const preferences = await userService.getUserPreferences(userId);
      setCache(prev => ({ ...prev, [cacheKey]: preferences }));
      return preferences;
    } catch (error) {
      console.error('Errore nel caricamento delle preferenze:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [cache]);

  const updatePreferences = useCallback(async (preferences, userId = null) => {
    setSaving(true);
    try {
      const updated = await userService.updatePreferences(preferences, userId);
      const cacheKey = userId ? `preferences_${userId}` : 'preferences';
      setCache(prev => ({ ...prev, [cacheKey]: updated }));
      return updated;
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle preferenze:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  // === AVATAR ===

  const uploadAvatar = useCallback(async (file, userId = null) => {
    setUploading(true);
    try {
      const result = await userService.uploadAvatar(file, userId);
      
      // Aggiorna cache del profilo con la nuova immagine
      if (!userId) {
        setCache(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            profile_picture_url: result.profile_picture_url
          }
        }));
      }
      
      return result;
    } catch (error) {
      console.error('Errore nel caricamento dell\'avatar:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  }, []);

  // === PROFILI PUBBLICI ===

  const getPublicProfiles = useCallback(async (filters = {}, forceRefresh = false) => {
    if (cache.publicProfiles.length > 0 && !forceRefresh && Object.keys(filters).length === 0) {
      return cache.publicProfiles;
    }

    setLoading(true);
    try {
      const profiles = await userService.getPublicProfiles(filters);
      if (Object.keys(filters).length === 0) {
        setCache(prev => ({ ...prev, publicProfiles: profiles }));
      }
      return profiles;
    } catch (error) {
      console.error('Errore nel caricamento dei profili pubblici:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [cache.publicProfiles]);

  const getPublicProfile = useCallback(async (userId) => {
    setLoading(true);
    try {
      return await userService.getPublicProfile(userId);
    } catch (error) {
      console.error('Errore nel caricamento del profilo pubblico:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // === AMMINISTRAZIONE (solo per admin) ===

  const getUserStats = useCallback(async (forceRefresh = false) => {
    if (!user?.is_staff) {
      throw new Error('Accesso non autorizzato');
    }

    if (cache.stats && !forceRefresh) {
      return cache.stats;
    }

    setLoading(true);
    try {
      const stats = await userService.getUserStats();
      setCache(prev => ({ ...prev, stats }));
      return stats;
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.is_staff, cache.stats]);

  const getAllUsers = useCallback(async (filters = {}, forceRefresh = false) => {
    if (!user?.is_staff) {
      throw new Error('Accesso non autorizzato');
    }

    if (cache.allUsers.length > 0 && !forceRefresh && Object.keys(filters).length === 0) {
      return cache.allUsers;
    }

    setLoading(true);
    try {
      const users = await userService.getAllUsers(filters);
      if (Object.keys(filters).length === 0) {
        setCache(prev => ({ ...prev, allUsers: users }));
      }
      return users;
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.is_staff, cache.allUsers]);

  const updateUserStatus = useCallback(async (userId, status) => {
    if (!user?.is_staff) {
      throw new Error('Accesso non autorizzato');
    }

    setSaving(true);
    try {
      const result = await userService.updateUserStatus(userId, status);
      // Invalida cache per ricaricare i dati
      setCache(prev => ({ ...prev, allUsers: [] }));
      return result;
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user?.is_staff]);

  // === ATTIVITÀ ===

  const getUserActivityLogs = useCallback(async (userId = null, limit = 50, forceRefresh = false) => {
    const cacheKey = userId ? `logs_${userId}` : 'activityLogs';
    if (cache[cacheKey]?.length > 0 && !forceRefresh) {
      return cache[cacheKey];
    }

    setLoading(true);
    try {
      const logs = await userService.getUserActivityLogs(userId, limit);
      setCache(prev => ({ ...prev, [cacheKey]: logs }));
      return logs;
    } catch (error) {
      console.error('Errore nel caricamento dei log attività:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [cache]);

  // === UTILITY ===

  const clearCache = useCallback(() => {
    setCache({
      profile: null,
      preferences: null,
      stats: null,
      publicProfiles: [],
      activityLogs: [],
      allUsers: []
    });
  }, []);

  return {
    // States
    loading,
    uploading,
    saving,
    
    // Profile methods
    getMyProfile,
    updateProfile,
    
    // Preferences methods
    getPreferences,
    updatePreferences,
    
    // Avatar methods
    uploadAvatar,
    
    // Public profiles methods
    getPublicProfiles,
    getPublicProfile,
    
    // Admin methods
    getUserStats,
    getAllUsers,
    updateUserStatus,
    
    // Activity methods
    getUserActivityLogs,
    
    // Utility methods
    clearCache,
    
    // Additional utility methods from userService
    validateProfileData: userService.validateProfileData,
    formatProfileData: userService.formatProfileData,
    getActivityLogs: getUserActivityLogs
  };
};

export default useUserService; 