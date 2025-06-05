import React from 'react';
import { Link } from 'react-router-dom';
import { FaRocket, FaGraduationCap, FaBrain, FaUsers, FaCheckCircle, FaArrowRight } from 'react-icons/fa';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-fade-in-up">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 mb-8">
                PL-AI
              </h1>
              <p className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Il futuro dell'apprendimento è qui
              </p>
              <p className="text-xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
                Scopri la rivoluzione educativa con l'intelligenza artificiale. 
                Una piattaforma innovativa che trasforma il modo di imparare, insegnare e crescere.
              </p>
            </div>

            <div className="animate-fade-in-up delay-300">
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
                <Link
                  to="/register"
                  className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xl rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
                >
                  <FaRocket className="group-hover:animate-pulse" />
                  <span>Inizia Gratis</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>
                
                <Link
                  to="/login"
                  className="group inline-flex items-center gap-3 px-10 py-5 bg-white/80 backdrop-blur-sm text-gray-800 font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl border border-gray-200/50 transform hover:scale-105 transition-all duration-300"
                >
                  <span>Accedi</span>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="animate-fade-in-up delay-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="text-4xl font-black text-indigo-600 mb-2">5</div>
                  <div className="text-sm text-gray-600 font-medium">Strumenti AI</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-purple-600 mb-2">∞</div>
                  <div className="text-sm text-gray-600 font-medium">Possibilità</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-pink-600 mb-2">100%</div>
                  <div className="text-sm text-gray-600 font-medium">Gratuito</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-cyan-600 mb-2">24/7</div>
                  <div className="text-sm text-gray-600 font-medium">Disponibile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black text-gray-900 mb-6">
              Perché scegliere PL-AI?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Una suite completa di strumenti AI progettati specificamente per l'educazione moderna
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="group text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xl">
                <FaBrain className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AI Avanzata</h3>
              <p className="text-gray-600 leading-relaxed">
                Tecnologie di intelligenza artificiale all'avanguardia per un apprendimento personalizzato e efficace
              </p>
            </div>

            <div className="group text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xl">
                <FaGraduationCap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Educazione Innovativa</h3>
              <p className="text-gray-600 leading-relaxed">
                Metodi didattici rivoluzionari che trasformano l'apprendimento in un'esperienza coinvolgente
              </p>
            </div>

            <div className="group text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xl">
                <FaUsers className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Community Attiva</h3>
              <p className="text-gray-600 leading-relaxed">
                Una comunità di educatori e studenti che condividono conoscenze e migliori pratiche
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black text-gray-900 mb-6">
              Strumenti Potenti
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Tutto quello di cui hai bisogno per esplorare il mondo dell'intelligenza artificiale
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '🤖',
                title: 'Chatbot AI',
                description: 'Conversazioni intelligenti per apprendimento personalizzato'
              },
              {
                icon: '🎨',
                title: 'Image Generator',
                description: 'Crea immagini straordinarie con l\'intelligenza artificiale'
              },
              {
                icon: '👁️',
                title: 'Image Classifier',
                description: 'Riconosci e classifica oggetti in tempo reale'
              },
              {
                icon: '📊',
                title: 'Data Analysis',
                description: 'Analizza dati complessi con insights automatici'
              },
              {
                icon: '📁',
                title: 'Resource Manager',
                description: 'Gestisci materiali educativi in modo intelligente'
              },
              {
                icon: '🎯',
                title: 'E molto altro...',
                description: 'Nuove funzionalità in arrivo costantemente'
              }
            ].map((tool, index) => (
              <div key={index} className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl border border-gray-100 transform hover:scale-105 transition-all duration-300">
                <div className="text-5xl mb-6 group-hover:animate-bounce">{tool.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{tool.title}</h3>
                <p className="text-gray-600">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl font-black text-gray-900 mb-8">
                Vantaggi Esclusivi
              </h2>
              <div className="space-y-6">
                {[
                  'Accesso gratuito a tutti gli strumenti AI',
                  'Interfaccia intuitiva e user-friendly',
                  'Supporto multilingue completo',
                  'Aggiornamenti costanti e nuove funzionalità',
                  'Community di supporto attiva',
                  'Privacy e sicurezza garantite'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <FaCheckCircle className="text-green-500 text-xl flex-shrink-0" />
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl p-8 transform rotate-3 shadow-2xl">
                <div className="bg-white rounded-2xl p-6 transform -rotate-3">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🚀</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Pronto per iniziare?
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Unisciti a migliaia di studenti e educatori che stanno già trasformando il loro modo di apprendere
                    </p>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                    >
                      Inizia Ora
                      <FaArrowRight />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-5xl font-black text-white mb-6">
            Il Futuro È Adesso
          </h2>
          <p className="text-xl text-indigo-100 mb-12 leading-relaxed">
            Non aspettare. Inizia oggi il tuo viaggio nell'intelligenza artificiale educativa 
            e scopri un mondo di possibilità infinite
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-3 px-10 py-5 bg-white text-indigo-600 font-black text-xl rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <FaRocket />
              Registrati Gratis
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-3 px-10 py-5 bg-transparent border-2 border-white text-white font-bold text-xl rounded-2xl hover:bg-white hover:text-indigo-600 transform hover:scale-105 transition-all duration-300"
            >
              Hai già un account?
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 