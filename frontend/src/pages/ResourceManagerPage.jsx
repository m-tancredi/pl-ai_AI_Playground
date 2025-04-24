import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Importa Servizi API
import {
    uploadResource,
    listUserResources,
    updateResourceMetadata,
    deleteResource
} from '../services/resourceManagerService';

// Importa Componenti UI
import ResourceCard from '../components/ResourceCard';
import ResourceEditModal from '../components/ResourceEditModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// --- Componenti UI Semplici (Spinner, Alert) ---
const Spinner = ({ small = false }) => ( <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div> );
const Alert = ({ type = 'error', message, onClose }) => {
     const baseStyle = 'border px-4 py-3 rounded relative mb-4 text-sm';
     const typeStyle = type === 'error' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
     if (!message) return null;
     return (
         <div className={`${baseStyle} ${typeStyle}`} role="alert">
             <span className="block sm:inline">{message}</span>
             {onClose && ( <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close"> <svg className="fill-current h-6 w-6 text-red-500 hover:text-red-700" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg> </button> )}
         </div>
     );
};
// --- Fine Componenti UI ---

// --- Costanti ---
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
// Limite totale GB (solo per info, validazione nel backend)
const TOTAL_QUOTA_GB = 1;

const ResourceManagerPage = () => {
    const { isAuthenticated } = useAuth();

    // Stato Lista Risorse
    const [userResources, setUserResources] = useState([]);
    const [isLoadingList, setIsLoadingList] = useState(true); // Inizia come true
    const [listError, setListError] = useState('');

    // Stato Upload
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false); // Stato per feedback drag-and-drop

    // Stato Modali e Selezione
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedResourceForModal, setSelectedResourceForModal] = useState(null);
    const [isDeletingResource, setIsDeletingResource] = useState(false);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null); // Riferimento all'area di drop

    // --- Funzioni Helper ---
    const buildFullUrl = useCallback((relativeUrl) => { /* ... (come prima) ... */ }, []);

    const resetUploadForm = () => {
        setSelectedFile(null); setUploadName(''); setUploadDescription('');
        setUploadProgress(0); setUploadError(''); setUploadSuccessMessage('');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsDragging(false);
    };

     const validateFile = (file) => {
         if (!file) return 'No file selected.';
         if (file.size > MAX_FILE_SIZE_BYTES) {
             return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
         }
         // Aggiungere qui altri controlli tipo mime-type se necessario
         // const allowedTypes = ['image/jpeg', 'image/png', 'text/csv', 'application/pdf'];
         // if (!allowedTypes.includes(file.type)) {
         //     return 'Invalid file type.';
         // }
         return null; // Nessun errore
     };

    // --- Effetti ---
    const fetchResources = useCallback(async () => {
        if (!isAuthenticated) {
            console.log("fetchResources: Not authenticated, skipping fetch.");
            setIsLoadingList(false); // Assicurati che loading sia false se non autenticato
            return;
        }
        console.log("fetchResources: Starting fetch..."); // Log inizio fetch
        setIsLoadingList(true);
        setListError(''); // Resetta errore prima del fetch
        try {
            const resources = await listUserResources();
            console.log("fetchResources: API call successful, data received:", resources); // Log dati ricevuti
            if (Array.isArray(resources)) {
                setUserResources(resources);
            } else {
                console.warn("fetchResources: Received non-array data, setting empty array.", resources);
                setUserResources([]); // Imposta array vuoto se formato inatteso
            }
        } catch (err) {
            console.error("fetchResources: API call failed!", err); // Log errore completo
             const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load your resources.';
             console.log("fetchResources: Setting error state:", errorMsg);
            setListError(errorMsg); // Imposta lo stato di errore
            setUserResources([]); // Resetta le risorse su errore
        } finally {
            console.log("fetchResources: Setting isLoadingList to false."); // Log fine fetch
            setIsLoadingList(false); // Assicurati che venga SEMPRE chiamato
        }
    }, [isAuthenticated]); // Dipende SOLO da isAuthenticated? listUserResources non cambia
    
    useEffect(() => {
        console.log("ResourceManagerPage Mounted. isAuthenticated:", isAuthenticated);
        fetchResources(); // Chiama al montaggio
        // Non aggiungere fetchResources come dipendenza se non cambia mai
        // Se isAuthenticated cambia DOPO il montaggio, questo useEffect lo rileverà
    }, [fetchResources, isAuthenticated]); // Aggiunto isAuthenticated per re-fetch se cambia stato login
    useEffect(() => { fetchResources(); }, [fetchResources]);
    useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

    // --- Gestori Eventi Upload e Drag & Drop ---
    const processSelectedFile = (file) => {
         const validationError = validateFile(file);
         if (validationError) {
             setUploadError(validationError);
             resetUploadForm(); // Resetta se il file non è valido
             return;
         }
         setSelectedFile(file);
         setUploadName(file.name); // Pre-popola nome
         setUploadError(''); // Cancella errori precedenti
         setUploadSuccessMessage('');
         if (file.type.startsWith('image/')) {
             if (previewUrl) URL.revokeObjectURL(previewUrl);
             setPreviewUrl(URL.createObjectURL(file));
         } else {
             if (previewUrl) URL.revokeObjectURL(previewUrl);
             setPreviewUrl(null);
         }
    };

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            processSelectedFile(event.target.files[0]);
        }
    };

    // Gestori Drag & Drop
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Solo se il mouse esce veramente dall'area (non su elementi figli)
         if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
            setIsDragging(false);
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault(); // Necessario per permettere il drop
        e.stopPropagation();
        setIsDragging(true); // Mantieni lo stato attivo mentre si è sopra
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setUploadError(''); // Resetta errori

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (e.dataTransfer.files.length > 1) {
                 setUploadError("Please drop only one file at a time.");
                 e.dataTransfer.clearData();
                 return;
            }
            const file = e.dataTransfer.files[0];
            processSelectedFile(file); // Processa il file droppato
            e.dataTransfer.clearData(); // Necessario per alcuni browser
        }
    };

    const handleUploadSubmit = async (event) => {
        event.preventDefault();
        if (!selectedFile) return setUploadError('Please select a file to upload.');

        // Ri-valida il file prima dell'upload (sicurezza aggiuntiva)
        const validationError = validateFile(selectedFile);
         if (validationError) {
             setUploadError(validationError);
             return;
         }

        setIsUploading(true); setUploadProgress(0); setUploadError(''); setUploadSuccessMessage('');

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (uploadName) formData.append('name', uploadName);
        if (uploadDescription) formData.append('description', uploadDescription);

        try {
            const result = await uploadResource(formData, (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });
            setUploadSuccessMessage(`File "${result.original_filename}" uploaded successfully! Processing started (ID: ${result.id}).`);
             setUserResources(prev => [result, ...prev.filter(r => r.id !== result.id)]); // Aggiungi/Aggiorna
            resetUploadForm();
        } catch (err) {
            setUploadError(err.response?.data?.error || err.response?.data?.detail || err.message || 'File upload failed.');
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
        }
    };

    // --- Gestori Modali Galleria ---
    const handleEdit = (resource) => { setSelectedResourceForModal(resource); setShowEditModal(true); };
    const handleDelete = (resource) => { setSelectedResourceForModal(resource); setShowDeleteModal(true); };
    const handleConfirmDelete = async () => { /* ... (come prima) ... */ };
    const handleSaveChanges = async (resourceId, metadata) => { /* ... (come prima) ... */ };

    return (
        <div className="container mx-auto px-4 py-8 space-y-12">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Resource Manager</h1>
                {/* Info Quota (Placeholder) */}
                 <div className="text-sm text-gray-500">
                     {/* Qui potresti mostrare la quota usata se il backend la fornisce */}
                     {/* Storage Limit: {TOTAL_QUOTA_GB} GB */}
                 </div>
            </div>


            {/* Sezione Upload con Drag & Drop */}
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                 <h2 className="text-xl font-semibold mb-5 text-gray-700 border-b pb-2">Upload New Resource</h2>
                 <form onSubmit={handleUploadSubmit} className="space-y-4">
                    {/* Drop Zone */}
                    <div
                        ref={dropZoneRef}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`border-2 ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300'} rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors`}
                        onClick={() => fileInputRef.current?.click()} // Permetti click per aprire selezione file
                    >
                        <input
                            type="file"
                            id="resourceFile"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden" // Nascondi input file standard
                            disabled={isUploading}
                        />
                        <ArrowUpTrayIcon className={`mx-auto h-12 w-12 ${isDragging ? 'text-indigo-600' : 'text-gray-400'} mb-2`} />
                        {selectedFile ? (
                             <div className="text-sm text-gray-700">
                                 <p>Selected: <span className="font-semibold">{selectedFile.name}</span></p>
                                 <p className="text-xs text-gray-500">Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                 {previewUrl && <img src={previewUrl} alt="Preview" className="h-16 w-auto border rounded mx-auto mt-2" />}
                                 <button type="button" onClick={resetUploadForm} className="text-xs text-red-500 hover:underline mt-1">Clear selection</button>
                             </div>
                         ) : (
                            <p className="text-sm text-gray-600">
                                {isDragging ? 'Drop the file here!' : 'Drag & drop your file here, or click to select'}
                            </p>
                         )}
                        <p className="text-xs text-gray-500 mt-1">Max file size: {MAX_FILE_SIZE_MB} MB.</p>
                    </div>

                    {/* Campi Metadati (mostra solo se un file è selezionato) */}
                    {selectedFile && !isUploading && (
                        <>
                            <div>
                                <label htmlFor="uploadName" className="block text-sm font-medium text-gray-700">Custom Name (Optional):</label>
                                <input type="text" id="uploadName" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Defaults to filename" className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
                            </div>
                            <div>
                                <label htmlFor="uploadDescription" className="block text-sm font-medium text-gray-700">Description (Optional):</label>
                                <textarea id="uploadDescription" rows="3" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Add a short description..." className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
                            </div>
                        </>
                    )}

                    {/* Progresso e Bottone Upload */}
                     {isUploading && (
                         <div className="w-full bg-gray-200 rounded-full h-2.5">
                             <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                             <p className="text-xs text-center mt-1">{uploadProgress}%</p>
                         </div>
                     )}
                     {uploadError && <Alert type="error" message={uploadError} onClose={() => setUploadError('')} />}
                     {uploadSuccessMessage && <Alert type="success" message={uploadSuccessMessage} onClose={() => setUploadSuccessMessage('')} />}

                     <button
                        type="submit"
                        disabled={!selectedFile || isUploading}
                        className="w-full flex justify-center items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 disabled:opacity-50 text-lg"
                    >
                        {isUploading ? <Spinner /> : <ArrowUpTrayIcon className="h-5 w-5 mr-2"/>}
                        Upload Resource
                    </button>
                 </form>
            </div>

            {/* Sezione Galleria (invariata rispetto a prima) */}
            <div className="mt-12 pt-8 border-t border-gray-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">My Resources</h2>
                 {listError && <Alert type="error" message={listError} onClose={() => setListError('')}/>}
                 {isLoadingList ? ( <div className="text-center py-10"><Spinner /> Loading resources...</div> )
                  : userResources.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                          {userResources.map(resource => (
                            <ResourceCard
                                key={resource.id}
                                resource={resource}
                                buildFullUrl={buildFullUrl}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                isDeleting={isDeletingResource && selectedResourceForModal?.id === resource.id}
                            />
                          ))}
                      </div>
                  ) : ( <p className="text-center text-gray-500 py-10 italic">You haven't uploaded any resources yet.</p> )}
            </div>

            {/* Modali (invariati) */}
            <ResourceEditModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedResourceForModal(null); }} resource={selectedResourceForModal} onSave={handleSaveChanges}/>
            <ConfirmDeleteModal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedResourceForModal(null); }} resourceName={selectedResourceForModal?.name || selectedResourceForModal?.original_filename} onConfirm={handleConfirmDelete} isDeleting={isDeletingResource} />

        </div>
    );
};

export default ResourceManagerPage;