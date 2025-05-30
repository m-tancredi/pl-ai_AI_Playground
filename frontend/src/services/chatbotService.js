import axios from 'axios';

const API_BASE = '/api/chatbot';

// Helper per ottenere il token JWT (adatta se usi altro metodo)
function getAuthHeaders() {
  const token = localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- PROFILI CHATBOT ---
export async function fetchChatbotProfiles() {
  const res = await axios.get(`${API_BASE}/profiles/`, { headers: getAuthHeaders() });
  return res.data;
}

export async function createChatbotProfile(data) {
  const res = await axios.post(`${API_BASE}/profiles/`, data, { headers: getAuthHeaders() });
  return res.data;
}

export async function updateChatbotProfile(id, data) {
  const res = await axios.patch(`${API_BASE}/profiles/${id}/`, data, { headers: getAuthHeaders() });
  return res.data;
}

export async function deleteChatbotProfile(id) {
  await axios.delete(`${API_BASE}/profiles/${id}/`, { headers: getAuthHeaders() });
}

// --- CONVERSAZIONI ---
export async function fetchConversations(profileId = null) {
  const params = profileId ? { profile_id: profileId } : {};
  const res = await axios.get(`${API_BASE}/conversations/`, { params, headers: getAuthHeaders() });
  return res.data;
}

export async function createConversation(profileId) {
  const res = await axios.post(`${API_BASE}/conversations/`, { profile_id: profileId }, { headers: getAuthHeaders() });
  return res.data;
}

export async function deleteConversation(id) {
  await axios.delete(`${API_BASE}/conversations/${id}/`, { headers: getAuthHeaders() });
}

// --- MESSAGGI ---
export async function fetchMessages(conversationId) {
  const res = await axios.get(`${API_BASE}/conversations/${conversationId}/messages/`, { headers: getAuthHeaders() });
  return res.data;
}

// --- INVIO MESSAGGIO (e ricezione risposta AI) ---
export async function sendMessage({ content, profileId, conversationId = null, ragResourceIds = [] }) {
  if (conversationId) {
    // Messaggio in conversazione esistente
    const res = await axios.post(
      `${API_BASE}/conversations/${conversationId}/send_message/`,
      { content, profile_id: profileId, rag_resource_ids: ragResourceIds },
      { headers: getAuthHeaders() }
    );
    return res.data;
  } else {
    // Nuova conversazione
    const res = await axios.post(
      `${API_BASE}/send_message/`,
      { content, profile_id: profileId, rag_resource_ids: ragResourceIds },
      { headers: getAuthHeaders() }
    );
    return res.data;
  }
} 