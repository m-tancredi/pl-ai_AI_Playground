import toast from 'react-hot-toast';

export const handleApiError = (error, customMessage = null) => {
  console.error('API Error:', error);

  let message = customMessage || 'Si è verificato un errore';

  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        message = data.detail || data.error || 'Dati non validi';
        break;
      case 401:
        message = 'Accesso non autorizzato';
        break;
      case 403:
        message = 'Permessi insufficienti';
        break;
      case 404:
        message = 'Risorsa non trovata';
        break;
      case 429:
        message = 'Troppo molte richieste. Riprova più tardi';
        break;
      case 500:
        message = 'Errore del server';
        break;
      default:
        message = data.detail || data.error || `Errore ${status}`;
    }

    // Handle field errors
    if (data.errors || data.non_field_errors) {
      const fieldErrors = data.errors || data.non_field_errors;
      message = Object.values(fieldErrors).flat().join(', ');
    }
  } else if (error.request) {
    message = 'Nessuna risposta dal server';
  }

  toast.error(message);
  return message;
};

// Custom hook per error handling
export const useErrorHandler = () => {
  return {
    handleError: handleApiError,
    handleAsyncError: async (asyncFn, errorMsg = null) => {
      try {
        return await asyncFn();
      } catch (error) {
        handleApiError(error, errorMsg);
        throw error;
      }
    }
  };
}; 