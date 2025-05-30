// src/components/ResourceCard.jsx
import React, { useState } from 'react';
import { FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle, FaSpinner, FaTags, FaBrain, FaChartLine, FaListOl } from 'react-icons/fa';
import { getFullMediaUrl } from '../utils/getFullMediaUrl';

// --- Componenti UI Semplici ---
const MiniSpinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>;

// --- Funzioni Helper ---
const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0 || !bytes || isNaN(bytes)) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Gestisci caso limite i >= sizes.length
    const unitIndex = i < sizes.length ? i : sizes.length - 1;
    const value = parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm));
    return value + ' ' + sizes[unitIndex];
};

const getFileIcon = (mimeType) => {
    const defaultIcon = <FaFileAlt className="text-gray-500" />;
    if (!mimeType) return defaultIcon;
    try {
        if (mimeType.startsWith('image/')) return <FaFileImage className="text-blue-500" />;
        if (mimeType === 'application/pdf') return <FaFilePdf className="text-red-500" />;
        if (mimeType === 'text/csv') return <FaFileCsv className="text-green-500" />;
        if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return <FaFileWord className="text-blue-700" />;
    } catch (e) {
        console.error("Error in getFileIcon with mimeType:", mimeType, e);
        return defaultIcon;
    }
    return defaultIcon;
};

const getUseTagStyle = (useType) => {
    const fallbackStyle = { icon: <FaTags className="mr-1" />, color: 'bg-gray-100 text-gray-800' };
    if (typeof useType !== 'string' || !useType) {
        console.warn("getUseTagStyle received invalid useType:", useType);
        return fallbackStyle;
    }
    switch (useType.toLowerCase()) {
        case 'classification': return { icon: <FaListOl className="mr-1" />, color: 'bg-purple-100 text-purple-800' };
        case 'rag': return { icon: <FaBrain className="mr-1" />, color: 'bg-teal-100 text-teal-800' };
        case 'clustering': return { icon: <FaTags className="mr-1" />, color: 'bg-yellow-100 text-yellow-800' };
        case 'time_series': return { icon: <FaTags className="mr-1" />, color: 'bg-pink-100 text-pink-800' };
        case 'image_generation_input': return { icon: <FaFileImage className="mr-1" />, color: 'bg-orange-100 text-orange-800' };
        default: console.warn("getUseTagStyle encountered unknown useType:", useType); return fallbackStyle;
    }
};

// --- Componente Card ---
const ResourceCard = ({
    resource,
    buildFullUrl, // Funzione per costruire URL completo
    onSelect,     // Callback per quando la card viene selezionata (opzionale)
    onEdit,       // Callback per aprire modale modifica (opzionale)
    onDelete,     // Callback per avviare eliminazione (opzionale)
    onDownload,   // Callback per avviare download (opzionale)
    isDeleting,   // Booleano per indicare se l'eliminazione è in corso
    isSelected    // Booleano per indicare se la card è selezionata
}) => {
    const [thumbLoadError, setImageLoadError] = useState(false);

    if (!resource) return null; // Non renderizzare nulla se la risorsa non è valida

    // Gestore di errore per l'immagine thumbnail
    const handleThumbError = () => {
        console.warn(`Failed to load image thumbnail: ${fullThumbnailUrl}`);
        setImageLoadError(true);
    };

    // Chiamate a funzioni helper
    const fullThumbnailUrl = resource.thumbnail_url ? getFullMediaUrl(resource.thumbnail_url) : null;
    const fileIconElement = getFileIcon(resource.mime_type);

    // Determina se la card è cliccabile (completata e con callback onSelect)
    const isClickable = resource.status === 'COMPLETED' && typeof onSelect === 'function';

    // Gestore click sulla card
    const handleCardClick = (e) => {
        // Evita di selezionare se si clicca su un bottone all'interno
        if (e.target.closest('button') || e.target.closest('a')) {
            return;
        }
        if (isClickable) {
            onSelect(resource);
        }
    };

    // Stati derivati per il rendering
    const isProcessing = resource.status === 'PROCESSING';
    const isFailed = resource.status === 'FAILED';
    const isCompleted = resource.status === 'COMPLETED';
    const potentialUses = Array.isArray(resource.metadata?.potential_uses) ? resource.metadata.potential_uses : [];
    const truncatedPrompt = resource.prompt?.length > 60 ? resource.prompt.substring(0, 60) + '...' : resource.prompt;

    return (
        <div
            className={`bg-white rounded-lg shadow border hover:shadow-lg transition-all duration-200 relative flex flex-col
                       ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                       ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-1' : isFailed ? 'border-red-300 bg-red-50' : 'border-gray-200'}
                       ${isProcessing ? 'opacity-60 pointer-events-none' : ''} {/* Disabilita eventi se processing */}
                      `}
            onClick={handleCardClick}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined} // Rendi focusable se cliccabile
            onKeyDown={(e) => { if (isClickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleCardClick(e); } }} // Attiva con tastiera
        >
            {/* Area Immagine/Icona */}
            <div className="h-32 bg-gray-100 flex items-center justify-center p-2 relative flex-shrink-0">
                 {/* Overlay Processing/Failed */}
                 {isProcessing && ( <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10"><FaSpinner className="animate-spin h-6 w-6 mb-1" /><span className="text-xs font-medium">Processing...</span></div> )}
                 {isFailed && ( <div className="absolute inset-0 bg-red-700 bg-opacity-80 flex flex-col items-center justify-center text-white z-10 p-2"><FaInfoCircle className="h-6 w-6 mb-1" /><span className="text-xs font-medium text-center">Failed</span>{resource.error_message && <p className="text-[10px] mt-1 text-red-200 truncate px-1" title={resource.error_message}>({resource.error_message})</p>}</div> )}

                 {/* Visualizzazione Thumbnail/Icona (solo se non processing/failed) */}
                 {!isProcessing && !isFailed && (
                    <>
                        {isCompleted && fullThumbnailUrl && !thumbLoadError ? (
                            <img src={fullThumbnailUrl} alt={`Thumbnail for ${resource.name || resource.original_filename}`} className="max-h-full max-w-full object-contain" loading="lazy" onError={handleThumbError} />
                        ) : (
                            <div className="text-4xl opacity-50">
                                {React.isValidElement(fileIconElement) ? fileIconElement : <FaFileAlt className="text-gray-400"/>}
                             </div>
                        )}
                        {isCompleted && thumbLoadError && (<div className="absolute bottom-1 right-1 text-red-500 text-[10px] bg-white/70 px-1 rounded">Thumb error</div>)}
                     </>
                 )}
            </div>

            {/* Dettagli Testuali */}
            <div className="p-3 space-y-1 flex-grow">
                <p className="text-sm font-semibold text-gray-800 truncate" title={resource.name || resource.original_filename}>
                    {resource.name || resource.original_filename}
                </p>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                    <span className="flex items-center">
                        {React.isValidElement(fileIconElement) ? React.cloneElement(fileIconElement, {className: "mr-1 h-3 w-3 flex-shrink-0"}) : <FaFileAlt className="mr-1 h-3 w-3 text-gray-400"/>}
                        <span className="truncate" title={resource.mime_type || 'Unknown'}>{resource.mime_type || 'Unknown'}</span>
                    </span>
                    <span>|</span>
                    <span>{formatBytes(resource.size)}</span>
                </div>
                 <p className="text-xs text-gray-400">
                    {new Date(resource.created_at).toLocaleDateString()}
                 </p>

                 {/* Sezione TAGS */}
                {isCompleted && potentialUses.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                        {/* <h4 className="text-xs font-medium text-gray-500 mb-1">Uses:</h4> */}
                        <div className="flex flex-wrap gap-1">
                            {potentialUses.map(use => {
                                const styleInfo = getUseTagStyle(use);
                                if (!styleInfo || !styleInfo.icon || !styleInfo.color) {
                                    return ( <span key={`error-${use || 'unknown'}`} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-800`}><FaInfoCircle className="mr-1" /> Error</span> );
                                }
                                const { icon, color } = styleInfo;
                                return (
                                    <span key={use} title={`Potential Use: ${use}`} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${color}`}>
                                        {React.isValidElement(icon) ? icon : <FaTags className="mr-1" />}
                                        {use.charAt(0).toUpperCase() + use.slice(1)}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
                {/* Badge Completed (se no tag) */}
                {isCompleted && potentialUses.length === 0 && ( <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded mt-2">Completed</span> )}
            </div>

            {/* Azioni (Footer) - Mostra solo se le callback sono fornite */}
            {(onEdit || onDelete || onDownload) && (
                <div className={`border-t border-gray-100 px-3 py-2 flex justify-end space-x-1 ${!isCompleted ? 'invisible' : ''}`}>
                    {onEdit && (
                         <button onClick={(e) => { e.stopPropagation(); onEdit(resource); }} disabled={isProcessing || isDeleting} title="Edit Metadata" className="p-1 text-gray-400 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded" aria-label="Edit"> <FaEdit className="h-4 w-4"/> </button>
                    )}
                    {onDownload && (
                         <button onClick={(e) => { e.stopPropagation(); onDownload(resource); }} title="Download" className="p-1 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded" aria-label="Download"> <FaDownload className="h-4 w-4"/> </button>
                    )}
                    {onDelete && (
                         <button onClick={(e) => { e.stopPropagation(); onDelete(resource.id); }} disabled={isDeleting || isProcessing} title="Delete Resource" className={`p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed ${isDeleting ? 'text-indigo-500' : ''} focus:outline-none focus:ring-1 focus:ring-red-400 rounded`} aria-label="Delete"> {isDeleting ? <MiniSpinner /> : <FaTrashAlt className="h-4 w-4"/>} </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResourceCard;