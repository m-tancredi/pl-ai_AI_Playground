import React, { useState, useEffect } from 'react';

// Spinner semplice
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

// Alert semplice
const MiniAlert = ({ message }) => {
    if (!message) return null;
    return <p className="text-xs text-red-600 mt-1 p-2 bg-red-50 border border-red-200 rounded">{message}</p>;
};

const ImageEditModal = ({ isOpen, onClose, image, onSave, buildFullUrl }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Popola form quando l'immagine o visibilità cambiano
    useEffect(() => {
        if (image && isOpen) {
            setName(image.name || '');
            setDescription(image.description || '');
            setError(''); // Resetta errore
        }
    }, [image, isOpen]);

    if (!isOpen || !image) return null;

    const handleSaveClick = async () => {
        setIsSaving(true);
        setError('');
        try {
            // Chiama la funzione onSave passata dalla pagina genitore
            const success = await onSave(image.id, { name, description });
            if (!success) {
                // Se onSave restituisce false (o lancia errore che non viene gestito lì), mostra errore
                setError('Failed to save changes. Please check console or try again.');
            }
            // onClose() verrà chiamato dalla pagina genitore se `onSave` ha successo
        } catch(err) {
            // Cattura errori imprevisti da onSave (anche se dovrebbe gestire i propri errori API)
             console.error("Error during save callback:", err);
             setError('An unexpected error occurred during save.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setError(''); // Pulisci errore locale prima di chiudere
        onClose();
    }

    // Costruisci URL completo per la preview
    const fullImageUrl = buildFullUrl(image.image_url);

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-80 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            {/* Contenitore Modale */}
            <div className="relative mx-auto p-5 sm:p-6 border-0 w-full max-w-lg shadow-xl rounded-lg bg-white max-h-[90vh] flex flex-col">
                 {/* Header */}
                 <div className="flex-shrink-0 flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Edit Image Details</h3>
                    <button onClick={handleClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal">
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>

                {/* Form Scrollabile */}
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                     {/* Preview Immagine */}
                    {fullImageUrl && ( <img src={fullImageUrl} alt="Preview" className="h-24 w-auto rounded border mx-auto shadow-sm bg-gray-100" /> )}
                    {/* Campo Nome */}
                    <div>
                        <label htmlFor="imageNameEdit" className="block text-sm font-medium text-gray-700">Name:</label>
                        <input
                            type="text" id="imageNameEdit" value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>
                    {/* Campo Descrizione */}
                    <div>
                        <label htmlFor="imageDescriptionEdit" className="block text-sm font-medium text-gray-700">Description:</label>
                        <textarea
                            id="imageDescriptionEdit" rows="4" value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>
                    {/* Mostra Errore */}
                    {error && <MiniAlert message={error} />}
                     {/* Dettagli Non Modificabili */}
                     <div className="text-xs text-gray-500 border-t pt-2 mt-4">
                         <p>ID: {image.id}</p>
                     </div>
                </div>

                 {/* Footer (Bottoni) */}
                 <div className="flex-shrink-0 mt-5 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                     <button onClick={handleClose} type="button" disabled={isSaving} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 text-sm">
                        Cancel
                    </button>
                      <button onClick={handleSaveClick} type="button" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center text-sm">
                        {isSaving && <MiniSpinner />}
                        Save Changes
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ImageEditModal;