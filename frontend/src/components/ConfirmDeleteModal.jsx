import React, { useState } from 'react';

// Spinner semplice
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500"></div>;

const ConfirmDeleteModal = ({ isOpen, onClose, resourceName, onConfirm }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleConfirmClick = async () => {
        setIsDeleting(true);
        await onConfirm(); // La funzione onConfirm gestirà la chiusura/errore
        setIsDeleting(false); // Resetta stato se onConfirm non chiude subito
    };

    return (
         <div className="fixed inset-0 bg-gray-800 bg-opacity-80 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="relative mx-auto p-5 sm:p-6 border-0 w-full max-w-md shadow-xl rounded-lg bg-white">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">Confirm Deletion</h3>
                     <button onClick={onClose} disabled={isDeleting} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center disabled:opacity-50" aria-label="Close modal">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                     </button>
                </div>

                {/* Messaggio */}
                <p className="text-sm text-gray-600 mb-6">
                    Are you sure you want to delete the resource: <br />
                    <strong className="font-medium text-gray-800 break-all">"{resourceName || 'this resource'}"</strong>?
                    <br /><br />
                     <span className="font-semibold text-red-600">This action cannot be undone.</span> The file will be permanently removed.
                </p>

                 {/* Footer (Bottoni) */}
                 <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        onClick={onClose}
                        type="button"
                        disabled={isDeleting}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                     <button
                        onClick={handleConfirmClick}
                        type="button"
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                    >
                        {isDeleting && <MiniSpinner />}
                        Confirm Deletion
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;