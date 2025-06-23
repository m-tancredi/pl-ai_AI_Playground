import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import useLearningService from '../../hooks/useLearningService';
import LoadingSpinner from '../LoadingSpinner';

const ApprofondimentiSection = ({ approfondimenti, lessonId, onUpdate }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [detailedContent, setDetailedContent] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const { generateDetailedApprofondimento } = useLearningService();

  // Toggle expanded state for an item
  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Generate detailed content for an approfondimento
  const handleGenerateDetails = async (item) => {
    if (detailedContent[item.id]) {
      // Already have detailed content, just expand
      toggleExpanded(item.id);
      return;
    }

    setLoadingDetails(prev => ({ ...prev, [item.id]: true }));
    
    try {
      const response = await generateDetailedApprofondimento(item.id);
      
      if (response.success && response.approfondimento && response.approfondimento.detailed_content) {
        setDetailedContent(prev => ({
          ...prev,
          [item.id]: response.approfondimento.detailed_content
        }));
        setExpandedItems(prev => ({
          ...prev,
          [item.id]: true
        }));
        toast.success('Approfondimento dettagliato generato!');
      } else {
        throw new Error(response.error || 'Errore nella generazione');
      }
    } catch (error) {
      console.error('Error generating detailed approfondimento:', error);
      toast.error('Errore nella generazione dell\approfondimento dettagliato');
    } finally {
      setLoadingDetails(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Approfondimento item component
  const ApprofondimentoItem = ({ item, index }) => {
    const isExpanded = expandedItems[item.id];
    const isLoading = loadingDetails[item.id];
    const hasDetailedContent = detailedContent[item.id];

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-blue-50 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-800 text-sm mb-1">
                  {item.title}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.content}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => handleGenerateDetails(item)}
              disabled={isLoading}
              className="ml-4 flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="small" color="white" />
                  Caricamento...
                </>
              ) : hasDetailedContent ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d={isExpanded 
                      ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                      : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    } clipRule="evenodd" />
                  </svg>
                  {isExpanded ? 'Riduci' : 'Espandi'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Approfondisci
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detailed Content */}
        {isExpanded && hasDetailedContent && (
          <div className="p-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <h5 className="font-medium text-gray-800">Approfondimento dettagliato</h5>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700">
                <div 
                  className="leading-relaxed"
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}
                  dangerouslySetInnerHTML={{ __html: detailedContent[item.id] }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!approfondimenti || approfondimenti.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-6">
        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800">
          Approfondimenti ({approfondimenti.length})
        </h3>
      </div>

      <div className="space-y-4">
        {approfondimenti.map((item, index) => (
          <ApprofondimentoItem 
            key={item.id} 
            item={item} 
            index={index}
          />
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-blue-800 mb-1">
              Come funzionano gli approfondimenti
            </h4>
            <p className="text-blue-700 text-sm leading-relaxed">
              Ogni approfondimento inizialmente mostra un riassunto breve. 
              Clicca su "Approfondisci" per generare contenuto dettagliato 
              tramite intelligenza artificiale basato sul tema della lezione.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprofondimentiSection; 