// src/services/classifierService.js
import apiClient from './apiClient'; // Assicurati che il percorso sia corretto per la tua istanza Axios

const API_CLASSIFIER_URL = '/api/classifier'; // Base URL per questo servizio (come definito in Nginx)

/**
 * Invia i dati per l'addestramento di un nuovo modello di classificazione immagini.
 * @param {object} payload - Oggetto contenente:
 *   {
 *     images: string[], // Array di immagini come stringhe base64 (con prefisso data:image/...)
 *     labels: number[], // Array di etichette numeriche (0-based) corrispondenti alle immagini
 *     class_names: string[], // Array dei nomi delle classi (l'indice corrisponde all'etichetta)
 *     model_name?: string, // Nome opzionale per il modello
 *     epochs?: number, // Numero opzionale di epoche
 *     batch_size?: number // Dimensione opzionale del batch
 *   }
 * @returns {Promise<object>} Promise che risolve con la risposta iniziale dal backend,
 *                            solitamente { model_id, status: "PENDING"|"TRAINING", message }.
 */
export const trainClassifier = async (payload) => {
    try {
        const response = await apiClient.post(`${API_CLASSIFIER_URL}/train/`, payload);
        return response.data;
    } catch (error) {
        console.error("API Error training classifier:", error.response?.data || error.message);
        throw error; // Rilancia per gestione nel componente UI
    }
};

/**
 * Invia un'immagine per la classificazione usando un modello precedentemente addestrato.
 * @param {object} payload - Oggetto contenente:
 *   {
 *     image: string, // Immagine come stringa base64 (con prefisso data:image/...)
 *     model_id: string // UUID del modello addestrato da usare
 *   }
 * @returns {Promise<object>} Promise che risolve con i risultati della predizione,
 *                            solitamente { model_id, predictions: Array<{label: string, confidence: number}>, status: "success" }.
 */
export const predictImage = async (payload) => {
    try {
        const response = await apiClient.post(`${API_CLASSIFIER_URL}/predict/`, payload);
        return response.data;
    } catch (error) {
        // Log meno verboso per le predizioni realtime per non floodare la console,
        // a meno che non sia un errore significativo (es. 500)
        if (error.response?.status >= 500 || !error.response) {
             console.error("API Error predicting image:", error.response?.data || error.message);
        }
        throw error;
    }
};

/**
 * Ottiene lo stato e i dettagli di un modello di classificazione specifico.
 * @param {string} modelId - L'UUID del modello.
 * @returns {Promise<object>} Promise che risolve con i dettagli del modello (incluso status, accuracy, ecc.).
 */
export const getModelStatus = async (modelId) => {
    try {
        const response = await apiClient.get(`${API_CLASSIFIER_URL}/models/${modelId}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting model status for ID ${modelId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Lista tutti i modelli di classificazione addestrati dall'utente corrente.
 * @returns {Promise<Array>} Promise che risolve con un array di oggetti modello.
 *                           (Adatta se il backend usa paginazione, es. response.data.results).
 */
export const listUserModels = async () => {
    try {
        const response = await apiClient.get(`${API_CLASSIFIER_URL}/models/`);
        // Se il backend usa la paginazione standard di DRF, i risultati sono in 'results'
        return response.data.results || response.data;
    } catch (error) {
        console.error("API Error listing user models:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Aggiorna i metadati (es. nome, descrizione) di un modello addestrato.
 * @param {string} modelId - L'UUID del modello.
 * @param {object} metadata - Oggetto contenente i campi da aggiornare (es. { name: "Nuovo Nome", description: "Nuova Desc." }).
 * @returns {Promise<object>} Promise che risolve con i dati aggiornati del modello.
 */
export const updateModelMetadata = async (modelId, metadata) => {
    try {
        // Usa PATCH per aggiornamenti parziali
        const response = await apiClient.patch(`${API_CLASSIFIER_URL}/models/${modelId}/`, metadata);
        return response.data;
    } catch (error) {
        console.error(`API Error updating model metadata for ID ${modelId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Elimina un modello di classificazione addestrato.
 * @param {string} modelId - L'UUID del modello da eliminare.
 * @returns {Promise<void>} Promise che risolve al successo (nessun contenuto restituito).
 */
export const deleteModel = async (modelId) => {
    try {
        await apiClient.delete(`${API_CLASSIFIER_URL}/models/${modelId}/`);
        // DELETE tipicamente restituisce 204 No Content in caso di successo
    } catch (error) {
        console.error(`API Error deleting model ID ${modelId}:`, error.response?.data || error.message);
        throw error;
    }
};