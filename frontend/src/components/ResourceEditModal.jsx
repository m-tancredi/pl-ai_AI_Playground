import React, { useState, useEffect } from 'react';
import { FaEdit, FaTimes } from 'react-icons/fa';

// Componenti UI moderni - stile chatbot
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500"></div>;

// Alert moderno
const MiniAlert = ({ message }) => {
    if (!message) return null;
    return <p className="text-sm text-red-600 mt-2 bg-red-50 p-3 rounded-xl border border-red-200">{message}</p>;
};

const ResourceEditModal = ({ isOpen, onClose, resource, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Popola il form quando la risorsa o la visibilità cambiano
    useEffect(() => {
        if (resource && isOpen) {
            setName(resource.name || '');
            setDescription(resource.description || '');
            setError('');
        }
    }, [resource, isOpen]);

    if (!isOpen || !resource) return null;

    const handleSaveClick = async () => {
        setIsSaving(true);
        setError('');
        console.log(`Edit modal save clicked. Calling onSave for ID: ${resource.id} with data:`, { name, description });
        const success = await onSave(resource.id, { name, description });
        console.log("onSave returned:", success);
        setIsSaving(false);
        if (!success) {
            setError('Failed to save changes. Please check console or try again.');
        }
    };

    const handleClose = () => {
        setError('');
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="relative mx-auto p-8 border-0 w-full max-w-lg shadow-2xl rounded-2xl bg-white">
                 {/* Header */}
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                        <FaEdit className="text-xl" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800">Edit Resource</h3>
                        <p className="text-gray-600 text-sm">Modify resource metadata</p>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl p-2 transition-all duration-200" aria-label="Close modal">
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">
                            <span className="font-semibold">Original Filename:</span>
                        </p>
                        <p className="font-mono bg-white px-3 py-2 rounded-lg border text-sm">{resource.original_filename}</p>
                        <p className="text-xs text-gray-500 mt-2">ID: {resource.id}</p>
                    </div>
                    
                     <div>
                        <label htmlFor="resourceNameEdit" className="block text-sm font-semibold text-gray-700 mb-2">Custom Name:</label>
                        <input
                            type="text"
                            id="resourceNameEdit"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter a display name (optional)"
                            className="block w-full border-0 bg-gray-50 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none p-4 text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="resourceDescriptionEdit" className="block text-sm font-semibold text-gray-700 mb-2">Description:</label>
                        <textarea
                            id="resourceDescriptionEdit"
                            rows="4"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter a description (optional)"
                             className="block w-full border-0 bg-gray-50 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none p-4 text-sm resize-none"
                        />
                    </div>
                    {error && <MiniAlert message={error} />}
                </div>

                 {/* Footer (Bottoni) */}
                 <div className="mt-8 flex justify-end space-x-4">
                     <button
                        onClick={handleClose}
                        type="button"
                        disabled={isSaving}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl disabled:opacity-50 font-semibold shadow transition-all duration-200"
                    >
                        Cancel
                    </button>
                      <button
                        onClick={handleSaveClick}
                        type="button"
                        disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center font-semibold transition-all duration-200"
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