import React, { useState, useEffect } from 'react';
import { 
    SparklesIcon, 
    ChartBarIcon, 
    ClockIcon,
    LightBulbIcon,
    EyeIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    TagIcon,
    StarIcon,
    InformationCircleIcon,
    DocumentTextIcon,
    CpuChipIcon
} from '@heroicons/react/24/outline';

const SmartSearchResults = ({ 
    results = [], 
    searchQuery = '', 
    onResultClick,
    isLoading = false
}) => {
    const [expandedResults, setExpandedResults] = useState(new Set());
    const [selectedCluster, setSelectedCluster] = useState('all');
    const [sortBy, setSortBy] = useState('semantic_score');
    const [showAnalytics, setShowAnalytics] = useState(false);

    // 🎯 Analisi clusters
    const clusters = React.useMemo(() => {
        const clusterMap = new Map();
        results.forEach(result => {
            const clusterId = result.cluster_id || 0;
            if (!clusterMap.has(clusterId)) {
                clusterMap.set(clusterId, []);
            }
            clusterMap.get(clusterId).push(result);
        });
        return clusterMap;
    }, [results]);

    // 📊 Statistiche risultati
    const analytics = React.useMemo(() => {
        if (!results.length) return null;

        const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;
        const highConfidenceCount = results.filter(r => (r.confidence || 0) > 0.8).length;
        const clustersCount = clusters.size;
        const totalKeywordMatches = results.reduce((sum, r) => sum + (r.keyword_matches?.length || 0), 0);

        return {
            avgConfidence: avgConfidence.toFixed(3),
            highConfidenceCount,
            clustersCount,
            totalKeywordMatches,
            searchType: results[0]?.search_type || 'unknown'
        };
    }, [results, clusters]);

    // 🎨 Ottieni colore confidence
    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.9) return 'text-emerald-600 bg-emerald-100 border-emerald-300';
        if (confidence >= 0.8) return 'text-green-600 bg-green-100 border-green-300';
        if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-100 border-yellow-300';
        if (confidence >= 0.6) return 'text-orange-600 bg-orange-100 border-orange-300';
        return 'text-red-600 bg-red-100 border-red-300';
    };

    // 🎯 Ottieni colore cluster
    const getClusterColor = (clusterId) => {
        const colors = [
            'bg-blue-100 text-blue-800 border-blue-300',
            'bg-purple-100 text-purple-800 border-purple-300',
            'bg-green-100 text-green-800 border-green-300',
            'bg-yellow-100 text-yellow-800 border-yellow-300',
            'bg-pink-100 text-pink-800 border-pink-300'
        ];
        return colors[clusterId % colors.length];
    };

    // 🔮 Evidenzia testo con spans intelligenti
    const highlightText = (text, query, highlightSpans = []) => {
        if (!query || !text) return text;
        
        // Usa gli span forniti dal backend se disponibili
        if (highlightSpans && highlightSpans.length > 0) {
            let highlightedText = text;
            // Ordina gli span per posizione decrescente per evitare problemi di offset
            const sortedSpans = [...highlightSpans].sort((a, b) => b.start - a.start);
            
            sortedSpans.forEach(span => {
                const before = highlightedText.substring(0, span.start);
                const highlighted = highlightedText.substring(span.start, span.end);
                const after = highlightedText.substring(span.end);
                
                highlightedText = before + 
                    `<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium animate-pulse">${highlighted}</mark>` + 
                    after;
            });
            
            return highlightedText;
        }

        // Fallback al vecchio sistema
        const words = query.toLowerCase().split(' ');
        let highlightedText = text;
        
        words.forEach(word => {
            if (word.length > 2) {
                const regex = new RegExp(`(${word})`, 'gi');
                highlightedText = highlightedText.replace(
                    regex, 
                    '<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium animate-pulse">$1</mark>'
                );
            }
        });
        
        return highlightedText;
    };

    // Espandi/contrai risultati
    const toggleExpanded = (index) => {
        const newExpanded = new Set(expandedResults);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedResults(newExpanded);
    };

    // 🔄 Filtra e ordina risultati
    const filteredAndSortedResults = React.useMemo(() => {
        let filtered = results;
        
        if (selectedCluster !== 'all') {
            filtered = results.filter(r => (r.cluster_id || 0) === parseInt(selectedCluster));
        }

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'confidence':
                    return (b.confidence || 0) - (a.confidence || 0);
                case 'relevance':
                    return (b.relevance || 0) - (a.relevance || 0);
                case 'semantic_score':
                default:
                    return (b.semantic_score || b.relevance || 0) - (a.semantic_score || a.relevance || 0);
            }
        });
    }, [results, selectedCluster, sortBy]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="relative">
                        <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
                        <CpuChipIcon className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">🧠 AI sta elaborando...</h3>
                    <p className="text-gray-600 text-lg">Ricerca semantica con OpenAI embeddings in corso</p>
                    <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-purple-600">
                        <SparklesIcon className="w-4 h-4 animate-pulse" />
                        <span>Analisi semantica ultra-intelligente</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!results.length) {
        return (
            <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <SparklesIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun risultato trovato</h3>
                <p className="text-gray-600">Prova con parole chiave diverse o termini più generali</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 🎯 Header con Analytics */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <SparklesIcon className="w-8 h-8 text-purple-600" />
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">
                                🧠 Risultati AI Ultra-Intelligenti
                            </h3>
                            <p className="text-sm text-gray-600">
                                {results.length} risultati trovati con ricerca semantica avanzata
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setShowAnalytics(!showAnalytics)}
                        className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Analytics</span>
                        {showAnalytics ? 
                            <ChevronUpIcon className="w-4 h-4" /> : 
                            <ChevronDownIcon className="w-4 h-4" />
                        }
                    </button>
                </div>

                {/* 📊 Analytics Panel */}
                {showAnalytics && analytics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-purple-200">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{analytics.avgConfidence}</div>
                            <div className="text-sm text-gray-600">Confidenza Media</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{analytics.highConfidenceCount}</div>
                            <div className="text-sm text-gray-600">Alta Confidenza</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{analytics.clustersCount}</div>
                            <div className="text-sm text-gray-600">Clusters Semantici</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{analytics.totalKeywordMatches}</div>
                            <div className="text-sm text-gray-600">Keyword Matches</div>
                        </div>
                    </div>
                )}
            </div>

            {/* 🎛️ Controlli e Filtri */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center space-x-4">
                    {/* Filtro Cluster */}
                    <select
                        value={selectedCluster}
                        onChange={(e) => setSelectedCluster(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">Tutti i Clusters</option>
                        {Array.from(clusters.keys()).map(clusterId => (
                            <option key={clusterId} value={clusterId}>
                                Cluster {clusterId} ({clusters.get(clusterId).length})
                            </option>
                        ))}
                    </select>

                    {/* Ordinamento */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="semantic_score">Score Semantico</option>
                        <option value="confidence">Confidenza</option>
                        <option value="relevance">Rilevanza</option>
                    </select>
                </div>

                <div className="text-sm text-gray-600">
                    Mostrando {filteredAndSortedResults.length} di {results.length} risultati
                </div>
            </div>

            {/* 📋 Lista Risultati */}
            <div className="space-y-4">
                {filteredAndSortedResults.map((result, index) => {
                    const isExpanded = expandedResults.has(index);
                    const confidence = result.confidence || result.relevance || 0;
                    
                    return (
                        <div
                            key={index}
                            className="bg-white rounded-xl border-2 border-gray-200 hover:border-purple-300 transition-all duration-300 overflow-hidden group"
                        >
                            {/* Header Risultato */}
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        {/* Badge Confidence */}
                                        <div className={`inline-flex items-center px-3 py-1 rounded-lg border text-sm font-medium ${getConfidenceColor(confidence)}`}>
                                            <StarIcon className="w-4 h-4 mr-1" />
                                            {(confidence * 100).toFixed(0)}%
                                        </div>

                                        {/* Badge Cluster */}
                                        {result.cluster_id !== undefined && (
                                            <div className={`inline-flex items-center px-2 py-1 rounded-lg border text-xs font-medium ${getClusterColor(result.cluster_id)}`}>
                                                <TagIcon className="w-3 h-3 mr-1" />
                                                C{result.cluster_id}
                                            </div>
                                        )}

                                        {/* Badge Search Type */}
                                        {result.search_type && (
                                            <div className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-xs">
                                                <CpuChipIcon className="w-3 h-3 mr-1" />
                                                {result.search_type.replace('_', ' ')}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => toggleExpanded(index)}
                                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    >
                                        {isExpanded ? 
                                            <ChevronUpIcon className="w-5 h-5" /> : 
                                            <ChevronDownIcon className="w-5 h-5" />
                                        }
                                    </button>
                                </div>

                                {/* Testo Principale */}
                                <div className="prose max-w-none">
                                    <div 
                                        className="text-gray-800 leading-relaxed cursor-pointer"
                                        onClick={() => onResultClick && onResultClick(result, index)}
                                        dangerouslySetInnerHTML={{ 
                                            __html: highlightText(
                                                isExpanded ? result.text : (result.text.length > 200 ? result.text.substring(0, 200) + '...' : result.text),
                                                searchQuery,
                                                result.highlight_spans
                                            )
                                        }}
                                    />
                                </div>

                                {/* Keyword Matches */}
                                {result.keyword_matches && result.keyword_matches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {result.keyword_matches.map((match, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-medium"
                                            >
                                                "{match.word}" ({match.count}x)
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Dettagli Espansi */}
                            {isExpanded && (
                                <div className="px-6 pb-6 border-t border-gray-100 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                        {/* Statistiche */}
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                                <ChartBarIcon className="w-4 h-4 mr-2" />
                                                Metriche
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Rilevanza:</span>
                                                    <span className="font-medium">{(result.relevance * 100).toFixed(1)}%</span>
                                                </div>
                                                {result.semantic_score && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Score Semantico:</span>
                                                        <span className="font-medium">{(result.semantic_score * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Posizione:</span>
                                                    <span className="font-medium">{result.start_position}-{result.end_position}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contesto */}
                                        {result.context_snippet && (
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                                                    Contesto
                                                </h4>
                                                <div className="p-3 bg-white rounded-lg border text-sm text-gray-700 leading-relaxed">
                                                    {result.context_snippet}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SmartSearchResults; 