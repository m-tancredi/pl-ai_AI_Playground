import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import useUserService from '../hooks/useUserService';
import toast from 'react-hot-toast';

const UserProfileForm = () => {
  const { user } = useAuth();
  const {
    loading: serviceLoading,
    uploading,
    saving,
    getMyProfile,
    updateProfile,
    getPreferences,
    updatePreferences,
    uploadAvatar,
    validateProfileData,
    formatProfileData
  } = useUserService();
  
  // State del form
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    email: '',
    phone_number: '',
    bio: '',
    location: '',
    date_of_birth: '',
  });
  
  const [preferences, setPreferences] = useState({
    theme: 'light',
    notifications: {
      email: true,
      push: false,
      marketing: false
    },
    privacy: {
      profile_visible: true,
      activity_visible: false
    }
  });

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Carica dati iniziali
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Carica profilo e preferenze in parallelo
      const [profileData, preferencesData] = await Promise.all([
        getMyProfile(),
        getPreferences()
      ]);

      setProfile(profileData);
      setPreferences(prev => ({ ...prev, ...preferencesData }));
      
      if (profileData.profile_picture_url) {
        setAvatarPreview(profileData.profile_picture_url);
      }
    } catch (error) {
      // Error già gestito dal hook
      console.error('Errore caricamento dati:', error);
    }
  };

  // Gestione input form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    
    // Rimuovi errore di validazione quando l'utente inizia a modificare
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Gestione preferenze
  const handlePreferenceChange = (category, key, value) => {
    setPreferences(prev => ({
      ...prev,
      [category]: typeof prev[category] === 'object' 
        ? { ...prev[category], [key]: value }
        : value
    }));
  };

  // Gestione avatar
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validazione client-side
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Formato file non supportato. Usa JPG, PNG o GIF.');
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error('File troppo grande. Massimo 5MB.');
        return;
      }

      setAvatar(file);
      
      // Preview
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Validazione form
  const validateForm = () => {
    const validation = validateProfileData(profile);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  // Salvataggio profilo
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Correggi gli errori nel form');
      return;
    }

    try {
      // Aggiorna profilo
      const updatedProfile = await updateProfile(profile);
      
      // Carica avatar se presente
      if (avatar) {
        await uploadAvatar(avatar);
      }

      setProfile(updatedProfile);
    } catch (error) {
      // Error già gestito dal hook
      console.error('Errore aggiornamento profilo:', error);
    }
  };

  // Salvataggio preferenze
  const handleSubmitPreferences = async (e) => {
    e.preventDefault();
    
    try {
      await updatePreferences(preferences);
    } catch (error) {
      // Error già gestito dal hook
      console.error('Errore aggiornamento preferenze:', error);
    }
  };

  if (serviceLoading && !profile.first_name) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Caricamento profilo...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Il Mio Profilo</h1>
        <p className="text-gray-600">Gestisci le tue informazioni personali e preferenze</p>
      </div>

      {/* Avatar Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Foto Profilo</h2>
        <div className="flex items-center space-x-6">
          {avatarPreview ? (
            <img 
              src={avatarPreview} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-500">
                {formatProfileData(profile).initials}
              </span>
            </div>
          )}
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Cambia Foto
            </label>
            <p className="text-sm text-gray-500 mt-2">
              JPG, PNG o GIF. Massimo 5MB.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Informazioni Personali</h2>
        <form onSubmit={handleSubmitProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                name="first_name"
                value={profile.first_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.first_name ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {validationErrors.first_name && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.first_name}</p>
              )}
            </div>

            {/* Cognome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cognome *
              </label>
              <input
                type="text"
                name="last_name"
                value={profile.last_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.last_name ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {validationErrors.last_name && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.last_name}</p>
              )}
            </div>
          </div>

          {/* Nome Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Visualizzazione
            </label>
                          <input
                type="text"
                name="display_name"
                value={profile.display_name || ''}
                onChange={handleInputChange}
                placeholder="Come vuoi essere chiamato"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.email && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
            )}
          </div>

          {/* Telefono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefono
            </label>
                          <input
                type="tel"
                name="phone_number"
                value={profile.phone_number || ''}
                onChange={handleInputChange}
                placeholder="+39 123 456 7890"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.phone_number ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            {validationErrors.phone_number && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.phone_number}</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Biografia
            </label>
            <textarea
              name="bio"
              value={profile.bio || ''}
              onChange={handleInputChange}
              rows="3"
              maxLength="500"
              placeholder="Parlaci di te..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.bio ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <div className="flex justify-between items-center mt-1">
              {validationErrors.bio && (
                <p className="text-red-500 text-sm">{validationErrors.bio}</p>
              )}
              <p className="text-gray-500 text-sm ml-auto">
                {(profile.bio || '').length}/500 caratteri
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Salvataggio...' : 'Salva Profilo'}
            </button>
          </div>
        </form>
      </div>

      {/* Preferenze */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Preferenze</h2>
        <form onSubmit={handleSubmitPreferences} className="space-y-6">
          
          {/* Tema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tema
            </label>
            <select
              value={preferences.theme}
              onChange={(e) => handlePreferenceChange('theme', null, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="light">Chiaro</option>
              <option value="dark">Scuro</option>
              <option value="auto">Automatico</option>
            </select>
          </div>

          {/* Notifiche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notifiche
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications?.email}
                  onChange={(e) => handlePreferenceChange('notifications', 'email', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Notifiche email</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications?.push}
                  onChange={(e) => handlePreferenceChange('notifications', 'push', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Notifiche push</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications?.marketing}
                  onChange={(e) => handlePreferenceChange('notifications', 'marketing', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Email marketing</span>
              </label>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Privacy
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.privacy?.profile_visible}
                  onChange={(e) => handlePreferenceChange('privacy', 'profile_visible', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Profilo pubblico</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.privacy?.activity_visible}
                  onChange={(e) => handlePreferenceChange('privacy', 'activity_visible', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Attività visibile</span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Salvataggio...' : 'Salva Preferenze'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfileForm; 