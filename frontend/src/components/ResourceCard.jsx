import React from 'react';
import { DocumentTextIcon, PhotoIcon, TableCellsIcon, QuestionMarkCircleIcon, ArrowDownTrayIcon, PencilIcon, TrashIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'; // Usa Heroicons per icone

// Spinner semplice
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

// Helper per determinare l'icona basata sul MIME type
const getIconForMimeType = (mimeType) => {
    if (!mimeType) return <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400" />;
    if (mimeType.startsWith('image/')) return <PhotoIcon className="h-12 w-12 text-blue-500" />;
    if (mimeType.includes('csv')) return <TableCellsIcon className="h-12 w-12 text-green-500" />;
    if (mimeType.includes('pdf')) return <DocumentTextIcon className="h-12 w-12 text-red-500" />; // Esempio PDF
    // Aggiungi altre icone per tipi comuni (word, excel, zip, etc.)
    return <DocumentTextIcon className="h-12 w-12 text-gray-500" />; // Default
};

const ResourceCard = ({ resource, onEdit, onDelete, isDeleting, buildFullUrl }) => {
    if (!resource) return null;

    const handleEditClick = (e) => {
        e.stopPropagation(); // Impedisce di triggerare altri eventi sulla card
        onEdit(resource);
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        onDelete(resource); // Passa l'intero oggetto resource per il modale di conferma
    };

    const handleDownloadClick = (e) => {
        e.stopPropagation();
        // L'URL per il download punta all'endpoint API, non direttamente al file
        const downloadUrl = `${window.location.origin}/api/resources/${resource.id}/download/`;
        window.open(downloadUrl, '_blank'); // Apri in nuova scheda per iniziare download
    }

    // Determina lo stile e l'icona basati sullo stato
    let statusIndicator;
    let cardBorderColor = 'border-gray-200';
    let isActionable = resource.status === 'COMPLETED'; // Azioni disponibili solo se completato

    switch (resource.status) {
        case 'PROCESSING':
            statusIndicator = <span className="flex items-center text-xs text-blue-600"><MiniSpinner /> Processing...</span>;
            cardBorderColor = 'border-blue-300 animate-pulse';
            isActionable = false;
            break;
        case 'FAILED':
            statusIndicator = <span className="flex items-center text-xs text-red-600"><ExclamationCircleIcon className="h-4 w-4 mr-1" /> Failed</span>;
            cardBorderColor = 'border-red-400';
            isActionable = false; // O permetti eliminazione? Dipende dai requisiti
            break;
        case 'COMPLETED':
             statusIndicator = <span className="text-xs text-green-600">Ready</span>;
             cardBorderColor = 'border-green-300';
             break;
        default:
            statusIndicator = <span className="text-xs text-gray-500">{resource.status || 'Unknown'}</span>;
    }

    const thumbnailUrl = resource.thumbnail_url ? buildFullUrl(resource.thumbnail_url) : null;

    return (
        <div className={`bg-white rounded-lg shadow border ${cardBorderColor} p-4 flex flex-col justify-between hover:shadow-md transition-shadow`}>
            <div>
                {/* Anteprima o Icona */}
                <div className="h-24 flex items-center justify-center mb-3 bg-gray-50 rounded">
                    {thumbnailUrl && resource.status === 'COMPLETED' ? (
                        <img src={thumbnailUrl} alt="Thumbnail" className="max-h-full max-w-full object-contain" />
                    ) : (
                        getIconForMimeType(resource.mime_type)
                    )}
                </div>

                {/* Nome e Info */}
                <h3 className="font-semibold text-sm text-gray-800 truncate mb-1" title={resource.name || resource.original_filename}>
                    {resource.name || resource.original_filename}
                </h3>
                <p className="text-xs text-gray-500 truncate" title={resource.mime_type}>{resource.mime_type || 'N/A'}</p>
                 <p className="text-xs text-gray-400 mt-1">
                     Uploaded: {new Date(resource.created_at).toLocaleDateString()}
                </p>
                 {/* Status Indicator */}
                 <div className="mt-2">
                     {statusIndicator}
                     {resource.status === 'FAILED' && resource.error_message && (
                         <p className="text-xs text-red-500 mt-1 truncate" title={resource.error_message}>Error: {resource.error_message}</p>
                     )}
                 </div>
            </div>

            {/* Azioni (in basso) */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end space-x-2">
                 {isActionable && ( // Mostra solo se COMPLETED
                    <button
                        onClick={handleDownloadClick}
                        title="Download File"
                        className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-50"
                        aria-label="Download"
                        disabled={!isActionable}
                    >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                 )}
                 <button
                    onClick={handleEditClick}
                    title="Edit Name/Description"
                    className="p-1 text-gray-500 hover:text-yellow-600 disabled:opacity-50"
                    aria-label="Edit"
                    disabled={!isActionable || isDeleting} // Disabilita anche durante l'eliminazione
                >
                    <PencilIcon className="h-5 w-5" />
                </button>
                 <button
                    onClick={handleDeleteClick}
                    title="Delete Resource"
                    className={`p-1 text-gray-500 hover:text-red-600 ${isDeleting ? 'opacity-50 cursor-wait' : ''}`}
                    aria-label="Delete"
                    disabled={isDeleting || resource.status === 'PROCESSING'} // Non permettere eliminazione durante processing
                >
                     {isDeleting ? <MiniSpinner /> : <TrashIcon className="h-5 w-5" />}
                </button>
            </div>
        </div>
    );
};

export default ResourceCard;