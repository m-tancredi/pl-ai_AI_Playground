import { useState, useEffect, useCallback } from 'react';
import { ragService } from '../services/ragService';

export const useUnifiedRAG = () => {
    // ========== STATI PRINCIPALI ==========
    const [documents, setDocuments] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // ========== STATI CHAT UNIFICATA ==========
    const [activeMode, setActiveMode] = useState('global'); // 'global' | 'kb-{id}'
    const [chatSessions, setChatSessions] = useState({
        global: null,
        kb: {}
    });
    const [currentSession, setCurrentSession] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    // ========== STATI UI ==========
    const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'knowledge-bases' | 'chat'
    const [showCreateKBModal, setShowCreateKBModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [selectedKB, setSelectedKB] = useState(null);
    
    // ========== STATI TYPEWRITER ==========
    const [typewriterSettings, setTypewriterSettings] = useState({
        enabled: true,
        speed: 50,
        showCursor: true,
        enableSkip: true,
        soundEnabled: false
    });
    const [streamingMessages, setStreamingMessages] = useState(new Set());

    // ========== FILTRI E RICERCA ==========
    const [documentFilters, setDocumentFilters] = useState({
        search: '',
        status: 'all', // 'all' | 'processed' | 'processing' | 'failed'
        fileType: 'all',
        knowledgeBase: 'all'
    });

    // ========== CARICAMENTO DATI INIZIALI ==========
    const loadInitialData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [docsResponse, kbResponse] = await Promise.all([
                ragService.listUserDocuments(),
                ragService.listKnowledgeBases()
            ]);

            setDocuments(docsResponse.results || docsResponse);
            setKnowledgeBases(kbResponse.results || kbResponse);

            // Inizializza cronologie chat per ogni KB
            const kbHistories = {};
            (kbResponse.results || kbResponse).forEach(kb => {
                kbHistories[`kb-${kb.id}`] = [];
            });
            setChatSessions(prev => ({ ...prev, ...kbHistories }));

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ========== GESTIONE DOCUMENTI ==========
    const uploadDocuments = useCallback(async (files) => {
        try {
            setError(null);
            
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                await ragService.uploadDocument(formData, (progress) => {
                    setUploadProgress(progress);
                });
            }

            await loadInitialData();
            setUploadProgress(0);
        } catch (err) {
            setError(err.message);
            setUploadProgress(0);
        }
    }, [loadInitialData]);

    const deleteDocument = useCallback(async (documentId) => {
        try {
            await ragService.deleteDocument(documentId);
            await loadInitialData();
        } catch (err) {
            setError(err.message);
        }
    }, [loadInitialData]);

    const deleteSelectedDocuments = useCallback(async () => {
        try {
            await Promise.all(
                selectedDocuments.map(id => ragService.deleteDocument(id))
            );
            setSelectedDocuments([]);
            await loadInitialData();
        } catch (err) {
            setError(err.message);
        }
    }, [selectedDocuments, loadInitialData]);

    // ========== GESTIONE KNOWLEDGE BASE ==========
    const createKnowledgeBase = useCallback(async (kbData) => {
        try {
            const newKB = await ragService.createKnowledgeBase({
                name: kbData.name,
                description: kbData.description,
                chunk_size: kbData.chunk_size,
                chunk_overlap: kbData.chunk_overlap,
                embedding_model: kbData.embedding_model
            });

            // Aggiungi documenti se selezionati
            if (kbData.selectedDocuments && kbData.selectedDocuments.length > 0) {
                await ragService.addDocumentsToKnowledgeBase(newKB.id, kbData.selectedDocuments);
            }

            // Inizializza cronologia chat per la nuova KB
            setChatSessions(prev => ({
                ...prev,
                [`kb-${newKB.id}`]: []
            }));

            await loadInitialData();
            setShowCreateKBModal(false);
            return newKB;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [loadInitialData]);

    const deleteKnowledgeBase = useCallback(async (kbId) => {
        try {
            await ragService.deleteKnowledgeBase(kbId);
            
            // Rimuovi cronologia chat
            setChatSessions(prev => {
                const newHistories = { ...prev };
                delete newHistories[`kb-${kbId}`];
                return newHistories;
            });

            // Se era la KB attiva, torna alla modalità globale
            if (activeMode === `kb-${kbId}`) {
                setActiveMode('global');
            }

            await loadInitialData();
        } catch (err) {
            setError(err.message);
        }
    }, [activeMode, loadInitialData]);

    const addDocumentsToKB = useCallback(async (kbId, documentIds) => {
        try {
            await ragService.addDocumentsToKnowledgeBase(kbId, documentIds);
            await loadInitialData();
        } catch (err) {
            setError(err.message);
        }
    }, [loadInitialData]);

    const removeDocumentsFromKB = useCallback(async (kbId, documentIds) => {
        try {
            await ragService.removeDocumentsFromKnowledgeBase(kbId, documentIds);
            await loadInitialData();
        } catch (err) {
            setError(err.message);
        }
    }, [loadInitialData]);

    // ========== CARICAMENTO SESSIONI CHAT ==========
    const loadChatSessions = useCallback(async () => {
        console.log('🔄 Inizio caricamento sessioni chat...');
        try {
            const sessionsData = await ragService.getChatSessions();
            console.log('📥 Dati sessioni ricevuti:', sessionsData);
            
            // Controllo di sicurezza per dati undefined
            if (!sessionsData) {
                console.warn('⚠️ Nessun dato sessioni ricevuto');
                return;
            }
            
            const sessions = {
                global: (sessionsData.global_sessions && sessionsData.global_sessions.length > 0) 
                    ? sessionsData.global_sessions[0] 
                    : null,
                kb: {}
            };
            
            console.log('🔍 Sessione globale trovata:', sessions.global);
            
            // Organizza le sessioni KB per ID con controllo sicurezza
            if (sessionsData.kb_sessions && Array.isArray(sessionsData.kb_sessions)) {
                console.log('📚 Sessioni KB trovate:', sessionsData.kb_sessions.length);
                sessionsData.kb_sessions.forEach(session => {
                    if (session && session.knowledge_base) {
                        sessions.kb[session.knowledge_base] = session;
                        console.log(`📖 Sessione KB ${session.knowledge_base}:`, session.id);
                    }
                });
            }
            
            console.log('✅ Sessioni organizzate:', sessions);
            setChatSessions(sessions);
            
        } catch (err) {
            console.error('❌ Errore nel caricamento delle sessioni:', err);
            // Imposta sessioni vuote in caso di errore
            setChatSessions({
                global: null,
                kb: {}
            });
        }
    }, []);

    // ========== CARICAMENTO SESSIONE CORRENTE ==========
    const loadCurrentSession = useCallback(async () => {
        try {
            let session = null;
            
            if (activeMode === 'global') {
                session = chatSessions.global;
            } else {
                const kbId = activeMode.replace('kb-', '');
                session = chatSessions.kb[kbId];
            }
            
            if (session && session.id) {
                // Carica i messaggi della sessione
                const sessionData = await ragService.getChatSession(session.id);
                
                if (sessionData) {
                    setCurrentSession(sessionData);
                    
                    // Converte i messaggi nel formato del frontend con controllo sicurezza
                    const messages = (sessionData.messages && Array.isArray(sessionData.messages)) 
                        ? sessionData.messages.map(msg => ({
                            id: msg.id,
                            text: msg.content || '',
                            isUser: msg.is_user,
                            timestamp: msg.created_at,
                            sources: msg.sources || [],
                            isComplete: true,
                            onComplete: () => {}
                        }))
                        : [];
                    
                    setChatHistory(messages);
                } else {
                    setCurrentSession(null);
                    setChatHistory([]);
                }
            } else {
                setCurrentSession(null);
                setChatHistory([]);
            }
            
        } catch (err) {
            console.error('Errore nel caricamento della sessione:', err);
            setCurrentSession(null);
            setChatHistory([]);
        }
    }, [activeMode, chatSessions]);

    // ========== CREAZIONE NUOVA SESSIONE ==========
    const createNewSession = useCallback(async () => {
        try {
            const sessionData = {
                title: `Chat ${new Date().toLocaleString()}`,
                knowledge_base: activeMode === 'global' ? null : activeMode.replace('kb-', '')
            };
            
            console.log('Creazione sessione con dati:', sessionData);
            
            const newSession = await ragService.createChatSession(sessionData);
            
            if (!newSession || !newSession.id) {
                throw new Error('Sessione creata non valida');
            }
            
            console.log('Sessione creata:', newSession);
            
            // Aggiorna le sessioni locali
            setChatSessions(prev => {
                const updated = { ...prev };
                if (activeMode === 'global') {
                    updated.global = newSession;
                } else {
                    const kbId = activeMode.replace('kb-', '');
                    updated.kb[kbId] = newSession;
                }
                return updated;
            });
            
            setCurrentSession(newSession);
            setChatHistory([]);
            
            return newSession;
            
        } catch (err) {
            console.error('Errore nella creazione della sessione:', err);
            throw err;
        }
    }, [activeMode]);

    // ========== GESTIONE CHAT UNIFICATA ==========
    const sendChatMessage = useCallback(async (message) => {
        if (!message.trim() || isChatLoading) return;

        try {
            setIsChatLoading(true);
            
            // Crea sessione se non esiste
            let session = currentSession;
            if (!session || !session.id) {
                console.log('Creazione nuova sessione per modalità:', activeMode);
                session = await createNewSession();
                
                if (!session || !session.id) {
                    throw new Error('Impossibile creare la sessione di chat');
                }
            }
            
            // Invia messaggio tramite API
            const response = await ragService.sendChatMessage(session.id, message.trim());
            
            // Controllo di sicurezza per la risposta
            if (!response || !response.user_message || !response.ai_message) {
                throw new Error('Risposta API non valida');
            }
            
            // Converte i messaggi nel formato del frontend
            const userMsg = {
                id: response.user_message.id,
                text: response.user_message.content || '',
                isUser: true,
                timestamp: response.user_message.created_at,
                isComplete: true
            };
            
            const aiMsg = {
                id: response.ai_message.id,
                text: response.ai_message.content || '',
                isUser: false,
                timestamp: response.ai_message.created_at,
                sources: response.ai_message.sources || [],
                isComplete: !typewriterSettings.enabled,
                onComplete: () => {
                    setChatHistory(prev => prev.map(msg => 
                        msg.id === aiMsg.id ? { ...msg, isComplete: true } : msg
                    ));
                }
            };
            
            // Aggiorna la cronologia
            setChatHistory(prev => [...prev, userMsg, aiMsg]);
            
            // Aggiorna la sessione corrente
            if (response.session) {
                setCurrentSession(response.session);
            }
            
        } catch (err) {
            console.error('Errore nell\'invio del messaggio:', err);
            setError(err.message);
            
            // Aggiungi messaggio di errore alla chat
            const errorMsg = {
                id: `error-${Date.now()}`,
                text: `Errore: ${err.message}`,
                isUser: false,
                timestamp: new Date().toISOString(),
                sources: [],
                isComplete: true,
                isError: true
            };
            
            setChatHistory(prev => [...prev, errorMsg]);
            
        } finally {
            setIsChatLoading(false);
        }
    }, [currentSession, createNewSession, typewriterSettings.enabled, isChatLoading, activeMode]);

    // ========== PULIZIA CHAT ==========
    const clearChatHistory = useCallback(async () => {
        if (!currentSession) {
            setChatHistory([]);
            return;
        }
        
        try {
            await ragService.clearChatSession(currentSession.id);
            setChatHistory([]);
            
            // Aggiorna la sessione
            setCurrentSession(prev => prev ? {
                ...prev,
                message_count: 0,
                title: ''
            } : null);
            
        } catch (err) {
            setError(err.message);
        }
    }, [currentSession]);

    // ========== CAMBIO MODALITÀ ==========
    const switchChatMode = useCallback(async (newMode) => {
        setActiveMode(newMode);
        // loadCurrentSession verrà chiamato automaticamente dall'useEffect
    }, []);

    // ========== AZIONI BULK ==========
    const createKBFromSelected = useCallback(() => {
        if (selectedDocuments.length === 0) return;
        setShowCreateKBModal(true);
    }, [selectedDocuments]);

    const addSelectedToKB = useCallback(async (kbId) => {
        if (selectedDocuments.length === 0) return;
        await addDocumentsToKB(kbId, selectedDocuments);
        setSelectedDocuments([]);
    }, [selectedDocuments, addDocumentsToKB]);

    // ========== FILTRI ==========
    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.original_filename.toLowerCase().includes(documentFilters.search.toLowerCase());
        const matchesStatus = documentFilters.status === 'all' || doc.status === documentFilters.status;
        const matchesFileType = documentFilters.fileType === 'all' || doc.file_type === documentFilters.fileType;
        
        // Filtro per KB - implementare logica per verificare appartenenza
        const matchesKB = documentFilters.knowledgeBase === 'all' || 
                         (documentFilters.knowledgeBase === 'unassigned' && !doc.knowledge_bases?.length) ||
                         doc.knowledge_bases?.some(kb => kb.id.toString() === documentFilters.knowledgeBase);

        return matchesSearch && matchesStatus && matchesFileType && matchesKB;
    });

    // ========== STATISTICHE ==========
    const stats = {
        totalDocuments: documents.length,
        processedDocuments: documents.filter(doc => doc.status === 'processed').length,
        totalKnowledgeBases: knowledgeBases.length,
        totalChunks: knowledgeBases.reduce((sum, kb) => sum + (kb.total_chunks || 0), 0),
        selectedCount: selectedDocuments.length
    };

    // ========== EFFETTI ==========
    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Carica le sessioni solo dopo aver caricato i dati iniziali
    useEffect(() => {
        if (!loading && documents.length >= 0) {
            loadChatSessions();
        }
    }, [loading, documents.length, loadChatSessions]);

    // Carica la sessione quando cambia la modalità
    useEffect(() => {
        if (Object.keys(chatSessions.kb).length > 0 || chatSessions.global !== undefined) {
            loadCurrentSession();
        }
    }, [activeMode, loadCurrentSession, chatSessions]);

    // ========== RETURN ==========
    return {
        // Stati
        documents: filteredDocuments,
        allDocuments: documents,
        knowledgeBases,
        selectedDocuments,
        loading,
        error,
        uploadProgress,
        
        // Chat
        activeMode,
        chatSessions,
        currentSession,
        chatHistory,
        chatInput,
        isChatLoading,
        
        // UI
        activeTab,
        showCreateKBModal,
        showStatsModal,
        selectedKB,
        documentFilters,
        stats,

        // Azioni documenti
        uploadDocuments,
        deleteDocument,
        deleteSelectedDocuments,
        setSelectedDocuments,
        
        // Azioni KB
        createKnowledgeBase,
        deleteKnowledgeBase,
        addDocumentsToKB,
        removeDocumentsFromKB,
        
        // Chat
        sendChatMessage,
        switchChatMode,
        clearChatHistory,
        setChatInput,
        
        // Bulk actions
        createKBFromSelected,
        addSelectedToKB,
        
        // UI actions
        setActiveTab,
        setShowCreateKBModal,
        setShowStatsModal,
        setSelectedKB,
        setDocumentFilters,
        setError,
        
        // Typewriter
        typewriterSettings,
        setTypewriterSettings,
        streamingMessages,
        
        // Utility
        loadInitialData
    };
}; 