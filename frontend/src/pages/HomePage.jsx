import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to PL-AI</h1>
      <p className="text-lg text-gray-700 mb-6">
        The platform for exploring prediction learning with AI.
      </p>
      {isAuthenticated ? (
        <div>
          <p className="mb-4">Hello, {user?.username || 'User'}!</p>
          <Link
            to="/regression" // Or profile, or dashboard
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Go to Regression Tool
          </Link>
        </div>
      ) : (
        <div>
          <p className="mb-4">Please log in or register to get started.</p>
          <div className="space-x-4">
            <Link
              to="/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;