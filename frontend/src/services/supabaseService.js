/**
 * Servizio per l'integrazione con Supabase
 * Gestisce l'autenticazione sociale e la comunicazione con il backend
 */

import { createClient } from '@supabase/supabase-js';
import apiClient from './apiClient';

class SupabaseService {
    constructor() {
        this.supabase = null;
        this.config = null;
        this.initialized = false;
    }

    /**
     * Inizializza il client Supabase con la configurazione dal backend
     */
    async initialize() {
        try {
            // Ottieni la configurazione dal backend
            const response = await apiClient.get('/api/v1/social-auth/config/');
            this.config = response.data;

            // Crea il client Supabase
            this.supabase = createClient(
                this.config.supabase_url,
                this.config.supabase_anon_key
            );

            this.initialized = true;
            console.log('Supabase initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            throw new Error('Impossibile inizializzare Supabase');
        }
    }

    /**
     * Verifica se il servizio è inizializzato
     */
    ensureInitialized() {
        if (!this.initialized || !this.supabase) {
            throw new Error('Supabase non inizializzato. Chiamare initialize() prima.');
        }
    }

    /**
     * Ottiene la lista dei provider di autenticazione disponibili
     */
    async getAuthProviders() {
        try {
            const response = await apiClient.get('/api/v1/social-auth/providers/');
            return response.data.providers;
        } catch (error) {
            console.error('Failed to get auth providers:', error);
            throw error;
        }
    }

    /**
     * Inizia il flusso di autenticazione con Google
     */
    async signInWithGoogle() {
        this.ensureInitialized();
        
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Google sign-in failed:', error);
            throw new Error('Errore nell\'autenticazione con Google');
        }
    }

    /**
     * Inizia il flusso di autenticazione con Apple
     */
    async signInWithApple() {
        this.ensureInitialized();
        
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Apple sign-in failed:', error);
            throw new Error('Errore nell\'autenticazione con Apple');
        }
    }

    /**
     * Inizia il flusso di autenticazione con GitHub
     */
    async signInWithGitHub() {
        this.ensureInitialized();
        
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('GitHub sign-in failed:', error);
            throw new Error('Errore nell\'autenticazione con GitHub');
        }
    }

    /**
     * Gestisce il callback dopo l'autenticazione sociale
     */
    async handleAuthCallback() {
        this.ensureInitialized();
        
        try {
            // Ottieni la sessione corrente da Supabase
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                throw error;
            }

            if (!session) {
                throw new Error('Nessuna sessione trovata dopo l\'autenticazione');
            }

            // Estrai il provider dal JWT
            const provider = session.user?.app_metadata?.provider || 'unknown';

            // Invia i token al nostro backend
            const response = await apiClient.post('/api/v1/social-auth/callback/', {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                provider: provider
            });

            return response.data;
        } catch (error) {
            console.error('Auth callback failed:', error);
            throw error;
        }
    }

    /**
     * Ottiene la sessione corrente di Supabase
     */
    async getCurrentSession() {
        this.ensureInitialized();
        
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                throw error;
            }

            return session;
        } catch (error) {
            console.error('Failed to get current session:', error);
            throw error;
        }
    }

    /**
     * Effettua il logout da Supabase
     */
    async signOut() {
        this.ensureInitialized();
        
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                throw error;
            }

            console.log('Signed out from Supabase successfully');
        } catch (error) {
            console.error('Supabase sign-out failed:', error);
            // Non lanciare l'errore per non bloccare il logout locale
        }
    }

    /**
     * Ascolta i cambiamenti dello stato di autenticazione
     */
    onAuthStateChange(callback) {
        this.ensureInitialized();
        
        return this.supabase.auth.onAuthStateChange(callback);
    }

    /**
     * Metodo generico per iniziare l'autenticazione con un provider
     */
    async signInWithProvider(provider) {
        switch (provider.toLowerCase()) {
            case 'google':
                return this.signInWithGoogle();
            case 'apple':
                return this.signInWithApple();
            case 'github':
                return this.signInWithGitHub();
            default:
                throw new Error(`Provider ${provider} non supportato`);
        }
    }
}

// Istanza singleton del servizio
const supabaseService = new SupabaseService();

export default supabaseService; 