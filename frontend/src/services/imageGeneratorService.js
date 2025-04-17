import apiClient from './apiClient'; // Usa la stessa istanza Axios configurata

// const API_IMAGES_URL = '/api/images'; // Prefisso API per questo servizio - Non necessario se si usano path assoluti sotto

/**
 * Genera un'immagine da un prompt testuale.
 * @param {object} data - { prompt, model, style?, aspect_ratio? }
 * @returns {Promise<object>} Promise che risolve con { image_url, prompt_used, model_used }
 */
export const generateTextToImage = async (data) => {
    try {
        // Usa percorso assoluto
        const response = await apiClient.post('/api/images/generate/text-to-image/', data);
        return response.data;
    } catch (error) {
        console.error("API Error generating text-to-image:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Genera un'immagine basata su un'immagine e un prompt (Image-to-Image).
 * @param {FormData} formData - Oggetto FormData contenente 'prompt', 'image' (file), 'style'?, 'image_strength'?
 * @returns {Promise<object>} Promise che risolve con { image_url, prompt_used, model_used }
 */
export const generateImageToImage = async (formData) => {
    try {
         // Usa percorso assoluto
        const response = await apiClient.post('/api/images/generate/image-to-image/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error("API Error generating image-to-image:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Migliora un prompt utente usando l'AI.
 * @param {object} data - { prompt }
 * @returns {Promise<object>} Promise che risolve con { original_prompt, enhanced_prompt }
 */
export const enhancePrompt = async (data) => {
    try {
         // Usa percorso assoluto
        const response = await apiClient.post('/api/images/enhance-prompt/', data);
        return response.data;
    } catch (error) {
        console.error("API Error enhancing prompt:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Salva un'immagine generata (spostandola da temp a persistente).
 * @param {object} data - { image_url (temp local url relativo, es /media/...), prompt?, model?, style? }
 * @returns {Promise<object>} Promise che risolve con { saved_url, message }
 */
export const saveImage = async (data) => {
    try {
         // Usa percorso assoluto
        const response = await apiClient.post('/api/images/save/', data);
        return response.data;
    } catch (error) {
        console.error("API Error saving image:", error.response?.data || error.message);
        throw error;
    }
};