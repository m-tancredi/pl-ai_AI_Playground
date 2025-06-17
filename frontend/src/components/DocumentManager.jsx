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
    EyeIcon
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
    error
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'processed': return 'text-green-600 bg-green-100';
            case 'processing': return 'text-yellow-600 bg-yellow-100';
            case 'failed': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
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

            {/* Lista Documenti */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                            <DocumentTextIcon className="w-5 h-5 mr-2 text-gray-600" />
                            Documenti ({documents.length})
                        </h3>
                        
                        {documents.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                {selectedDocuments.length === documents.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {documents.length === 0 ? (
                        <div className="text-center py-12">
                            <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Nessun documento trovato
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {filters.search || filters.status !== 'all' || filters.knowledgeBase !== 'all'
                                    ? 'Prova a modificare i filtri di ricerca'
                                    : 'Carica i tuoi primi documenti per iniziare'
                                }
                            </p>
                        </div>
                    ) : (
                        documents.map(document => (
                            <div
                                key={document.id}
                                className={`p-4 hover:bg-gray-50 transition-colors ${
                                    selectedDocuments.includes(document.id) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                }`}
                            >
                                <div className="flex items-center space-x-4">
                                    {/* Checkbox */}
                                    <input
                                        type="checkbox"
                                        checked={selectedDocuments.includes(document.id)}
                                        onChange={() => handleDocumentToggle(document.id)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />

                                    {/* Icona File */}
                                    <div className="text-2xl">
                                        {getFileTypeIcon(document.file_type)}
                                    </div>

                                    {/* Info Documento */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">
                                                {document.original_filename}
                                            </h4>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                                                    {document.status === 'processed' ? 'Processato' :
                                                     document.status === 'processing' ? 'Elaborazione' :
                                                     document.status === 'failed' ? 'Fallito' : document.status}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-1 flex items-center text-xs text-gray-500 space-x-4">
                                            <span>{document.file_size_mb} MB</span>
                                            {document.num_chunks && (
                                                <span>{document.num_chunks} chunk</span>
                                            )}
                                            <span>{new Date(document.uploaded_at).toLocaleDateString('it-IT')}</span>
                                        </div>

                                        {/* Knowledge Bases */}
                                        {document.knowledge_bases && document.knowledge_bases.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {document.knowledge_bases.map(kb => (
                                                    <span
                                                        key={kb.id}
                                                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                                                    >
                                                        📚 {kb.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Azioni */}
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {/* Implementare preview */}}
                                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Anteprima"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(document.id)}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Elimina"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
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