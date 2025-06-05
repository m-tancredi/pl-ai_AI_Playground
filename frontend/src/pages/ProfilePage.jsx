import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/authService';
import { 
  FaUser, 
  FaEnvelope, 
  FaCalendarAlt, 
  FaClock, 
  FaEdit, 
  FaCog, 
  FaSignOutAlt,
  FaUserCircle,
  FaIdCard,
  FaStar,
  FaCheck,
  FaSpinner
} from 'react-icons/fa';

const ProfilePage = () => {
  const { user: contextUser, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getUserProfile();
        setProfileData(data);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError('Impossibile caricare i dati del profilo. Riprova più tardi.');
        if (err.response?.status === 401) {
             window.dispatchEvent(new CustomEvent('auth-logout-event'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const displayUser = profileData || contextUser;

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen gradient-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <FaSpinner className="animate-spin text-4xl text-brand-500 mb-4 mx-auto" />
              <p className="text-secondary font-medium">Caricamento profilo...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen gradient-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="card-glass p-8 text-center">
            <div className="text-error-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-default mb-2">Errore di Caricamento</h2>
            <p className="text-secondary mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || displayUser?.username?.charAt(0).toUpperCase() || 'U';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen gradient-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="animate-fade-in mb-8">
          <div className="card-glass p-8 mb-6">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Avatar Section */}
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center shadow-custom-xl">
                  <span className="text-4xl font-bold text-inverse">
                    {getInitials(displayUser?.first_name, displayUser?.last_name)}
                  </span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-success-500 rounded-full flex items-center justify-center shadow-custom-lg">
                  <FaCheck className="text-white text-sm" />
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-default mb-2">
                  {displayUser?.first_name && displayUser?.last_name 
                    ? `${displayUser.first_name} ${displayUser.last_name}`
                    : displayUser?.username || 'Utente'
                  }
                </h1>
                <p className="text-secondary text-lg mb-1">@{displayUser?.username}</p>
                <p className="text-tertiary flex items-center justify-center lg:justify-start gap-2">
                  <FaEnvelope className="w-4 h-4" />
                  {displayUser?.email}
                </p>
                
                {/* Status Badge */}
                <div className="mt-4">
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-success-100 text-success-700 rounded-full text-sm font-medium">
                    <FaStar className="w-3 h-3" />
                    Utente Attivo
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn-primary flex items-center gap-2"
                >
                  <FaEdit className="w-4 h-4" />
                  Modifica Profilo
                </button>
                <button className="btn-secondary flex items-center gap-2">
                  <FaCog className="w-4 h-4" />
                  Impostazioni
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information Card */}
            <div className="card animate-fade-in">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
                    <FaUser className="text-brand-600" />
                  </div>
                  <h2 className="text-xl font-bold text-default">Informazioni Personali</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-tertiary mb-1">Nome</label>
                      <div className="text-default font-medium">
                        {displayUser?.first_name || 'Non specificato'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tertiary mb-1">Cognome</label>
                      <div className="text-default font-medium">
                        {displayUser?.last_name || 'Non specificato'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tertiary mb-1">Username</label>
                      <div className="text-default font-medium">
                        {displayUser?.username}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-tertiary mb-1">Email</label>
                      <div className="text-default font-medium flex items-center gap-2">
                        <FaEnvelope className="w-4 h-4 text-brand-500" />
                        {displayUser?.email}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tertiary mb-1">ID Utente</label>
                      <div className="text-default font-medium flex items-center gap-2">
                        <FaIdCard className="w-4 h-4 text-brand-500" />
                        #{displayUser?.id}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Timeline Card */}
            {profileData && (
              <div className="card animate-fade-in">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center">
                      <FaClock className="text-info-600" />
                    </div>
                    <h2 className="text-xl font-bold text-default">Cronologia Account</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl">
                      <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
                        <FaCalendarAlt className="text-success-600 w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-default">Data di Registrazione</p>
                        <p className="text-secondary text-sm">{formatDate(profileData.date_joined)}</p>
                      </div>
                    </div>
                    
                    {profileData.last_login && (
                      <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl">
                        <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                          <FaClock className="text-brand-600 w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-default">Ultimo Accesso</p>
                          <p className="text-secondary text-sm">{formatDateTime(profileData.last_login)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="card animate-fade-in">
              <div className="p-6">
                <h3 className="text-lg font-bold text-default mb-4">Azioni Rapide</h3>
                <div className="space-y-3">
                  <button className="w-full text-left p-3 rounded-xl hover:bg-neutral-50 transition-all duration-normal flex items-center gap-3">
                    <FaEdit className="text-brand-500" />
                    <span className="text-default">Modifica Profilo</span>
                  </button>
                  <button className="w-full text-left p-3 rounded-xl hover:bg-neutral-50 transition-all duration-normal flex items-center gap-3">
                    <FaCog className="text-neutral-500" />
                    <span className="text-default">Impostazioni Account</span>
                  </button>
                  <button className="w-full text-left p-3 rounded-xl hover:bg-neutral-50 transition-all duration-normal flex items-center gap-3">
                    <FaUserCircle className="text-info-500" />
                    <span className="text-default">Privacy e Sicurezza</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Account Stats Card */}
            <div className="card animate-fade-in">
              <div className="p-6">
                <h3 className="text-lg font-bold text-default mb-4">Statistiche Account</h3>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-primary rounded-xl text-inverse">
                    <div className="text-2xl font-bold">
                      {profileData?.date_joined 
                        ? Math.floor((new Date() - new Date(profileData.date_joined)) / (1000 * 60 * 60 * 24))
                        : '0'
                      }
                    </div>
                    <div className="text-sm opacity-90">Giorni con noi</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-success-50 rounded-xl">
                      <div className="text-lg font-bold text-success-700">Attivo</div>
                      <div className="text-xs text-success-600">Stato</div>
                    </div>
                    <div className="text-center p-3 bg-info-50 rounded-xl">
                      <div className="text-lg font-bold text-info-700">Premium</div>
                      <div className="text-xs text-info-600">Tier</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Section */}
            <div className="card animate-fade-in border-error-200">
              <div className="p-6">
                <h3 className="text-lg font-bold text-default mb-4">Gestione Sessione</h3>
                <button 
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-error-500 hover:bg-error-600 text-white rounded-xl font-medium transition-all duration-normal hover:scale-105 shadow-custom-md hover:shadow-custom-lg"
                >
                  <FaSignOutAlt className="w-4 h-4" />
                  Disconnetti
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;