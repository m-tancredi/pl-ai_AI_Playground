import React, { useState } from 'react';
import { FaEye, FaEdit, FaTrash, FaSpinner } from 'react-icons/fa';

const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

const ImageCard = ({ image, buildFullUrl, onViewDetails, onEdit, onDelete, isDeleting }) => {
    const [imageLoadError, setImageLoadError] = useState(false);

    const handleImageError = () => {
        setImageLoadError(true);
    };

    if (!image) return null;

    const truncatedPrompt = image.prompt?.length > 60 ? image.prompt.substring(0, 60) + '...' : image.prompt;
    // Costruisci l'URL completo usando la funzione passata come prop
    const fullImageUrl = buildFullUrl(image.image_url);

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden group relative border hover:shadow-xl transition-all duration-300 hover:scale-105">
            {/* Immagine */}
            <div className="aspect-square w-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {fullImageUrl && !imageLoadError ? (
                     <img
                        src={fullImageUrl}
                        alt={image.name || `Generated ${image.id}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                        onError={handleImageError}
                     />
                ) : (
                     <div className="w-full h-full bg-gray-200 flex items-center justify-center text-center p-2">
                        <span className="text-gray-400 text-xs italic">
                            {imageLoadError ? 'Load Error' : 'No Preview'}
                        </span>
                    </div>
                )}
            </div>
            
            {/* Overlay con informazioni */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 text-white">
                <div className="flex-1">
                    <h3 className="font-semibold text-sm truncate mb-1" title={image.name || 'Unnamed Image'}>
                        {image.name || 'Unnamed Image'}
                    </h3>
                    <p className="text-xs opacity-90 truncate" title={image.prompt || 'No prompt'}>
                        {truncatedPrompt || 'No prompt'}
                    </p>
                </div>
                
                {/* Pulsanti di azione */}
                <div className="flex flex-col gap-1 mt-3">
                    {/* Visualizza Dettagli */}
                    <button 
                        onClick={() => onViewDetails(image)} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/80 hover:bg-blue-600/90 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
                    >
                        <FaEye className="text-xs" />
                        Visualizza Dettagli
                    </button>
                    
                    {/* Modifica */}
                    <button 
                        onClick={() => onEdit(image)} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/80 hover:bg-yellow-600/90 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
                    >
                        <FaEdit className="text-xs" />
                        Modifica Nome
                    </button>
                    
                    {/* Elimina */}
                    <button 
                        onClick={() => onDelete(image.id)} 
                        disabled={isDeleting}
                        className={`flex items-center gap-2 px-3 py-1.5 bg-red-500/80 hover:bg-red-600/90 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 ${isDeleting ? 'cursor-wait opacity-50' : ''}`}
                    >
                        {isDeleting ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
                        {isDeleting ? 'Eliminando...' : 'Elimina'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCard;