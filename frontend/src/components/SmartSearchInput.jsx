import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    MagnifyingGlassIcon, 
    SparklesIcon, 
    ClockIcon,
    LightBulbIcon,
    MicrophoneIcon,
    PhotoIcon
} from '@heroicons/react/24/outline';

const SmartSearchInput = ({ 
    onSearch, 
    documentContext = '', 
    placeholder = "Chiedi qualsiasi cosa... la tua AI capisce tutto! 🧠✨",
    isSearching = false
}) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // 🧠 Suggerimenti intelligenti basati sul contenuto
    const generateSmartSuggestions = useCallback(async (partialQuery) => {
        if (!partialQuery || partialQuery.length < 2) {
            setSuggestions([]);
            return;
        }

        try {
            // 🎯 Suggerimenti basati sul documento
            const contextSuggestions = generateContextualSuggestions(partialQuery, documentContext);
            
            // ⚡ Suggerimenti da storico
            const historySuggestions = generateHistorySuggestions(partialQuery, searchHistory);
            
            // 🔮 Suggerimenti predittivi
            const predictiveSuggestions = generatePredictiveSuggestions(partialQuery);
            
            const allSuggestions = [
                ...contextSuggestions,
                ...historySuggestions,
                ...predictiveSuggestions
            ].slice(0, 6);

            setSuggestions(allSuggestions);
        } catch (error) {
            console.error('Errore nella generazione suggerimenti:', error);
        }
    }, [documentContext, searchHistory]);

    // 🎪 Suggerimenti contestuali dal documento
    const generateContextualSuggestions = (partialQuery, context) => {
        if (!context) return [];
        
        const queryLower = partialQuery.toLowerCase();
        const contextWords = context.toLowerCase().split(/\s+/);
        
        // Trova parole simili o correlate
        const relatedWords = contextWords.filter(word => 
            word.length > 3 && 
            (word.includes(queryLower) || queryLower.includes(word))
        );

        // Crea suggerimenti intelligenti
        const suggestions = [];
        
        // Suggerimenti diretti
        relatedWords.slice(0, 3).forEach(word => {
            suggestions.push({
                type: 'context',
                text: word,
                icon: '📄',
                description: 'Dal documento',
                confidence: 0.9
            });
        });

        // Suggerimenti semantici
        if (queryLower.includes('cost') || queryLower.includes('prezzo')) {
            suggestions.push({
                type: 'semantic',
                text: 'quanto costa',
                icon: '💰',
                description: 'Ricerca costi e prezzi',
                confidence: 0.8
            });
        }

        if (queryLower.includes('data') || queryLower.includes('scaden')) {
            suggestions.push({
                type: 'semantic',
                text: 'date importanti',
                icon: '📅',
                description: 'Trova scadenze e date',
                confidence: 0.8
            });
        }

        return suggestions;
    };

    // 📚 Suggerimenti da storico
    const generateHistorySuggestions = (partialQuery, history) => {
        return history
            .filter(item => 
                item.toLowerCase().includes(partialQuery.toLowerCase()) &&
                item !== partialQuery
            )
            .slice(0, 2)
            .map(item => ({
                type: 'history',
                text: item,
                icon: '🕒',
                description: 'Ricerca precedente',
                confidence: 0.7
            }));
    };

    // 🔮 Suggerimenti predittivi
    const generatePredictiveSuggestions = (partialQuery) => {
        const predictiveQueries = [
            { trigger: 'qual', suggestion: 'quali sono i requisiti', icon: '❓' },
            { trigger: 'dove', suggestion: 'dove si trova', icon: '📍' },
            { trigger: 'quando', suggestion: 'quando scade', icon: '⏰' },
            { trigger: 'quanto', suggestion: 'quanto costa', icon: '💰' },
            { trigger: 'chi', suggestion: 'chi è responsabile', icon: '👤' },
            { trigger: 'come', suggestion: 'come funziona', icon: '⚙️' },
            { trigger: 'perché', suggestion: 'perché è necessario', icon: '💡' }
        ];

        return predictiveQueries
            .filter(item => item.trigger.includes(partialQuery.toLowerCase()))
            .map(item => ({
                type: 'predictive',
                text: item.suggestion,
                icon: item.icon,
                description: 'Suggerimento AI',
                confidence: 0.6
            }));
    };

    // Debounced search suggestions
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                generateSmartSuggestions(query);
                setShowSuggestions(true);
            } else {
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, generateSmartSuggestions]);

    // Gestione ricerca
    const handleSearch = (searchQuery = query) => {
        if (!searchQuery.trim()) return;
        
        // Aggiungi alla cronologia
        setSearchHistory(prev => {
            const newHistory = [searchQuery, ...prev.filter(item => item !== searchQuery)].slice(0, 10);
            localStorage.setItem('smartSearchHistory', JSON.stringify(newHistory));
            return newHistory;
        });

        onSearch(searchQuery);
        setShowSuggestions(false);
        setQuery(searchQuery);
    };

    // Carica cronologia al mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('smartSearchHistory');
        if (savedHistory) {
            setSearchHistory(JSON.parse(savedHistory));
        }
    }, []);

    // 🔧 BUG FIX: Chiudi dropdown quando si clicca fuori (con controlli di sicurezza)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // 🛡️ Controlli di sicurezza per evitare errori
            if (!event || !event.target || !event.target.nodeType) {
                return;
            }

            // Verifica che i ref siano validi e che l'evento target sia un elemento DOM
            if (
                inputRef.current && 
                suggestionsRef.current &&
                event.target instanceof Element &&
                !inputRef.current.contains(event.target) &&
                !suggestionsRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
                setSelectedSuggestion(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Gestione tastiera
    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Enter') {
                handleSearch();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestion(prev => 
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestion(prev => prev > 0 ? prev - 1 : prev);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestion >= 0) {
                    // 🔧 BUG FIX: Chiudi dropdown e resetta selezione dopo invio
                    setShowSuggestions(false);
                    setSelectedSuggestion(-1);
                    handleSearch(suggestions[selectedSuggestion].text);
                } else {
                    // 🔧 BUG FIX: Chiudi dropdown anche per ricerca normale
                    setShowSuggestions(false);
                    setSelectedSuggestion(-1);
                    handleSearch();
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedSuggestion(-1);
                break;
            default:
                break;
        }
    };

    // Click su suggerimento
    const handleSuggestionClick = (suggestion) => {
        // 🔧 BUG FIX: Chiudi dropdown e resetta selezione dopo click
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        handleSearch(suggestion.text);
    };

    return (
        <div className="relative w-full">
            {/* 🎪 Search Bar Magica */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isSearching ? (
                        <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                    ) : (
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                    )}
                </div>
                
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                    placeholder={placeholder}
                    className="w-full pl-12 pr-24 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-300 bg-white shadow-lg"
                />

                {/* 🎤 Controlli aggiuntivi */}
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-2">
                    <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Ricerca vocale"
                    >
                        <MicrophoneIcon className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Ricerca per immagine"
                    >
                        <PhotoIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            // 🔧 BUG FIX: Chiudi dropdown anche dal pulsante Cerca
                            setShowSuggestions(false);
                            setSelectedSuggestion(-1);
                            handleSearch();
                        }}
                        disabled={isSearching || !query.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>Cerca</span>
                    </button>
                </div>
            </div>

            {/* ⚡ Suggerimenti intelligenti */}
            {showSuggestions && suggestions.length > 0 && (
                <div 
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-300"
                >
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
                        <div className="flex items-center space-x-2">
                            <LightBulbIcon className="w-5 h-5 text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Suggerimenti intelligenti</span>
                        </div>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={`p-4 cursor-pointer transition-all duration-200 ${
                                    index === selectedSuggestion 
                                        ? 'bg-purple-50 border-l-4 border-purple-500' 
                                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">{suggestion.icon}</span>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{suggestion.text}</div>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="text-xs text-gray-500">{suggestion.description}</span>
                                            <div className="flex items-center space-x-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1 h-1 rounded-full ${
                                                            i < Math.round(suggestion.confidence * 5) 
                                                                ? 'bg-green-400' 
                                                                : 'bg-gray-200'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* 📚 Cronologia recente */}
                    {searchHistory.length > 0 && (
                        <>
                            <div className="p-3 border-t border-gray-100 bg-gray-50">
                                <div className="flex items-center space-x-2">
                                    <ClockIcon className="w-4 h-4 text-gray-600" />
                                    <span className="text-xs font-medium text-gray-600">Ricerche recenti</span>
                                </div>
                            </div>
                            <div className="max-h-32 overflow-y-auto">
                                {searchHistory.slice(0, 3).map((item, index) => (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            // 🔧 BUG FIX: Chiudi dropdown anche per cronologia
                                            setShowSuggestions(false);
                                            setSelectedSuggestion(-1);
                                            handleSearch(item);
                                        }}
                                        className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <ClockIcon className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">{item}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmartSearchInput; 