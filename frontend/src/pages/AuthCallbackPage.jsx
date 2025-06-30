import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import supabaseService from '../services/supabaseService';
import toast from 'react-hot-toast';

const AuthCallbackPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { setAuthDataFromSocial } = useAuth();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        handleAuthCallback();
    }, []);

    const handleAuthCallback = async () => {
        try {
            setLoading(true);
            setError(null);

            // Verifica se ci sono errori nell'URL
            const errorParam = searchParams.get('error');
            if (errorParam) {
                throw new Error(`Errore di autenticazione: ${errorParam}`);
            }

            // Inizializza Supabase se non già fatto
            if (!supabaseService.initialized) {
                await supabaseService.initialize();
            }

            // Gestisci il callback di autenticazione
            const authData = await supabaseService.handleAuthCallback();

            if (authData && authData.access && authData.refresh) {
                // Imposta i dati di autenticazione nel context
                if (setAuthDataFromSocial) {
                    setAuthDataFromSocial(authData.access, authData.refresh, authData.user);
                }

                toast.success(`Accesso effettuato con ${authData.provider || 'social login'}!`);
                
                // Reindirizza alla home page
                navigate('/home', { replace: true });
            } else {
                throw new Error('Dati di autenticazione non validi ricevuti dal server');
            }

        } catch (error) {
            console.error('Error in auth callback:', error);
            setError(error.message || 'Errore durante l\'autenticazione');
            toast.error('Errore durante l\'autenticazione');
            
            // Reindirizza alla pagina di login dopo un breve delay
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 3000);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Completamento accesso...
                    </h2>
                    <p className="text-gray-600">
                        Stiamo finalizzando il tuo accesso. Attendere prego.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Errore di autenticazione
                    </h2>
                    <p className="text-gray-600 mb-4">
                        {error}
                    </p>
                    <p className="text-sm text-gray-500">
                        Reindirizzamento alla pagina di login in corso...
                    </p>
                </div>
            </div>
        );
    }

    return null;
};

export default AuthCallbackPage; 