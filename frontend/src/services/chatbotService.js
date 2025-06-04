import apiClient from './apiClient';

const API_CHATBOT_URL = '/api/chatbot'; // Prefisso API come definito in Nginx

/**
 * Invia un messaggio al chatbot.
 * @param {object} payload - { message, context, chatId? }
 * @returns {Promise<object>} Promise che risolve con { response, chatId, token_info? }
 */
export const sendMessage = async (payload) => {
    try {
        const response = await apiClient.post(`${API_CHATBOT_URL}/chat/`, payload);
        return response.data;
    } catch (error) {
        console.error("API Error sending message:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Recupera la cronologia delle chat dell'utente.
 * @returns {Promise<Array>} Promise che risolve con l'array delle chat
 */
export const getChatHistory = async () => {
    try {
        const response = await apiClient.get(`${API_CHATBOT_URL}/chat-history/`);
        return response.data;
    } catch (error) {
        console.error("API Error getting chat history:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Recupera i dettagli di una chat specifica.
 * @param {string|number} chatId - L'ID della chat
 * @returns {Promise<object>} Promise che risolve con i dettagli della chat
 */
export const getChatDetail = async (chatId) => {
    try {
        const response = await apiClient.get(`${API_CHATBOT_URL}/chat/${chatId}/`);
        return response.data;
    } catch (error) {
        console.error("API Error getting chat detail:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Cancella una chat specifica.
 * @param {string|number} chatId - L'ID della chat da cancellare
 * @returns {Promise<object>} Promise che risolve con il risultato dell'operazione
 */
export const deleteChat = async (chatId) => {
    try {
        const response = await apiClient.delete(`${API_CHATBOT_URL}/chat/${chatId}/`);
        return response.data;
    } catch (error) {
        console.error("API Error deleting chat:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Cancella tutte le chat dell'utente.
 * @returns {Promise<object>} Promise che risolve con il risultato dell'operazione
 */
export const deleteAllChats = async () => {
    try {
        const response = await apiClient.delete(`${API_CHATBOT_URL}/chats/`);
        return response.data;
    } catch (error) {
        console.error("API Error deleting all chats:", error.response?.data || error.message);
        throw error;
    }
}; 