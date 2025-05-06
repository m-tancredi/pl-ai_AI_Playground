// src/services/regressionService.js
import apiClient from './apiClient'; // Istanza Axios configurata

const API_REGRESSION_URL = '/api/regression'; // Prefisso API per questo servizio

/**
 * Esegue la regressione su una risorsa specificata.
 * @param {object} data - { resource_id, feature_column, target_column }
 * @returns {Promise<object>} Promise che risolve con i risultati della regressione.
 */
export const runRegression = async (data) => {
    try {
        const response = await apiClient.post(`${API_REGRESSION_URL}/run/`, data);
        return response.data; // Contiene slope, intercept, r_squared, etc.
    } catch (error) {
        console.error("API Error running regression:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Esegue una predizione dati i parametri del modello e un valore.
 * @param {object} data - Oggetto con { slope, intercept, feature_value }.
 * @returns {Promise<object>} Promise che risolve con { predicted_value }.
 */
export const predictValue = async (data) => {
    try {
        const response = await apiClient.post(`${API_REGRESSION_URL}/predict/`, data);
        return response.data;
    } catch (error) {
        console.error("API Error predicting value:", error.response?.data || error.message);
        throw error;
    }
};

// Funzioni precedenti rimosse (list, upload, delete, trainTemporary, etc.)
// L'upload ora usa resourceManagerService.uploadResource
// La lista risorse ora usa resourceManagerService.listUserResources