import apiClient from './apiClient'; // Your configured Axios instance

const API_RESOURCES_URL = '/api/resources';

/**
 * Lists resources for the authenticated user, supports filtering.
 * @param {object} [filters] - Optional filter parameters (e.g., { status: 'COMPLETED', mime_type__startswith: 'image/' })
 * @returns {Promise<Array>} Promise resolving with an array of resource objects.
 */
export const listUserResources = async (filters = {}) => {
    try {
        const response = await apiClient.get(`${API_RESOURCES_URL}/`, { params: filters });
        // If pagination is enabled in DRF, response.data might be { count, next, previous, results }
        // Adjust accordingly if you use pagination on the backend
        return response.data.results || response.data; // Adapt based on backend pagination
    } catch (error) {
        console.error("API Error listing user resources:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Uploads a new resource file and optional metadata.
 * @param {FormData} formData - Must contain 'file' key, can contain 'name', 'description'.
 * @param {function} [onUploadProgress] - Optional Axios progress callback.
 * @returns {Promise<object>} Promise resolving with the initial resource data (status: PROCESSING).
 */
export const uploadResource = async (formData, onUploadProgress) => {
    try {
        const response = await apiClient.post(`${API_RESOURCES_URL}/upload/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: onUploadProgress // Pass the callback to Axios
        });
        return response.data; // Should return 202 Accepted with preliminary data
    } catch (error) {
        console.error("API Error uploading resource:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets the details of a specific resource.
 * @param {number|string} resourceId - The ID of the resource.
 * @returns {Promise<object>} Promise resolving with the resource details.
 */
export const getResourceDetails = async (resourceId) => {
    try {
        const response = await apiClient.get(`${API_RESOURCES_URL}/${resourceId}/`);
        return response.data;
    } catch (error) {
        console.error(`API Error getting resource details for ID ${resourceId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates the metadata (name, description) of a resource.
 * @param {number|string} resourceId - The ID of the resource.
 * @param {object} metadata - Object with fields to update (e.g., { name: 'New', description: 'Desc' }).
 * @returns {Promise<object>} Promise resolving with the updated resource data.
 */
export const updateResourceMetadata = async (resourceId, metadata) => {
    try {
        const response = await apiClient.patch(`${API_RESOURCES_URL}/${resourceId}/`, metadata);
        return response.data;
    } catch (error) {
        console.error(`API Error updating resource metadata for ID ${resourceId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a resource (DB record and file).
 * @param {number|string} resourceId - The ID of the resource.
 * @returns {Promise<void>} Promise resolving on successful deletion.
 */
export const deleteResource = async (resourceId) => {
    try {
        await apiClient.delete(`${API_RESOURCES_URL}/${resourceId}/`);
        // Returns 204 No Content on success
    } catch (error) {
        console.error(`API Error deleting resource ID ${resourceId}:`, error.response?.data || error.message);
        throw error;
    }
};

export const getStorageInfo = async () => {
    try {
        const response = await apiClient.get(`${API_RESOURCES_URL}/storage-info/`);
        return response.data; // { storage_used: bytes, storage_limit: bytes }
    } catch (error) {
        console.error("API Error getting storage info:", error.response?.data || error.message);
        throw error;
    }
};
// Note: Download functionality is often handled by a direct link (`<a>` tag)
// to the download URL provided by the API (e.g., /api/resources/{id}/download/)
// rather than an Axios call, unless you need to handle the blob in JS.