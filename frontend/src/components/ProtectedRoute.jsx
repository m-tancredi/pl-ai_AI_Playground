import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Listen for the custom logout event triggered by the interceptor
   useEffect(() => {
        const handleLogoutEvent = () => {
            // The AuthContext logout function should handle clearing state and local storage
            // We might just need to ensure navigation happens if not already handled
            console.log("Logout event received by ProtectedRoute, redirecting to login.");
             // No explicit logout call here needed if AuthContext handles it
             // navigate('/login', { replace: true }); // Navigate could be used if useAuth().logout wasn't sufficient
        };

        window.addEventListener('auth-logout-event', handleLogoutEvent);

        // Cleanup listener on component unmount
        return () => {
            window.removeEventListener('auth-logout-event', handleLogoutEvent);
        };
    }, []); // Empty dependency array ensures this runs only once

  if (isLoading) {
    // Show a loading indicator while checking authentication status
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-4 text-lg">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // User not authenticated, redirect to landing page
    // Preserve the location they were trying to access using `state`
    console.log('ProtectedRoute: Not authenticated, redirecting to landing page.');
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User is authenticated, render the requested component
  // Outlet is used when nesting routes (see App.jsx)
  // If used directly like <ProtectedRoute><MyComponent /></ProtectedRoute>, use children
  return children ? children : <Outlet />;
};

export default ProtectedRoute;