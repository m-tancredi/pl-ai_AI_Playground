import apiClient from './apiClient'; // Importa l'istanza Axios configurata

const API_REGRESSION_URL = '/api/regression'; // Prefisso API definito in Nginx

/**
 * Elenca i dataset di esempio.
 * @returns {Promise<Array>} Promise che risolve con l'array dei dataset di esempio.
 */
export const listExampleDatasets = async () => {
    try {
        // Assumiamo che il backend filtri correttamente quando is_example=true
        const response = await apiClient.get(`${API_REGRESSION_URL}/datasets/`, {
            params: { is_example: 'true' } // Passa il parametro query
        });
        return response.data;
    } catch (error) {
        console.error("API Error listing example datasets:", error.response?.data || error.message);
        throw error; // Rilancia per gestione nel componente
    }
};

/**
 * Elenca i dataset salvati dall'utente loggato.
 * Nota: Assumiamo che il backend filtri automaticamente per utente loggato
 * e che vogliamo escludere gli esempi da questa chiamata specifica.
 * @returns {Promise<Array>} Promise che risolve con l'array dei dataset dell'utente.
 */
export const listUserDatasets = async () => {
    try {
        // Chiamata semplice, il backend dovrebbe gestire il filtro owner e non is_example
        const response = await apiClient.get(`${API_REGRESSION_URL}/datasets/`, {
             params: { is_example: 'false' } // Escludi esempi se vuoi solo quelli utente
             // Se il backend non filtra per utente di default (improbabile con la viewset data),
             // dovresti passare l'user ID o modificare il backend
        });
        return response.data;
    } catch (error) {
        console.error("API Error listing user datasets:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene i dettagli di un dataset specifico.
 * @param {number|string} id ID del dataset.
 * @returns {Promise<object>} Promise che risolve con i dettagli del dataset.
 */
export const getDatasetDetails = async (id) => {
    try {
        const response = await apiClient.get(`${API_REGRESSION_URL}/datasets/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting dataset details for ID ${id}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene i dati grezzi JSON da un dataset specifico (se endpoint esiste).
 * @param {number|string} id ID del dataset.
 * @returns {Promise<Array>} Promise che risolve con i dati grezzi.
 */
export const getDatasetRawData = async (id) => {
    try {
        // Assumendo che l'endpoint custom /raw-data/ esista come definito nel backend
        const response = await apiClient.get(`${API_REGRESSION_URL}/datasets/${id}/raw-data/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting raw data for dataset ID ${id}:`, error.response?.data || error.message);
        throw error;
    }
};


/**
 * Carica e salva un nuovo dataset.
 * @param {FormData} formData Oggetto FormData contenente 'name', 'description' (opzionale), 'csv_file'.
 * @returns {Promise<object>} Promise che risolve con i dati del dataset creato.
 */
export const uploadAndSaveDataset = async (formData) => {
    try {
        const response = await apiClient.post(`${API_REGRESSION_URL}/datasets/`, formData, {
            headers: {
                // Necessario per l'upload di file con Axios
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error("API Error uploading/saving dataset:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Elimina un dataset dell'utente.
 * @param {number|string} id ID del dataset da eliminare.
 * @returns {Promise<void>} Promise che risolve al successo.
 */
export const deleteDataset = async (id) => {
    try {
        await apiClient.delete(`${API_REGRESSION_URL}/datasets/${id}/`);
        // DELETE di solito non restituisce contenuto, 204 No Content è successo
    } catch (error) {
        console.error(`API Error deleting dataset ID ${id}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Carica un file CSV, esegue la regressione temporaneamente e restituisce i parametri.
 * @param {FormData} formData Oggetto FormData contenente 'feature_column', 'target_column', 'csv_file'.
 * @returns {Promise<object>} Promise che risolve con i risultati della regressione (slope, intercept, etc.).
 */
export const trainTemporaryModel = async (formData) => {
    try {
        const response = await apiClient.post(`${API_REGRESSION_URL}/upload-train-temporary/`, formData, {
             headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data; // Contiene slope, intercept, etc.
    } catch (error) {
        console.error("API Error training temporary model:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Esegue una predizione dati i parametri del modello e un valore.
 * @param {object} data Oggetto con { slope, intercept, feature_value }.
 * @returns {Promise<object>} Promise che risolve con il risultato della predizione { predicted_value }.
 */
export const predictValue = async (data) => {
    try {
        const response = await apiClient.post(`${API_REGRESSION_URL}/predict/`, data);
        return response.data; // Contiene { predicted_value: ... }
    } catch (error) {
        console.error("API Error predicting value:", error.response?.data || error.message);
        throw error;
    }
};

// Eventuale funzione per addestrare su dataset salvato, se il backend ha endpoint dedicato
/**
 * Addestra un modello su un dataset già salvato.
 * @param {number|string} id ID del dataset salvato.
 * @param {object} data Oggetto con { feature_column, target_column }.
 * @returns {Promise<object>} Promise che risolve con i risultati della regressione.
 */
export const trainSavedModel = async (id, data) => {
     try {
        // Assumendo che l'endpoint custom /train/ esista come definito nel backend
        const response = await apiClient.post(`${API_REGRESSION_URL}/datasets/${id}/train/`, data);
        return response.data;
    } catch (error) {
        console.error(`API Error training saved dataset ID ${id}:`, error.response?.data || error.message);
        throw error;
    }
}