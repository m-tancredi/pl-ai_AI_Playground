import apiClient from './apiClient'; // Usa l'istanza Axios configurata

const API_RESOURCES_URL = '/api/resources'; // Prefisso API per questo servizio

/**
 * Carica un nuovo file risorsa con metadati opzionali.
 * @param {FormData} formData - Oggetto FormData contenente 'file', 'name'?, 'description'?
 * @param {function} [onUploadProgress] - Callback opzionale per tracciare il progresso dell'upload.
 * @returns {Promise<object>} Promise che risolve con i dati iniziali della risorsa creata (stato PROCESSING).
 */
export const uploadResource = async (formData, onUploadProgress) => {
    try {
        const response = await apiClient.post(`${API_RESOURCES_URL}/upload/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: onUploadProgress, // Passa la callback di progresso ad Axios
        });
        // L'API restituisce 202 Accepted con i dati preliminari
        return response.data;
    } catch (error) {
        console.error("API Error uploading resource:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene la lista delle risorse dell'utente autenticato.
 * @returns {Promise<Array>} Promise che risolve con un array di oggetti risorsa.
 */
export const listUserResources = async () => {
    try {
        const response = await apiClient.get(`${API_RESOURCES_URL}/`);
        return response.data.results || response.data; // Gestisce paginazione DRF o risposta diretta
    } catch (error) {
        console.error("API Error listing user resources:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Aggiorna i metadati (nome, descrizione) di una risorsa.
 * @param {number|string} resourceId - L'ID della risorsa.
 * @param {object} metadata - Oggetto con { name: '...', description: '...' }.
 * @returns {Promise<object>} Promise che risolve con i dati aggiornati della risorsa.
 */
export const updateResourceMetadata = async (resourceId, metadata) => {
    try {
        // Usa PATCH per aggiornamenti parziali
        const response = await apiClient.patch(`${API_RESOURCES_URL}/${resourceId}/`, metadata);
        return response.data;
    } catch (error) {
        console.error(`API Error updating resource metadata for ID ${resourceId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Elimina una risorsa (record DB e file associato).
 * @param {number|string} resourceId - L'ID della risorsa da eliminare.
 * @returns {Promise<void>} Promise che risolve (senza dati) al successo.
 */
export const deleteResource = async (resourceId) => {
    try {
        await apiClient.delete(`${API_RESOURCES_URL}/${resourceId}/`);
        // DELETE restituisce 204 No Content
    } catch (error) {
        console.error(`API Error deleting resource ID ${resourceId}:`, error.response?.data || error.message);
        throw error;
    }
};

// Non abbiamo bisogno di getResourceDetails separatamente se la lista contiene già tutto,
// ma potremmo aggiungerlo se necessario:
// export const getResourceDetails = async (resourceId) => { ... }