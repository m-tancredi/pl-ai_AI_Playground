import React, { useState, useEffect } from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const KnowledgeBaseModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    knowledgeBase = null, 
    documents = [], 
    isLoading = false 
}) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        chunk_size: 1000,
        chunk_overlap: 200,
        embedding_model: 'all-MiniLM-L6-v2'
    });
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [errors, setErrors] = useState({});

    // Modelli di embedding disponibili
    const embeddingModels = [
        { value: 'all-MiniLM-L6-v2', label: 'all-MiniLM-L6-v2 (Veloce)' },
        { value: 'all-mpnet-base-v2', label: 'all-mpnet-base-v2 (Accurato)' },
        { value: 'multi-qa-MiniLM-L6-cos-v1', label: 'multi-qa-MiniLM-L6-cos-v1 (Q&A)' }
    ];

    // Inizializza il form quando si apre il modal
    useEffect(() => {
        if (isOpen) {
            if (knowledgeBase) {
                // Modalità modifica
                setFormData({
                    name: knowledgeBase.name || '',
                    description: knowledgeBase.description || '',
                    chunk_size: knowledgeBase.chunk_size || 1000,
                    chunk_overlap: knowledgeBase.chunk_overlap || 200,
                    embedding_model: knowledgeBase.embedding_model || 'all-MiniLM-L6-v2'
                });
                setSelectedDocuments(knowledgeBase.documents?.map(doc => doc.id) || []);
            } else {
                // Modalità creazione
                setFormData({
                    name: '',
                    description: '',
                    chunk_size: 1000,
                    chunk_overlap: 200,
                    embedding_model: 'all-MiniLM-L6-v2'
                });
                setSelectedDocuments([]);
            }
            setErrors({});
        }
    }, [isOpen, knowledgeBase]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'chunk_size' || name === 'chunk_overlap' ? parseInt(value) || 0 : value
        }));
        
        // Rimuovi errore quando l'utente inizia a digitare
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleDocumentToggle = (documentId) => {
        setSelectedDocuments(prev => {
            if (prev.includes(documentId)) {
                return prev.filter(id => id !== documentId);
            } else {
                return [...prev, documentId];
            }
        });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Il nome è obbligatorio';
        } else if (formData.name.length < 3) {
            newErrors.name = 'Il nome deve essere di almeno 3 caratteri';
        }

        if (formData.chunk_size < 100 || formData.chunk_size > 2000) {
            newErrors.chunk_size = 'La dimensione chunk deve essere tra 100 e 2000';
        }

        if (formData.chunk_overlap < 0 || formData.chunk_overlap >= formData.chunk_size) {
            newErrors.chunk_overlap = 'L\'overlap deve essere tra 0 e la dimensione chunk';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const kbData = {
            ...formData,
            selectedDocuments: selectedDocuments
        };

        onSave(kbData);
    };

    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    if (!isOpen) return null;

    // Filtra documenti processati
    const processedDocuments = documents.filter(doc => doc.status === 'processed');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {knowledgeBase ? 'Modifica Knowledge Base' : 'Crea Nuova Knowledge Base'}
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Informazioni di base */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nome Knowledge Base *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.name ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Es: Knowledge Base Tecnologie AI"
                                    disabled={isLoading}
                                />
                                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Modello Embedding
                                </label>
                                <select
                                    name="embedding_model"
                                    value={formData.embedding_model}
                                    onChange={handleInputChange}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isLoading}
                                >
                                    {embeddingModels.map(model => (
                                        <option key={model.value} value={model.value}>
                                            {model.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descrizione
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Descrivi il contenuto e l'obiettivo di questa knowledge base..."
                                disabled={isLoading}
                            />
                        </div>

                        {/* Configurazioni avanzate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Dimensione Chunk
                                </label>
                                <input
                                    type="number"
                                    name="chunk_size"
                                    value={formData.chunk_size}
                                    onChange={handleInputChange}
                                    min="100"
                                    max="2000"
                                    step="50"
                                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.chunk_size ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    disabled={isLoading}
                                />
                                {errors.chunk_size && <p className="text-red-500 text-sm mt-1">{errors.chunk_size}</p>}
                                <p className="text-xs text-gray-500 mt-1">Numero di caratteri per chunk (100-2000)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Overlap Chunk
                                </label>
                                <input
                                    type="number"
                                    name="chunk_overlap"
                                    value={formData.chunk_overlap}
                                    onChange={handleInputChange}
                                    min="0"
                                    max={formData.chunk_size - 1}
                                    step="10"
                                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.chunk_overlap ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    disabled={isLoading}
                                />
                                {errors.chunk_overlap && <p className="text-red-500 text-sm mt-1">{errors.chunk_overlap}</p>}
                                <p className="text-xs text-gray-500 mt-1">Caratteri di sovrapposizione tra chunk</p>
                            </div>
                        </div>

                        {/* Selezione documenti */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Documenti da includere ({selectedDocuments.length} selezionati)
                            </label>
                            
                            {processedDocuments.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>Nessun documento processato disponibile</p>
                                    <p className="text-sm">Carica e processa alcuni documenti prima di creare una KB</p>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                    {processedDocuments.map(document => (
                                        <div
                                            key={document.id}
                                            className="flex items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                id={`doc-${document.id}`}
                                                checked={selectedDocuments.includes(document.id)}
                                                onChange={() => handleDocumentToggle(document.id)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                disabled={isLoading}
                                            />
                                            <label
                                                htmlFor={`doc-${document.id}`}
                                                className="ml-3 flex-1 cursor-pointer"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {document.original_filename}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {document.file_size_mb} MB • {document.num_chunks} chunk
                                                        </p>
                                                    </div>
                                                    <div className="text-xs text-green-600 font-medium">
                                                        Processato
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !formData.name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Salvando...' : (knowledgeBase ? 'Aggiorna' : 'Crea Knowledge Base')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseModal; 