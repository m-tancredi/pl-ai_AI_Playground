import { useState, useCallback } from 'react';
import { uploadProfileImage, removeProfileImage, getProfileImageUrl } from '../services/profileService';

/**
 * Hook personalizzato per gestire l'immagine del profilo utente
 * @param {Object} initialUser - Dati utente iniziali
 * @param {Function} onUserUpdate - Callback per aggiornare i dati utente
 * @returns {Object} Oggetto con stato e funzioni per gestire l'immagine del profilo
 */
export const useProfileImage = (initialUser = null, onUserUpdate = null) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Ottiene l'URL dell'immagine del profilo
  const getImageUrl = useCallback((user = initialUser) => {
    return getProfileImageUrl(user?.profile_image);
  }, [initialUser]);

  // Upload dell'immagine del profilo
  const uploadImage = useCallback(async (file) => {
    if (!file) {
      setError('Nessun file selezionato');
      return null;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('profile_image', file);

      const response = await uploadProfileImage(formData);
      const imageUrl = getProfileImageUrl(response.profile_image);

      // Callback per aggiornare i dati utente nel componente padre
      if (onUserUpdate) {
        onUserUpdate({
          ...initialUser,
          profile_image: response.profile_image
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // Reset success dopo 3 secondi

      return {
        success: true,
        imageUrl,
        data: response
      };

    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Errore durante il caricamento dell\'immagine';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsUploading(false);
    }
  }, [initialUser, onUserUpdate]);

  // Rimozione dell'immagine del profilo
  const removeImage = useCallback(async () => {
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      await removeProfileImage();

      // Callback per aggiornare i dati utente nel componente padre
      if (onUserUpdate) {
        onUserUpdate({
          ...initialUser,
          profile_image: null
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // Reset success dopo 3 secondi

      return {
        success: true
      };

    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Errore durante la rimozione dell\'immagine';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsUploading(false);
    }
  }, [initialUser, onUserUpdate]);

  // Reset degli stati
  const resetStates = useCallback(() => {
    setError(null);
    setSuccess(false);
    setIsUploading(false);
  }, []);

  // Controlla se l'utente ha un'immagine del profilo
  const hasImage = useCallback((user = initialUser) => {
    const imageUrl = getProfileImageUrl(user?.profile_image);
    return imageUrl && imageUrl !== '';
  }, [initialUser]);

  return {
    // Stato
    isUploading,
    error,
    success,
    
    // Funzioni
    uploadImage,
    removeImage,
    getImageUrl,
    hasImage,
    resetStates,
    
    // Utilities
    isReady: !isUploading
  };
}; 