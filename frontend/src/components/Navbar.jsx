// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FaTimes, FaQuestionCircle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

// Import icone Flaticon
import '@flaticon/flaticon-uicons/css/all/all.css';

// Componenti Tutorial per ogni pagina
const TutorialModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-pink-500/90 to-blue-500/90 backdrop-blur-xl text-white">
          <h3 className="text-xl font-bold">{title}</h3>
                      <button onClick={onClose} className="text-white/90 hover:text-white transition-colors duration-200">
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="prose max-w-none">
            {content}
          </div>
        </div>
        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-pink-500/90 to-blue-500/90 text-white rounded-lg hover:from-pink-600/90 hover:to-blue-600/90 transition-all duration-300 shadow-lg backdrop-blur-xl border border-white/20"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente per le icone del menu
const MenuIcon = ({ iconClass, size = "text-lg" }) => (
  <i className={`${iconClass} ${size}`}></i>
);

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTutorial, setActiveTutorial] = useState(null);

  // Contenuti tutorial per ogni pagina
  const tutorialContent = {
    '/home': {
      title: 'Benvenuto in PL-AI',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Dashboard Principale</h4>
          <p className="mb-4">Questa è la dashboard principale di PL-AI, la tua piattaforma di intelligenza artificiale educativa.</p>
          <ul className="list-disc list-inside space-y-2 mb-4">
            <li><strong>Chatbot AI:</strong> Conversazioni intelligenti per apprendimento</li>
            <li><strong>Image Generator:</strong> Crea immagini con AI</li>
            <li><strong>Image Classifier:</strong> Classifica e analizza immagini</li>
            <li><strong>Data Analysis:</strong> Analisi dati avanzata</li>
            <li><strong>Resources:</strong> Gestione risorse e materiali</li>
            <li><strong>RAG Service:</strong> Chat con i tuoi documenti</li>
          </ul>
          <p>Naviga tra le sezioni usando il menu principale per accedere a tutti gli strumenti AI.</p>
        </div>
      )
    },
    '/chatbot': {
      title: 'Tutorial Chatbot AI',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Come usare il Chatbot AI</h4>
          <p className="mb-4">Il Chatbot AI offre tre modalità principali di interazione:</p>
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h5 className="font-semibold text-purple-800">Modalità Interrogazione</h5>
              <p className="text-sm text-purple-700">L'AI ti farà domande su un argomento specifico per testare le tue conoscenze.</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-semibold text-blue-800">Modalità Interazione</h5>
              <p className="text-sm text-blue-700">Conversazione libera con l'AI su qualsiasi argomento di studio.</p>
            </div>
            <div className="bg-pink-50 p-4 rounded-lg">
              <h5 className="font-semibold text-pink-800">Modalità Intervista Impossibile</h5>
              <p className="text-sm text-pink-700">Intervista personaggi storici interpretati dall'AI con accuratezza storica.</p>
            </div>
          </div>
          <p className="mt-4">Seleziona grado scolastico, modalità, argomento e modello AI per iniziare!</p>
        </div>
      )
    },
    '/image-generator': {
      title: 'Tutorial Image Generator',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Generazione Immagini AI</h4>
          <p className="mb-4">Crea immagini uniche usando l'intelligenza artificiale:</p>
          <ol className="list-decimal list-inside space-y-2 mb-4">
            <li>Scrivi una descrizione dettagliata dell'immagine desiderata</li>
            <li>Scegli le dimensioni e il numero di immagini</li>
            <li>Seleziona il modello AI (DALL-E, Stable Diffusion, etc.)</li>
            <li>Clicca "Genera" e attendi il risultato</li>
          </ol>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h5 className="font-semibold text-yellow-800">💡 Suggerimenti</h5>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
              <li>• Usa descrizioni specifiche e dettagliate</li>
              <li>• Indica lo stile artistico desiderato</li>
              <li>• Specifica colori, atmosfera e composizione</li>
            </ul>
          </div>
        </div>
      )
    },
    '/image-classifier': {
      title: 'Tutorial Image Classifier',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Classificazione Immagini</h4>
          <p className="mb-4">Analizza e classifica immagini usando modelli di machine learning:</p>
          <div className="space-y-3 mb-4">
            <div className="flex items-start space-x-3">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <p>Carica un'immagine dal tuo dispositivo o usa la webcam</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <p>Seleziona il modello di classificazione appropriato</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <p>Avvia l'analisi e visualizza i risultati con percentuali di confidenza</p>
            </div>
          </div>
          <p>Perfetto per progetti educativi e riconoscimento di oggetti, animali, piante e molto altro!</p>
        </div>
      )
    },
    '/data-analysis': {
      title: 'Tutorial Data Analysis',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Analisi Dati Intelligente</h4>
          <p className="mb-4">Carica e analizza dataset con l'aiuto dell'intelligenza artificiale:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <h5 className="font-semibold text-green-800">📊 Formati Supportati</h5>
              <ul className="text-sm text-green-700 mt-1">
                <li>• CSV, Excel, JSON</li>
                <li>• TSV, Parquet</li>
                <li>• Database exports</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <h5 className="font-semibold text-blue-800">🔍 Analisi Automatiche</h5>
              <ul className="text-sm text-blue-700 mt-1">
                <li>• Statistiche descrittive</li>
                <li>• Correlazioni</li>
                <li>• Visualizzazioni</li>
              </ul>
            </div>
          </div>
          <p>L'AI ti fornirà insights automatici e suggerimenti per esplorare i tuoi dati in modo più efficace.</p>
        </div>
      )
    },
    '/resources': {
      title: 'Tutorial Resource Manager',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Gestione Risorse</h4>
          <p className="mb-4">Organizza e gestisci tutti i tuoi materiali educativi in un unico posto:</p>
          <div className="space-y-3 mb-4">
            <div className="bg-indigo-50 p-3 rounded-lg">
              <h5 className="font-semibold text-indigo-800">📁 Upload Files</h5>
              <p className="text-sm text-indigo-700">Carica documenti, immagini, video e altri materiali</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <h5 className="font-semibold text-purple-800">🏷️ Organizzazione</h5>
              <p className="text-sm text-purple-700">Crea cartelle, aggiungi tag e descrizioni</p>
            </div>
            <div className="bg-pink-50 p-3 rounded-lg">
              <h5 className="font-semibold text-pink-800">🔍 Ricerca Avanzata</h5>
              <p className="text-sm text-pink-700">Trova rapidamente i file usando filtri intelligenti</p>
            </div>
          </div>
          <p>Accesso rapido a tutti i materiali per progetti AI e attività didattiche.</p>
        </div>
      )
    },
    '/rag': {
      title: 'Tutorial RAG & Knowledge Base',
      content: (
        <div>
          <h4 className="text-lg font-semibold mb-3">Gestione Knowledge Base Multiple</h4>
          <p className="mb-4">Organizza i tuoi documenti in collezioni tematiche e avvia chat dedicate:</p>
          <div className="space-y-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <h5 className="font-semibold text-blue-800">📚 Crea Knowledge Base</h5>
              <p className="text-sm text-blue-700">Raggruppa documenti per argomento con configurazioni personalizzate</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <h5 className="font-semibold text-green-800">💬 Chat Specifica</h5>
              <p className="text-sm text-green-700">Avvia conversazioni limitate ai documenti di una KB specifica</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <h5 className="font-semibold text-purple-800">📊 Statistiche Dettagliate</h5>
              <p className="text-sm text-purple-700">Monitora performance e contenuti di ogni knowledge base</p>
            </div>
          </div>
          <p>Perfetto per organizzare materiali didattici per materia o progetto!</p>
        </div>
      )
    },
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const openTutorial = (path) => {
    setActiveTutorial(path);
  };

  const closeTutorial = () => {
    setActiveTutorial(null);
  };



  // Stili Liquid Glass per NavLink - palette Golinelli AI
  const getNavLinkClass = (isActive) => {
    const baseClass = "relative flex items-center gap-3 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-500 ease-out backdrop-blur-xl border border-white/10 overflow-hidden group";
    if (isActive) {
      return `${baseClass} bg-gradient-to-r from-pink-500/20 to-blue-500/20 text-blue-900 shadow-lg shadow-pink-500/20 border-pink-400/30`;
    }
    return `${baseClass} bg-white/5 text-slate-700 hover:bg-white/10 hover:text-blue-800 hover:shadow-lg hover:shadow-white/20 hover:border-white/20`;
  };

  const getMobileNavLinkClass = (isActive) => {
    const baseClass = "relative flex items-center gap-3 px-5 py-4 rounded-lg text-base font-medium transition-all duration-500 ease-out backdrop-blur-xl border border-white/10 overflow-hidden group";
    if (isActive) {
      return `${baseClass} bg-gradient-to-r from-pink-500/20 to-blue-500/20 text-blue-900 shadow-lg shadow-pink-500/20 border-pink-400/30`;
    }
    return `${baseClass} bg-white/5 text-slate-700 hover:bg-white/10 hover:text-blue-800 hover:shadow-lg hover:shadow-white/20 hover:border-white/20`;
  };

  const TutorialButton = ({ path, isActive }) => {
    if (!isActive || !tutorialContent[path]) return null;
    
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openTutorial(path);
        }}
        className="ml-2 p-2 text-pink-600/80 hover:text-pink-800 transition-all duration-300 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 hover:bg-white/30 hover:shadow-lg shadow-pink-500/20"
        title="Apri tutorial"
      >
        <FaQuestionCircle size={14} />
      </button>
    );
  };

  return (
    <>
      {/* Navbar Liquid Glass - FIXED OVERLAY */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        {/* Liquid Glass Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-blue-50/70 to-pink-50/80 backdrop-blur-2xl border-b border-white/20 shadow-2xl shadow-pink-500/10"></div>
        
        <div className="relative w-full px-6">
          <div className="flex justify-between items-center h-24">
            {/* Logo senza cornice */}
            <Link to={location.pathname === '/' ? '/' : '/home'} className="flex items-center group">
                              <img 
                  src="/golinelliAI.png" 
                  alt="Golinelli AI Logo" 
                  className="h-12 w-auto filter drop-shadow-lg transition-all duration-500 group-hover:drop-shadow-xl"
                />
            </Link>

            {/* Condizionale: se siamo sulla landing page (/) mostra solo auth, altrimenti navbar completa */}
            {location.pathname === '/' ? (
              /* Landing Page - Solo Auth Links */
              <div className="flex items-center space-x-4">
                <Link to="/login" className="relative px-8 py-4 rounded-lg bg-gradient-to-r from-pink-500/90 to-blue-500/90 backdrop-blur-xl text-white font-medium transition-all duration-500 hover:from-pink-600/90 hover:to-blue-600/90 shadow-lg shadow-pink-500/30 border border-white/20 flex items-center gap-3 group overflow-hidden">
                  <MenuIcon iconClass="fi fi-rr-sign-in-alt" size="text-sm" />
                  <span>Login</span>
                </Link>
                <Link to="/register" className="relative px-6 py-4 rounded-lg bg-white/10 backdrop-blur-xl text-blue-700 font-medium transition-all duration-500 hover:bg-white/20 hover:text-blue-800 border border-white/20 flex items-center gap-3 group overflow-hidden">
                  <MenuIcon iconClass="fi fi-rr-user-add" size="text-sm" />
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              /* Pagine normali - Navbar completa */
              <>
                {/* Link di Navigazione Desktop */}
                <div className="hidden md:flex items-center space-x-4">
                  <NavLink to="/home" className={({isActive}) => getNavLinkClass(isActive)} end>
                    <MenuIcon iconClass="fi fi-rr-home" />
                    <span>Home</span>
                    <TutorialButton path="/home" isActive={location.pathname === '/home'} />
                  </NavLink>
                  {isAuthenticated && (
                    <>
                      <NavLink to="/image-generator" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-picture" />
                        <span>Image Gen</span>
                        <TutorialButton path="/image-generator" isActive={location.pathname === '/image-generator'} />
                      </NavLink>
                      <NavLink to="/image-classifier" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-eye" />
                        <span>Image Classifier</span>
                        <TutorialButton path="/image-classifier" isActive={location.pathname === '/image-classifier'} />
                      </NavLink>
                      <NavLink to="/resources" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-folder" />
                        <span>Resources</span>
                        <TutorialButton path="/resources" isActive={location.pathname === '/resources'} />
                      </NavLink>
                      <NavLink to="/data-analysis" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-stats" />
                        <span>Data Analysis</span>
                        <TutorialButton path="/data-analysis" isActive={location.pathname === '/data-analysis'} />
                      </NavLink>
                      <NavLink to="/chatbot" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-comment-alt" />
                        <span>Chatbot</span>
                        <TutorialButton path="/chatbot" isActive={location.pathname === '/chatbot'} />
                      </NavLink>
                      <NavLink to="/rag" className={({isActive}) => getNavLinkClass(isActive)}>
                        <MenuIcon iconClass="fi fi-rr-database" />
                        <span>RAG & KB</span>
                        <TutorialButton path="/rag" isActive={location.pathname === '/rag' || location.pathname === '/knowledge-bases'} />
                      </NavLink>
                    </>
                  )}
                </div>

                {/* Auth Links / User Menu (Desktop) */}
                <div className="hidden md:flex items-center space-x-4">
                  {isAuthenticated ? (
                    <div className="relative">
                      <button 
                        onClick={toggleUserMenu} 
                        className="transition-all duration-500 hover:shadow-xl hover:shadow-pink-500/40 group relative" 
                        aria-label="User menu" 
                        aria-haspopup="true"
                      > 
                        <UserAvatar 
                          user={user} 
                          size="lg" 
                          className="hover:scale-110 transition-transform duration-300"
                          showBorder={true}
                          borderColor="border-white/20"
                        />
                      </button>
                      {isUserMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-3 w-56 rounded-xl shadow-2xl shadow-pink-500/20 py-3 bg-white/90 backdrop-blur-2xl border border-white/20 z-20" role="menu">
                          <div className="px-5 py-4 border-b border-white/20">
                            <div className="text-sm font-semibold text-gray-900">{user?.username || 'User'}</div>
                            {user?.email && <div className="text-xs text-gray-600 mt-1">{user.email}</div>}
                          </div>
                          <Link 
                            to="/profile" 
                            onClick={() => {setIsUserMenuOpen(false); closeMobileMenu();}} 
                            className="block px-5 py-4 text-sm text-gray-700 hover:bg-white/20 hover:text-blue-800 transition-all duration-300 flex items-center gap-3 rounded-lg mx-2 mt-2 backdrop-blur-sm border border-transparent hover:border-white/20" 
                            role="menuitem"
                          >
                            <MenuIcon iconClass="fi fi-rr-user" size="text-sm" />
                            <span>Your Profile</span>
                          </Link>
                          <button 
                            onClick={handleLogout} 
                            className="block w-full text-left px-5 py-4 text-sm text-red-600 hover:bg-red-50/50 hover:text-red-700 transition-all duration-300 flex items-center gap-3 rounded-lg mx-2 backdrop-blur-sm border border-transparent hover:border-red-200/30" 
                            role="menuitem"
                          >
                            <MenuIcon iconClass="fi fi-rr-sign-out-alt" size="text-sm" />
                            <span>Sign out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <Link to="/login" className="relative px-8 py-4 rounded-lg bg-gradient-to-r from-pink-500/90 to-blue-500/90 backdrop-blur-xl text-white font-medium transition-all duration-500 hover:from-pink-600/90 hover:to-blue-600/90 shadow-lg shadow-pink-500/30 border border-white/20 flex items-center gap-3 group overflow-hidden">
                        <MenuIcon iconClass="fi fi-rr-sign-in-alt" size="text-sm" />
                        <span>Login</span>
                      </Link>
                      <Link to="/register" className="relative px-6 py-4 rounded-lg bg-white/10 backdrop-blur-xl text-blue-700 font-medium transition-all duration-500 hover:bg-white/20 hover:text-blue-800 border border-white/20 flex items-center gap-3 group overflow-hidden">
                        <MenuIcon iconClass="fi fi-rr-user-add" size="text-sm" />
                        <span>Register</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <div className="md:hidden flex items-center">
                  <button 
                    onClick={toggleMobileMenu} 
                    type="button" 
                    className="inline-flex items-center justify-center p-4 rounded-lg bg-white/10 backdrop-blur-xl text-blue-600 hover:text-blue-800 hover:bg-white/20 transition-all duration-500 border border-white/20 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20" 
                    aria-controls="mobile-menu" 
                    aria-expanded={isMobileMenuOpen}
                  >
                    <span className="sr-only">Open main menu</span>
                    {isMobileMenuOpen ? (
                      <FaTimes className="block h-6 w-6 transition-transform duration-300 rotate-90" />
                    ) : (
                      <svg className="block h-6 w-6 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Liquid Glass */}
        {location.pathname !== '/' && isMobileMenuOpen && (
          <div className="md:hidden bg-white/80 backdrop-blur-2xl border-t border-white/20 shadow-2xl shadow-pink-500/10" id="mobile-menu">
            <div className="relative px-6 pt-6 pb-8 space-y-3">
              <NavLink to="/home" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu} end>
                <MenuIcon iconClass="fi fi-rr-home" />
                <span>Home</span>
                <TutorialButton path="/home" isActive={location.pathname === '/home'} />
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/image-generator" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-picture" />
                    <span>Image Gen</span>
                    <TutorialButton path="/image-generator" isActive={location.pathname === '/image-generator'} />
                  </NavLink>
                  <NavLink to="/image-classifier" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-eye" />
                    <span>Image Classifier</span>
                    <TutorialButton path="/image-classifier" isActive={location.pathname === '/image-classifier'} />
                  </NavLink>
                  <NavLink to="/resources" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-folder" />
                    <span>Resources</span>
                    <TutorialButton path="/resources" isActive={location.pathname === '/resources'} />
                  </NavLink>
                  <NavLink to="/data-analysis" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-stats" />
                    <span>Data Analysis</span>
                    <TutorialButton path="/data-analysis" isActive={location.pathname === '/data-analysis'} />
                  </NavLink>
                  <NavLink to="/chatbot" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-comment-alt" />
                    <span>Chatbot</span>
                    <TutorialButton path="/chatbot" isActive={location.pathname === '/chatbot'} />
                  </NavLink>
                  <NavLink to="/rag" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                    <MenuIcon iconClass="fi fi-rr-database" />
                    <span>RAG & Knowledge Base</span>
                    <TutorialButton path="/rag" isActive={location.pathname === '/rag' || location.pathname === '/knowledge-bases'} />
                  </NavLink>
                </>
              )}
               {/* Auth Links Mobile */}
              {!isAuthenticated ? (
                   <>
                      <NavLink to="/login" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                        <MenuIcon iconClass="fi fi-rr-sign-in-alt" />
                        Login
                      </NavLink>
                      <NavLink to="/register" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                        <MenuIcon iconClass="fi fi-rr-user-add" />
                        Register
                      </NavLink>
                   </>
               ) : (
                  <div className="pt-6 pb-4 border-t border-white/20 mt-6">
                      <div className="flex items-center px-5 mb-6 p-4 rounded-lg bg-white/10 backdrop-blur-xl border border-white/20">
                           <div className="flex-shrink-0">
                               <UserAvatar 
                                 user={user} 
                                 size="lg" 
                                 showBorder={true}
                                 borderColor="border-white/20"
                               />
                           </div>
                           <div className="ml-4">
                               <div className="text-base font-semibold text-gray-900">{user?.username || 'User'}</div>
                               {user?.email && <div className="text-sm text-gray-600 mt-1">{user.email}</div>}
                           </div>
                      </div>
                      <div className="space-y-3">
                          <NavLink to="/profile" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                            <MenuIcon iconClass="fi fi-rr-user" />
                            Your Profile
                          </NavLink>
                          <button onClick={handleLogout} className="w-full text-left text-red-600 hover:bg-red-50/50 hover:text-red-700 px-5 py-4 rounded-lg text-base font-medium transition-all duration-500 flex items-center gap-3 backdrop-blur-xl border border-white/10 hover:border-red-200/30">
                            <MenuIcon iconClass="fi fi-rr-sign-out-alt" />
                            Sign out
                          </button>
                      </div>
                  </div>
               )}
            </div>
          </div>
        )}
      </nav>

      {/* Modale Tutorial */}
      {activeTutorial && tutorialContent[activeTutorial] && (
        <TutorialModal
          isOpen={!!activeTutorial}
          onClose={closeTutorial}
          title={tutorialContent[activeTutorial].title}
          content={tutorialContent[activeTutorial].content}
        />
      )}
    </>
  );
};

export default Navbar;