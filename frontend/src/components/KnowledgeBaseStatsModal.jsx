import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    DocumentTextIcon, 
    ChartBarIcon,
    ClockIcon,
    CpuChipIcon,
    FolderIcon
} from '@heroicons/react/24/outline';

const KnowledgeBaseStatsModal = ({ 
    isOpen, 
    onClose, 
    knowledgeBase, 
    onLoadStatistics,
    statistics = null,
    isLoading = false 
}) => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (isOpen && knowledgeBase && onLoadStatistics) {
            onLoadStatistics(knowledgeBase.id).then(setStats);
        }
    }, [isOpen, knowledgeBase, onLoadStatistics]);

    if (!isOpen || !knowledgeBase) return null;

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const currentStats = stats || statistics || knowledgeBase;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center space-x-4">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <ChartBarIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Statistiche: {knowledgeBase.name}
                            </h2>
                            <p className="text-sm text-gray-600">
                                Analisi dettagliata della knowledge base
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span className="ml-3 text-gray-600">Caricamento statistiche...</span>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Panoramica generale */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                    <DocumentTextIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-blue-900">
                                        {currentStats.total_documents || 0}
                                    </div>
                                    <div className="text-sm text-blue-700">Documenti Totali</div>
                                </div>

                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <ChartBarIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-green-900">
                                        {currentStats.total_chunks || 0}
                                    </div>
                                    <div className="text-sm text-green-700">Chunk Totali</div>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                    <FolderIcon className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-yellow-900">
                                        {formatFileSize(currentStats.total_file_size || 0)}
                                    </div>
                                    <div className="text-sm text-yellow-700">Dimensione Totale</div>
                                </div>

                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                                    <CpuChipIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-purple-900">
                                        {currentStats.processed_documents || currentStats.processed_documents_count || 0}
                                    </div>
                                    <div className="text-sm text-purple-700">Processati</div>
                                </div>
                            </div>

                            {/* Stato documenti */}
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Stato Documenti</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                        <span className="text-sm font-medium text-green-800">Processati</span>
                                        <span className="text-lg font-bold text-green-900">
                                            {currentStats.processed_documents || currentStats.processed_documents_count || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                        <span className="text-sm font-medium text-yellow-800">In elaborazione</span>
                                        <span className="text-lg font-bold text-yellow-900">
                                            {currentStats.processing_documents || currentStats.processing_documents_count || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                        <span className="text-sm font-medium text-red-800">Falliti</span>
                                        <span className="text-lg font-bold text-red-900">
                                            {currentStats.failed_documents || currentStats.failed_documents_count || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Configurazioni */}
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurazioni</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Parametri Chunking</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Dimensione Chunk:</span>
                                                <span className="text-sm font-medium">{currentStats.chunk_size || knowledgeBase.chunk_size} caratteri</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Overlap:</span>
                                                <span className="text-sm font-medium">{currentStats.chunk_overlap || knowledgeBase.chunk_overlap} caratteri</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Modelli AI</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Embedding:</span>
                                                <span className="text-sm font-medium">{currentStats.embedding_model || knowledgeBase.embedding_model}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tipi di file */}
                            {currentStats.file_types && currentStats.file_types.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipi di File</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {currentStats.file_types.map((fileType, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                            >
                                                {fileType}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Informazioni temporali */}
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <ClockIcon className="w-4 h-4 text-gray-500 mr-2" />
                                            <span className="text-sm text-gray-600">Creata:</span>
                                        </div>
                                        <span className="text-sm font-medium">
                                            {formatDate(currentStats.created_at || knowledgeBase.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <ClockIcon className="w-4 h-4 text-gray-500 mr-2" />
                                            <span className="text-sm text-gray-600">Ultimo aggiornamento:</span>
                                        </div>
                                        <span className="text-sm font-medium">
                                            {formatDate(currentStats.updated_at || knowledgeBase.updated_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Metriche avanzate */}
                            {currentStats.total_text_length && (
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Metriche Avanzate</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Testo estratto:</span>
                                            <span className="text-sm font-medium">
                                                {formatFileSize(currentStats.total_text_length)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Media chunk per documento:</span>
                                            <span className="text-sm font-medium">
                                                {currentStats.total_documents > 0 
                                                    ? Math.round(currentStats.total_chunks / currentStats.total_documents)
                                                    : 0
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseStatsModal; 