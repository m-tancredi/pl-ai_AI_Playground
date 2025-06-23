import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import useLearningService from '../hooks/useLearningService';
import LessonsSidebar from '../components/learning/LessonsSidebar';
import LessonContent from '../components/learning/LessonContent';
import LoadingSpinner from '../components/LoadingSpinner';

const LearningServicePage = () => {
  // States
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('lesson');

  // Learning service hook
  const {
    loading,
    error,
    getLessons,
    getLessonWithRelated,
    generateLesson,
    deleteLesson,
    clearError
  } = useLearningService();

  // Load lessons on mount
  useEffect(() => {
    loadLessons();
  }, []);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Load lessons list
  const loadLessons = useCallback(async () => {
    try {
      const response = await getLessons();
      setLessons(response.results || response);
    } catch (error) {
      console.error('Error loading lessons:', error);
    }
  }, [getLessons]);

  // Load lesson details
  const loadLessonDetails = useCallback(async (lessonId) => {
    try {
      const lessonData = await getLessonWithRelated(lessonId);
      setCurrentLesson(lessonData);
      setActiveTab('lesson'); // Reset to lesson tab
    } catch (error) {
      console.error('Error loading lesson details:', error);
      toast.error('Errore nel caricamento della lezione');
    }
  }, [getLessonWithRelated]);

  // Generate new lesson
  const handleGenerateLesson = async () => {
    if (!topicInput.trim()) {
      toast.error('Inserisci un argomento per la lezione');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await generateLesson({ topic: topicInput.trim() });
      
      if (response.success && response.lesson) {
        setCurrentLesson(response.lesson);
        setTopicInput('');
        setActiveTab('lesson');
        
        // Reload lessons list
        await loadLessons();
        
        toast.success('Lezione generata con successo!');
      } else {
        throw new Error(response.error || 'Errore nella generazione della lezione');
      }
    } catch (error) {
      console.error('Error generating lesson:', error);
      toast.error('Errore nella generazione della lezione');
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete lesson
  const handleDeleteLesson = async (lessonId, lessonTitle) => {
    if (!window.confirm(`Sei sicuro di voler eliminare la lezione "${lessonTitle}"?`)) {
      return;
    }

    try {
      await deleteLesson(lessonId);
      
      // Remove from lessons list
      setLessons(prev => prev.filter(lesson => lesson.id !== lessonId));
      
      // Clear current lesson if it was deleted
      if (currentLesson && currentLesson.id === lessonId) {
        setCurrentLesson(null);
      }
      
      toast.success('Lezione eliminata con successo');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Errore nell\'eliminazione della lezione');
    }
  };

  // Delete all lessons
  const handleDeleteAllLessons = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare tutte le lezioni? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      // Delete all lessons individually (since we don't have a bulk delete endpoint)
      await Promise.all(lessons.map(lesson => deleteLesson(lesson.id)));
      
      setLessons([]);
      setCurrentLesson(null);
      
      toast.success('Tutte le lezioni sono state eliminate');
    } catch (error) {
      console.error('Error deleting all lessons:', error);
      toast.error('Errore nell\'eliminazione delle lezioni');
    }
  };

  // Select lesson
  const handleSelectLesson = (lesson) => {
    loadLessonDetails(lesson.id);
  };

  // Handle Enter key in topic input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleGenerateLesson();
    }
  };

  if (loading && !isGenerating && !currentLesson) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="learning-page-container flex h-auto min-h-[80vh] w-full max-w-full mx-4 my-8 rounded-xl shadow-lg overflow-hidden bg-white">
      {/* Sidebar */}
      <LessonsSidebar
        lessons={lessons}
        currentLesson={currentLesson}
        onSelectLesson={handleSelectLesson}
        onDeleteLesson={handleDeleteLesson}
        onDeleteAllLessons={handleDeleteAllLessons}
        loading={loading}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-start px-6">
        {/* Topic Input Section */}
        <div className="w-full mt-4 mb-2">
          <label 
            htmlFor="topic-input" 
            className="block text-lg font-medium text-gray-700 mb-2 text-left"
          >
            Scrivi un argomento per generare una mini-lezione
          </label>
          <div className="flex gap-1 items-center">
            <input
              id="topic-input"
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Es: La fotosintesi clorofilliana"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-[#ff1649] text-lg shadow-sm"
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerateLesson}
              disabled={isGenerating || !topicInput.trim()}
              className="bg-[#ff1649] hover:bg-[#e01440] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-r-lg px-5 py-3 flex items-center gap-2 transition-all shadow-md"
            >
              <span className="font-medium">
                {isGenerating ? 'Generazione...' : 'Genera'}
              </span>
              {isGenerating ? (
                <LoadingSpinner size="small" color="white" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Lesson Content */}
        {currentLesson ? (
          <LessonContent
            lesson={currentLesson}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLessonUpdate={loadLessonDetails}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Nessuna lezione selezionata
              </h3>
              <p className="text-gray-500 mb-4">
                Seleziona una lezione dalla sidebar o genera una nuova lezione
              </p>
            </div>
          </div>
        )}

        {/* Loading Message */}
        {isGenerating && (
          <div className="mt-8 text-center text-base text-[#ff1649]">
            <div className="flex items-center justify-center gap-2">
              <LoadingSpinner size="small" color="#ff1649" />
              <span>Generazione in corso, attendi...</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LearningServicePage; 