import apiClient from './apiClient';

/**
 * Ottiene i dati di consumo dell'utente
 * @param {string} period - Periodo da filtrare ('today', 'current_month', 'all_time')
 * @param {number} limit - Limite per i record recenti
 * @returns {Promise<object>} Promise che risolve con i dati di consumo
 */
export const getUserUsage = async (period = 'current_month', limit = 50) => {
    try {
        const response = await apiClient.get('/api/images/usage/', {
            params: {
                period,
                limit
            }
        });
        return response.data;
    } catch (error) {
        console.error("API Error fetching usage data:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Formatta i costi per la visualizzazione
 * @param {number} amount - Importo da formattare
 * @param {string} currency - Valuta ('USD' o 'EUR')
 * @returns {string} Importo formattato
 */
export const formatCurrency = (amount, currency = 'USD') => {
    const locale = currency === 'EUR' ? 'it-IT' : 'en-US';
    const currencySymbol = currency === 'EUR' ? 'EUR' : 'USD';
    
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencySymbol,
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    }).format(amount);
};

/**
 * Formatta i numeri per la visualizzazione
 * @param {number} number - Numero da formattare
 * @returns {string} Numero formattato
 */
export const formatNumber = (number) => {
    return new Intl.NumberFormat('it-IT').format(number);
};

/**
 * Ottiene i dati di consumo del servizio di analisi dati
 * @param {string} period - Periodo da filtrare ('today', 'current_month', 'all_time', 'last_30_days')
 * @param {number} limit - Limite per i record recenti
 * @returns {Promise<object>} Promise che risolve con i dati di consumo
 */
export const getAnalysisUsage = async (period = 'current_month', limit = 50) => {
    try {
        const response = await apiClient.get('/api/analysis/usage/', {
            params: {
                period,
                limit
            }
        });
        return response.data;
    } catch (error) {
        console.error("API Error fetching analysis usage data:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene i dati di consumo del chatbot service
 * @param {string} period - Periodo da filtrare ('current_month', 'last_30_days', 'all_time')
 * @param {number} limit - Limite per i record recenti
 * @returns {Promise<object>} Promise che risolve con i dati di consumo
 */
export const getChatbotUsage = async (period = 'current_month', limit = 50) => {
    try {
        const response = await apiClient.get('/api/chatbot/usage/', {
            params: {
                service: 'chatbot',
                period,
                limit
            }
        });
        return response.data;
    } catch (error) {
        console.error("API Error fetching chatbot usage data:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ottiene i nomi display per i tipi di operazione del servizio di analisi
 * @param {string} operationType - Tipo di operazione
 * @returns {string} Nome display
 */
export const getAnalysisOperationDisplayName = (operationType) => {
    const operationNames = {
        'algorithm-suggestion': 'Suggerimento Algoritmo',
        'data-analysis': 'Analisi Dati',
        'instance-prediction': 'Predizione Istanza',
        'synthetic-dataset': 'Dataset Sintetico'
    };
    return operationNames[operationType] || operationType;
};

/**
 * Ottiene i nomi display per i modelli del servizio di analisi
 * @param {string} modelName - Nome del modello
 * @returns {string} Nome display
 */
export const getAnalysisModelDisplayName = (modelName) => {
    const modelNames = {
        'gpt-4': 'GPT-4',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'custom-ml': 'Modello ML Custom',
        'scikit-learn': 'Scikit-learn'
    };
    return modelNames[modelName] || modelName;
};

/**
 * Ottiene i nomi display per i tipi di operazione del chatbot
 * @param {string} operationType - Tipo di operazione
 * @returns {string} Nome display
 */
export const getChatbotOperationDisplayName = (operationType) => {
    const operationNames = {
        'conversation': 'Conversazione',
        'system_message': 'Messaggio Sistema',
        'interview': 'Intervista',
        'interrogation': 'Interrogazione'
    };
    return operationNames[operationType] || operationType;
};

/**
 * Ottiene i nomi display per i modelli del chatbot
 * @param {string} modelName - Nome del modello
 * @returns {string} Nome display
 */
export const getChatbotModelDisplayName = (modelName) => {
    const modelNames = {
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-4': 'GPT-4',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'gemini-1.5-pro-001': 'Gemini 1.5 Pro',
        'system-response': 'Sistema',
        'unknown': 'Sconosciuto'
    };
    return modelNames[modelName] || modelName;
};

/**
 * Ottiene il nome completo del modello
 * @param {string} modelKey - Chiave del modello
 * @returns {string} Nome completo del modello
 */
export const getModelDisplayName = (modelKey) => {
    const modelNames = {
        'dalle-2': 'DALL-E 2',
        'dalle-3': 'DALL-E 3',
        'dalle-3-hd': 'DALL-E 3 HD',
        'gpt-image-1': 'GPT-Image-1',
        'gpt-4': 'GPT-4',
        'stability': 'Stability AI'
    };
    return modelNames[modelKey] || modelKey;
};

/**
 * Ottiene il nome completo del tipo di operazione
 * @param {string} operationType - Tipo di operazione
 * @returns {string} Nome completo dell'operazione
 */
export const getOperationDisplayName = (operationType) => {
    const operationNames = {
        'text-to-image': 'Text to Image',
        'image-to-image': 'Image to Image',
        'prompt-enhancement': 'Prompt Enhancement'
    };
    return operationNames[operationType] || operationType;
}; 