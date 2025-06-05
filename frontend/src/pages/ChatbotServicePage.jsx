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
    
    // State per layout ChatGPT-like
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showConfig, setShowConfig] = useState(!chatStarted);
    
    const messagesEndRef = useRef(null);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    
    // Solo scroll se ci sono messaggi e la chat è attiva
    useEffect(() => {
        if (messages.length > 0 && chatStarted) {
            scrollToBottom();
        }
    }, [messages, chatStarted]);
    
    // Update showConfig when chatStarted changes
    useEffect(() => {
        setShowConfig(!chatStarted);
    }, [chatStarted]);
    
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
            
            // Filtra i messaggi di sistema anche quando carichi una chat
            const filteredMessages = (chatData.messages || []).filter(message => {
                if (message.role === 'user' && 
                    (message.content === 'START_INTERROGATION' || 
                     message.content === 'START_INTERVIEW')) {
                    return false;
                }
                return true;
            });
            
            setMessages(filteredMessages);
            
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
            
            // Solo mostra la risposta del bot, non il messaggio di sistema
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
        
        // Filtra anche i messaggi di sistema dal download
        messages
            .filter(msg => {
                if (msg.role === 'user' && 
                    (msg.content === 'START_INTERROGATION' || 
                     msg.content === 'START_INTERVIEW')) {
                    return false;
                }
                return msg.role !== 'loading';
            })
            .forEach(msg => {
                content += `${msg.role === 'user' ? 'Tu' : 'Bot'}: ${msg.content}\n\n`;
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
        <div className="bg-gradient-to-br from-slate-50 to-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 110px)' }}>
            {/* Main Container - Si adatta allo spazio tra navbar e footer */}
            <div className="h-full w-full bg-white flex flex-col overflow-hidden">
                
                {/* Alert Messages */}
                {error && (
                    <div className="flex-shrink-0 p-4">
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                )}
                
                {success && (
                    <div className="flex-shrink-0 p-4 pt-0">
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center justify-between">
                            <span>{success}</span>
                            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600 ml-4">
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                )}

                {/* Configuration Header - Solo quando chat non è iniziata */}
                {!chatStarted && (
                    <div className="flex-shrink-0 p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="relative">
                                <select 
                                    value={gradeSelect} 
                                    onChange={(e) => setGradeSelect(e.target.value)}
                                    className="w-full p-4 border-0 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer transition-all duration-200"
                                >
                                    <option value="">Grado scolastico</option>
                                    <option value="sec1">Scuola Sec. I grado</option>
                                    <option value="sec2-biennio">Scuola Sec. II grado - Biennio</option>
                                    <option value="sec2-triennio">Scuola Sec. II grado - Triennio</option>
                                </select>
                                <FaChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            
                            <div className="relative">
                                <select 
                                    value={modeSelect} 
                                    onChange={(e) => setModeSelect(e.target.value)}
                                    className="w-full p-4 border-0 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer transition-all duration-200"
                                >
                                    <option value="">Modalità</option>
                                    <option value="interrogazione">Modalità Interrogazione</option>
                                    <option value="interazione">Modalità Interazione</option>
                                    <option value="intervista">Modalità Intervista Impossibile</option>
                                </select>
                                <FaChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            
                            <div className="relative">
                                <select 
                                    value={subjectSelect} 
                                    onChange={(e) => setSubjectSelect(e.target.value)}
                                    className="w-full p-4 border-0 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer transition-all duration-200"
                                >
                                    <option value="">Argomento</option>
                                    <option value="ai">AI</option>
                                    <option value="scienze">Scienze</option>
                                    <option value="storia">Storia</option>
                                    <option value="matematica">Matematica</option>
                                    <option value="italiano">Italiano</option>
                                    <option value="inglese">Inglese</option>
                                </select>
                                <FaChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            
                            <div className="relative">
                                <select 
                                    value={modelSelect} 
                                    onChange={(e) => setModelSelect(e.target.value)}
                                    className="w-full p-4 border-0 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer transition-all duration-200"
                                >
                                    <option value="">Modello AI</option>
                                    <option value="gpt4o-mini">GPT-4 O Mini</option>
                                    <option value="o3-mini">O3 Mini</option>
                                    <option value="gemini">Gemini Flash</option>
                                </select>
                                <FaChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        
                        {/* Context Input Area */}
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <textarea 
                                    value={contextInput}
                                    onChange={(e) => setContextInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="flex-1 p-4 border-0 rounded-xl resize-none bg-white/80 backdrop-blur-sm shadow-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200" 
                                    rows="3" 
                                    placeholder="Descrivi la personalità del bot e il modo in cui dovrà esserti utile..."
                                />
                                <button 
                                    onClick={submitContext}
                                    disabled={isSending}
                                    className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                                >
                                    {isSending ? <FaSpinner className="animate-spin" /> : null}
                                    <span className="font-semibold">Inizia Chat</span>
                                </button>
                            </div>
                            
                            {/* Interview Questions */}
                            {showInterviewQuestions && (
                                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl border border-purple-200 shadow-lg">
                                    <div className="text-sm text-purple-600 font-semibold mb-4">
                                        🎭 Configurazione Intervista Impossibile
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Quale personaggio vuoi che interpreti?
                                            </label>
                                            <input 
                                                type="text" 
                                                value={characterInput}
                                                onChange={(e) => setCharacterInput(e.target.value)}
                                                className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                                                placeholder="es. Leonardo da Vinci, Cleopatra, Einstein..."
                                            />
                                        </div>
                                        <div className="flex gap-8">
                                            <div className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    id="historical-accuracy"
                                                    checked={historicalAccuracy}
                                                    onChange={(e) => setHistoricalAccuracy(e.target.checked)}
                                                    className="mr-3 text-purple-500 focus:ring-purple-500 w-4 h-4"
                                                />
                                                <label htmlFor="historical-accuracy" className="text-sm text-gray-700 font-medium">
                                                    Comportamento storico accurato
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    id="period-language"
                                                    checked={periodLanguage}
                                                    onChange={(e) => setPeriodLanguage(e.target.checked)}
                                                    className="mr-3 text-purple-500 focus:ring-purple-500 w-4 h-4"
                                                />
                                                <label htmlFor="period-language" className="text-sm text-gray-700 font-medium">
                                                    Linguaggio d'epoca
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Main Chat Container */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Chat History Sidebar */}
                    <div className="w-80 bg-gradient-to-b from-gray-50 to-gray-100/50 border-r border-gray-200 flex flex-col">
                        <div className="p-4 border-b border-gray-200">
                            <div className="space-y-3">
                                <button 
                                    onClick={startNewChat}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                >
                                    <FaPlus className="w-4 h-4" />
                                    <span className="font-semibold">Nuova Chat</span>
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={handleDeleteAllChats}
                                        className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2 transition-all duration-200 text-sm"
                                    >
                                        <FaTrash className="w-3 h-3" />
                                        Elimina Tutto
                                    </button>
                                    <button 
                                        onClick={() => setShowTutorial(true)}
                                        className="px-3 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 transition-all duration-200 text-sm"
                                    >
                                        <FaQuestionCircle className="w-3 h-3" />
                                        Tutorial
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Chat History List */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                            {chatHistory.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    <FaRobot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p>Nessuna chat disponibile</p>
                                    <p className="text-xs mt-1">Inizia una nuova conversazione!</p>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {chatHistory.map(chat => (
                                        <ChatHistoryItem
                                            key={chat.id}
                                            chat={chat}
                                            isActive={chat.id === currentChatId}
                                            onClick={() => loadChat(chat.id)}
                                            onDelete={handleDeleteChat}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Main Chat Area */}
                    <div className="flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50/30 relative overflow-hidden">
                        {/* Chat Messages Container - Scrollabile con spazio per input bar */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" style={{ paddingBottom: chatStarted ? '120px' : '0' }}>
                            <div className="p-6 space-y-4">
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <div className="text-center">
                                            <FaSpinner className="animate-spin text-4xl text-purple-400 mb-4" />
                                            <p className="text-gray-600 font-medium">Caricamento chat...</p>
                                        </div>
                                    </div>
                                ) : messages.length === 0 && chatStarted ? (
                                    <div className="flex justify-center items-center h-64">
                                        <div className="text-center">
                                            <FaRobot className="text-5xl mx-auto mb-4 text-purple-300" />
                                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Chat Avviata!</h3>
                                            <p className="text-gray-500">Scrivi il tuo primo messaggio per iniziare la conversazione.</p>
                                        </div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex justify-center items-center h-64">
                                        <div className="text-center max-w-md">
                                            <FaRobot className="text-6xl mx-auto mb-6 text-purple-300" />
                                            <h3 className="text-2xl font-bold text-gray-800 mb-4">Benvenuto nel Chatbot AI!</h3>
                                            <p className="text-gray-600 mb-6 leading-relaxed">
                                                Configura il tuo assistente virtuale selezionando le opzioni sopra e 
                                                fornendo un contesto per personalizzare la conversazione.
                                            </p>
                                            <button 
                                                onClick={() => setShowTutorial(true)}
                                                className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium underline transition-colors duration-200"
                                            >
                                                <FaQuestionCircle />
                                                Hai bisogno di aiuto? Leggi il tutorial
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Messaggi ordinati cronologicamente (dal primo all'ultimo) */}
                                        {messages
                                            .filter(message => {
                                                // Filtra i messaggi di sistema
                                                if (message.role === 'user' && 
                                                    (message.content === 'START_INTERROGATION' || 
                                                     message.content === 'START_INTERVIEW')) {
                                                    return false;
                                                }
                                                return true;
                                            })
                                            .map((message, index) => 
                                                message.role === 'loading' ? (
                                                    <div key={index} className="flex justify-center my-4">
                                                        <LoadingDots />
                                                    </div>
                                                ) : (
                                                    <div key={index} className="animate-fade-in">
                                                        <ChatMessage 
                                                            role={message.role} 
                                                            content={message.content}
                                                            model={message.model}
                                                        />
                                                    </div>
                                                )
                                            )}
                                        {/* Scroll anchor */}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {/* Floating Input Bar - Posizionata assolutamente nell'area chat */}
                        {chatStarted && (
                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-4">
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1">
                                            <textarea 
                                                value={messageInput}
                                                onChange={(e) => setMessageInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                className="w-full p-4 border-0 rounded-xl resize-none bg-gray-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200 placeholder-gray-500"
                                                placeholder="Scrivi il tuo messaggio... (Premi Enter per inviare)"
                                                rows="1"
                                                style={{
                                                    minHeight: '52px',
                                                    maxHeight: '132px',
                                                    scrollbarWidth: 'thin'
                                                }}
                                                onInput={(e) => {
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = Math.min(e.target.scrollHeight, 132) + 'px';
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={downloadChat}
                                                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all duration-200 hover:scale-105 shadow-sm"
                                                title="Scarica chat"
                                            >
                                                <FaDownload className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={handleSendMessage}
                                                disabled={isSending || !messageInput.trim()}
                                                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                                            >
                                                {isSending ? <FaSpinner className="animate-spin w-5 h-5" /> : <FaPaperPlane className="w-5 h-5" />}
                                                <span className="font-semibold">Invia</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Tutorial Modal */}
            <ChatbotTutorialModal show={showTutorial} onClose={() => setShowTutorial(false)} />
        </div>
    );
};

export default ChatbotServicePage; 