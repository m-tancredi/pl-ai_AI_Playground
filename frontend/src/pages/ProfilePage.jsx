import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/authService'; // API call to get full profile

const ProfilePage = () => {
  const { user: contextUser } = useAuth(); // User info from token (might be basic)
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getUserProfile(); // Fetch full profile from API
        setProfileData(data);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError('Could not load profile data. Please try again later.');
        // You might want to check if the error is 401 and trigger logout
        if (err.response?.status === 401) {
             // Handle unauthorized access - perhaps trigger logout via context or event
             // logout(); // If logout function is available directly
             window.dispatchEvent(new CustomEvent('auth-logout-event'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []); // Fetch on component mount

  if (loading) {
    return (
      <div className="flex justify-center items-center pt-10">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-lg">Loading Profile...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-600">{error}</p>;
  }

  // Use fetched profileData if available, otherwise fallback to contextUser
  const displayUser = profileData || contextUser;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-lg mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">Your Profile</h2>
      {displayUser ? (
        <div className="space-y-3 text-gray-700">
          <p><strong>ID:</strong> {displayUser.id}</p>
          <p><strong>Username:</strong> {displayUser.username}</p>
          <p><strong>Email:</strong> {displayUser.email}</p>
          <p><strong>First Name:</strong> {displayUser.first_name || 'N/A'}</p>
          <p><strong>Last Name:</strong> {displayUser.last_name || 'N/A'}</p>
           {profileData && profileData.date_joined && ( // Show only if full profile loaded
             <p><strong>Date Joined:</strong> {new Date(profileData.date_joined).toLocaleDateString()}</p>
          )}
           {profileData && profileData.last_login && ( // Show only if full profile loaded
             <p><strong>Last Login:</strong> {new Date(profileData.last_login).toLocaleString()}</p>
          )}
          {/* Display other profile fields if available */}
        </div>
      ) : (
        <p>Could not load user information.</p>
      )}
      {/* Optional: Add Edit Profile Button */}
      {/* <button className="mt-6 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded transition duration-300">
        Edit Profile
      </button> */}
    </div>
  );
};

export default ProfilePage;