import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ragService } from '../services/ragService';
import DocumentItem from '../components/DocumentItem';
import ChatMessageBubble from '../components/ChatMessageBubble';
import ProgressBar from '../components/ProgressBar';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DocumentIcon } from '@heroicons/react/24/outline';

const RAGServicePage = () => {
    // Stati
    const [documents, setDocuments] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    
    // Nuovi stati per Resource Manager
    const [showResourceManager, setShowResourceManager] = useState(false);
    const [resourceManagerDocuments, setResourceManagerDocuments] = useState([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [processingResourceIds, setProcessingResourceIds] = useState(new Set());

    // Configurazione Dropzone
    const onDrop = useCallback(async (acceptedFiles) => {
        try {
            setError(null);
            
            // Carica un file alla volta
            for (const file of acceptedFiles) {
                const formData = new FormData();
                formData.append('file', file);

                await ragService.uploadDocument(formData, (progress) => {
                    setUploadProgress(progress);
                });
            }

            fetchDocuments();
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt'],
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
    });

    // Funzioni di utilità
    const fetchDocuments = async () => {
        try {
            const response = await ragService.listUserDocuments();
            // Gestisce sia array diretto che oggetto con paginazione
            const documentsArray = Array.isArray(response) ? response : (response.results || response.data || []);
            setDocuments(documentsArray);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteDocument = async (documentId) => {
        try {
            await ragService.deleteDocument(documentId);
            fetchDocuments();
        } catch (err) {
            setError(err.message);
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

    const handleClearKnowledgeBase = async () => {
        try {
            await ragService.clearKnowledgeBase();
            setDocuments([]);
            setChatMessages([]);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSubmitChatMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = {
            sender: 'user',
            text: chatInput,
            timestamp: new Date().toISOString(),
        };

        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const response = await ragService.sendChatMessage(chatInput);
            const aiMessage = {
                sender: 'ai',
                text: response.response,
                timestamp: new Date().toISOString(),
            };
            setChatMessages(prev => [...prev, aiMessage]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Nuove funzioni per Resource Manager
    const fetchResourceManagerDocuments = async () => {
        try {
            setIsLoadingResources(true);
            setError(null);
            
            const response = await ragService.getResourceManagerDocuments({ limit: 50 });
            setResourceManagerDocuments(response.resources || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoadingResources(false);
        }
    };

    const handleProcessResourceFromManager = async (resourceId) => {
        try {
            setError(null);
            setProcessingResourceIds(prev => new Set([...prev, resourceId]));
            
            await ragService.processResourceFromManager(resourceId);
            
            // Aggiorna la lista dei documenti
            fetchDocuments();
            
            // Aggiorna anche la lista del Resource Manager per mostrare lo stato aggiornato
            fetchResourceManagerDocuments();
        } catch (err) {
            setError(err.message);
        } finally {
            setProcessingResourceIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(resourceId);
                return newSet;
            });
        }
    };

    const toggleResourceManager = () => {
        setShowResourceManager(!showResourceManager);
        if (!showResourceManager && resourceManagerDocuments.length === 0) {
            fetchResourceManagerDocuments();
        }
    };

    // Effetti
    useEffect(() => {
        fetchDocuments();
    }, []);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Colonna Sinistra - Upload e Knowledge Base */}
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Carica Documenti</h2>
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                        >
                            <input {...getInputProps()} />
                            <p className="text-gray-600">
                                {isDragActive
                                    ? 'Rilascia i file qui...'
                                    : 'Trascina i file qui o clicca per selezionarli'}
                            </p>
                        </div>
                        {uploadProgress > 0 && (
                            <div className="mt-4">
                                <ProgressBar
                                    percentage={uploadProgress}
                                    label="Caricamento"
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Knowledge Base</h2>
                            <button
                                onClick={handleClearKnowledgeBase}
                                className="flex items-center text-red-600 hover:text-red-700"
                            >
                                <TrashIcon className="w-5 h-5 mr-1" />
                                Svuota KB
                            </button>
                        </div>
                        <div className="space-y-4">
                            {Array.isArray(documents) && documents.map(doc => (
                                <DocumentItem
                                    key={doc.id}
                                    document={doc}
                                    onDelete={handleDeleteDocument}
                                    onPreview={handlePreviewDocument}
                                />
                            ))}
                            {(!documents || documents.length === 0) && (
                                <p className="text-gray-500 text-center py-4">
                                    Nessun documento caricato
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Colonna Destra - Chat */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Chat con la Knowledge Base</h2>
                    <div className="flex flex-col h-[600px]">
                        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                            {Array.isArray(chatMessages) && chatMessages.map((message, index) => (
                                <ChatMessageBubble key={index} message={message} />
                            ))}
                            {(!chatMessages || chatMessages.length === 0) && (
                                <div className="text-center text-gray-500 py-8">
                                    <p>Carica dei documenti e inizia a chattare!</p>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleSubmitChatMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Scrivi un messaggio..."
                                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isChatLoading}
                            />
                            <button
                                type="submit"
                                disabled={isChatLoading || !chatInput.trim()}
                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Sezione Resource Manager */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Documenti dal Resource Manager</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Seleziona documenti già caricati nel Resource Manager per elaborarli con RAG
                            </p>
                        </div>
                        <button
                            onClick={toggleResourceManager}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {showResourceManager ? 'Nascondi' : 'Mostra Documenti'}
                        </button>
                    </div>
                </div>

                {showResourceManager && (
                    <div className="p-6">
                        {isLoadingResources ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-gray-600">Caricamento documenti...</span>
                            </div>
                        ) : resourceManagerDocuments.length === 0 ? (
                            <div className="text-center py-8">
                                <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun documento compatibile</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Non ci sono documenti compatibili con RAG nel Resource Manager
                                </p>
                                <button
                                    onClick={fetchResourceManagerDocuments}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Ricarica
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {resourceManagerDocuments.map((resource) => (
                                    <div key={resource.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                                    {resource.name || resource.original_filename}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {resource.mime_type} • {(resource.size / 1024 / 1024).toFixed(1)} MB
                                                </p>
                                                {resource.description && (
                                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                        {resource.description}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="ml-2 flex flex-col items-end">
                                                {resource.rag_processed ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Elaborato
                                                    </span>
                                                ) : resource.rag_status ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        {resource.rag_status === 'processing' ? 'In elaborazione' : 
                                                         resource.rag_status === 'failed' ? 'Fallito' : 
                                                         resource.rag_status}
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleProcessResourceFromManager(resource.id)}
                                                        disabled={processingResourceIds.has(resource.id)}
                                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        {processingResourceIds.has(resource.id) ? 'Elaborazione...' : 'Elabora'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                                
                                        <div className="mt-2 text-xs text-gray-500">
                                            Caricato: {new Date(resource.created_at).toLocaleDateString('it-IT')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={fetchResourceManagerDocuments}
                                disabled={isLoadingResources}
                                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                                🔄 Aggiorna Lista
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista Documenti Caricati */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Documenti Caricati</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Elenco dei documenti caricati dall'utente
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    {Array.isArray(documents) && documents.map(doc => (
                        <DocumentItem
                            key={doc.id}
                            document={doc}
                            onDelete={handleDeleteDocument}
                            onPreview={handlePreviewDocument}
                        />
                    ))}
                    {(!documents || documents.length === 0) && (
                        <div className="text-center py-8">
                            <p>Nessun documento caricato</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Messaggi di errore */}
            {error && (
                <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {/* Modale Anteprima Documento */}
            <DocumentPreviewModal
                document={previewDocument}
                isOpen={showPreviewModal}
                onClose={handleClosePreview}
            />
        </div>
    );
};

export default RAGServicePage; 