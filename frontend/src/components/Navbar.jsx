// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FaTimes, FaQuestionCircle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

// Import icone Flaticon
import '@flaticon/flaticon-uicons/css/all/all.css';

// Componenti Tutorial per ogni pagina
const TutorialModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="prose max-w-none">
            {content}
          </div>
        </div>
        <div className="p-6 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
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

  const getUserInitials = () => {
    if (!user) return 'U';
    
    // Prima priorità: first_name e last_name
    if (user.first_name && user.last_name) {
      return (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
    }
    
    // Seconda priorità: solo first_name
    if (user.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    
    // Terza priorità: solo last_name
    if (user.last_name) {
      return user.last_name.substring(0, 2).toUpperCase();
    }
    
    // Quarta priorità: username (gestisce anche spazi)
    if (user.username) {
      const parts = user.username.trim().split(/\s+/);
      if (parts.length >= 2) {
        // Se username ha più parti, prendi prima lettera di prime due parti
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      } else if (parts[0].length >= 2) {
        // Se username è una sola parola, prendi prime due lettere
        return parts[0].substring(0, 2).toUpperCase();
      } else {
        // Se username è una sola lettera
        return parts[0].charAt(0).toUpperCase();
      }
    }
    
    // Quinta priorità: email
    if (user.email) {
      const emailPart = user.email.split('@')[0];
      if (emailPart.length >= 2) {
        return emailPart.substring(0, 2).toUpperCase();
      } else {
        return emailPart.charAt(0).toUpperCase();
      }
    }
    
    // Fallback finale
    return 'U';
  };

  // Stili per NavLink con effetti di ingrandimento e tutorial button
  const getNavLinkClass = (isActive) => {
    const baseClass = "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out";
    if (isActive) {
      return `${baseClass} bg-gradient-to-r from-purple-500 to-pink-500 text-white transform scale-110 shadow-lg backdrop-blur-sm`;
    }
    return `${baseClass} text-gray-700 hover:bg-purple-100 hover:text-purple-800 hover:scale-105`;
  };

  const getMobileNavLinkClass = (isActive) => {
    const baseClass = "relative flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300 ease-in-out";
    if (isActive) {
      return `${baseClass} bg-gradient-to-r from-purple-500 to-pink-500 text-white transform scale-105 shadow-lg backdrop-blur-sm`;
    }
    return `${baseClass} text-gray-700 hover:bg-purple-100 hover:text-purple-800`;
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
        className="ml-1 p-1 text-white hover:text-yellow-200 transition-colors duration-200"
        title="Apri tutorial"
      >
        <FaQuestionCircle size={14} />
      </button>
    );
  };

  return (
    <>
      {/* Navbar traslucida con colori allineati al main content - FIXED OVERLAY */}
      <nav className="fixed top-0 left-0 right-0 bg-gradient-to-r from-gray-50 to-purple-50 bg-opacity-95 backdrop-blur-md text-gray-800 border-b border-purple-200 border-opacity-30 z-50">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center h-20">
            {/* Logo con più spazio */}
            <Link to={location.pathname === '/' ? '/' : '/home'} className="flex items-center hover:opacity-80 transition-opacity">
              <img 
                src="/plai.png" 
                alt="PL-AI Logo" 
                className="h-12 w-auto"
              />
            </Link>

            {/* Condizionale: se siamo sulla landing page (/) mostra solo auth, altrimenti navbar completa */}
            {location.pathname === '/' ? (
              /* Landing Page - Solo Auth Links */
              <div className="flex items-center space-x-4">
                <Link to="/login" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 shadow-lg flex items-center gap-2">
                  <MenuIcon iconClass="fi fi-rr-sign-in-alt" size="text-sm" />
                  Login
                </Link>
                <Link to="/register" className="text-purple-700 hover:bg-purple-100 hover:text-purple-800 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                  <MenuIcon iconClass="fi fi-rr-user-add" size="text-sm" />
                  Register
                </Link>
              </div>
            ) : (
              /* Pagine normali - Navbar completa */
              <>
                {/* Link di Navigazione Desktop con più spazio */}
                <div className="hidden md:flex items-center space-x-6">
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
                        <span>RAG & Knowledge Base</span>
                        <TutorialButton path="/rag" isActive={location.pathname === '/rag' || location.pathname === '/knowledge-bases'} />
                      </NavLink>
                    </>
                  )}
                </div>

                {/* Auth Links / User Menu (Desktop) con più spazio */}
                <div className="hidden md:flex items-center space-x-6">
                  {isAuthenticated ? (
                    <div className="relative">
                      <button onClick={toggleUserMenu} className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-purple-400 transition-all hover:scale-105 shadow-lg" aria-label="User menu" aria-haspopup="true"> 
                        {getUserInitials()} 
                      </button>
                      {isUserMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-2 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <div className="text-sm font-medium text-gray-900">{user?.username || 'User'}</div>
                            {user?.email && <div className="text-xs text-gray-500">{user.email}</div>}
                          </div>
                          <Link to="/profile" onClick={() => {setIsUserMenuOpen(false); closeMobileMenu();}} className="block px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-800 transition-colors flex items-center gap-2" role="menuitem">
                            <MenuIcon iconClass="fi fi-rr-user" size="text-sm" />
                            Your Profile
                          </Link>
                          <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2" role="menuitem">
                            <MenuIcon iconClass="fi fi-rr-sign-out-alt" size="text-sm" />
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <Link to="/login" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 shadow-lg flex items-center gap-2">
                        <MenuIcon iconClass="fi fi-rr-sign-in-alt" size="text-sm" />
                        Login
                      </Link>
                      <Link to="/register" className="text-purple-700 hover:bg-purple-100 hover:text-purple-800 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                        <MenuIcon iconClass="fi fi-rr-user-add" size="text-sm" />
                        Register
                      </Link>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <div className="md:hidden flex items-center">
                  <button onClick={toggleMobileMenu} type="button" className="inline-flex items-center justify-center p-3 rounded-xl text-purple-600 hover:text-purple-800 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 transition-all" aria-controls="mobile-menu" aria-expanded={isMobileMenuOpen}>
                    <span className="sr-only">Open main menu</span>
                    {isMobileMenuOpen ? <FaTimes className="block h-6 w-6" /> : <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu - Solo se non siamo sulla landing page */}
        {location.pathname !== '/' && isMobileMenuOpen && (
          <div className="md:hidden bg-gradient-to-r from-gray-50 to-purple-50 bg-opacity-98 backdrop-blur-md border-t border-purple-200 border-opacity-50" id="mobile-menu">
            <div className="px-4 pt-4 pb-6 space-y-2 sm:px-6">
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
                  <div className="pt-6 pb-4 border-t border-purple-200 border-opacity-50">
                      <div className="flex items-center px-4 mb-4">
                           <div className="flex-shrink-0">
                               <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold text-lg shadow-lg"> {getUserInitials()} </div>
                           </div>
                           <div className="ml-4">
                               <div className="text-base font-medium text-gray-900">{user?.username || 'User'}</div>
                               {user?.email && <div className="text-sm text-gray-600">{user.email}</div>}
                           </div>
                      </div>
                      <div className="space-y-2 px-2">
                          <NavLink to="/profile" className={({isActive}) => getMobileNavLinkClass(isActive)} onClick={closeMobileMenu}>
                            <MenuIcon iconClass="fi fi-rr-user" />
                            Your Profile
                          </NavLink>
                          <button onClick={handleLogout} className="w-full text-left text-red-600 hover:bg-red-50 hover:text-red-700 block px-4 py-3 rounded-xl text-base font-medium transition-all flex items-center gap-3">
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