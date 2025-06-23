import { useState, useCallback } from 'react';
import learningService from '../services/learningService';
import { useErrorHandler } from '../utils/errorHandler';

const useLearningService = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { handleError } = useErrorHandler();

  const handleRequest = useCallback(async (requestFn, errorMsg = null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestFn();
      return result;
    } catch (err) {
      const errorMessage = handleError(err, errorMsg);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Lessons operations
  const getLessons = useCallback((params) => 
    handleRequest(() => learningService.getLessons(params), 'Errore nel caricamento delle lezioni')
  , [handleRequest]);

  const getLessonById = useCallback((id) => 
    handleRequest(() => learningService.getLessonById(id), 'Errore nel caricamento della lezione')
  , [handleRequest]);

  const getLessonWithRelated = useCallback((id) => 
    handleRequest(() => learningService.getLessonWithRelated(id), 'Errore nel caricamento dei dettagli della lezione')
  , [handleRequest]);

  const generateLesson = useCallback((data) => 
    handleRequest(() => learningService.generateLesson(data), 'Errore nella generazione della lezione')
  , [handleRequest]);

  const updateLesson = useCallback((id, data) => 
    handleRequest(() => learningService.updateLesson(id, data), 'Errore nell\'aggiornamento della lezione')
  , [handleRequest]);

  const deleteLesson = useCallback((id) => 
    handleRequest(() => learningService.deleteLesson(id), 'Errore nell\'eliminazione della lezione')
  , [handleRequest]);

  const searchLessons = useCallback((query) => 
    handleRequest(() => learningService.searchLessons(query), 'Errore nella ricerca delle lezioni')
  , [handleRequest]);

  // Quiz operations
  const generateQuiz = useCallback((lessonId, data) => 
    handleRequest(() => learningService.generateQuiz(lessonId, data), 'Errore nella generazione del quiz')
  , [handleRequest]);

  const submitQuizAnswer = useCallback((answerData) => 
    handleRequest(() => learningService.submitQuizAnswer(answerData), 'Errore nell\'invio della risposta')
  , [handleRequest]);

  // Approfondimenti operations
  const generateApprofondimenti = useCallback((lessonId, data) => 
    handleRequest(() => learningService.generateApprofondimenti(lessonId, data), 'Errore nella generazione degli approfondimenti')
  , [handleRequest]);

  const generateDetailedApprofondimento = useCallback((approfondimentoId) => 
    handleRequest(() => learningService.generateDetailedApprofondimento(approfondimentoId), 'Errore nella generazione dell\'approfondimento dettagliato')
  , [handleRequest]);

  const getApprofondimenti = useCallback((lessonId) => 
    handleRequest(() => learningService.getApprofondimenti(lessonId), 'Errore nel caricamento degli approfondimenti')
  , [handleRequest]);

  // Progress operations
  const getUserProgress = useCallback(() => 
    handleRequest(() => learningService.getUserProgress(), 'Errore nel caricamento del progresso')
  , [handleRequest]);

  const getUserStats = useCallback(() => 
    handleRequest(() => learningService.getUserStats(), 'Errore nel caricamento delle statistiche')
  , [handleRequest]);

  // Clear error utility
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,
    
    // Lessons
    getLessons,
    getLessonById,
    getLessonWithRelated,
    generateLesson,
    updateLesson,
    deleteLesson,
    searchLessons,
    
    // Quiz
    generateQuiz,
    submitQuizAnswer,
    
    // Approfondimenti
    generateApprofondimenti,
    generateDetailedApprofondimento,
    getApprofondimenti,
    
    // Progress
    getUserProgress,
    getUserStats,
    
    // Utilities
    clearError
  };
};

export default useLearningService; 