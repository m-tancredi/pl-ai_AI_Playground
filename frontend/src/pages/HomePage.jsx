import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaRocket, FaDice, FaStar, FaArrowRight } from 'react-icons/fa';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Definizione delle funzionalità disponibili
  const features = [
    {
      id: 'chatbot',
      name: 'Chatbot AI',
      description: 'Conversa con un assistente intelligente che può aiutarti a studiare, fare domande o interpretare personaggi storici!',
      route: '/chatbot',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50',
      tips: [
        'Prova la modalità "Intervista Impossibile" per parlare con Leonardo da Vinci!',
        'Fatti interrogare su qualsiasi argomento scolastico',
        'Personalizza il tuo assistente AI'
      ]
    },
    {
      id: 'image-generator',
      name: 'Image Generator',
      description: 'Trasforma le tue idee in immagini straordinarie usando l\'intelligenza artificiale più avanzata!',
      route: '/image-generator',
      icon: '🎨',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-50 to-cyan-50',
      tips: [
        'Descrivi in dettaglio quello che vuoi vedere',
        'Sperimenta con stili artistici diversi',
        'Crea illustrazioni per i tuoi progetti'
      ]
    },
    {
      id: 'image-classifier',
      name: 'Image Classifier',
      description: 'Carica una foto e lascia che l\'AI identifichi oggetti, animali, piante e molto altro con precisione incredibile!',
      route: '/image-classifier',
      icon: '👁️',
      color: 'from-green-500 to-teal-500',
      bgColor: 'from-green-50 to-teal-50',
      tips: [
        'Prova con foto di animali, piante o oggetti',
        'Usa la webcam per classificazioni in tempo reale',
        'Perfetto per progetti di scienze naturali'
      ]
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis',
      description: 'Carica i tuoi dati e scopri pattern nascosti con analisi automatiche e visualizzazioni intelligenti!',
      route: '/data-analysis',
      icon: '📊',
      color: 'from-orange-500 to-red-500',
      bgColor: 'from-orange-50 to-red-50',
      tips: [
        'Supporta CSV, Excel e molti altri formati',
        'Ottieni insights automatici sui tuoi dati',
        'Crea grafici e visualizzazioni interattive'
      ]
    },
    {
      id: 'resources',
      name: 'Resource Manager',
      description: 'Organizza e gestisci tutti i tuoi materiali educativi in un unico posto smart e organizzato!',
      route: '/resources',
      icon: '📁',
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'from-indigo-50 to-purple-50',
      tips: [
        'Carica documenti, immagini e video',
        'Organizza con tag e cartelle intelligenti',
        'Ricerca rapida tra tutti i tuoi materiali'
      ]
    },
    {
      id: 'learning',
      name: 'Learning Service',
      description: 'Genera lezioni personalizzate con quiz interattivi e approfondimenti basati sull\'intelligenza artificiale!',
      route: '/learning',
      icon: '🎓',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-50 to-teal-50',
      tips: [
        'Crea lezioni su qualsiasi argomento in pochi secondi',
        'Quiz automatici per testare le tue conoscenze',
        'Approfondimenti dettagliati generati dall\'AI'
      ]
    }
  ];

  // Seleziona una funzionalità random all'avvio
  useEffect(() => {
    selectRandomFeature();
  }, []);

  const selectRandomFeature = () => {
    setIsAnimating(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * features.length);
      setCurrentSuggestion(features[randomIndex]);
      setIsAnimating(false);
    }, 300);
  };

  const handleTryFeature = () => {
    if (isAuthenticated && currentSuggestion) {
      navigate(currentSuggestion.route);
    }
  };

  if (!currentSuggestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin text-6xl">🎯</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header con greeting personalizzato */}
      <div className="relative overflow-hidden pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-purple-600/5"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-fade-in-up">
            {isAuthenticated ? (
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
                Ciao, {user?.username || 'Utente'}! 👋
              </h1>
            ) : (
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
                Benvenuto in PL-AI! 🚀
              </h1>
            )}
            <p className="text-xl text-gray-600 mb-8">
              {isAuthenticated 
                ? "Che ne dici di provare qualcosa di nuovo oggi?" 
                : "Scopri cosa puoi fare con l'intelligenza artificiale!"
              }
            </p>
          </div>
        </div>
      </div>

      {/* Sezione principale del suggerimento */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}>
          
          {/* Card principale del suggerimento */}
          <div className={`bg-gradient-to-br ${currentSuggestion.bgColor} rounded-3xl shadow-2xl overflow-hidden border border-white/50 backdrop-blur-sm`}>
            <div className="p-8 md:p-12">
              
              {/* Badge "Mi sento fortunato" */}
              <div className="flex justify-center mb-8">
                <div className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${currentSuggestion.color} text-white font-bold rounded-full shadow-lg transform hover:scale-105 transition-all duration-300`}>
                  <FaStar className="animate-pulse" />
                  <span>Perché non provi...</span>
                  <FaDice />
                </div>
              </div>

              {/* Contenuto principale */}
              <div className="text-center mb-8">
                <div className="text-8xl mb-6 animate-bounce">{currentSuggestion.icon}</div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
                  {currentSuggestion.name}
                </h2>
                <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
                  {currentSuggestion.description}
                </p>
              </div>

              {/* Tips della funzionalità */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  💡 <span>Cosa puoi fare:</span>
                </h3>
                <ul className="space-y-2">
                  {currentSuggestion.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-3 text-gray-700">
                      <span className="text-green-500 text-lg">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottoni di azione */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {isAuthenticated ? (
                  <button
                    onClick={handleTryFeature}
                    className={`group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${currentSuggestion.color} text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300`}
                  >
                    <FaRocket className="group-hover:animate-pulse" />
                    <span>Prova {currentSuggestion.name}!</span>
                    <FaArrowRight className="group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Accedi per provare questa funzionalità!</p>
                    <div className="flex gap-4">
                      <Link
                        to="/login"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                      >
                        Accedi
                      </Link>
                      <Link
                        to="/register"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-800 font-bold rounded-xl shadow-lg hover:shadow-xl border border-gray-200 transform hover:scale-105 transition-all duration-300"
                      >
                        Registrati
                      </Link>
                    </div>
                  </div>
                )}

                <button
                  onClick={selectRandomFeature}
                  disabled={isAnimating}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white/90 backdrop-blur-sm text-gray-800 font-medium rounded-xl shadow-lg hover:shadow-xl border border-gray-200/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-50"
                >
                  <FaDice className={isAnimating ? 'animate-spin' : ''} />
                  <span>Suggerisci altro</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sezione "Tutte le funzionalità" */}
          <div className="mt-12 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-8">
              O esplora tutte le funzionalità
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {features.map((feature) => (
                <Link
                  key={feature.id}
                  to={isAuthenticated ? feature.route : '/login'}
                  className={`group p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl border border-gray-200/50 transform hover:scale-105 transition-all duration-300 ${
                    feature.id === currentSuggestion.id ? `bg-gradient-to-br ${feature.bgColor} ring-2 ring-purple-300` : ''
                  }`}
                >
                  <div className="text-3xl mb-2 group-hover:animate-bounce">{feature.icon}</div>
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-purple-600 transition-colors duration-300">
                    {feature.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;