// src/pages/DataAnalysisPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaSpinner, FaTimes, FaBrain, FaChartBar, FaTable, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaRedo, FaSearch } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources, uploadResource as uploadResourceViaRM } from '../services/resourceManagerService';
import { suggestAlgorithm, runAnalysis, getAnalysisResults, predictClassificationInstance } from '../services/dataAnalysisService';
import Plot from 'react-plotly.js';

// Importa ResourceCard (se lo usi per selezionare risorse)
// import ResourceCard from '../components/ResourceCard';
// Se ResourceCard non è usato, commenta/rimuovi e adatta la UI per selezionare da un <select>

import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal'; // Assicurati esista

// --- Componenti UI Base (Definiti qui per completezza) ---
const Spinner = ({ small = false, color = 'indigo-500' }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-${color} ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm text-sm';
    let typeStyle = '', icon = null;
    switch (type) {
        case 'success': typeStyle = 'bg-green-100 border-green-300 text-green-700'; icon = <FaCheckCircle className="inline mr-2 text-green-600"/>; break;
        case 'warning': typeStyle = 'bg-yellow-100 border-yellow-300 text-yellow-700'; icon = <FaExclamationTriangle className="inline mr-2 text-yellow-600"/>; break;
        case 'info': typeStyle = 'bg-blue-100 border-blue-300 text-blue-700'; icon = <FaInfoCircle className="inline mr-2 text-blue-600"/>; break;
        case 'error': default: typeStyle = 'bg-red-100 border-red-300 text-red-700'; icon = <FaExclamationTriangle className="inline mr-2 text-red-600"/>; break;
    }
    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            {icon}
            <span className="block sm:inline align-middle mr-6">{message}</span>
            {onClose && (
                 <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-3 py-3 focus:outline-none" aria-label="Close">
                     <FaTimes className={`h-4 w-4 ${type==='error' ? 'text-red-500' : type==='success' ? 'text-green-500' : type==='warning' ? 'text-yellow-500' : 'text-blue-500'}`}/>
                 </button>
            )}
        </div>
    );
};

const AlertModalShell = ({ isOpen, onClose, title = "Alert", children }) => {
     if (!isOpen) return null;
     return ( <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"> <div className="relative mx-auto p-6 border-0 w-full max-w-md shadow-xl rounded-lg bg-white"> <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4"> <h3 className="text-lg font-medium text-gray-900">{title}</h3> <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal"> <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg> </button> </div> <div className="mt-2 text-sm text-gray-600">{children}</div> <div className="mt-4 pt-3 border-t border-gray-200 text-right"> <button onClick={onClose} type="button" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> OK </button> </div> </div> </div> );
};

const SimpleTable = ({ headers, rows, maxRows = 5 }) => {
    if (!headers || headers.length === 0 || !rows || rows.length === 0) {
        return <p className="text-xs text-gray-500 italic text-center py-3">No data to display in preview.</p>;
    }
    const displayedRows = rows.slice(0, maxRows);
    return (
        <div className="overflow-x-auto max-h-60 border rounded bg-white text-xs shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10"><tr>{headers.map(h => (<th key={h} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>))}</tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">{displayedRows.map((row, rIdx) => (<tr key={rIdx} className="hover:bg-gray-50">{headers.map(h => (<td key={`${rIdx}-${h}`} className="px-3 py-2 whitespace-nowrap text-gray-700 truncate max-w-[150px]" title={String(row[h])}>{String(row[h] ?? '')}</td>))}</tr>))}</tbody>
            </table>
            {rows.length > maxRows && <p className="text-center text-xs text-gray-400 p-1 bg-gray-50 border-t">...and {rows.length - maxRows} more rows.</p>}
        </div>
    );
};
// --- Fine UI ---

const DataAnalysisPage = () => {
    const { isAuthenticated } = useAuth();

    // FASE 1: Selezione/Upload Dati
    const [availableCsvResources, setAvailableCsvResources] = useState([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    // FASE 2: Suggerimenti e Configurazione
    const [analysisSessionId, setAnalysisSessionId] = useState(null);
    const [datasetPreview, setDatasetPreview] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [taskTypePreference, setTaskTypePreference] = useState('');

    // FASE 3: Esecuzione e Risultati
    const [analysisJobId, setAnalysisJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState('');
    const [jobResults, setJobResults] = useState(null);
    const [plotData, setPlotData] = useState(null);
    const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
    const [isPollingResults, setIsPollingResults] = useState(false);

    // Predizione Interattiva
    const [regressionPredictFeatureValue, setRegressionPredictFeatureValue] = useState('');
    const [regressionPredictionResult, setRegressionPredictionResult] = useState(null);
    const [classificationInputValues, setClassificationInputValues] = useState({});
    const [classificationPredictionResult, setClassificationPredictionResult] = useState(null);
    const [isPredicting, setIsPredicting] = useState(false);

    // UI State
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [warning, setWarning] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [showTutorialModal, setShowTutorialModal] = useState(false); // Inizia nascosto o true per default
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({ title: '', message: '' });

    const pollingIntervalRef = useRef(null);

    // Helper URL (se ResourceCard lo usa per thumbnail)
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


    // Fetch Risorse CSV Filtrate
    const fetchCsvResources = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true); setError('');
        try {
            const resources = await listUserResources({ status: 'COMPLETED' });
            const filteredForAnalysis = (Array.isArray(resources) ? resources : []).filter(r =>
                (r.mime_type === 'text/csv' || r.original_filename?.toLowerCase().endsWith('.csv')) &&
                Array.isArray(r.metadata?.potential_uses) &&
                (r.metadata.potential_uses.includes('regression') || r.metadata.potential_uses.includes('clustering') || r.metadata.potential_uses.includes('classification'))
            );
            setAvailableCsvResources(filteredForAnalysis);
        } catch (err) { setError('Failed to load CSV resources.'); console.error(err); }
        finally { setIsLoadingResources(false); }
    }, [isAuthenticated]);

    useEffect(() => { fetchCsvResources(); }, [fetchCsvResources]);

    // Gestione Upload
    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setError(''); setSuccess(''); setWarning('');
        if (fileRejections.length > 0) {
            const messages = fileRejections.map(fr => `${fr.file.name}: ${fr.errors.map(e => e.message).join(', ')}`);
            setError(`File upload error(s):\n- ${messages.join('\n- ')}`);
            return;
        }
        if (acceptedFiles.length > 0) {
            setUploadedFile(acceptedFiles[0]);
            setSelectedResource(null); // Deseleziona risorsa esistente
            setCurrentStep(1);
            resetAnalysisState(false); // Non resettare file caricato
            setSuccess(`File "${acceptedFiles[0].name}" ready for analysis. Click "Analyze & Get AI Suggestions".`);
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'text/csv': ['.csv'] },
        maxSize: 20 * 1024 * 1024, // 20MB
        multiple: false
    });

    // Reset per nuova analisi o cambio dataset
    const resetAnalysisState = (resetFileAndResourceSelection = true) => {
        setAnalysisSessionId(null); setDatasetPreview(null); setAiSuggestions([]);
        setSelectedAlgorithm(null); setSelectedFeatures([]); setSelectedTarget('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        setRegressionPredictFeatureValue(''); setRegressionPredictionResult(null);
        setClassificationInputValues({}); setClassificationPredictionResult(null);
        // Non resettare error/success/warning qui per non cancellare feedback importanti subito

        if (resetFileAndResourceSelection) {
            setSelectedResource(null);
            setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Resetta input file nativo
        }
    };

    // FASE 1: Ottieni Suggerimenti
    const handleSuggestAlgorithm = async () => {
        if (!selectedResource && !uploadedFile) { setError('Please select an existing CSV or upload a new one.'); return; }
        setIsSuggesting(true); setError(''); setSuccess(''); setWarning('');
        resetAnalysisState(false); // Resetta stati analisi precedenti ma mantieni file/risorsa
        try {
            let payload;
            if (uploadedFile) {
                payload = new FormData();
                payload.append('file', uploadedFile);
            } else if (selectedResource) {
                payload = { resource_id: selectedResource.id }; // Assumiamo ID intero come da modifiche precedenti
            } else { throw new Error("No data source selected for suggestions."); }

            if (taskTypePreference) {
                 if (payload instanceof FormData) payload.append('task_type_preference', taskTypePreference);
                 else payload.task_type_preference = taskTypePreference;
            }

            const response = await suggestAlgorithm(payload);
            setAnalysisSessionId(response.analysis_session_id);
            setDatasetPreview(response.dataset_preview);
            setAiSuggestions(response.suggestions || []);
            setSuccess('Algorithm suggestions received! Configure your analysis below.');
            setCurrentStep(2);
            if (response.suggestions && response.suggestions.length > 0) {
                const firstSugg = response.suggestions[0];
                handleAlgorithmSelect(firstSugg.algorithm_key); // Chiama handler per impostare tutto
            }
        } catch (err) { setError(err.response?.data?.error || 'Failed to get algorithm suggestions.');
        } finally { setIsSuggesting(false); }
    };

    // Gestione Selezione Algoritmo da dropdown AI
    const handleAlgorithmSelect = (algorithmKey) => {
        const suggestion = aiSuggestions.find(s => s.algorithm_key === algorithmKey);
        setSelectedAlgorithm(suggestion);

        if (suggestion && datasetPreview?.headers) {
            if (suggestion.task_type === 'classification') {
                const headers = datasetPreview.headers;
                if (headers.length > 1) {
                    setSelectedFeatures(headers.slice(0, -1));
                    setSelectedTarget(headers[headers.length - 1]);
                } else { setSelectedFeatures([]); setSelectedTarget(headers[0] || ''); }
            } else { // Regressione
                setSelectedFeatures(suggestion.suggested_features?.slice(0, 1) || []); // Inizia con una feature per regressione
                setSelectedTarget(suggestion.suggested_target || '');
            }
        } else { // Se nessun suggerimento o deselezionato
            setSelectedFeatures([]); setSelectedTarget('');
        }
    };

    // FASE 2: Esegui Analisi
    const handleRunAnalysis = async () => {
        if (!analysisSessionId || !selectedAlgorithm) { setError('Session or Algorithm not selected.'); return; }

        let featuresToRun = selectedFeatures;
        let targetToRun = selectedTarget;

        if (selectedAlgorithm.task_type === 'classification' && datasetPreview?.headers) {
            const headers = datasetPreview.headers;
            if (headers.length > 1) {
                featuresToRun = headers.slice(0, -1); targetToRun = headers[headers.length - 1];
                // Non serve fare setSelectedFeatures/Target qui se l'UI non li mostra per classificazione
            } else { setError("Not enough columns for auto-classification setup."); return; }
        }

        if (featuresToRun.length === 0 || !targetToRun) { setError('Features and Target must be defined.'); return; }

        setIsRunningAnalysis(true); setError(''); setSuccess('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        try {
            const payload = {
                analysis_session_id: analysisSessionId,
                selected_algorithm_key: selectedAlgorithm.algorithm_key,
                selected_features: featuresToRun, selected_target: targetToRun,
                task_type: selectedAlgorithm.task_type,
            };
            const response = await runAnalysis(payload);
            setAnalysisJobId(response.analysis_job_id); setJobStatus(response.status);
            setSuccess('Analysis task submitted! Monitoring...'); setCurrentStep(3);
            startJobPolling(response.analysis_job_id);
        } catch (err) { setError(err.response?.data?.error || 'Failed to start analysis job.');
        } finally { setIsRunningAnalysis(false); }
    };

    // Polling per Risultati Job
    const stopJobPolling = useCallback(() => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }, []);
    const startJobPolling = useCallback((jobId) => {
        stopJobPolling(); setIsPollingResults(true);
        pollingIntervalRef.current = setInterval(async () => {
            if (!jobId) { stopJobPolling(); setIsPollingResults(false); return; }
            try {
                const data = await getAnalysisResults(jobId);
                setJobStatus(data.status);
                if (data.status === 'COMPLETED') {
                    stopJobPolling(); setIsPollingResults(false);
                    setJobResults(data); // Salva tutto l'oggetto job
                    setPlotData(data.plot_data);
                    setSuccess('Analysis completed successfully!');
                } else if (data.status === 'FAILED') {
                    stopJobPolling(); setIsPollingResults(false);
                    setError(`Analysis failed: ${data.error_message || 'Unknown error'}`);
                }
            } catch (err) {
                console.error(`Polling error for job ${jobId}:`, err);
                if (err.response?.status === 404) { setError("Analysis job not found."); stopJobPolling(); setIsPollingResults(false); }
            }
        }, 3000);
    }, [stopJobPolling]);

    useEffect(() => { return () => stopJobPolling(); }, [stopJobPolling]);

    // Gestione Selezione Risorsa dalla Card
    const handleResourceCardSelect = (resource) => {
        if (currentStep !== 1 && resource.id === selectedResource?.id && !uploadedFile) return;
        setError(''); setSuccess(''); resetAnalysisState(false);
        setSelectedResource(resource);
        setUploadedFile(null);
        setCurrentStep(1);
        setSuccess(`Resource "${resource.name || resource.original_filename}" selected. Click "Analyze & Get AI Suggestions" to proceed.`);
    };

    // Gestione selezione multipla features
    const handleFeatureChange = (e) => { const values = Array.from(e.target.selectedOptions, option => option.value); setSelectedFeatures(values); };
    const handleClassificationInputChange = (featureName, value) => { setClassificationInputValues(prev => ({ ...prev, [featureName]: value })); };

    // Predizione Interattiva Regressione
    const handleRegressionPredict = () => {
        if (!jobResults || jobResults.task_type !== 'regression' || regressionPredictFeatureValue === '') { setError("Regression results unavailable or input missing."); return; }
        setError('');
        const slope = jobResults.results?.slope; const intercept = jobResults.results?.intercept;
        if (typeof slope !== 'number' || typeof intercept !== 'number') { setError("Model parameters (slope/intercept) are missing."); return; }
        const prediction = slope * parseFloat(regressionPredictFeatureValue) + intercept;
        setRegressionPredictionResult(prediction);
    };

    // Predizione Interattiva Classificazione
    const handleClassificationPredict = async () => {
        if (!analysisJobId || !jobResults || jobResults.task_type !== 'classification') { setError("Classification model/job not ready."); return; }
        const featuresForPrediction = jobResults.input_parameters?.selected_features || [];
        if (featuresForPrediction.some(feat => classificationInputValues[feat] === undefined || String(classificationInputValues[feat]).trim() === '')) { setError("Provide values for all features."); return; }
        setIsPredicting(true); setError(''); setClassificationPredictionResult(null);
        try {
            const featuresPayload = {};
            for (const feat of featuresForPrediction) {
                 const val = classificationInputValues[feat];
                 featuresPayload[feat] = isNaN(Number(val)) || val === '' ? val : Number(val);
            }
            const result = await predictClassificationInstance(analysisJobId, featuresPayload);
            setClassificationPredictionResult(result);
        } catch (err) { setError(err.response?.data?.error || 'Prediction failed.');
        } finally { setIsPredicting(false); }
    };

    // Preparazione Dati e Opzioni per Grafico Plotly (Regressione)
    const chartDataAndOptions = useMemo(() => {
        if (!jobResults || jobResults.task_type !== 'regression' || !plotData || !plotData.data?.actual_vs_predicted) return null;
        const traces = [
            { type: 'scatter', mode: 'markers', x: plotData.data.actual_vs_predicted.map(p=>p.actual), y: plotData.data.actual_vs_predicted.map(p=>p.predicted), name: 'Actual vs. Predicted', marker: {size: 6, color: 'rgba(30,100,200,0.7)'} },
            { type: 'scatter', mode: 'lines', x: plotData.data.ideal_line.map(p=>p.x), y: plotData.data.ideal_line.map(p=>p.y), name: 'Ideal (y=x)', line: {dash: 'dash', color: 'rgba(200,50,50,0.8)', width:2} }
        ];
        if (regressionPredictionResult !== null && regressionPredictFeatureValue !== '' && jobResults.input_parameters?.selected_features?.length === 1) {
            const original_X_value_for_prediction = parseFloat(regressionPredictFeatureValue);
            traces.push({ type: 'scatter', mode: 'markers', x: [original_X_value_for_prediction], y: [regressionPredictionResult], name: 'Your Prediction', marker: { color: 'orange', size: 12, symbol: 'star' } });
        }
        const layout = { title: plotData.layout.title || "Regression Plot", xaxis: { title: plotData.layout.xaxis_title }, yaxis: { title: plotData.layout.yaxis_title }, autosize: true, margin: { l: 50, r: 20, b: 50, t: 50, pad: 4 } };
        return { data: traces, layout };
    }, [jobResults, plotData, regressionPredictFeatureValue, regressionPredictionResult]);


    // --- Rendering ---
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            {/* Header Pagina */}
            <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-800">Data Analysis Workbench</h1>
                <button onClick={() => setShowTutorialModal(true)} title="Show Tutorial" className="text-indigo-600 hover:text-indigo-800 p-1">
                    <FaInfoCircle size={24}/>
                </button>
            </div>

             {/* Messaggi Principali */}
             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* FASE 1: Selezione o Upload Dataset */}
            <div className={`p-6 rounded-lg shadow-md border ${currentStep === 1 ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'} bg-white transition-all`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">Step 1: Dataset Selection</h2>
                     {currentStep > 1 && (selectedResource || uploadedFile) && <button onClick={() => {setCurrentStep(1); resetAnalysisState(true);}} className="text-xs text-indigo-600 hover:underline font-medium">Change Dataset</button>}
                </div>
                {currentStep === 1 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 items-start">
                            <div>
                                <label htmlFor="resourceSelectCsv" className="block text-sm font-medium text-gray-700 mb-1">Select from My Resources (Analysis Ready):</label>
                                {isLoadingResources ? <Spinner /> : (
                                    <select id="resourceSelectCsv" value={selectedResource?.id || ''} onChange={(e) => { const resId = e.target.value; const res = availableCsvResources.find(r => r.id.toString() === resId); if(res) { handleResourceCardSelect(res); } else { setSelectedResource(null); } }} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" disabled={availableCsvResources.length === 0}>
                                        <option value="">-- Select a CSV --</option>
                                        {availableCsvResources.map(r => ( <option key={r.id} value={r.id}>{r.name || r.original_filename}</option> ))}
                                    </select>
                                )}
                                {availableCsvResources.length === 0 && !isLoadingResources && <p className="text-xs text-gray-500 mt-1">No CSVs suitable for analysis found. Upload one.</p>}
                                <button onClick={fetchCsvResources} disabled={isLoadingResources} className="text-xs text-indigo-500 hover:underline mt-2 flex items-center"><FaRedo className="mr-1"/> Refresh List</button>
                            </div>
                            <div {...getRootProps()} className={`p-6 border-2 ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg text-center cursor-pointer transition-colors`}>
                                <input {...getInputProps()} ref={fileInputRef} /> <FaUpload className={`mx-auto h-10 w-10 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-2`} />
                                {isDragActive ? <p className="text-sm text-indigo-600">Drop CSV here...</p> : <p className="text-sm text-gray-600">Drag & drop, or click to upload</p>}
                                {uploadedFile && <p className="text-xs text-green-600 mt-1">File ready: {uploadedFile.name}</p>}
                            </div>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="taskTypePreference" className="block text-sm font-medium text-gray-700 mb-1">Task Type Preference (Optional):</label>
                            <select id="taskTypePreference" value={taskTypePreference} onChange={(e) => setTaskTypePreference(e.target.value)} className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"> <option value="">Any Task</option> <option value="regression">Regression</option> <option value="classification">Classification</option> </select>
                        </div>
                        <button onClick={handleSuggestAlgorithm} disabled={isSuggesting || (!selectedResource && !uploadedFile)} className="mt-3 w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"> {isSuggesting && <Spinner small color="white" />} <FaSearch className="mr-2" /> Analyze & Get AI Suggestions </button>
                    </>
                )}
                {currentStep > 1 && (selectedResource || uploadedFile) && ( <div className="mt-2 text-sm text-gray-600 p-3 bg-gray-50 rounded border border-gray-200"> <p>Using dataset: <strong>{uploadedFile ? uploadedFile.name : selectedResource?.name || selectedResource?.original_filename || 'Selected Resource'}</strong></p> {datasetPreview && <p className="text-xs">Preview based on: {datasetPreview.num_cols} columns, {datasetPreview.num_rows_sample} sample rows.</p>} </div> )}
            </div>

            {/* FASE 2: Configurazione Analisi */}
            {currentStep >= 2 && analysisSessionId && datasetPreview && (
                <div className={`p-6 rounded-lg shadow-md border ${currentStep === 2 ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'} bg-white mt-6 transition-all`}>
                    <div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-semibold text-gray-700">Step 2: Configure Analysis</h2> {currentStep > 2 && <button onClick={() => {setCurrentStep(2); setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null); setRegressionPredictionResult(null); setClassificationPredictionResult(null);}} className="text-xs text-indigo-600 hover:underline font-medium">Re-configure Analysis</button>} </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div> <h3 className="text-lg font-medium text-gray-600 mb-2">Dataset Preview</h3> <SimpleTable headers={datasetPreview.headers} rows={datasetPreview.sample_rows} maxRows={5} /> </div>
                        <div> <h3 className="text-lg font-medium text-gray-600 mb-2">AI Algorithm Suggestions</h3> {isSuggesting && !aiSuggestions.length ? <div className="text-center"><Spinner/></div> : aiSuggestions.length > 0 ? ( <select value={selectedAlgorithm?.algorithm_key || ''} className="w-full p-2 border border-gray-300 rounded-md bg-white mb-3 text-sm" onChange={(e) => handleAlgorithmSelect(e.target.value)} disabled={currentStep === 3}> <option value="">-- Select an AI suggestion --</option> {aiSuggestions.map(sugg => ( <option key={sugg.algorithm_key} value={sugg.algorithm_key}>{sugg.algorithm_name} ({sugg.task_type})</option> ))} </select> ) : (<p className="text-sm text-gray-500 italic mb-3">No AI suggestions. Select manually or re-analyze.</p>)} {selectedAlgorithm && <p className="text-xs text-gray-600 bg-indigo-50 p-2 rounded border border-indigo-200 mb-3"><strong>Motivation:</strong> {selectedAlgorithm.motivation}</p>}
                            {datasetPreview.headers.length > 0 && selectedAlgorithm?.task_type === 'regression' && ( <div className="space-y-3"> <div> <label htmlFor="features" className="block text-sm font-medium text-gray-700">Feature(s) (X):</label> <select multiple id="features" value={selectedFeatures} onChange={handleFeatureChange} disabled={currentStep === 3} className="w-full p-2 border border-gray-300 rounded-md bg-white h-24 text-sm disabled:bg-gray-100"> {datasetPreview.headers.filter(h => h !== selectedTarget).map(h => (<option key={`feat-${h}`} value={h}>{h}</option>))} </select> </div> <div> <label htmlFor="target" className="block text-sm font-medium text-gray-700">Target (Y):</label> <select id="target" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} disabled={currentStep === 3} className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-100"> <option value="">-- Select Target --</option> {datasetPreview.headers.filter(h => !selectedFeatures.includes(h)).map(h => (<option key={`target-${h}`} value={h}>{h}</option>))} </select> </div> </div> )}
                             {selectedAlgorithm?.task_type === 'classification' && ( <div className="text-sm text-gray-600 bg-green-50 p-3 rounded border border-green-200"> <p className="font-medium">For Classification:</p> <ul className="list-disc list-inside text-xs mt-1"> <li>All columns except the last will be features.</li> <li>Last column ('<span className="font-semibold">{datasetPreview.headers[datasetPreview.headers.length - 1]}</span>') will be target.</li> </ul> </div> )}
                        </div>
                    </div>
                    {currentStep === 2 && ( <button onClick={handleRunAnalysis} disabled={isRunningAnalysis || !selectedAlgorithm || (selectedAlgorithm.task_type === 'regression' && (selectedFeatures.length === 0 || !selectedTarget))} className="mt-6 w-full sm:w-auto px-6 py-2 bg-green-600 text-white font-semibold rounded-md shadow hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"> {isRunningAnalysis && <Spinner small color="white" />} <FaTable className="mr-2" /> Run Analysis: {selectedAlgorithm?.algorithm_name || ''} </button> )}
                </div>
            )}

            {/* FASE 3: Risultati Analisi */}
            {currentStep === 3 && analysisJobId && (
                <div className="p-6 rounded-lg shadow-md border border-indigo-500 bg-white mt-6">
                     <div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-semibold text-gray-700">Step 3: Analysis Results</h2> <button onClick={() => {setCurrentStep(1); resetAnalysisState(true);}} className="text-xs text-indigo-600 hover:underline font-medium">Start New Analysis</button> </div>
                    <p className="mb-2 text-sm">Job ID: <span className="font-mono text-xs">{analysisJobId}</span></p>
                    <p className="mb-4 text-sm">Status: <span className={`ml-2 font-medium px-2 py-0.5 rounded text-xs ${jobStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : jobStatus === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{jobStatus || 'Fetching...'}</span> {(isPollingResults || ['PENDING', 'PROCESSING'].includes(jobStatus) ) && <Spinner small color="indigo-500 ml-2"/>}</p>
                    {jobStatus === 'COMPLETED' && jobResults && ( <div className="space-y-4"> <div> <h3 className="text-lg font-medium text-gray-600">Metrics for <span className='font-semibold'>{jobResults.selected_algorithm_key}</span>:</h3> <pre className="bg-gray-50 p-3 rounded border text-xs overflow-x-auto max-h-48">{JSON.stringify(jobResults.results, null, 2)}</pre> </div>
                        {jobResults.task_type === 'regression' && jobResults.input_parameters?.selected_features?.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-md font-semibold text-gray-700 mb-2">Prediction (Regression)</h4> <label htmlFor="regPredictX" className="block text-sm font-medium text-gray-700">For <span className='font-semibold'>{jobResults.input_parameters.selected_features[0]}</span> =</label> <div className="flex items-center gap-2 mt-1"> <input type="number" id="regPredictX" value={regressionPredictFeatureValue} onChange={(e) => setRegressionPredictFeatureValue(e.target.value)} placeholder="X value" className="flex-grow p-2 border rounded-md"/> <button onClick={handleRegressionPredict} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Predict</button> </div> {regressionPredictionResult !== null && <p className="mt-2 text-sm font-semibold">Predicted <span className='font-semibold'>{jobResults.input_parameters.selected_target}</span>: <span className="text-indigo-600 font-mono">{regressionPredictionResult.toFixed(4)}</span></p>} </div> )}
                        {jobResults.task_type === 'classification' && jobResults.input_parameters?.selected_features && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-md font-semibold text-gray-700 mb-2">Prediction (Classification)</h4> <div className="space-y-2"> {jobResults.input_parameters.selected_features.map(feat => ( <div key={feat}> <label htmlFor={`cls_input_${feat}`} className="block text-sm text-gray-700">{feat}:</label> <input type="text" id={`cls_input_${feat}`} value={classificationInputValues[feat] || ''} onChange={(e) => handleClassificationInputChange(feat, e.target.value)} placeholder={`Value for ${feat}`} className="mt-1 w-full p-2 border rounded-md"/> </div> ))} </div> <button onClick={handleClassificationPredict} disabled={isPredicting} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center"> {isPredicting && <Spinner small color="white"/>} Predict Class </button> {classificationPredictionResult && <p className="mt-2 text-sm font-semibold">Predicted: <span className="text-indigo-600 font-bold">{classificationPredictionResult.predicted_class}</span></p>} {classificationPredictionResult?.probabilities && ( <div className="mt-2 text-xs"> <p className="font-medium">Probabilities:</p> <ul className="list-disc list-inside pl-4"> {Object.entries(classificationPredictionResult.probabilities).sort(([,a],[,b]) => b-a).map(([cN,p]) => ( <li key={cN}><span className="font-semibold">{cN}</span>: {(p*100).toFixed(1)}%</li> ))} </ul> </div> )} </div> )}
                        {chartDataAndOptions && ( <div> <h3 className="text-lg font-medium text-gray-600 mt-4 mb-2">Visualization</h3> <div className="relative h-80 md:h-96 border rounded p-1 bg-gray-50"> <Plot data={chartDataAndOptions.data} layout={chartDataAndOptions.layout} useResizeHandler={true} className="w-full h-full" config={{responsive: true, displaylogo: false}}/> </div> </div> )}
                    </div> )}
                     {jobStatus === 'FAILED' && <Alert type="error" message={`Analysis Failed: ${jobResults?.error_message || 'Unknown error. Check worker logs.'}`} /> }
                </div>
            )}
            {/* Console Log */}
             {/* Modali */}
             <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
             <AlertModalShell isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title={alertModalContent.title}> {alertModalContent.message} </AlertModalShell>
        </div>
    );
};

export default DataAnalysisPage;