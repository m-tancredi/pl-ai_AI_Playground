import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse'; // Per convertire dati modificati in CSV per il save copy
import { FaUpload, FaTable, FaSave, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources, uploadResource } from '../services/resourceManagerService'; // Importa funzioni Resource Manager
import { runRegression, predictValue } from '../services/regressionService'; // Importa funzioni Regression Service

// --- Componenti UI ---
const Spinner = ({ small = false }) => ( <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div> );
const Alert = ({ type = 'error', message, onClose }) => { /* ... (implementazione come prima) ... */ };
const ProgressBar = ({ value }) => ( <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden"><div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${value}%` }}></div></div> );
const formatBytes = (bytes, decimals = 1) => { /* ... (implementazione come prima) ... */ };
// --- Fine UI ---

// Tabella Editabile Semplice (Potresti usare una libreria come react-table per funzionalità avanzate)
const EditableTable = ({ headers, data, onDataChange }) => {
    if (!data || data.length === 0) return <p className="text-center text-gray-500 py-4">No data loaded for editing.</p>;

    const handleCellChange = (rowIndex, header, value) => {
        const newData = [...data];
        // Prova a convertire in numero se possibile, altrimenti mantieni stringa
        const numericValue = Number(value);
        newData[rowIndex] = { ...newData[rowIndex], [header]: isNaN(numericValue) ? value : numericValue };
        onDataChange(newData);
    };

    return (
        <div className="overflow-x-auto max-h-96 border rounded shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        {headers.map(header => (
                            <th key={header} scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                            {headers.map(header => (
                                <td key={`${rowIndex}-${header}`} className="px-1 py-0.5 whitespace-nowrap">
                                    <input
                                        type={typeof row[header] === 'number' ? 'number' : 'text'}
                                        value={row[header] ?? ''} // Gestisci null/undefined
                                        onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                        className="w-full border-none focus:ring-1 focus:ring-indigo-300 p-1 rounded bg-transparent focus:bg-white text-sm"
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


const RegressionPage = () => {
    const { isAuthenticated } = useAuth();

    // Stato Selezione/Dati Risorsa
    const [availableResources, setAvailableResources] = useState([]); // Risorse CSV dal Resource Manager
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [selectedResourceHeaders, setSelectedResourceHeaders] = useState([]); // Headers della risorsa selezionata
    const [currentData, setCurrentData] = useState(null); // Dati CSV parsati per visualizzazione/modifica
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [resourceError, setResourceError] = useState('');

    // Stato Upload (come in ResourceManagerPage)
    const [uploadFilesInfo, setUploadFilesInfo] = useState([]); // Traccia upload in corso

    // Stato Parametri Regressione
    const [selectedFeatureCol, setSelectedFeatureCol] = useState('');
    const [selectedTargetCol, setSelectedTargetCol] = useState('');

    // Stato Risultati
    const [regressionResult, setRegressionResult] = useState(null); // { slope, intercept, ... }
    const [predictValueInput, setPredictValueInput] = useState('');
    const [predictionResult, setPredictionResult] = useState(null);

    // Stato UI
    const [isTraining, setIsTraining] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);
    const [isSavingCopy, setIsSavingCopy] = useState(false);
    const [error, setError] = useState(''); // Errori specifici della pagina
    const [success, setSuccess] = useState('');

    // --- Fetch Risorse CSV ---
    const fetchCsvResources = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true);
        setResourceError('');
        try {
            // Filtra per CSV o per potential_use 'regression'
            const resources = await listUserResources({ mime_type: 'text/csv' });
            // const resources = await listUserResources({ 'metadata__potential_uses__contains': 'regression' }); // Alternativa se usi JSONField specifico in backend
            setAvailableResources(Array.isArray(resources) ? resources : []);
        } catch (err) {
            setResourceError('Failed to load available CSV resources.');
            setAvailableResources([]);
        } finally {
            setIsLoadingResources(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchCsvResources();
    }, [fetchCsvResources]);

    // --- Gestione Selezione Risorsa ---
    const handleResourceSelect = (event) => {
        const resourceId = event.target.value;
        setSelectedResourceId(resourceId);
        // Resetta stati dipendenti
        setCurrentData(null);
        setSelectedResourceHeaders([]);
        setSelectedFeatureCol('');
        setSelectedTargetCol('');
        setRegressionResult(null);
        setPredictionResult(null);
        setError('');
        setSuccess('');

        if (resourceId) {
            const selected = availableResources.find(r => r.id.toString() === resourceId);
            if (selected && selected.metadata?.headers) {
                setSelectedResourceHeaders(selected.metadata.headers);
            } else {
                // Se mancano header nei metadati, potresti provare a fare GET details
                // ma idealmente il Resource Manager li popola sempre per i CSV
                setResourceError("Selected resource metadata doesn't contain headers.");
            }
        }
    };

     // --- Caricamento Dati per Visualizzazione/Modifica (MANUALE) ---
     // Questa funzione ora non viene chiamata automaticamente alla selezione
     const loadDataForEditing = async () => {
         if (!selectedResourceId) return setError("Please select a resource first.");
         setError(''); setSuccess(''); setIsLoadingResources(true); // Riutilizza lo stato loading
         setCurrentData(null); // Resetta dati precedenti
         try {
             // Usa l'endpoint di download per ottenere i dati grezzi
             const downloadUrl = `${window.location.origin}/api/resources/${selectedResourceId}/download/`;
             const response = await fetch(downloadUrl, {
                 headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } // Aggiungi token!
             });
             if (!response.ok) { throw new Error(`Failed to download data: ${response.statusText}`); }
             const csvText = await response.text();

             // Parsa con Papaparse
             Papa.parse(csvText, {
                 header: true, skipEmptyLines: true, dynamicTyping: true,
                 complete: (results) => {
                     if (results.errors.length) throw new Error(results.errors[0].message);
                     if (results.data.length === 0) throw new Error("CSV appears empty.");
                     setCurrentData(results.data);
                     // Assicura che gli header siano aggiornati in caso di discrepanze
                     setSelectedResourceHeaders(results.meta.fields || Object.keys(results.data[0]));
                     setSuccess("Data loaded for viewing/editing.");
                 },
                 error: (err) => { throw new Error(`CSV Parsing failed: ${err.message}`); }
             });
         } catch (err) {
             setError(err.message || 'Failed to load or parse resource data.');
             setCurrentData(null);
         } finally {
            setIsLoadingResources(false);
         }
     };

    // --- Gestione Upload (chiama Resource Manager) ---
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        // Logica simile a ResourceManagerPage, ma chiama uploadFile qui sotto
         setError(''); setSuccess('');
         let currentUploadErrors = [];
         fileRejections.forEach((rej) => rej.errors.forEach(err => currentUploadErrors.push(`${rej.file.name}: ${err.message}`)));

         const filesToUpload = [];
         acceptedFiles.forEach(file => {
             const fileId = `${file.name}-${file.size}-${file.lastModified}`;
             const maxSize = 15 * 1024 * 1024;
             if (file.size > maxSize) { currentUploadErrors.push(`${file.name}: Exceeds size limit.`); return; }
             // TODO: Verifica spazio storage se necessario
             filesToUpload.push({ fileId, file, progress: 0, status: 'pending', error: null });
         });

         if (currentUploadErrors.length > 0) setError(`Upload issues:\n- ${currentUploadErrors.join('\n- ')}`);
         if (filesToUpload.length > 0) {
             setUploadFilesInfo(prev => [...filesToUpload, ...prev]);
             filesToUpload.forEach(item => uploadFileToResourceManager(item));
         }
    }, [/* dipende da storageInfo se implementato */]);

    const uploadFileToResourceManager = async (uploadItem) => {
        const { fileId, file } = uploadItem;
        const formData = new FormData();
        formData.append('file', file); formData.append('name', file.name);

         setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'uploading', progress: 0 } : f));
        try {
            const response = await uploadResource(formData, (progressEvent) => {
                 if (progressEvent.total) {
                     const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                     setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, progress: percent } : f));
                 }
            });
             setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'processing', progress: 100, resourceId: response.id, error: null } : f));
             // Qui NON aggiungiamo a userResources, ma potremmo avviare un polling per sapere quando rifare fetchCsvResources
             // O semplicemente dire all'utente di aggiornare la lista dopo un po'.
             // Per semplicità, diciamo di aggiornare manualmente o aspettare il polling se implementato centralmente.
             setSuccess(`File "${file.name}" uploaded (ID: ${response.id}). Processing in background. Refresh list later.`);
             // Ricarica la lista dopo un po' o quando l'utente lo richiede
             setTimeout(() => fetchCsvResources(currentFilter), 10000); // Esempio: ricarica dopo 10s

        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
             setUploadFilesInfo(prev => prev.map(f => f.fileId === fileId ? { ...f, status: 'failed', progress: 0, error: errorMsg } : f));
             setError(`Upload failed for ${file.name}.`);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'text/csv': ['.csv']}, maxSize: 15 * 1024 * 1024, multiple: true });


    // --- Esecuzione Regressione ---
    const handleRunRegression = async () => {
        if (!selectedResourceId || !selectedFeatureCol || !selectedTargetCol) {
            setError('Select a resource and specify Feature (X) and Target (Y) columns.'); return;
        }
        setIsTraining(true); setError(''); setSuccess(''); setRegressionResult(null); setPredictionResult(null);
        try {
            const result = await runRegression({
                resource_id: parseInt(selectedResourceId, 10), // Assicura sia numero
                feature_column: selectedFeatureCol,
                target_column: selectedTargetCol,
            });
            setRegressionResult(result);
            setSuccess(result.message || 'Regression successful!');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to run regression.');
        } finally { setIsTraining(false); }
    };

    // --- Predizione ---
    const handlePredict = async () => {
         if (!regressionResult || predictValueInput === '' || isNaN(parseFloat(predictValueInput))) {
             setError('Run regression first and enter a valid numeric X value.'); return;
         }
         setIsPredicting(true); setError(''); setPredictionResult(null);
         try {
             const result = await predictValue({
                 slope: regressionResult.slope, intercept: regressionResult.intercept,
                 feature_value: parseFloat(predictValueInput),
             });
             setPredictionResult(result.predicted_value);
         } catch (err) { setError(err.response?.data?.error || 'Prediction failed.');
         } finally { setIsPredicting(false); }
     };

    // --- Salvataggio Copia Modificata ---
    const handleSaveCopy = async () => {
        if (!currentData || !selectedResourceId) {
             setError('No modified data to save or original resource not selected.'); return;
        }
        const originalResource = availableResources.find(r => r.id.toString() === selectedResourceId);
        if (!originalResource) { setError('Original resource not found.'); return; }

        setIsSavingCopy(true); setError(''); setSuccess('');
        try {
            // 1. Converti dati modificati (currentData) in stringa CSV
            const csvString = Papa.unparse(currentData, { header: true });
            // 2. Crea oggetto File
            const newFileName = `${originalResource.name || 'resource'}_modified.csv`;
            const csvFile = new File([csvString], newFileName, { type: "text/csv" });
            // 3. Crea FormData
            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('name', newFileName); // Suggerisci un nome
            formData.append('description', `Modified copy of resource ID ${selectedResourceId}. Original name: ${originalResource.original_filename}`);
            // 4. Chiama uploadResource del Resource Manager
            const response = await uploadResource(formData); // Non tracciamo progresso qui per semplicità
            setSuccess(`Modified copy uploaded as new resource (ID: ${response.id}). Processing...`);
            // Resetta i dati modificati? O permetti altre modifiche?
            // setCurrentData(null);
            // Aggiorna la lista delle risorse disponibili dopo un po'
            setTimeout(() => fetchCsvResources(currentFilter), 10000);
        } catch (err) {
             setError(err.response?.data?.error || 'Failed to save modified copy.');
        } finally { setIsSavingCopy(false); }
    };


    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Linear Regression</h1>

            {error && <Alert type="error" message={error} onClose={() => setError('')} />}
            {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Colonna Sinistra: Selezione/Upload e Parametri */}
                <div className="space-y-4">
                    {/* Selezione Risorsa Esistente */}
                    <div className="bg-white p-4 rounded shadow border">
                        <label htmlFor="resourceSelect" className="block text-sm font-medium text-gray-700 mb-1">Select Existing CSV Resource:</label>
                        {isLoadingResources ? <Spinner /> : resourceError ? <p className='text-xs text-red-500'>{resourceError}</p> : (
                            <select
                                id="resourceSelect"
                                value={selectedResourceId}
                                onChange={handleResourceSelect}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white disabled:bg-gray-100"
                                disabled={availableResources.length === 0}
                            >
                                <option value="">-- Select a resource --</option>
                                {availableResources.map(r => (
                                    <option key={r.id} value={r.id} disabled={r.status !== 'COMPLETED'}>
                                        {r.name || r.original_filename} (ID: {r.id}) {r.status !== 'COMPLETED' ? `[${r.status}]` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                         {availableResources.length === 0 && !isLoadingResources && !resourceError && <p className="text-xs text-gray-500 mt-1">No completed CSV resources found. Upload a new one below.</p>}
                    </div>

                     {/* Upload Nuovo File (tramite Resource Manager) */}
                    <div className="bg-white p-4 rounded shadow border">
                         <h3 className="text-sm font-medium text-gray-700 mb-2">Or Upload New CSV:</h3>
                         <div {...getRootProps()} className={`border-2 ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg p-5 text-center cursor-pointer transition-colors`}>
                            <input {...getInputProps()} />
                             <FaUpload className={`mx-auto h-8 w-8 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-2`} />
                             {isDragActive ? <p className="text-sm text-indigo-600">Drop CSV here...</p> : <p className="text-sm text-gray-600">Drag & drop or click</p>}
                             <p className="text-xs text-gray-500 mt-1">Max 15MB.</p>
                         </div>
                         {/* Lista Upload */}
                          {(uploadFilesInfo.length > 0) && ( <div className="mt-3 space-y-1"> {/* ... (come in ResourceManagerPage) ... */} </div> )}
                     </div>

                    {/* Selezione Colonne (se risorsa selezionata) */}
                    {selectedResourceId && selectedResourceHeaders.length > 0 && (
                         <div className="bg-white p-4 rounded shadow border space-y-3">
                              <h3 className="text-sm font-medium text-gray-700 mb-1">Select Columns for Regression:</h3>
                              <div>
                                 <label htmlFor="featureCol" className="block text-xs font-medium text-gray-600">Feature (X):</label>
                                 <select id="featureCol" value={selectedFeatureCol} onChange={(e) => setSelectedFeatureCol(e.target.value)} className="mt-1 block w-full p-2 text-sm border-gray-300 rounded-md shadow-sm bg-white">
                                     <option value="">-- Select --</option>
                                     {selectedResourceHeaders.map(h => <option key={`f-${h}`} value={h}>{h}</option>)}
                                 </select>
                             </div>
                              <div>
                                 <label htmlFor="targetCol" className="block text-xs font-medium text-gray-600">Target (Y):</label>
                                 <select id="targetCol" value={selectedTargetCol} onChange={(e) => setSelectedTargetCol(e.target.value)} className="mt-1 block w-full p-2 text-sm border-gray-300 rounded-md shadow-sm bg-white">
                                     <option value="">-- Select --</option>
                                     {selectedResourceHeaders.filter(h => h !== selectedFeatureCol).map(h => <option key={`t-${h}`} value={h}>{h}</option>)}
                                 </select>
                              </div>
                              <button onClick={handleRunRegression} disabled={!selectedFeatureCol || !selectedTargetCol || isTraining} className="w-full px-4 py-2 mt-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center">
                                {isTraining && <Spinner small />} Run Regression
                             </button>
                         </div>
                    )}
                </div>

                {/* Colonna Destra: Risultati e Dati */}
                <div className="space-y-4">
                     {/* Risultati Regressione */}
                     {regressionResult && (
                         <div className="bg-white p-4 rounded shadow border">
                            <h3 className="text-md font-semibold text-gray-700 mb-2 border-b pb-1">Regression Results</h3>
                             <div className="grid grid-cols-2 gap-2 text-sm">
                                <span>Slope (Coefficient):</span> <span className="font-mono text-right">{regressionResult.slope?.toFixed(5)}</span>
                                <span>Intercept:</span> <span className="font-mono text-right">{regressionResult.intercept?.toFixed(5)}</span>
                                <span>R-squared:</span> <span className="font-mono text-right">{regressionResult.r_squared?.toFixed(5)}</span>
                                <span>Data Points Used:</span> <span className="font-mono text-right">{regressionResult.data_points_used}</span>
                             </div>
                             {/* Area Predizione */}
                            <div className="border-t mt-4 pt-3 space-y-2">
                                 <label htmlFor="predictValue" className="block text-sm font-medium text-gray-700">Predict {selectedTargetCol || 'Y'} for {selectedFeatureCol || 'X'} =</label>
                                 <div className="flex items-center gap-2">
                                    <input type="number" step="any" id="predictValue" value={predictValueInput} onChange={(e) => setPredictValueInput(e.target.value)} placeholder="Enter X value" className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm"/>
                                    <button onClick={handlePredict} disabled={isPredicting || predictValueInput === ''} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center">
                                         {isPredicting && <Spinner small />} Predict
                                     </button>
                                 </div>
                                 {predictionResult !== null && (
                                     <p className="text-md font-semibold text-indigo-700 mt-2">Predicted Value: <span className="font-mono">{predictionResult.toFixed(5)}</span></p>
                                 )}
                            </div>
                         </div>
                     )}

                     {/* Area Dati e Modifica */}
                     {selectedResourceId && (
                         <div className="bg-white p-4 rounded shadow border">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="text-md font-semibold text-gray-700">Resource Data</h3>
                                <button onClick={loadDataForEditing} disabled={isLoadingResources} className="text-sm text-indigo-600 hover:underline disabled:opacity-50 flex items-center">
                                     {isLoadingResources && currentData === null && <Spinner small />} {currentData ? 'Reload' : 'Load'} Data for View/Edit
                                 </button>
                             </div>
                             {isLoadingResources && currentData === null && <p className='text-sm text-center py-4 text-gray-500'>Loading data...</p>}
                             {currentData ? (
                                 <>
                                     <EditableTable headers={selectedResourceHeaders} data={currentData} onDataChange={setCurrentData} />
                                      <button onClick={handleSaveCopy} disabled={isSavingCopy} className="w-full px-4 py-2 mt-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center">
                                         {isSavingCopy && <Spinner small />} Save Modified Data as New Resource
                                     </button>
                                 </>
                             ) : (
                                 <p className="text-sm text-gray-500 italic text-center py-4">{!isLoadingResources && "Click 'Load Data' to view or edit."}</p>
                             )}
                         </div>
                     )}

                     {/* Placeholder se nessuna risorsa selezionata */}
                      {!selectedResourceId && !isLoadingResources && availableResources.length > 0 && (
                         <div className="bg-white p-4 rounded shadow border text-center text-gray-500 italic">
                             Select a resource from the list to view its headers and run regression.
                         </div>
                      )}

                </div>
            </div>
        </div>
    );
};

export default RegressionPage;