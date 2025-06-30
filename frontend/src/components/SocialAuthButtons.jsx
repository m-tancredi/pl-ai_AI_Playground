import React from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const SocialAuthButtons = ({ className = "" }) => {
    const { 
        socialAuthProviders, 
        signInWithGoogle, 
        signInWithApple, 
        signInWithGitHub,
        signInWithProvider,
        isLoading 
    } = useAuth();

    const handleSocialLogin = async (provider) => {
        try {
            switch (provider.toLowerCase()) {
                case 'google':
                    await signInWithGoogle();
                    break;
                case 'apple':
                    await signInWithApple();
                    break;
                case 'github':
                    await signInWithGitHub();
                    break;
                default:
                    await signInWithProvider(provider);
            }
        } catch (error) {
            console.error(`${provider} login failed:`, error);
            toast.error(`Errore nell'accesso con ${provider}: ${error.message}`);
        }
    };

    const getProviderIcon = (provider) => {
        switch (provider.toLowerCase()) {
            case 'google':
                return (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                );
            case 'apple':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5Z"/>
                        <path d="M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/>
                    </svg>
                );
            case 'github':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                );
            default:
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                );
        }
    };

    const getProviderLabel = (provider) => {
        switch (provider.toLowerCase()) {
            case 'google':
                return 'Continua con Google';
            case 'apple':
                return 'Continua con Apple';
            case 'github':
                return 'Continua con GitHub';
            default:
                return `Continua con ${provider}`;
        }
    };

    const getProviderButtonClass = (provider) => {
        const baseClass = "w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
        
        switch (provider.toLowerCase()) {
            case 'google':
                return `${baseClass} text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500 border-gray-300`;
            case 'apple':
                return `${baseClass} text-white bg-black hover:bg-gray-800 focus:ring-gray-500 border-black`;
            case 'github':
                return `${baseClass} text-white bg-gray-900 hover:bg-gray-800 focus:ring-gray-500 border-gray-900`;
            default:
                return `${baseClass} text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500`;
        }
    };

    if (!socialAuthProviders || socialAuthProviders.length === 0) {
        return null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">oppure</span>
                </div>
            </div>

            <div className="space-y-3">
                {socialAuthProviders.map((provider) => (
                    <button
                        key={provider.id}
                        onClick={() => handleSocialLogin(provider.id)}
                        disabled={isLoading}
                        className={`${getProviderButtonClass(provider.id)} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center justify-center space-x-3">
                            {getProviderIcon(provider.id)}
                            <span>{getProviderLabel(provider.id)}</span>
                        </div>
                        {isLoading && (
                            <div className="ml-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SocialAuthButtons; 