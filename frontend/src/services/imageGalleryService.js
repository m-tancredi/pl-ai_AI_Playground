import apiClient from './apiClient'; // Usa l'istanza Axios configurata

const API_IMAGES_URL = '/api/images'; // Prefisso API definito in Nginx

/**
 * Salva un'immagine generata precedentemente (da URL temporaneo a persistente con record DB).
 * @param {object} imageData - Oggetto contenente { image_url (temp relativo /media/...), prompt?, model?, style?, name?, description? }
 * @returns {Promise<object>} Promise che risolve con i dati dell'immagine salvata (dal modello GeneratedImage).
 */
export const saveGeneratedImage = async (imageData) => {
    try {
        // L'endpoint si aspetta l'URL relativo locale (es. /media/temp_generated/...)
        const response = await apiClient.post(`${API_IMAGES_URL}/save/`, imageData);
        return response.data; // Dati dell'oggetto GeneratedImage creato
    } catch (error) {
        console.error("API Error saving image:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene la lista delle immagini salvate nella galleria dell'utente autenticato.
 * @returns {Promise<Array>} Promise che risolve con un array di oggetti immagine.
 */
export const listUserGalleryImages = async () => {
    try {
        const response = await apiClient.get(`${API_IMAGES_URL}/gallery/`);
        return response.data; // Array di oggetti GeneratedImage
    } catch (error) {
        console.error("API Error listing gallery images:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene i dettagli di una specifica immagine salvata nella galleria.
 * @param {number|string} imageId - L'ID dell'immagine.
 * @returns {Promise<object>} Promise che risolve con i dettagli dell'immagine.
 */
export const getImageDetails = async (imageId) => {
    try {
        const response = await apiClient.get(`${API_IMAGES_URL}/gallery/${imageId}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting image details for ID ${imageId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Aggiorna i metadati (es. nome, descrizione) di un'immagine salvata.
 * @param {number|string} imageId - L'ID dell'immagine.
 * @param {object} metadata - Oggetto con i campi da aggiornare (es. { name: 'Nuovo Nome', description: 'Nuova Desc' }).
 * @returns {Promise<object>} Promise che risolve con i dati aggiornati dell'immagine.
 */
export const updateImageMetadata = async (imageId, metadata) => {
    try {
        // Usa PATCH per aggiornamenti parziali
        const response = await apiClient.patch(`${API_IMAGES_URL}/gallery/${imageId}/`, metadata);
        return response.data;
    } catch (error) {
        console.error(`API Error updating image metadata for ID ${imageId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Elimina un'immagine salvata dalla galleria (record DB e file).
 * @param {number|string} imageId - L'ID dell'immagine da eliminare.
 * @returns {Promise<void>} Promise che risolve (senza dati) al successo.
 */
export const deleteGalleryImage = async (imageId) => {
    try {
        await apiClient.delete(`${API_IMAGES_URL}/gallery/${imageId}/`);
        // DELETE di solito restituisce 204 No Content
    } catch (error) {
        console.error(`API Error deleting image ID ${imageId}:`, error.response?.data || error.message);
        throw error;
    }
};

// Le funzioni generateTextToImage, generateImageToImage, enhancePrompt
// possono rimanere in imageGeneratorService.js (se lo rinomini)
// oppure le importi da lì se hai creato file separati.
// Per semplicità, assumiamo che siano nello stesso file o importate qui.
// Se non sono qui, assicurati di importarle in ImageGenerationPage.jsx
export { generateTextToImage, generateImageToImage, enhancePrompt } from './imageGeneratorService'; // Assicurati che questo import sia corretto se usi file separati