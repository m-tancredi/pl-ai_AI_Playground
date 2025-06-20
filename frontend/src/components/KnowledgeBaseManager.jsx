import React from 'react';
import { 
    PlusIcon, 
    ChatBubbleLeftRightIcon,
    ChartBarIcon,
    PencilIcon,
    TrashIcon,
    DocumentTextIcon,
    CpuChipIcon
} from '@heroicons/react/24/outline';

const KnowledgeBaseManager = ({
    knowledgeBases,
    activeMode,
    onCreateKB,
    onEditKB,
    onDeleteKB,
    onChatKB,
    onStatsKB,
    onSwitchMode,
    selectedDocuments
}) => {
    const getKBStatus = (kb) => {
        if (kb.processing_documents_count > 0) {
            return { status: 'processing', color: 'yellow', text: 'In elaborazione' };
        }
        if (kb.failed_documents_count > 0) {
            return { status: 'warning', color: 'orange', text: 'Con errori' };
        }
        if (kb.processed_documents_count > 0) {
            return { status: 'ready', color: 'green', text: 'Pronta' };
        }
        return { status: 'empty', color: 'gray', text: 'Vuota' };
    };

    return (
        <div className="space-y-4">
            {/* Header con azione crea */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <DocumentTextIcon className="w-5 h-5 mr-2 text-purple-600" />
                    Knowledge Base ({knowledgeBases.length})
                </h3>
                <button
                    onClick={onCreateKB}
                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    title="Crea nuova KB"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Quick create da documenti selezionati */}
            {selectedDocuments.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-purple-800">
                            <span className="font-medium">{selectedDocuments.length} documenti selezionati</span>
                        </div>
                        <button
                            onClick={onCreateKB}
                            className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-colors"
                        >
                            Crea KB
                        </button>
                    </div>
                </div>
            )}

            {/* 🎯 DESIGN CLEAN & MINIMAL - Focus esclusivo su Knowledge Base dedicate */}
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900">🎯 Chat Dedicate per Knowledge Base</h4>
                        <p className="text-sm text-gray-600 mt-1">
                            Ogni Knowledge Base ha ora la sua chat dedicata per conversazioni più mirate e contestualizzate
                        </p>
                    </div>
                </div>
            </div>

            {/* Lista Knowledge Base */}
            <div className="space-y-2">
                {knowledgeBases.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Nessuna Knowledge Base</p>
                        <p className="text-xs">Crea la prima per iniziare</p>
                    </div>
                ) : (
                    knowledgeBases.map(kb => {
                        const status = getKBStatus(kb);
                        const isActive = activeMode === `kb-${kb.id}`;
                        
                        return (
                            <div
                                key={kb.id}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    isActive 
                                        ? 'border-purple-500 bg-purple-50' 
                                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                }`}
                            >
                                {/* Header KB */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        <div className="p-1.5 bg-purple-100 rounded">
                                            <DocumentTextIcon className="w-3 h-3 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 text-sm truncate">
                                                {kb.name}
                                            </h4>
                                        </div>
                                        {isActive && (
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        )}
                                    </div>
                                </div>

                                {/* Statistiche compatte */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="text-center">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {kb.total_documents}
                                        </div>
                                        <div className="text-xs text-gray-500">Docs</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {kb.total_chunks}
                                        </div>
                                        <div className="text-xs text-gray-500">Chunk</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-semibold text-${status.color}-600`}>
                                            {kb.processed_documents_count}
                                        </div>
                                        <div className="text-xs text-gray-500">Proc.</div>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className="flex items-center justify-center mb-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>
                                        {status.text}
                                    </span>
                                </div>

                                {/* Azioni */}
                                <div className="flex items-center justify-between">
                                    <div className="flex space-x-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditKB(kb.id);
                                            }}
                                            className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                            title="Modifica"
                                        >
                                            <PencilIcon className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onStatsKB(kb.id);
                                            }}
                                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Statistiche"
                                        >
                                            <ChartBarIcon className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteKB(kb.id);
                                            }}
                                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Elimina"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                    
                                    <button
                                        onClick={() => onSwitchMode(`kb-${kb.id}`)}
                                        disabled={kb.processed_documents_count === 0}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                            kb.processed_documents_count > 0
                                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                        title={kb.processed_documents_count > 0 ? 'Avvia chat' : 'Nessun documento processato'}
                                    >
                                        <ChatBubbleLeftRightIcon className="w-3 h-3 inline mr-1" />
                                        Chat
                                    </button>
                                </div>

                                {/* Descrizione (se presente) */}
                                {kb.description && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-600 line-clamp-2">
                                            {kb.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Statistiche generali */}
            {knowledgeBases.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Riepilogo</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">KB Totali:</span>
                            <span className="font-medium">{knowledgeBases.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">KB Pronte:</span>
                            <span className="font-medium text-green-600">
                                {knowledgeBases.filter(kb => kb.processed_documents_count > 0).length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Docs Totali:</span>
                            <span className="font-medium">
                                {knowledgeBases.reduce((sum, kb) => sum + kb.total_documents, 0)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Chunk Totali:</span>
                            <span className="font-medium">
                                {knowledgeBases.reduce((sum, kb) => sum + kb.total_chunks, 0)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBaseManager; 