import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaFilter, FaTimes, FaSpinner, FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle } from 'react-icons/fa';
import {
    listUserResources,
    uploadResource,
    getResourceDetails,
    updateResourceMetadata,
    deleteResource,
    getStorageInfo // Importa la funzione API per lo storage
} from '../services/resourceManagerService'; // Assicurati che il path sia corretto
import { useAuth } from '../context/AuthContext'; // Assicurati che il path sia corretto

// Importa componenti figli
import ResourceCard from '../components/ResourceCard'; // Assicurati che il path sia corretto
import ResourceEditModal from '../components/ResourceEditModal'; // Assicurati che il path sia corretto

// --- Componenti UI base ---
const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm text-sm';
    const typeStyle = type === 'error'
        ? 'bg-red-100 border-red-300 text-red-700'
        : 'bg-green-100 border-green-300 text-green-700';
    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            <span className="block sm:inline mr-6">{message}</span>
            {onClose && (
                 <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3 focus:outline-none" aria-label="Close">
                     <svg className={`fill-current h-5 w-5 ${type === 'error' ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`} role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                 </button>
            )}
        </div>
    );
};

const ProgressBar = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden"> {/* Leggermente più sottile */}
        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div> {/* Assicura 0-100% */}
    </div>
);

const formatBytes = (bytes, decimals = 1) => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 Bytes'; // Gestione input invalidi
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; // Aggiunte unità maggiori
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Gestisci caso limite i >= sizes.length
    const unitIndex = i < sizes.length ? i : sizes.length - 1;
    // Usa la potenza corretta per l'ultima unità se si supera
    const power = i < sizes.length ? i : sizes.length - 1;
    const value = parseFloat((bytes / Math.pow(k, power)).toFixed(dm));
    return value + ' ' + sizes[unitIndex];
};

const StorageUsageBar = ({ used = 0, limit = 1, label, isLoading = false }) => {
    const safeUsed = Number(used) || 0;
    const safeLimit = Number(limit) || 1;
    const percent = safeLimit > 0 ? Math.min(100, (safeUsed / safeLimit) * 100) : 0;
    const usageText = `${formatBytes(safeUsed)} / ${formatBytes(safeLimit)}`;
    const color = percent > 90 ? 'bg-red-600' : percent > 75 ? 'bg-yellow-500' : 'bg-indigo-600';

    return (
        <div className="my-4 p-4 bg-white rounded-md shadow border border-gray-200 relative">
             <div className="flex justify-between mb-1 text-sm font-medium text-gray-700">
                <span className="font-semibold">{label || 'Storage Usage'}</span>
                {/* Mostra 'Loading...' o i valori */}
                <span>{isLoading ? 'Loading...' : `${usageText} (${percent.toFixed(1)}%)`}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
                <div className={`${color} h-3 rounded-full transition-all duration-300`} style={{ width: `${percent}%` }}></div>
            </div>
            {/* Overlay di caricamento opzionale */}
            {/* {isLoading && <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center"><Spinner small/></div> } */}
        </div>
    );
};


const ResourceManagerPage = () => {
    const { isAuthenticated, user } = useAuth(); // Usa il contesto di autenticazione

    // Stato Risorse Utente
    const [userResources, setUserResources] = useState([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [resourcesError, setResourcesError] = useState(''); // Errore specifico per la lista risorse

    // Stato Upload
    const [uploadFiles, setUploadFiles] = useState([]); // Traccia i file in upload: { fileId, file, progress, status, error, resourceId }
    const [isDragging, setIsDragging] = useState(false);

    // Stato Filtri
    const [currentFilter, setCurrentFilter] = useState('all');

    // Stato Modali
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedResourceForEdit, setSelectedResourceForEdit] = useState(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false); // Stato specifico per l'operazione delete

    // Stato UI generico per messaggi
    const [error, setError] = useState(''); // Errore generico (es. upload, delete fallito)
    const [success, setSuccess] = useState(''); // Messaggi di successo

    // Stato Storage
    const [storageInfo, setStorageInfo] = useState({ used: 0, limit: 1 * 1024 * 1024 * 1024 }); // Default 1GB
    const [isLoadingStorage, setIsLoadingStorage] = useState(false);

    // Refs
    const pollingIntervals = useRef({});
    const fileInputRef = useRef(null); // Per resettare input file se necessario

    // Funzione Helper per costruire URL completo
    const buildFullImageUrl = useCallback((relativeUrl) => {
         if (!relativeUrl || typeof relativeUrl !== 'string') return null;
         try {
             const cleanRelativeUrl = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
             // Assumiamo che frontend e API gateway siano sulla stessa origine
             return `${window.location.origin}${cleanRelativeUrl}`;
         } catch (e) {
             console.error("URL build failed for:", relativeUrl, e);
             return null; // Restituisci null in caso di errore
         }
    }, []); // Nessuna dipendenza esterna

    // --- Funzione per Fetch Storage Info ---
    const fetchStorageInfo = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingStorage(true);
        try {
            const info = await getStorageInfo();
            console.log("Fetched Storage Info:", info);
            setStorageInfo({
                used: Number(info.storage_used) || 0,
                limit: Number(info.storage_limit) || 1 * 1024 * 1024 * 1024
            });
        } catch (error) {
            console.error("Failed to fetch storage info:", error);
            setError("Could not load storage information."); // Mostra errore generico
        } finally {
            setIsLoadingStorage(false);
        }
     }, [isAuthenticated]); // Dipende da isAuthenticated

    // --- Fetch Risorse ---
    const fetchResources = useCallback(async (filter = 'all') => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true);
        setResourcesError('');
        let params = {};
        if (filter !== 'all') {
             const mimeMap = { 'image': 'image/', 'document': 'application/', 'csv': 'text/csv', 'pdf': 'application/pdf' };
             if(mimeMap[filter]) params['mime_type__startswith'] = mimeMap[filter];
        }
        try {
            const resources = await listUserResources(params);
            setUserResources(Array.isArray(resources) ? resources : []);
        } catch (err) {
            setResourcesError('Failed to load resources. Please refresh.');
            setUserResources([]);
            console.error("Fetch resources error:", err);
        } finally {
            setIsLoadingResources(false);
        }
    }, [isAuthenticated]);

    // --- Fetch Iniziale ---
    useEffect(() => {
        if (isAuthenticated) {
            fetchResources(currentFilter);
            fetchStorageInfo();
        } else {
            // Resetta stati se utente fa logout
            setUserResources([]); setUploadFiles([]); setError(''); setSuccess('');
            setStorageInfo({ used: 0, limit: 1 * 1024 * 1024 * 1024 });
        }
    }, [isAuthenticated, fetchResources, fetchStorageInfo, currentFilter]); // Aggiunte dipendenze

    // --- Logica Polling ---
    const startPolling = useCallback((resourceId) => {
        if (!resourceId) return; // Non iniziare se ID non valido
        if (pollingIntervals.current[resourceId]) clearInterval(pollingIntervals.current[resourceId]);

        console.log(`Polling: Start for ${resourceId}`);
        pollingIntervals.current[resourceId] = setInterval(async () => {
            console.log(`Polling: Check for ${resourceId}`);
            try {
                const details = await getResourceDetails(resourceId);
                if (details.status !== 'PROCESSING') {
                    console.log(`Polling: Complete for ${resourceId} (${details.status})`);
                    clearInterval(pollingIntervals.current[resourceId]);
                    delete pollingIntervals.current[resourceId];
                    // Aggiorna la risorsa nell'array userResources
                    setUserResources(prev => prev.map(r => r.id === resourceId ? details : r));
                    // Rimuovi dalla lista uploadFiles perché non è più in corso
                    setUploadFiles(prev => prev.filter(f => f.resourceId !== resourceId));

                    if(details.status === 'COMPLETED'){
                         console.log("Polling: Fetching updated storage info after completion...");
                         fetchStorageInfo(); // Aggiorna storage
                         setSuccess(`Resource "${details.name || details.original_filename}" processed successfully.`);
                    } else if (details.status === 'FAILED') {
                         setError(`Processing failed for resource ${resourceId}: ${details.error_message || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                console.error(`Polling: Error for ${resourceId}:`, error);
                const isNotFound = error.response?.status === 404;
                 // Aggiorna UI upload a failed
                 setUploadFiles(prev => prev.map(f => f.resourceId === resourceId ? {...f, status: 'failed', error: isNotFound ? 'Resource deleted?' : 'Polling failed'} : f));
                // Ferma il polling
                clearInterval(pollingIntervals.current[resourceId]);
                delete pollingIntervals.current[resourceId];
                 if (isNotFound) { // Se 404, rimuovi anche dalla lista principale
                      setUserResources(prev => prev.filter(r => r.id !== resourceId));
                 }
            }
        }, 7000); // Intervallo polling 7 secondi
    }, [fetchStorageInfo]); // Aggiunta dipendenza

    // Cleanup Polling
    useEffect(() => { const intervals = pollingIntervals.current; return () => { Object.values(intervals).forEach(clearInterval); }; }, []);

    // --- Gestione Upload ---
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setIsDragging(false); setError(''); setSuccess('');
        let currentUploadErrors = [];
        let batchSize = 0;
        acceptedFiles.forEach(file => batchSize += file.size); // Calcola dimensione totale batch

        // Controllo spazio PRIMA di processare
        if (storageInfo.used + batchSize > storageInfo.limit) {
            setError(`Cannot upload files: Exceeds available storage space (${formatBytes(storageInfo.limit - storageInfo.used)} remaining).`);
            return; // Non processare nessun file del batch
        }

        // Processa rejections
        fileRejections.forEach(rej => rej.errors.forEach(err => currentUploadErrors.push(`${rej.file.name}: ${err.message}`)));

        // Processa file accettati
        const filesToUpload = [];
        acceptedFiles.forEach(file => {
            const fileId = `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`; // ID più univoco
            const maxSize = 15 * 1024 * 1024;
            if (file.size > maxSize) {
                currentUploadErrors.push(`${file.name}: Exceeds size limit (${formatBytes(maxSize)}).`); return;
            }
            filesToUpload.push({ fileId, file, progress: 0, status: 'pending', error: null, resourceId: null });
        });

        if (currentUploadErrors.length > 0) { setError(`Upload issues:\n- ${currentUploadErrors.join('\n- ')}`); }
        if (filesToUpload.length > 0) {
            setUploadFiles(prev => [...filesToUpload, ...prev]); // Aggiungi i nuovi in cima
            // Aggiorna *provvisoriamente* storage (verrà corretto da API)
            setStorageInfo(prev => ({...prev, used: prev.used + batchSize }));
            filesToUpload.forEach(uploadItem => uploadFile(uploadItem));
        }
    }, [storageInfo, startPolling]); // Aggiunte dipendenze

    const uploadFile = async (uploadItem) => {
        const { fileId, file } = uploadItem;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name); // Invia nome file come default

        setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'uploading', progress: 0 } : f));

        try {
            const initialResourceData = await uploadResource(formData, (progressEvent) => {
                 if (progressEvent.total) {
                     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                     setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, progress: percentCompleted } : f));
                 }
            });
             console.log("Initial upload response:", initialResourceData);
             setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'processing', progress: 100, resourceId: initialResourceData.id, error: null } : f));
             // Aggiungi subito alla lista con i dati iniziali ricevuti
             setUserResources(prev => [{...initialResourceData, size: file.size}, ...prev]); // Aggiungi size noto dal file
             startPolling(initialResourceData.id);
        } catch (error) {
            console.error(`Upload failed for ${file.name}:`, error);
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
            setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'failed', progress: 0, error: errorMsg } : f));
            setError(`Upload failed for ${file.name}.`);
            // Rimuovi la dimensione aggiunta provvisoriamente
            setStorageInfo(prev => ({...prev, used: Math.max(0, prev.used - file.size) }));
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: {'image/*':[], 'application/pdf':[], 'text/csv':[], 'application/msword':[], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':[]},
        maxSize: 15 * 1024 * 1024, multiple: true,
        onDragEnter: () => setIsDragging(true), onDragLeave: () => setIsDragging(false),
        disabled: isLoadingStorage // Disabilita dropzone mentre carica storage info?
    });

    // --- Gestione Modifica/Eliminazione ---
    const handleEditResource = (resource) => { if(resource) { setSelectedResourceForEdit(resource); setShowEditModal(true); }};
    const handleUpdateResource = async (resourceId, metadata) => {
        try {
            const updatedResource = await updateResourceMetadata(resourceId, metadata);
            setUserResources(prev => prev.map(r => r.id === resourceId ? updatedResource : r));
            setShowEditModal(false); setSuccess(`Resource updated.`); return true;
        } catch (error) { console.error("Update failed:", error); /* L'errore è gestito nel modale */ return false; }
    };
    const handleDeleteClick = (resource) => { // Riceve oggetto corretto da ResourceCard
        if (resource && resource.id != null) {
             setResourceToDelete(resource); setShowConfirmDeleteModal(true);
        } else { console.error("Delete clicked on invalid resource:", resource); setError("Cannot delete: Invalid data.");}
    };
    const confirmDelete = async () => {
        if (!resourceToDelete || resourceToDelete.id == null) return;
        const idToDelete = resourceToDelete.id;
        const nameToDelete = resourceToDelete.name || resourceToDelete.original_filename;
        setIsDeleting(true); setError(''); setSuccess(''); setShowConfirmDeleteModal(false);
        try {
            await deleteResource(idToDelete);
            setSuccess(`Resource "${nameToDelete}" deleted.`);
            setUserResources(prev => prev.filter(r => r.id !== idToDelete));
            setResourceToDelete(null);
            fetchStorageInfo(); // Aggiorna storage dopo delete
        } catch (error) { setError(error.response?.data?.error || `Failed to delete resource.`); console.error(`Delete failed:`, error);
        } finally { setIsDeleting(false); setResourceToDelete(null); }
    };

    // --- Filtro Risorse ---
    const filteredResources = useMemo(() => {
         if (!Array.isArray(userResources)) return []; // Safety check
         if (currentFilter === 'all') return userResources;
         return userResources.filter(r => {
             const mime = r.mime_type || '';
             if (currentFilter === 'image') return mime.startsWith('image/');
             if (currentFilter === 'pdf') return mime === 'application/pdf';
             if (currentFilter === 'csv') return mime === 'text/csv';
             if (currentFilter === 'document') return mime.startsWith('application/vnd') || mime.startsWith('application/msword') || mime === 'application/pdf' || mime.startsWith('text/'); // Esempio più ampio
             return false;
         });
     }, [userResources, currentFilter]);

    // --- Rendering ---
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Resource Manager</h1>

            <StorageUsageBar used={storageInfo.used} limit={storageInfo.limit} isLoading={isLoadingStorage} />

            {error && <Alert type="error" message={error} onClose={() => setError('')} />}
            {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* Area Upload */}
            <div {...getRootProps()} className={`border-2 ${isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors duration-200`}>
                <input {...getInputProps()} />
                <FaUpload className={`mx-auto h-10 w-10 sm:h-12 sm:w-12 ${isDragActive ? 'text-indigo-500 animate-pulse' : 'text-gray-400'} mb-3 sm:mb-4`} />
                {isDragActive ? ( <p className="text-indigo-700 font-semibold">Drop files here...</p> )
                : ( <>
                        <p className="text-gray-700 font-semibold text-sm sm:text-base">Drag & drop files here, or click to select</p>
                        <p className="text-xs text-gray-500 mt-1">Max 15MB. Images, Docs, CSV, PDF.</p>
                    </>
                )}
            </div>

            {/* Liste Upload */}
            {(uploadFiles.length > 0) && (
                <div className="mt-4 space-y-3">
                    {/* In Corso */}
                    {uploadFiles.filter(f => ['uploading', 'pending', 'processing'].includes(f.status)).map(f => (
                        <div key={f.fileId} className="bg-white p-3 rounded border border-gray-200 shadow-sm text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <span className="font-medium truncate block sm:inline flex-grow" title={f.file.name}>{f.file.name}</span>
                            <div className="flex items-center gap-2 sm:w-auto w-full justify-between flex-shrink-0">
                                {(f.status === 'uploading') && (<div className='w-32'><ProgressBar value={f.progress} /></div>)}
                                {(f.status === 'processing') && (<span className='text-xs text-blue-600 flex items-center'><Spinner small /> Processing...</span>)}
                                {(f.status === 'pending') && (<span className='text-xs text-gray-500'>Waiting...</span>)}
                            </div>
                        </div>
                    ))}
                    {/* Falliti */}
                    {uploadFiles.filter(f => f.status === 'failed').map(f => (
                        <div key={f.fileId} className="bg-red-50 p-3 rounded border border-red-200 text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                             <span className="font-medium truncate block sm:inline flex-grow" title={f.file.name}>{f.file.name}</span>
                             <span className='text-xs text-red-700 truncate flex-shrink min-w-0' title={f.error || 'Failed'}>Error: {f.error || 'Failed'}</span>
                             <button onClick={() => setUploadFiles(prev => prev.filter(item => item.fileId !== f.fileId))} className='text-xs text-gray-400 hover:text-red-500 focus:outline-none' title="Dismiss error"> <FaTimes /> </button>
                        </div>
                    ))}
                </div>
            )}


            {/* Filtri e Griglia Risorse */}
            <div className="mt-8 pt-6 border-t border-gray-300">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-gray-800">My Resources</h2>
                     <div>
                         <label htmlFor="filter" className="sr-only">Filter by type</label>
                         <select id="filter" value={currentFilter} onChange={(e) => setCurrentFilter(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                             <option value="all">All Types</option> <option value="image">Images</option>
                             <option value="document">Documents</option> <option value="csv">CSV</option>
                             <option value="pdf">PDF</option>
                         </select>
                     </div>
                 </div>

                 {resourcesError && <Alert type="error" message={resourcesError} onClose={() => setResourcesError('')} />}
                 {isLoadingResources ? ( <div className="text-center py-10"><Spinner /> Loading resources...</div> )
                 : filteredResources.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                         {filteredResources.map(resource => (
                             <ResourceCard
                                key={resource.id} resource={resource} buildFullUrl={buildFullImageUrl}
                                onEdit={handleEditResource} onDelete={handleDeleteClick}
                                isDeleting={resourceToDelete?.id === resource.id && isDeleting}
                             />
                         ))}
                     </div>
                 ) : (
                     <p className="text-center text-gray-500 py-10 italic">
                         {resourcesError ? 'Could not load resources.' : (currentFilter === 'all' ? 'No resources uploaded yet.' : `No ${currentFilter} resources found.`)}
                     </p>
                 )}
            </div>

            {/* Modale Modifica */}
            <ResourceEditModal
                isOpen={showEditModal} onClose={() => setShowEditModal(false)}
                resource={selectedResourceForEdit} onSave={handleUpdateResource}
            />

             {/* Modale Conferma Eliminazione */}
            {showConfirmDeleteModal && resourceToDelete && (
                 <div className="fixed inset-0 bg-gray-800 bg-opacity-80 z-50 flex items-center justify-center p-4">
                     <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
                         <h3 className="text-lg font-semibold mb-4 text-gray-800">Confirm Deletion</h3>
                         <p className="text-sm text-gray-600 mb-6">
                             Delete resource: <br /> <strong className="break-all font-medium text-gray-700">"{resourceToDelete.name || resourceToDelete.original_filename}"</strong>?
                             <br />This action cannot be undone.
                         </p>
                         {/* Non mostriamo errori qui, vengono mostrati nella pagina principale dopo la chiusura */}
                         <div className="flex justify-end space-x-3">
                             <button onClick={() => setShowConfirmDeleteModal(false)} disabled={isDeleting} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm disabled:opacity-50"> Cancel </button>
                             <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 text-sm flex items-center disabled:opacity-50">
                                 {isDeleting && <Spinner small />} Delete
                             </button>
                         </div>
                     </div>
                 </div>
            )}

        </div>
    );
};

export default ResourceManagerPage;