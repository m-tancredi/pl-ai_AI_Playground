import React, { useState, useEffect } from 'react';

// Spinner semplice
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

// Alert semplice
const MiniAlert = ({ message }) => {
    if (!message) return null;
    return <p className="text-xs text-red-600 mt-1">{message}</p>;
};

const ResourceEditModal = ({ isOpen, onClose, resource, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Popola il form quando la risorsa o la visibilità cambiano
    useEffect(() => {
        if (resource && isOpen) {
            setName(resource.name || ''); // Usa nome personalizzato o vuoto
            setDescription(resource.description || '');
            setError('');
        }
        // Non resettare alla chiusura per evitare flash se riaperto subito
    }, [resource, isOpen]);

    if (!isOpen || !resource) return null;

    const handleSaveClick = async () => {
        setIsSaving(true);
        setError('');
        // Passa solo i campi modificabili all'API
        const success = await onSave(resource.id, { name, description });
        setIsSaving(false);
        if (!success) {
            setError('Failed to save changes. Please check console or try again.');
        }
        // La pagina parente chiuderà il modale se success è true
    };

    const handleClose = () => {
        setError(''); // Resetta errore locale alla chiusura
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-80 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="relative mx-auto p-5 sm:p-6 border-0 w-full max-w-lg shadow-xl rounded-lg bg-white">
                 {/* Header */}
                 <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Edit Resource</h3>
                    <button onClick={handleClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <p className="text-sm text-gray-600">Original Filename: <span className="font-mono bg-gray-100 px-1 rounded">{resource.original_filename}</span></p>
                     <p className="text-sm text-gray-600">ID: {resource.id}</p>
                     <div>
                        <label htmlFor="resourceNameEdit" className="block text-sm font-medium text-gray-700">Custom Name:</label>
                        <input
                            type="text"
                            id="resourceNameEdit"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter a display name (optional)"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="resourceDescriptionEdit" className="block text-sm font-medium text-gray-700">Description:</label>
                        <textarea
                            id="resourceDescriptionEdit"
                            rows="4"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter a description (optional)"
                             className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>
                    {error && <MiniAlert message={error} />}
                </div>

                 {/* Footer (Bottoni) */}
                 <div className="mt-5 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                     <button
                        onClick={handleClose}
                        type="button"
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                      <button
                        onClick={handleSaveClick}
                        type="button"
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                    >
                        {isSaving && <MiniSpinner />}
                        Save Changes
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ResourceEditModal;