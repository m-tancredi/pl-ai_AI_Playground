import React from 'react';
import { 
    ChatBubbleLeftRightIcon, 
    DocumentTextIcon, 
    ChartBarIcon,
    PencilIcon,
    TrashIcon,
    EyeIcon
} from '@heroicons/react/24/outline';

const KnowledgeBaseCard = ({ knowledgeBase, onView, onEdit, onDelete, onChat, onStatistics }) => {
    const {
        id,
        name,
        description,
        total_documents,
        total_chunks,
        processed_documents_count,
        processing_documents_count,
        failed_documents_count,
        created_at,
        updated_at
    } = knowledgeBase;

    // Calcola lo stato della KB
    const getKBStatus = () => {
        if (processing_documents_count > 0) {
            return { status: 'processing', color: 'yellow', text: 'In elaborazione' };
        }
        if (failed_documents_count > 0) {
            return { status: 'warning', color: 'orange', text: 'Con errori' };
        }
        if (processed_documents_count > 0) {
            return { status: 'ready', color: 'green', text: 'Pronta' };
        }
        return { status: 'empty', color: 'gray', text: 'Vuota' };
    };

    const status = getKBStatus();
    const formattedDate = new Date(updated_at).toLocaleDateString('it-IT');

    return (
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
            {/* Header con nome e stato */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{description || 'Nessuna descrizione'}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                    {status.text}
                </div>
            </div>

            {/* Statistiche */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <DocumentTextIcon className="w-4 h-4 text-blue-500 mr-1" />
                        <span className="text-lg font-semibold text-gray-900">{total_documents}</span>
                    </div>
                    <p className="text-xs text-gray-500">Documenti</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <ChartBarIcon className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-lg font-semibold text-gray-900">{total_chunks}</span>
                    </div>
                    <p className="text-xs text-gray-500">Chunk</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <div className={`w-2 h-2 rounded-full bg-${status.color}-500 mr-2`}></div>
                        <span className="text-lg font-semibold text-gray-900">{processed_documents_count}</span>
                    </div>
                    <p className="text-xs text-gray-500">Processati</p>
                </div>
            </div>

            {/* Dettagli aggiuntivi */}
            <div className="text-xs text-gray-500 mb-4">
                <p>Aggiornata: {formattedDate}</p>
                {processing_documents_count > 0 && (
                    <p className="text-yellow-600">⏳ {processing_documents_count} in elaborazione</p>
                )}
                {failed_documents_count > 0 && (
                    <p className="text-red-600">❌ {failed_documents_count} falliti</p>
                )}
            </div>

            {/* Azioni */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div className="flex space-x-2">
                    <button
                        onClick={() => onView(id)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Visualizza dettagli"
                    >
                        <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onEdit(id)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Modifica"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onStatistics(id)}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Statistiche"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex space-x-2">
                    <button
                        onClick={() => onChat(id)}
                        disabled={processed_documents_count === 0}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            processed_documents_count > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={processed_documents_count > 0 ? 'Avvia chat' : 'Nessun documento processato'}
                    >
                        <ChatBubbleLeftRightIcon className="w-4 h-4 inline mr-1" />
                        Chat
                    </button>
                    <button
                        onClick={() => onDelete(id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseCard; 