import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaFilter, FaTimes, FaSpinner, FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaInfoCircle, FaQuestionCircle, FaFolder, FaSearch, FaSort, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
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
import ResourcePreviewModal from '../components/ResourcePreviewModal';
import { getFullMediaUrl } from '../utils/getFullMediaUrl';

// --- Componenti UI moderni - stile chatbot ---
const Spinner = ({ small = false, color = 'purple-500' }) => (
    <div className={`inline-block animate-spin rounded-full border-t-4 border-b-4 border-${color} ${small ? 'h-5 w-5 mr-2' : 'h-6 w-6 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const colorClasses = {
        success: 'bg-green-50 border-green-200 text-green-700',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        error: 'bg-red-50 border-red-200 text-red-700'
    };
    const IconComponent = type === 'success' ? FaInfoCircle : FaInfoCircle;
    const iconColor = type === 'success' ? 'text-green-500' : type === 'warning' ? 'text-yellow-500' : 'text-red-500';
    
    if (!message) return null;
    
    return (
        <div className={`max-w-6xl mx-auto mb-6 ${colorClasses[type]} border px-4 py-3 rounded-xl flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                <IconComponent className={`${iconColor} text-xl`} />
                <span className="font-medium">{message}</span>
            </div>
            {onClose && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <FaTimes />
                </button>
            )}
        </div>
    );
};

const ProgressBar = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
    </div>
);

const formatBytes = (bytes, decimals = 1) => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const unitIndex = i < sizes.length ? i : sizes.length - 1;
    const power = i < sizes.length ? i : sizes.length - 1;
    const value = parseFloat((bytes / Math.pow(k, power)).toFixed(dm));
    return value + ' ' + sizes[unitIndex];
};

const StorageUsageBar = ({ used = 0, limit = 1, label, isLoading = false }) => {
    const safeUsed = Number(used) || 0;
    const safeLimit = Number(limit) || 1;
    const percent = safeLimit > 0 ? Math.min(100, (safeUsed / safeLimit) * 100) : 0;
    const usageText = `${formatBytes(safeUsed)} / ${formatBytes(safeLimit)}`;
    const color = percent > 90 ? 'from-red-400 to-red-600' : percent > 75 ? 'from-yellow-400 to-yellow-600' : 'from-purple-400 to-pink-400';

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                    <FaFolder className="text-xl" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{label || 'Storage Usage'}</h3>
                    <p className="text-gray-600">
                        {isLoading ? 'Loading...' : `${usageText} (${percent.toFixed(1)}%)`}
                    </p>
                </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className={`bg-gradient-to-r ${color} h-4 rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

// Bottoni moderni - stile chatbot
const ButtonPrimary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);

const ButtonSecondary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);

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

    // Stato Ricerca
    const [searchTerm, setSearchTerm] = useState('');

    // Stato Ordinamento
    const [sortBy, setSortBy] = useState('name'); // 'name', 'size', 'extension', 'type', 'date'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

    // Stato Paginazione
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);

    // Stato Modali
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedResourceForEdit, setSelectedResourceForEdit] = useState(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Stato UI generico per messaggi
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Stato Storage
    const [storageInfo, setStorageInfo] = useState({ used: 0, limit: 1 * 1024 * 1024 * 1024 });
    const [isLoadingStorage, setIsLoadingStorage] = useState(false);

    // Stato Preview
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedResourceForPreview, setSelectedResourceForPreview] = useState(null);

    // Refs
    const pollingIntervals = useRef({});
    const fileInputRef = useRef(null);

    // Funzione Helper per costruire URL completo
    const buildFullImageUrl = useCallback((urlOrPath) => getFullMediaUrl(urlOrPath), []);

    // Funzione per ottenere l'estensione del file
    const getFileExtension = useCallback((filename) => {
        if (!filename) return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }, []);

    // Funzione per ottenere il tipo di file
    const getFileType = useCallback((mimeType) => {
        if (!mimeType) return 'unknown';
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType === 'text/csv') return 'csv';
        if (mimeType.startsWith('application/vnd') || mimeType.startsWith('application/msword')) return 'document';
        if (mimeType.startsWith('text/')) return 'text';
        return 'unknown';
    }, []);

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
            setError("Could not load storage information.");
        } finally {
            setIsLoadingStorage(false);
        }
     }, [isAuthenticated]);

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
            setUserResources([]); setUploadFiles([]); setError(''); setSuccess('');
            setStorageInfo({ used: 0, limit: 1 * 1024 * 1024 * 1024 });
        }
    }, [isAuthenticated, fetchResources, fetchStorageInfo, currentFilter]);

    // --- Logica Polling ---
    const startPolling = useCallback((resourceId) => {
        if (!resourceId) return;
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
                    setUserResources(prev => prev.map(r => r.id === resourceId ? details : r));
                    setUploadFiles(prev => prev.filter(f => f.resourceId !== resourceId));

                    if(details.status === 'COMPLETED'){
                         console.log("Polling: Fetching updated storage info after completion...");
                         fetchStorageInfo();
                         setSuccess(`Resource "${details.name || details.original_filename}" processed successfully.`);
                    } else if (details.status === 'FAILED') {
                         setError(`Processing failed for resource ${resourceId}: ${details.error_message || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                console.error(`Polling: Error for ${resourceId}:`, error);
                const isNotFound = error.response?.status === 404;
                 setUploadFiles(prev => prev.map(f => f.resourceId === resourceId ? {...f, status: 'failed', error: isNotFound ? 'Resource deleted?' : 'Polling failed'} : f));
                clearInterval(pollingIntervals.current[resourceId]);
                delete pollingIntervals.current[resourceId];
                 if (isNotFound) {
                      setUserResources(prev => prev.filter(r => r.id !== resourceId));
                 }
            }
        }, 7000);
    }, [fetchStorageInfo]);

    // Cleanup Polling
    useEffect(() => { const intervals = pollingIntervals.current; return () => { Object.values(intervals).forEach(clearInterval); }; }, []);

    // --- Gestione Upload ---
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setIsDragging(false); setError(''); setSuccess('');
        let currentUploadErrors = [];
        let batchSize = 0;
        acceptedFiles.forEach(file => batchSize += file.size);

        if (storageInfo.used + batchSize > storageInfo.limit) {
            setError(`Cannot upload files: Exceeds available storage space (${formatBytes(storageInfo.limit - storageInfo.used)} remaining).`);
            return;
        }

        fileRejections.forEach(rej => rej.errors.forEach(err => currentUploadErrors.push(`${rej.file.name}: ${err.message}`)));

        const filesToUpload = [];
        acceptedFiles.forEach(file => {
            const fileId = `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
            const maxSize = 15 * 1024 * 1024;
            if (file.size > maxSize) {
                currentUploadErrors.push(`${file.name}: Exceeds size limit (${formatBytes(maxSize)}).`); return;
            }
            filesToUpload.push({ fileId, file, progress: 0, status: 'pending', error: null, resourceId: null });
        });

        if (currentUploadErrors.length > 0) { setError(`Upload issues:\n- ${currentUploadErrors.join('\n- ')}`); }
        if (filesToUpload.length > 0) {
            setUploadFiles(prev => [...filesToUpload, ...prev]);
            setStorageInfo(prev => ({...prev, used: prev.used + batchSize }));
            filesToUpload.forEach(uploadItem => uploadFile(uploadItem));
        }
    }, [storageInfo, startPolling]);

    const uploadFile = async (uploadItem) => {
        const { fileId, file } = uploadItem;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);

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
             setUserResources(prev => [{...initialResourceData, size: file.size}, ...prev]);
             startPolling(initialResourceData.id);
        } catch (error) {
            console.error(`Upload failed for ${file.name}:`, error);
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
            setUploadFiles(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'failed', progress: 0, error: errorMsg } : f));
            setError(`Upload failed for ${file.name}.`);
            setStorageInfo(prev => ({...prev, used: Math.max(0, prev.used - file.size) }));
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: {'image/*':[], 'application/pdf':[], 'text/csv':[], 'application/msword':[], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':[]},
        maxSize: 15 * 1024 * 1024, multiple: true,
        onDragEnter: () => setIsDragging(true), onDragLeave: () => setIsDragging(false),
        disabled: isLoadingStorage
    });

    // --- Gestione Modifica/Eliminazione ---
    const handleEditResource = (resource) => { if(resource) { setSelectedResourceForEdit(resource); setShowEditModal(true); }};
    const handleUpdateResource = async (resourceId, metadata) => {
        try {
            const updatedResource = await updateResourceMetadata(resourceId, metadata);
            setUserResources(prev => prev.map(r => r.id === resourceId ? updatedResource : r));
            setShowEditModal(false); setSuccess(`Resource updated.`); return true;
        } catch (error) { console.error("Update failed:", error); return false; }
    };
    const handleDeleteClick = (resourceId) => {
        const resource = userResources.find(r => r.id === resourceId);
        if (!resource) {
            setError('Risorsa non trovata o già eliminata.');
            return;
        }
        setResourceToDelete(resource);
        setShowConfirmDeleteModal(true);
    };
    const confirmDelete = async () => {
        if (!resourceToDelete) return;
        setIsDeleting(true);
        try {
            await deleteResource(resourceToDelete.id);
            setUserResources(prev => prev.filter(r => r.id !== resourceToDelete.id));
            setSuccess('Risorsa eliminata con successo.');
        } catch (err) {
            setError('Errore durante l\'eliminazione della risorsa.');
        } finally {
            setIsDeleting(false);
            setShowConfirmDeleteModal(false);
            setResourceToDelete(null);
        }
    };

    // --- Filtro, Ricerca, Ordinamento e Paginazione delle Risorse ---
    const processedResources = useMemo(() => {
        if (!Array.isArray(userResources)) return { resources: [], totalPages: 0, totalItems: 0 };
        
        let filtered = userResources;

        // Applicazione filtro per tipo
        if (currentFilter !== 'all') {
            filtered = filtered.filter(r => {
                const mime = r.mime_type || '';
                if (currentFilter === 'image') return mime.startsWith('image/');
                if (currentFilter === 'pdf') return mime === 'application/pdf';
                if (currentFilter === 'csv') return mime === 'text/csv';
                if (currentFilter === 'document') return mime.startsWith('application/vnd') || mime.startsWith('application/msword') || mime === 'application/pdf' || mime.startsWith('text/');
                return false;
            });
        }

        // Applicazione ricerca testuale
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(r => {
                const name = (r.name || r.original_filename || '').toLowerCase();
                const extension = getFileExtension(r.original_filename).toLowerCase();
                const type = getFileType(r.mime_type).toLowerCase();
                
                return name.includes(search) || 
                       extension.includes(search) || 
                       type.includes(search);
            });
        }

        // Applicazione ordinamento
        const sorted = [...filtered].sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'name':
                    aValue = (a.name || a.original_filename || '').toLowerCase();
                    bValue = (b.name || b.original_filename || '').toLowerCase();
                    break;
                case 'size':
                    aValue = a.file_size || a.size || 0;
                    bValue = b.file_size || b.size || 0;
                    break;
                case 'extension':
                    aValue = getFileExtension(a.original_filename);
                    bValue = getFileExtension(b.original_filename);
                    break;
                case 'type':
                    aValue = getFileType(a.mime_type);
                    bValue = getFileType(b.mime_type);
                    break;
                case 'date':
                    aValue = new Date(a.created_at || a.upload_date || 0);
                    bValue = new Date(b.created_at || b.upload_date || 0);
                    break;
                default:
                    aValue = (a.name || a.original_filename || '').toLowerCase();
                    bValue = (b.name || b.original_filename || '').toLowerCase();
            }

            if (sortBy === 'size' || sortBy === 'date') {
                return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            }
        });

        // Calcolo paginazione
        const totalItems = sorted.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedResources = sorted.slice(startIndex, endIndex);

        return {
            resources: paginatedResources,
            totalPages,
            totalItems,
            currentPage,
            itemsPerPage
        };
    }, [userResources, currentFilter, searchTerm, sortBy, sortOrder, currentPage, itemsPerPage, getFileExtension, getFileType]);

    // Reset della pagina quando cambiano filtri o ricerca
    useEffect(() => {
        setCurrentPage(1);
    }, [currentFilter, searchTerm, sortBy, sortOrder]);

    // Componente Paginazione
    const PaginationControls = ({ totalPages, currentPage, onPageChange }) => {
        if (totalPages <= 1) return null;

        const getPageNumbers = () => {
            const pages = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                const start = Math.max(1, currentPage - 2);
                const end = Math.min(totalPages, start + maxVisible - 1);
                
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
                
                if (start > 1) {
                    pages.unshift('...');
                    pages.unshift(1);
                }
                
                if (end < totalPages) {
                    pages.push('...');
                    pages.push(totalPages);
                }
            }
            
            return pages;
        };

        return (
            <div className="flex items-center justify-center gap-2 mt-8">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    <FaChevronLeft />
                </button>
                
                {getPageNumbers().map((page, index) => (
                    <button
                        key={index}
                        onClick={() => typeof page === 'number' && onPageChange(page)}
                        disabled={page === '...'}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                            page === currentPage
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : page === '...'
                                ? 'cursor-default text-gray-400'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                    >
                        {page}
                    </button>
                ))}
                
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    <FaChevronRight />
                </button>
            </div>
        );
    };

    // --- Funzione per aprire la modale di anteprima
    const handlePreviewResource = (resource) => {
        if (resource) {
            setSelectedResourceForPreview(resource);
            setShowPreviewModal(true);
        }
    };

    // --- Funzione per salvataggio contenuto modificato
    const handleSaveResourceContent = async (resourceId, newContent) => {
        // TODO: implementa la logica di salvataggio
    };

    // --- Funzione per download
    const handleDownloadResource = (resource) => {
        if (!resource) return;
        const url = getFullMediaUrl(resource.file_url || resource.download_url);
        if (url) {
            window.open(url, '_blank');
        }
    };

    // --- Rendering ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <StorageUsageBar used={storageInfo.used} limit={storageInfo.limit} isLoading={isLoadingStorage} />

                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

                {/* Area Upload - stile chatbot */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                            <FaUpload className="text-xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Upload Files</h2>
                    </div>

                    <div {...getRootProps()} className={`border-2 ${isDragActive ? 'border-purple-500 bg-purple-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-xl p-8 text-center cursor-pointer transition-all duration-200`}>
                        <input {...getInputProps()} />
                        <FaUpload className={`mx-auto h-12 w-12 ${isDragActive ? 'text-purple-500 animate-pulse' : 'text-gray-400'} mb-4`} />
                        {isDragActive ? ( <p className="text-purple-700 font-semibold text-lg">Drop files here...</p> )
                        : ( <>
                                <p className="text-gray-700 font-semibold text-lg mb-2">Drag & drop files here, or click to select</p>
                                <p className="text-sm text-gray-500">Max 15MB. Images, Docs, CSV, PDF.</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Liste Upload */}
                {(uploadFiles.length > 0) && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                                <FaSpinner className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Upload Progress</h2>
                        </div>
                        
                        <div className="space-y-4">
                            {/* In Corso */}
                            {uploadFiles.filter(f => ['uploading', 'pending', 'processing'].includes(f.status)).map(f => (
                                <div key={f.fileId} className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                    <span className="font-semibold text-gray-800 truncate flex-grow" title={f.file.name}>{f.file.name}</span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {(f.status === 'uploading') && (<div className='w-32'><ProgressBar value={f.progress} /></div>)}
                                        {(f.status === 'processing') && (<span className='text-sm text-purple-600 flex items-center font-medium'><Spinner small /> Processing...</span>)}
                                        {(f.status === 'pending') && (<span className='text-sm text-gray-500 font-medium'>Waiting...</span>)}
                                    </div>
                                </div>
                            ))}
                            {/* Falliti */}
                            {uploadFiles.filter(f => f.status === 'failed').map(f => (
                                <div key={f.fileId} className="bg-red-50 p-4 rounded-xl border border-red-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                     <span className="font-semibold text-gray-800 truncate flex-grow" title={f.file.name}>{f.file.name}</span>
                                     <span className='text-sm text-red-700 truncate flex-shrink min-w-0 font-medium' title={f.error || 'Failed'}>Error: {f.error || 'Failed'}</span>
                                     <button onClick={() => setUploadFiles(prev => prev.filter(item => item.fileId !== f.fileId))} className='text-sm text-gray-400 hover:text-red-500 focus:outline-none p-2' title="Dismiss error"> 
                                        <FaTimes /> 
                                     </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filtri e Griglia Risorse */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
                            <FaFileAlt className="text-xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Le Mie Risorse</h2>
                    </div>

                    {/* Controlli: Ricerca, Filtri e Ordinamento */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                        {/* Barra di Ricerca */}
                        <div className="lg:col-span-2">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca nelle risorse..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border-0 rounded-xl bg-gray-50 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Filtro per Tipo */}
                        <div>
                            <select 
                                value={currentFilter} 
                                onChange={(e) => setCurrentFilter(e.target.value)} 
                                className="w-full p-3 border-0 rounded-xl bg-gray-50 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="all">Tutti i Tipi</option>
                                <option value="image">Immagini</option>
                                <option value="document">Documenti</option>
                                <option value="csv">CSV</option>
                                <option value="pdf">PDF</option>
                            </select>
                        </div>

                        {/* Ordinamento */}
                        <div>
                            <select 
                                value={`${sortBy}-${sortOrder}`}
                                onChange={(e) => {
                                    const [newSortBy, newSortOrder] = e.target.value.split('-');
                                    setSortBy(newSortBy);
                                    setSortOrder(newSortOrder);
                                }}
                                className="w-full p-3 border-0 rounded-xl bg-gray-50 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="name-asc">Nome (A-Z)</option>
                                <option value="name-desc">Nome (Z-A)</option>
                                <option value="size-asc">Dimensione (Piccola)</option>
                                <option value="size-desc">Dimensione (Grande)</option>
                                <option value="extension-asc">Estensione (A-Z)</option>
                                <option value="extension-desc">Estensione (Z-A)</option>
                                <option value="type-asc">Tipo (A-Z)</option>
                                <option value="type-desc">Tipo (Z-A)</option>
                                <option value="date-desc">Data (Recente)</option>
                                <option value="date-asc">Data (Meno recente)</option>
                            </select>
                        </div>
                    </div>

                    {/* Informazioni sui Risultati */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div className="text-sm text-gray-600">
                            Mostrando {processedResources.resources.length} di {processedResources.totalItems} risorse
                            {searchTerm && (
                                <span> - Ricerca: "<strong>{searchTerm}</strong>"</span>
                            )}
                        </div>
                        <ButtonSecondary onClick={() => fetchResources(currentFilter)} disabled={isLoadingResources}>
                            <FaFilter className="mr-2" />
                            {isLoadingResources ? <Spinner small /> : 'Aggiorna'}
                        </ButtonSecondary>
                    </div>

                     {resourcesError && <Alert type="error" message={resourcesError} onClose={() => setResourcesError('')} />}
                     
                     {isLoadingResources ? ( 
                        <div className="text-center py-12">
                            <Spinner /> 
                            <span className="ml-3 text-gray-600 font-medium">Caricamento risorse...</span>
                        </div> 
                     ) : processedResources.totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                             <FaFileAlt className="text-6xl mb-4" />
                             <p className="text-xl font-semibold">Nessuna risorsa trovata</p>
                             <p className="text-sm">
                                 {searchTerm || currentFilter !== 'all' 
                                     ? 'Prova a modificare i filtri di ricerca'
                                     : 'Carica un file per iniziare!'
                                 }
                             </p>
                         </div>
                     ) : (
                         <>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                 {processedResources.resources.map(resource => (
                                     <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        buildFullUrl={getFullMediaUrl}
                                        onSelect={handlePreviewResource}
                                        onPreview={handlePreviewResource}
                                        onEdit={handleEditResource}
                                        onDelete={handleDeleteClick}
                                        onDownload={handleDownloadResource}
                                        isDeleting={isDeleting && resourceToDelete?.id === resource.id}
                                        isSelected={selectedResourceForEdit?.id === resource.id}
                                     />
                                 ))}
                             </div>

                             {/* Controlli Paginazione */}
                             <PaginationControls
                                 totalPages={processedResources.totalPages}
                                 currentPage={processedResources.currentPage}
                                 onPageChange={setCurrentPage}
                             />
                         </>
                     )}
                </div>

                {/* Modale Modifica */}
                <ResourceEditModal
                    isOpen={showEditModal} onClose={() => setShowEditModal(false)}
                    resource={selectedResourceForEdit} onSave={handleUpdateResource}
                />

                 {/* Modale Conferma Eliminazione - stile chatbot */}
                {showConfirmDeleteModal && resourceToDelete && (
                     <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                         <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                             <div className="flex items-center gap-4 mb-6">
                                 <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
                                     <FaTrashAlt className="text-xl" />
                                 </div>
                                 <h3 className="text-2xl font-bold text-gray-800">Confirm Deletion</h3>
                             </div>
                             <p className="text-gray-600 mb-6 leading-relaxed">
                                 Delete resource: <br /> 
                                 <strong className="break-all font-semibold text-gray-800">"{resourceToDelete.name || resourceToDelete.original_filename}"</strong>?
                                 <br />This action cannot be undone.
                             </p>
                             <div className="flex justify-end space-x-4">
                                 <ButtonSecondary onClick={() => setShowConfirmDeleteModal(false)} disabled={isDeleting}>
                                     Cancel
                                 </ButtonSecondary>
                                 <button 
                                     onClick={confirmDelete} 
                                     disabled={isDeleting} 
                                     className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center disabled:opacity-50"
                                 >
                                     {isDeleting && <Spinner small />} Delete
                                 </button>
                             </div>
                         </div>
                     </div>
                )}

                {/* Modale anteprima risorsa */}
                <ResourcePreviewModal
                    isOpen={showPreviewModal}
                    onClose={() => setShowPreviewModal(false)}
                    resource={selectedResourceForPreview}
                    onSave={handleSaveResourceContent}
                    onDownload={handleDownloadResource}
                />

            </div>
        </div>
    );
};

export default ResourceManagerPage;