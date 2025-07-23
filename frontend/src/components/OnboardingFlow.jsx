import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserService from '../hooks/useUserService';
import { userService } from '../services/userService';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight, FaArrowLeft, FaCheck, FaRocket } from 'react-icons/fa';
import toast from 'react-hot-toast';

const OnboardingFlow = ({ authMethod = 'normal' }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { user } = useAuth();
  const { updateProfile, validateProfileData } = useUserService();
  const navigate = useNavigate();

  // Form data basato sul metodo di autenticazione
  const [formData, setFormData] = useState(() => {
    // Check if coming from registration
    const registrationData = sessionStorage.getItem('registrationData');
    if (registrationData) {
      const data = JSON.parse(registrationData);
      return {
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        email: data.email || '',
        password: '',
        confirmPassword: '',
        phone_number: '',
        bio: '',
        date_of_birth: '',
        marketing_consent: false,
        terms_accepted: false
      };
    }
    
    // Google authentication data setup
    
    // Default state for other cases
    return {
      first_name: '',
      last_name: '',
      username: '',
      email: authMethod === 'google' ? user?.email || '' : '',
      password: '',
      confirmPassword: '',
      phone_number: '',
      bio: '',
      date_of_birth: '',
      marketing_consent: false,
      terms_accepted: false
    };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Steps configuration based on auth method and registration completion
  const getSteps = () => {
    const registrationData = sessionStorage.getItem('registrationData');
    const parsedData = registrationData ? JSON.parse(registrationData) : null;
    const isFromRegistration = !!parsedData;
    
    // Check both sessionStorage and URL params for registration completion
    const urlParams = new URLSearchParams(location.search);
    const completedFromUrl = urlParams.get('completed') === 'true';
    const registrationCompleted = parsedData?.registrationCompleted || completedFromUrl;
    
    // Onboarding steps configuration
    
    if (authMethod === 'google') {
      // Google sempre richiede tutti i dati (registration_completed è sempre false)
      return [
        {
          id: 1,
          title: 'Informazioni Personali',
          subtitle: 'Inserisci i tuoi dati principali',
          fields: ['first_name', 'last_name', 'username']
        },
        {
          id: 2,
          title: 'Informazioni Aggiuntive',
          subtitle: 'Completa il tuo profilo (opzionale)',
          fields: ['phone_number', 'date_of_birth', 'bio']
        },
        {
          id: 3,
          title: 'Preferenze',
          subtitle: 'Conferma le tue preferenze',
          fields: ['marketing_consent', 'terms_accepted']
        }
      ];
    } else {
      // Registrazione normale - step dipendono da registration_completed
      if (isFromRegistration && registrationCompleted) {
        // Registrazione completa - solo step opzionali
        return [
          {
            id: 1,
            title: 'Informazioni Aggiuntive',
            subtitle: 'Completa il tuo profilo (opzionale)',
            fields: ['phone_number', 'date_of_birth', 'bio']
          },
          {
            id: 2,
            title: 'Preferenze',
            subtitle: 'Conferma le tue preferenze',
            fields: ['marketing_consent', 'terms_accepted']
          }
        ];
      } else if (isFromRegistration && !registrationCompleted) {
        // Registrazione incompleta - chiedi campi mancanti + opzionali
        return [
          {
            id: 1,
            title: 'Completa Informazioni',
            subtitle: 'Inserisci i dati mancanti',
            fields: ['first_name', 'last_name', 'username'] // Email già inserita
          },
          {
            id: 2,
            title: 'Informazioni Aggiuntive',
            subtitle: 'Completa il tuo profilo (opzionale)',
            fields: ['phone_number', 'date_of_birth', 'bio']
          },
          {
            id: 3,
            title: 'Preferenze',
            subtitle: 'Conferma le tue preferenze',
            fields: ['marketing_consent', 'terms_accepted']
          }
        ];
      } else {
        // Flusso originale per registrazione senza pre-dati
        return [
          {
            id: 1,
            title: 'Credenziali Account',
            subtitle: 'Crea le tue credenziali di accesso',
            fields: ['username', 'email', 'password', 'confirmPassword']
          },
          {
            id: 2,
            title: 'Informazioni Personali',
            subtitle: 'Inserisci i tuoi dati personali',
            fields: ['first_name', 'last_name', 'phone_number', 'date_of_birth']
          },
          {
            id: 3,
            title: 'Finalizzazione',
            subtitle: 'Completa la registrazione',
            fields: ['bio', 'marketing_consent', 'terms_accepted']
          }
        ];
      }
    }
  };

  const steps = getSteps();
  const totalSteps = steps.length;

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Validate current step
  const validateCurrentStep = () => {
    const currentStepData = steps.find(step => step.id === currentStep);
    const stepErrors = {};

    currentStepData.fields.forEach(field => {
      if (field === 'first_name' && !formData.first_name.trim()) {
        stepErrors.first_name = 'Nome è obbligatorio';
      }
      if (field === 'last_name' && !formData.last_name.trim()) {
        stepErrors.last_name = 'Cognome è obbligatorio';
      }
      if (field === 'username' && !formData.username.trim()) {
        stepErrors.username = 'Username è obbligatorio';
      }
      if (field === 'email' && authMethod === 'normal' && !formData.email.trim()) {
        stepErrors.email = 'Email è obbligatoria';
      }
      if (field === 'email' && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        stepErrors.email = 'Email non valida';
      }
      if (field === 'password' && authMethod === 'normal' && !formData.password) {
        stepErrors.password = 'Password è obbligatoria';
      }
      if (field === 'password' && authMethod === 'normal' && formData.password && formData.password.length < 8) {
        stepErrors.password = 'Password deve essere di almeno 8 caratteri';
      }
      if (field === 'confirmPassword' && authMethod === 'normal' && formData.password !== formData.confirmPassword) {
        stepErrors.confirmPassword = 'Le password non corrispondono';
      }
      if (field === 'terms_accepted' && !formData.terms_accepted) {
        stepErrors.terms_accepted = 'Devi accettare i termini di servizio';
      }
    });

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleComplete();
      }
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Handle completion
  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Prepare data for User Service
      const profileData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        email: formData.email,
        phone_number: formData.phone_number || '',
        bio: formData.bio || '',
        date_of_birth: formData.date_of_birth || null,
        registration_completed: true // Mark registration as completed
      };

      // Debug per verificare i dati che vengono salvati
          // Saving onboarding profile data

      try {
        // For social auth (Google), try to update existing profile first
        if (authMethod === 'google') {
          await updateProfile(profileData);
        } else {
          // For normal registration, user profile might not exist yet
          // Try to create profile first, if it fails, try update
          try {
            await userService.createProfile(profileData);
          } catch (createError) {
            // If creation fails (profile might exist), try update
            // Create profile failed, trying update fallback
            await updateProfile(profileData);
          }
        }
      } catch (profileError) {
        // Fallback: try the opposite method
                  // Primary profile operation failed, trying fallback
        if (authMethod === 'google') {
          await userService.createProfile(profileData);
        } else {
          await updateProfile(profileData);
        }
      }

      toast.success('Profilo completato con successo! Benvenuto su PL-AI! 🚀');
      
      // Clear registration data from sessionStorage
      sessionStorage.removeItem('registrationData');
      
      // Redirect to home
      navigate('/home', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Errore durante il salvataggio del profilo. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get progress percentage
  const getProgress = () => {
    return (currentStep / totalSteps) * 100;
  };

  // Render field based on type
  const renderField = (fieldName) => {
    const commonInputClass = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200";

    switch (fieldName) {
      case 'first_name':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nome *
            </label>
            <div className="relative">
              <FaUser className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                className={`${commonInputClass} pl-10 ${errors.first_name ? 'border-red-500' : ''}`}
                placeholder="Il tuo nome"
              />
            </div>
            {errors.first_name && <p className="text-sm text-red-600">{errors.first_name}</p>}
          </div>
        );

      case 'last_name':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Cognome *
            </label>
            <div className="relative">
              <FaUser className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                className={`${commonInputClass} pl-10 ${errors.last_name ? 'border-red-500' : ''}`}
                placeholder="Il tuo cognome"
              />
            </div>
            {errors.last_name && <p className="text-sm text-red-600">{errors.last_name}</p>}
          </div>
        );

      case 'username':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Username *
            </label>
            <div className="relative">
              <FaUser className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={`${commonInputClass} pl-10 ${errors.username ? 'border-red-500' : ''}`}
                placeholder="Scegli un username unico"
                required
              />
            </div>
            {errors.username && <p className="text-sm text-red-600">{errors.username}</p>}
          </div>
        );

      case 'email':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email {authMethod === 'normal' ? '*' : '(da Google)'}
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={authMethod === 'google'}
                className={`${commonInputClass} pl-10 ${authMethod === 'google' ? 'bg-gray-100' : ''} ${errors.email ? 'border-red-500' : ''}`}
                placeholder="La tua email"
              />
            </div>
            {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
          </div>
        );

      case 'password':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Password *
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`${commonInputClass} pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                placeholder="Crea una password sicura"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
          </div>
        );

      case 'confirmPassword':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Conferma Password *
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`${commonInputClass} pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="Ripeti la password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>
        );

      case 'phone_number':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Telefono (opzionale)
            </label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              className={commonInputClass}
              placeholder="+39 123 456 7890"
            />
          </div>
        );

      case 'date_of_birth':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Data di nascita (opzionale)
            </label>
            <input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              className={commonInputClass}
            />
          </div>
        );

      case 'bio':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Presentati (opzionale)
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows="4"
              className={commonInputClass}
              placeholder="Raccontaci qualcosa di te..."
              maxLength="500"
            />
            <p className="text-xs text-gray-500">{formData.bio.length}/500 caratteri</p>
          </div>
        );

      case 'marketing_consent':
        return (
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="marketing_consent"
              checked={formData.marketing_consent}
              onChange={(e) => handleInputChange('marketing_consent', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="marketing_consent" className="text-sm text-gray-700">
              Accetto di ricevere comunicazioni di marketing e aggiornamenti sui prodotti
            </label>
          </div>
        );

      case 'terms_accepted':
        return (
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="terms_accepted"
              checked={formData.terms_accepted}
              onChange={(e) => handleInputChange('terms_accepted', e.target.checked)}
              className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${errors.terms_accepted ? 'border-red-500' : ''}`}
            />
            <label htmlFor="terms_accepted" className="text-sm text-gray-700">
              Accetto i <a href="#" className="text-blue-600 hover:underline">Termini di Servizio</a> e la <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a> *
            </label>
            {errors.terms_accepted && <p className="text-sm text-red-600 mt-1">{errors.terms_accepted}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepData = steps.find(step => step.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <FaRocket className="text-3xl text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              Benvenuto su PL-AI!
            </h1>
            <p className="text-indigo-100 mb-4">
              {currentStepData.subtitle}
            </p>
            
            {/* Progress bar */}
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
            <p className="text-white/80 text-sm mt-2">
              Step {currentStep} di {totalSteps}
            </p>
          </div>

          {/* Form Content */}
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {currentStepData.title}
            </h2>

            <div className="space-y-6">
              {currentStepData.fields.map(field => (
                <div key={field}>
                  {renderField(field)}
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  currentStep === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FaArrowLeft />
                Indietro
              </button>

              <button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : currentStep === totalSteps ? (
                  <>
                    <FaCheck />
                    Completa
                  </>
                ) : (
                  <>
                    Avanti
                    <FaArrowRight />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow; 