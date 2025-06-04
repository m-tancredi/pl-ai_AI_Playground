import React, { useState, useEffect, useRef } from 'react';
import { 
    FaRobot, 
    FaTrash, 
    FaDownload, 
    FaPlus, 
    FaQuestionCircle, 
    FaPaperPlane, 
    FaSpinner,
    FaChevronDown,
    FaTimes
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { 
    sendMessage, 
    getChatHistory, 
    getChatDetail, 
    deleteChat, 
    deleteAllChats 
} from '../services/chatbotService';

// Componenti
import ChatMessage from '../components/ChatMessage';
import ChatHistoryItem from '../components/ChatHistoryItem';
import LoadingDots from '../components/LoadingDots';
import ChatbotTutorialModal from '../components/ChatbotTutorialModal';

const ChatbotServicePage = () => {
    const { isAuthenticated } = useAuth();
    
    // State per chat
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [contextInput, setContextInput] = useState('');
    
    // State per UI
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showTutorial, setShowTutorial] = useState(false);
    
    // State per configurazione
    const [gradeSelect, setGradeSelect] = useState('');
    const [modeSelect, setModeSelect] = useState('');
    const [subjectSelect, setSubjectSelect] = useState('');
    const [modelSelect, setModelSelect] = useState('');
    const [chatStarted, setChatStarted] = useState(false);
    
    // State per modalità speciali
    const [showInterviewQuestions, setShowInterviewQuestions] = useState(false);
    const [characterInput, setCharacterInput] = useState('');
    const [historicalAccuracy, setHistoricalAccuracy] = useState(false);
    const [periodLanguage, setPeriodLanguage] = useState(false);
    
    const messagesEndRef = useRef(null);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    
    useEffect(scrollToBottom, [messages]);
    
    // Load chat history on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadChatHistory();
        }
    }, [isAuthenticated]);
    
    // Handle mode change
    useEffect(() => {
        if (modeSelect === 'intervista') {
            setShowInterviewQuestions(true);
            setContextInput('Informazioni aggiuntive sul personaggio e il contesto storico (opzionale)...');
        } else {
            setShowInterviewQuestions(false);
            if (modeSelect === 'interrogazione') {
                setContextInput('Descrivi l\'argomento specifico su cui vuoi essere interrogato...');
            } else {
                setContextInput('Descrivi la personalità del bot e il modo in cui dovrà esserti utile...');
            }
        }
    }, [modeSelect]);
    
    const loadChatHistory = async () => {
        try {
            const history = await getChatHistory();
            setChatHistory(Array.isArray(history) ? history : []);
        } catch (err) {
            console.error('Error loading chat history:', err);
            setError('Errore nel caricamento della cronologia delle chat');
        }
    };
    
    const loadChat = async (chatId) => {
        try {
            setIsLoading(true);
            setError('');
            const chatData = await getChatDetail(chatId);
            setCurrentChatId(chatId);
            setMessages(chatData.messages || []);
            
            // Update form with chat settings
            if (chatData.settings) {
                setGradeSelect(chatData.settings.grade || '');
                setModeSelect(chatData.settings.mode || '');
                setSubjectSelect(chatData.settings.subject || '');
                setModelSelect(chatData.settings.model || '');
                setContextInput(chatData.settings.system_prompt || '');
            }
            setChatStarted(true);
        } catch (err) {
            console.error('Error loading chat:', err);
            setError('Errore nel caricamento della chat');
        } finally {
            setIsLoading(false);
        }
    };
    
    const startNewChat = () => {
        setCurrentChatId(null);
        setMessages([]);
        setGradeSelect('');
        setModeSelect('');
        setSubjectSelect('');
        setModelSelect('');
        setContextInput('');
        setCharacterInput('');
        setHistoricalAccuracy(false);
        setPeriodLanguage(false);
        setChatStarted(false);
        setError('');
        setSuccess('');
        setShowInterviewQuestions(false);
    };
    
    const handleDeleteChat = async (chatId) => {
        try {
            await deleteChat(chatId);
            await loadChatHistory();
            
            if (chatId === currentChatId) {
                startNewChat();
            }
            setSuccess('Chat eliminata con successo');
        } catch (err) {
            console.error('Error deleting chat:', err);
            setError('Errore nell\'eliminazione della chat');
        }
    };
    
    const handleDeleteAllChats = async () => {
        if (!window.confirm('Sei sicuro di voler eliminare tutte le chat? Questa azione non può essere annullata.')) {
            return;
        }
        
        try {
            await deleteAllChats();
            setChatHistory([]);
            startNewChat();
            setSuccess('Tutte le chat sono state eliminate');
        } catch (err) {
            console.error('Error deleting all chats:', err);
            setError('Errore nell\'eliminazione delle chat');
        }
    };
    
    const submitContext = async () => {
        // Validation
        if (!gradeSelect || !modeSelect || !subjectSelect || !modelSelect) {
            setError('Seleziona tutte le opzioni prima di iniziare');
            return;
        }
        
        if (modeSelect === 'intervista' && !characterInput.trim()) {
            setError('Per favore, specifica il personaggio da interpretare.');
            return;
        }
        
        if (!contextInput.trim() && modeSelect !== 'intervista') {
            setError('Inserisci un contesto per il chatbot');
            return;
        }
        
        try {
            setIsSending(true);
            setError('');
            
            let finalContext = contextInput;
            
            // Handle interview mode
            if (modeSelect === 'intervista') {
                finalContext = `Interpreta il personaggio storico: ${characterInput}.\n`;
                if (historicalAccuracy) {
                    finalContext += 'Mantieni un comportamento accurato al periodo storico.\n';
                }
                if (periodLanguage) {
                    finalContext += 'Usa un linguaggio tipico dell\'epoca.\n';
                }
                if (contextInput.trim()) {
                    finalContext += '\nInformazioni aggiuntive:\n' + contextInput;
                }
            }
            
            const payload = {
                message: modeSelect === 'interrogazione' ? 'START_INTERROGATION' : 
                        modeSelect === 'intervista' ? 'START_INTERVIEW' : finalContext,
                context: {
                    grade: gradeSelect,
                    mode: modeSelect,
                    subject: subjectSelect,
                    model: modelSelect,
                    systemPrompt: finalContext
                },
                chatId: currentChatId
            };
            
            const response = await sendMessage(payload);
            
            if (response.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: response.response, model: modelSelect }]);
            }
            
            if (response.chatId) {
                setCurrentChatId(response.chatId);
                await loadChatHistory();
            }
            
            setChatStarted(true);
            setSuccess('Chat avviata con successo!');
        } catch (err) {
            console.error('Error starting chat:', err);
            setError('Errore nell\'avvio della chat: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsSending(false);
        }
    };
    
    const handleSendMessage = async () => {
        if (!messageInput.trim() || !chatStarted) return;
        
        const userMessage = messageInput.trim();
        setMessageInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        
        try {
            setIsSending(true);
            setError('');
            
            const payload = {
                message: userMessage,
                context: {
                    grade: gradeSelect,
                    mode: modeSelect,
                    subject: subjectSelect,
                    model: modelSelect,
                    systemPrompt: contextInput
                },
                chatId: currentChatId
            };
            
            // Add loading indicator
            setMessages(prev => [...prev, { role: 'loading', content: '' }]);
            
            const response = await sendMessage(payload);
            
            // Remove loading indicator and add response
            setMessages(prev => {
                const newMessages = prev.filter(msg => msg.role !== 'loading');
                return [...newMessages, { 
                    role: 'assistant', 
                    content: response.response, 
                    model: modelSelect 
                }];
            });
            
            if (response.chatId !== currentChatId) {
                setCurrentChatId(response.chatId);
                await loadChatHistory();
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Errore nell\'invio del messaggio: ' + (err.response?.data?.error || err.message));
            // Remove loading indicator on error
            setMessages(prev => prev.filter(msg => msg.role !== 'loading'));
        } finally {
            setIsSending(false);
        }
    };
    
    const downloadChat = () => {
        if (!messages.length) {
            setError('Nessuna chat da scaricare');
            return;
        }
        
        let content = 'Chat Export\n\n';
        content += `Data: ${new Date().toLocaleString('it-IT')}\n`;
        content += `Modalità: ${modeSelect || 'Standard'}\n`;
        content += `Grado: ${gradeSelect || 'Non specificato'}\n`;
        content += `Argomento: ${subjectSelect || 'Non specificato'}\n`;
        content += `Modello: ${modelSelect || 'Non specificato'}\n\n`;
        
        messages.forEach(msg => {
            if (msg.role !== 'loading') {
                content += `${msg.role === 'user' ? 'Tu' : 'Bot'}: ${msg.content}\n\n`;
            }
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${currentChatId || 'new'}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setSuccess('Chat scaricata con successo!');
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (chatStarted) {
                handleSendMessage();
            } else {
                submitContext();
            }
        }
    };
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="max-w-6xl mx-auto py-4 px-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                            <FaRobot className="text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">CHATBOT AI</h1>
                            <button 
                                onClick={() => setShowTutorial(true)}
                                className="text-gray-600 hover:text-purple-600 underline transition-colors flex items-center gap-1 text-sm"
                            >
                                <FaQuestionCircle />
                                Come funziona? Apri il tutorial
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Alert Messages */}
                {error && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                )}
                
                {success && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                            <span>{success}</span>
                            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                )}
                
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl flex flex-col h-[800px] overflow-hidden">
                    {/* Configuration Header */}
                    {!chatStarted && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b">
                                <div className="relative">
                                    <select 
                                        value={gradeSelect} 
                                        onChange={(e) => setGradeSelect(e.target.value)}
                                        className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Grado scolastico</option>
                                        <option value="sec1">Scuola Sec. I grado</option>
                                        <option value="sec2-biennio">Scuola Sec. II grado - Biennio</option>
                                        <option value="sec2-triennio">Scuola Sec. II grado - Triennio</option>
                                    </select>
                                    <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                    <select 
                                        value={modeSelect} 
                                        onChange={(e) => setModeSelect(e.target.value)}
                                        className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Modalità</option>
                                        <option value="interrogazione">Modalità Interrogazione</option>
                                        <option value="interazione">Modalità Interazione</option>
                                        <option value="intervista">Modalità Intervista Impossibile</option>
                                    </select>
                                    <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                    <select 
                                        value={subjectSelect} 
                                        onChange={(e) => setSubjectSelect(e.target.value)}
                                        className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Argomento</option>
                                        <option value="ai">AI</option>
                                        <option value="scienze">Scienze</option>
                                        <option value="storia">Storia</option>
                                        <option value="matematica">Matematica</option>
                                        <option value="italiano">Italiano</option>
                                        <option value="inglese">Inglese</option>
                                    </select>
                                    <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                    <select 
                                        value={modelSelect} 
                                        onChange={(e) => setModelSelect(e.target.value)}
                                        className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Modello AI</option>
                                        <option value="gpt4o-mini">GPT-4 O Mini</option>
                                        <option value="o3-mini">O3 Mini</option>
                                        <option value="gemini">Gemini Flash</option>
                                    </select>
                                    <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            
                            {/* Context Area */}
                            <div className="p-6 bg-gray-50 border-b">
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <textarea 
                                            value={contextInput}
                                            onChange={(e) => setContextInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="flex-1 p-4 border-0 rounded-xl resize-none bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                            rows="3" 
                                            placeholder="Descrivi la personalità del bot e il modo in cui dovrà esserti utile..."
                                        />
                                        <button 
                                            onClick={submitContext}
                                            disabled={isSending}
                                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all duration-200"
                                        >
                                            {isSending ? <FaSpinner className="animate-spin" /> : null}
                                            Inizia
                                        </button>
                                    </div>
                                    
                                    {/* Interview Questions */}
                                    {showInterviewQuestions && (
                                        <div className="bg-white p-4 rounded-xl border border-purple-200">
                                            <div className="text-sm text-purple-600 mb-3 font-medium">
                                                Per l'intervista impossibile, rispondi a queste domande:
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Quale personaggio vuoi che interpreti?
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        value={characterInput}
                                                        onChange={(e) => setCharacterInput(e.target.value)}
                                                        className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="es. Leonardo da Vinci, Cleopatra, Einstein..."
                                                    />
                                                </div>
                                                <div className="flex gap-6">
                                                    <div className="flex items-center">
                                                        <input 
                                                            type="checkbox" 
                                                            id="historical-accuracy"
                                                            checked={historicalAccuracy}
                                                            onChange={(e) => setHistoricalAccuracy(e.target.checked)}
                                                            className="mr-2 text-purple-500 focus:ring-purple-500"
                                                        />
                                                        <label htmlFor="historical-accuracy" className="text-sm text-gray-700">
                                                            Comportamento storico accurato
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <input 
                                                            type="checkbox" 
                                                            id="period-language"
                                                            checked={periodLanguage}
                                                            onChange={(e) => setPeriodLanguage(e.target.checked)}
                                                            className="mr-2 text-purple-500 focus:ring-purple-500"
                                                        />
                                                        <label htmlFor="period-language" className="text-sm text-gray-700">
                                                            Linguaggio d'epoca
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Main Content */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Chat History Sidebar */}
                        <div className="w-80 border-r bg-gray-50 flex flex-col">
                            <div className="p-4 border-b space-y-3">
                                <button 
                                    onClick={startNewChat}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 flex items-center justify-center gap-2 shadow-lg transition-all duration-200"
                                >
                                    <FaPlus />
                                    Nuova Chat
                                </button>
                                <button 
                                    onClick={handleDeleteAllChats}
                                    className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <FaTrash />
                                    Elimina Tutto
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {chatHistory.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        Nessuna chat disponibile.<br />
                                        Inizia una nuova conversazione!
                                    </div>
                                ) : (
                                    chatHistory.map(chat => (
                                        <ChatHistoryItem
                                            key={chat.id}
                                            chat={chat}
                                            isActive={chat.id === currentChatId}
                                            onClick={() => loadChat(chat.id)}
                                            onDelete={handleDeleteChat}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                        
                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col">
                            {/* Messages Container */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-white to-gray-50">
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="text-center">
                                            <FaSpinner className="animate-spin text-3xl text-purple-400 mb-4" />
                                            <p className="text-gray-600">Caricamento chat...</p>
                                        </div>
                                    </div>
                                ) : messages.length === 0 && chatStarted ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="text-center text-gray-500">
                                            <FaRobot className="text-4xl mb-4 mx-auto" />
                                            <p>La conversazione è stata avviata.<br />Scrivi un messaggio per iniziare!</p>
                                        </div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="text-center text-gray-500 max-w-md">
                                            <FaRobot className="text-6xl mb-6 mx-auto text-purple-300" />
                                            <h3 className="text-xl font-semibold mb-2">Benvenuto nel Chatbot AI!</h3>
                                            <p className="mb-4">
                                                Configura il tuo assistente virtuale selezionando le opzioni sopra e 
                                                fornendo un contesto per personalizzare la conversazione.
                                            </p>
                                            <button 
                                                onClick={() => setShowTutorial(true)}
                                                className="text-purple-600 hover:text-purple-700 underline"
                                            >
                                                Hai bisogno di aiuto? Leggi il tutorial
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((message, index) => 
                                            message.role === 'loading' ? (
                                                <LoadingDots key={index} />
                                            ) : (
                                                <ChatMessage 
                                                    key={index} 
                                                    role={message.role} 
                                                    content={message.content}
                                                    model={message.model}
                                                />
                                            )
                                        )}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            
                            {/* Input Area */}
                            {chatStarted && (
                                <div className="p-6 border-t bg-white">
                                    <div className="flex gap-3">
                                        <textarea 
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="flex-1 p-4 border border-gray-200 rounded-xl resize-none shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="Scrivi il tuo messaggio... (Premi Enter per inviare)"
                                            rows="2"
                                        />
                                        <button 
                                            onClick={downloadChat}
                                            className="px-4 py-3 border border-purple-300 text-purple-600 rounded-xl hover:bg-purple-50 flex items-center justify-center transition-colors"
                                            title="Scarica chat"
                                        >
                                            <FaDownload />
                                        </button>
                                        <button 
                                            onClick={handleSendMessage}
                                            disabled={isSending || !messageInput.trim()}
                                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all duration-200"
                                        >
                                            {isSending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                                            Invia
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <ChatbotTutorialModal show={showTutorial} onClose={() => setShowTutorial(false)} />
        </div>
    );
};

export default ChatbotServicePage; 