// src/pages/DataAnalysisPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse'; // npm install papaparse
import { FaUpload, FaSpinner, FaTimes, FaBrain, FaChartBar, FaTable, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaFileCsv, FaSearch, FaRedo, FaSave } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources, uploadResource as uploadResourceViaRM } from '../services/resourceManagerService';
import { suggestAlgorithm, runAnalysis, getAnalysisResults, predictInstance } from '../services/dataAnalysisService';
import Plot from 'react-plotly.js';

// Importa componenti figli
import ResourceCard from '../components/ResourceCard';
import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal';
import EditableDataTable from '../components/EditableDataTable'; // Assumendo che tu abbia creato questo

// --- Componenti UI Base ---
const Spinner = ({ small = false, color = 'indigo-500' }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-${color} ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm text-sm';
    let typeStyle = '', icon = null;
    switch (type) {
        case 'success': typeStyle = 'bg-green-100 border-green-300 text-green-700'; icon = <FaCheckCircle className="inline mr-2 text-green-600 h-5 w-5"/>; break;
        case 'warning': typeStyle = 'bg-yellow-100 border-yellow-300 text-yellow-700'; icon = <FaExclamationTriangle className="inline mr-2 text-yellow-600 h-5 w-5"/>; break;
        case 'info': typeStyle = 'bg-blue-100 border-blue-300 text-blue-700'; icon = <FaInfoCircle className="inline mr-2 text-blue-600 h-5 w-5"/>; break;
        case 'error': default: typeStyle = 'bg-red-100 border-red-300 text-red-700'; icon = <FaExclamationTriangle className="inline mr-2 text-red-600 h-5 w-5"/>; break;
    }
    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            <span className="flex items-center"> {icon} <span className="block sm:inline align-middle mr-6">{message}</span> </span>
            {onClose && ( <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-3 py-3 focus:outline-none" aria-label="Close"><FaTimes className={`h-4 w-4 ${type==='error' ? 'text-red-500' : type==='success' ? 'text-green-500' : type==='warning' ? 'text-yellow-500' : 'text-blue-500'}`}/></button> )}
        </div>
    );
};

const AlertModalShell = ({ isOpen, onClose, title = "Alert", children }) => {
     if (!isOpen) return null;
     return ( <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"> <div className="relative mx-auto p-6 border-0 w-full max-w-md shadow-xl rounded-lg bg-white"> <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4"> <h3 className="text-lg font-medium text-gray-900">{title}</h3> <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal"> <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg> </button> </div> <div className="mt-2 text-sm text-gray-600">{children}</div> <div className="mt-4 pt-3 border-t border-gray-200 text-right"> <button onClick={onClose} type="button" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> OK </button> </div> </div> </div> );
};
// --- Fine UI ---

const DataAnalysisPage = () => {
    const { isAuthenticated } = useAuth();

    // FASE 1
    const [availableCsvResources, setAvailableCsvResources] = useState([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    // FASE 2
    const [analysisSessionId, setAnalysisSessionId] = useState(null);
    const [datasetPreview, setDatasetPreview] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [taskTypePreference, setTaskTypePreference] = useState('');
    const [editableDatasetHeaders, setEditableDatasetHeaders] = useState([]);
    const [editableDatasetData, setEditableDatasetData] = useState([]);
    const [originalDatasetDataForCompare, setOriginalDatasetDataForCompare] = useState([]);
    const [isSavingEditedDataset, setIsSavingEditedDataset] = useState(false);
    const [saveEditedDatasetError, setSaveEditedDatasetError] = useState('');

    const [trainingState, setTrainingState] = useState('idle');
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);
    // FASE 3
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
    const [classificationPredictedPoint, setClassificationPredictedPoint] = useState(null);
    const [isPredicting, setIsPredicting] = useState(false);

    // UI State
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [warning, setWarning] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({ title: '', message: '' });

    const pollingIntervalRef = useRef(null);

    const trainingStateRef = useRef(trainingState);
    const isRealtimeActiveRef = useRef(isRealtimeActive);

    useEffect(() => { trainingStateRef.current = trainingState; }, [trainingState]);
    useEffect(() => { isRealtimeActiveRef.current = isRealtimeActive; }, [isRealtimeActive]);

    // Helper URL
    const buildFullUrl = useCallback((relativeUrl) => {
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
            const file = acceptedFiles[0];
            setUploadedFile(file); setSelectedResource(null); setCurrentStep(1);
            resetAnalysisState(false);
            setSuccess(`File "${file.name}" ready. Click "Analyze & Get AI Suggestions".`);
        }
    }, []); // Rimosso resetAnalysisState da qui, gestito in handleSuggestAlgorithm
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'text/csv': ['.csv'] },
        maxSize: 20 * 1024 * 1024, multiple: false
    });

    // Reset per nuova analisi o cambio dataset
    const resetAnalysisState = (resetFileAndResourceSelection = true) => {
        setAnalysisSessionId(null); setDatasetPreview(null); setAiSuggestions([]);
        setSelectedAlgorithm(null); setSelectedFeatures([]); setSelectedTarget('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        setRegressionPredictFeatureValue(''); setRegressionPredictionResult(null);
        setClassificationInputValues({}); setClassificationPredictionResult(null);
        setClassificationPredictedPoint(null);
        setEditableDatasetData([]); setEditableDatasetHeaders([]);
        setOriginalDatasetDataForCompare([]);
        if (resetFileAndResourceSelection) {
            setSelectedResource(null); setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    const resetConfigAndResults = () => {
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        setRegressionPredictFeatureValue(''); setRegressionPredictionResult(null);
        setClassificationInputValues({}); setClassificationPredictionResult(null);
        setClassificationPredictedPoint(null);
        // Non resetta editableDatasetData/Headers qui, per permettere re-run con dati editati (se implementato)
        // o per mantenere la visualizzazione se l'utente torna indietro.
    };

    // FASE 1: Ottieni Suggerimenti
    const handleSuggestAlgorithm = async () => {
        if (!selectedResource && !uploadedFile) { setError('Please select an existing CSV or upload a new one.'); return; }
        setIsSuggesting(true); setError(''); setSuccess(''); setWarning('');
        resetAnalysisState(false);
        try {
            let payload;
            if (uploadedFile) { payload = new FormData(); payload.append('file', uploadedFile);
            } else if (selectedResource) { payload = { resource_id: selectedResource.id.toString() };
            } else { throw new Error("No data source selected."); }
            if (taskTypePreference) { if (payload instanceof FormData) payload.append('task_type_preference', taskTypePreference); else payload.task_type_preference = taskTypePreference; }

            const response = await suggestAlgorithm(payload);
            setAnalysisSessionId(response.analysis_session_id);
            setDatasetPreview(response.dataset_preview);
            setAiSuggestions(response.suggestions || []);
            if (response.dataset_preview?.sample_rows && response.dataset_preview?.headers) {
                const initialEditableData = response.dataset_preview.sample_rows.map(row => ({ ...row }));
                setEditableDatasetData(initialEditableData);
                setOriginalDatasetDataForCompare(JSON.parse(JSON.stringify(initialEditableData)));
                setEditableDatasetHeaders(response.dataset_preview.headers);
            } else { setEditableDatasetData([]); setOriginalDatasetDataForCompare([]); setEditableDatasetHeaders([]); }
            setSuccess('Suggestions received! Configure your analysis.'); setCurrentStep(2);
            if (response.suggestions && response.suggestions.length > 0) { handleAlgorithmSelect(response.suggestions[0].algorithm_key);
            } else { setSelectedAlgorithm(null); setSelectedFeatures([]); setSelectedTarget(''); }
        } catch (err) { setError(err.response?.data?.error || 'Failed to get suggestions.');
        } finally { setIsSuggesting(false); }
    };

    const handleAlgorithmSelect = (algorithmKey) => {
        const suggestion = aiSuggestions.find(s => s.algorithm_key === algorithmKey);
        setSelectedAlgorithm(suggestion);
        if (suggestion && datasetPreview?.headers) {
            if (suggestion.task_type === 'classification') {
                const headers = datasetPreview.headers;
                if (headers.length > 1) { setSelectedFeatures(headers.slice(0, -1)); setSelectedTarget(headers[headers.length - 1]); }
                else { setSelectedFeatures([]); setSelectedTarget(headers[0] || ''); }
            } else { setSelectedFeatures(suggestion.suggested_features?.slice(0, 1) || []); setSelectedTarget(suggestion.suggested_target || ''); }
        } else { setSelectedFeatures([]); setSelectedTarget(''); }
    };

    // FASE 2: Esegui Analisi
    const handleRunAnalysis = async () => {
        if (!analysisSessionId || !selectedAlgorithm) { setError('Session or Algorithm not selected.'); return; }
        let featuresToRun = selectedFeatures; let targetToRun = selectedTarget;
        if (selectedAlgorithm.task_type === 'classification' && datasetPreview?.headers) {
            const headers = datasetPreview.headers;
            if (headers.length > 1) { featuresToRun = headers.slice(0, -1); targetToRun = headers[headers.length - 1]; }
            else { setError("Not enough columns for auto classification setup."); return; }
        }
        if (featuresToRun.length === 0 || !targetToRun) { setError('Features and Target must be defined.'); return; }
        setIsRunningAnalysis(true); setError(''); setSuccess('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        try {
            const payload = { analysis_session_id: analysisSessionId, selected_algorithm_key: selectedAlgorithm.algorithm_key, selected_features: featuresToRun, selected_target: targetToRun, task_type: selectedAlgorithm.task_type };
            const response = await runAnalysis(payload);
            setAnalysisJobId(response.analysis_job_id); setJobStatus(response.status);
            setSuccess('Analysis task submitted! Monitoring...'); setCurrentStep(3);
            startJobPolling(response.analysis_job_id);
        } catch (err) { setError(err.response?.data?.error || 'Failed to start analysis job.');
        } finally { setIsRunningAnalysis(false); }
    };

    // Polling Risultati Job
    const stopJobPolling = useCallback(() => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }, []);
    const startJobPolling = useCallback((jobId) => {
        stopJobPolling(); setIsPollingResults(true);
        pollingIntervalRef.current = setInterval(async () => {
            if (!jobId) { stopJobPolling(); setIsPollingResults(false); return; }
            try {
                const data = await getAnalysisResults(jobId);
                setJobStatus(data.status);
                if (data.status === 'COMPLETED') {
                    stopJobPolling(); setIsPollingResults(false); setJobResults(data); setPlotData(data.plot_data);
                    setSuccess('Analysis completed successfully!');
                } else if (data.status === 'FAILED') {
                    stopJobPolling(); setIsPollingResults(false); setJobResults(data); // Salva per vedere errore
                    setError(`Analysis failed: ${data.error_message || 'Unknown error'}`);
                }
            } catch (err) { console.error(`Polling error for job ${jobId}:`, err); if (err.response?.status === 404) { setError("Job not found."); stopJobPolling(); setIsPollingResults(false);}}
        }, 3000);
    }, [stopJobPolling]); // Aggiunto stopJobPolling

    useEffect(() => { return () => stopJobPolling(); }, [stopJobPolling]);

    // Selezione Risorsa dalla Card
    const handleResourceCardSelect = (resource) => {
        if (currentStep !== 1 && resource.id === selectedResource?.id && !uploadedFile) return;
        setError(''); setSuccess(''); resetAnalysisState(false);
        setSelectedResource(resource); setUploadedFile(null); setCurrentStep(1);
        setSuccess(`Resource "${resource.name || resource.original_filename}" selected. Click "Analyze & Get AI Suggestions".`);
    };

    // Gestione Input Tabella Editabile e Salvataggio
    const handleCellEdit = (rowIndex, columnHeader, newValue) => {
        setEditableDatasetData(currentData => currentData.map((row, rIdx) => rIdx === rowIndex ? { ...row, [columnHeader]: newValue } : row ));
    };
    const handleSaveEditedDataset = async () => {
        if (editableDatasetData.length === 0 || editableDatasetHeaders.length === 0) { setError("No data to save."); return; }
        setIsSavingEditedDataset(true); setSaveEditedDatasetError(''); setSuccess('');
        try {
            const csvString = Papa.unparse(editableDatasetData, { headers: editableDatasetHeaders });
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const originalFileNameBase = uploadedFile?.name || selectedResource?.original_filename || 'dataset.csv';
            const originalNameNoExt = originalFileNameBase.substring(0, originalFileNameBase.lastIndexOf('.')) || originalFileNameBase;
            const fileName = `edited_${originalNameNoExt}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            const formData = new FormData(); formData.append('file', blob, fileName); formData.append('name', fileName);
            formData.append('description', `Edited version of ${originalFileNameBase} from Data Analysis Workbench.`);
            const savedResource = await uploadResourceViaRM(formData); // Usa servizio RM
            setSuccess(`Edited dataset saved as "${savedResource.name || savedResource.original_filename}"! Status: ${savedResource.status}. It's now processing.`);
            fetchCsvResources(); // Aggiorna lista
        } catch (err) { setSaveEditedDatasetError(err.response?.data?.error || 'Failed to save edited dataset.');
        } finally { setIsSavingEditedDataset(false); }
    };
    const hasDataChanged = useMemo(() => JSON.stringify(editableDatasetData) !== JSON.stringify(originalDatasetDataForCompare), [editableDatasetData, originalDatasetDataForCompare]);

    // Predizioni Interattive
    const handleFeatureChange = (e) => { const values = Array.from(e.target.selectedOptions, option => option.value); setSelectedFeatures(values); };
    const handleClassificationInputChange = (featureName, value) => { setClassificationInputValues(prev => ({ ...prev, [featureName]: value })); };
    const handleRegressionPredict = async () => {
        if (!jobResults || jobResults.task_type !== 'regression' || regressionPredictFeatureValue === '') { setError("Regression model/input missing."); return; }
        setError(''); setIsPredicting(true); setRegressionPredictionResult(null);
        const algoKey = jobResults.selected_algorithm_key;
        const featureName = jobResults.input_parameters?.selected_features?.[0];
        logMessage(`Regression predict for X=${regressionPredictFeatureValue}`);
        if ((algoKey === 'linear_regression' || algoKey === 'polynomial_regression') && jobResults.results?.slope !== undefined && jobResults.results?.intercept !== undefined) {
            const slope = jobResults.results.slope; const intercept = jobResults.results.intercept;
            const prediction = slope * parseFloat(regressionPredictFeatureValue) + intercept;
            setRegressionPredictionResult(prediction); setIsPredicting(false);
            logMessage(`Frontend prediction: ${prediction.toFixed(4)}`);
        } else if (featureName && analysisJobId) {
            try {
                const featuresPayload = { [featureName]: parseFloat(regressionPredictFeatureValue) };
                const result = await predictInstance(analysisJobId, featuresPayload, 'regression');
                setRegressionPredictionResult(result.predicted_value);
                logMessage(`Backend prediction: ${result.predicted_value.toFixed(4)}`);
            } catch (err) { setError(err.response?.data?.error || "Regression prediction API failed."); logMessage(`API predict error: ${err.message}`);
            } finally { setIsPredicting(false); }
        } else { setError("Cannot make prediction: model params/feature name missing."); setIsPredicting(false); }
    };

    const handleClassificationPredict = async () => {
        if (!analysisJobId || !jobResults || jobResults.task_type !== 'classification') {
            setError("Classification model/job not ready for prediction.");
            return;
        }
        const featuresForPrediction = jobResults.input_parameters?.selected_features || [];
        if (featuresForPrediction.some(feat => classificationInputValues[feat] === undefined || String(classificationInputValues[feat]).trim() === '')) {
            setError("Please provide values for all listed features before predicting.");
            return;
        }

        setIsPredicting(true);
        setError('');
        setClassificationPredictionResult(null);
        setClassificationPredictedPoint(null);
        console.log(`[PredictClass] Starting prediction for job ID: ${analysisJobId}`);
        console.log("[PredictClass] Input Features:", classificationInputValues);

        try {
            const featuresPayload = {};
            for (const feat of featuresForPrediction) {
                const val = classificationInputValues[feat];
                // Converti a numero se possibile, altrimenti invia come stringa
                // Il backend dovrà gestire i tipi corretti o il preprocessor lo farà
                featuresPayload[feat] = isNaN(Number(val)) || val === '' ? val : Number(val);
            }
            console.log("[PredictClass] Payload to API:", { features: featuresPayload });

            const result = await predictInstance(analysisJobId, featuresPayload, 'classification'); // Usa predictInstance

            console.log("[PredictClass] API Response:", result);
            setClassificationPredictionResult(result); // result = { predicted_class, probabilities, plot_coordinates }

            if (result.plot_coordinates && result.plot_coordinates.length >= 3) { // Assicurati ci siano abbastanza coordinate
                const coords = result.plot_coordinates;
                setClassificationPredictedPoint({
                    x: coords[0],
                    y: coords[1],
                    z: coords[2],
                    name: `Predicted: ${result.predicted_class}`
                });
            } else if (result.plot_coordinates) {
                console.warn("[PredictClass] plot_coordinates received but not enough for 3D point:", result.plot_coordinates);
            }

        } catch (err) {
            console.error("[PredictClass] API Error:", err.response || err.message || err);
            setError(err.response?.data?.error || 'Prediction failed. Please check console for details.');
        } finally {
            console.log("[PredictClass] Setting isPredicting to false.");
            setIsPredicting(false);
        }
    };

    // Preparazione Dati e Opzioni per Grafico Plotly
    const chartDataAndOptions = useMemo(() => {
        if (!jobStatus || jobStatus !== 'COMPLETED' || !jobResults || !plotData?.data) return null;
        let dataForPlotly = [];
        let layoutForPlotly = { autosize: true, margin: { l: 50, r: 20, b: 50, t: 60, pad: 4 }, legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 }};

        if (jobResults.task_type === 'regression' && plotData.type === 'regression_scatter') {
            layoutForPlotly.title = plotData.layout.title || "Regression: Actual vs. Predicted";
            layoutForPlotly.xaxis = { title: plotData.layout.xaxis_title || "Actual Values" };
            layoutForPlotly.yaxis = { title: plotData.layout.yaxis_title || "Predicted Values" };
            if (plotData.data.actual_vs_predicted) dataForPlotly.push({ type: 'scatter', mode: 'markers', x: plotData.data.actual_vs_predicted.map(p=>p.actual), y: plotData.data.actual_vs_predicted.map(p=>p.predicted), name: 'Actual vs. Predicted', marker: {size: 7, color: 'rgba(30,100,200,0.7)'} });
            if (plotData.data.ideal_line) dataForPlotly.push({ type: 'scatter', mode: 'lines', x: plotData.data.ideal_line.map(p=>p.x), y: plotData.data.ideal_line.map(p=>p.y), name: 'Ideal (y=x)', line: {dash: 'dash', color: 'rgba(200,50,50,0.8)', width:2} });
            if (plotData.data.regression_line) dataForPlotly.push({ type: 'scatter', mode: 'lines', x: plotData.data.regression_line.map(p=>p.x), y: plotData.data.regression_line.map(p=>p.y), name: 'Model Regression Line', line: { color: 'green', width: 2 } });
            if (regressionPredictionResult !== null && regressionPredictFeatureValue !== '' && jobResults.input_parameters?.selected_features?.length === 1) {
                const xVal = parseFloat(regressionPredictFeatureValue);
                dataForPlotly.push({ type: 'scatter', mode: 'markers', x: [xVal], y: [regressionPredictionResult], name: `Prediction for X=${xVal.toFixed(2)}`, marker: { color: 'orange', size: 12, symbol: 'star' } });
            }
        } else if (jobResults.task_type === 'classification') {
            if (plotData.type === 'classification_scatter_3d' && Array.isArray(plotData.data)) {
                layoutForPlotly.title = plotData.layout.title || "3D Scatter of Predictions";
                layoutForPlotly.scene = plotData.layout.scene || { xaxis:{title:'F1 (Transformed)'}, yaxis:{title:'F2 (Transformed)'}, zaxis:{title:'F3 (Transformed)'} };
                dataForPlotly = [...plotData.data];
                if (classificationPredictedPoint && typeof classificationPredictedPoint.x === 'number') {
                    dataForPlotly.push({ type: 'scatter3d', x: [classificationPredictedPoint.x], y: [classificationPredictedPoint.y], z: [classificationPredictedPoint.z], mode: 'markers', name: classificationPredictedPoint.name, marker: { size: 10, color: 'red', symbol: 'diamond-open', opacity: 1 } });
                }
            } else if (plotData.type === 'classification_predictions_histogram' && Array.isArray(plotData.data)) {
                 layoutForPlotly.title = plotData.layout.title || "Predicted Class Distribution";
                 layoutForPlotly.xaxis = { title: plotData.layout.xaxis_title || "Predicted Class" };
                 layoutForPlotly.yaxis = { title: plotData.layout.yaxis_title || "Count" };
                 dataForPlotly.push({ type: 'bar', x: plotData.data.map(p => p.class), y: plotData.data.map(p => p.count), marker: { color: plotData.data.map((_, i) => `hsl(${i * (360 / (plotData.data.length || 1))}, 70%, 60%)`) } });
            }
        }
        return (dataForPlotly.length > 0) ? { data: dataForPlotly, layout: layoutForPlotly } : null;
    }, [jobStatus, jobResults, plotData, regressionPredictFeatureValue, regressionPredictionResult, classificationPredictedPoint]);
    // --- Rendering ---
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4"> <h1 className="text-3xl font-bold text-gray-800">Data Analysis Workbench</h1> <button onClick={() => setShowTutorialModal(true)} title="Show Tutorial" className="p-1 text-indigo-600 hover:text-indigo-800"><FaInfoCircle size={24}/></button> </div>
            {error && <Alert type="error" message={error} onClose={() => setError('')} />}
            {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
            {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}

            {/* FASE 1 */}
            <div className={`p-6 rounded-lg shadow-md border ${currentStep === 1 ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'} bg-white transition-all`}>
                <div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-semibold text-gray-700">Step 1: Dataset Selection</h2> {currentStep > 1 && (selectedResource || uploadedFile) && <button onClick={() => {setCurrentStep(1); resetAnalysisState(true);}} className="text-xs text-indigo-600 hover:underline font-medium">Change Dataset</button>} </div>
                {currentStep === 1 && ( <> <div className="mb-6"> <h3 className="text-md font-medium text-gray-700 mb-2">Select from My Resources:</h3> {isLoadingResources ? <Spinner /> : availableCsvResources.length > 0 ? ( <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-72 overflow-y-auto p-1 -m-1"> {availableCsvResources.map(res => ( <ResourceCard key={res.id} resource={res} buildFullUrl={buildFullUrl} onSelect={() => handleResourceCardSelect(res)} isSelected={selectedResource?.id === res.id} /> ))} </div> ) : (<p className="text-sm text-gray-500 italic">No analysis-ready CSVs. Upload one.</p>)} <button onClick={fetchCsvResources} disabled={isLoadingResources} className="text-xs text-indigo-500 hover:underline mt-2 flex items-center"><FaRedo className="mr-1"/> Refresh</button> </div> <div className="mt-4 pt-4 border-t"> <h3 className="text-md font-medium text-gray-700 mb-2">Or Upload New CSV:</h3> <div {...getRootProps()} className={`p-6 border-2 ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg text-center cursor-pointer`}> <input {...getInputProps()} ref={fileInputRef} /> <FaUpload className={`mx-auto h-10 w-10 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-2`} /> {isDragActive ? <p>Drop CSV...</p> : <p>Drag & drop, or click</p>} {uploadedFile && <p className="text-xs text-green-600 mt-1">Ready: {uploadedFile.name}</p>} </div> </div> <div className="mt-6"> <label htmlFor="taskTypePreference" className="block text-sm font-medium text-gray-700 mb-1">Task Preference:</label> <select id="taskTypePreference" value={taskTypePreference} onChange={(e) => setTaskTypePreference(e.target.value)} className="w-full md:w-1/2 p-2 border rounded-md shadow-sm"> <option value="">Any</option> <option value="regression">Regression</option> <option value="classification">Classification</option> </select> </div> <button onClick={handleSuggestAlgorithm} disabled={isSuggesting || (!selectedResource && !uploadedFile)} className="mt-4 w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-md shadow disabled:opacity-50 flex items-center justify-center"> {isSuggesting && <Spinner small color="white" />} <FaSearch className="mr-2" /> Get AI Suggestions </button> </> )}
                {currentStep > 1 && (selectedResource || uploadedFile) && ( <div className="mt-2 text-sm text-gray-600 p-3 bg-gray-50 rounded border"> <p>Using: <strong>{uploadedFile ? uploadedFile.name : selectedResource?.name || selectedResource?.original_filename}</strong></p> {datasetPreview && <p className="text-xs">Preview: {datasetPreview.num_cols} cols, {datasetPreview.num_rows_sample} sample rows.</p>} </div> )}
            </div>

            {/* FASE 2 */}
            {currentStep >= 2 && analysisSessionId && datasetPreview && (
                <div className={`p-6 rounded-lg shadow-md border ${currentStep === 2 ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 opacity-70'} bg-white mt-6`}>
                    <div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-semibold text-gray-700">Step 2: Configure & Review</h2> {currentStep === 3 && <button onClick={() => {setCurrentStep(2); resetConfigAndResults();}} className="text-xs text-indigo-600 hover:underline">Re-configure</button>} </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div> <h3 className="text-lg font-medium text-gray-600 mb-2">Dataset Preview & Edit</h3> <EditableDataTable headers={editableDatasetHeaders} data={editableDatasetData} onDataChange={handleCellEdit} maxRows={10} /> {editableDatasetHeaders.length > 0 && ( <button onClick={handleSaveEditedDataset} disabled={isSavingEditedDataset || !hasDataChanged} className="mt-3 w-full sm:w-auto px-4 py-2 bg-blue-500 text-white text-sm rounded-md shadow disabled:opacity-50 flex items-center"> {isSavingEditedDataset && <Spinner small color="white" />} <FaSave className="mr-2"/> Save Edited to Resources </button> )} {saveEditedDatasetError && <Alert type="error" message={saveEditedDatasetError} onClose={()=>setSaveEditedDatasetError('')} />} </div>
                        <div> <h3 className="text-lg font-medium text-gray-600 mb-2">Algorithm & Parameters</h3> {isSuggesting && !aiSuggestions.length ? <Spinner/> : aiSuggestions.length > 0 ? ( <select value={selectedAlgorithm?.algorithm_key || ''} className="w-full p-2 border rounded-md mb-3 text-sm" onChange={(e) => handleAlgorithmSelect(e.target.value)} disabled={currentStep === 3}> <option value="">-- Select AI Suggestion --</option> {aiSuggestions.map(s => ( <option key={s.algorithm_key} value={s.algorithm_key}>{s.algorithm_name} ({s.task_type})</option> ))} </select> ) : (<p className="text-sm text-gray-500 italic mb-3">No AI suggestions. Configure manually.</p>)} {selectedAlgorithm && <p className="text-xs bg-indigo-50 p-2 rounded border mb-3"><strong>AI Motivation:</strong> {selectedAlgorithm.motivation}</p>}
                            {datasetPreview.headers.length > 0 && selectedAlgorithm?.task_type === 'regression' && ( <div className="space-y-3"> <div> <label htmlFor="features" className="text-sm font-medium">Features (X):</label> <select multiple id="features" value={selectedFeatures} onChange={handleFeatureChange} disabled={currentStep === 3} className="w-full p-2 border rounded h-24 text-sm disabled:bg-gray-100"> {datasetPreview.headers.filter(h => h !== selectedTarget).map(h => (<option key={`feat-${h}`} value={h}>{h}</option>))} </select> </div> <div> <label htmlFor="target" className="text-sm font-medium">Target (Y):</label> <select id="target" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} disabled={currentStep === 3} className="w-full p-2 border rounded text-sm disabled:bg-gray-100"> <option value="">-- Select Target --</option> {datasetPreview.headers.filter(h => !selectedFeatures.includes(h)).map(h => (<option key={`target-${h}`} value={h}>{h}</option>))} </select> </div> </div> )}
                            {selectedAlgorithm?.task_type === 'classification' && ( <div className="text-sm bg-green-50 p-3 rounded border"> <p className="font-medium">Classification Setup:</p> <ul className="list-disc list-inside text-xs mt-1"> <li>Features: All except last.</li> <li>Target: Last ('<span className="font-semibold">{datasetPreview.headers[datasetPreview.headers.length - 1]}</span>').</li> </ul> </div> )}
                        </div>
                    </div>
                    {currentStep === 2 && ( <button onClick={handleRunAnalysis} disabled={isRunningAnalysis || !selectedAlgorithm || (selectedAlgorithm.task_type === 'regression' && (selectedFeatures.length === 0 || !selectedTarget))} className="mt-6 w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-md shadow disabled:opacity-50 flex items-center justify-center"> {isRunningAnalysis && <Spinner small color="white" />} <FaTable className="mr-2" /> Run: {selectedAlgorithm?.algorithm_name || 'Analysis'} </button> )}
                </div>
            )}

            {/* FASE 3: Risultati Analisi */}
            {currentStep === 3 && analysisJobId && (
                <div className="p-6 rounded-lg shadow-md border border-indigo-500 bg-white mt-6">
                     <div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-semibold text-gray-700">Step 3: Analysis Results</h2> <button onClick={() => {setCurrentStep(1); resetAnalysisState(true);}} className="text-xs text-indigo-600 hover:underline">Start New Analysis</button> </div>
                    <p className="mb-2 text-sm">Job ID: <span className="font-mono text-xs">{analysisJobId}</span></p>
                    <p className="mb-4 text-sm">Status: <span className={`ml-2 font-medium px-2 py-0.5 rounded text-xs ${jobStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : jobStatus === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{jobStatus || 'Fetching...'}</span> {(isPollingResults || ['PENDING', 'PROCESSING'].includes(jobStatus) ) && <Spinner small color="indigo-500 ml-2"/>}</p>
                    {jobStatus === 'COMPLETED' && jobResults && ( <div className="space-y-6"> <div> <h3 className="text-lg font-medium text-gray-700 mb-1">Metrics ({jobResults.selected_algorithm_key}):</h3> <pre className="bg-gray-100 p-3 rounded border text-xs overflow-x-auto max-h-48">{JSON.stringify(jobResults.results, null, 2)}</pre> </div>
                        {jobResults.task_type === 'regression' && jobResults.input_parameters?.selected_features?.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-md font-semibold text-gray-700 mb-2">Predict (Regression)</h4> <label htmlFor="regPredictX" className="text-sm font-medium">For <span className='font-semibold'>{jobResults.input_parameters.selected_features[0]}</span> =</label> <div className="flex items-center gap-2 mt-1"> <input type="number" id="regPredictX" value={regressionPredictFeatureValue} onChange={(e) => setRegressionPredictFeatureValue(e.target.value)} placeholder="X value" className="flex-grow p-2 border rounded-md"/> <button onClick={handleRegressionPredict} disabled={isPredicting} className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"> {isPredicting && jobResults.task_type === 'regression' ? <Spinner small color="white"/> : 'Predict'} </button> </div> {regressionPredictionResult !== null && <p className="mt-2 text-sm font-semibold">Predicted <span className='font-semibold'>{jobResults.input_parameters.selected_target}</span>: <span className="text-indigo-600 font-mono">{regressionPredictionResult.toFixed(4)}</span></p>} </div> )}
                        {jobResults.task_type === 'classification' && jobResults.input_parameters?.selected_features && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-md font-semibold text-gray-700 mb-2">Predict (Classification)</h4> <div className="space-y-2"> {jobResults.input_parameters.selected_features.map(feat => ( <div key={feat}> <label htmlFor={`cls_input_${feat}`} className="block text-sm text-gray-700">{feat}:</label> <input type="text" id={`cls_input_${feat}`} value={classificationInputValues[feat] || ''} onChange={(e) => handleClassificationInputChange(feat, e.target.value)} placeholder={`Val for ${feat}`} className="mt-1 w-full p-2 border rounded-md"/> </div> ))} </div> <button onClick={handleClassificationPredict} disabled={isPredicting} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 flex items-center"> {isPredicting && jobResults.task_type === 'classification' ? <Spinner small color="white"/> : 'Predict Class'} </button> {classificationPredictionResult && <p className="mt-2 text-sm font-semibold">Predicted Class: <span className="text-indigo-600 font-bold">{classificationPredictionResult.predicted_class}</span></p>} {classificationPredictionResult?.probabilities && ( <div className="mt-2 text-xs"> <p className="font-medium">Probabilities:</p> <ul className="list-disc list-inside pl-4"> {Object.entries(classificationPredictionResult.probabilities).sort(([,a],[,b]) => b-a).map(([cN,p]) => ( <li key={cN}><span className="font-semibold">{cN}</span>: {(p*100).toFixed(1)}%</li> ))} </ul> </div> )} </div> )}
                        {chartDataAndOptions ? ( <div> <h3 className="text-lg font-medium text-gray-700 mt-4 mb-2">Visualization</h3> <div className="relative h-[400px] md:h-[500px] border rounded p-1 bg-gray-50 shadow-inner"> <Plot data={chartDataAndOptions.data} layout={chartDataAndOptions.layout} useResizeHandler={true} className="w-full h-full" config={{responsive: true, displaylogo: false}}/> </div> </div> ) : (jobStatus === 'COMPLETED' && <p className="text-sm text-gray-500 italic mt-4">No plot data available.</p>)}
                    </div> )}
                     {jobStatus === 'FAILED' && <Alert type="error" message={`Analysis Failed: ${jobResults?.error_message || 'Unknown error.'}`} /> }
                </div>
            )}
            <ConsoleLog logs={consoleLogs} onClear={() => setConsoleLogs([])} />
            <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
            <AlertModalShell isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title={alertModalContent.title}> {alertModalContent.message} </AlertModalShell>
        </div>
    );
};

export default DataAnalysisPage;