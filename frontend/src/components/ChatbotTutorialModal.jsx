import React from 'react';
import { FaTimes, FaRobot, FaBrain, FaCog } from 'react-icons/fa';

const ChatbotTutorialModal = ({ show, onClose }) => {
    if (!show) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <FaRobot className="text-purple-500" />
                            Tutorial: Chatbot AI
                        </h2>
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <FaTimes className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="p-6 space-y-8">
                    {/* Illustrazione chatbot */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl flex justify-center">
                        <div className="flex items-center space-x-8">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                                    <FaRobot className="text-2xl text-gray-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-600">Utente</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-4 h-1 bg-purple-300 rounded mb-2"></div>
                                <div className="w-1 h-4 bg-purple-300 rounded"></div>
                            </div>
                            <div className="text-center">
                                <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-2">
                                    <FaBrain className="text-2xl text-white" />
                                </div>
                                <span className="text-sm font-medium text-gray-600">Assistente AI</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Cos'è il chatbot */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h3 className="flex items-center text-xl font-semibold text-gray-800 mb-4">
                                <FaBrain className="w-5 h-5 mr-3 text-purple-500" />
                                Cos'è il Chatbot?
                            </h3>
                            <div className="text-gray-600 space-y-3">
                                <p>
                                    Il chatbot è un assistente virtuale basato su intelligenza artificiale che può 
                                    rispondere alle tue domande, aiutarti con compiti specifici e fornire informazioni 
                                    su vari argomenti.
                                </p>
                                <p>
                                    Utilizza modelli di linguaggio avanzati per comprendere il contesto delle tue 
                                    richieste e generare risposte pertinenti e utili.
                                </p>
                                <p>
                                    Puoi interagire con il chatbot in linguaggio naturale, proprio come faresti 
                                    in una conversazione con un'altra persona.
                                </p>
                            </div>
                        </div>
                        
                        {/* Come usare lo strumento */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h3 className="flex items-center text-xl font-semibold text-gray-800 mb-4">
                                <FaCog className="w-5 h-5 mr-3 text-purple-500" />
                                Come usare questo strumento
                            </h3>
                            <ol className="text-gray-600 space-y-2 list-decimal list-inside">
                                <li>
                                    <strong>Configura il chatbot:</strong> Seleziona il grado scolastico, modalità, 
                                    argomento e modello AI più adatti alle tue esigenze.
                                </li>
                                <li>
                                    <strong>Fornisci contesto:</strong> Descrivi la personalità e il comportamento 
                                    che vuoi che il chatbot abbia durante la conversazione.
                                </li>
                                <li>
                                    <strong>Inizia la conversazione:</strong> Clicca "Inizia" per avviare la chat 
                                    e ricevere il primo messaggio dal bot.
                                </li>
                                <li>
                                    <strong>Conversa liberamente:</strong> Scrivi i tuoi messaggi e ricevi risposte 
                                    intelligenti. Il bot manterrà il contesto della conversazione.
                                </li>
                                <li>
                                    <strong>Gestisci le chat:</strong> Usa la cronologia per tornare a conversazioni 
                                    precedenti o iniziare nuove chat.
                                </li>
                            </ol>
                        </div>
                    </div>
                    
                    {/* Modalità disponibili */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Modalità disponibili</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg">
                                <h4 className="font-semibold text-purple-600 mb-2">Interrogazione</h4>
                                <p className="text-sm text-gray-600">
                                    Il bot ti fa domande su un argomento specifico per testare la tua conoscenza.
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg">
                                <h4 className="font-semibold text-purple-600 mb-2">Interazione</h4>
                                <p className="text-sm text-gray-600">
                                    Conversazione libera con il bot su qualsiasi argomento di tuo interesse.
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg">
                                <h4 className="font-semibold text-purple-600 mb-2">Intervista Impossibile</h4>
                                <p className="text-sm text-gray-600">
                                    Il bot interpreta un personaggio storico per un'intervista immersiva.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-gray-200 flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                        Inizia a usare il Chatbot
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatbotTutorialModal; 