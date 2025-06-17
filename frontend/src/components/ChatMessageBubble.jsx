import React from 'react';
import ReactMarkdown from 'react-markdown';
import { DocumentTextIcon, LinkIcon } from '@heroicons/react/24/outline';
import TypewriterText from './TypewriterText';

const ChatMessageBubble = ({ 
    message, 
    showSources = false, 
    showKnowledgeBase = false,
    enableTypewriter = true,
    typewriterSpeed = 50
}) => {
    const isUser = message.isUser || message.sender === 'user';
    const isError = message.isError;

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUser
                        ? 'bg-blue-600 text-white'
                        : isError
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-800'
                }`}
            >
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                        {isUser ? 'Tu' : isError ? 'Errore' : 'AI Assistant'}
                    </span>
                    {!isUser && showKnowledgeBase && message.knowledge_base && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            📚 {message.knowledge_base.name}
                        </span>
                    )}
                </div>
                
                <div className="prose prose-sm max-w-none">
                    {!isUser && enableTypewriter && message.text && !message.isComplete ? (
                        <TypewriterText
                            text={message.text}
                            speed={typewriterSpeed}
                            showCursor={true}
                            enableSkip={true}
                            enableControls={false}
                            cursorStyle="classic"
                            onComplete={() => {
                                // Marca il messaggio come completato
                                if (message.onComplete) {
                                    message.onComplete();
                                }
                            }}
                        />
                    ) : message.text ? (
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                    ) : (
                        <div className="text-gray-500 italic">Caricamento...</div>
                    )}
                </div>

                {/* Sources */}
                {!isUser && showSources && message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center mb-2">
                            <DocumentTextIcon className="w-4 h-4 mr-1 text-gray-600" />
                            <span className="text-xs font-medium text-gray-600">
                                Fonti ({message.sources.length})
                            </span>
                        </div>
                        <div className="space-y-1">
                            {message.sources.slice(0, 3).map((source, index) => (
                                <div key={index} className="text-xs bg-white rounded p-2 border">
                                    <div className="font-medium text-gray-700 truncate">
                                        📄 {source.document_name || source.filename || `Documento ${index + 1}`}
                                    </div>
                                    {source.chunk_text && (
                                        <div className="text-gray-600 mt-1 line-clamp-2">
                                            "{source.chunk_text.substring(0, 100)}..."
                                        </div>
                                    )}
                                    {source.similarity_score && (
                                        <div className="text-gray-500 mt-1">
                                            Rilevanza: {(source.similarity_score * 100).toFixed(1)}%
                                        </div>
                                    )}
                                </div>
                            ))}
                            {message.sources.length > 3 && (
                                <div className="text-xs text-gray-500 text-center py-1">
                                    +{message.sources.length - 3} altre fonti
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Context Chunks Info */}
                {!isUser && message.context_chunks && message.context_chunks.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                        💡 Risposta basata su {message.context_chunks.length} chunk di contesto
                    </div>
                )}

                <div className="text-xs text-right mt-1 opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString('it-IT')}
                </div>
            </div>
        </div>
    );
};

export default ChatMessageBubble; 