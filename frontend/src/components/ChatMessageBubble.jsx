import React from 'react';
import ReactMarkdown from 'react-markdown';

const ChatMessageBubble = ({ message }) => {
    const isUser = message.sender === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                }`}
            >
                <div className="flex items-center mb-1">
                    <span className="text-sm font-medium">
                        {isUser ? 'Tu' : 'AI Assistant'}
                    </span>
                </div>
                <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
                <div className="text-xs text-right mt-1 opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
};

export default ChatMessageBubble; 