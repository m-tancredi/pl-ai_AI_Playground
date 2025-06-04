import React from 'react';
import { FaTimes } from 'react-icons/fa';

const ChatHistoryItem = ({ chat, isActive, onClick, onDelete }) => {
    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm('Sei sicuro di voler eliminare questa chat?')) {
            onDelete(chat.id);
        }
    };

    return (
        <div 
            className={`chat-history-item flex justify-between items-center p-3 border-b hover:bg-gray-100 cursor-pointer transition-colors ${
                isActive ? 'bg-pink-50 border-l-4 border-pink-500' : ''
            }`}
            onClick={onClick}
        >
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate block">
                    {chat.title || 'Nuova Chat'}
                </span>
                <span className="text-xs text-gray-500">
                    {new Date(chat.created_at).toLocaleDateString('it-IT')}
                </span>
            </div>
            <button
                onClick={handleDelete}
                className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                title="Elimina chat"
            >
                <FaTimes className="h-3 w-3" />
            </button>
        </div>
    );
};

export default ChatHistoryItem; 