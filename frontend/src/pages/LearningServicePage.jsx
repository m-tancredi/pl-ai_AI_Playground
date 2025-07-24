import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import useLearningService from '../hooks/useLearningService';
import LessonsSidebar from '../components/learning/LessonsSidebar';
import LessonContent from '../components/learning/LessonContent';
import LoadingSpinner from '../components/LoadingSpinner';
import UsageWidget from '../components/UsageWidget';
import UsageModal from '../components/UsageModal';
import { getLearningUsage, getLearningOperationDisplayName, getLearningModelDisplayName } from '../services/usageService';

const LearningServicePage = () => {
  // States
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [activeTab, setActiveTab] = useState('lesson');
  
  // Usage tracking states
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const usageWidgetRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');

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

  // Usage tracking handlers
  const handleOpenUsageModal = async () => {
    try {
      const freshData = await getLearningUsage('current_month');
      setUsageData(freshData);
      setShowUsageModal(true);
    } catch (error) {
      console.error('Error fetching usage data:', error);
      setShowUsageModal(true); // Apri comunque il modale
    }
  };

  const handleCloseUsageModal = () => {
    setShowUsageModal(false);
    setUsageData(null);
  };

  // Generate new lesson
  const handleGenerateLesson = async (lessonData) => {
    try {
      const response = await generateLesson(lessonData);
      
      if (response.success && response.lesson) {
        setCurrentLesson(response.lesson);
        setActiveTab('lesson');
        
        // Reload lessons list
        await loadLessons();
        
        // ⚠️ IMPORTANTE: Aggiorna widget consumi dopo generazione
        if (usageWidgetRef.current) {
          try {
            await usageWidgetRef.current.refreshUsage();
          } catch (error) {
            console.error('❌ Errore refresh widget dopo generazione:', error);
          }
        }
        
        toast.success('Lezione generata con successo!');
      } else {
        throw new Error(response.error || 'Errore nella generazione della lezione');
      }
    } catch (error) {
      console.error('Error generating lesson:', error);
      toast.error('Errore nella generazione della lezione');
      
      // ⚠️ Aggiorna anche in caso di errore per mostrare il fallimento
      if (usageWidgetRef.current) {
        try {
          await usageWidgetRef.current.refreshUsage();
        } catch (refreshError) {
          console.error('❌ Errore refresh widget dopo errore generazione:', refreshError);
        }
      }
      
      throw error; // Re-throw to let sidebar handle loading state
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

  if (loading && !currentLesson) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Loading iniziale - mantiene la pagina visibile
  if (loading && lessons.length === 0 && !currentLesson) {
    return (
      <div className="learning-page-container">
        {/* Header sempre visibile */}
        <div className="mb-6 flex justify-between items-center px-4">
          <h1 className="text-2xl font-bold text-gray-800">Learning Service</h1>
          <div className="w-full max-w-xs">
            <UsageWidget 
              ref={usageWidgetRef}
              serviceName="learning"
              serviceDisplayName="Learning"
              getUsageData={getLearningUsage}
              onOpenDetails={handleOpenUsageModal}
            />
          </div>
        </div>
        
        <div className="flex h-auto min-h-[80vh] w-full max-w-full mx-4 my-2 rounded-xl shadow-lg overflow-hidden bg-white">
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-page-container">
      {/* Header con widget consumi */}
      <div className="mb-6 flex justify-between items-center px-4">
        <h1 className="text-2xl font-bold text-gray-800">Learning Service</h1>
        <div className="w-full max-w-xs">
          <UsageWidget 
            ref={usageWidgetRef}
            serviceName="learning"
            serviceDisplayName="Learning"
            getUsageData={getLearningUsage}
            onOpenDetails={handleOpenUsageModal}
          />
        </div>
      </div>

      <div className="flex h-auto min-h-[80vh] w-full max-w-full mx-4 my-2 rounded-xl shadow-lg overflow-hidden bg-white">
        {/* Sidebar */}
        <LessonsSidebar
          lessons={lessons}
          currentLesson={currentLesson}
          onSelectLesson={handleSelectLesson}
          onDeleteLesson={handleDeleteLesson}
          onDeleteAllLessons={handleDeleteAllLessons}
          onGenerateLesson={handleGenerateLesson}
          loading={loading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-start px-6 py-6">

        {/* Lesson Content */}
        {currentLesson ? (
          <LessonContent
            lesson={currentLesson}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLessonUpdate={loadLessonDetails}
            onUsageUpdate={() => {
              if (usageWidgetRef.current) {
                usageWidgetRef.current.refreshUsage();
              }
            }}
            selectedModel={selectedModel}
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
      </main>
      </div>
      
      {/* Modale consumi CON ANTI-FRODE */}
      <UsageModal
        isOpen={showUsageModal}
        onClose={handleCloseUsageModal}
        serviceName="learning"
        serviceDisplayName="Learning Service"
        getUsageData={getLearningUsage}
        customGetOperationDisplayName={getLearningOperationDisplayName}
        customGetModelDisplayName={getLearningModelDisplayName}
      />
    </div>
  );
};

export default LearningServicePage; 