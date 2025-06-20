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
import SmartSearchInput from './SmartSearchInput';
import SmartSearchResults from './SmartSearchResults';

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

    // 🧠 Funzione di ricerca AI ULTRA-POTENZIATA
    const handleNaturalLanguageSearch = async (query) => {
        if (!query?.trim() || !document) return;

        setSearchQuery(query);
        setIsSearching(true);
        
        try {
            // 🚀 Chiamata API con opzioni di ricerca avanzate
            const searchOptions = {
                top_k: 15,  // Più risultati per analisi completa
                include_context: true,
                similarity_threshold: 0.3,  // 🔥 Soglia molto bassa per catturare più risultati
                enable_clustering: true
            };

            const data = await ragService.searchDocumentContent(document.id, query, searchOptions);
            setSearchResults(data.results || []);
            
            // 🎯 Log informazioni ricerca per l'utente
            if (data.provider_info) {
                console.log('🔥 Ricerca completata con:', data.provider_info);
            }
            
            // 🔍 Log dettagliato dei risultati per debugging
            console.log('📊 Risultati ricerca:', {
                total_results: data.results?.length || 0,
                search_type: data.search_type,
                results_with_highlights: data.results?.filter(r => r.highlight_spans?.length > 0).length || 0,
                first_result: data.results?.[0] ? {
                    text_length: data.results[0].text?.length,
                    highlight_spans_count: data.results[0].highlight_spans?.length || 0,
                    confidence: data.results[0].confidence,
                    highlight_spans: data.results[0].highlight_spans
                } : null
            });
            
            // 🎯 Evidenzia il testo se ci sono risultati
            if (data.results && data.results.length > 0) {
                highlightTextInDocument(data.results);
            }
        } catch (error) {
            console.error('Errore durante la ricerca AI:', error);
            // 🔄 Fallback: ricerca semplice nel testo
            performSimpleSearch(query);
        } finally {
            setIsSearching(false);
        }
    };

    // 🎯 Gestione click sui risultati
    const handleResultClick = (result, index) => {
        // Scroll al primo highlight o switch alla vista testo
        if (viewMode === 'pdf') {
            // Per ora, switch alla vista testo per mostrare il risultato
            setViewMode('text');
            setTimeout(() => {
                scrollToFirstResult();
            }, 100);
        } else {
            scrollToFirstResult();
        }
    };

    // 🔄 Ricerca semplice fallback potenziata
    const performSimpleSearch = (query) => {
        if (!query?.trim() || !document?.extracted_text) {
            setHighlightedText(document?.extracted_text || '');
            setSearchResults([]);
            return;
        }

        const text = document.extracted_text;
        const queryLower = query.toLowerCase();
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        const results = sentences
            .map((sentence, index) => {
                const sentenceLower = sentence.toLowerCase();
                const matchCount = (sentenceLower.match(new RegExp(queryLower, 'g')) || []).length;
                const relevance = matchCount > 0 ? Math.min(1, matchCount * 0.3 + 0.4) : 0;
                
                return {
                    text: sentence.trim(),
                    relevance: relevance,
                    position: index,
                    chunk_index: index
                };
            })
            .filter(result => result.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 5);

        setSearchResults(results);
        
        if (results.length > 0) {
            highlightTextInDocument(results);
        }
    };

    // 🎯 Evidenzia il testo nel documento - VERSIONE ULTRA-POTENZIATA
    const highlightTextInDocument = (results) => {
        if (!document?.extracted_text || results.length === 0) {
            setHighlightedText(document?.extracted_text || '');
            return;
        }

        console.log('🎯 Evidenziazione risultati:', results.length, 'risultati trovati');
        let highlightedContent = document.extracted_text;
        
        // 🔥 METODO 1: Usa highlight_spans se disponibili (dal backend)
        const spansToHighlight = [];
        results.forEach((result, index) => {
            if (result.highlight_spans && result.highlight_spans.length > 0) {
                console.log(`📍 Risultato ${index + 1}: ${result.highlight_spans.length} spans da evidenziare`);
                result.highlight_spans.forEach(span => {
                    spansToHighlight.push({
                        start: span.start,
                        end: span.end,
                        text: highlightedContent.substring(span.start, span.end)
                    });
                });
            }
        });

        // Applica gli spans se disponibili
        if (spansToHighlight.length > 0) {
            console.log('✨ Applicazione', spansToHighlight.length, 'highlight spans dal backend');
            // Ordina per posizione decrescente per evitare problemi di offset
            spansToHighlight.sort((a, b) => b.start - a.start);
            
            spansToHighlight.forEach(span => {
                const before = highlightedContent.substring(0, span.start);
                const highlighted = highlightedContent.substring(span.start, span.end);
                const after = highlightedContent.substring(span.end);
                
                highlightedContent = before + 
                    `<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium animate-pulse">${highlighted}</mark>` + 
                    after;
            });
        } else {
            // 🔄 METODO 2: Fallback - Cerca il testo dei risultati
            console.log('🔄 Fallback: ricerca diretta del testo nei risultati');
            
            // Raccogli tutte le parole chiave dalla query
            const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            console.log('🔍 Parole chiave da evidenziare:', queryWords);
            
            // Evidenzia le parole chiave
            queryWords.forEach(word => {
                const regex = new RegExp(`\\b(${escapeRegex(word)})\\b`, 'gi');
                const matches = highlightedContent.match(regex);
                if (matches) {
                    console.log(`✅ Trovate ${matches.length} occorrenze di "${word}"`);
                    highlightedContent = highlightedContent.replace(
                        regex,
                        '<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium animate-pulse">$1</mark>'
                    );
                }
            });

            // Prova anche a evidenziare parti del testo dei risultati
            results.forEach((result, index) => {
                if (result.text && result.text.length > 10) {
                    // Prendi le prime e ultime parole del risultato per matching parziale
                    const words = result.text.trim().split(/\s+/);
                    if (words.length >= 3) {
                        const firstWords = words.slice(0, 3).join(' ');
                        const lastWords = words.slice(-3).join(' ');
                        
                        [firstWords, lastWords].forEach(phrase => {
                            if (phrase.length > 10) {
                                const regex = new RegExp(`(${escapeRegex(phrase)})`, 'gi');
                                const matches = highlightedContent.match(regex);
                                if (matches) {
                                    console.log(`🎯 Evidenziazione frase "${phrase}" - ${matches.length} match`);
                                    highlightedContent = highlightedContent.replace(
                                        regex,
                                        '<mark class="bg-blue-200 px-1 py-0.5 rounded font-medium">$1</mark>'
                                    );
                                }
                            }
                        });
                    }
                }
            });
        }

        console.log('🎨 Evidenziazione completata');
        setHighlightedText(highlightedContent);
    };

    // Escape regex special characters
    const escapeRegex = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

                {/* 🚀 Barra di ricerca LEGGENDARIA */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center space-x-3 mb-4">
                        <SparklesIcon className="w-6 h-6 text-purple-600 animate-pulse" />
                        <h3 className="text-xl font-semibold text-purple-800">🧠 Ricerca AI Ultra-Intelligente</h3>
                    </div>
                    
                    <SmartSearchInput
                        onSearch={handleNaturalLanguageSearch}
                        documentContext={document?.extracted_text}
                        placeholder="🧠 Chiedi con linguaggio naturale... OpenAI embeddings capiscono tutto! ✨"
                        isSearching={isSearching}
                    />
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
                        <div className="h-full overflow-y-auto">
                            {/* 🎯 Risultati di ricerca EPICI */}
                            {searchResults.length > 0 ? (
                                <div className="p-6">
                                    <SmartSearchResults
                                        results={searchResults}
                                        searchQuery={searchQuery}
                                        onResultClick={handleResultClick}
                                        isLoading={isSearching}
                                    />
                                </div>
                            ) : document.extracted_text ? (
                                <div className="p-6">
                                    <div className="prose max-w-none">
                                        <div 
                                            className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={{ 
                                                __html: highlightedText 
                                            }}
                                        />
                                    </div>
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