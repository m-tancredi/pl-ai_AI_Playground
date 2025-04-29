import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaFilter, FaTimes, FaSpinner, FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle } from 'react-icons/fa'; // Importa tutte le icone usate
import {
    listUserResources,
    uploadResource,
    getResourceDetails, // Per polling
    updateResourceMetadata,
    deleteResource
} from '../services/resourceManagerService'; // Assicurati che il path sia corretto
import { useAuth } from '../context/AuthContext'; // Assicurati che il path sia corretto

// Importa componenti
import ResourceCard from '../components/ResourceCard'; // Assicurati che il path sia corretto
import ResourceEditModal from '../components/ResourceEditModal'; // Assicurati che il path sia corretto

// --- Componenti UI base ---
const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm';
    const typeStyle = type === 'error'
        ? 'bg-red-100 border-red-300 text-red-700'
        : 'bg-green-100 border-green-300 text-green-700';
    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            <span className="block sm:inline mr-6">{message}</span> {/* Aggiunto spazio per bottone chiusura */}
            {onClose && (
                 <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3 focus:outline-none" aria-label="Close">
                     <svg className={`fill-current h-5 w-5 ${type === 'error' ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`} role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                 </button>
            )}
        </div>
    );
};

const ProgressBar = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
        <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${value}%` }}></div>
    </div>
);

// Funzione formatBytes (spostata qui per usarla in StorageUsageBar)
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

const StorageUsageBar = ({ used = 0, limit = 1, label }) => { // Defaults sicuri
    const safeUsed = Number(used) || 0;
    const safeLimit = Number(limit) || 1; // Evita divisione per zero
    const percent = safeLimit > 0 ? Math.min(100, (safeUsed / safeLimit) * 100) : 0;
    const usageText = `${formatBytes(safeUsed)} / ${formatBytes(safeLimit)}`;
    const color = percent > 90 ? 'bg-red-600' : percent > 75 ? 'bg-yellow-500' : 'bg-indigo-600';

    return (
        <div className="my-4 p-4 bg-white rounded-md shadow border border-gray-200">
             <div className="flex justify-between mb-1 text-sm font-medium text-gray-700">
                <span className="font-semibold">{label || 'Storage Usage'}</span>
                <span>{usageText} ({percent.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden"> {/* Leggermente più alta */}
                <div className={`${color} h-3 rounded-full transition-all duration-300`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};


const ResourceManagerPage = () => {
    const { isAuthenticated, user } = useAuth();

    // Stato Risorse Utente
    const [userResources, setUserResources] = useState([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [resourcesError, setResourcesError] = useState('');

    // Stato Upload
    const [uploadFiles, setUploadFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);

    // Stato Filtri
    const [currentFilter, setCurrentFilter] = useState('all');

    // Stato Modali
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedResourceForEdit, setSelectedResourceForEdit] = useState(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Stato UI generico
    const [error, setError] = useState(''); // Errore generico pagina
    const [success, setSuccess] = useState(''); // <-- AGGIUNTO STATO SUCCESSO

    // Stato Storage (preso da user context o default)
    const [storageInfo, setStorageInfo] = useState({
        used: user?.storage_used || 0,
        limit: user?.storage_limit || 1 * 1024 * 1024 * 1024 // Default 1GB
    });

    // Aggiorna storageInfo se user cambia
    useEffect(() => {
        setStorageInfo({
            used: user?.storage_used || 0,
            limit: user?.storage_limit || 1 * 1024 * 1024 * 1024
        });
    }, [user]);


    const pollingIntervals = useRef({});

    const buildFullImageUrl = useCallback((relativeUrl) => {
         if (!relativeUrl) return null;
         try {
             const cleanRelativeUrl = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
             return `${window.location.origin}${cleanRelativeUrl}`;
         } catch (e) { console.error("URL build failed:", e); return null; }
    }, []);

    // --- Fetch Iniziale ---
    const fetchResources = useCallback(async (filter = 'all') => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true);
        setResourcesError(''); // Usa lo stato dedicato per errori fetch
        let params = {};
        if (filter !== 'all') {
             const mimeMap = { 'image': 'image/', 'document': 'application/', 'csv': 'text/csv', 'pdf': 'application/pdf' };
             if(mimeMap[filter]) params['mime_type__startswith'] = mimeMap[filter];
        }
        try {
            const resources = await listUserResources(params);
            setUserResources(Array.isArray(resources) ? resources : []); // Assicura sia un array
            // Aggiorna anche lo storage qui se l'API lo restituisce?
        } catch (err) {
            setResourcesError('Failed to load resources. Please refresh the page.');
            setUserResources([]); // Resetta su errore
            console.error("Fetch resources error:", err);
        } finally {
            setIsLoadingResources(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchResources(currentFilter);
    }, [fetchResources, currentFilter]);

    // --- Logica Polling ---
    const startPolling = useCallback((resourceId) => {
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
                    setUserResources(prevResources =>
                        prevResources.map(r => r.id === resourceId ? details : r)
                    );
                    
                    setUploadFiles(prevUploads =>
                        prevUploads.map(f => {
                            if (f.resourceId === resourceId) {
                                // Opzione A: Cambia stato a 'completed' o 'failed'
                                // return { ...f, status: details.status.toLowerCase(), error: details.error_message };
    
                                // Opzione B: Rimuovi dalla lista degli upload attivi (più pulito?)
                                // Per farlo, filtriamo DOPO il map
                                return null; // Segna per rimozione
                            }
                            return f;
                        }).filter(f => f !== null) // Rimuovi gli elementi marcati
                    );

                    if(details.status === 'COMPLETED'){
                        // Aggiorna lo storage usato (semplificato, il backend dovrebbe restituire il nuovo totale)
                        setStorageInfo(prev => ({...prev, used: prev.used + (details.size || 0)}));
                    }
                }
            } catch (error) {
                console.error(`Polling: Error for ${resourceId}:`, error);
                if (error.response?.status === 404) {
                     console.log(`Polling: Resource ${resourceId} not found, stopping poll.`);
                     clearInterval(pollingIntervals.current[resourceId]);
                     delete pollingIntervals.current[resourceId];
                     setUploadFiles(prev => prev.filter(f => f.resourceId !== resourceId));
                     // Rimuovi anche da userResources se ancora lì
                     setUserResources(prev => prev.filter(r => r.id !== resourceId));
                } else {
                    // Considera di fermare dopo N errori o impostare stato 'failed'
                    setUploadFiles(prev => prev.map(f => f.resourceId === resourceId ? {...f, status: 'failed', error: 'Polling failed'} : f));
                    // Fermiamo il polling in caso di errore per evitare loop infiniti
                    clearInterval(pollingIntervals.current[resourceId]);
                    delete pollingIntervals.current[resourceId];
                }
            }
        }, 7000); // Aumentato leggermente intervallo a 7 secondi
    }, []); // Dipendenza vuota

    useEffect(() => { // Cleanup Polling on Unmount
        const intervals = pollingIntervals.current;
        return () => { Object.values(intervals).forEach(clearInterval); };
    }, []);

    // --- Gestione Upload ---
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setIsDragging(false);
        setError(''); // Usa stato errore generico
        setSuccess('');
        let currentUploadErrors = [];

        fileRejections.forEach((rej) => {
            rej.errors.forEach(err => currentUploadErrors.push(`${rej.file.name}: ${err.message}`));
        });

        const filesToUpload = [];
        let cumulativeSize = 0;
        acceptedFiles.forEach(file => {
            const fileId = `${file.name}-${file.size}-${file.lastModified}`;
            const maxSize = 15 * 1024 * 1024;
            if (file.size > maxSize) {
                currentUploadErrors.push(`${file.name}: Exceeds size limit (${formatBytes(maxSize)}).`); return;
            }
            // Validazione spazio disponibile (cumulativa per batch)
            if (storageInfo.used + cumulativeSize + file.size > storageInfo.limit) {
                 currentUploadErrors.push(`${file.name}: Not enough storage space for this batch.`);
                 // Potremmo interrompere l'aggiunta di altri file qui
                 return;
            }
            cumulativeSize += file.size;
            filesToUpload.push({ fileId, file, progress: 0, status: 'pending', error: null });
        });

        if (currentUploadErrors.length > 0) {
            setError(`Upload issues:\n- ${currentUploadErrors.join('\n- ')}`);
        }

        if (filesToUpload.length > 0) {
             setUploadFiles(prev => [...filesToUpload, ...prev]); // Aggiungi all'inizio per visibilità
             filesToUpload.forEach(uploadItem => uploadFile(uploadItem));
        }

    }, [storageInfo, startPolling]); // Aggiunto startPolling alle dipendenze

    const uploadFile = async (uploadItem) => {
        const { fileId, file } = uploadItem;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name); // Invia nome originale come default

         setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'uploading', progress: 0 } : f));

        try {
            const response = await uploadResource(formData, (progressEvent) => {
                 if (progressEvent.total) {
                     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                     setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, progress: percentCompleted } : f));
                 }
            });

             console.log("Initial upload response:", response);
             setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'processing', progress: 100, resourceId: response.id, error: null } : f));
             // Aggiungi subito alla lista principale (assicurati che l'oggetto response sia compatibile)
             const initialResourceData = {
                 ...response, // Dati da UploadResponseSerializer
                 // Aggiungi campi mancanti se necessario per ResourceCard
                 mime_type: null,
                 size: file.size,
                 metadata: null,
                 thumbnail_url: null,
                 file_url: null, // Il file non è ancora pronto/processato
                 status: 'PROCESSING', // Assicurati sia corretto
                 name: response.name || file.name,
             };
             setUserResources(prev => [initialResourceData, ...prev]);
             startPolling(response.id);

        } catch (error) {
            console.error(`Upload failed for ${file.name}:`, error);
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
             setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'failed', progress: 0, error: errorMsg } : f));
             setError(`Upload failed for ${file.name}.`); // Mostra errore generico
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: {'image/*':[], 'application/pdf':[], 'text/csv':[], 'application/msword':[], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':[]},
        maxSize: 15 * 1024 * 1024, multiple: true,
        onDragEnter: () => setIsDragging(true), onDragLeave: () => setIsDragging(false),
    });

    // --- Gestione Modifica/Eliminazione ---
     const handleEditResource = (resource) => { setSelectedResourceForEdit(resource); setShowEditModal(true); };
     const handleUpdateResource = async (resourceId, metadata) => {
         try {
             const updatedResource = await updateResourceMetadata(resourceId, metadata);
             setUserResources(prev => prev.map(r => r.id === resourceId ? updatedResource : r));
             setShowEditModal(false); setSuccess(`Resource updated.`); return true;
         } catch (error) { console.error("Update failed:", error); return false; }
     };

     const handleDeleteClick = (resource) => { // Riceve l'oggetto intero
        if (resource && resource.id) { // Verifica che l'oggetto e l'ID esistano
            setResourceToDelete(resource); // Salva oggetto per il modale
            setShowConfirmDeleteModal(true);
        } else {
            console.error("Attempted to delete with invalid resource object:", resource);
            setError("Cannot delete resource: Invalid data.");
        }
    };     

    const confirmDelete = async () => {
        // Usa l'ID salvato nello stato resourceToDelete
        if (!resourceToDelete || resourceToDelete.id === null || resourceToDelete.id === undefined) {
             console.error("Delete confirmation failed: resourceToDelete or its ID is invalid.", resourceToDelete);
             setError("Cannot delete resource: ID missing.");
             setShowConfirmDeleteModal(false); // Chiudi modale
             return;
        }
    
        const idToDelete = resourceToDelete.id; // Ottieni l'ID PRIMA di fare altro
        const originalFilename = resourceToDelete.original_filename; // Per messaggio successo
        const sizeToDelete = resourceToDelete.size || 0;
    
        setIsDeleting(true); // Imposta stato deleting (potrebbe essere specifico per ID)
        setError('');
        setSuccess('');
        setShowConfirmDeleteModal(false);
    
        try {
            await deleteResource(idToDelete); // Usa l'ID salvato
            setSuccess(`Resource "${originalFilename}" deleted.`);
            setUserResources(prev => prev.filter(r => r.id !== idToDelete));
            setResourceToDelete(null); // Resetta dopo successo
            setStorageInfo(prev => ({...prev, used: Math.max(0, prev.used - sizeToDelete)}));
        } catch (error) {
            setError(error.response?.data?.detail || error.response?.data?.error || `Failed to delete resource ${idToDelete}.`);
            console.error(`Delete failed for ${idToDelete}:`, error);
        } finally {
            setIsDeleting(false); // Resetta stato deleting
            setResourceToDelete(null); // Assicura reset anche in caso di errore
        }
    };
    
    // --- Filtro Risorse ---
    const filteredResources = useMemo(() => {
         if (currentFilter === 'all') return userResources;
         return userResources.filter(r => {
             const mime = r.mime_type || '';
             if (currentFilter === 'image') return mime.startsWith('image/');
             if (currentFilter === 'pdf') return mime === 'application/pdf';
             if (currentFilter === 'csv') return mime === 'text/csv';
             if (currentFilter === 'document') return mime.startsWith('application/vnd') || mime.startsWith('application/msword') || mime === 'application/pdf';
             return false;
         });
     }, [userResources, currentFilter]);

    // --- Rendering ---
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Resource Manager</h1>

             <StorageUsageBar used={storageInfo.used} limit={storageInfo.limit} />

             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* Area Upload */}
            <div {...getRootProps()} className={`border-2 ${isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors duration-200`}>
                <input {...getInputProps()} />
                <FaUpload className={`mx-auto h-10 w-10 sm:h-12 sm:w-12 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-3 sm:mb-4`} />
                {isDragActive ? ( <p className="text-indigo-700 font-semibold">Drop files here...</p> )
                : ( <>
                        <p className="text-gray-700 font-semibold text-sm sm:text-base">Drag & drop files here, or click to select</p>
                        <p className="text-xs text-gray-500 mt-1">Max 15MB. Images, Docs, CSV, PDF.</p>
                    </>
                )}
            </div>

             {/* Uploads in Corso / Falliti */}
            {(uploadFiles.length > 0) && (
                <div className="mt-4 space-y-3">
                    {uploadFiles.map(f => (
                        <div key={f.fileId} className={`p-3 rounded border text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ${f.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                             <span className="font-medium truncate block sm:inline" title={f.file.name}>{f.file.name}</span>
                             <div className="flex items-center gap-2 sm:w-auto w-full justify-between">
                                {(f.status === 'uploading') && (<div className='w-32'><ProgressBar value={f.progress} /></div>)}
                                {(f.status === 'processing') && (<span className='text-xs text-blue-600 flex items-center'><Spinner small /> Processing...</span>)}
                                {(f.status === 'pending') && (<span className='text-xs text-gray-500'>Waiting...</span>)}
                                {(f.status === 'failed') && (<span className='text-xs text-red-700 truncate flex-shrink min-w-0' title={f.error}>Error: {f.error || 'Failed'}</span>)}
                                {/* Opzionale: Bottone per rimuovere dalla lista */}
                                {/* <button onClick={() => setUploadFiles(prev => prev.filter(item => item.fileId !== f.fileId))} className='text-xs text-gray-400 hover:text-red-500'><FaTimes /></button> */}
                            </div>
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
                            key={resource.id}
                            resource={resource} // Passa l'oggetto resource
                            buildFullUrl={buildFullImageUrl}
                            onEdit={handleEditResource} // handleEditResource si aspetta l'oggetto
                            onDelete={handleDeleteClick} // <-- PASSA handleDeleClick DIRETTAMENTE
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
                         <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
                         <p className="text-sm text-gray-600 mb-6">
                             Delete resource: <br /> <strong className="break-all">"{resourceToDelete.name || resourceToDelete.original_filename}"</strong>?
                             <br />This action cannot be undone.
                         </p>
                         {/* Mostra errore di delete qui se necessario */}
                         <div className="flex justify-end space-x-3">
                             <button onClick={() => setShowConfirmDeleteModal(false)} disabled={isDeleting} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm disabled:opacity-50"> Cancel </button>
                             <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center disabled:opacity-50">
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