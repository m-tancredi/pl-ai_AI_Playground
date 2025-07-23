import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OnboardingFlow from '../components/OnboardingFlow';

const OnboardingPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authMethod, setAuthMethod] = useState('normal');

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // Determine auth method from URL params or user data
    const method = searchParams.get('method');
    const fromRegistration = searchParams.get('fromRegistration');
    
    if (method) {
      setAuthMethod(method);
    } else if (user?.provider) {
      // If user came from social auth
      setAuthMethod(user.provider);
    }
    
    // Clear registration data when onboarding is completed from other sources
    if (!fromRegistration && sessionStorage.getItem('registrationData')) {
      sessionStorage.removeItem('registrationData');
    }
  }, [isAuthenticated, isLoading, navigate, searchParams, user]);

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <OnboardingFlow authMethod={authMethod} />;
};

export default OnboardingPage; 