import React, { useEffect, useState, useRef } from 'react';
import {
  fetchChatbotProfiles,
  fetchConversations,
  fetchMessages,
  sendMessage,
  createChatbotProfile,
  createConversation,
  deleteConversation
} from '../services/chatbotService';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const ChatbotServicePage = () => {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Carica profili all'avvio
  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    try {
      const data = await fetchChatbotProfiles();
      setProfiles(data);
      if (data.length > 0) setSelectedProfile(data[0]);
    } catch (e) {
      setError('Errore nel caricamento dei profili chatbot.');
    } finally {
      setLoading(false);
    }
  }

  // Carica conversazioni quando cambia profilo
  useEffect(() => {
    if (selectedProfile) {
      loadConversations(selectedProfile.id);
    } else {
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
    }
  }, [selectedProfile]);

  async function loadConversations(profileId) {
    setLoading(true);
    try {
      const data = await fetchConversations(profileId);
      setConversations(data);
      if (data.length > 0) {
        setSelectedConversation(data[0]);
      } else {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (e) {
      setError('Errore nel caricamento delle conversazioni.');
    } finally {
      setLoading(false);
    }
  }

  // Carica messaggi quando cambia conversazione
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation]);

  async function loadMessages(conversationId) {
    setLoading(true);
    try {
      const data = await fetchMessages(conversationId);
      setMessages(data);
    } catch (e) {
      setError('Errore nel caricamento dei messaggi.');
    } finally {
      setLoading(false);
    }
  }

  // Scroll automatico in fondo alla chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  // Invio messaggio
  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !selectedProfile) return;
    setSending(true);
    setError(null);
    try {
      let response;
      if (selectedConversation) {
        response = await sendMessage({
          content: input,
          profileId: selectedProfile.id,
          conversationId: selectedConversation.id
        });
        await loadMessages(selectedConversation.id);
      } else {
        response = await sendMessage({
          content: input,
          profileId: selectedProfile.id
        });
        // Dopo la creazione, ricarica conversazioni e seleziona quella nuova
        await loadConversations(selectedProfile.id);
      }
      setInput('');
    } catch (e) {
      setError('Errore durante l\'invio del messaggio.');
    } finally {
      setSending(false);
    }
  }

  // Crea nuovo profilo
  async function handleCreateProfile(e) {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    setLoading(true);
    try {
      await createChatbotProfile({ name: newProfileName });
      setNewProfileName('');
      setCreatingProfile(false);
      await loadProfiles();
    } catch (e) {
      setError('Errore nella creazione del profilo.');
    } finally {
      setLoading(false);
    }
  }

  // Elimina conversazione
  async function handleDeleteConversation(id) {
    if (!window.confirm('Vuoi davvero eliminare questa conversazione?')) return;
    setLoading(true);
    try {
      await deleteConversation(id);
      await loadConversations(selectedProfile.id);
    } catch (e) {
      setError('Errore nell\'eliminazione della conversazione.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-50">
      {/* Sidebar profili/conversazioni */}
      <aside className="w-full md:w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Chatbot</h2>
          <button
            className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
            onClick={() => setCreatingProfile(true)}
          >
            + Profilo
          </button>
        </div>
        {/* Selettore profilo */}
        <div className="p-4 border-b">
          <select
            className="w-full border rounded px-2 py-1"
            value={selectedProfile ? selectedProfile.id : ''}
            onChange={e => {
              const prof = profiles.find(p => p.id === e.target.value);
              setSelectedProfile(prof);
            }}
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {/* Lista conversazioni */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">Nessuna conversazione</div>
          ) : (
            <ul>
              {conversations.map(conv => (
                <li
                  key={conv.id}
                  className={classNames(
                    'px-4 py-3 border-b cursor-pointer flex items-center justify-between',
                    selectedConversation && conv.id === selectedConversation.id
                      ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-100'
                  )}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <span className="truncate max-w-[140px]">{conv.title || 'Nuova conversazione'}</span>
                  <button
                    className="ml-2 text-xs text-red-400 hover:text-red-600"
                    onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Area chat */}
      <main className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{selectedProfile ? selectedProfile.name : 'Seleziona un profilo'}</h3>
            <div className="text-xs text-gray-400">{selectedConversation ? selectedConversation.title : 'Nessuna conversazione selezionata'}</div>
          </div>
        </div>
        {/* Messaggi */}
        <div className="flex-1 overflow-y-auto px-4 py-6 bg-gray-50">
          {loading ? (
            <div className="text-center text-gray-400">Caricamento...</div>
          ) : error ? (
            <div className="text-center text-red-400">{error}</div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  <div className={classNames(
                    'rounded-lg px-4 py-2 max-w-[70%] shadow',
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white self-end' : 'bg-white text-gray-800 border'
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        {/* Input messaggio */}
        <form
          onSubmit={handleSend}
          className="p-4 bg-white border-t flex gap-2 items-center"
        >
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
            placeholder="Scrivi un messaggio..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={sending || !selectedProfile}
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            disabled={sending || !input.trim() || !selectedProfile}
          >
            Invia
          </button>
        </form>
      </main>

      {/* Modal creazione profilo */}
      {creatingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Crea nuovo profilo chatbot</h2>
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Nome profilo"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  onClick={() => setCreatingProfile(false)}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  disabled={!newProfileName.trim() || loading}
                >
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotServicePage; 