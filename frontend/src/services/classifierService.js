// src/services/classifierService.js
import apiClient from './apiClient'; // Your configured Axios instance

const API_CLASSIFIER_URL = '/api/classifier'; // Base URL for this service

/**
 * Sends training data to start the classifier training task.
 * @param {object} payload - { images: string[], labels: number[], class_names: string[], model_name?: string, epochs?: number, batch_size?: number }
 * @returns {Promise<object>} Promise resolving with { model_id, status, message }
 */
export const trainClassifier = async (payload) => {
    try {
        const response = await apiClient.post(`${API_CLASSIFIER_URL}/train/`, payload);
        return response.data; // Expects 202 Accepted with model ID and status
    } catch (error) {
        console.error("API Error training classifier:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Sends an image for prediction using a trained model.
 * @param {object} payload - { image: string (base64 data URL), model_id: string }
 * @returns {Promise<object>} Promise resolving with { model_id, predictions: Array<{label: string, confidence: number}>, status: string }
 */
export const predictImage = async (payload) => {
    try {
        const response = await apiClient.post(`${API_CLASSIFIER_URL}/predict/`, payload);
        return response.data;
    } catch (error) {
        // Don't log every prediction error verbosely unless debugging
        // console.error("API Error predicting image:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets the status and details of a specific trained model.
 * @param {string} modelId - The UUID of the model.
 * @returns {Promise<object>} Promise resolving with the model details (including status).
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
 * Lists all models trained by the current user. (Optional)
 * @returns {Promise<Array>} Promise resolving with an array of model objects.
 */
export const listUserModels = async () => {
    try {
        const response = await apiClient.get(`${API_CLASSIFIER_URL}/models/`);
         // Adapt if backend uses pagination
        return response.data.results || response.data;
    } catch (error) {
        console.error("API Error listing user models:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a specific trained model. (Optional)
 * @param {string} modelId - The UUID of the model to delete.
 * @returns {Promise<void>} Promise resolving on success.
 */
export const deleteModel = async (modelId) => {
    try {
        await apiClient.delete(`${API_CLASSIFIER_URL}/models/${modelId}/`);
        // Expects 204 No Content on success
    } catch (error) {
        console.error(`API Error deleting model ID ${modelId}:`, error.response?.data || error.message);
        throw error;
    }
};