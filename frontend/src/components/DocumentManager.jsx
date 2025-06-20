import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
    DocumentTextIcon, 
    TrashIcon, 
    MagnifyingGlassIcon,
    FunnelIcon,
    PlusIcon,
    CheckIcon,
    XMarkIcon,
    CloudArrowUpIcon,
    EyeIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import DocumentItem from './DocumentItem';
import ProgressBar from './ProgressBar';

const DocumentManager = ({
    documents,
    selectedDocuments,
    onDocumentSelect,
    onUpload,
    onDelete,
    onDeleteSelected,
    onCreateKBFromSelected,
    onAddSelectedToKB,
    uploadProgress,
    filters,
    onFiltersChange,
    knowledgeBases,
    stats,
    error,
    onPreviewDocument,
    processingDocuments,
    isDocumentProcessing
}) => {
    // Configurazione Dropzone
    const onDrop = useCallback((acceptedFiles) => {
        onUpload(acceptedFiles);
    }, [onUpload]);

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
        multiple: true
    });

    const handleSelectAll = () => {
        if (selectedDocuments.length === documents.length) {
            onDocumentSelect([]);
        } else {
            onDocumentSelect(documents.map(doc => doc.id));
        }
    };

    const handleDocumentToggle = (documentId) => {
        if (selectedDocuments.includes(documentId)) {
            onDocumentSelect(selectedDocuments.filter(id => id !== documentId));
        } else {
            onDocumentSelect([...selectedDocuments, documentId]);
        }
    };

    // 🎨 DESIGN PERFETTO - Nuovi stili per stati
    const getStatusConfig = (status, isProcessing = false) => {
        if (isProcessing) {
            return {
                color: 'text-blue-600 bg-blue-100 border-blue-300',
                icon: ClockIcon,
                label: 'Elaborazione...',
                animation: 'animate-pulse'
            };
        }

        switch (status) {
            case 'processed': 
                return {
                    color: 'text-green-600 bg-green-100 border-green-300',
                    icon: CheckCircleIcon,
                    label: 'Processato',
                    animation: ''
                };
            case 'processing': 
                return {
                    color: 'text-blue-600 bg-blue-100 border-blue-300',
                    icon: ClockIcon,
                    label: 'Elaborazione...',
                    animation: 'animate-pulse'
                };
            case 'failed': 
                return {
                    color: 'text-red-600 bg-red-100 border-red-300',
                    icon: ExclamationCircleIcon,
                    label: 'Fallito',
                    animation: ''
                };
            default: 
                return {
                    color: 'text-gray-600 bg-gray-100 border-gray-300',
                    icon: ClockIcon,
                    label: status,
                    animation: ''
                };
        }
    };

    const getFileTypeIcon = (fileType) => {
        switch (fileType?.toLowerCase()) {
            case 'pdf': return '📄';
            case 'doc':
            case 'docx': return '📝';
            case 'txt': return '📃';
            case 'csv':
            case 'xlsx':
            case 'xls': return '📊';
            default: return '📄';
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload Zone */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <CloudArrowUpIcon className="w-5 h-5 mr-2 text-blue-600" />
                        Carica Documenti
                    </h3>
                    <div className="text-sm text-gray-500">
                        {stats.totalDocuments} documenti • {stats.processedDocuments} processati
                    </div>
                </div>

                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        isDragActive 
                            ? 'border-blue-500 bg-blue-50 scale-105' 
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                >
                    <input {...getInputProps()} />
                    <CloudArrowUpIcon className={`w-12 h-12 mx-auto mb-3 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                    <p className="text-lg font-medium text-gray-700 mb-1">
                        {isDragActive ? 'Rilascia i file qui!' : 'Trascina i file qui'}
                    </p>
                    <p className="text-sm text-gray-500">
                        o clicca per selezionarli • PDF, DOC, TXT, CSV, Excel supportati
                    </p>
                </div>

                {uploadProgress > 0 && (
                    <div className="mt-4">
                        <ProgressBar
                            percentage={uploadProgress}
                            label="Caricamento in corso..."
                        />
                    </div>
                )}
            </div>

            {/* Filtri e Ricerca */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Ricerca */}
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cerca documenti..."
                            value={filters.search}
                            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filtri */}
                    <div className="flex gap-2">
                        <select
                            value={filters.status}
                            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">Tutti gli stati</option>
                            <option value="processed">Processati</option>
                            <option value="processing">In elaborazione</option>
                            <option value="failed">Falliti</option>
                        </select>

                        <select
                            value={filters.knowledgeBase}
                            onChange={(e) => onFiltersChange({ ...filters, knowledgeBase: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">Tutte le KB</option>
                            <option value="unassigned">Non assegnati</option>
                            {knowledgeBases.map(kb => (
                                <option key={kb.id} value={kb.id.toString()}>
                                    {kb.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Azioni Bulk */}
            {selectedDocuments.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center">
                                <CheckIcon className="w-5 h-5 text-blue-600 mr-2" />
                                <span className="font-medium text-blue-900">
                                    {selectedDocuments.length} documenti selezionati
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={onCreateKBFromSelected}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center"
                            >
                                <PlusIcon className="w-4 h-4 mr-1" />
                                Crea KB
                            </button>
                            
                            {knowledgeBases.length > 0 && (
                                <div className="relative">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                onAddSelectedToKB(parseInt(e.target.value));
                                                e.target.value = '';
                                            }
                                        }}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Aggiungi a KB...</option>
                                        {knowledgeBases.map(kb => (
                                            <option key={kb.id} value={kb.id}>
                                                {kb.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <button
                                onClick={onDeleteSelected}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center"
                            >
                                <TrashIcon className="w-4 h-4 mr-1" />
                                Elimina
                            </button>
                            
                            <button
                                onClick={() => onDocumentSelect([])}
                                className="p-1.5 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🎯 SEZIONE DOCUMENTI - DESIGN SUBLIME */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center">
                            <DocumentTextIcon className="w-6 h-6 mr-3 text-blue-600" />
                            Documenti 
                            <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                {documents.length}
                            </span>
                        </h3>
                        
                        {documents.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200"
                            >
                                {selectedDocuments.length === documents.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
                            </button>
                        )}
                    </div>
                </div>

                {/* 📋 LISTA DOCUMENTI - CARD PERFETTE */}
                <div className="p-2">
                    {documents.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <DocumentTextIcon className="w-12 h-12 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">
                                Nessun documento trovato
                            </h3>
                            <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                                {filters.search || filters.status !== 'all' || filters.knowledgeBase !== 'all'
                                    ? 'Prova a modificare i filtri di ricerca per vedere più risultati'
                                    : 'Carica i tuoi primi documenti trascinandoli nell\'area di upload sopra'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map(document => {
                                const isProcessing = isDocumentProcessing && typeof isDocumentProcessing === 'function' && isDocumentProcessing(document.id);
                                const statusConfig = getStatusConfig(document.status, isProcessing);
                                const StatusIcon = statusConfig.icon;
                                
                                return (
                                    <div
                                        key={document.id}
                                        className={`group relative p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                                            selectedDocuments.includes(document.id) 
                                                ? 'bg-blue-50 border-blue-300 shadow-md transform scale-[1.02]' 
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                                        } ${isProcessing ? 'ring-2 ring-blue-300 ring-opacity-50' : ''}`}
                                    >
                                        {/* 🔥 INDICATORE POLLING ATTIVO */}
                                        {isProcessing && (
                                            <div className="absolute top-2 right-2">
                                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
                                                <div className="absolute top-0 right-0 w-3 h-3 bg-blue-600 rounded-full"></div>
                                            </div>
                                        )}

                                        <div className="flex items-start space-x-5">
                                            {/* Checkbox */}
                                            <div className="flex-shrink-0 pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocuments.includes(document.id)}
                                                    onChange={() => handleDocumentToggle(document.id)}
                                                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all"
                                                />
                                            </div>

                                            {/* Icona File Grande */}
                                            <div className="flex-shrink-0">
                                                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                                                    {getFileTypeIcon(document.file_type)}
                                                </div>
                                            </div>

                                            {/* Info Documento */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                                            {document.original_filename}
                                                        </h4>
                                                        
                                                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                                            <span className="font-medium">{document.file_size_mb} MB</span>
                                                            {document.num_chunks && (
                                                                <span className="flex items-center">
                                                                    <DocumentTextIcon className="w-4 h-4 mr-1" />
                                                                    {document.num_chunks} chunk
                                                                </span>
                                                            )}
                                                            <span>{new Date(document.uploaded_at).toLocaleDateString('it-IT')}</span>
                                                        </div>

                                                        {/* Knowledge Bases */}
                                                        {document.knowledge_bases && document.knowledge_bases.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {document.knowledge_bases.map(kb => (
                                                                    <span
                                                                        key={kb.id}
                                                                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium border border-purple-200"
                                                                    >
                                                                        📚 {kb.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className={`flex items-center px-3 py-2 rounded-lg border font-medium text-sm ${statusConfig.color} ${statusConfig.animation}`}>
                                                        <StatusIcon className="w-4 h-4 mr-2" />
                                                        {statusConfig.label}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Azioni */}
                                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <button
                                                    onClick={() => onPreviewDocument && onPreviewDocument(document)}
                                                    className={`p-3 rounded-lg transition-all duration-200 ${
                                                        document.has_content && document.status === 'processed'
                                                            ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-100 hover:scale-110' 
                                                            : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    title={document.has_content && document.status === 'processed' 
                                                        ? "Visualizza anteprima documento"
                                                        : "Contenuto non disponibile"}
                                                    disabled={!document.has_content || document.status !== 'processed'}
                                                >
                                                    <EyeIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(document.id)}
                                                    className="p-3 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                                                    title="Elimina documento"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 🔥 BARRA DI PROGRESSO PER DOCUMENTI IN ELABORAZIONE */}
                                        {isProcessing && (
                                            <div className="mt-4 pt-4 border-t border-blue-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-blue-700">Elaborazione in corso...</span>
                                                    <span className="text-sm text-blue-600">In tempo reale</span>
                                                </div>
                                                <div className="w-full bg-blue-100 rounded-full h-2">
                                                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Messaggio di errore */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center">
                        <XMarkIcon className="w-5 h-5 text-red-600 mr-2" />
                        <span className="text-red-800">{error}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentManager; 