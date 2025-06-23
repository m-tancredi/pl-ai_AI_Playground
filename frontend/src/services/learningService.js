import apiClient from './apiClient';

// Configurazione endpoint per learning service
const LEARNING_ENDPOINTS = {
  base: '/api/learning-service',
  lessons: '/api/learning-service/lessons/',
  lessonDetail: '/api/learning-service/lessons/{id}/',
  generateLesson: '/api/learning-service/lessons/generate/',
  generateQuiz: '/api/learning-service/lessons/{id}/generate_quiz/',
  generateApprofondimenti: '/api/learning-service/lessons/{id}/generate_approfondimenti/',
  quizAnswers: '/api/learning-service/quiz-answers/',
  submitAnswer: '/api/learning-service/quiz-answers/submit_answer/',
  approfondimenti: '/api/learning-service/approfondimenti/',
  generateDetailedApprofondimento: '/api/learning-service/approfondimenti/{id}/generate_detailed/',
  progress: '/api/learning-service/progress/my_progress/',
  stats: '/api/learning-service/progress/stats/',
};

// CRUD Operations per Lezioni
export const learningService = {
  
  // GET Lista lezioni
  getLessons: async (params = {}) => {
    try {
      const response = await apiClient.get(LEARNING_ENDPOINTS.lessons, { params });
      return response.data;
    } catch (error) {
      console.error('Get lessons failed:', error);
      throw error;
    }
  },

  // GET Singola lezione con dettagli
  getLessonById: async (id) => {
    try {
      const response = await apiClient.get(
        LEARNING_ENDPOINTS.lessonDetail.replace('{id}', id)
      );
      return response.data;
    } catch (error) {
      console.error('Get lesson by ID failed:', error);
      throw error;
    }
  },

  // GET Lezione con quiz e approfondimenti
  getLessonWithRelated: async (id) => {
    try {
      const response = await apiClient.get(
        `${LEARNING_ENDPOINTS.lessonDetail.replace('{id}', id)}with_related/`
      );
      return response.data;
    } catch (error) {
      console.error('Get lesson with related failed:', error);
      throw error;
    }
  },

  // POST Genera nuova lezione
  generateLesson: async (data) => {
    try {
      const response = await apiClient.post(LEARNING_ENDPOINTS.generateLesson, data);
      return response.data;
    } catch (error) {
      console.error('Generate lesson failed:', error);
      throw error;
    }
  },

  // PUT/PATCH Aggiorna lezione
  updateLesson: async (id, data, partial = true) => {
    try {
      const method = partial ? 'patch' : 'put';
      const response = await apiClient[method](
        LEARNING_ENDPOINTS.lessonDetail.replace('{id}', id),
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update lesson failed:', error);
      throw error;
    }
  },

  // DELETE Elimina lezione
  deleteLesson: async (id) => {
    try {
      await apiClient.delete(LEARNING_ENDPOINTS.lessonDetail.replace('{id}', id));
      return true;
    } catch (error) {
      console.error('Delete lesson failed:', error);
      throw error;
    }
  },

  // POST Genera quiz per lezione
  generateQuiz: async (lessonId, data = {}) => {
    try {
      const response = await apiClient.post(
        LEARNING_ENDPOINTS.generateQuiz.replace('{id}', lessonId),
        { lesson_id: lessonId, ...data }
      );
      return response.data;
    } catch (error) {
      console.error('Generate quiz failed:', error);
      throw error;
    }
  },

  // POST Genera approfondimenti per lezione
  generateApprofondimenti: async (lessonId, data = {}) => {
    try {
      const response = await apiClient.post(
        LEARNING_ENDPOINTS.generateApprofondimenti.replace('{id}', lessonId),
        { lesson_id: lessonId, ...data }
      );
      return response.data;
    } catch (error) {
      console.error('Generate approfondimenti failed:', error);
      throw error;
    }
  },

  // POST Genera approfondimento dettagliato
  generateDetailedApprofondimento: async (approfondimentoId) => {
    try {
      const response = await apiClient.post(
        LEARNING_ENDPOINTS.generateDetailedApprofondimento.replace('{id}', approfondimentoId)
      );
      return response.data;
    } catch (error) {
      console.error('Generate detailed approfondimento failed:', error);
      throw error;
    }
  },

  // POST Invia risposta al quiz
  submitQuizAnswer: async (answerData) => {
    try {
      const response = await apiClient.post(
        LEARNING_ENDPOINTS.submitAnswer,
        answerData
      );
      return response.data;
    } catch (error) {
      console.error('Submit answer failed:', error);
      throw error;
    }
  },

  // GET Progresso utente
  getUserProgress: async () => {
    try {
      const response = await apiClient.get(LEARNING_ENDPOINTS.progress);
      return response.data;
    } catch (error) {
      console.error('Get user progress failed:', error);
      throw error;
    }
  },

  // GET Statistiche utente
  getUserStats: async () => {
    try {
      const response = await apiClient.get(LEARNING_ENDPOINTS.stats);
      return response.data;
    } catch (error) {
      console.error('Get user stats failed:', error);
      throw error;
    }
  },

  // GET Ricerca lezioni
  searchLessons: async (query) => {
    try {
      const response = await apiClient.get(
        `${LEARNING_ENDPOINTS.lessons}search/?q=${encodeURIComponent(query)}`
      );
      return response.data;
    } catch (error) {
      console.error('Search lessons failed:', error);
      throw error;
    }
  },

  // GET Lista approfondimenti
  getApprofondimenti: async (lessonId) => {
    try {
      const response = await apiClient.get(
        `${LEARNING_ENDPOINTS.approfondimenti}?lesson=${lessonId}`
      );
      return response.data;
    } catch (error) {
      console.error('Get approfondimenti failed:', error);
      throw error;
    }
  }
};

export default learningService; 