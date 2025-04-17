import axios from 'axios';

// Create an Axios instance with default configuration
const apiClient = axios.create({
    // The base URL should point to where Nginx proxies the API requests
    // Since Nginx is configured with `location /api/v1/`, we can use that.
    baseURL: '/', // Relative URL, works when served from the same origin (via Nginx)
    // baseURL: 'http://localhost:8080/api/v1', // Absolute URL for standalone testing (adjust port if needed)
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    // You might want to include credentials if using cookies/sessions elsewhere
    // withCredentials: true,
});

// --- Axios Interceptors ---

// Request Interceptor: Attaches the JWT token to requests if available
apiClient.interceptors.request.use(
    (config) => {
        // Get token from localStorage (more reliable than context state in interceptors)
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handles token refreshing for 401 errors
let isRefreshing = false;
let failedQueue = []; // Store requests that failed due to 401

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => {
        // Any status code within the range of 2xx cause this function to trigger
        return response;
    },
    async (error) => {
        // Any status codes outside the range of 2xx cause this function to trigger
        const originalRequest = error.config;

        // Check if the error is 401 (Unauthorized) and it's not a retry request
        if (error.response?.status === 401 && !originalRequest._retry) {

            // Avoid refresh loops for the refresh token endpoint itself
            if (originalRequest.url === '/token/refresh/') {
                 console.error("Refresh token request failed with 401. Likely invalid refresh token.");
                 // Trigger logout or redirect here - Using a custom event or calling a global logout function
                 window.dispatchEvent(new CustomEvent('auth-logout-event'));
                 return Promise.reject(error);
            }

            if (isRefreshing) {
                // If already refreshing, queue the request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return apiClient(originalRequest); // Retry with new token
                }).catch(err => {
                    return Promise.reject(err); // Propagate refresh error
                });
            }

            // Mark the request as retried and start refreshing
            originalRequest._retry = true;
            isRefreshing = true;

            const localRefreshToken = localStorage.getItem('refreshToken');
            if (!localRefreshToken) {
                 console.error("No refresh token available for refresh attempt.");
                 isRefreshing = false;
                 window.dispatchEvent(new CustomEvent('auth-logout-event'));
                 return Promise.reject(error);
            }

            try {
                console.log("Attempting token refresh...");
                const response = await axios.post('/api/v1/token/refresh/', {
                     refresh: localRefreshToken
                 }, {
                     baseURL: '/' // Use root base URL for refresh request if necessary
                 });

                const newAccessToken = response.data.access;
                // Note: SimpleJWT with ROTATE_REFRESH_TOKENS might also return a new refresh token
                const newRefreshToken = response.data.refresh || localRefreshToken; // Use new if provided

                console.log("Token refreshed successfully.");
                localStorage.setItem('accessToken', newAccessToken);
                localStorage.setItem('refreshToken', newRefreshToken); // Store new refresh token if received
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                // Process the queue with the new token
                processQueue(null, newAccessToken);

                // Retry the original request with the new token
                return apiClient(originalRequest);

            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
                processQueue(refreshError, null); // Reject queued requests
                 // Trigger logout or redirect here
                 window.dispatchEvent(new CustomEvent('auth-logout-event'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // For other errors, just reject the promise
        return Promise.reject(error);
    }
);


export default apiClient;