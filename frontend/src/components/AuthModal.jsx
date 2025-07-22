import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaEnvelope, FaTimes } from 'react-icons/fa';
import { register as apiRegister } from '../services/authService';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Form state
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });

  const { 
    login, 
    signInWithGoogle,
    socialAuthProviders 
  } = useAuth();
  const navigate = useNavigate();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowEmailForm(false);
      setIsLoginMode(true);
      setError('');
      setIsLoading(false); // Reset loading state
      setLoginData({ username: '', password: '' });
      setRegisterData({
        username: '', email: '', password: '', confirmPassword: '',
        first_name: '', last_name: ''
      });
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle social login
  const handleSocialLogin = async (provider) => {
    try {
      setIsLoading(true);
      setError('');
      
      if (provider === 'google') {
        await signInWithGoogle();
        onClose();
      } else {
        throw new Error(`Provider ${provider} non supportato`);
      }
    } catch (error) {
      console.error(`${provider} login failed:`, error);
      setError(`Errore nell'accesso con ${provider}`);
      setIsLoading(false);
    }
  };

  // Handle email login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(loginData);
      onClose();
      navigate('/home');
    } catch (err) {
      console.error("Login failed:", err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.status === 401) {
        setError('Credenziali non valide. Riprova.');
      } else {
        setError('Errore di accesso. Riprova più tardi.');
      }
      setIsLoading(false);
    }
  };

  // Handle email registration
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (registerData.password !== registerData.confirmPassword) {
      setError('Le password non corrispondono.');
      setIsLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...apiData } = registerData;
      await apiRegister(apiData);
      toast.success('Registrazione completata! Effettua ora il login.');
      setIsLoginMode(true);
      setShowEmailForm(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Registration failed:", err);
      let errorMessage = 'Registrazione fallita. Riprova.';
      if (err.response?.data) {
        const errors = err.response.data;
        const messages = Object.keys(errors).map(key =>
          `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(errors[key]) ? errors[key].join(', ') : errors[key]}`
        );
        errorMessage = messages.join(' ');
      }
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden animate-fade-in-scale">
        {/* Header */}
        <div className="relative p-6 text-center border-b border-gray-100">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Accedi alla piattaforma AI Golinelli
          </h2>
          <p className="text-gray-600 text-sm">
            Scopri il futuro dell'educazione con l'intelligenza artificiale
          </p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!showEmailForm ? (
            // Social auth buttons and options
            <div className="space-y-4">
              {/* Google Button */}
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-3"></div>
                    Connessione in corso...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Accedi con Google
                  </>
                )}
              </button>

              {/* Email option */}
              <div className="text-center py-4">
                <span className="text-gray-500 text-sm">Oppure iscriviti con </span>
                <button 
                  onClick={() => setShowEmailForm(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
                >
                  e-mail
                </button>
              </div>

              {/* Toggle login/register */}
              <div className="text-center border-t border-gray-100 pt-4">
                <p className="text-gray-600 text-sm mb-2">
                  {isLoginMode ? "Non hai ancora un account?" : "Hai già un account?"}
                </p>
                <button 
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
                >
                  {isLoginMode ? "Registrati" : "Accedi"}
                </button>
              </div>

              {/* Business info */}
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-gray-500 text-xs">
                  Hai un'attività? 
                  <button className="text-blue-600 hover:text-blue-700 underline ml-1">
                    Scopri di più.
                  </button>
                </p>
              </div>
            </div>
          ) : (
            // Email form (login or register)
            <div>
              <div className="mb-4 text-center">
                <button 
                  onClick={() => setShowEmailForm(false)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  ← Torna alle opzioni di accesso
                </button>
              </div>

              {isLoginMode ? (
                // Login Form
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <FaUser className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Inserisci il tuo username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <FaLock className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Inserisci la tua password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Accesso in corso...' : 'Accedi'}
                  </button>
                </form>
              ) : (
                // Register Form
                <form onSubmit={handleEmailRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={registerData.first_name}
                        onChange={(e) => setRegisterData({...registerData, first_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cognome
                      </label>
                      <input
                        type="text"
                        value={registerData.last_name}
                        onChange={(e) => setRegisterData({...registerData, last_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Cognome"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <FaUser className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Scegli un username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="La tua email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <FaLock className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Crea una password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conferma Password
                    </label>
                    <div className="relative">
                      <FaLock className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ripeti la password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Registrazione in corso...' : 'Crea Account'}
                  </button>
                </form>
              )}

              {/* Toggle login/register in email form */}
              <div className="text-center mt-4 pt-4 border-t border-gray-100">
                <p className="text-gray-600 text-sm mb-2">
                  {isLoginMode ? "Non hai ancora un account?" : "Hai già un account?"}
                </p>
                <button 
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
                >
                  {isLoginMode ? "Registrati" : "Accedi"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal; 