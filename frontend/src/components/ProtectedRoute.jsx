import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserService from '../hooks/useUserService';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { getMyProfile } = useUserService();
  const location = useLocation();
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Check if user needs onboarding when authenticated
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Skip if not authenticated, still loading, or already on onboarding page
      if (!isAuthenticated || isLoading || location.pathname === '/onboarding') {
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        const profile = await getMyProfile();
        
        // Check if user needs onboarding based on registration completion flag
        const requiresOnboarding = !profile || 
          profile.registration_completed !== true;

        setNeedsOnboarding(requiresOnboarding);
        
                    } catch (error) {
        // Profile not found or error, user needs onboarding
        // (new users won't have registration_completed flag set)
        setNeedsOnboarding(true);
      } finally {
        setProfileLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [isAuthenticated, isLoading, location.pathname, getMyProfile]);

  // Listen for the custom logout event triggered by the interceptor
   useEffect(() => {
        const handleLogoutEvent = () => {
            // The AuthContext logout function should handle clearing state and local storage
            // We might just need to ensure navigation happens if not already handled
             // No explicit logout call here needed if AuthContext handles it
             // navigate('/login', { replace: true }); // Navigate could be used if useAuth().logout wasn't sufficient
        };

        window.addEventListener('auth-logout-event', handleLogoutEvent);

        // Cleanup listener on component unmount
        return () => {
            window.removeEventListener('auth-logout-event', handleLogoutEvent);
        };
    }, []); // Empty dependency array ensures this runs only once

  if (isLoading || profileLoading) {
    // Show a loading indicator while checking authentication status and profile
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-4 text-lg">
          {isLoading ? 'Caricamento...' : 'Controllo profilo...'}
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // User not authenticated, redirect to landing page
    // Preserve the location they were trying to access using `state`
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check if user needs onboarding (but allow access to onboarding page itself)
  if (needsOnboarding && location.pathname !== '/onboarding') {
    // Determine auth method for onboarding
    const authMethod = user?.provider === 'google' ? 'google' : 'normal';
    const redirectPath = `/onboarding?method=${authMethod}`;
    
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // User is authenticated and has completed onboarding, render the requested component
  // Outlet is used when nesting routes (see App.jsx)
  // If used directly like <ProtectedRoute><MyComponent /></ProtectedRoute>, use children
  return children ? children : <Outlet />;
};

export default ProtectedRoute;