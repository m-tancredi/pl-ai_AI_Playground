// src/services/regressionService.js
import apiClient from './apiClient'; // Istanza Axios configurata

const API_REGRESSION_URL = '/api/regression'; // Prefisso API per questo servizio

/**
 * Esegue la regressione su una risorsa specificata nel Resource Manager.
 * @param {object} data - { resource_id (int), feature_column (str), target_column (str) }
 * @returns {Promise<object>} Promise che risolve con i risultati della regressione { slope, intercept, r_squared, ... }.
 */
export const runRegression = async (data) => {
    try {
        // Chiama l'endpoint specifico del servizio di regressione
        const response = await apiClient.post(`${API_REGRESSION_URL}/run/`, data);
        return response.data;
    } catch (error) {
        console.error("API Error running regression:", error.response?.data || error.message);
        throw error; // Rilancia per gestione nel componente
    }
};

/**
 * Esegue una predizione dati i parametri del modello e un valore.
 * @param {object} data - Oggetto con { slope (float), intercept (float), feature_value (float) }.
 * @returns {Promise<object>} Promise che risolve con { predicted_value (float) }.
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