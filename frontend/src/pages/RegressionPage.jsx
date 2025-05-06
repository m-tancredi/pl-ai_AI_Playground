// src/pages/RegressionPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { FaUpload, FaTable, FaSave, FaTimes, FaSpinner, FaInfoCircle, FaChartLine, FaFileImage, FaFilePdf, FaFileCsv, FaFileWord, FaFileAlt, FaEdit, FaTrashAlt, FaDownload, FaTags, FaBrain, FaListOl } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources, uploadResource, getResourceDetails, deleteResource as deleteResourceManagerResource } from '../services/resourceManagerService';
import { runRegression, predictValue } from '../services/regressionService';
import ResourceCard from '../components/ResourceCard';

// --- IMPORT PER IL GRAFICO (AGGIORNATI) ---
import { Scatter } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
    ScatterController, // <-- AGGIUNTO
    LineController     // <-- AGGIUNTO
} from 'chart.js';

// Registra i componenti Chart.js necessari (AGGIORNATO)
ChartJS.register(
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
    ScatterController, // <-- AGGIUNTO
    LineController     // <-- AGGIUNTO
);

// --- FINE IMPORT GRAFICO ---


// --- Componenti UI Base (Definiti qui per autocontenimento) ---

const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm';
    let typeStyle = '';
    let iconColor = '';

    switch (type) {
        case 'success':
            typeStyle = 'bg-green-100 border-green-300 text-green-700';
            iconColor = 'text-green-500 hover:text-green-700';
            break;
        case 'warning':
             typeStyle = 'bg-yellow-100 border-yellow-300 text-yellow-700';
             iconColor = 'text-yellow-500 hover:text-yellow-700';
             break;
        case 'error':
        default:
            typeStyle = 'bg-red-100 border-red-300 text-red-700';
            iconColor = 'text-red-500 hover:text-red-700';
            break;
    }

    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            <span className="block sm:inline mr-6">{message}</span>
            {onClose && (
                 <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3 focus:outline-none" aria-label="Close">
                     <svg className={`fill-current h-5 w-5 ${iconColor}`} role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                 </button>
            )}
        </div>
    );
};

const ProgressBar = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
        <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${value}%` }}></div>
    </div>
);

// Funzione formatBytes
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

// Tabella Editabile Semplice
const EditableTable = ({ headers, data, onDataChange }) => {
    if (!data || data.length === 0) return <p className="text-center text-gray-500 py-4 italic">No data loaded or available for editing.</p>;

    const handleCellChange = (rowIndex, header, value) => {
        const newData = data.map((row, idx) => {
            if (idx === rowIndex) {
                const numericValue = Number(value);
                return { ...row, [header]: isNaN(numericValue) || value === '' ? value : numericValue };
            }
            return row;
        });
        onDataChange(newData);
    };

    return (
        <div className="overflow-x-auto max-h-96 border rounded shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        {headers.map(header => (
                            <th key={header} scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-indigo-50">
                            {headers.map(header => (
                                <td key={`${rowIndex}-${header}`} className="px-1 py-0 whitespace-nowrap">
                                    <input
                                        type={typeof row[header] === 'number' ? 'number' : 'text'}
                                        value={row[header] ?? ''}
                                        onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                        className="w-full border-none focus:ring-1 focus:ring-indigo-300 p-1 rounded bg-transparent focus:bg-white text-sm"
                                        step={typeof row[header] === 'number' ? 'any' : undefined}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
// --- Fine UI ---


const RegressionPage = () => {
    const { isAuthenticated, user } = useAuth();

    // Stato Risorse
    const [availableResources, setAvailableResources] = useState([]);
    const [selectedResource, setSelectedResource] = useState(null);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [resourceError, setResourceError] = useState('');

    // Stato Dati Correnti
    const [currentData, setCurrentData] = useState(null); // Dati CSV parsati (array di oggetti {x, y} per plot dopo regressione)
    const [currentHeaders, setCurrentHeaders] = useState([]); // Headers della risorsa selezionata o dati caricati
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Stato Upload
    const [uploadFilesInfo, setUploadFilesInfo] = useState([]); // { fileId, file, progress, status, error, resourceId }

    // Stato Parametri/Risultati Regressione
    const [selectedFeatureCol, setSelectedFeatureCol] = useState('');
    const [selectedTargetCol, setSelectedTargetCol] = useState('');
    const [regressionResult, setRegressionResult] = useState(null); // { slope, intercept, ... }
    const [predictValueInput, setPredictValueInput] = useState('');
    const [predictionResult, setPredictionResult] = useState(null);

    // Stato UI
    const [isTraining, setIsTraining] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);
    const [isSavingCopy, setIsSavingCopy] = useState(false);
    const [error, setError] = useState(''); // Errori generici pagina
    const [success, setSuccess] = useState(''); // Messaggi successo generici
    const [warning, setWarning] = useState(''); // Avvisi

    const pollingIntervals = useRef({});

    // Helper URL
    const buildFullImageUrl = useCallback((relativeUrl) => {
         if (!relativeUrl) return null;
         try {
            if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
                 const urlObj = new URL(relativeUrl);
                 if (urlObj.hostname === 'localhost' && !urlObj.port && window.location.port) {
                     const path = urlObj.pathname + urlObj.search + urlObj.hash;
                     return `${window.location.origin}${path}`;
                 }
                 return relativeUrl;
            } else if (relativeUrl.startsWith('/')) {
                 return `${window.location.origin}${relativeUrl}`;
            } else { return `${window.location.origin}/${relativeUrl}`; }
         } catch (e) { console.error("URL build failed:", e); return null; }
    }, []);

    // Fetch Risorse CSV/Regressione
    const fetchRegressionResources = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true);
        setResourceError('');
        try {
            const resources = await listUserResources({ mime_type: 'text/csv', status: 'COMPLETED' });
            const regressionReady = (Array.isArray(resources) ? resources : []).filter(r =>
                 Array.isArray(r.metadata?.potential_uses) &&
                 (r.metadata.potential_uses.includes('regression') || r.metadata.potential_uses.includes('clustering'))
             );
            setAvailableResources(regressionReady);
        } catch (err) {
            setResourceError('Failed to load suitable CSV resources.');
            setAvailableResources([]);
            console.error("Fetch resources error:", err);
        } finally {
            setIsLoadingResources(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchRegressionResources();
    }, [fetchRegressionResources]);

    // Logica Polling (Aggiorna availableResources e mostra warning/error)
    const startPolling = useCallback((resourceId) => {
        if (pollingIntervals.current[resourceId]) clearInterval(pollingIntervals.current[resourceId]);
        console.log(`Polling: Start for ${resourceId}`);
        pollingIntervals.current[resourceId] = setInterval(async () => {
            console.log(`Polling: Check for ${resourceId}`);
            try {
                const details = await getResourceDetails(resourceId);
                if (details.status !== 'PROCESSING') {
                    console.log(`Polling: Complete for ${resourceId} (${details.status})`);
                    clearInterval(pollingIntervals.current[resourceId]); delete pollingIntervals.current[resourceId];
                    setUploadFilesInfo(prev => prev.map(f => f.resourceId === resourceId ? {...f, status: details.status.toLowerCase(), error: details.error_message} : f));

                    const isRegressionReady = details.status === 'COMPLETED' && Array.isArray(details.metadata?.potential_uses) &&
                        (details.metadata.potential_uses.includes('regression') || details.metadata.potential_uses.includes('clustering'));

                    if(isRegressionReady) {
                        setAvailableResources(prev => {
                            const index = prev.findIndex(r => r.id === details.id);
                            if (index > -1) return prev.map(r => r.id === details.id ? details : r);
                            else return [details, ...prev];
                        });
                        // TODO: Aggiorna storage info
                    } else {
                         setAvailableResources(prev => prev.filter(r => r.id !== details.id));
                         if (details.status === 'COMPLETED') setWarning(`File "${details.name || details.original_filename}" processed, but may not be suitable for regression/clustering.`);
                         else if (details.status === 'FAILED') setError(`Processing failed for "${details.name || details.original_filename}".`);
                    }
                }
            } catch (error) {
                console.error(`Polling: Error for ${resourceId}:`, error);
                const isNotFound = error.response?.status === 404;
                clearInterval(pollingIntervals.current[resourceId]); delete pollingIntervals.current[resourceId];
                setUploadFilesInfo(prev => prev.map(f => f.resourceId === resourceId ? {...f, status: 'failed', error: isNotFound ? 'Resource not found' : 'Polling failed'} : f));
                if (isNotFound) setAvailableResources(prev => prev.filter(r => r.id !== resourceId));
            }
        }, 7000);
    }, []);

    useEffect(() => { // Cleanup Polling
        const intervals = pollingIntervals.current;
        return () => { Object.values(intervals).forEach(clearInterval); };
    }, []);

    // Gestione Upload
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setError(''); setSuccess(''); setWarning('');
        let currentUploadErrors = [];
        fileRejections.forEach((rej) => rej.errors.forEach(err => currentUploadErrors.push(`${rej.file.name}: ${err.message}`)));
        const filesToUpload = [];
        acceptedFiles.forEach(file => {
            const fileId = `${file.name}-${file.size}-${file.lastModified}`;
            const maxSize = 15 * 1024 * 1024;
            if (file.size > maxSize) { currentUploadErrors.push(`${file.name}: Exceeds size limit (${formatBytes(maxSize)}).`); return; }
            // TODO: Re-enable storage check if needed and storageInfo is reliable
            // if (storageInfo.used + file.size > storageInfo.limit) { currentUploadErrors.push(`${file.name}: Upload exceeds available storage.`); return; }
            filesToUpload.push({ fileId, file, progress: 0, status: 'pending', error: null });
        });
        if (currentUploadErrors.length > 0) setError(`Upload issues:\n- ${currentUploadErrors.join('\n- ')}`);
        if (filesToUpload.length > 0) {
             setUploadFilesInfo(prev => [...filesToUpload, ...prev]);
             filesToUpload.forEach(item => uploadFileToResourceManager(item));
        }
    }, [startPolling/*, storageInfo*/]); // Rimosso dependency da storageInfo per ora

    const uploadFileToResourceManager = async (uploadItem) => {
        const { fileId, file } = uploadItem;
        const formData = new FormData(); formData.append('file', file); formData.append('name', file.name);
        setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'uploading', progress: 0 } : f));
        try {
            const response = await uploadResource(formData, (progressEvent) => {
                 if (progressEvent.total) {
                     const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                     setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, progress: percent } : f));
                 }
            });
             setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'processing', progress: 100, resourceId: response.id, error: null } : f));
             setSuccess(`File "${file.name}" (ID: ${response.id}) uploaded. Processing...`);
             startPolling(response.id);
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
             setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'failed', progress: 0, error: errorMsg } : f));
             setError(`Upload failed for ${file.name}.`);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'text/csv': ['.csv']}, maxSize: 15 * 1024 * 1024, multiple: true });

    // Gestione Selezione Risorsa dalla Card
    const handleResourceSelect = (resource) => {
        if (resource.id === selectedResource?.id) { // Deseleziona
             setSelectedResource(null); setCurrentData(null); setCurrentHeaders([]);
             setSelectedFeatureCol(''); setSelectedTargetCol(''); setRegressionResult(null);
        } else { // Seleziona
            setSelectedResource(resource); setCurrentData(null);
            setCurrentHeaders(resource.metadata?.headers || []);
            setSelectedFeatureCol(''); setSelectedTargetCol(''); setRegressionResult(null);
            setError(''); setSuccess(''); setWarning('');
        }
    };

    // Caricamento Dati per Modifica
    const loadDataForEditing = async () => {
        if (!selectedResource) return setError("Select a resource first.");
        setError(''); setSuccess(''); setWarning(''); setIsLoadingData(true); setCurrentData(null);
        try {
            const downloadUrl = `${window.location.origin}/api/resources/${selectedResource.id}/download/`;
            const token = localStorage.getItem('accessToken');
            if (!token) throw new Error("Auth token not found.");
            const response = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error(`Download failed (Status: ${response.status}) ${await response.text()}`);
            const csvText = await response.text();
            Papa.parse(csvText, {
                 header: true, skipEmptyLines: true, dynamicTyping: true,
                 complete: (results) => {
                     if (results.errors.length) throw new Error(results.errors.map(e=>e.message).join(', '));
                     if (!results.data || results.data.length === 0) throw new Error("CSV file is empty or could not be parsed correctly.");
                     setCurrentData(results.data); setCurrentHeaders(results.meta.fields || (results.data.length > 0 ? Object.keys(results.data[0]) : []));
                     setSuccess("Data loaded for editing.");
                 }, error: (err) => { throw new Error(`CSV Parsing error: ${err.message}`); }
            });
        } catch (err) { setError(err.message || 'Failed to load or parse resource data.'); setCurrentData(null); setCurrentHeaders([]);
        } finally { setIsLoadingData(false); }
    };

    // Esecuzione Regressione
    const handleRunRegression = async () => {
        if (!selectedResource || !selectedFeatureCol || !selectedTargetCol) { setError('Select resource & columns.'); return; }
        setIsTraining(true); setError(''); setSuccess(''); setRegressionResult(null); setPredictionResult(null);
        // --- Dati per il grafico (pulizia): Assicurati che currentData sia caricato PRIMA ---
        let dataForPlot = [];
        if(currentData){ // Se i dati sono già caricati per l'edit
            dataForPlot = currentData
                .map(row => ({ x: row[selectedFeatureCol], y: row[selectedTargetCol] }))
                .filter(point => typeof point.x === 'number' && typeof point.y === 'number' && !isNaN(point.x) && !isNaN(point.y));
        } else {
            // Se i dati non sono caricati, non possiamo plottare subito, ma possiamo eseguire la regressione
            console.warn("Data not loaded for plotting, running regression only.");
        }
        // --- Fine dati per grafico ---
        try {
            const result = await runRegression({ resource_id: selectedResource.id, feature_column: selectedFeatureCol, target_column: selectedTargetCol });
            setRegressionResult(result);
            // Aggiorna currentData con i dati puliti usati PER IL PLOT, SOLO se non erano stati caricati prima
             if (!currentData && result.data_points_used > 0) {
                 // Idealmente il backend restituirebbe i punti usati.
                 // Se non lo fa, non possiamo aggiornare currentData per il plot qui facilmente.
                 // Dovremmo richiamare loadDataForEditing e poi filtrare.
                 // Per ora, lascio currentData a null se non caricato manualmente.
                 console.log("Regression done, but data for plot not pre-loaded.");
             } else if (currentData) {
                 // Se erano caricati, assicurati che currentData contenga i punti {x,y} puliti
                 setCurrentData(dataForPlot);
             }
            setSuccess(result.message || 'Regression successful!');
        } catch (err) { setError(err.response?.data?.error || err.message || 'Regression failed.'); setCurrentData(null); // Resetta dati su errore
        } finally { setIsTraining(false); }
    };

    // Predizione
    const handlePredict = async () => {
         if (!regressionResult || predictValueInput === '' || isNaN(parseFloat(predictValueInput))) { setError('Run regression & enter numeric X value.'); return; }
         setIsPredicting(true); setError(''); setPredictionResult(null);
         try {
             const result = await predictValue({ slope: regressionResult.slope, intercept: regressionResult.intercept, feature_value: parseFloat(predictValueInput) });
             setPredictionResult(result.predicted_value);
         } catch (err) { setError(err.response?.data?.error || 'Prediction failed.');
         } finally { setIsPredicting(false); }
     };

    // Salvataggio Copia Modificata
    const handleSaveCopy = async () => {
        if (!currentData || !selectedResource) { setError('Load and modify data before saving a copy.'); return; }
        const originalResource = selectedResource;
        setIsSavingCopy(true); setError(''); setSuccess('');
        try {
            const csvString = Papa.unparse(currentData, { header: true });
            const newFileName = `${originalResource.name || 'resource'}_modified_${Date.now()}.csv`;
            const csvFile = new File([csvString], newFileName, { type: "text/csv" });
            const formData = new FormData();
            formData.append('file', csvFile); formData.append('name', newFileName);
            formData.append('description', `Modified copy of ${originalResource.original_filename} (ID: ${originalResource.id})`);
            const response = await uploadResource(formData);
            setSuccess(`Modified copy uploaded (ID: ${response.id}). Processing...`);
            //setCurrentData(null); // Opzionale: Resetta tabella dopo salvataggio
            startPolling(response.id);
        } catch (err) { setError(err.response?.data?.error || 'Failed to save modified copy.');
        } finally { setIsSavingCopy(false); }
    };

    // --- Preparazione Dati e Opzioni per Chart.js ---
    const chartDataAndOptions = useMemo(() => {
        // Mostra grafico solo se c'è risultato E currentData (che contiene i punti {x,y} puliti)
        if (!regressionResult || !currentData || currentData.length === 0 || !selectedFeatureCol || !selectedTargetCol) {
            return null;
        }
        // currentData ora dovrebbe contenere {x, y} puliti (impostato in handleRunRegression)
        const scatterData = currentData; // Già nel formato {x, y}

        const { slope, intercept } = regressionResult;
        const xValues = scatterData.map(p => p.x);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        // Aggiungi un piccolo margine per la linea se minX === maxX
        const lineMinX = minX === maxX ? minX - 1 : minX;
        const lineMaxX = minX === maxX ? maxX + 1 : maxX;
        const regressionLineData = [
            { x: lineMinX, y: slope * lineMinX + intercept },
            { x: lineMaxX, y: slope * lineMaxX + intercept },
        ];

        const data = {
            datasets: [
                { label: `Data Points`, data: scatterData, backgroundColor: 'rgba(75, 192, 192, 0.6)', type: 'scatter', pointRadius: 4 },
                { label: `Regression Line (R²: ${regressionResult.r_squared?.toFixed(3)})`, data: regressionLineData, borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 2, fill: false, tension: 0, type: 'line', pointRadius: 0 },
            ],
        };
        const options = {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: `Regression: ${selectedTargetCol} vs ${selectedFeatureCol}`, font: { size: 16 } }, tooltip: { callbacks: { label: (ctx) => ctx.parsed.y !== null ? `(${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(2)})` : '' } } },
            scales: { x: { type: 'linear', position: 'bottom', title: { display: true, text: selectedFeatureCol, font: { weight: 'bold' } } }, y: { type: 'linear', position: 'left', title: { display: true, text: selectedTargetCol, font: { weight: 'bold' } } } }
        };
        return { data, options };
    }, [regressionResult, currentData, selectedFeatureCol, selectedTargetCol]);

    // --- Rendering ---
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Linear Regression</h1>

            {/* Rimosso StorageUsageBar */}

            {error && <Alert type="error" message={error} onClose={() => setError('')} />}
            {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}
            {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Colonna Sinistra: Selezione/Upload Risorse */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Upload Nuovo File */}
                     <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                         <h3 className="text-md font-semibold text-gray-700 mb-2">Upload New CSV</h3>
                         <div {...getRootProps()} className={`border-2 ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg p-5 text-center cursor-pointer transition-colors`}>
                            <input {...getInputProps()} />
                            <FaUpload className={`mx-auto h-8 w-8 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-2`} />
                             {isDragActive ? <p className="text-sm text-indigo-600">Drop CSV here...</p> : <p className="text-sm text-gray-600">Drag & drop or click</p>}
                             <p className="text-xs text-gray-500 mt-1">Max 15MB.</p>
                         </div>
                         {/* Lista Upload */}
                         {(uploadFilesInfo.length > 0) && (
                             <div className="mt-3 space-y-1 max-h-40 overflow-y-auto pr-1">
                                {uploadFilesInfo.map(f => (
                                    <div key={f.fileId} className={`p-2 rounded border text-xs flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 ${f.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                        <span className="font-medium truncate block sm:inline flex-grow" title={f.file.name}>{f.file.name}</span>
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
                                            {(f.status === 'uploading') && (<div className='w-20 sm:w-24'><ProgressBar value={f.progress} /></div>)}
                                            {(f.status === 'processing') && (<span className='text-blue-600 flex items-center'><Spinner small /> Processing...</span>)}
                                            {(f.status === 'pending') && (<span className='text-gray-500'>Waiting...</span>)}
                                            {(f.status === 'failed') && (<span className='text-red-700 truncate flex-shrink min-w-0' title={f.error}>Error: {f.error || 'Failed'}</span>)}
                                             {(f.status === 'failed' || f.status === 'completed') && (
                                                 <button onClick={() => setUploadFilesInfo(prev => prev.filter(item => item.fileId !== f.fileId))} className='text-gray-400 hover:text-red-500 ml-2' title="Dismiss"><FaTimes size={12}/></button>
                                             )}
                                        </div>
                                    </div>
                                ))}
                             </div>
                         )}
                     </div>

                     {/* Selezione Risorse Esistenti */}
                     <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                         <h3 className="text-md font-semibold text-gray-700 mb-3">Select Existing Resource</h3>
                         {resourceError && <Alert type="error" message={resourceError} onClose={() => setResourceError('')}/>}
                         {isLoadingResources ? ( <div className="text-center py-4"><Spinner /> Loading...</div> )
                          : availableResources.length > 0 ? (
                             <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                 {availableResources.map(resource => (
                                     <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        buildFullUrl={buildFullImageUrl}
                                        onSelect={handleResourceSelect}
                                        isSelected={selectedResource?.id === resource.id}
                                        // Non passiamo onEdit/onDelete qui
                                    />
                                 ))}
                             </div>
                          ) : ( <p className="text-sm text-gray-500 italic text-center py-4">No suitable CSV resources found.</p> )}
                     </div>
                </div>

                {/* Colonna Destra: Configurazione, Risultati, Grafico, Dati */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Configurazione Regressione */}
                    {selectedResource ? (
                         <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3">
                            <h3 className="text-md font-semibold text-gray-700">Configure & Run Regression</h3>
                            <p className="text-sm text-gray-600 pb-2 border-b">Selected: <span className='font-medium'>{selectedResource.name || selectedResource.original_filename}</span> (ID: {selectedResource.id})</p>
                            {currentHeaders.length > 0 ? (
                                <>
                                    <div>
                                        <label htmlFor="featureCol" className="block text-sm font-medium text-gray-700 mb-1">Feature (X) Column:</label>
                                        <select id="featureCol" value={selectedFeatureCol} onChange={(e) => setSelectedFeatureCol(e.target.value)} className="mt-1 block w-full p-2 text-sm border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                            <option value="">-- Select Feature --</option>
                                            {currentHeaders.map(h => <option key={`f-${h}`} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="targetCol" className="block text-sm font-medium text-gray-700 mb-1">Target (Y) Column:</label>
                                        <select id="targetCol" value={selectedTargetCol} onChange={(e) => setSelectedTargetCol(e.target.value)} className="mt-1 block w-full p-2 text-sm border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                            <option value="">-- Select Target --</option>
                                            {currentHeaders.filter(h => h !== selectedFeatureCol).map(h => <option key={`t-${h}`} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                     <button onClick={handleRunRegression} disabled={!selectedFeatureCol || !selectedTargetCol || isTraining} className="w-full px-4 py-2 mt-3 bg-green-600 text-white rounded-md shadow hover:bg-green-700 disabled:opacity-50 flex items-center justify-center font-medium">
                                         {isTraining && <Spinner small />} Run Regression
                                     </button>
                                </>
                             ) : (<p className="text-sm text-red-500 italic">Headers not found in resource metadata. Cannot configure regression.</p>)}
                         </div>
                     ) : (
                         <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center text-gray-500 italic min-h-[150px] flex items-center justify-center">
                             Select or upload a CSV resource to begin.
                         </div>
                      )}

                    {/* Risultati Regressione e Predizione */}
                     {regressionResult && (
                         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                             <h3 className="text-md font-semibold text-gray-700 mb-2 border-b pb-1">Regression Results</h3>
                             <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                                <span>Slope (Coefficient):</span> <span className="font-mono text-right">{regressionResult.slope?.toFixed(5)}</span>
                                <span>Intercept:</span> <span className="font-mono text-right">{regressionResult.intercept?.toFixed(5)}</span>
                                <span>R-squared:</span> <span className="font-mono text-right">{regressionResult.r_squared?.toFixed(5)}</span>
                                <span>Data Points Used:</span> <span className="font-mono text-right">{regressionResult.data_points_used}</span>
                             </div>
                            <div className="border-t mt-3 pt-3 space-y-2">
                                 <label htmlFor="predictValue" className="block text-sm font-medium text-gray-700">Predict <span className='font-semibold'>{selectedTargetCol || 'Y'}</span> for <span className='font-semibold'>{selectedFeatureCol || 'X'}</span> =</label>
                                 <div className="flex items-center gap-2">
                                    <input type="number" step="any" id="predictValue" value={predictValueInput} onChange={(e) => setPredictValueInput(e.target.value)} placeholder="Enter X value" className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                                    <button onClick={handlePredict} disabled={isPredicting || predictValueInput === ''} className="px-4 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center">
                                         {isPredicting && <Spinner small />} Predict
                                     </button>
                                 </div>
                                 {predictionResult !== null && ( <p className="text-md font-semibold text-indigo-700 mt-2">Predicted Value: <span className="font-mono">{predictionResult.toFixed(5)}</span></p> )}
                            </div>
                         </div>
                     )}

                    {/* Grafico Scatter Plot */}
                    {chartDataAndOptions && !isTraining && (
                         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                            <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
                                <FaChartLine className="mr-2 text-indigo-600"/>Regression Plot
                            </h3>
                             <div className="relative h-64 md:h-80 lg:h-96">
                                <Scatter data={chartDataAndOptions.data} options={chartDataAndOptions.options} />
                            </div>
                         </div>
                     )}

                     {/* Area Dati e Modifica */}
                     {selectedResource && (
                         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                              <div className="flex justify-between items-center mb-3">
                                 <h3 className="text-md font-semibold text-gray-700">Data Preview / Edit</h3>
                                 <button onClick={loadDataForEditing} disabled={isLoadingData} className="text-sm text-indigo-600 hover:underline disabled:opacity-50 flex items-center font-medium">
                                     {isLoadingData && <Spinner small />} {currentData ? 'Reload Data' : 'Load Data to Edit'}
                                 </button>
                             </div>
                              {isLoadingData && <p className='text-sm text-center py-4 text-gray-500'>Loading data...</p>}
                             {currentData ? (
                                 <>
                                     <EditableTable headers={currentHeaders} data={currentData} onDataChange={setCurrentData} />
                                      <button onClick={handleSaveCopy} disabled={isSavingCopy} className="w-full px-4 py-2 mt-3 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium">
                                         {isSavingCopy && <Spinner small />} Save Modified as New Resource
                                     </button>
                                 </>
                             ) : ( <p className="text-sm text-gray-500 italic text-center py-4">{!isLoadingData && "Click 'Load Data' to view or edit the table."}</p> )}
                         </div>
                     )}
                </div>
            </div>
             {/* Modali rimossi */}
        </div>
    );
};

export default RegressionPage;