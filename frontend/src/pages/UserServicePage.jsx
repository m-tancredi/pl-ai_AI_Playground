import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import useUserService from '../hooks/useUserService';
import UserProfileForm from '../components/UserProfileForm';
import toast from 'react-hot-toast';
import {
  UserIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ClockIcon,
  EyeIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const UserServicePage = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    loading,
    getMyProfile,
    getUserStats,
    getAllUsers,
    getPublicProfiles,
    getActivityLogs,
    updateUserStatus,
    formatProfileData
  } = useUserService();

  // State per gestione tabs
  const [activeTab, setActiveTab] = useState('profile');

  // State per dati vari
  const [userStats, setUserStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // State per filtri e ricerca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Carica dati iniziali
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, activeTab]);

  const loadInitialData = async () => {
    try {
      // Carica sempre il profilo utente corrente
      if (!currentUserProfile) {
        await loadCurrentUserProfile();
      }

      switch (activeTab) {
        case 'admin':
          if (user?.is_staff) {
            await Promise.all([
              loadUserStats(),
              loadAllUsers()
            ]);
          }
          break;
        case 'public':
          await loadPublicProfiles();
          break;
        case 'activity':
          await loadActivityLogs();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    }
  };

  // Caricamento profilo utente corrente
  const loadCurrentUserProfile = async () => {
    try {
      const profile = await getMyProfile();
      setCurrentUserProfile(profile);
    } catch (error) {
      console.error('Errore caricamento profilo utente:', error);
    }
  };

  // Caricamento statistiche utenti (solo admin)
  const loadUserStats = async () => {
    try {
      const stats = await getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Errore caricamento statistiche:', error);
    }
  };

  // Caricamento lista utenti (solo admin)
  const loadAllUsers = async () => {
    try {
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;

      const response = await getAllUsers(filters);
      setAllUsers(Array.isArray(response.results) ? response.results : Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Errore caricamento utenti:', error);
      setAllUsers([]);
    }
  };

  // Caricamento profili pubblici
  const loadPublicProfiles = async () => {
    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;

      const response = await getPublicProfiles(filters);
      setPublicProfiles(Array.isArray(response.results) ? response.results : Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Errore caricamento profili pubblici:', error);
      setPublicProfiles([]);
    }
  };

  // Caricamento log attività
  const loadActivityLogs = async () => {
    try {
      const response = await getActivityLogs(null, currentPage);
      setActivityLogs(Array.isArray(response.results) ? response.results : Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Errore caricamento log:', error);
      setActivityLogs([]);
    }
  };

  // Aggiorna stato utente (solo admin)
  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      await updateUserStatus(userId, newStatus);
      await loadAllUsers();
    } catch (error) {
      console.error('Errore aggiornamento stato:', error);
    }
  };

  // Filtro utenti
  const filteredUsers = allUsers.filter(userData => {
    const matchesSearch = !searchTerm || 
      userData.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || userData.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Configurazione tabs
  const tabs = [
    { id: 'profile', name: 'Il Mio Profilo', icon: UserIcon },
    { id: 'public', name: 'Profili Pubblici', icon: EyeIcon },
    { id: 'activity', name: 'Attività', icon: ClockIcon },
    ...(user?.is_staff ? [
      { id: 'admin', name: 'Amministrazione', icon: ShieldCheckIcon }
    ] : [])
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-2 text-lg font-medium text-gray-900">
            Accesso Richiesto
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Effettua il login per accedere alla gestione utenti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestione Utenti
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestisci profili, preferenze e informazioni utente
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <UserIcon className="h-8 w-8 text-blue-600" />
              <span className="text-lg font-medium text-gray-900">
                {currentUserProfile ? formatProfileData(currentUserProfile).displayName : 'Caricamento...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Caricamento...</span>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && !loading && (
          <UserProfileForm />
        )}

        {/* Admin Tab */}
        {activeTab === 'admin' && user?.is_staff && !loading && (
          <div className="space-y-8">
            {/* Statistics Cards */}
            {userStats && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <UserGroupIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500">
                            Utenti Totali
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {userStats.total_users || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ShieldCheckIcon className="h-6 w-6 text-green-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500">
                            Utenti Attivi
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {userStats.active_users || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ClockIcon className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500">
                            Nuovi Oggi
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {userStats.new_today || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <EyeIcon className="h-6 w-6 text-purple-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500">
                            Profili Pubblici
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {userStats.public_profiles || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Management */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Gestione Utenti
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Visualizza e gestisci tutti gli utenti della piattaforma
                </p>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Cerca utenti..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Tutti gli stati</option>
                      <option value="active">Attivi</option>
                      <option value="inactive">Inattivi</option>
                      <option value="pending">In attesa</option>
                      <option value="suspended">Sospesi</option>
                    </select>
                    <button
                      onClick={loadAllUsers}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Filtra
                    </button>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stato
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ultima Attività
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((userData) => {
                      const formatted = formatProfileData(userData);
                      return (
                        <tr key={userData.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {userData.profile_picture_url ? (
                                <img
                                  className="h-8 w-8 rounded-full"
                                  src={userData.profile_picture_url}
                                  alt=""
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-500">
                                    {formatted.initials}
                                  </span>
                                </div>
                              )}
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatted.fullName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {formatted.displayName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {userData.email || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              userData.status === 'active' 
                                ? 'bg-green-100 text-green-800'
                                : userData.status === 'inactive'
                                ? 'bg-gray-100 text-gray-800'
                                : userData.status === 'suspended'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {userData.status || 'active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatted.lastActivityFormatted}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <select
                              value={userData.status || 'active'}
                              onChange={(e) => handleUpdateUserStatus(userData.id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="active">Attivo</option>
                              <option value="inactive">Inattivo</option>
                              <option value="suspended">Sospeso</option>
                              <option value="pending">In attesa</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Nessun utente trovato
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Modifica i filtri per visualizzare altri utenti.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Public Profiles Tab */}
        {activeTab === 'public' && !loading && (
          <div className="space-y-6">
            {/* Search */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Cerca profili pubblici..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={loadPublicProfiles}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Cerca
                </button>
              </div>
            </div>

            {/* Public Profiles Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {publicProfiles.map((profile) => {
                const formatted = formatProfileData(profile);
                return (
                  <div key={profile.id} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-6">
                      <div className="flex items-center">
                        {profile.profile_picture_url ? (
                          <img
                            className="h-12 w-12 rounded-full"
                            src={profile.profile_picture_url}
                            alt=""
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-lg font-medium text-gray-500">
                              {formatted.initials}
                            </span>
                          </div>
                        )}
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            {formatted.displayName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {profile.location || 'Posizione non specificata'}
                          </p>
                        </div>
                      </div>
                      {profile.bio && (
                        <p className="mt-4 text-sm text-gray-600 line-clamp-3">
                          {profile.bio}
                        </p>
                      )}
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          Membro dal {new Date(profile.created_at).toLocaleDateString('it-IT')}
                        </span>
                        <button
                          onClick={() => window.open(`/profile/${profile.id}`, '_blank')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Visualizza →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {publicProfiles.length === 0 && (
              <div className="text-center py-12">
                <EyeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nessun profilo pubblico
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Non ci sono profili pubblici da visualizzare al momento.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && !loading && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Log delle Attività
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Cronologia delle tue attività sulla piattaforma
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {activityLogs.map((log, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {log.action || 'Attività utente'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {log.description || 'Descrizione non disponibile'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(log.timestamp || log.created_at).toLocaleString('it-IT')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {activityLogs.length === 0 && (
              <div className="text-center py-12">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nessuna attività
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Le tue attività appariranno qui una volta iniziate.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserServicePage; 