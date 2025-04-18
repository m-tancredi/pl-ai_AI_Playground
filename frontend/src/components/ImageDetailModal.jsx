import React from 'react';

const ImageDetailModal = ({ isOpen, onClose, image, buildFullUrl }) => {
    if (!isOpen || !image) return null;

    // Costruisci l'URL completo usando la funzione helper passata come prop
    const fullImageUrl = buildFullUrl(image.image_url);

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-80 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            {/* Contenitore Modale */}
            <div className="relative mx-auto p-5 sm:p-6 border-0 w-full max-w-4xl shadow-xl rounded-lg bg-white max-h-[90vh] flex flex-col"> {/* Max height e flex col */}
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 truncate" title={image.name || `Image ${image.id}`}>
                        {image.name || `Image ${image.id}`}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal">
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>

                {/* Contenuto Scrollabile */}
                <div className="flex-grow overflow-y-auto pr-2"> {/* Area scrollabile */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Immagine (Colonna Larga) */}
                        <div className="w-full md:col-span-2 flex items-center justify-center bg-gray-100 rounded min-h-[300px]">
                            {fullImageUrl ? (
                                <img src={fullImageUrl} alt={image.name || `Generated image ${image.id}`} className="w-auto h-auto object-contain rounded max-h-[70vh]" />
                            ) : (
                                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center rounded">
                                    <span className="text-gray-500 italic">Image not available</span>
                                </div>
                            )}
                        </div>

                        {/* Metadati (Colonna Stretta) */}
                        <div className="space-y-3 text-sm text-gray-700 md:col-span-1">
                            <h4 className="text-md font-semibold text-gray-800 border-b pb-1 mb-2">Details</h4>
                            {/* Description */}
                            {image.description && (<div><strong className="font-medium text-gray-800 block">Description:</strong><p className="mt-1 whitespace-pre-wrap bg-gray-50 p-2 border rounded text-xs">{image.description}</p></div>)}
                            {!image.description && (<div><strong className="font-medium text-gray-800 block">Description:</strong><p className="mt-1 italic text-xs text-gray-500">No description provided.</p></div>)}
                            {/* Prompt */}
                            {image.prompt && (<div><strong className="font-medium text-gray-800 block">Prompt Used:</strong><p className="mt-1 text-gray-600 bg-gray-50 p-2 rounded border text-xs whitespace-pre-wrap">{image.prompt}</p></div>)}
                            {/* Altri Dettagli */}
                            <div className="grid grid-cols-1 gap-y-1 text-xs pt-2 border-t">
                                {image.model_used && <div><strong className="font-medium text-gray-800">Model:</strong> {image.model_used}</div>}
                                {image.style && <div><strong className="font-medium text-gray-800">Style:</strong> {image.style}</div>}
                                {image.width && image.height && <div><strong className="font-medium text-gray-800">Dimensions:</strong> {image.width} x {image.height}</div>}
                                {image.created_at && <div><strong className="font-medium text-gray-800">Created:</strong> {new Date(image.created_at).toLocaleString()}</div>}
                                <div><strong className="font-medium text-gray-800">Owner ID:</strong> {image.owner_id}</div>
                                <div><strong className="font-medium text-gray-800">Image ID:</strong> {image.id}</div>
                            </div>
                            {/* Link Download */}
                            {fullImageUrl && (<a href={fullImageUrl} download={image.name || `image_${image.id}.png`} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200">Download Image</a>)}
                        </div>
                    </div>
                </div>

                 {/* Footer Modale */}
                 <div className="flex-shrink-0 mt-5 pt-4 border-t border-gray-200 text-right">
                     <button onClick={onClose} type="button" className="px-5 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                        Close
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ImageDetailModal;