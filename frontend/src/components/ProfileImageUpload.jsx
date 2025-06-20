import React, { useState, useRef } from 'react';
import { FaCamera, FaUpload, FaTrash, FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { validateImageFile } from '../services/profileService';

const ProfileImageUpload = ({ currentImage, onImageChange, onImageRemove, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentImage || null);
  const fileInputRef = useRef(null);

  // Utilizza la funzione di validazione dal servizio
  const validateFile = (file) => {
    const validation = validateImageFile(file);
    return validation.isValid ? null : validation.error;
  };

  const handleFileSelect = async (file) => {
    setError('');
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // Call parent component's upload handler
      if (onImageChange) {
        await onImageChange(file);
      }
    } catch (err) {
      setError('Errore durante il caricamento dell\'immagine.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setIsUploading(true);
      setPreview(null);
      if (onImageRemove) {
        await onImageRemove();
      }
    } catch (err) {
      setError('Errore durante la rimozione dell\'immagine.');
      console.error('Remove error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300
          ${isDragging 
            ? 'border-pink-400 bg-pink-50/50' 
            : preview 
              ? 'border-green-300 bg-green-50/30' 
              : 'border-gray-300 bg-gray-50/30'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-pink-400 hover:bg-pink-50/30'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileInput}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <FaSpinner className="text-4xl text-pink-500 mb-3 animate-spin" />
            <p className="text-gray-600">Caricamento in corso...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <img
                src={preview}
                alt="Preview"
                className="w-24 h-24 rounded-full object-cover shadow-lg"
              />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <FaCheck className="text-white text-sm" />
              </div>
            </div>
            <p className="text-green-700 font-medium mb-2">Immagine caricata</p>
            <p className="text-gray-500 text-sm">Clicca per sostituire</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <FaCamera className="text-4xl text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium mb-1">Aggiungi immagine profilo</p>
            <p className="text-gray-500 text-sm">Trascina un file qui o clicca per selezionare</p>
            <p className="text-gray-400 text-xs mt-2">JPG, PNG, WebP - Max 5MB</p>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Action Buttons */}
      {preview && !isUploading && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/90 hover:bg-blue-600/90 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaUpload className="text-sm" />
            Sostituisci
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/90 hover:bg-red-600/90 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaTrash className="text-sm" />
            Rimuovi
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <FaExclamationTriangle className="text-sm flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ProfileImageUpload; 