import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false); // Close menu after logout
    navigate('/login'); // Redirect to login page
  };

  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);

  // Get user initials or a default
  const getUserInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    // Add logic for first/last name if available
    // if (user?.first_name && user?.last_name) {
    //   return (user.first_name[0] + user.last_name[0]).toUpperCase();
    // }
    return '??';
  };

  return (
    <nav className="bg-gray-800 text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link to="/" className="text-xl font-semibold hover:text-gray-300">
            PL-AI
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/" className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
            {isAuthenticated && (
              <>
                {/* Add other main links for logged-in users here */}
                <Link to="/regression" className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">Regression</Link>
                <Link to="/image-generator" className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">Image Gen</Link>
                <Link to="/resources" className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">Resources</Link> {/* <-- NUOVO LINK */}
              </>
            )}
          </div>

          {/* Auth Links / User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                {/* User Avatar/Initials Button */}
                <button
                  onClick={toggleUserMenu}
                  className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                  aria-label="User menu"
                  aria-haspopup="true"
                >
                  {getUserInitials()}
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                  >
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        Signed in as <br/>
                        <strong className="font-medium">{user?.username || 'User'}</strong>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Your Profile
                    </Link>
                    {/* Add other dropdown links here */}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Links for non-authenticated users
              <div className="hidden md:flex items-center space-x-2">
                <Link to="/login" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium">Login</Link>
                <Link to="/register" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Register</Link>
              </div>
            )}
            {/* Mobile Menu Button (Optional) */}
            {/* <div className="md:hidden"> ... </div> */}
          </div>
        </div>
      </div>
       {/* Mobile Menu (Optional) */}
       {/* {isMobileMenuOpen && (...)} */}
    </nav>
  );
};

export default Navbar;