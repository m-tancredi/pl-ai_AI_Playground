import React, { useRef, useEffect } from 'react';
import { 
    PaperAirplaneIcon, 
    TrashIcon,
    ChatBubbleLeftRightIcon,
    GlobeAltIcon,
    DocumentTextIcon,
    Cog6ToothIcon,
    XMarkIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import ChatMessageBubble from './ChatMessageBubble';

const UnifiedChat = ({
    activeMode,
    knowledgeBases,
    chatHistory,
    chatInput,
    isChatLoading,
    onSendMessage,
    onChatInputChange,
    onSwitchMode,
    onClearHistory,
    stats,
    typewriterSettings,
    onTypewriterSettingsChange,
    currentSession
}) => {
    const messagesEndRef = useRef(null);
    const [showModeSelector, setShowModeSelector] = React.useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (chatInput.trim() && !isChatLoading) {
            onSendMessage(chatInput);
        }
    };

    const getCurrentModeInfo = () => {
        // 🎯 SOLO KNOWLEDGE BASE - NO CHAT GLOBALE
        if (!activeMode || !activeMode.startsWith('kb-')) {
            return {
                name: 'Seleziona una Knowledge Base',
                description: 'Nessuna KB attiva - seleziona per iniziare',
                icon: DocumentTextIcon,
                color: 'gray'
            };
        }
        
        const kbId = activeMode.replace('kb-', '');
        const kb = knowledgeBases.find(k => k.id.toString() === kbId);
        
        if (kb) {
            return {
                name: kb.name,
                description: `${kb.processed_documents_count} documenti processati`,
                icon: DocumentTextIcon,
                color: 'purple'
            };
        }
        
        return {
            name: 'Knowledge Base non trovata',
            description: 'KB non disponibile',
            icon: XMarkIcon,
            color: 'red'
        };
    };

    const modeInfo = getCurrentModeInfo();
    const IconComponent = modeInfo.icon;

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Header Chat con Selector Modalità */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <div className="flex items-center justify-between">
                    {/* Modalità Attiva */}
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 bg-${modeInfo.color}-100 rounded-lg`}>
                            <IconComponent className={`w-5 h-5 text-${modeInfo.color}-600`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">{modeInfo.name}</h3>
                            <p className="text-sm text-gray-600">{modeInfo.description}</p>
                        </div>
                    </div>

                    {/* Azioni Header */}
                    <div className="flex items-center space-x-2">
                        {/* Selector Modalità */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModeSelector(!showModeSelector)}
                                className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                            >
                                <span>Cambia modalità</span>
                                <ChevronDownIcon className="w-4 h-4 ml-2" />
                            </button>

                            {showModeSelector && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                    <div className="p-2">
                                        {/* 🎯 SOLO KNOWLEDGE BASES - NO CHAT GLOBALE */}
                                        {knowledgeBases.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                <p className="text-sm">Nessuna Knowledge Base</p>
                                                <p className="text-xs mt-1">Crea una KB per iniziare</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-3 p-2 bg-purple-50 rounded-lg">
                                                    <p className="text-xs text-purple-800 font-medium">
                                                        🎯 Chat dedicate per Knowledge Base
                                                    </p>
                                                    <p className="text-xs text-purple-600 mt-1">
                                                        Seleziona una KB per conversazioni contestualizzate
                                                    </p>
                                                </div>
                                                
                                                {/* Knowledge Bases */}
                                            </>
                                        )}
                                        
                                        {/* Knowledge Bases */}
                                        {knowledgeBases.map(kb => {
                                            const kbMode = `kb-${kb.id}`;
                                            const isActive = activeMode === kbMode;
                                            const isDisabled = kb.processed_documents_count === 0;
                                            
                                            return (
                                                <button
                                                    key={kb.id}
                                                    onClick={() => {
                                                        if (!isDisabled) {
                                                            onSwitchMode(kbMode);
                                                            setShowModeSelector(false);
                                                        }
                                                    }}
                                                    disabled={isDisabled}
                                                    className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                                                        isDisabled 
                                                            ? 'opacity-50 cursor-not-allowed' 
                                                            : isActive 
                                                                ? 'bg-purple-50 border-2 border-purple-200' 
                                                                : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <div className="p-2 bg-purple-100 rounded-lg mr-3">
                                                        <DocumentTextIcon className="w-4 h-4 text-purple-600" />
                                                    </div>
                                                    <div className="text-left flex-1">
                                                        <div className="font-medium text-gray-900 truncate">
                                                            {kb.name}
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {isDisabled 
                                                                ? 'Nessun documento processato' 
                                                                : `${kb.processed_documents_count} documenti`
                                                            }
                                                        </div>
                                                    </div>
                                                    {isActive && (
                                                        <div className="ml-auto w-2 h-2 bg-purple-500 rounded-full"></div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Typewriter Settings */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModeSelector(false)} // Chiudi altri menu
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Impostazioni Typewriter"
                            >
                                <Cog6ToothIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Pulisci Chat */}
                        <button
                            onClick={() => onClearHistory()}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Pulisci cronologia"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Indicatori di stato */}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                        <span>💬 {chatHistory.length} messaggi</span>
                        {activeMode && activeMode.startsWith('kb-') && (
                            <span>📚 KB: {modeInfo.name}</span>
                        )}
                    </div>
                    {isChatLoading && (
                        <div className="flex items-center space-x-2">
                            <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
                            <span>AI sta scrivendo...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Area Messaggi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 ? (
                    <div className="text-center py-12">
                        <div className={`w-16 h-16 mx-auto mb-4 p-4 bg-${modeInfo.color}-100 rounded-full`}>
                            <IconComponent className={`w-8 h-8 text-${modeInfo.color}-600`} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {activeMode && activeMode.startsWith('kb-') 
                                ? `Chat con ${modeInfo.name}` 
                                : 'Seleziona una Knowledge Base'
                            }
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {activeMode && activeMode.startsWith('kb-')
                                ? `Fai domande specifiche sui documenti di questa Knowledge Base`
                                : 'Seleziona una Knowledge Base per iniziare una conversazione contestualizzata'
                            }
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                            <p className="text-sm text-gray-700 mb-2">💡 <strong>Suggerimenti:</strong></p>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• "Riassumi i contenuti principali"</li>
                                <li>• "Trova informazioni su [argomento]"</li>
                                <li>• "Confronta i documenti"</li>
                                <li>• "Elenca i punti chiave"</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <>
                        {chatHistory.map((message, index) => (
                            <ChatMessageBubble 
                                key={message.id || index} 
                                message={message}
                                showSources={true}
                                showKnowledgeBase={false} // Non mostrare più KB (sempre specifica ora)
                                enableTypewriter={typewriterSettings?.enabled && !message.isUser}
                                typewriterSpeed={typewriterSettings?.speed || 50}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => onChatInputChange(e.target.value)}
                            placeholder={
                                activeMode && activeMode.startsWith('kb-')
                                    ? `Fai una domanda su ${modeInfo.name}...`
                                    : 'Seleziona una Knowledge Base per iniziare...'
                            }
                            className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isChatLoading || !activeMode || !activeMode.startsWith('kb-')}
                        />
                        {chatInput.trim() && (
                            <button
                                type="button"
                                onClick={() => onChatInputChange('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!chatInput.trim() || isChatLoading}
                        className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${
                            chatInput.trim() && !isChatLoading
                                ? `bg-${modeInfo.color}-600 text-white hover:bg-${modeInfo.color}-700`
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {isChatLoading ? (
                            <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full"></div>
                        ) : (
                            <PaperAirplaneIcon className="w-4 h-4" />
                        )}
                    </button>
                </form>

                {/* Shortcuts */}
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                        <span>⌘ + Enter per inviare</span>
                        <span>⌘ + K per cambiare modalità</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span>Modalità: {
                            activeMode && activeMode.startsWith('kb-') 
                                ? `KB: ${modeInfo.name}` 
                                : 'Nessuna KB selezionata'
                        }</span>
                    </div>
                </div>
            </div>

            {/* Overlay per chiudere selector */}
            {showModeSelector && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowModeSelector(false)}
                />
            )}
        </div>
    );
};

export default UnifiedChat; 