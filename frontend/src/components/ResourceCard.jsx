import React, { useState } from 'react';
import { FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle, FaSpinner } from 'react-icons/fa'; // Example icons

// Helper per ottenere icona basata su MIME type
const getFileIcon = (mimeType) => {
    if (!mimeType) return <FaFileAlt className="text-gray-400" />;
    if (mimeType.startsWith('image/')) return <FaFileImage className="text-blue-500" />;
    if (mimeType === 'application/pdf') return <FaFilePdf className="text-red-500" />;
    if (mimeType === 'text/csv') return <FaFileCsv className="text-green-500" />;
    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return <FaFileWord className="text-blue-700" />;
    // Aggiungere altri tipi se necessario
    return <FaFileAlt className="text-gray-500" />;
};

// Helper per formattare dimensione file
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Spinner piccolo
const MiniSpinner = () => <FaSpinner className="inline-block animate-spin h-3 w-3 text-indigo-500" />;

const ResourceCard = ({ resource, buildFullUrl, onEdit, onDelete, isDeleting }) => {
    const [thumbLoadError, setThumbLoadError] = useState(false);

    if (!resource) return null;

    const fullThumbnailUrl = resource.thumbnail_url ? buildFullUrl(resource.thumbnail_url) : null;
    const fullDownloadUrl = resource.file_url ? `${window.location.origin}/api/resources/${resource.id}/download/` : '#'; // Costruisce URL download API
    const fileIcon = getFileIcon(resource.mime_type);
    const isProcessing = resource.status === 'PROCESSING';
    const isFailed = resource.status === 'FAILED';
    const isCompleted = resource.status === 'COMPLETED';

    const handleThumbError = () => setThumbLoadError(true);

    return (
        <div className={`bg-white rounded-lg shadow border hover:shadow-md transition-shadow relative overflow-hidden ${isProcessing ? 'opacity-70' : ''} ${isFailed ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            {/* Area Immagine/Icona */}
            <div className="h-32 bg-gray-100 flex items-center justify-center p-2 relative">
                {isProcessing && (
                     <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10">
                         <FaSpinner className="animate-spin h-6 w-6 mb-1" />
                         <span className="text-xs font-medium">Processing...</span>
                     </div>
                 )}
                 {isFailed && (
                     <div className="absolute inset-0 bg-red-700 bg-opacity-80 flex flex-col items-center justify-center text-white z-10 p-2">
                         <FaInfoCircle className="h-6 w-6 mb-1" />
                         <span className="text-xs font-medium text-center">Processing Failed</span>
                         {resource.error_message && <p className="text-xs mt-1 text-red-200 truncate" title={resource.error_message}>({resource.error_message})</p>}
                     </div>
                 )}
                 {/* Mostra thumbnail se disponibile e completato/non fallito */}
                 {isCompleted && fullThumbnailUrl && !thumbLoadError ? (
                    <img
                        src={fullThumbnailUrl}
                        alt={`Thumbnail for ${resource.name || resource.original_filename}`}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                        onError={handleThumbError}
                     />
                 ) : (
                    // Mostra icona grande se non c'è thumbnail o errore
                    <div className="text-4xl opacity-50">{fileIcon}</div>
                 )}
            </div>

            {/* Dettagli Testuali */}
            <div className="p-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800 truncate" title={resource.name || resource.original_filename}>
                    {resource.name || resource.original_filename}
                </p>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                    <span className="flex items-center">{React.cloneElement(fileIcon, {className: "mr-1 h-3 w-3"})} {resource.mime_type || 'Unknown type'}</span>
                    <span>|</span>
                    <span>{formatBytes(resource.size)}</span>
                </div>
                 <p className="text-xs text-gray-400">
                    Uploaded: {new Date(resource.created_at).toLocaleDateString()}
                 </p>
                  {/* Badge Stato (se non Processing/Failed mostrati sopra) */}
                 {isCompleted && (
                     <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">
                        Completed
                    </span>
                 )}
            </div>

            {/* Azioni (Footer) */}
            <div className="border-t border-gray-100 px-3 py-2 flex justify-end space-x-2">
                <button
                    onClick={() => onEdit(resource)}
                    disabled={isProcessing || isDeleting}
                    title="Edit Metadata"
                    className="p-1 text-gray-400 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Edit"
                >
                    <FaEdit className="h-4 w-4"/>
                </button>
                {/* Link/Bottone Download */}
                 <a
                    href={isCompleted ? fullDownloadUrl : undefined}
                    download={isCompleted ? resource.original_filename : undefined}
                    target="_blank" // Apre in nuova scheda se browser non forza download
                    rel="noopener noreferrer"
                    title={isCompleted ? "Download File" : "File is processing/failed"}
                    aria-disabled={!isCompleted}
                    // Stile condizionale per disabilitato
                    className={`p-1 ${isCompleted ? 'text-gray-400 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                    // Impedisci click se non completato (anche se href è undefined)
                    onClick={(e) => !isCompleted && e.preventDefault()}
                 >
                    <FaDownload className="h-4 w-4"/>
                 </a>
                <button
                    onClick={() => onDelete(resource)}
                    disabled={isDeleting || isProcessing} // Non cancellare mentre si processa
                    title="Delete Resource"
                    className={`p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed ${isDeleting ? 'text-indigo-500' : ''}`}
                    aria-label="Delete"
                >
                    {isDeleting ? <MiniSpinner /> : <FaTrashAlt className="h-4 w-4"/>}
                </button>
            </div>
        </div>
    );
};

export default ResourceCard;