import React, { useEffect, useState } from 'react';
import { useUnifiedRAG } from '../hooks/useUnifiedRAG';
import DocumentManager from '../components/DocumentManager';
import KnowledgeBaseManager from '../components/KnowledgeBaseManager';
import UnifiedChat from '../components/UnifiedChat';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';
import KnowledgeBaseStatsModal from '../components/KnowledgeBaseStatsModal';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { ragService } from '../services/ragService';
import { 
    Bars3Icon,
    XMarkIcon,
    DocumentTextIcon,
    ChatBubbleLeftRightIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    QuestionMarkCircleIcon,
    PlusIcon
} from '@heroicons/react/24/outline';

const UnifiedRAGPage = () => {
    const {
        // Stati
        documents,
        knowledgeBases,
        selectedDocuments,
        loading,
        error,
        uploadProgress,
        
        // 🔥 STATI POLLING TEMPO REALE
        processingDocuments,
        isDocumentProcessing,
        
        // Chat
        activeMode,
        currentChatHistory,
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

        // New chat session
        currentSession,
        chatHistory,
        
        // File taggati RAG
        ragTaggedDocuments,
        isLoadingRAGTagged,
        availableTags,
        showRAGTaggedSection,
        setShowRAGTaggedSection,
        loadRAGTaggedDocuments,
        loadAvailableTags,
        processResourceFromManager
    } = useUnifiedRAG();

    const [sidebarOpen, setSidebarOpen] = React.useState(true);
    const [isMobile, setIsMobile] = React.useState(false);
    const [showTypewriterSettings, setShowTypewriterSettings] = React.useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [processingResourceIds, setProcessingResourceIds] = useState(new Set());

    // Gestione responsive
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e) => {
            if (e.metaKey || e.ctrlKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        // Focus su selector modalità chat
                        break;
                    case 'n':
                        e.preventDefault();
                        setShowCreateKBModal(true);
                        break;
                    case 'u':
                        e.preventDefault();
                        // Focus su upload
                        break;
                    case 'Enter':
                        if (chatInput.trim()) {
                            e.preventDefault();
                            sendChatMessage(chatInput);
                        }
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [chatInput, sendChatMessage, setShowCreateKBModal]);

    const handleKBEdit = (kbId) => {
        const kb = knowledgeBases.find(k => k.id === kbId);
        if (kb) {
            setSelectedKB(kb);
            setShowCreateKBModal(true);
        }
    };

    const handleKBStats = (kbId) => {
        const kb = knowledgeBases.find(k => k.id === kbId);
        if (kb) {
            setSelectedKB(kb);
            setShowStatsModal(true);
        }
    };

    const handleKBDelete = async (kbId) => {
        if (window.confirm('Sei sicuro di voler eliminare questa Knowledge Base?')) {
            await deleteKnowledgeBase(kbId);
        }
    };

    const handlePreviewDocument = async (document) => {
        try {
            // Verifica se il documento ha contenuto
            if (!document.has_content || document.status !== 'processed') {
                setError('Contenuto del documento non disponibile');
                return;
            }

            // Se il documento non ha ancora il testo estratto nel frontend, recuperiamo i dettagli
            if (!document.extracted_text) {
                const response = await ragService.getDocumentDetails(document.id);
                setPreviewDocument(response);
            } else {
                setPreviewDocument(document);
            }
            setShowPreviewModal(true);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleClosePreview = () => {
        setShowPreviewModal(false);
        setPreviewDocument(null);
    };

    const handleProcessResourceFromManager = async (resourceId) => {
        setProcessingResourceIds(prev => new Set([...prev, resourceId]));
        try {
            await processResourceFromManager(resourceId);
            // Ricarica i documenti taggati RAG per aggiornare la lista
            await loadRAGTaggedDocuments();
        } catch (err) {
            console.error('Errore nel processamento della risorsa:', err);
        } finally {
            setProcessingResourceIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(resourceId);
                return newSet;
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Caricamento RAG Unificato</h2>
                    <p className="text-gray-600">Preparazione dell'interfaccia...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Unificato */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo e Titolo */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
                            >
                                {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
                            </button>
                            
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                                    <DocumentTextIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">RAG & Knowledge Base</h1>
                                    <p className="text-sm text-gray-600 hidden sm:block">
                                        Gestione documenti e chat unificata
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Statistiche Header */}
                        <div className="hidden md:flex items-center space-x-6 text-sm">
                            <div className="flex items-center space-x-2">
                                <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                                <span className="text-gray-600">{stats.totalDocuments} documenti</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-600" />
                                <span className="text-gray-600">{stats.totalKnowledgeBases} KB</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ChartBarIcon className="w-4 h-4 text-green-600" />
                                <span className="text-gray-600">{stats.totalChunks} chunk</span>
                            </div>
                        </div>

                        {/* Azioni Header */}
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setShowCreateKBModal(true)}
                                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center"
                            >
                                <PlusIcon className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">Nuova KB</span>
                            </button>
                            
                            <div className="relative">
                                <button
                                    onClick={() => setShowTypewriterSettings(!showTypewriterSettings)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        typewriterSettings.enabled 
                                            ? 'text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                    title="Impostazioni Typewriter"
                                >
                                    <Cog6ToothIcon className="w-5 h-5" />
                                </button>

                                {showTypewriterSettings && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
                                        <h3 className="font-semibold text-gray-900 mb-3">Impostazioni Typewriter</h3>
                                        
                                        {/* Enable/Disable */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-gray-700">Effetto Typewriter</span>
                                            <button
                                                onClick={() => setTypewriterSettings(prev => ({
                                                    ...prev,
                                                    enabled: !prev.enabled
                                                }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    typewriterSettings.enabled ? 'bg-green-600' : 'bg-gray-200'
                                                }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    typewriterSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                            </button>
                                        </div>

                                        {/* Speed Control */}
                                        <div className="mb-3">
                                            <label className="block text-sm text-gray-700 mb-2">
                                                Velocità: {typewriterSettings.speed}ms
                                            </label>
                                            <input
                                                type="range"
                                                min="20"
                                                max="200"
                                                step="10"
                                                value={typewriterSettings.speed}
                                                onChange={(e) => setTypewriterSettings(prev => ({
                                                    ...prev,
                                                    speed: parseInt(e.target.value)
                                                }))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                disabled={!typewriterSettings.enabled}
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Veloce</span>
                                                <span>Lenta</span>
                                            </div>
                                        </div>

                                        {/* Cursor */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-gray-700">Mostra Cursore</span>
                                            <button
                                                onClick={() => setTypewriterSettings(prev => ({
                                                    ...prev,
                                                    showCursor: !prev.showCursor
                                                }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    typewriterSettings.showCursor ? 'bg-blue-600' : 'bg-gray-200'
                                                }`}
                                                disabled={!typewriterSettings.enabled}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    typewriterSettings.showCursor ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                            </button>
                                        </div>

                                        {/* Skip */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-700">Abilita Skip</span>
                                            <button
                                                onClick={() => setTypewriterSettings(prev => ({
                                                    ...prev,
                                                    enableSkip: !prev.enableSkip
                                                }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    typewriterSettings.enableSkip ? 'bg-purple-600' : 'bg-gray-200'
                                                }`}
                                                disabled={!typewriterSettings.enabled}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    typewriterSettings.enableSkip ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <button
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Aiuto"
                            >
                                <QuestionMarkCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Layout Principale */}
            <div className="flex h-[calc(100vh-4rem)]">
                {/* Sidebar Sinistra */}
                <div className={`${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } fixed inset-y-0 left-0 z-20 w-80 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 mt-16 lg:mt-0`}>
                    
                    <div className="flex flex-col h-full">
                        {/* Tab Navigation */}
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                                    activeTab === 'documents'
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                                Documenti
                            </button>
                            <button
                                onClick={() => setActiveTab('knowledge-bases')}
                                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                                    activeTab === 'knowledge-bases'
                                        ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <ChatBubbleLeftRightIcon className="w-4 h-4 inline mr-1" />
                                KB
                            </button>
                            <button
                                onClick={() => setActiveTab('rag-tagged')}
                                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                                    activeTab === 'rag-tagged'
                                        ? 'text-green-600 border-b-2 border-green-600 bg-white'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                                RAG
                            </button>
                        </div>

                        {/* Contenuto Sidebar */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {activeTab === 'documents' ? (
                                <DocumentManager
                                    documents={documents}
                                    selectedDocuments={selectedDocuments}
                                    onDocumentSelect={setSelectedDocuments}
                                    onUpload={uploadDocuments}
                                    onDelete={deleteDocument}
                                    onDeleteSelected={deleteSelectedDocuments}
                                    onCreateKBFromSelected={createKBFromSelected}
                                    onAddSelectedToKB={addSelectedToKB}
                                    uploadProgress={uploadProgress}
                                    filters={documentFilters}
                                    onFiltersChange={setDocumentFilters}
                                    knowledgeBases={knowledgeBases}
                                    stats={stats}
                                    error={error}
                                    onPreviewDocument={handlePreviewDocument}
                                    // 🔥 NUOVE PROPS PER POLLING IN TEMPO REALE
                                    processingDocuments={processingDocuments}
                                    isDocumentProcessing={isDocumentProcessing}
                                />
                            ) : activeTab === 'knowledge-bases' ? (
                                <KnowledgeBaseManager
                                    knowledgeBases={knowledgeBases}
                                    activeMode={activeMode}
                                    onCreateKB={() => setShowCreateKBModal(true)}
                                    onEditKB={handleKBEdit}
                                    onDeleteKB={handleKBDelete}
                                    onStatsKB={handleKBStats}
                                    onSwitchMode={switchChatMode}
                                    selectedDocuments={selectedDocuments}
                                />
                            ) : activeTab === 'rag-tagged' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                                                File Taggati RAG
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Documenti già selezionati come adatti per RAG
                                            </p>
                                        </div>
                                        <button
                                            onClick={loadRAGTaggedDocuments}
                                            disabled={isLoadingRAGTagged}
                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {isLoadingRAGTagged ? '...' : '🔄'}
                                        </button>
                                    </div>

                                    {isLoadingRAGTagged ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                            <span className="ml-2 text-gray-600 text-sm">Caricamento...</span>
                                        </div>
                                    ) : ragTaggedDocuments.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="text-gray-400 mb-2">
                                                <DocumentTextIcon className="w-12 h-12 mx-auto" />
                                            </div>
                                            <h4 className="text-sm font-medium text-gray-900 mb-1">Nessun file taggato</h4>
                                            <p className="text-xs text-gray-500">
                                                Non ci sono documenti taggati come "RAG" nel Resource Manager
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {ragTaggedDocuments.map((doc) => (
                                                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow bg-green-50">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-gray-900 text-sm truncate" title={doc.name || doc.original_filename}>
                                                                {doc.name || doc.original_filename}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {doc.mime_type} • {(doc.size / 1024).toFixed(1)} KB
                                                            </p>
                                                        </div>
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
                                                            RAG
                                                        </span>
                                                    </div>
                                                    
                                                    <button
                                                        onClick={() => handleProcessResourceFromManager(doc.id)}
                                                        disabled={processingResourceIds.has(doc.id)}
                                                        className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {processingResourceIds.has(doc.id) ? 'Elaborazione...' : 'Processa per RAG'}
                                                    </button>
                                                    
                                                    <div className="mt-2 text-xs text-gray-500">
                                                        Caricato: {new Date(doc.created_at).toLocaleDateString('it-IT')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Area Chat Principale */}
                <div className="flex-1 flex flex-col lg:ml-0">
                    <div className="flex-1 p-4">
                        <UnifiedChat
                            activeMode={activeMode}
                            knowledgeBases={knowledgeBases}
                            chatHistory={chatHistory}
                            chatInput={chatInput}
                            isChatLoading={isChatLoading}
                            onSendMessage={sendChatMessage}
                            onChatInputChange={setChatInput}
                            onSwitchMode={switchChatMode}
                            onClearHistory={clearChatHistory}
                            stats={stats}
                            typewriterSettings={typewriterSettings}
                            onTypewriterSettingsChange={setTypewriterSettings}
                            currentSession={currentSession}
                        />
                    </div>
                </div>
            </div>

            {/* Overlay Mobile */}
            {isMobile && sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Modali */}
            {showCreateKBModal && (
                <KnowledgeBaseModal
                    isOpen={showCreateKBModal}
                    onClose={() => {
                        setShowCreateKBModal(false);
                        setSelectedKB(null);
                    }}
                    onSave={createKnowledgeBase}
                    documents={documents}
                    selectedDocuments={selectedDocuments}
                    knowledgeBase={selectedKB}
                    isLoading={loading}
                />
            )}

            {showStatsModal && selectedKB && (
                <KnowledgeBaseStatsModal
                    isOpen={showStatsModal}
                    onClose={() => {
                        setShowStatsModal(false);
                        setSelectedKB(null);
                    }}
                    knowledgeBase={selectedKB}
                />
            )}

            {/* Toast Notifications */}
            {error && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center">
                        <XMarkIcon className="w-5 h-5 mr-2" />
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-4 text-red-200 hover:text-white"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Shortcuts Help */}
            <div className="fixed bottom-4 left-4 z-40 hidden lg:block">
                <div className="bg-gray-800 text-white px-3 py-2 rounded-lg text-xs">
                    <div className="space-y-1">
                        <div>⌘+N: Nuova KB</div>
                        <div>⌘+K: Cambia modalità</div>
                        <div>⌘+U: Upload</div>
                    </div>
                </div>
            </div>

            {/* Modale Anteprima Documento */}
            <DocumentPreviewModal
                document={previewDocument}
                isOpen={showPreviewModal}
                onClose={handleClosePreview}
            />
        </div>
    );
};

export default UnifiedRAGPage; 