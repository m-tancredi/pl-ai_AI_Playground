import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ragService } from '../services/ragService';
import DocumentItem from '../components/DocumentItem';
import ChatMessageBubble from '../components/ChatMessageBubble';
import ProgressBar from '../components/ProgressBar';
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';

const RAGServicePage = () => {
    // Stati
    const [documents, setDocuments] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

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

            {/* Messaggi di errore */}
            {error && (
                <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}
        </div>
    );
};

export default RAGServicePage; 