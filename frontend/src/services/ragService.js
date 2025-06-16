import apiClient from './apiClient';

const API_RAG_URL = '/api/rag';

export const ragService = {
    /**
     * Carica un documento nel servizio RAG
     * @param {FormData} formData - I dati del file da caricare
     * @param {Function} onUploadProgress - Callback per il progresso dell'upload
     * @returns {Promise} - Risposta del server
     */
    uploadDocument: async (formData, onUploadProgress) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/documents/upload/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onUploadProgress?.(percentCompleted);
                },
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante il caricamento del documento');
        }
    },

    /**
     * Avvia l'elaborazione di tutti i documenti
     * @returns {Promise} - Risposta del server
     */
    processAllDocuments: async () => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/documents/process_all/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'elaborazione dei documenti');
        }
    },

    /**
     * Ottiene lo stato di elaborazione
     * @returns {Promise} - Stato di elaborazione
     */
    getProcessingStatus: async () => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/processing_status/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero dello stato di elaborazione');
        }
    },

    /**
     * Ottiene la lista dei documenti dell'utente
     * @returns {Promise} - Lista dei documenti
     */
    listUserDocuments: async () => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/documents/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero dei documenti');
        }
    },

    /**
     * Elimina un documento specifico
     * @param {string} documentId - ID del documento da eliminare
     * @returns {Promise} - Risposta del server
     */
    deleteDocument: async (documentId) => {
        try {
            const response = await apiClient.delete(`${API_RAG_URL}/documents/${documentId}/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'eliminazione del documento');
        }
    },

    /**
     * Svuota la knowledge base
     * @returns {Promise} - Risposta del server
     */
    clearKnowledgeBase: async () => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/documents/clear_all/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante lo svuotamento della knowledge base');
        }
    },

    /**
     * Invia un messaggio al chatbot
     * @param {string} message - Il messaggio dell'utente
     * @returns {Promise} - Risposta del chatbot
     */
    sendChatMessage: async (message) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/chat/`, { message });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'invio del messaggio');
        }
    },

    /**
     * Versione streaming del sendChatMessage (implementazione futura)
     * @param {string} message - Il messaggio dell'utente
     * @param {Function} onChunk - Callback per ogni chunk di risposta
     * @returns {Promise} - Stream della risposta
     */
    sendChatMessageStreaming: async (message, onChunk) => {
        try {
            const response = await fetch(`${API_RAG_URL}/chat/stream/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ message }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                onChunk?.(chunk);
            }
        } catch (error) {
            throw new Error('Errore durante lo streaming della risposta');
        }
    },
}; 