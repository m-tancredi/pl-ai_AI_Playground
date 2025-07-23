import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode'; // Correct named import
import apiClient from '../services/apiClient'; // Import the configured Axios instance
import { login as apiLogin, logout as apiLogout, refreshToken as apiRefreshToken } from '../services/authService'; // Import API functions
import supabaseService from '../services/supabaseService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || null);
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken') || null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Start as loading
    const [socialAuthProviders, setSocialAuthProviders] = useState([]);

    // Inizializza Supabase quando il context viene caricato
    useEffect(() => {
        const initializeSupabase = async () => {
            try {
                await supabaseService.initialize();
                const providers = await supabaseService.getAuthProviders();
                setSocialAuthProviders(providers);
                
                // Aggiungi listener per gli eventi di autenticazione di Supabase
                const { data: { subscription } } = supabaseService.onAuthStateChange((event, session) => {
                    // Supabase auth state listener - no action needed to avoid infinite loops
                    // Logout is already handled by clearAuthData()
                });
                
                // Cleanup function per rimuovere il listener
                return () => {
                    subscription?.unsubscribe();
                };
            } catch (error) {
                console.error('Failed to initialize social auth:', error);
                // Non bloccare l'app se l'inizializzazione sociale fallisce
            }
        };

        initializeSupabase();
    }, []); // Rimuovo clearAuthData dalle dipendenze

    const decodeToken = (token) => {
        if (!token) return null;
        try {
            const decoded = jwtDecode(token);
            // Basic validation: check expiry
            if (decoded.exp * 1000 < Date.now()) {
                console.warn("Token expired");
                return null;
            }
            // Return essential user info (adjust based on your token payload)
            return { id: decoded.user_id, username: decoded.username /* Add others if present */ };
        } catch (error) {
            console.error("Failed to decode token:", error);
            return null;
        }
    };

    const setAuthData = useCallback((access, refresh) => {
        const decodedUser = decodeToken(access);
        if (decodedUser) {
            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);
            setAccessToken(access);
            setRefreshToken(refresh);
            setUser(decodedUser);
            setIsAuthenticated(true);
            // Set the Authorization header for future requests
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        } else {
            // If decoding fails (e.g., invalid token format), clear auth
            clearAuthData();
        }
        setIsLoading(false);
    }, []);

    // Nuovo metodo per impostare i dati di autenticazione dall'autenticazione sociale
    const setAuthDataFromSocial = useCallback(async (access, refresh, userData) => {
        // Clear existing auth data before setting social auth data (inline to avoid circular dependency)
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        delete apiClient.defaults.headers.common['Authorization'];
        
        // NON chiamare supabaseService.signOut() per evitare loop infinito
        
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        setAccessToken(access);
        setRefreshToken(refresh);
        setUser(userData);
        setIsAuthenticated(true);
        // Set the Authorization header for future requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        setIsLoading(false);
    }, []); // Nessuna dipendenza per evitare circolarità

    const clearAuthData = useCallback(async () => {
        // Clear localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Clear sessionStorage (important for registration data and other cached data)
        sessionStorage.clear();
        
        // Clear state
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setIsAuthenticated(false);
        
        // Remove the Authorization header
        delete apiClient.defaults.headers.common['Authorization'];
        
        // NON chiamare supabaseService.signOut() per evitare loop infinito
        // Supabase viene già gestito dal suo auth state listener
        
        // Clear any browser cookies related to authentication
        try {
            // Clear domain cookies if any
            document.cookie.split(";").forEach((c) => {
                const eqPos = c.indexOf("=");
                const name = eqPos > -1 ? c.substr(0, eqPos) : c;
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
            });
        } catch (error) {
            console.error('Failed to clear cookies:', error);
        }
        
        setIsLoading(false); // Ensure loading stops after clearing
    }, []);

    // Effect to initialize auth state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            // Non skippare mai l'inizializzazione - i dati in localStorage sono la fonte di verità
            
            const storedAccessToken = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');

            if (storedAccessToken && storedRefreshToken) {
                const decodedUser = decodeToken(storedAccessToken);
                if (decodedUser) {
                    // Token exists and seems valid (not expired at decode time)
                    setAuthData(storedAccessToken, storedRefreshToken);
                } else {
                    // Access token might be expired, try refreshing
                    // Access token expired or invalid, attempting refresh
                    try {
                        const refreshResponse = await apiRefreshToken(storedRefreshToken);
                        setAuthData(refreshResponse.access, storedRefreshToken); // Use OLD refresh if rotation isn't returning new one
                        // Token refreshed successfully
                    } catch (error) {
                        console.error("Failed to refresh token on init:", error);
                        clearAuthData(); // Clear auth if refresh fails
                    }
                }
            } else {
                // No tokens found
                clearAuthData();
            }
             // Regardless of outcome, initialization is complete
             setIsLoading(false);
        };

        initializeAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearAuthData, setAuthData]); // isLoggingOut rimosso - non più necessario

    // Listener globale per eventi di logout
    useEffect(() => {
        const handleGlobalLogout = () => {
            // Global logout event received, clearing auth data
            clearAuthData();
        };

        window.addEventListener('auth-logout-event', handleGlobalLogout);
        
        return () => {
            window.removeEventListener('auth-logout-event', handleGlobalLogout);
        };
    }, [clearAuthData]);


    const login = async (credentials) => {
        setIsLoading(true);
        
        // Clear existing auth data inline before attempting login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        delete apiClient.defaults.headers.common['Authorization'];
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setIsAuthenticated(false);
        
        try {
            const response = await apiLogin(credentials);
            setAuthData(response.access, response.refresh);
            return response; // Allow component to handle success (e.g., redirect)
        } catch (error) {
            console.error("Login failed:", error);
            clearAuthData(); // Ensure inconsistent state is cleared on login failure
            setIsLoading(false);
            throw error; // Re-throw for the component to handle UI feedback
        }
    };

    // Nuovi metodi per l'autenticazione sociale
    const signInWithGoogle = async () => {
        try {
            setIsLoading(true);
            await supabaseService.signInWithGoogle();
            // Il redirect avviene automaticamente, non serve fare altro qui
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    const signInWithApple = async () => {
        try {
            setIsLoading(true);
            await supabaseService.signInWithApple();
            // Il redirect avviene automaticamente, non serve fare altro qui
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    const signInWithGitHub = async () => {
        try {
            setIsLoading(true);
            await supabaseService.signInWithGitHub();
            // Il redirect avviene automaticamente, non serve fare altro qui
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    const signInWithProvider = async (provider) => {
        try {
            setIsLoading(true);
            await supabaseService.signInWithProvider(provider);
            // Il redirect avviene automaticamente, non serve fare altro qui
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    const logout = async () => {
        setIsLoading(true);
        const currentRefreshToken = refreshToken; // Use state's refresh token
        clearAuthData(); // Clear local state immediately for faster UI update

        if (currentRefreshToken) {
            try {
                await apiLogout(currentRefreshToken); // Call backend to blacklist the token
                // Logout successful on backend
            } catch (error) {
                // Log error but don't block logout flow if backend call fails
                console.error("Failed to blacklist token on backend:", error);
            }
        }
        // No need to set loading false here, clearAuthData does it
    };

    const contextValue = {
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        isLoading,
        socialAuthProviders,
        login,
        logout,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signInWithProvider,
        setAuthDataFromSocial,
        // Expose setAuthData and clearAuthData if needed by interceptors directly
        // (though interceptors should ideally get tokens from state or storage)
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};