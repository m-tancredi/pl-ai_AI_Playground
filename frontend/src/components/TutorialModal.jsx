// src/components/TutorialModal.jsx
import React from 'react';
import { FaTimes, FaQuestionCircle, FaImages, FaBrain, FaRobot, FaLightbulb } from 'react-icons/fa';

const TutorialModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-8 border-0 w-full max-w-3xl shadow-2xl rounded-2xl bg-white">
                {/* Header moderno */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                        <FaQuestionCircle className="text-xl" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800">Image Classifier AI - Tutorial</h3>
                        <p className="text-gray-600">Impara a creare il tuo classificatore di immagini</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl p-2 transition-all duration-200" 
                        aria-label="Close modal"
                    >
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>

                {/* Contenuto */}
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-200">
                        <p className="text-lg font-semibold text-gray-800 mb-3">
                            🚀 Crea il tuo classificatore di immagini personalizzato in 3 semplici step!
                        </p>
                        <p className="text-gray-600">
                            Allena un'intelligenza artificiale a riconoscere oggetti, animali, persone o qualsiasi cosa tu voglia!
                        </p>
                    </div>

                    <div className="space-y-5">
                        {/* Step 1 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                                    1
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaImages className="text-purple-500" />
                                    <h4 className="text-lg font-bold text-gray-800">Crea le Classi</h4>
                                </div>
                            </div>
                            <ul className="space-y-2 text-gray-700 ml-14">
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Aggiungi fino a 5 classi diverse (es: "Gatto", "Cane", "La mia faccia")</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Dai nomi chiari e descrittivi a ogni classe</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Attiva la webcam e cattura almeno 10-20 immagini per classe</span>
                                </li>
                            </ul>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                                    2
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaBrain className="text-purple-500" />
                                    <h4 className="text-lg font-bold text-gray-800">Allena il Modello</h4>
                                </div>
                            </div>
                            <ul className="space-y-2 text-gray-700 ml-14">
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Clicca "TRAINA MODELLO" quando hai abbastanza immagini</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Monitora il progresso nella sezione Training</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>L'allenamento avviene in background e può richiedere alcuni minuti</span>
                                </li>
                            </ul>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                                    3
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaRobot className="text-purple-500" />
                                    <h4 className="text-lg font-bold text-gray-800">Testa in Tempo Reale</h4>
                                </div>
                            </div>
                            <ul className="space-y-2 text-gray-700 ml-14">
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Dopo il training, la webcam si attiverà automaticamente</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Punta la camera verso gli oggetti che vuoi classificare</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <span>Osserva le predizioni in tempo reale con percentuali di confidenza!</span>
                                </li>
                            </ul>
                        </div>

                        {/* Tips */}
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <FaLightbulb className="text-yellow-500 text-xl" />
                                <h4 className="text-lg font-bold text-gray-800">Suggerimenti per Risultati Migliori</h4>
                            </div>
                            <ul className="space-y-2 text-gray-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500 mt-1">💡</span>
                                    <span>Cattura immagini da angolazioni e illuminazioni diverse</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500 mt-1">💡</span>
                                    <span>Più immagini = migliore accuratezza (almeno 20 per classe)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500 mt-1">💡</span>
                                    <span>Assicurati di avere una buona illuminazione</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500 mt-1">💡</span>
                                    <span>Puoi salvare e ricaricare modelli allenati</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg transition-all duration-200"
                    >
                        Ho Capito, Iniziamo! 🚀
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialModal;