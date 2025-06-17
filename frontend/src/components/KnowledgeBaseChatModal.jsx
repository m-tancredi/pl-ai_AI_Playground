import React, { useState, useEffect, useRef } from 'react';
import { 
    XMarkIcon, 
    PaperAirplaneIcon, 
    DocumentTextIcon,
    ChartBarIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';
import ChatMessageBubble from './ChatMessageBubble';

const KnowledgeBaseChatModal = ({ 
    isOpen, 
    onClose, 
    knowledgeBase, 
    onSendMessage, 
    isLoading = false 
}) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [chatSettings, setChatSettings] = useState({
        top_k: 5,
        max_tokens: 1000
    });
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);

    // Scroll automatico ai nuovi messaggi
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset chat quando si apre il modal
    useEffect(() => {
        if (isOpen && knowledgeBase) {
            setMessages([]);
            setInputMessage('');
            // Messaggio di benvenuto
            setMessages([{
                sender: 'ai',
                text: `Ciao! Sono pronto a rispondere alle tue domande sulla knowledge base "${knowledgeBase.name}". Questa KB contiene ${knowledgeBase.total_documents} documenti con ${knowledgeBase.total_chunks} chunk di informazioni.`,
                timestamp: new Date().toISOString(),
                isWelcome: true
            }]);
        }
    }, [isOpen, knowledgeBase]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = {
            sender: 'user',
            text: inputMessage.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');

        try {
            const response = await onSendMessage(knowledgeBase.id, inputMessage.trim(), chatSettings);
            
            const aiMessage = {
                sender: 'ai',
                text: response.response,
                timestamp: new Date().toISOString(),
                sources: response.sources || [],
                context_chunks: response.context_chunks || [],
                knowledge_base: response.knowledge_base
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                sender: 'ai',
                text: `Errore: ${error.message}`,
                timestamp: new Date().toISOString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleSettingsChange = (setting, value) => {
        setChatSettings(prev => ({
            ...prev,
            [setting]: value
        }));
    };

    if (!isOpen || !knowledgeBase) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Chat: {knowledgeBase.name}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {knowledgeBase.total_documents} documenti • {knowledgeBase.total_chunks} chunk
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Impostazioni chat"
                        >
                            <ChartBarIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Chunk da recuperare (Top K)
                                </label>
                                <select
                                    value={chatSettings.top_k}
                                    onChange={(e) => handleSettingsChange('top_k', parseInt(e.target.value))}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value={3}>3 chunk</option>
                                    <option value={5}>5 chunk</option>
                                    <option value={7}>7 chunk</option>
                                    <option value={10}>10 chunk</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Lunghezza massima risposta
                                </label>
                                <select
                                    value={chatSettings.max_tokens}
                                    onChange={(e) => handleSettingsChange('max_tokens', parseInt(e.target.value))}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value={500}>Breve (500 token)</option>
                                    <option value={1000}>Media (1000 token)</option>
                                    <option value={1500}>Lunga (1500 token)</option>
                                    <option value={2000}>Molto lunga (2000 token)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((message, index) => (
                        <div key={index}>
                            <ChatMessageBubble message={message} />
                            
                            {/* Mostra fonti e chunk per messaggi AI */}
                            {message.sender === 'ai' && message.sources && message.sources.length > 0 && (
                                <div className="mt-3 ml-12">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <div className="flex items-center mb-2">
                                            <InformationCircleIcon className="w-4 h-4 text-blue-600 mr-1" />
                                            <span className="text-sm font-medium text-blue-800">
                                                Fonti utilizzate ({message.sources.length})
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            {message.sources.map((source, idx) => (
                                                <div key={idx} className="text-xs text-blue-700">
                                                    📄 {source.filename} ({source.file_type})
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {message.context_chunks && message.context_chunks.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-blue-200">
                                                <span className="text-xs font-medium text-blue-800">
                                                    Chunk più rilevanti:
                                                </span>
                                                <div className="mt-1 space-y-1">
                                                    {message.context_chunks.slice(0, 2).map((chunk, idx) => (
                                                        <div key={idx} className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                                                            <div className="font-medium">Score: {chunk.score?.toFixed(3)}</div>
                                                            <div className="truncate">{chunk.text?.substring(0, 100)}...</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                                <div className="flex items-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    <span className="text-sm text-gray-600">Sto pensando...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 p-4 bg-white">
                    <form onSubmit={handleSendMessage} className="flex space-x-3">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder={`Fai una domanda sulla knowledge base "${knowledgeBase.name}"...`}
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!inputMessage.trim() || isLoading}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </form>
                    
                    <div className="mt-2 text-xs text-gray-500 text-center">
                        Questa chat è limitata ai documenti della knowledge base selezionata
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseChatModal; 