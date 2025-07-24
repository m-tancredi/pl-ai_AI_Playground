import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';

const LessonsSidebar = ({
  lessons,
  currentLesson,
  onSelectLesson,
  onDeleteLesson,
  onDeleteAllLessons,
  onGenerateLesson,
  loading,
  selectedModel,
  onModelChange
}) => {
  const [selectedLessons, setSelectedLessons] = useState(new Set());
  const [isExportingBulk, setIsExportingBulk] = useState(false);
  const [showSelectionMode, setShowSelectionMode] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [lessonDepthLevel, setLessonDepthLevel] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setShowSelectionMode(!showSelectionMode);
    setSelectedLessons(new Set());
  };

  // Handle lesson selection
  const toggleLessonSelection = (lessonId) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(lessonId)) {
      newSelected.delete(lessonId);
    } else {
      newSelected.add(lessonId);
    }
    setSelectedLessons(newSelected);
  };

  // Select all lessons
  const selectAllLessons = () => {
    setSelectedLessons(new Set(lessons.map(l => l.id)));
  };

  // Deselect all lessons
  const deselectAllLessons = () => {
    setSelectedLessons(new Set());
  };

  // Export selected lessons as PDF
  const handleExportSelectedPDF = async () => {
    if (selectedLessons.size === 0) {
      toast.error('Seleziona almeno una lezione per l\'export');
      return;
    }

    setIsExportingBulk(true);
    try {
      const response = await fetch('/api/learning/lessons/export/bulk-pdf/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lesson_ids: Array.from(selectedLessons),
          filename_prefix: 'lezioni_selezionate'
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nel download del PDF');
      }

      // Download del file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nome file dal header o fallback
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `lezioni_selezionate_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`PDF con ${selectedLessons.size} lezioni scaricato con successo!`);
      
      // Reset selection
      setSelectedLessons(new Set());
      setShowSelectionMode(false);
    } catch (error) {
      console.error('Error exporting bulk PDF:', error);
      toast.error('Errore nel download del PDF');
    } finally {
      setIsExportingBulk(false);
    }
  };

  // Handle lesson generation
  const handleGenerateLesson = async () => {
    if (!topicInput.trim()) {
      toast.error('Inserisci un argomento per la lezione');
      return;
    }

    setIsGenerating(true);
    
    try {
      await onGenerateLesson({ 
        topic: topicInput.trim(),
        depth_level: lessonDepthLevel,
        model: selectedModel
      });
      
      // Reset form
      setTopicInput('');
      setLessonDepthLevel(3);
      setShowGenerateForm(false);
      
    } catch (error) {
      console.error('Error generating lesson:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Enter key in topic input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleGenerateLesson();
    }
  };

  // Status icon component
  const StatusIcon = ({ status }) => {
    if (status === 'completed') {
      return (
        <div className="w-3 h-3 bg-green-500 rounded-full" title="Completata" />
      );
    }
    return (
      <div className="w-3 h-3 bg-orange-500 rounded-full" title="In corso" />
    );
  };

  // Delete button component
  const DeleteButton = ({ onClick, title = "Elimina" }) => (
    <button
      onClick={onClick}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
      title={title}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </button>
  );

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        {/* Generate Lesson Button */}
        {!showGenerateForm ? (
          <button
            onClick={() => setShowGenerateForm(true)}
            disabled={showSelectionMode}
            className="w-full mb-4 bg-[#ff1649] hover:bg-[#e01440] disabled:bg-gray-400 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            Genera Nuova Lezione
          </button>
        ) : (
          /* Generate Form */
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-blue-800">🎓 Nuova Lezione</h3>
              <button
                onClick={() => {
                  setShowGenerateForm(false);
                  setTopicInput('');
                  setLessonDepthLevel(3);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                ✕
              </button>
            </div>
            
            {/* Topic Input */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Argomento
              </label>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Es: La fotosintesi clorofilliana"
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGenerating}
              />
            </div>

            {/* Depth Level */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-blue-700 mb-2">
                📊 Livello: <span className="font-bold">{lessonDepthLevel}/5</span>
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-600">Base</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={lessonDepthLevel}
                  onChange={(e) => setLessonDepthLevel(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  disabled={isGenerating}
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(lessonDepthLevel-1) * 25}%, #bfdbfe ${(lessonDepthLevel-1) * 25}%, #bfdbfe 100%)`
                  }}
                />
                <span className="text-xs text-blue-600">Avanzato</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {lessonDepthLevel === 1 && "📋 Panoramica generale"}
                {lessonDepthLevel === 2 && "📖 Introduzione semplice"}
                {lessonDepthLevel === 3 && "⚖️ Spiegazione bilanciata"}
                {lessonDepthLevel === 4 && "🔬 Analisi approfondita"}
                {lessonDepthLevel === 5 && "🎓 Trattazione specialistica"}
              </p>
            </div>

            {/* Model Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-blue-700 mb-2">
                🤖 Modello AI
              </label>
              <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGenerating}
              >
                <option value="gpt4o-mini">GPT-4o Mini (💰 Più Economico)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (💸 Economico)</option>
                <option value="gpt4o">GPT-4o (⭐ Bilanciato)</option>
                <option value="gpt4">GPT-4 (🚀 Premium - Più Potente)</option>
              </select>
              <p className="text-xs text-blue-600 mt-1">
                {selectedModel === 'gpt4o-mini' && "⚡ Veloce ed economico"}
                {selectedModel === 'gpt-3.5-turbo' && "📈 Ottimo rapporto qualità-prezzo"}
                {selectedModel === 'gpt4o' && "🎯 Bilanciato per tutte le esigenze"}
                {selectedModel === 'gpt4' && "🏆 Massima qualità e precisione"}
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateLesson}
              disabled={isGenerating || !topicInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {isGenerating ? (
                <>
                  <LoadingSpinner size="small" color="white" />
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Genera Lezione
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Lezioni salvate
          </h2>
          {lessons.length > 0 && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {lessons.length}
            </span>
          )}
        </div>
        
        {/* Action Buttons */}
        {lessons.length > 0 && !showGenerateForm && (
          <div className="mt-3 space-y-2">
            {!showSelectionMode ? (
              <>
                {/* Export Multiple Button */}
                <button
                  onClick={toggleSelectionMode}
                  className="w-full text-sm text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-2 rounded-md border border-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Scarica PDF Multiple
                </button>
                
                {/* Delete All Button */}
                <button
                  onClick={onDeleteAllLessons}
                  className="w-full text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-md border border-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Elimina tutte
                </button>
              </>
            ) : (
              <>
                {/* Selection Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={selectAllLessons}
                    className="flex-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                  >
                    Seleziona tutto
                  </button>
                  <button
                    onClick={deselectAllLessons}
                    className="flex-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-2 py-1 rounded border border-gray-200 transition-colors"
                  >
                    Deseleziona
                  </button>
                </div>
                
                {/* Export Selected Button */}
                <button
                  onClick={handleExportSelectedPDF}
                  disabled={selectedLessons.size === 0 || isExportingBulk}
                  className="w-full text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 px-3 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isExportingBulk ? (
                    <>
                      <LoadingSpinner size="small" color="white" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Scarica PDF ({selectedLessons.size})
                    </>
                  )}
                </button>
                
                {/* Cancel Selection */}
                <button
                  onClick={toggleSelectionMode}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-2 rounded-md border border-gray-200 transition-colors"
                >
                  Annulla
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && lessons.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="medium" text="Caricamento lezioni..." />
          </div>
        ) : lessons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">Nessuna lezione salvata</p>
            <p className="text-sm text-gray-500">
              Genera la tua prima lezione per iniziare!
            </p>
          </div>
        ) : (
          <div className="p-2">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className={`
                  group relative mb-2 p-3 rounded-lg border transition-all
                  ${currentLesson && currentLesson.id === lesson.id && !showSelectionMode
                    ? 'bg-[#ff1649] text-white border-[#ff1649] shadow-md'
                    : selectedLessons.has(lesson.id)
                    ? 'bg-green-50 border-green-300 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                  }
                  ${showSelectionMode ? 'cursor-pointer' : 'cursor-pointer'}
                `}
                onClick={() => showSelectionMode ? toggleLessonSelection(lesson.id) : onSelectLesson(lesson)}
              >
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  {showSelectionMode && (
                    <div className="flex-shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={selectedLessons.has(lesson.id)}
                        onChange={() => toggleLessonSelection(lesson.id)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <StatusIcon status={lesson.status} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`
                      font-medium text-sm line-clamp-2 mb-1
                      ${currentLesson && currentLesson.id === lesson.id
                        ? 'text-white'
                        : 'text-gray-800'
                      }
                    `}>
                      {lesson.title}
                    </h3>
                    
                    {/* Metadata */}
                    <div className={`
                      flex items-center gap-3 text-xs
                      ${currentLesson && currentLesson.id === lesson.id
                        ? 'text-white/80'
                        : 'text-gray-500'
                      }
                    `}>
                      <span>
                        {new Date(lesson.created_at).toLocaleDateString('it-IT')}
                      </span>
                      {lesson.quiz_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Quiz
                        </span>
                      )}
                      {lesson.approfondimenti_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                          </svg>
                          {lesson.approfondimenti_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <div 
                    className={`
                      flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                      ${currentLesson && currentLesson.id === lesson.id ? 'opacity-100' : ''}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLesson(lesson.id, lesson.title);
                    }}
                  >
                    <DeleteButton />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {lessons.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {lessons.filter(l => l.status === 'completed').length} completate
            </span>
            <span>
              {lessons.filter(l => l.status === 'in_progress').length} in corso
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LessonsSidebar; 