import React, { useState, useEffect, useMemo } from 'react';
import { 
    XMarkIcon, 
    MagnifyingGlassIcon, 
    DocumentTextIcon,
    SparklesIcon,
    ArrowPathIcon,
    EyeIcon,
    DocumentIcon
} from '@heroicons/react/24/outline';
import { ragService } from '../services/ragService';
import PDFViewerWithHighlight from './PDFViewerWithHighlight';

const DocumentPreviewModal = ({ document, isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [highlightedText, setHighlightedText] = useState('');
    const [viewMode, setViewMode] = useState('pdf'); // 'pdf' o 'text'
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    // Reset quando cambia il documento
    useEffect(() => {
        if (document) {
            setSearchQuery('');
            setSearchResults([]);
            setHighlightedText(document.extracted_text || '');
            
            // Carica il PDF se è un documento PDF
            if (document.file_type && document.file_type.includes('pdf')) {
                loadPdfBlob(document.id);
                setViewMode('pdf');
            } else {
                setPdfUrl(null);
                setViewMode('text');
            }
        }
    }, [document]);

    // Funzione per caricare il PDF come Blob
    const loadPdfBlob = async (documentId) => {
        setIsPdfLoading(true);
        try {
            const blob = await ragService.downloadPdf(documentId);
            const blobUrl = URL.createObjectURL(blob);
            setPdfUrl(blobUrl);
        } catch (error) {
            console.error('Errore nel caricamento del PDF:', error);
            setViewMode('text'); // Fallback alla vista testuale
        } finally {
            setIsPdfLoading(false);
        }
    };

    // Funzione per cercare nel testo usando AI
    const handleNaturalLanguageSearch = async () => {
        if (!searchQuery.trim() || !document) return;

        setIsSearching(true);
        try {
            // Chiamata API per ricerca intelligente nel documento
            const data = await ragService.searchDocumentContent(document.id, searchQuery);
            setSearchResults(data.results || []);
            
            // Evidenzia il testo se ci sono risultati
            if (data.results && data.results.length > 0) {
                highlightTextInDocument(data.results);
            }
        } catch (error) {
            console.error('Errore durante la ricerca:', error);
            // Fallback: ricerca semplice nel testo
            performSimpleSearch();
        } finally {
            setIsSearching(false);
        }
    };

    // Ricerca semplice fallback
    const performSimpleSearch = () => {
        if (!searchQuery.trim() || !document?.extracted_text) {
            setHighlightedText(document?.extracted_text || '');
            setSearchResults([]);
            return;
        }

        const text = document.extracted_text;
        const query = searchQuery.toLowerCase();
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        const results = sentences
            .map((sentence, index) => ({
                text: sentence.trim(),
                relevance: sentence.toLowerCase().includes(query) ? 1 : 0,
                position: index
            }))
            .filter(result => result.relevance > 0)
            .slice(0, 5);

        setSearchResults(results);
        
        if (results.length > 0) {
            highlightTextInDocument(results);
        }
    };

    // Evidenzia il testo nel documento
    const highlightTextInDocument = (results) => {
        if (!document?.extracted_text || results.length === 0) return;

        let highlightedContent = document.extracted_text;
        
        // Ordina i risultati per posizione per evitare sovrapposizioni
        const sortedResults = [...results].sort((a, b) => {
            const aPos = document.extracted_text.indexOf(a.text);
            const bPos = document.extracted_text.indexOf(b.text);
            return aPos - bPos;
        });

        // Applica l'evidenziazione dal fondo verso l'inizio per mantenere le posizioni
        for (let i = sortedResults.length - 1; i >= 0; i--) {
            const result = sortedResults[i];
            const regex = new RegExp(`(${escapeRegex(result.text.trim())})`, 'gi');
            highlightedContent = highlightedContent.replace(
                regex,
                '<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium">$1</mark>'
            );
        }

        setHighlightedText(highlightedContent);
    };

    // Escape regex special characters
    const escapeRegex = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Gestione della pressione dell'Enter
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleNaturalLanguageSearch();
        }
    };

    // Scroll verso il primo risultato evidenziato
    const scrollToFirstResult = () => {
        setTimeout(() => {
            const firstHighlight = document.querySelector('.bg-yellow-200');
            if (firstHighlight) {
                firstHighlight.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 100);
    };

    useEffect(() => {
        if (searchResults.length > 0) {
            scrollToFirstResult();
        }
    }, [searchResults]);

    // Cleanup del blob URL quando il componente viene smontato
    useEffect(() => {
        return () => {
            if (pdfUrl && pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [pdfUrl]);

    if (!isOpen || !document) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {document.original_filename || document.filename}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : ''} • 
                                {document.status === 'processed' ? ' Processato' : ' In elaborazione'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Controlli di visualizzazione */}
                {pdfUrl && (
                    <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <span className="text-sm font-medium text-gray-700">Modalità di visualizzazione:</span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setViewMode('pdf')}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            viewMode === 'pdf' 
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                        }`}
                                    >
                                        <EyeIcon className="w-4 h-4" />
                                        <span>Vista PDF</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('text')}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            viewMode === 'text' 
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                        }`}
                                    >
                                        <DocumentTextIcon className="w-4 h-4" />
                                        <span>Vista Testuale</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Barra di ricerca intelligente */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center space-x-3 mb-3">
                        <SparklesIcon className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-medium text-gray-900">Ricerca Intelligente</h3>
                    </div>
                    <div className="flex space-x-3">
                        <div className="flex-1 relative">
                            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Es: quanto devo pagare? oppure condizioni del contratto..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={handleNaturalLanguageSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                        >
                            {isSearching ? (
                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            ) : (
                                <SparklesIcon className="w-5 h-5" />
                            )}
                            <span>{isSearching ? 'Cerco...' : 'Cerca'}</span>
                        </button>
                    </div>

                    {/* Risultati della ricerca */}
                    {searchResults.length > 0 && (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Trovati {searchResults.length} risultati rilevanti:
                            </h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {searchResults.map((result, index) => (
                                    <div key={index} className="text-sm text-gray-600 p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                                        {result.text.substring(0, 150)}...
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contenuto del documento */}
                <div className="flex-1 overflow-hidden">
                    {viewMode === 'pdf' && !isPdfLoading && pdfUrl ? (
                        <div className="h-full">
                            <PDFViewerWithHighlight
                                pdfUrl={pdfUrl}
                                searchResults={searchResults}
                                isSearching={isSearching}
                                onError={(error) => {
                                    console.error('Errore PDF viewer:', error);
                                    setViewMode('text');
                                }}
                                className="h-full"
                            />
                        </div>
                    ) : viewMode === 'pdf' && isPdfLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-gray-600 text-lg">Caricamento PDF...</p>
                                <p className="text-gray-500 text-sm mt-2">Preparazione della visualizzazione</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto p-6">
                            {document.extracted_text ? (
                                <div className="prose max-w-none">
                                    <div 
                                        className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{ 
                                            __html: highlightedText 
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">
                                            {document.status === 'processing' 
                                                ? 'Documento in elaborazione...' 
                                                : 'Contenuto non disponibile'}
                                        </p>
                                        {document.status === 'processing' && (
                                            <div className="mt-4">
                                                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer con statistiche */}
                {document.extracted_text && (
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-sm text-gray-600">
                        <div>
                            Caratteri: {document.extracted_text.length.toLocaleString()} • 
                            Parole: {document.extracted_text.split(/\s+/).length.toLocaleString()}
                        </div>
                        {searchResults.length > 0 && (
                            <div className="text-blue-600 font-medium">
                                {searchResults.length} sezioni rilevanti trovate
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentPreviewModal; 