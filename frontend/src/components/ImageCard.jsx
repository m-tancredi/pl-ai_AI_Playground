import React, { useState } from 'react';

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
        <div className="bg-white rounded-lg shadow-md overflow-hidden group relative border hover:shadow-lg transition-shadow duration-200">
            <div className="aspect-square w-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {fullImageUrl && !imageLoadError ? (
                     <img
                        src={fullImageUrl}
                        alt={image.name || `Generated ${image.id}`}
                        className="w-full h-full object-cover group-hover:opacity-75 transition-opacity duration-300"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2 sm:p-3 text-white">
                <div className="mb-10 sm:mb-8">
                    <h3 className="font-semibold text-xs sm:text-sm truncate" title={image.name || 'Unnamed Image'}>
                        {image.name || 'Unnamed Image'}
                    </h3>
                    <p className="text-xs opacity-80 truncate" title={image.prompt || 'No prompt'}>
                        {truncatedPrompt || 'No prompt'}
                    </p>
                </div>
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex space-x-1">
                     {/* View Details Button */}
                     <button onClick={() => onViewDetails(image)} title="View Details" aria-label="View Details" className="p-1 sm:p-1.5 bg-blue-500 bg-opacity-70 rounded-full hover:bg-opacity-100 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>...</svg> {/* Icona Occhio */}
                     </button>
                     {/* Edit Button */}
                     <button onClick={() => onEdit(image)} title="Edit Name/Description" aria-label="Edit Image" className="p-1 sm:p-1.5 bg-yellow-500 bg-opacity-70 rounded-full hover:bg-opacity-100 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>...</svg> {/* Icona Matita */}
                     </button>
                     {/* Delete Button */}
                     <button onClick={() => onDelete(image.id)} disabled={isDeleting} title="Delete Image" aria-label="Delete Image" className={`p-1 sm:p-1.5 bg-red-500 bg-opacity-70 rounded-full hover:bg-opacity-100 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors ${isDeleting ? 'cursor-wait opacity-50' : ''}`}>
                         {isDeleting ? <MiniSpinner /> : (<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>...</svg> /* Icona Cestino */ )}
                     </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCard;