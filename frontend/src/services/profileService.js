import apiClient from './apiClient';

/**
 * Upload dell'immagine del profilo utente
 * @param {FormData} formData - FormData contenente il file dell'immagine
 * @returns {Promise<Object>} Response con i dati dell'immagine caricata
 */
export const uploadProfileImage = async (formData) => {
  try {
    const response = await apiClient.post('/api/profile/upload-image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
};

/**
 * Rimozione dell'immagine del profilo utente
 * @returns {Promise<Object>} Response della rimozione
 */
export const removeProfileImage = async () => {
  try {
    const response = await apiClient.delete('/api/profile/remove-image/');
    return response.data;
  } catch (error) {
    console.error('Error removing profile image:', error);
    throw error;
  }
};

/**
 * Aggiornamento dei dati del profilo utente
 * @param {Object} profileData - Dati del profilo da aggiornare
 * @returns {Promise<Object>} Response con i dati aggiornati
 */
export const updateProfile = async (profileData) => {
  try {
    const response = await apiClient.patch('/api/profile/update/', profileData);
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Ottiene l'URL completo per l'immagine del profilo
 * @param {string} imagePath - Path relativo dell'immagine
 * @returns {string} URL completo dell'immagine
 */
export const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Se è già un URL completo, ritorna così com'è
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Se è un path relativo, costruisci l'URL completo
  const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
  return `${baseUrl}${imagePath}`;
};

/**
 * Validazione del file immagine
 * @param {File} file - File da validare
 * @returns {Object} Oggetto con isValid e error message
 */
export const validateImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!file) {
    return { isValid: false, error: 'Nessun file selezionato.' };
  }
  
  if (!validTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: 'Formato non supportato. Utilizza JPG, PNG o WebP.' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: 'File troppo grande. Massimo 5MB.' 
    };
  }
  
  return { isValid: true, error: null };
}; 