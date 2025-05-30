// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom'; // Aggiunto NavLink per active-styling
import { useAuth } from '../context/AuthContext'; // Verifica path

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Per menu mobile

  const handleLogout = async () => { /* ... come prima ... */ };
  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const getUserInitials = () => { /* ... come prima ... */ };

  // Stile per NavLink attivo
  const activeLinkStyle = "bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium";
  const inactiveLinkStyle = "text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium";
  const mobileActiveLinkStyle = "bg-indigo-700 text-white block px-3 py-2 rounded-md text-base font-medium";
  const mobileInactiveLinkStyle = "text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium";


  return (
    <nav className="bg-gray-800 text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link to="/" className="text-xl font-semibold hover:text-gray-300">PL-AI</Link>

          {/* Link di Navigazione Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            <NavLink to="/" className={({isActive}) => isActive ? activeLinkStyle : inactiveLinkStyle} end>Home</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/image-generator" className={({isActive}) => isActive ? activeLinkStyle : inactiveLinkStyle}>Image Gen</NavLink>
                <NavLink to="/image-classifier" className={({isActive}) => isActive ? activeLinkStyle : inactiveLinkStyle}>Image Classifier</NavLink>
                <NavLink to="/resources" className={({isActive}) => isActive ? activeLinkStyle : inactiveLinkStyle}>Resources</NavLink>
                {/* --- AGGIUNGI LINK QUI --- */}
                <NavLink to="/data-analysis" className={({isActive}) => isActive ? activeLinkStyle : inactiveLinkStyle}>Data Analysis</NavLink>
              </>
            )}
          </div>

          {/* Auth Links / User Menu (Desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button onClick={toggleUserMenu} className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white" aria-label="User menu" aria-haspopup="true"> {getUserInitials()} </button>
                {isUserMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu">
                    {/* ... (link profilo e logout come prima) ... */}
                    <Link to="/profile" onClick={() => {setIsUserMenuOpen(false); closeMobileMenu();}} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Your Profile</Link>
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50" role="menuitem">Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-x-2">
                <Link to="/login" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium">Login</Link>
                <Link to="/register" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Register</Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={toggleMobileMenu} type="button" className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" aria-controls="mobile-menu" aria-expanded={isMobileMenuOpen}>
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? <FaTimes className="block h-6 w-6" /> : <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu} end>Home</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/image-generator" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Image Gen</NavLink>
                <NavLink to="/image-classifier" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Image Classifier</NavLink>
                <NavLink to="/resources" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Resources</NavLink>
                {/* --- AGGIUNGI LINK QUI (MOBILE) --- */}
                <NavLink to="/data-analysis" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Data Analysis</NavLink>
              </>
            )}
             {/* Auth Links Mobile */}
            {!isAuthenticated ? (
                 <>
                    <NavLink to="/login" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Login</NavLink>
                    <NavLink to="/register" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Register</NavLink>
                 </>
             ) : (
                <div className="pt-4 pb-3 border-t border-gray-700">
                    <div className="flex items-center px-5">
                         <div className="flex-shrink-0">
                             <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full text-white font-semibold"> {getUserInitials()} </div>
                         </div>
                         <div className="ml-3">
                             <div className="text-base font-medium text-white">{user?.username || 'User'}</div>
                             {user?.email && <div className="text-sm font-medium text-gray-400">{user.email}</div>}
                         </div>
                    </div>
                    <div className="mt-3 px-2 space-y-1">
                        <NavLink to="/profile" className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileInactiveLinkStyle} onClick={closeMobileMenu}>Your Profile</NavLink>
                        <button onClick={handleLogout} className="w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Sign out</button>
                    </div>
                </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;