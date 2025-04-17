import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse'; // Per parsare CSV lato frontend
import {
    listExampleDatasets,
    listUserDatasets,
    uploadAndSaveDataset,
    deleteDataset,
    trainTemporaryModel,
    predictValue,
    getDatasetRawData, // Importa se vuoi caricare dati da file salvati
    trainSavedModel   // Importa se usi l'endpoint per addestrare su salvati
} from '../services/regressionService';
import { useAuth } from '../context/AuthContext'; // Per l'ID utente, se necessario

// --- Componenti UI Semplici (Sostituisci/Migliora se usi librerie UI) ---
const Spinner = () => (
    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
);

const Alert = ({ type = 'error', message }) => {
    const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
    if (!message) return null;
    return (
        <div className={`border px-4 py-3 rounded relative mb-4 ${bgColor}`} role="alert">
            <span className="block sm:inline">{message}</span>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-medium text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
                <div className="mt-4">
                    {children}
                </div>
            </div>
        </div>
    );
};
// --- Fine Componenti UI ---

const RegressionPage = () => {
    const { user } = useAuth(); // Ottieni info utente se necessario

    // Stati UI
    const [isLoadingExamples, setIsLoadingExamples] = useState(false);
    const [isLoadingUserDatasets, setIsLoadingUserDatasets] = useState(false);
    const [isLoadingUpload, setIsLoadingUpload] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false); // Per caricare dati da dataset salvato
    const [isTraining, setIsTraining] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); // Contiene l'ID del dataset in cancellazione
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showTutorialModal, setShowTutorialModal] = useState(true); // Mostra all'inizio

    // Stati Dati
    const [exampleDatasets, setExampleDatasets] = useState([]);
    const [userDatasets, setUserDatasets] = useState([]);
    const [currentDataset, setCurrentDataset] = useState({
        id: null, // ID se salvato, null se temporaneo/caricato
        name: '',
        description: '',
        data: null, // Array di oggetti [{header1: val1, header2: val2}, ...]
        headers: null, // Array di stringhe ['header1', 'header2', ...]
        isExample: false,
        file: null, // Oggetto File originale se caricato
        source: null, // 'upload', 'example', 'user'
    });
    const [selectedFeatureCol, setSelectedFeatureCol] = useState('');
    const [selectedTargetCol, setSelectedTargetCol] = useState('');
    const [regressionResult, setRegressionResult] = useState(null); // { slope, intercept, r_squared, ... }
    const [predictValueInput, setPredictValueInput] = useState('');
    const [predictionResult, setPredictionResult] = useState(null);

    const fileInputRef = useRef(null); // Riferimento all'input file

    // Funzione helper per resettare lo stato principale
    const resetState = () => {
        setCurrentDataset({ id: null, name: '', description: '', data: null, headers: null, isExample: false, file: null, source: null });
        setSelectedFeatureCol('');
        setSelectedTargetCol('');
        setRegressionResult(null);
        setPredictValueInput('');
        setPredictionResult(null);
        setError('');
        setSuccess('');
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Resetta l'input file
        }
    };

    // Caricamento Liste Dataset al Montaggio
    const fetchInitialDatasets = useCallback(async () => {
        setIsLoadingExamples(true);
        setIsLoadingUserDatasets(true);
        setError('');
        try {
            const [examples, userData] = await Promise.all([
                listExampleDatasets(),
                listUserDatasets()
            ]);
            setExampleDatasets(examples);
            setUserDatasets(userData);
        } catch (err) {
            setError('Failed to load initial datasets. Please try again later.');
            console.error(err);
        } finally {
            setIsLoadingExamples(false);
            setIsLoadingUserDatasets(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialDatasets();
    }, [fetchInitialDatasets]);

    // Gestione Selezione Dataset (Esempio o Utente)
    const handleSelectDataset = async (dataset, source = 'example') => {
        resetState(); // Resetta stato precedente
        setIsLoadingData(true); // Mostra caricamento per i dati
        setError('');
        setSuccess('');
        setCurrentDataset(prev => ({ ...prev, id: dataset.id, name: dataset.name, description: dataset.description, isExample: dataset.is_example, source: source }));
        try {
            // Carica i dati grezzi specifici per questo dataset
            const rawData = await getDatasetRawData(dataset.id);
            // Parsa se necessario (ma getDatasetRawData dovrebbe restituire JSON)
            if (Array.isArray(rawData) && rawData.length > 0) {
                 setCurrentDataset(prev => ({
                    ...prev,
                    data: rawData,
                    headers: Object.keys(rawData[0]), // Estrai header dal primo oggetto
                }));
            } else {
                setCurrentDataset(prev => ({ ...prev, data: [], headers: [] })); // Dati vuoti se la risposta è vuota/invalida
                console.warn("Raw data received is empty or not an array:", rawData);
            }

        } catch (err) {
            setError(`Failed to load data for dataset "${dataset.name}".`);
            setCurrentDataset(prev => ({ ...prev, data: null, headers: null })); // Resetta dati su errore
            console.error(err);
        } finally {
            setIsLoadingData(false);
        }
    };

    // Gestione Caricamento File
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            resetState();
            setError('');
            setSuccess('');
            setCurrentDataset(prev => ({ ...prev, name: file.name, file: file, source: 'upload' })); // Salva l'oggetto File

            Papa.parse(file, {
                header: true, // Usa la prima riga come header
                skipEmptyLines: true,
                dynamicTyping: true, // Prova a convertire tipi automaticamente
                complete: (results) => {
                    if (results.errors.length > 0) {
                        setError(`Error parsing CSV: ${results.errors[0].message}`);
                        setCurrentDataset(prev => ({ ...prev, data: null, headers: null, file: null }));
                    } else if (results.data.length > 0) {
                         setCurrentDataset(prev => ({
                            ...prev,
                            data: results.data,
                            headers: results.meta.fields || Object.keys(results.data[0]) // Prendi header dai meta o dal primo oggetto
                        }));
                        setSuccess(`CSV "${file.name}" loaded successfully.`);
                    } else {
                         setError("CSV file seems empty or has no data rows.");
                          setCurrentDataset(prev => ({ ...prev, data: null, headers: null, file: null }));
                    }
                },
                error: (err) => {
                    setError(`Failed to parse CSV: ${err.message}`);
                    setCurrentDataset(prev => ({ ...prev, data: null, headers: null, file: null }));
                }
            });
        } else if (file) {
            setError('Invalid file type. Please upload a .csv file.');
            event.target.value = ''; // Resetta l'input
        }
    };

    // Gestione Salvataggio Dataset Caricato
    const handleSaveDataset = async () => {
        if (!currentDataset.file || !currentDataset.name) {
            setError('Cannot save: No file uploaded or name is missing.');
            return;
        }
        setIsLoadingUpload(true);
        setError('');
        setSuccess('');
        const formData = new FormData();
        formData.append('name', currentDataset.name);
        if (currentDataset.description) {
            formData.append('description', currentDataset.description);
        }
        formData.append('csv_file', currentDataset.file);

        try {
            const savedDataset = await uploadAndSaveDataset(formData);
            setSuccess(`Dataset "${savedDataset.name}" saved successfully!`);
            // Aggiorna lo stato corrente con l'ID salvato e resetta il file
            setCurrentDataset(prev => ({ ...prev, id: savedDataset.id, file: null, source: 'user' }));
            // Ricarica la lista dei dataset utente
            fetchInitialDatasets();
        } catch (err) {
            setError('Failed to save dataset. Please try again.');
            console.error(err);
        } finally {
            setIsLoadingUpload(false);
        }
    };

     // Gestione Eliminazione Dataset
    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
            return;
        }
        setIsDeleting(id); // Imposta ID per feedback visivo
        setError('');
        setSuccess('');
        try {
            await deleteDataset(id);
            setSuccess(`Dataset deleted successfully.`);
            // Rimuovi il dataset dalla lista UI e resetta se era selezionato
            setUserDatasets(prev => prev.filter(ds => ds.id !== id));
            if (currentDataset.id === id) {
                resetState();
            }
        } catch (err) {
            setError('Failed to delete dataset.');
            console.error(err);
        } finally {
            setIsDeleting(null);
        }
    };


    // Gestione Esecuzione Regressione
    const handleRunRegression = async () => {
        if (!currentDataset.data || !selectedFeatureCol || !selectedTargetCol) {
            setError('Please select a dataset and specify both Feature (X) and Target (Y) columns.');
            return;
        }
        setIsTraining(true);
        setError('');
        setSuccess('');
        setRegressionResult(null); // Resetta risultato precedente
        setPredictionResult(null);

        try {
            let result;
            if (currentDataset.source === 'upload' && currentDataset.file) {
                // Usa l'endpoint temporaneo per file non salvati
                const formData = new FormData();
                formData.append('feature_column', selectedFeatureCol);
                formData.append('target_column', selectedTargetCol);
                formData.append('csv_file', currentDataset.file);
                result = await trainTemporaryModel(formData);
                setSuccess('Regression performed on uploaded data.');
            } else if (currentDataset.id) {
                 // Usa l'endpoint per dataset salvati
                result = await trainSavedModel(currentDataset.id, {
                    feature_column: selectedFeatureCol,
                    target_column: selectedTargetCol,
                });
                 setSuccess('Regression performed on saved dataset.');
            } else {
                 throw new Error("Cannot run regression: Invalid dataset state.");
            }
            setRegressionResult(result);

        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to run regression.';
            setError(errorMsg);
            console.error(err);
        } finally {
            setIsTraining(false);
        }
    };

    // Gestione Predizione
    const handlePredict = async () => {
        if (!regressionResult || predictValueInput === '' || isNaN(parseFloat(predictValueInput))) {
            setError('Please run regression first and enter a valid numeric value to predict.');
            return;
        }
        setIsPredicting(true);
        setError('');
        setPredictionResult(null); // Resetta risultato precedente
        try {
            const data = {
                slope: regressionResult.slope,
                intercept: regressionResult.intercept,
                feature_value: parseFloat(predictValueInput),
            };
            const result = await predictValue(data);
            setPredictionResult(result.predicted_value);
        } catch (err) {
            setError('Failed to get prediction.');
            console.error(err);
        } finally {
            setIsPredicting(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            {/* --- Modale Tutorial --- */}
            <Modal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} title="Regression Tool Tutorial">
                <p className="text-gray-600 mb-4">Welcome! You can start your regression analysis in three ways:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li><b>Use Example Datasets:</b> Choose from preloaded datasets to quickly see how regression works.</li>
                    <li><b>Upload New Dataset:</b> Upload your own .csv file. You can run regression on it immediately or save it for later use.</li>
                    <li><b>Use My Saved Datasets:</b> Select a dataset you previously uploaded and saved.</li>
                </ul>
                <p className="mt-4 text-sm text-gray-500">Select columns for Feature (X) and Target (Y) from your loaded data, run the regression, and make predictions!</p>
                 <button onClick={() => setShowTutorialModal(false)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Got it!</button>
            </Modal>

             {/* --- Titolo e Bottone Tutorial --- */}
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Linear Regression Analysis</h1>
                 <button onClick={() => setShowTutorialModal(true)} title="Show Tutorial" className="text-indigo-600 hover:text-indigo-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                 </button>
             </div>


            {/* --- Area Scelta Iniziale --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Bottone Esempi */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="font-semibold mb-2 text-lg">1. Use Example Data</h2>
                    {isLoadingExamples ? <Spinner /> : (
                         <ul className="space-y-1 max-h-40 overflow-y-auto">
                         {exampleDatasets.length > 0 ? exampleDatasets.map(ds => (
                                <li key={ds.id}>
                                    <button onClick={() => handleSelectDataset(ds, 'example')} className="text-indigo-600 hover:underline text-sm w-full text-left">
                                        {ds.name}
                                    </button>
                                </li>
                            )) : <p className="text-sm text-gray-500">No examples found.</p>}
                         </ul>
                    )}
                </div>

                {/* Bottone Upload */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="font-semibold mb-2 text-lg">2. Upload New Dataset</h2>
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                     />
                     <p className="text-xs text-gray-500 mt-1">Upload a .csv file from your computer.</p>
                </div>

                {/* Bottone Miei Dataset */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="font-semibold mb-2 text-lg">3. Use My Saved Datasets</h2>
                     {isLoadingUserDatasets ? <Spinner /> : (
                         <ul className="space-y-1 max-h-40 overflow-y-auto">
                            {userDatasets.length > 0 ? userDatasets.map(ds => (
                                <li key={ds.id} className="flex justify-between items-center group">
                                    <button onClick={() => handleSelectDataset(ds, 'user')} className="text-indigo-600 hover:underline text-sm text-left flex-grow truncate pr-2">
                                        {ds.name}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ds.id)}
                                        title="Delete Dataset"
                                        disabled={isDeleting === ds.id}
                                        className={`text-red-400 hover:text-red-600 text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDeleting === ds.id ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                         {isDeleting === ds.id ? <Spinner /> : '🗑️'}
                                    </button>
                                </li>
                            )) : <p className="text-sm text-gray-500">No saved datasets found.</p>}
                         </ul>
                    )}
                </div>
            </div>

             {/* --- Area Messaggi Globali --- */}
             {error && <Alert type="error" message={error} />}
             {success && <Alert type="success" message={success} />}

            {/* --- Area Visualizzazione / Interazione --- */}
            {currentDataset.source && (
                <div className="bg-white p-6 rounded shadow mt-8 space-y-6">
                    {/* Info Dataset e Bottone Salva */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                         <div>
                             <h2 className="text-xl font-semibold text-gray-800">{currentDataset.name || 'Untitled Dataset'}</h2>
                             {currentDataset.description && <p className="text-sm text-gray-600 mt-1">{currentDataset.description}</p>}
                             <span className={`text-xs font-medium px-2 py-0.5 rounded ${currentDataset.isExample ? 'bg-green-100 text-green-800' : currentDataset.id ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {currentDataset.isExample ? 'Example' : currentDataset.id ? 'Saved' : 'Uploaded (Unsaved)'}
                            </span>
                         </div>
                        {/* Mostra bottone Salva solo se è stato caricato e non ancora salvato */}
                        {currentDataset.source === 'upload' && !currentDataset.id && (
                             <button
                                onClick={handleSaveDataset}
                                disabled={isLoadingUpload}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center whitespace-nowrap"
                            >
                                {isLoadingUpload && <Spinner />}
                                Save this Dataset
                            </button>
                        )}
                    </div>

                    {/* Selettori Colonne */}
                    {currentDataset.headers && currentDataset.headers.length > 0 && (
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                             <div>
                                <label htmlFor="featureCol" className="block text-sm font-medium text-gray-700 mb-1">Feature (X) Column:</label>
                                <select
                                    id="featureCol"
                                    value={selectedFeatureCol}
                                    onChange={(e) => setSelectedFeatureCol(e.target.value)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                >
                                    <option value="">-- Select X --</option>
                                    {currentDataset.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="targetCol" className="block text-sm font-medium text-gray-700 mb-1">Target (Y) Column:</label>
                                <select
                                    id="targetCol"
                                    value={selectedTargetCol}
                                    onChange={(e) => setSelectedTargetCol(e.target.value)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                >
                                    <option value="">-- Select Y --</option>
                                    {/* Filtra via la colonna X già selezionata */}
                                    {currentDataset.headers.filter(h => h !== selectedFeatureCol).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                             </div>
                             <button
                                onClick={handleRunRegression}
                                disabled={!selectedFeatureCol || !selectedTargetCol || isTraining || isLoadingData}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                            >
                                {isTraining ? <Spinner /> : null}
                                Run Regression
                            </button>
                         </div>
                    )}

                    {/* Tabella Dati */}
                    {isLoadingData && <div className="text-center py-4"><Spinner /> Loading data...</div>}
                    {currentDataset.data && currentDataset.data.length > 0 && !isLoadingData && (
                        <div className="overflow-x-auto max-h-96 border rounded">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        {currentDataset.headers?.map(header => (
                                            <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {currentDataset.data.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-gray-50">
                                            {currentDataset.headers?.map(header => (
                                                <td key={`${rowIndex}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {/* Formatta numeri se possibile, altrimenti mostra come stringa */}
                                                    {typeof row[header] === 'number' ? row[header].toLocaleString() : row[header]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                     {currentDataset.data && currentDataset.data.length === 0 && !isLoadingData && (
                         <p className="text-center text-gray-500 py-4">No data rows found in the dataset.</p>
                     )}

                    {/* Area Risultati Regressione e Predizione */}
                    {regressionResult && (
                        <div className="border-t pt-6 space-y-4">
                             <h3 className="text-lg font-semibold text-gray-700">Regression Results:</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                <p><strong>Slope (Coefficient):</strong> {regressionResult.slope?.toFixed(4)}</p>
                                <p><strong>Intercept:</strong> {regressionResult.intercept?.toFixed(4)}</p>
                                <p><strong>R-squared:</strong> {regressionResult.r_squared?.toFixed(4)}</p>
                             </div>

                             <div className="flex flex-col sm:flex-row items-end gap-4">
                                 <div className="flex-grow">
                                    <label htmlFor="predictValue" className="block text-sm font-medium text-gray-700 mb-1">Enter {selectedFeatureCol || 'X'} value for prediction:</label>
                                    <input
                                        type="number"
                                        id="predictValue"
                                        step="any" // Permetti decimali
                                        value={predictValueInput}
                                        onChange={(e) => setPredictValueInput(e.target.value)}
                                        placeholder={`Value for ${selectedFeatureCol || 'Feature'}`}
                                        className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    />
                                 </div>
                                 <button
                                    onClick={handlePredict}
                                    disabled={isPredicting || predictValueInput === ''}
                                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center whitespace-nowrap"
                                >
                                     {isPredicting ? <Spinner /> : null}
                                     Predict {selectedTargetCol || 'Y'}
                                 </button>
                             </div>

                             {predictionResult !== null && !isPredicting && (
                                 <p className="text-md font-semibold text-indigo-700">
                                     Predicted {selectedTargetCol || 'Y'} Value: {predictionResult.toFixed(4)}
                                 </p>
                             )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RegressionPage;