// src/services/dataAnalysisService.js
import apiClient from './apiClient'; // La tua istanza Axios configurata

const API_ANALYSIS_URL = '/api/analysis'; // Prefisso API come definito in Nginx

/**
 * Invia dati (ID risorsa o file) per ottenere suggerimenti di algoritmi.
 * @param {FormData|object} payload - Se FormData, deve contenere 'file'.
 *                                    Se oggetto, deve contenere 'resource_id'.
 *                                    Può contenere 'task_type_preference'.
 * @returns {Promise<object>} Promise che risolve con { analysis_session_id, dataset_preview, suggestions }
 */
export const suggestAlgorithm = async (payload) => {
    try {
        const headers = payload instanceof FormData
            ? { 'Content-Type': 'multipart/form-data' }
            : { 'Content-Type': 'application/json' };
        const response = await apiClient.post(`${API_ANALYSIS_URL}/suggest-algorithm/`, payload, { headers });
        return response.data;
    } catch (error) {
        console.error("API Error suggesting algorithm:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Avvia un job di analisi asincrono.
 * @param {object} payload - { analysis_session_id, selected_algorithm_key, selected_features, selected_target, task_type, algorithm_params? }
 * @returns {Promise<object>} Promise che risolve con { analysis_job_id, status, message }
 */
export const runAnalysis = async (payload) => {
    try {
        const response = await apiClient.post(`${API_ANALYSIS_URL}/run/`, payload);
        return response.data;
    } catch (error) {
        console.error("API Error running analysis:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene lo stato e i risultati di un job di analisi.
 * @param {string} jobId - L'UUID del job di analisi.
 * @returns {Promise<object>} Promise che risolve con i dettagli del AnalysisJob.
 */
export const getAnalysisResults = async (jobId) => {
    try {
        const response = await apiClient.get(`${API_ANALYSIS_URL}/results/${jobId}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting analysis results for job ID ${jobId}:`, error.response?.data || error.message);
        throw error;
    }
};

// src/services/dataAnalysisService.js
// ... (suggestAlgorithm, runAnalysis, getAnalysisResults come prima) ...

/**
 * Esegue una predizione per una singola istanza usando un modello di classificazione addestrato.
 * @param {string} jobId - L'UUID del job di analisi (modello addestrato).
 * @param {object} featuresData - Oggetto con { featureName1: value, featureName2: value, ... }.
 * @returns {Promise<object>} Promise che risolve con { predicted_class, probabilities? }.
 */
export const predictClassificationInstance = async (jobId, featuresData) => {
    try {
        const response = await apiClient.post(`${API_ANALYSIS_URL}/jobs/${jobId}/predict_instance/`, { features: featuresData });
        return response.data;
    } catch (error) {
        console.error(`API Error predicting instance for job ID ${jobId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Esegue una predizione per una singola istanza (sia classificazione che regressione).
 * @param {string} jobId - L'UUID del job di analisi.
 * @param {object} featuresData - Oggetto con { featureName1: value, ... }.
 * @param {string} taskType - 'classification' o 'regression'.
 * @returns {Promise<object>} Promise che risolve con il risultato della predizione.
 *          Per classificazione: { predicted_class, probabilities?, plot_coordinates? }
 *          Per regressione: { predicted_value }
 */
export const predictInstance = async (jobId, featuresData, taskType) => {
    try {
        // L'endpoint è lo stesso, ma il backend ora differenzia internamente
        // Se vuoi endpoint separati, dovrai cambiare qui e nel backend.
        const endpoint = `${API_ANALYSIS_URL}/jobs/${jobId}/predict_instance/`;
        const response = await apiClient.post(endpoint, { features: featuresData });
        return response.data;
    } catch (error) {
        console.error(`API Error predicting instance for job ID ${jobId} (type: ${taskType}):`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Crea un nuovo job di generazione di dataset sintetico.
 * @param {object} payload - { user_prompt: string, num_rows: number, dataset_name?: string }
 * @returns {Promise<object>} Promise che risolve con { job_id, status, message }
 */
export const createSyntheticCsvJob = async (payload) => {
    try {
        const response = await apiClient.post(`${API_ANALYSIS_URL}/generate-synthetic-csv/`, payload);
        return response.data;
    } catch (error) {
        console.error('API Error creating synthetic CSV job:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Recupera lo stato e i dettagli di un job di dataset sintetico.
 * @param {string} jobId - L'UUID del job.
 * @returns {Promise<object>} Promise che risolve con i dettagli del SyntheticDatasetJob.
 */
export const getSyntheticCsvJobStatus = async (jobId) => {
    try {
        const response = await apiClient.get(`${API_ANALYSIS_URL}/synthetic-jobs/${jobId}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting synthetic CSV job status for job ID ${jobId}:`, error.response?.data || error.message);
        throw error;
    }
};

