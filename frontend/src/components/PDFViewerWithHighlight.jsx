import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
    ChevronLeftIcon, 
    ChevronRightIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

// Configurazione semplice e robusta del worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewerWithHighlight = ({ 
    pdfUrl, 
    searchResults = [], 
    isSearching = false,
    onError = () => {},
    className = ""
}) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [highlightedText, setHighlightedText] = useState([]);
    
    const containerRef = useRef(null);
    const documentRef = useRef(null);

    // Gestione caricamento documento
    const onDocumentLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
        setIsLoading(false);
        setError(null);
    }, []);

    const onDocumentLoadError = useCallback((error) => {
        console.error('Errore nel caricamento del PDF:', error);
        setError('Errore nel caricamento del PDF');
        setIsLoading(false);
        onError(error);
    }, [onError]);

    // Gestione pagine
    const goToPrevPage = () => {
        setPageNumber(prev => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber(prev => Math.min(prev + 1, numPages || 1));
    };

    const goToPage = (page) => {
        if (page >= 1 && page <= (numPages || 1)) {
            setPageNumber(page);
        }
    };

    // Gestione zoom
    const zoomIn = () => {
        setScale(prev => Math.min(prev + 0.25, 3.0));
    };

    const zoomOut = () => {
        setScale(prev => Math.max(prev - 0.25, 0.5));
    };

    const resetZoom = () => {
        setScale(1.0);
    };

    // Gestione fullscreen
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            setIsFullscreen(true);
            if (containerRef.current) {
                containerRef.current.requestFullscreen?.();
            }
        } else {
            setIsFullscreen(false);
            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            }
        }
    };

    // Evidenziazione testo
    useEffect(() => {
        if (searchResults.length > 0) {
            setHighlightedText(searchResults.map(result => result.text));
        } else {
            setHighlightedText([]);
        }
    }, [searchResults]);

    // Gestione eventi tastiera
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    goToPrevPage();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    goToNextPage();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    resetZoom();
                    break;
                case 'f':
                case 'F11':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [numPages]);

    // Download PDF
    const downloadPdf = () => {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = 'document.pdf';
        link.click();
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <div className="text-center">
                    <div className="text-red-500 text-lg font-medium mb-2">⚠️ Errore</div>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={`relative bg-gray-100 rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[9999] bg-black' : className}`}
        >
            {/* Toolbar */}
            <div className={`flex items-center justify-between p-3 border-b ${isFullscreen ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                {/* Controlli di navigazione */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                        className={`p-2 rounded-lg transition-colors ${
                            pageNumber <= 1 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : isFullscreen 
                                    ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Pagina precedente (←)"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    
                    <div className={`flex items-center space-x-2 ${isFullscreen ? 'text-gray-300' : 'text-gray-700'}`}>
                        <input
                            type="number"
                            value={pageNumber}
                            onChange={(e) => goToPage(parseInt(e.target.value))}
                            min={1}
                            max={numPages || 1}
                            className={`w-16 px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isFullscreen ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'
                            }`}
                        />
                        <span className="text-sm">di {numPages || '?'}</span>
                    </div>
                    
                    <button
                        onClick={goToNextPage}
                        disabled={pageNumber >= (numPages || 1)}
                        className={`p-2 rounded-lg transition-colors ${
                            pageNumber >= (numPages || 1)
                                ? 'text-gray-400 cursor-not-allowed' 
                                : isFullscreen 
                                    ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Pagina successiva (→)"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Controlli zoom */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                        className={`p-2 rounded-lg transition-colors ${
                            scale <= 0.5 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : isFullscreen 
                                    ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Riduci zoom (-)"
                    >
                        <MagnifyingGlassMinusIcon className="w-5 h-5" />
                    </button>
                    
                    <span className={`text-sm font-medium min-w-[50px] text-center ${isFullscreen ? 'text-gray-300' : 'text-gray-700'}`}>
                        {Math.round(scale * 100)}%
                    </span>
                    
                    <button
                        onClick={zoomIn}
                        disabled={scale >= 3.0}
                        className={`p-2 rounded-lg transition-colors ${
                            scale >= 3.0 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : isFullscreen 
                                    ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Aumenta zoom (+)"
                    >
                        <MagnifyingGlassPlusIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Controlli aggiuntivi */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={downloadPdf}
                        className={`p-2 rounded-lg transition-colors ${
                            isFullscreen 
                                ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Scarica PDF"
                    >
                        <DocumentArrowDownIcon className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={toggleFullscreen}
                        className={`p-2 rounded-lg transition-colors ${
                            isFullscreen 
                                ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title={isFullscreen ? "Esci da schermo intero (F)" : "Schermo intero (F)"}
                    >
                        {isFullscreen ? (
                            <ArrowsPointingInIcon className="w-5 h-5" />
                        ) : (
                            <ArrowsPointingOutIcon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Indicatore di ricerca */}
            {isSearching && (
                <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-lg shadow-lg ${
                    isFullscreen ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                        <span className="text-sm">Ricerca in corso...</span>
                    </div>
                </div>
            )}

            {/* Indicatore risultati di ricerca */}
            {searchResults.length > 0 && (
                <div className={`absolute top-16 right-4 z-10 px-3 py-2 rounded-lg shadow-lg ${
                    isFullscreen ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
                }`}>
                    <span className="text-sm font-medium">
                        🔍 {searchResults.length} risultati trovati
                    </span>
                </div>
            )}

            {/* Area di visualizzazione PDF */}
            <div className={`flex-1 overflow-auto ${isFullscreen ? 'bg-black' : 'bg-gray-50'}`} style={{ height: isFullscreen ? 'calc(100vh - 60px)' : '400px' }}>
                <div className="flex justify-center p-4">
                    {isLoading && (
                        <div className={`flex items-center justify-center py-20 ${isFullscreen ? 'text-white' : 'text-gray-600'}`}>
                            <div className="text-center">
                                <div className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p>Caricamento PDF...</p>
                            </div>
                        </div>
                    )}
                    
                    {pdfUrl && (
                        <Document
                            ref={documentRef}
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading=""
                            className="shadow-lg"
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                className="border border-gray-300 bg-white"
                            />
                        </Document>
                    )}
                </div>
            </div>

            {/* Shortcuts Help */}
            {isFullscreen && (
                <div className="absolute bottom-4 left-4 bg-gray-800 text-gray-300 px-3 py-2 rounded-lg text-xs">
                    <div className="space-y-1">
                        <div>← → : Naviga pagine</div>
                        <div>+ - : Zoom</div>
                        <div>F : Fullscreen</div>
                        <div>0 : Reset zoom</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PDFViewerWithHighlight; 