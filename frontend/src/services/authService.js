import apiClient from './apiClient';

// --- API Call Functions ---

/**
 * Logs in a user.
 * @param {object} credentials - { username, password }
 * @returns {Promise<object>} - Promise resolving with { access, refresh } tokens.
 */
export const login = async (credentials) => {
    try {
        const response = await apiClient.post('/api/v1/token/', credentials);
        return response.data; // Should contain access and refresh tokens
    } catch (error) {
        console.error("Login API call failed:", error.response?.data || error.message);
        throw error; // Re-throw to be handled by the caller (e.g., AuthContext or component)
    }
};

/**
 * Registers a new user.
 * @param {object} userData - { username, email, password, first_name?, last_name? }
 * @returns {Promise<object>} - Promise resolving with the created user data.
 */
export const register = async (userData) => {
    try {
        const response = await apiClient.post('/api/v1/register/', userData);
        return response.data;
    } catch (error) {
        console.error("Register API call failed:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Logs out a user by blacklisting the refresh token.
 * Requires the user to be authenticated (interceptor adds access token).
 * @param {string} refreshToken - The refresh token to blacklist.
 * @returns {Promise<void>} - Promise resolving on successful blacklist.
 */
export const logout = async (refreshToken) => {
    if (!refreshToken) {
        console.warn("Logout called without a refresh token.");
        return Promise.resolve(); // Or reject, depending on desired strictness
    }
    try {
        // Note: Access token for authentication is added by the request interceptor
        await apiClient.post('/api/v1/token/blacklist/', { refresh: refreshToken });
    } catch (error) {
        console.error("Logout API call (blacklist) failed:", error.response?.data || error.message);
        // Decide if this error should block the frontend logout flow
        // For now, we log it but allow frontend logout to proceed in AuthContext
        throw error; // Or just log and don't throw if backend failure shouldn't block UI logout
    }
};

/**
 * Refreshes the access token using a refresh token.
 * This is primarily used by the response interceptor but can be exposed if needed.
 * @param {string} refreshToken - The refresh token.
 * @returns {Promise<object>} - Promise resolving with { access, refresh? } tokens.
 */
export const refreshToken = async (refreshToken) => {
     if (!refreshToken) {
        throw new Error("Refresh token is required.");
    }
    try {
        // Use axios directly or a separate instance *without* the interceptor loop potential
        const response = await axios.post('/api/v1/token/refresh/', { refresh: refreshToken }, { baseURL: '/' });
        return response.data; // Should contain 'access' token, maybe 'refresh' if rotated
    } catch (error) {
        console.error("Refresh token API call failed:", error.response?.data || error.message);
        throw error;
    }
};


/**
 * Fetches the profile of the currently authenticated user.
 * Requires the user to be authenticated (interceptor adds access token).
 * @returns {Promise<object>} - Promise resolving with the user profile data.
 */
export const getUserProfile = async () => {
    try {
        // Access token added by interceptor
        const response = await apiClient.get('/api/v1/users/me/');
        return response.data;
    } catch (error) {
        console.error("Get User Profile API call failed:", error.response?.data || error.message);
        throw error;
    }
};

// Add other auth-related API calls here (e.g., password reset request, confirm reset, etc.)