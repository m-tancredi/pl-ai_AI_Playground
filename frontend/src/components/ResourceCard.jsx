import React, { useState } from 'react';
import { FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle, FaSpinner, FaTags, FaBrain, FaChartLine, FaListOl } from 'react-icons/fa';

// Spinner semplice
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

// Funzione formatBytes (come prima)
const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0 || !bytes || isNaN(bytes)) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const unitIndex = i < sizes.length ? i : sizes.length - 1;
    const value = parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm));
    return value + ' ' + sizes[unitIndex];
};


// Helper per icona file - Assicuriamoci che ritorni SEMPRE un elemento valido
const getFileIcon = (mimeType) => {
    const defaultIcon = <FaFileAlt className="text-gray-500" />; // Icona di fallback
    if (!mimeType) return defaultIcon;

    try { // Aggiungiamo try-catch per sicurezza extra con startsWith/includes
        if (mimeType.startsWith('image/')) return <FaFileImage className="text-blue-500" />;
        if (mimeType === 'application/pdf') return <FaFilePdf className="text-red-500" />;
        if (mimeType === 'text/csv') return <FaFileCsv className="text-green-500" />;
        if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return <FaFileWord className="text-blue-700" />;
    } catch (e) {
        console.error("Error in getFileIcon with mimeType:", mimeType, e);
        return defaultIcon; // Restituisci fallback in caso di errore inaspettato
    }
    // Se nessun caso corrisponde, restituisci il fallback
    return defaultIcon;
};

// Helper per stile tag (come prima)
// Helper per stile tag - Aggiungiamo un fallback più robusto
const getUseTagStyle = (useType) => {
    // Oggetto di fallback di default
    const fallbackStyle = { icon: <FaTags className="mr-1" />, color: 'bg-gray-100 text-gray-800' };

    // Gestisci input non validi (null, undefined, non stringa)
    if (typeof useType !== 'string' || !useType) {
        console.warn("getUseTagStyle received invalid useType:", useType);
        return fallbackStyle;
    }

    // Lo switch rimane uguale, ma ora abbiamo un fallback sicuro sopra
    switch (useType.toLowerCase()) { // Converti in minuscolo per sicurezza
        case 'regression':
            return { icon: <FaChartLine className="mr-1" />, color: 'bg-blue-100 text-blue-800' };
        case 'classification':
            return { icon: <FaListOl className="mr-1" />, color: 'bg-purple-100 text-purple-800' };
        case 'rag':
            return { icon: <FaBrain className="mr-1" />, color: 'bg-teal-100 text-teal-800' };
        case 'clustering':
            return { icon: <FaTags className="mr-1" />, color: 'bg-yellow-100 text-yellow-800' };
        case 'time_series':
             return { icon: <FaTags className="mr-1" />, color: 'bg-pink-100 text-pink-800' };
        case 'image_generation_input':
             return { icon: <FaFileImage className="mr-1" />, color: 'bg-orange-100 text-orange-800' };
        default:
            console.warn("getUseTagStyle encountered unknown useType:", useType);
            return fallbackStyle; // Usa il fallback definito sopra
    }
};


const ResourceCard = ({ resource, buildFullUrl, onEdit, onDelete, isDeleting }) => {
    const [thumbLoadError, setImageLoadError] = useState(false);

    if (!resource) return null; // Protezione iniziale

    const handleThumbError = () => {
        console.warn(`Failed to load image thumbnail: ${fullThumbnailUrl}`);
        setImageLoadError(true);
    };

    // Chiamate a funzioni helper
    const fullThumbnailUrl = resource.thumbnail_url ? buildFullUrl(resource.thumbnail_url) : null;
    const fileIconElement = getFileIcon(resource.mime_type); // Ottieni l'elemento icona
    const fullDownloadUrl = resource.file_url && resource.status === 'COMPLETED'
                            ? `${window.location.origin}/api/resources/${resource.id}/download/`
                            : '#';

    // Log di Debug (opzionale, rimuovere dopo aver risolto)
    // console.log(`ResourceCard ID: ${resource.id}, MIME: ${resource.mime_type}, Icon Element:`, fileIconElement);

    // Stati derivati
    const isProcessing = resource.status === 'PROCESSING';
    const isFailed = resource.status === 'FAILED';
    const isCompleted = resource.status === 'COMPLETED';
    const potentialUses = Array.isArray(resource.metadata?.potential_uses) ? resource.metadata.potential_uses : [];


    return (
        <div className={`bg-white rounded-lg shadow border hover:shadow-md transition-shadow relative overflow-hidden flex flex-col ${isProcessing ? 'opacity-70' : ''} ${isFailed ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>

            {/* Area Immagine/Icona */}
            <div className="h-32 bg-gray-100 flex items-center justify-center p-2 relative flex-shrink-0">
                 {isProcessing && ( <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10"><FaSpinner className="animate-spin h-6 w-6 mb-1" /><span className="text-xs font-medium">Processing...</span></div> )}
                 {isFailed && ( <div className="absolute inset-0 bg-red-700 bg-opacity-80 flex flex-col items-center justify-center text-white z-10 p-2"><FaInfoCircle className="h-6 w-6 mb-1" /><span className="text-xs font-medium text-center">Failed</span>{resource.error_message && <p className="text-[10px] mt-1 text-red-200 truncate px-1" title={resource.error_message}>({resource.error_message})</p>}</div> )}

                 {/* Visualizzazione Thumbnail/Icona */}
                 {!isProcessing && !isFailed && ( // Mostra solo se non PENDING o FAILED
                    <>
                        {fullThumbnailUrl && !thumbLoadError ? (
                            <img src={fullThumbnailUrl} alt={`Thumbnail for ${resource.name || resource.original_filename}`} className="max-h-full max-w-full object-contain" loading="lazy" onError={handleThumbError} />
                        ) : (
                             // Mostra l'icona del file se non c'è thumb o errore
                            <div className="text-4xl opacity-50">
                                {fileIconElement ? fileIconElement : <FaFileAlt className="text-gray-400"/>} {/* Fallback ulteriore se fileIconElement è falsy */}
                             </div>
                        )}
                        {/* Messaggio errore thumbnail */}
                        {thumbLoadError && (<div className="absolute bottom-1 right-1 text-red-500 text-[10px] bg-white/70 px-1 rounded">Thumb error</div>)}
                     </>
                 )}
            </div>

            {/* Dettagli Testuali */}
            <div className="p-3 space-y-1 flex-grow">
                <p className="text-sm font-semibold text-gray-800 truncate" title={resource.name || resource.original_filename}>
                    {resource.name || resource.original_filename}
                </p>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                    {/* --- CORREZIONE QUI: Controllo esplicito prima di cloneElement --- */}
                    <span className="flex items-center">
                        {React.isValidElement(fileIconElement) ? React.cloneElement(fileIconElement, {className: "mr-1 h-3 w-3 flex-shrink-0"}) : <FaFileAlt className="mr-1 h-3 w-3 text-gray-400"/>}
                        <span className="truncate" title={resource.mime_type || 'Unknown'}>{resource.mime_type || 'Unknown'}</span>
                    </span>
                    {/* --- FINE CORREZIONE --- */}
                    <span>|</span>
                    <span>{formatBytes(resource.size)}</span>
                </div>
                 <p className="text-xs text-gray-400">
                    {new Date(resource.created_at).toLocaleDateString()}
                 </p>

                 {/* Sezione TAGS */}
                {isCompleted && potentialUses.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                        <h4 className="text-xs font-medium text-gray-500 mb-1">Potential Uses:</h4>
                        <div className="flex flex-wrap gap-1">
                            {potentialUses.map(use => {
                                const { icon, color } = getUseTagStyle(use);
                                // Assicurati che icon sia un elemento valido prima di renderizzare
                                return (
                                    <span key={use} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${color}`}>
                                        {React.isValidElement(icon) ? icon : <FaTags className="mr-1" />} {/* Fallback icona tag */}
                                        {use.charAt(0).toUpperCase() + use.slice(1)}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
                {isCompleted && potentialUses.length === 0 && ( <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded mt-2">Completed</span> )}
            </div>

            {/* Azioni (Footer) */}
            <div className="border-t border-gray-100 px-3 py-2 flex justify-end space-x-2 flex-shrink-0">
                 <button onClick={() => onEdit(resource)} disabled={isProcessing || isDeleting} title="Edit Metadata" className="p-1 text-gray-400 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded" aria-label="Edit"> <FaEdit className="h-4 w-4"/> </button>
                 <a href={isCompleted ? fullDownloadUrl : undefined} download={isCompleted ? resource.original_filename : undefined} target="_blank" rel="noopener noreferrer" title={isCompleted ? "Download File" : "File is processing/failed"} aria-disabled={!isCompleted} onClick={(e) => !isCompleted && e.preventDefault()} className={`p-1 ${isCompleted ? 'text-gray-400 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'} focus:outline-none focus:ring-1 focus:ring-blue-400 rounded`}> <FaDownload className="h-4 w-4"/> </a>
                 <button onClick={() => onDelete(resource)} disabled={isDeleting || isProcessing} title="Delete Resource" className={`p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed ${isDeleting ? 'text-indigo-500' : ''} focus:outline-none focus:ring-1 focus:ring-red-400 rounded`} aria-label="Delete"> {isDeleting ? <MiniSpinner /> : <FaTrashAlt className="h-4 w-4"/>} </button>
            </div>
        </div>
    );
};

export default ResourceCard;