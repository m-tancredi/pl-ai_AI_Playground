import React from 'react';
import { FaUser } from 'react-icons/fa';
import { getProfileImageUrl } from '../services/profileService';

const UserAvatar = ({ 
  user, 
  size = 'md', 
  className = '', 
  showBorder = true, 
  borderColor = 'border-white/20',
  gradientFrom = 'from-pink-500/90',
  gradientTo = 'to-blue-500/90'
}) => {
  // Determina le dimensioni dell'avatar
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-2xl',
    '2xl': 'w-32 h-32 text-4xl',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Funzione per ottenere le iniziali dell'utente
  const getUserInitials = () => {
    if (!user) return 'U';
    
    // Prima priorità: first_name e last_name
    if (user.first_name && user.last_name) {
      return (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
    }
    
    // Seconda priorità: solo first_name
    if (user.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    
    // Terza priorità: solo last_name
    if (user.last_name) {
      return user.last_name.substring(0, 2).toUpperCase();
    }
    
    // Quarta priorità: username (gestisce anche spazi)
    if (user.username) {
      const parts = user.username.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      } else if (parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
      } else {
        return parts[0].charAt(0).toUpperCase();
      }
    }
    
    // Quinta priorità: email
    if (user.email) {
      const emailPart = user.email.split('@')[0];
      if (emailPart.length >= 2) {
        return emailPart.substring(0, 2).toUpperCase();
      } else {
        return emailPart.charAt(0).toUpperCase();
      }
    }
    
    return 'U';
  };

  // Controlla se l'utente ha un'immagine del profilo
  const profileImageUrl = getProfileImageUrl(user?.profile_image);
  const hasProfileImage = profileImageUrl && profileImageUrl !== '';

  return (
    <div className={`relative ${className}`}>
      {hasProfileImage ? (
        // Mostra l'immagine del profilo
        <div className={`${sizeClass} rounded-xl overflow-hidden ${showBorder ? `border-2 ${borderColor}` : ''} shadow-lg`}>
          <img
            src={profileImageUrl}
            alt={`${user.username || 'User'} profile`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback se l'immagine non si carica
              console.warn('Failed to load profile image, falling back to initials');
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback nascosto che viene mostrato in caso di errore */}
          <div 
            className={`
              ${sizeClass} 
              bg-gradient-to-r ${gradientFrom} ${gradientTo} 
              rounded-xl text-white font-bold 
              items-center justify-center 
              ${showBorder ? `border-2 ${borderColor}` : ''} 
              shadow-lg backdrop-blur-xl
              hidden
            `}
          >
            {getUserInitials()}
          </div>
        </div>
      ) : (
        // Mostra le iniziali come fallback
        <div 
          className={`
            ${sizeClass} 
            bg-gradient-to-r ${gradientFrom} ${gradientTo} 
            rounded-xl text-white font-bold 
            flex items-center justify-center 
            ${showBorder ? `border-2 ${borderColor}` : ''} 
            shadow-lg backdrop-blur-xl
          `}
        >
          {getUserInitials()}
        </div>
      )}
      
      {/* Indicatore online (opzionale) */}
      {user?.is_online && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
      )}
    </div>
  );
};

export default UserAvatar; 