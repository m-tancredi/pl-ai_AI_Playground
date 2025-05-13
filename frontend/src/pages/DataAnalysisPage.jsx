// src/pages/DataAnalysisPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaUpload, FaSpinner, FaTimes, FaBrain, FaChartBar, FaTable, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaFileCsv, FaSearch, FaRedo } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources } from '../services/resourceManagerService'; // Per selezionare CSV
import { suggestAlgorithm, runAnalysis, getAnalysisResults } from '../services/dataAnalysisService';
import Plot from 'react-plotly.js'; // npm install react-plotly.js plotly.js

// --- Componenti UI Base (Spinner, Alert, SimpleTable) ---
const Spinner = ({ small = false, color = 'indigo-500' }) => ( <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-${color} ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div> );
const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm text-sm';
    let typeStyle = '', icon = null;
    switch (type) {
        case 'success': typeStyle = 'bg-green-100 border-green-300 text-green-800'; icon = <FaCheckCircle className="inline mr-2 text-green-600"/>; break;
        case 'warning': typeStyle = 'bg-yellow-100 border-yellow-300 text-yellow-700'; icon = <FaExclamationTriangle className="inline mr-2 text-yellow-600"/>; break;
        case 'info': typeStyle = 'bg-blue-100 border-blue-300 text-blue-700'; icon = <FaInfoCircle className="inline mr-2 text-blue-600"/>; break;
        case 'error': default: typeStyle = 'bg-red-100 border-red-300 text-red-700'; icon = <FaExclamationTriangle className="inline mr-2 text-red-600"/>; break;
    }
    if (!message) return null;
    return ( <div className={`${baseStyle} ${typeStyle}`} role="alert"> {icon} <span className="block sm:inline align-middle mr-6">{message}</span> {onClose && ( <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-3 py-3 focus:outline-none" aria-label="Close"><FaTimes className={`h-4 w-4 ${type==='error' ? 'text-red-500' : type==='success' ? 'text-green-500' : type==='warning' ? 'text-yellow-500' : 'text-blue-500'}`}/></button> )} </div> );
};
const SimpleTable = ({ headers, rows, maxRows = 5 }) => {
    if (!headers || headers.length === 0 || !rows || rows.length === 0) return <p className="text-xs text-gray-500 italic">No data to display.</p>;
    const displayedRows = rows.slice(0, maxRows);
    return (
        <div className="overflow-x-auto max-h-60 border rounded bg-white text-xs shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10"><tr>{headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">{displayedRows.map((row, rIdx) => (<tr key={rIdx} className="hover:bg-gray-50">{headers.map(h => (<td key={`${rIdx}-${h}`} className="px-3 py-2 whitespace-nowrap text-gray-700 truncate max-w-[150px]" title={row[h]}>{String(row[h])}</td>))}</tr>))}</tbody>
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
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    // FASE 2: Suggerimenti e Configurazione
    const [analysisSessionId, setAnalysisSessionId] = useState(null);
    const [datasetPreview, setDatasetPreview] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState(null); // Contiene { algorithm_key, task_type, ... }
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [taskTypePreference, setTaskTypePreference] = useState(''); // "regression" o "classification"

    // FASE 3: Esecuzione e Risultati
    const [analysisJobId, setAnalysisJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState('');
    const [jobResults, setJobResults] = useState(null);
    const [plotData, setPlotData] = useState(null);
    const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
    const [isPollingResults, setIsPollingResults] = useState(false);

    // UI State
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentStep, setCurrentStep] = useState(1); // 1: Select, 2: Configure, 3: Results

    const pollingIntervalRef = useRef(null);

    // Fetch Risorse CSV
    const fetchCsvResources = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingResources(true); setError('');
        try {
            const resources = await listUserResources({ status: 'COMPLETED', mime_type: 'text/csv' });
            setAvailableCsvResources(Array.isArray(resources) ? resources : []);
        } catch (err) { setError('Failed to load CSV resources.'); console.error(err); }
        finally { setIsLoadingResources(false); }
    }, [isAuthenticated]);

    useEffect(() => { fetchCsvResources(); }, [fetchCsvResources]);

    // Gestione Upload
    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setUploadedFile(acceptedFiles[0]); setSelectedResourceId('');
            setError(''); setSuccess(''); setCurrentStep(1); resetAnalysisState(false); // Resetta ma non il file
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'text/csv': ['.csv']}, maxSize: 20 * 1024 * 1024, multiple: false });

    // Reset per nuova analisi
    const resetAnalysisState = (resetFileSelection = true) => {
        setAnalysisSessionId(null); setDatasetPreview(null); setAiSuggestions([]);
        setSelectedAlgorithm(null); setSelectedFeatures([]); setSelectedTarget('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        setError(''); setSuccess('');
        if (resetFileSelection) {
            setSelectedResourceId(''); setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // FASE 1: Ottieni Suggerimenti
    const handleSuggestAlgorithm = async () => {
        if (!selectedResourceId && !uploadedFile) {
            setError('Please select an existing CSV resource or upload a new one.'); return;
        }
        setIsSuggesting(true); setError(''); setSuccess(''); resetAnalysisState(false);
        try {
            let payload;
            if (uploadedFile) {
                payload = new FormData();
                payload.append('file', uploadedFile);
            } else {
                payload = { resource_id: selectedResourceId };
            }
            if (taskTypePreference) {
                if (payload instanceof FormData) payload.append('task_type_preference', taskTypePreference);
                else payload.task_type_preference = taskTypePreference;
            }

            // --- LOG DI DEBUG CRUCIALE ---
            console.log("DataAnalysisPage: BEFORE suggestAlgorithm call");
            console.log("selectedResourceId:", selectedResourceId);
            console.log("uploadedFile:", uploadedFile);
            console.log("Payload being sent:", payload);
            if (payload instanceof FormData) {
                for (let pair of payload.entries()) { console.log(" FormData Entry:", pair[0], pair[1]); }
            }
            // --- FINE LOG ---

            const response = await suggestAlgorithm(payload);

            setAnalysisSessionId(response.analysis_session_id);
            setDatasetPreview(response.dataset_preview);
            setAiSuggestions(response.suggestions || []);
            setSuccess('Suggestions received!'); setCurrentStep(2);
            if (response.suggestions && response.suggestions.length > 0) {
                const firstSugg = response.suggestions[0];
                setSelectedAlgorithm(firstSugg);
                setSelectedFeatures(firstSugg.suggested_features?.slice(0,1) || []);
                setSelectedTarget(firstSugg.suggested_target || '');
            }
        } catch (err) { setError(err.response?.data?.error || 'Failed to get suggestions.'); }
        finally { setIsSuggesting(false); }
    };

    // FASE 2: Esegui Analisi
    const handleRunAnalysis = async () => {
        if (!analysisSessionId || !selectedAlgorithm || selectedFeatures.length === 0 || !selectedTarget) { setError('Configure analysis first.'); return; }
        setIsRunningAnalysis(true); setError(''); setSuccess('');
        setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);
        try {
            const payload = {
                analysis_session_id: analysisSessionId,
                selected_algorithm_key: selectedAlgorithm.algorithm_key,
                selected_features: selectedFeatures, selected_target: selectedTarget,
                task_type: selectedAlgorithm.task_type, // algorithm_params: {}
            };
            const response = await runAnalysis(payload);
            setAnalysisJobId(response.analysis_job_id); setJobStatus(response.status);
            setSuccess('Analysis submitted! Monitoring...'); setCurrentStep(3);
            startJobPolling(response.analysis_job_id);
        } catch (err) { setError(err.response?.data?.error || 'Failed to start analysis.');
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
                    setJobResults(data.results); setPlotData(data.plot_data);
                    setSuccess('Analysis completed!');
                } else if (data.status === 'FAILED') {
                    stopJobPolling(); setIsPollingResults(false);
                    setError(`Analysis failed: ${data.error_message || 'Unknown error'}`);
                }
            } catch (err) {
                console.error(`Polling error for ${jobId}:`, err);
                if (err.response?.status === 404) { setError("Job not found."); stopJobPolling(); setIsPollingResults(false); }
            }
        }, 3000);
    }, [stopJobPolling]);

    useEffect(() => { return () => stopJobPolling(); }, [stopJobPolling]);

    // Gestione selezione multipla features
    const handleFeatureChange = (e) => {
        const values = Array.from(e.target.selectedOptions, option => option.value);
        setSelectedFeatures(values);
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-800">Data Analysis Workbench</h1>
                {/* <button onClick={() => {/* TODO: show tutorial }} className="text-indigo-600"><FaInfoCircle size={20}/></button> */}
            </div>

            {error && <Alert type="error" message={error} onClose={() => setError('')} />}
            {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* FASE 1: Selezione/Upload Dataset */}
            <div className={`p-6 rounded-lg shadow-md border ${currentStep === 1 ? 'border-indigo-500' : 'border-gray-200'} bg-white`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">Step 1: Select or Upload Dataset (CSV)</h2>
                    {currentStep > 1 && <button onClick={() => { setCurrentStep(1); resetAnalysisState(true);}} className="text-xs text-indigo-600 hover:underline">Change Dataset</button>}
                </div>

                {currentStep === 1 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 items-start">
                            <div>
                                <label htmlFor="resourceSelect" className="block text-sm font-medium text-gray-700 mb-1">Select from My Resources:</label>
                                {isLoadingResources ? <Spinner /> : ( <select id="resourceSelect" value={selectedResourceId} onChange={(e) => { setSelectedResourceId(e.target.value); setUploadedFile(null); }} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" disabled={availableCsvResources.length === 0}> <option value="">-- Select a CSV --</option> {availableCsvResources.map(r => ( <option key={r.id} value={r.id}>{r.name || r.original_filename}</option> ))} </select> )}
                                {availableCsvResources.length === 0 && !isLoadingResources && <p className="text-xs text-gray-500 mt-1">No completed CSVs found. Upload one.</p>}
                            </div>
                            <div {...getRootProps()} className={`p-6 border-2 ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-lg text-center cursor-pointer transition-colors`}>
                                <input {...getInputProps()} /> <FaUpload className={`mx-auto h-10 w-10 ${isDragActive ? 'text-indigo-500' : 'text-gray-400'} mb-2`} />
                                {isDragActive ? <p className="text-sm text-indigo-600">Drop CSV here...</p> : <p className="text-sm text-gray-600">Drag & drop, or click to upload</p>}
                                {uploadedFile && <p className="text-xs text-green-600 mt-1">Selected: {uploadedFile.name}</p>}
                            </div>
                        </div>
                         <div>
                            <label htmlFor="taskTypePreference" className="block text-sm font-medium text-gray-700 mb-1">Task Type Preference (Optional):</label>
                            <select id="taskTypePreference" value={taskTypePreference} onChange={(e) => setTaskTypePreference(e.target.value)} className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">Any</option> <option value="regression">Regression</option> <option value="classification">Classification</option>
                            </select>
                        </div>
                        <button onClick={handleSuggestAlgorithm} disabled={isSuggesting || (!selectedResourceId && !uploadedFile)} className="mt-4 w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center">
                            {isSuggesting && <Spinner small color="white" />} <FaSearch className="mr-2" /> Analyze & Get Suggestions
                        </button>
                    </>
                )}
                {currentStep > 1 && datasetPreview && (
                     <div className="text-sm text-gray-600">
                         <p>Using dataset: <strong>{uploadedFile ? uploadedFile.name : availableCsvResources.find(r=>r.id === selectedResourceId)?.name || 'Selected Resource'}</strong></p>
                         <p>Preview: {datasetPreview.num_cols} columns, {datasetPreview.num_rows_sample} sample rows shown.</p>
                     </div>
                )}
            </div>

            {/* FASE 2: Dataset Preview, Suggerimenti AI e Configurazione Analisi */}
            {currentStep === 2 && analysisSessionId && datasetPreview && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Step 2: Configure Analysis</h2>
                        <button onClick={() => setCurrentStep(1)} className="text-xs text-indigo-600 hover:underline">Back to Dataset Selection</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div>
                             <h3 className="text-lg font-medium text-gray-600 mb-2">Dataset Preview</h3>
                             <SimpleTable headers={datasetPreview.headers} rows={datasetPreview.sample_rows} maxRows={5} />
                        </div>
                        <div>
                             <h3 className="text-lg font-medium text-gray-600 mb-2">AI Algorithm Suggestions</h3>
                             {aiSuggestions.length > 0 ? (
                                <select value={selectedAlgorithm?.algorithm_key || ''} className="w-full p-2 border border-gray-300 rounded-md bg-white mb-3 text-sm" onChange={(e) => { const sugg = aiSuggestions.find(s => s.algorithm_key === e.target.value); setSelectedAlgorithm(sugg); setSelectedFeatures(sugg?.suggested_features?.slice(0,1) || []); setSelectedTarget(sugg?.suggested_target || ''); }}> <option value="">-- Select an AI suggestion --</option> {aiSuggestions.map(s => ( <option key={s.algorithm_key} value={s.algorithm_key}>{s.algorithm_name} ({s.task_type})</option> ))} </select>
                             ) : (<p className="text-sm text-gray-500 italic mb-3">No AI suggestions, select manually.</p>)}
                             {selectedAlgorithm && <p className="text-xs text-gray-600 bg-indigo-50 p-2 rounded border border-indigo-200 mb-3"><strong>Motivation:</strong> {selectedAlgorithm.motivation}</p>}

                            {datasetPreview.headers.length > 0 && (
                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="features" className="block text-sm font-medium text-gray-700">Feature(s) (X):</label>
                                        <select multiple id="features" value={selectedFeatures} onChange={handleFeatureChange} className="w-full p-2 border border-gray-300 rounded-md bg-white h-24 text-sm">
                                            {datasetPreview.headers.filter(h => h !== selectedTarget).map(h => (<option key={h} value={h}>{h}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="target" className="block text-sm font-medium text-gray-700">Target (Y):</label>
                                        <select id="target" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"> <option value="">-- Select Target --</option> {datasetPreview.headers.filter(h => !selectedFeatures.includes(h)).map(h => (<option key={h} value={h}>{h}</option>))} </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={handleRunAnalysis} disabled={isRunningAnalysis || !selectedAlgorithm || selectedFeatures.length === 0 || !selectedTarget} className="mt-6 w-full sm:w-auto px-6 py-2 bg-green-600 text-white font-semibold rounded-md shadow hover:bg-green-700 disabled:opacity-50 flex items-center justify-center">
                        {isRunningAnalysis && <Spinner small color="white" />} <FaTable className="mr-2" /> Run Analysis: {selectedAlgorithm?.algorithm_name || ''}
                    </button>
                </div>
            )}

            {/* FASE 3: Risultati Analisi */}
            {currentStep === 3 && analysisJobId && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Step 3: Analysis Results</h2>
                         <button onClick={() => { setCurrentStep(2); /* Non resettare tutto, solo job results */ setAnalysisJobId(null); setJobStatus(''); setJobResults(null); setPlotData(null);}} className="text-xs text-indigo-600 hover:underline">Configure New Analysis</button>
                    </div>
                    <p className="mb-2 text-sm">Job ID: <span className="font-mono text-xs">{analysisJobId}</span></p>
                    <p className="mb-4 text-sm">Status: <span className={`ml-2 font-medium px-2 py-0.5 rounded text-xs ${jobStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : jobStatus === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{jobStatus || 'Fetching...'}</span> {(isPollingResults || jobStatus === 'PROCESSING') && <Spinner small color="indigo-500 ml-2"/>}</p>

                    {jobStatus === 'COMPLETED' && jobResults && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-gray-600">Metrics:</h3>
                            <pre className="bg-gray-50 p-3 rounded border text-xs overflow-x-auto">{JSON.stringify(jobResults, null, 2)}</pre>
                            {plotData && (plotData.type === 'regression_scatter' || plotData.type === 'classification_predictions_histogram') && (
                                <div>
                                    <h3 className="text-lg font-medium text-gray-600 mt-4 mb-2">Visualization</h3>
                                    <div className="relative h-80 md:h-96 border rounded p-1 bg-gray-50">
                                        <Plot
                                            data={plotData.type === 'regression_scatter' ? [
                                                { type: 'scatter', mode: 'markers', x: plotData.data.actual_vs_predicted.map(p=>p.actual), y: plotData.data.actual_vs_predicted.map(p=>p.predicted), name: 'Actual vs. Predicted', marker: {size: 6, color: 'rgba(30,100,200,0.7)'} },
                                                { type: 'scatter', mode: 'lines', x: plotData.data.ideal_line.map(p=>p.x), y: plotData.data.ideal_line.map(p=>p.y), name: 'Ideal (y=x)', line: {dash: 'dash', color: 'rgba(200,50,50,0.8)', width:2} }
                                            ] : [{ // classification_predictions_histogram
                                                type: 'bar',
                                                x: plotData.data.map(p => p.class),
                                                y: plotData.data.map(p => p.count),
                                            }]}
                                            layout={{ title: plotData.layout.title, xaxis: { title: plotData.layout.xaxis_title }, yaxis: { title: plotData.layout.yaxis_title }, autosize: true, margin: { l: 50, r: 20, b: 50, t: 50, pad: 4 } }}
                                            useResizeHandler={true} className="w-full h-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {jobStatus === 'FAILED' && jobResults?.error_message && ( <Alert type="error" message={`Analysis Failed: ${jobResults.error_message}`} /> )}
                </div>
            )}
        </div>
    );
};

export default DataAnalysisPage;