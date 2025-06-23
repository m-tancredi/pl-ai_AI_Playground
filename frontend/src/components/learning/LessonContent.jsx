import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useLearningService from '../../hooks/useLearningService';
import LoadingSpinner from '../LoadingSpinner';
import QuizSection from './QuizSection';
import ApprofondimentiSection from './ApprofondimentiSection';

const LessonContent = ({ 
  lesson, 
  activeTab, 
  onTabChange, 
  onLessonUpdate 
}) => {
  const [approfondimenti, setApprofondimenti] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingApprofondimenti, setIsGeneratingApprofondimenti] = useState(false);

  const {
    generateQuiz,
    generateApprofondimenti,
    getApprofondimenti,
    loading
  } = useLearningService();

  // Utility function to deduplicate approfondimenti
  const deduplicateApprofondimenti = (items) => {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.id}-${item.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  // Load related data when lesson changes
  useEffect(() => {
    if (lesson) {
      setQuiz(lesson.quizzes?.[0] || null);
      
      // Only update approfondimenti if we don't already have some
      // This prevents overwriting freshly generated approfondimenti
      setApprofondimenti(prev => {
        const lessonApprofondimenti = lesson.approfondimenti || [];
        
        // Merge and deduplicate based on ID
        const combined = [...prev];
        lessonApprofondimenti.forEach(newItem => {
          const exists = combined.find(existing => existing.id === newItem.id);
          if (!exists) {
            combined.push(newItem);
          }
        });
        
        // Apply deduplication and return the result
        const finalList = lessonApprofondimenti.length > prev.length ? lessonApprofondimenti : combined;
        return deduplicateApprofondimenti(finalList);
      });
    }
  }, [lesson]);

  // Generate quiz for the lesson
  const handleGenerateQuiz = async () => {
    if (!lesson) return;

    setIsGeneratingQuiz(true);
    try {
      const response = await generateQuiz(lesson.id, {
        num_questions: 5,
        include_approfondimenti: approfondimenti.length > 0
      });

      if (response.success && response.quiz) {
        setQuiz(response.quiz);
        onTabChange('quiz');
        toast.success('Quiz generato con successo!');
      } else {
        throw new Error(response.error || 'Errore nella generazione del quiz');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error('Errore nella generazione del quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Generate approfondimenti for the lesson
  const handleGenerateApprofondimenti = async () => {
    if (!lesson) return;

    setIsGeneratingApprofondimenti(true);
    try {
      const response = await generateApprofondimenti(lesson.id, {
        max_items: 4
      });

      if (response.success && response.approfondimenti) {
        console.log('Approfondimenti generati:', response.approfondimenti);
        
        // Deduplicate approfondimenti by ID and title
        setApprofondimenti(prev => {
          const combined = [...prev];
          response.approfondimenti.forEach(newItem => {
            const existsById = combined.find(existing => existing.id === newItem.id);
            const existsByTitle = combined.find(existing => existing.title === newItem.title);
            if (!existsById && !existsByTitle) {
              combined.push(newItem);
            }
          });
          return deduplicateApprofondimenti(combined);
        });
        
        toast.success('Approfondimenti generati con successo!');
        
        // Ricarica la lezione per aggiornare i dati dal backend (con un piccolo delay)
        if (onLessonUpdate) {
          setTimeout(() => {
            onLessonUpdate(lesson.id);
          }, 1000);
        }
      } else {
        throw new Error(response.error || 'Errore nella generazione degli approfondimenti');
      }
    } catch (error) {
      console.error('Error generating approfondimenti:', error);
      toast.error('Errore nella generazione degli approfondimenti');
    } finally {
      setIsGeneratingApprofondimenti(false);
    }
  };

  // Tab component
  const Tab = ({ id, label, active, onClick, disabled = false }) => (
    <button
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      className={`
        px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
        ${active 
          ? 'text-[#ff1649] border-[#ff1649] bg-white' 
          : disabled
            ? 'text-gray-400 border-transparent bg-gray-100 cursor-not-allowed'
            : 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
        }
      `}
    >
      {label}
    </button>
  );

  if (!lesson) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 mt-4">
      {/* Tabs Header */}
      <div className="border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex space-x-1 p-2">
          <Tab
            id="lesson"
            label="Lezione"
            active={activeTab === 'lesson'}
            onClick={onTabChange}
          />
          <Tab
            id="quiz"
            label={quiz ? 'Quiz' : 'Quiz (da generare)'}
            active={activeTab === 'quiz'}
            onClick={onTabChange}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'lesson' && (
          <div className="h-full overflow-y-auto p-6">
            {/* Lesson Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {lesson.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  Creata: {new Date(lesson.created_at).toLocaleDateString('it-IT')}
                </span>
                <span className={`
                  px-2 py-1 rounded-full text-xs font-medium
                  ${lesson.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-orange-100 text-orange-800'
                  }
                `}>
                  {lesson.status === 'completed' ? 'Completata' : 'In corso'}
                </span>
              </div>
            </div>

            {/* Lesson Content */}
            <div className="prose max-w-none mb-8">
              <div className="bg-gray-50 p-6 rounded-lg border">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {lesson.content}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              {!quiz && (
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className="bg-[#ff1649] hover:bg-[#e01440] disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  {isGeneratingQuiz ? (
                    <>
                      <LoadingSpinner size="small" color="white" />
                      Generazione quiz...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Genera Quiz
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleGenerateApprofondimenti}
                disabled={isGeneratingApprofondimenti}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                {isGeneratingApprofondimenti ? (
                  <>
                    <LoadingSpinner size="small" color="white" />
                    Generazione...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                    </svg>
                    {approfondimenti.length > 0 ? 'Rigenera Approfondimenti' : 'Genera Approfondimenti'}
                  </>
                )}
              </button>
            </div>

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <strong>Debug:</strong> Approfondimenti count: {approfondimenti.length} | 
                Lesson approfondimenti: {lesson.approfondimenti?.length || 0}
              </div>
            )}

            {/* Approfondimenti Section */}
            {approfondimenti.length > 0 && (
              <ApprofondimentiSection 
                approfondimenti={approfondimenti}
                lessonId={lesson.id}
                onUpdate={setApprofondimenti}
              />
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="h-full overflow-y-auto">
            {quiz ? (
              <QuizSection 
                quiz={quiz}
                lesson={lesson}
                onComplete={() => {
                  // Update lesson status
                  onLessonUpdate(lesson.id);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Nessun quiz disponibile
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Genera un quiz per questa lezione per iniziare il test
                  </p>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="bg-[#ff1649] hover:bg-[#e01440] disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <LoadingSpinner size="small" color="white" />
                        Generazione in corso...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        Genera Quiz
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonContent; 