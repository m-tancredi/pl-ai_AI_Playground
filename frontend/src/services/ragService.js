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
     * Ottiene i dettagli completi di un documento
     * @param {string} documentId - ID del documento
     * @returns {Promise} - Dettagli del documento
     */
    getDocumentDetails: async (documentId) => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/documents/${documentId}/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero dei dettagli del documento');
        }
    },

    /**
     * 🧠 Cerca contenuto all'interno di un documento usando AI Ultra-Intelligente
     * @param {string} documentId - ID del documento
     * @param {string} query - Query di ricerca in linguaggio naturale
     * @param {Object} options - Opzioni di ricerca avanzate
     * @returns {Promise} - Risultati della ricerca con analytics e clustering
     */
    searchDocumentContent: async (documentId, query, options = {}) => {
        try {
            const searchPayload = {
                document_id: documentId,
                query: query,
                options: {
                    top_k: options.top_k || 10,
                    include_context: options.include_context !== false,
                    similarity_threshold: options.similarity_threshold || 0.7,
                    enable_clustering: options.enable_clustering !== false,
                    ...options
                }
            };

            const response = await apiClient.post(`${API_RAG_URL}/documents/search_content/`, searchPayload);
            
            // 🎯 Log delle informazioni di ricerca per debugging
            if (response.data.provider_info) {
                console.log('🔥 Ricerca AI completata:', {
                    provider: response.data.provider_info.provider,
                    model: response.data.provider_info.model,
                    search_type: response.data.search_type,
                    results_count: response.data.results?.length || 0
                });
            }

            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || error.response?.data?.message || 'Errore durante la ricerca AI nel documento');
        }
    },

    /**
     * Ottiene l'URL del PDF per la visualizzazione
     * @param {string} documentId - ID del documento
     * @returns {string} - URL del PDF
     */
    getPdfUrl: (documentId) => {
        const token = localStorage.getItem('token');
        return `${API_RAG_URL}/documents/${documentId}/download_pdf/?token=${token}`;
    },

    /**
     * Scarica il PDF di un documento
     * @param {string} documentId - ID del documento
     * @returns {Promise<Blob>} - Blob del PDF
     */
    downloadPdf: async (documentId) => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/documents/${documentId}/download_pdf/`, {
                responseType: 'blob',
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante il download del PDF');
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

    // ========== KNOWLEDGE BASE MANAGEMENT ==========

    /**
     * Ottiene la lista delle knowledge base dell'utente
     * @returns {Promise} - Lista delle knowledge base
     */
    listKnowledgeBases: async () => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/knowledge-bases/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero delle knowledge base');
        }
    },

    /**
     * Ottiene i dettagli di una knowledge base specifica
     * @param {string} kbId - ID della knowledge base
     * @returns {Promise} - Dettagli della knowledge base
     */
    getKnowledgeBase: async (kbId) => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/knowledge-bases/${kbId}/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero della knowledge base');
        }
    },

    /**
     * Crea una nuova knowledge base
     * @param {Object} kbData - Dati della knowledge base (name, description, chunk_size, chunk_overlap, embedding_model)
     * @returns {Promise} - Knowledge base creata
     */
    createKnowledgeBase: async (kbData) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/knowledge-bases/`, kbData);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante la creazione della knowledge base');
        }
    },

    /**
     * Aggiorna una knowledge base esistente
     * @param {string} kbId - ID della knowledge base
     * @param {Object} kbData - Dati aggiornati della knowledge base
     * @returns {Promise} - Knowledge base aggiornata
     */
    updateKnowledgeBase: async (kbId, kbData) => {
        try {
            const response = await apiClient.put(`${API_RAG_URL}/knowledge-bases/${kbId}/`, kbData);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'aggiornamento della knowledge base');
        }
    },

    /**
     * Elimina una knowledge base
     * @param {string} kbId - ID della knowledge base
     * @returns {Promise} - Risposta del server
     */
    deleteKnowledgeBase: async (kbId) => {
        try {
            const response = await apiClient.delete(`${API_RAG_URL}/knowledge-bases/${kbId}/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'eliminazione della knowledge base');
        }
    },

    /**
     * Ottiene le statistiche dettagliate di una knowledge base
     * @param {string} kbId - ID della knowledge base
     * @returns {Promise} - Statistiche della knowledge base
     */
    getKnowledgeBaseStatistics: async (kbId) => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/knowledge-bases/${kbId}/statistics/`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore nel recupero delle statistiche');
        }
    },

    // ========== DOCUMENT MANAGEMENT IN KB ==========

    /**
     * Aggiunge documenti a una knowledge base
     * @param {string} kbId - ID della knowledge base
     * @param {Array} documentIds - Array di ID dei documenti da aggiungere
     * @returns {Promise} - Risposta del server
     */
    addDocumentsToKnowledgeBase: async (kbId, documentIds) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/knowledge-bases/${kbId}/add_documents/`, {
                document_ids: documentIds
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'aggiunta dei documenti');
        }
    },

    /**
     * Rimuove documenti da una knowledge base
     * @param {string} kbId - ID della knowledge base
     * @param {Array} documentIds - Array di ID dei documenti da rimuovere
     * @returns {Promise} - Risposta del server
     */
    removeDocumentsFromKnowledgeBase: async (kbId, documentIds) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/knowledge-bases/${kbId}/remove_documents/`, {
                document_ids: documentIds
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante la rimozione dei documenti');
        }
    },

    // ========== KB-SPECIFIC CHAT ==========

    /**
     * Invia un messaggio alla chat di una knowledge base specifica
     * @param {string} kbId - ID della knowledge base
     * @param {string} message - Il messaggio dell'utente
     * @param {Object} options - Opzioni aggiuntive (top_k, max_tokens)
     * @returns {Promise} - Risposta del chatbot
     */
    sendKnowledgeBaseChatMessage: async (kbId, message, options = {}) => {
        try {
            const payload = {
                message,
                ...options
            };
            const response = await apiClient.post(`${API_RAG_URL}/knowledge-bases/${kbId}/chat/`, payload);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Errore durante l\'invio del messaggio');
        }
    },

    // ===== CHAT SESSIONS =====

    // Ottieni tutte le sessioni di chat dell'utente
    getChatSessions: async () => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/chat-sessions/list/`);
            return response.data;
        } catch (error) {
            console.error('Errore nel recupero delle sessioni di chat:', error);
            throw error;
        }
    },

    // Crea una nuova sessione di chat
    createChatSession: async (sessionData) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/chat-sessions/`, sessionData);
            return response.data;
        } catch (error) {
            console.error('Errore nella creazione della sessione di chat:', error);
            throw error;
        }
    },

    // Ottieni una sessione di chat specifica con tutti i messaggi
    getChatSession: async (sessionId) => {
        try {
            const response = await apiClient.get(`${API_RAG_URL}/chat-sessions/${sessionId}/`);
            return response.data;
        } catch (error) {
            console.error('Errore nel recupero della sessione di chat:', error);
            throw error;
        }
    },

    // Invia un messaggio in una sessione di chat
    sendChatMessage: async (sessionId, message) => {
        try {
            const response = await apiClient.post(`${API_RAG_URL}/chat-sessions/${sessionId}/send_message/`, {
                message: message
            });
            return response.data;
        } catch (error) {
            console.error('Errore nell\'invio del messaggio:', error);
            throw error;
        }
    },

    // Cancella tutti i messaggi di una sessione
    clearChatSession: async (sessionId) => {
        try {
            const response = await apiClient.delete(`${API_RAG_URL}/chat-sessions/${sessionId}/clear_messages/`);
            return response.data;
        } catch (error) {
            console.error('Errore nella cancellazione dei messaggi:', error);
            throw error;
        }
    },

    // Elimina una sessione di chat
    deleteChatSession: async (sessionId) => {
        try {
            const response = await apiClient.delete(`${API_RAG_URL}/chat-sessions/${sessionId}/`);
            return response.data;
        } catch (error) {
            console.error('Errore nell\'eliminazione della sessione:', error);
            throw error;
        }
    },

    // Aggiorna una sessione di chat (es. titolo)
    updateChatSession: async (sessionId, sessionData) => {
        try {
            const response = await apiClient.patch(`${API_RAG_URL}/chat-sessions/${sessionId}/`, sessionData);
            return response.data;
        } catch (error) {
            console.error('Errore nell\'aggiornamento della sessione:', error);
            throw error;
        }
    },

    /**
     * Ottiene l'elenco delle risorse compatibili con RAG dal Resource Manager
     * @param {Object} options - Opzioni di filtro
     * @returns {Promise} - Lista delle risorse compatibili
     */
    getResourceManagerDocuments: async (options = {}) => {
        try {
            const params = new URLSearchParams();
            if (options.limit) params.append('limit', options.limit);

            const response = await apiClient.get(`${API_RAG_URL}/resource-manager/resources/?${params.toString()}`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || error.response?.data?.message || 'Errore durante il recupero delle risorse dal Resource Manager');
        }
    },

    /**
     * Processa una risorsa esistente dal Resource Manager per il RAG
     * @param {number} resourceId - ID della risorsa nel Resource Manager
     * @param {Object} options - Opzioni aggiuntive (es. knowledge_base)
     * @returns {Promise} - Documento RAG creato
     */
    processResourceFromManager: async (resourceId, options = {}) => {
        try {
            const formData = new FormData();
            formData.append('resource_id', resourceId.toString());
            
            if (options.knowledge_base) {
                formData.append('knowledge_base', options.knowledge_base.toString());
            }

            const response = await apiClient.post(`${API_RAG_URL}/documents/upload/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || error.response?.data?.message || 'Errore durante il processamento della risorsa');
        }
    }
}; 