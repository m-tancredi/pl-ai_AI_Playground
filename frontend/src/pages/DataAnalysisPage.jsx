// src/pages/DataAnalysisPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse'; // npm install papaparse
import { FaUpload, FaSpinner, FaTimes, FaBrain, FaChartBar, FaTable, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaFileCsv, FaSearch, FaRedo, FaSave, FaPlay, FaChevronRight, FaMagic, FaCheck, FaCloudDownloadAlt, FaQuestionCircle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { listUserResources, uploadResource as uploadResourceViaRM } from '../services/resourceManagerService';
import { suggestAlgorithm, runAnalysis, getAnalysisResults, predictInstance, createSyntheticCsvJob, getSyntheticCsvJobStatus } from '../services/dataAnalysisService';
import Plot from 'react-plotly.js';

// Importa componenti figli
import ResourceCard from '../components/ResourceCard';
import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal';
import EditableDataTable from '../components/EditableDataTable'; // Assumendo che tu abbia creato questo

// --- COMPONENTI UI MODERNI CON STILE CHATBOT ---
// Card moderna con ombra profonda e hover - stile chatbot
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-xl p-8 mb-8 transition-all duration-300 hover:shadow-2xl ${className}`}>{children}</div>
);
// Header card con icona grande - stile chatbot
const CardHeader = ({ title, icon, right }) => (
  <div className="flex items-center justify-between mb-8">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
    </div>
    {right}
  </div>
);
// Bottoni grandi e moderni - stile chatbot
const ButtonPrimary = ({ children, ...props }) => (
  <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);
const ButtonSecondary = ({ children, ...props }) => (
  <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);
// Step progress bar moderna - stile chatbot
const StepProgress = ({ currentStep }) => {
  const steps = [
    { label: 'Dataset', icon: <FaTable /> },
    { label: 'Configura', icon: <FaBrain /> },
    { label: 'Risultati', icon: <FaChartBar /> },
  ];
  return (
    <div className="flex items-center justify-center gap-0 md:gap-8 mb-12">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <div className={`flex flex-col items-center transition-all duration-300 ${currentStep === idx + 1 ? 'text-purple-600 scale-110' : 'text-gray-300 scale-100'}`}> 
            <div className={`rounded-full border-4 ${currentStep === idx + 1 ? 'border-purple-600 bg-purple-50 shadow-xl' : 'border-gray-200 bg-white'} w-16 h-16 flex items-center justify-center text-2xl mb-2 transition-all duration-300`}>{step.icon}</div>
            <span className="text-sm font-bold uppercase tracking-wider mt-1">{step.label}</span>
          </div>
          {idx < steps.length - 1 && <FaChevronRight className="mx-4 text-gray-300 text-2xl" />}
        </React.Fragment>
      ))}
    </div>
  );
};
// Modale elegante con overlay sfumato e animazione - stile chatbot
const Modal = ({ show, onClose, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl">
          <FaTimes />
        </button>
        {children}
      </div>
    </div>
  );
};
// Alert moderno con icona grande - stile chatbot
const Alert = ({ type = 'error', message, onClose }) => {
  const colorClasses = {
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    error: 'bg-red-50 border-red-200 text-red-700'
  };
  const IconComponent = type === 'success' ? FaCheckCircle : FaExclamationTriangle;
  const iconColor = type === 'success' ? 'text-green-500' : type === 'warning' ? 'text-yellow-500' : 'text-red-500';
  
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
// Spinner moderno - stile chatbot
const Spinner = ({ small = false, color = 'purple-500' }) => (
  <div className={`inline-block animate-spin rounded-full border-t-4 border-b-4 border-${color} ${small ? 'h-5 w-5 mr-2' : 'h-6 w-6 mr-2'} align-middle`}></div>
);

// Frasi magiche per la barra di caricamento
const MAGIC_WORDS = [
  'Sto evocando i dati...',
  'Mescolo colonne e righe...',
  "Chiamo l'AI degli gnomi...",
  'Aggiungo un pizzico di magia...',
  'Sto generando pattern...',
  'Rendo i dati unici...',
  'Quasi pronto...'
];

// Funzione di log per debug (evita ReferenceError)
const logMessage = (msg) => {
  if (window && window.console) {
    console.log(msg);
  }
};

// Tabella metriche moderna - stile chatbot
const MetricTable = ({ metrics }) => {
  if (!metrics) return null;
  return (
    <table className="min-w-full text-sm border rounded-xl bg-white shadow overflow-hidden">
      <tbody>
        {Object.entries(metrics).map(([key, value]) => {
          if (Array.isArray(value)) {
            // Confusion matrix o array: visualizza come tabella
            return (
              <tr key={key}>
                <td className="font-bold align-top pr-4 py-3 text-gray-700">{key}</td>
                <td>
                  <table className="border text-xs rounded-lg overflow-hidden">
                    <tbody>
                      {value.map((row, i) => (
                        <tr key={i} className="even:bg-gray-50">
                          {Array.isArray(row) ? row.map((cell, j) => (
                            <td key={j} className="border px-3 py-2 text-center font-mono">{cell}</td>
                          )) : <td className="border px-3 py-2 text-center font-mono">{row}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            );
          }
          // Badge per valori numerici - stile chatbot
          return (
            <tr key={key} className="even:bg-purple-50">
              <td className="font-bold pr-4 py-3 text-gray-700">{key}</td>
              <td>
                <span className="inline-block bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-mono shadow-sm">
                  {typeof value === 'number' ? value.toFixed(4) : value}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// Tabella confronto suggerimenti AI interattiva - stile chatbot
const AISuggestionTable = ({ suggestions, bestSuggestion }) => {
  const [sortKey, setSortKey] = React.useState('');
  const [sortDir, setSortDir] = React.useState('desc');
  const [taskTypeFilter, setTaskTypeFilter] = React.useState('');

  // Estrai metriche principali da motivazione
  const parseMetrics = (motivation, taskType) => {
    const m = motivation || '';
    if (taskType === 'regression') {
      const r2 = parseFloat((m.match(/R2=([0-9\.-]+)/i)||[])[1]);
      const mse = parseFloat((m.match(/MSE=([0-9\.-]+)/i)||[])[1]);
      return { r2, mse };
    } else if (taskType === 'classification') {
      const acc = parseFloat((m.match(/Accuracy=([0-9\.-]+)/i)||[])[1]);
      const f1 = parseFloat((m.match(/F1_macro=([0-9\.-]+)/i)||[])[1]);
      return { acc, f1 };
    }
    return {};
  };

  // Applica filtri
  let filtered = suggestions;
  if (taskTypeFilter) filtered = filtered.filter(s => s.task_type === taskTypeFilter);

  // Costruisci array con metriche
  const rows = filtered.map(s => {
    const metrics = parseMetrics(s.motivation, s.task_type);
    return { ...s, ...metrics };
  });

  // Ordinamento
  const sorters = {
    'r2': (a, b) => (b.r2 ?? -Infinity) - (a.r2 ?? -Infinity),
    'mse': (a, b) => (a.mse ?? Infinity) - (b.mse ?? Infinity),
    'acc': (a, b) => (b.acc ?? -Infinity) - (a.acc ?? -Infinity),
    'f1': (a, b) => (b.f1 ?? -Infinity) - (a.f1 ?? -Infinity),
    'algorithm_name': (a, b) => a.algorithm_name.localeCompare(b.algorithm_name),
    'task_type': (a, b) => a.task_type.localeCompare(b.task_type),
  };
  let sortedRows = [...rows];
  if (sortKey && sorters[sortKey]) {
    sortedRows.sort(sorters[sortKey]);
    if (sortDir === 'asc') sortedRows.reverse();
  }

  // Evidenzia il migliore
  const isBest = (row) => bestSuggestion && row.algorithm_key === bestSuggestion.algorithm_key && row.task_type === bestSuggestion.task_type;

  // Colonne
  const columns = [
    { key: 'algorithm_name', label: 'Algoritmo' },
    { key: 'task_type', label: 'Tipo' },
    { key: 'r2', label: 'R2' },
    { key: 'mse', label: 'MSE' },
    { key: 'acc', label: 'Accuracy' },
    { key: 'f1', label: 'F1_macro' },
    { key: 'motivation', label: 'Motivazione' },
  ];

    return (
    <div className="overflow-x-auto mt-4">
      <div className="flex items-center gap-4 mb-3">
        <label className="text-sm font-semibold text-gray-700">Filtra per tipo:</label>
        <select className="p-2 border-0 rounded-xl bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" value={taskTypeFilter} onChange={e => setTaskTypeFilter(e.target.value)}>
          <option value="">Tutti</option>
          <option value="regression">Regression</option>
          <option value="classification">Classification</option>
        </select>
      </div>
      <table className="min-w-full text-sm border rounded-xl bg-white shadow overflow-hidden">
        <thead>
          <tr className="bg-purple-50">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left cursor-pointer select-none font-semibold text-purple-700 hover:bg-purple-100 transition-colors" onClick={() => {
                if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                else { setSortKey(col.key); setSortDir('desc'); }
              }}>
                {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr key={i} className={
              `${isBest(row) ? 'bg-green-100 border-2 border-green-400' : (i%2===0 ? 'bg-white' : 'bg-gray-50')} hover:bg-purple-50 transition-colors`
            }>
              <td className="px-4 py-3 font-bold text-purple-700">{row.algorithm_name}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {row.task_type}
                </span>
              </td>
              <td className="px-4 py-3 text-center font-mono">{row.r2 !== undefined && !isNaN(row.r2) ? row.r2.toFixed(3) : '-'}</td>
              <td className="px-4 py-3 text-center font-mono">{row.mse !== undefined && !isNaN(row.mse) ? row.mse.toFixed(3) : '-'}</td>
              <td className="px-4 py-3 text-center font-mono">{row.acc !== undefined && !isNaN(row.acc) ? (row.acc*100).toFixed(1)+'%' : '-'}</td>
              <td className="px-4 py-3 text-center font-mono">{row.f1 !== undefined && !isNaN(row.f1) ? row.f1.toFixed(3) : '-'}</td>
              <td className="px-4 py-3 max-w-xs text-gray-600 text-xs">{row.motivation}</td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
    );
};

// Utility per etichetta leggibile del tipo di plot
const plotTypeLabels = {
  regression_scatter_xy: 'Scatter X vs Y',
  regression_surface_3d: 'Superficie 3D',
  regression_actual_vs_predicted: 'Actual vs Predicted',
  regression_residuals_histogram: 'Istogramma residui',
  classification_scatter_2d: 'Scatter 2D',
  classification_scatter_3d: 'Scatter 3D',
  classification_pca_2d: 'PCA 2D',
  classification_pca_3d: 'PCA 3D',
  classification_predictions_histogram: 'Istogramma predizioni',
};
const plotTypeDescriptions = {
  regression_scatter_xy: 'Scatter tra la feature X e il target Y, con linea del modello se disponibile.',
  regression_surface_3d: 'Superficie 3D: due feature numeriche e il target predetto.',
  regression_actual_vs_predicted: 'Scatter tra valori reali e predetti dal modello.',
  regression_residuals_histogram: 'Istogramma della distribuzione dei residui (errori di predizione).',
  classification_scatter_2d: 'Scatter 2D delle istanze, colorate per classe predetta.',
  classification_scatter_3d: 'Scatter 3D delle istanze, colorate per classe predetta.',
  classification_pca_2d: 'Scatter 2D dopo riduzione dimensionale (PCA) delle feature.',
  classification_pca_3d: 'Scatter 3D dopo PCA delle feature.',
  classification_predictions_histogram: 'Istogramma della distribuzione delle classi predette.',
};

const plotTypeIcons = {
  regression_scatter_xy: '🟢',
  regression_surface_3d: '🟩',
  regression_actual_vs_predicted: '🔵',
  regression_residuals_histogram: '📊',
  classification_scatter_2d: '🟠',
  classification_scatter_3d: '🟣',
  classification_pca_2d: '🟡',
  classification_pca_3d: '🟤',
  classification_predictions_histogram: '📈',
};

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

    // --- Stato per CSV sintetico ---
    const [showSyntheticModal, setShowSyntheticModal] = useState(false);
    const [syntheticPrompt, setSyntheticPrompt] = useState('');
    const [syntheticNumRows, setSyntheticNumRows] = useState(100);
    const [syntheticDatasetName, setSyntheticDatasetName] = useState('');
    const [syntheticJobId, setSyntheticJobId] = useState(null);
    const [syntheticJobStatus, setSyntheticJobStatus] = useState(null);
    const [isCreatingSynthetic, setIsCreatingSynthetic] = useState(false);
    const [syntheticError, setSyntheticError] = useState('');
    const syntheticPollingRef = useRef(null);

    const [magicWordIdx, setMagicWordIdx] = useState(0);
    const [fakeProgress, setFakeProgress] = useState(0);
    const magicIntervalRef = useRef(null);
    const progressIntervalRef = useRef(null);

    const isSyntheticInProgress =
      isCreatingSynthetic ||
      (syntheticJobStatus && syntheticJobStatus.status !== 'COMPLETED' && syntheticJobStatus.status !== 'FAILED');

    // Stato per modale dataset completo
    const [showFullDatasetModal, setShowFullDatasetModal] = useState(false);
    const [fullDataset, setFullDataset] = useState([]);
    const [fullDatasetHeaders, setFullDatasetHeaders] = useState([]);
    const [isLoadingFullDataset, setIsLoadingFullDataset] = useState(false);
    const [fullDatasetError, setFullDatasetError] = useState('');
    const [isSavingFullDataset, setIsSavingFullDataset] = useState(false);
    const [fullDatasetChanged, setFullDatasetChanged] = useState(false);
    const [originalFullDataset, setOriginalFullDataset] = useState([]);

    // Stato per barra di avanzamento analisi
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const pollingStepRef = useRef(0);
    // Stato per mostrare i risultati solo dopo la barra
    const [showResults, setShowResults] = useState(false);

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
            const filteredForAnalysis = (Array.isArray(resources) ? resources : []).filter(r => {
                const mime = r.mime_type?.toLowerCase() || '';
                const filename = r.original_filename?.toLowerCase() || '';
                // Accetta csv, xls, xlsx
                const isCsvOrExcel =
                    mime === 'text/csv' ||
                    mime === 'application/vnd.ms-excel' ||
                    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    filename.endsWith('.csv') ||
                    filename.endsWith('.xls') ||
                    filename.endsWith('.xlsx');
                return isCsvOrExcel;
            });
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
            if (response.suggestions && response.suggestions.length > 0) {
                // Se l'utente ha espresso una preferenza, scegli il migliore tra quelli con quel task_type
                let filteredSuggestions = response.suggestions;
                if (taskTypePreference) {
                  filteredSuggestions = response.suggestions.filter(s => s.task_type === taskTypePreference);
                  if (filteredSuggestions.length === 0) filteredSuggestions = response.suggestions;
                }
                // Ordina i suggerimenti in base alla metrica migliore (R2, accuracy, F1, MSE)
                let bestSuggestion = filteredSuggestions[0];
                let bestScore = -Infinity;
                for (const s of filteredSuggestions) {
                  // Cerca la metrica migliore nella motivazione (R2, accuracy, F1, MSE)
                  let score = 0;
                  const m = s.motivation || '';
                  if (s.task_type === 'regression') {
                    const r2 = parseFloat((m.match(/R2=([0-9\.-]+)/i)||[])[1]);
                    if (!isNaN(r2)) score = r2;
                    else {
                      const mse = parseFloat((m.match(/MSE=([0-9\.-]+)/i)||[])[1]);
                      if (!isNaN(mse)) score = -mse;
                    }
                  } else if (s.task_type === 'classification') {
                    const acc = parseFloat((m.match(/Accuracy=([0-9\.-]+)/i)||[])[1]);
                    if (!isNaN(acc)) score = acc;
                    else {
                      const f1 = parseFloat((m.match(/F1_macro=([0-9\.-]+)/i)||[])[1]);
                      if (!isNaN(f1)) score = f1;
                    }
                  }
                  if (score > bestScore) {
                    bestScore = score;
                    bestSuggestion = s;
                  }
                }
                setSelectedAlgorithm(bestSuggestion);
                setSelectedFeatures(bestSuggestion.suggested_features?.slice(0, 1) || []);
                setSelectedTarget(bestSuggestion.suggested_target || '');
                setAiSuggestions(response.suggestions);
            } else {
                setSelectedAlgorithm(null);
                setSelectedFeatures([]);
                setSelectedTarget('');
            }
        } catch (err) { setError(err.response?.data?.error || 'Failed to get suggestions.');
        } finally { setIsSuggesting(false); }
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
    const [selectedPlotIdx, setSelectedPlotIdx] = useState(0);

    // Aggiorna selectedPlotIdx quando arrivano nuovi plot
    useEffect(() => {
        setSelectedPlotIdx(0);
    }, [plotData]);

    const chartDataAndOptions = useMemo(() => {
        if (!jobStatus || jobStatus !== 'COMPLETED' || !jobResults || !plotData) return null;
        // Se il backend restituisce un array di plot intelligenti
        const plotArray = Array.isArray(plotData) ? plotData : (plotData?.plots || [plotData]);
        if (!plotArray || plotArray.length === 0) return null;
        const plot = plotArray[selectedPlotIdx] || plotArray[0];
        let dataForPlotly = [];
        let layoutForPlotly = { autosize: true, margin: { l: 50, r: 20, b: 50, t: 60, pad: 4 }, legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 }, showlegend: true };
        // ... (logica di conversione plot -> plotly, vedi sotto)
        // --- REGRESSIONE ---
        if (plot.type === 'regression_scatter_xy') {
            const algoKey = selectedAlgorithm?.algorithm_key;
            // Definisci un colore base e un nome per il modello
            let modelColor = 'blue'; // Colore di default per lineare
            let lineName = 'Linear regression';
            let pointSymbol = 'diamond'; // Simbolo di default per i punti

            if (algoKey === 'polynomial_regression') {
                modelColor = 'red';
                lineName = 'Polynomial regression';
                pointSymbol = 'circle';
            } else if (algoKey === 'decision_tree_regressor') {
                modelColor = 'green';
                lineName = 'Decision Tree';
                pointSymbol = 'cross'; 
            } else if (algoKey === 'random_forest_regressor') {
                modelColor = 'orange';
                lineName = 'Random Forest';
                pointSymbol = 'star'; 
            } else if (algoKey === 'svr') {
                modelColor = 'purple';
                lineName = 'SVR';
                pointSymbol = 'triangle-up';
            }
            // Aggiungere altri 'else if' per altri algoritmi di regressione se necessario

            dataForPlotly.push({
              type: 'scatter',
              mode: 'markers',
              x: plot.data.x,
              y: plot.data.y_true,
              name: 'Data points',
              marker: {
                size: 9,
                color: modelColor, // Usa modelColor per i punti
                symbol: pointSymbol // Usa pointSymbol definito in base al modello
              }
            });

            if (plot.data.model_line) {
                dataForPlotly.push({
                  type: 'scatter',
                  mode: 'lines',
                  x: plot.data.model_line.x,
                  y: plot.data.model_line.y,
                  name: lineName,
                  line: { color: modelColor, width: 3 } // Usa modelColor per la linea
                });
            } else {
                // Logga un avviso se la linea del modello è attesa ma mancante.
                // Questo non risolve il problema visivo ma aiuta il debug.
                console.warn(`[DataAnalysisPage] Model line data (plot.data.model_line) is missing for plot type ${plot.type} with algorithm ${algoKey}. Model line will not be rendered.`);
            }
            layoutForPlotly.title = plot.layout.title;
            layoutForPlotly.xaxis = { title: plot.layout.xaxis_title };
            layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        } else if (plot.type === 'regression_surface_3d') {
            dataForPlotly.push({ type: 'scatter3d', mode: 'markers', x: plot.data.x1, y: plot.data.x2, z: plot.data.y_true, name: 'Valori reali', marker: { size: 5, color: 'blue', opacity: 0.7 } });
            dataForPlotly.push({ type: 'scatter3d', mode: 'markers', x: plot.data.x1, y: plot.data.x2, z: plot.data.y_pred, name: 'Predetti', marker: { size: 5, color: 'orange', opacity: 0.7 } });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.scene = plot.layout.scene;
        } else if (plot.type === 'regression_actual_vs_predicted') {
            dataForPlotly.push({ type: 'scatter', mode: 'markers', x: plot.data.actual, y: plot.data.predicted, name: 'Actual vs Predicted', marker: { size: 7, color: 'rgba(30,100,200,0.7)' } });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.xaxis = { title: plot.layout.xaxis_title }; layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        } else if (plot.type === 'regression_residuals_histogram') {
            dataForPlotly.push({ type: 'histogram', x: plot.data.residuals, name: 'Residui', marker: { color: 'rgba(100,30,200,0.7)' } });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.xaxis = { title: plot.layout.xaxis_title }; layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        }
        // --- CLASSIFICAZIONE ---
        else if (plot.type === 'classification_scatter_2d') {
            dataForPlotly.push({ type: 'scatter', mode: 'markers', x: plot.data.x1, y: plot.data.x2 || Array(plot.data.x1.length).fill(0), name: 'Predette', marker: { size: 7, color: plot.data.y_pred, colorscale: 'Viridis', showscale: true, colorbar: { title: 'Classe predetta' } }, text: plot.data.y_pred.map(c => `Classe: ${c}`) });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.xaxis = { title: plot.layout.xaxis_title }; layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        } else if (plot.type === 'classification_scatter_3d') {
            dataForPlotly.push({ type: 'scatter3d', mode: 'markers', x: plot.data.x1, y: plot.data.x2, z: plot.data.x3, name: 'Predette', marker: { size: 5, color: plot.data.y_pred, colorscale: 'Viridis', opacity: 0.7, colorbar: { title: 'Classe predetta' } }, text: plot.data.y_pred.map(c => `Classe: ${c}`) });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.scene = plot.layout.scene;
        } else if (plot.type === 'classification_pca_2d') {
            dataForPlotly.push({ type: 'scatter', mode: 'markers', x: plot.data.x1, y: plot.data.x2, name: 'Predette', marker: { size: 7, color: plot.data.y_pred, colorscale: 'Viridis', showscale: true, colorbar: { title: 'Classe predetta' } }, text: plot.data.y_pred.map(c => `Classe: ${c}`) });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.xaxis = { title: plot.layout.xaxis_title }; layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        } else if (plot.type === 'classification_pca_3d') {
            dataForPlotly.push({ type: 'scatter3d', mode: 'markers', x: plot.data.x1, y: plot.data.x2, z: plot.data.x3, name: 'Predette', marker: { size: 5, color: plot.data.y_pred, colorscale: 'Viridis', opacity: 0.7, colorbar: { title: 'Classe predetta' } }, text: plot.data.y_pred.map(c => `Classe: ${c}`) });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.scene = plot.layout.scene;
        } else if (plot.type === 'classification_predictions_histogram') {
            dataForPlotly.push({ type: 'bar', x: plot.data.map(d => d.class), y: plot.data.map(d => d.count), marker: { color: plot.data.map((_, i) => `hsl(${i * (360 / (plot.data.length || 1))}, 70%, 60%)`) } });
            layoutForPlotly.title = plot.layout.title; layoutForPlotly.xaxis = { title: plot.layout.xaxis_title }; layoutForPlotly.yaxis = { title: plot.layout.yaxis_title };
        }
        return (dataForPlotly.length > 0) ? { data: dataForPlotly, layout: layoutForPlotly, plotType: plot.type } : null;
    }, [jobStatus, jobResults, plotData, regressionPredictFeatureValue, regressionPredictionResult, classificationPredictedPoint, selectedPlotIdx, selectedAlgorithm]);

    // --- Funzione per creare job sintetico ---
    const handleCreateSyntheticCsv = async () => {
        setIsCreatingSynthetic(true);
        setSyntheticError('');
        setSyntheticJobStatus(null);
        try {
            const payload = {
                user_prompt: syntheticPrompt,
                num_rows: syntheticNumRows,
                dataset_name: syntheticDatasetName
            };
            const res = await createSyntheticCsvJob(payload);
            setSyntheticJobId(res.job_id);
            setSyntheticJobStatus({ status: res.status, message: res.message });
            pollSyntheticJobStatus(res.job_id);
        } catch (err) {
            setSyntheticError('Errore nella creazione del dataset sintetico.');
        } finally {
            setIsCreatingSynthetic(false);
        }
    };

    const pollSyntheticJobStatus = (jobId) => {
        if (syntheticPollingRef.current) clearInterval(syntheticPollingRef.current);
        syntheticPollingRef.current = setInterval(async () => {
            try {
                const status = await getSyntheticCsvJobStatus(jobId);
                setSyntheticJobStatus(status);
                if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                    clearInterval(syntheticPollingRef.current);
                    syntheticPollingRef.current = null;
                    fetchCsvResources();
                }
            } catch (err) {
                clearInterval(syntheticPollingRef.current);
                syntheticPollingRef.current = null;
                setSyntheticError('Errore nel recupero dello stato del job.');
            }
        }, 3000);
    };

    useEffect(() => {
        return () => { if (syntheticPollingRef.current) clearInterval(syntheticPollingRef.current); };
    }, []);

    // Gestione barra magica e percentuale durante la creazione
    useEffect(() => {
        if (isSyntheticInProgress) {
            setMagicWordIdx(0);
            setFakeProgress(0);
            if (magicIntervalRef.current) clearInterval(magicIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            magicIntervalRef.current = setInterval(() => {
                setMagicWordIdx(idx => (idx + 1) % MAGIC_WORDS.length);
            }, 1500);
            progressIntervalRef.current = setInterval(() => {
                setFakeProgress(p => (p < 90 ? p + Math.floor(Math.random()*7+2) : p));
            }, 800);
        } else {
            if (magicIntervalRef.current) clearInterval(magicIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        }
        return () => {
            if (magicIntervalRef.current) clearInterval(magicIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [isSyntheticInProgress]);

    // Quando il job è completato, porta la barra al 100%
    useEffect(() => {
        if (syntheticJobStatus && syntheticJobStatus.status === 'COMPLETED') {
            setFakeProgress(100);
            if (magicIntervalRef.current) clearInterval(magicIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        }
    }, [syntheticJobStatus]);

    // Funzione per aprire la modale e caricare tutto il dataset
    const handleOpenFullDatasetModal = async () => {
        setShowFullDatasetModal(true);
        setFullDatasetError('');
        if (fullDataset.length > 0 && fullDatasetHeaders.length > 0) return;
        setIsLoadingFullDataset(true);
        try {
            // Se hai già tutto il dataset in memoria, usalo. Altrimenti, recuperalo (es. via API o da datasetPreview se contiene tutto)
            // Qui assumiamo che datasetPreview.sample_rows sia solo un subset, quindi serve una chiamata API (o puoi passare tutto dal backend se già disponibile)
            // Per demo, se editableDatasetData contiene tutto, usalo:
            if (editableDatasetData.length > 0 && editableDatasetHeaders.length > 0 && editableDatasetData.length === datasetPreview?.num_rows_sample) {
                setFullDataset(editableDatasetData);
                setFullDatasetHeaders(editableDatasetHeaders);
                setOriginalFullDataset(JSON.parse(JSON.stringify(editableDatasetData)));
            } else {
                // TODO: qui puoi implementare una fetch API per scaricare tutto il dataset se necessario
                setFullDataset(editableDatasetData);
                setFullDatasetHeaders(editableDatasetHeaders);
                setOriginalFullDataset(JSON.parse(JSON.stringify(editableDatasetData)));
            }
        } catch (err) {
            setFullDatasetError('Errore nel caricamento del dataset completo.');
        } finally {
            setIsLoadingFullDataset(false);
        }
    };

    // Gestione modifica cella nella modale
    const handleFullDatasetCellEdit = (rowIndex, columnHeader, newValue) => {
        setFullDataset(currentData => currentData.map((row, rIdx) => rIdx === rowIndex ? { ...row, [columnHeader]: newValue } : row ));
        setFullDatasetChanged(true);
    };

    // Salva dataset completo (puoi riutilizzare handleSaveEditedDataset o crearne uno dedicato)
    const handleSaveFullDataset = async () => {
        if (fullDataset.length === 0 || fullDatasetHeaders.length === 0) { setFullDatasetError("Nessun dato da salvare."); return; }
        setIsSavingFullDataset(true); setFullDatasetError('');
        try {
            const csvString = Papa.unparse(fullDataset, { headers: fullDatasetHeaders });
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const originalFileNameBase = uploadedFile?.name || selectedResource?.original_filename || 'dataset.csv';
            const originalNameNoExt = originalFileNameBase.substring(0, originalFileNameBase.lastIndexOf('.')) || originalFileNameBase;
            const fileName = `edited_full_${originalNameNoExt}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            const formData = new FormData(); formData.append('file', blob, fileName); formData.append('name', fileName);
            formData.append('description', `Full edited version of ${originalFileNameBase} from Data Analysis Workbench.`);
            const savedResource = await uploadResourceViaRM(formData);
            setFullDatasetChanged(false);
            setSuccess(`Dataset completo salvato come "${savedResource.name || savedResource.original_filename}"! Status: ${savedResource.status}.`);
            fetchCsvResources();
        } catch (err) { setFullDatasetError(err.response?.data?.error || 'Errore nel salvataggio del dataset completo.'); }
        finally { setIsSavingFullDataset(false); }
    };

    // Barra di avanzamento analisi (in base al polling)
    useEffect(() => {
        if (isRunningAnalysis || isPollingResults) {
            pollingStepRef.current = 0;
            setAnalysisProgress(0);
            setShowResults(false);
        }
    }, [isRunningAnalysis, isPollingResults]);

    useEffect(() => {
        if (isPollingResults) {
            const interval = setInterval(() => {
                pollingStepRef.current += 1;
                // Avanza la barra fino a 100% (non più 95%)
                setAnalysisProgress(prev => {
                    if (jobStatus === 'COMPLETED' || jobStatus === 'FAILED') return 100;
                    const next = Math.min(100, prev + 100/12); // 12 step per arrivare a 100%
                    return next;
                });
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [isPollingResults, jobStatus]);

    useEffect(() => {
        if (jobStatus === 'COMPLETED' || jobStatus === 'FAILED') {
            setAnalysisProgress(100);
            // Mostra i risultati solo dopo che la barra è arrivata a 100%
            setTimeout(() => setShowResults(true), 500);
        }
    }, [jobStatus]);

    // --- Rendering ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <StepProgress currentStep={currentStep} />
                
                {/* Alert/banner */}
                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
                {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}

                {/* Step 1: Dataset */}
                <Card>
                    <CardHeader 
                        title="1. Scegli o carica un dataset" 
                        icon={<FaTable />} 
                        right={currentStep > 1 && (selectedResource || uploadedFile) && 
                            <ButtonSecondary onClick={() => {setCurrentStep(1); resetAnalysisState(true);}}>
                                Cambia Dataset
                            </ButtonSecondary>
                        } 
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Risorse utente */}
                        <div className="col-span-2">
                            <h3 className="text-lg font-semibold text-gray-700 mb-4">Le tue risorse CSV</h3>
                            {isLoadingResources ? <Spinner /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-72 overflow-y-auto p-1 -m-1">
                                    {availableCsvResources.map(res => (
                                        <ResourceCard key={res.id} resource={res} isSelected={selectedResource?.id === res.id} onSelect={() => handleResourceCardSelect(res)} />
                                    ))}
                                </div>
                            )}
                            <ButtonSecondary onClick={fetchCsvResources} disabled={isLoadingResources} className="mt-4">
                                <FaRedo className="mr-2" />Aggiorna
                            </ButtonSecondary>
                        </div>
                        {/* Upload box */}
                        <div className="flex flex-col items-center justify-center">
                            <h3 className="text-lg font-semibold text-gray-700 mb-4">Oppure carica un nuovo CSV</h3>
                            <div {...getRootProps()} className={`p-8 border-2 ${isDragActive ? 'border-purple-500 bg-purple-50' : 'border-dashed border-gray-300 hover:border-gray-400'} rounded-xl text-center cursor-pointer w-full transition`}>
                                <input {...getInputProps()} ref={fileInputRef} />
                                <FaUpload className={`mx-auto h-12 w-12 ${isDragActive ? 'text-purple-500' : 'text-gray-400'} mb-2`} />
                                {isDragActive ? <p className="font-semibold text-purple-600">Rilascia il file qui...</p> : <p className="text-gray-500">Trascina un file o clicca per selezionare</p>}
                                {uploadedFile && <p className="text-xs text-green-600 mt-2">Pronto: {uploadedFile.name}</p>}
                            </div>
                            <ButtonPrimary onClick={() => setShowSyntheticModal(true)} className="mt-6">
                                <FaMagic className="mr-2" />Crea CSV Sintetico con AI
                            </ButtonPrimary>
                        </div>
                    </div>
                    <div className="mt-8 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                            <label htmlFor="taskTypePreference" className="block text-sm font-medium text-gray-700 mb-1">Preferenza task:</label>
                            <select id="taskTypePreference" value={taskTypePreference} onChange={(e) => setTaskTypePreference(e.target.value)} className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option value="">Qualsiasi</option>
                                <option value="regression">Regression</option>
                                <option value="classification">Classification</option>
                            </select>
                        </div>
                        <ButtonPrimary onClick={handleSuggestAlgorithm} disabled={isSuggesting || (!selectedResource && !uploadedFile)} className="w-full md:w-auto mt-4 md:mt-0">
                            <FaSearch className="mr-2" />Ottieni suggerimenti AI {isSuggesting && <Spinner small color="white" />}
                        </ButtonPrimary>
                    </div>
                    {currentStep > 1 && (selectedResource || uploadedFile) && (
                        <div className="mt-6 text-sm text-gray-600 p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-4 cursor-pointer hover:bg-purple-100 transition" onClick={handleOpenFullDatasetModal} title="Clicca per vedere e modificare tutto il dataset">
                            <FaCheckCircle className="text-green-500 text-xl" />
                            <span>Usando: <strong>{uploadedFile ? uploadedFile.name : selectedResource?.name || selectedResource?.original_filename}</strong></span>
                            {datasetPreview && <span className="text-xs ml-4">Anteprima: {datasetPreview.num_cols} colonne, {datasetPreview.num_rows_sample} righe di esempio. <span className="underline text-purple-600 cursor-pointer ml-2">(Clicca per vedere tutto)</span></span>}
                        </div>
                    )}
                </Card>

                {/* Modale dataset completo */}
                <Modal show={showFullDatasetModal} onClose={() => setShowFullDatasetModal(false)}>
                    <div>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                            <FaTable className="text-purple-500" /> 
                            Dataset completo
                        </h2>
                        {isLoadingFullDataset ? (
                            <div className="flex justify-center items-center py-8">
                                <Spinner />
                                <span className="ml-3 text-gray-600">Caricamento dataset...</span>
                            </div>
                        ) : (
                            <>
                                <EditableDataTable headers={fullDatasetHeaders} data={fullDataset} onDataChange={handleFullDatasetCellEdit} maxRows={fullDataset.length} />
                                {fullDatasetError && <Alert type="error" message={fullDatasetError} onClose={()=>setFullDatasetError('')} />}
                                <div className="flex justify-end gap-3 mt-6">
                                    <ButtonSecondary onClick={() => setShowFullDatasetModal(false)}>Chiudi</ButtonSecondary>
                                    <ButtonPrimary onClick={handleSaveFullDataset} disabled={isSavingFullDataset || !fullDatasetChanged}>
                                        <FaSave className="mr-2" />Salva Modifiche
                                    </ButtonPrimary>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>

                {/* Step 2: Configura Analisi */}
                {currentStep >= 2 && (
                    <Card>
                        <CardHeader 
                            title="2. Configura l'analisi" 
                            icon={<FaBrain />} 
                            right={currentStep === 3 && 
                                <ButtonSecondary onClick={() => {setCurrentStep(2); resetConfigAndResults();}}>
                                    Modifica Configurazione
                                </ButtonSecondary>
                            } 
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Tabella preview/edit */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-4">Anteprima & Modifica Dataset</h3>
                                <EditableDataTable headers={editableDatasetHeaders} data={editableDatasetData} onDataChange={handleCellEdit} maxRows={10} />
                                {editableDatasetHeaders.length > 0 && (
                                    <ButtonSecondary onClick={handleSaveEditedDataset} disabled={isSavingEditedDataset || !hasDataChanged} className="mt-4">
                                        <FaSave className="mr-2" />Salva Modifiche
                                    </ButtonSecondary>
                                )}
                                {saveEditedDatasetError && <Alert type="error" message={saveEditedDatasetError} onClose={()=>setSaveEditedDatasetError('')} />}
                            </div>
                            {/* Parametri AI */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-4">Algoritmo & Parametri</h3>
                                {selectedAlgorithm ? (
                                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                                        <div className="text-lg font-bold text-purple-700 flex items-center gap-2 mb-2">
                                            <FaBrain className="text-purple-500" />
                                            {selectedAlgorithm.algorithm_name} 
                                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full ml-2">
                                                {selectedAlgorithm.task_type}
                                            </span>
                                        </div>
                                        <div className="text-sm mb-3">
                                            <strong>Motivazione AI:</strong> {selectedAlgorithm.motivation}
                                        </div>
                                        {/* Sezione espandibile per metriche dettagliate */}
                                        <details className="bg-white border border-purple-100 rounded-lg p-3 text-sm cursor-pointer">
                                            <summary className="font-semibold text-purple-600">Mostra dettagli metriche fit test</summary>
                                            <div className="whitespace-pre-line mt-2 text-gray-600">
                                                {selectedAlgorithm.motivation}
                                            </div>
                                        </details>
                                        {/* Sotto la motivazione AI, mostra la tabella di confronto */}
                                        {selectedAlgorithm && aiSuggestions.length > 1 && (
                                            <AISuggestionTable suggestions={aiSuggestions} bestSuggestion={selectedAlgorithm} />
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic mb-4">Nessun suggerimento AI disponibile.</p>
                                )}
                                {datasetPreview?.headers?.length > 0 && selectedAlgorithm?.task_type === 'regression' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="features" className="block text-sm font-medium text-gray-700 mb-1">Features (X):</label>
                                            <select multiple id="features" value={selectedFeatures} onChange={handleFeatureChange} disabled={currentStep === 3} className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 h-24">
                                                {datasetPreview.headers.filter(h => h !== selectedTarget).map(h => (<option key={`feat-${h}`} value={h}>{h}</option>))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="target" className="block text-sm font-medium text-gray-700 mb-1">Target (Y):</label>
                                            <select id="target" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} disabled={currentStep === 3} className="w-full p-3 border-0 rounded-xl bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100">
                                                <option value="">-- Seleziona Target --</option>
                                                {datasetPreview.headers.filter(h => !selectedFeatures.includes(h)).map(h => (<option key={`target-${h}`} value={h}>{h}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {selectedAlgorithm?.task_type === 'classification' && (
                                    <div className="text-sm bg-green-50 p-4 rounded-xl border border-green-200">
                                        <strong>Configurazione automatica:</strong> Features: tutte tranne l'ultima. Target: ultima colonna.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end mt-8">
                            <ButtonPrimary onClick={handleRunAnalysis} disabled={isRunningAnalysis || !selectedAlgorithm || (selectedAlgorithm.task_type === 'regression' && (selectedFeatures.length === 0 || !selectedTarget))}>
                                <FaPlay className="mr-2" />Avvia Analisi {isRunningAnalysis && <Spinner small color="white" />}
                            </ButtonPrimary>
                        </div>
                    </Card>
                )}

                {/* Step 3: Risultati */}
                {currentStep === 3 && (
                    <Card>
                        <CardHeader 
                            title="3. Risultati" 
                            icon={<FaChartBar />} 
                            right={
                                <ButtonSecondary onClick={() => {setCurrentStep(1); resetAnalysisState(true);}}>
                                    Nuova Analisi
                                </ButtonSecondary>
                            } 
                        />
                        <div className="mb-6 flex flex-wrap gap-4 items-center">
                            {/* Barra di caricamento analisi */}
                            {(isRunningAnalysis || isPollingResults) ? (
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                        <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-4 rounded-full transition-all duration-500" style={{ width: `${analysisProgress}%` }}></div>
                                    </div>
                                    <div className="text-sm text-gray-600">Analisi in corso... {Math.round(analysisProgress)}%</div>
                                </div>
                            ) : (
                                <>
                                    <span className="text-xs font-mono bg-gray-100 px-3 py-1 rounded-full">Job ID: {analysisJobId}</span>
                                    <span className={`ml-2 font-medium px-3 py-1 rounded-full text-xs ${jobStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : jobStatus === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{jobStatus || 'Fetching...'}</span>
                                </>
                            )}
                            {(isPollingResults || ['PENDING', 'PROCESSING'].includes(jobStatus) ) && <Spinner small color="purple-500" />}
                        </div>
                        {/* Mostra i risultati solo quando showResults è true */}
                        {showResults && jobStatus === 'COMPLETED' && jobResults && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Metriche</h3>
                                    <MetricTable metrics={jobResults.results} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Visualizzazione</h3>
                                    {chartDataAndOptions ? (
                                        <div className="relative h-[300px] md:h-[400px] border rounded-xl p-2 bg-gray-50 shadow-inner">
                                            <Plot data={chartDataAndOptions.data} layout={chartDataAndOptions.layout} useResizeHandler={true} className="w-full h-full" config={{responsive: true, displaylogo: false}}/>
                                        </div>
                                    ) : <p className="text-sm text-gray-500 italic mt-4">Nessun dato per il grafico.</p>}
                                </div>
                            </div>
                        )}
                        {showResults && jobStatus === 'FAILED' && <Alert type="error" message={`Analisi fallita: ${jobResults?.error_message || 'Errore sconosciuto.'}`} />}
                        {/* Predizione interattiva */}
                        {showResults && jobStatus === 'COMPLETED' && jobResults && (
                            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                                {jobResults.task_type === 'regression' && jobResults.input_parameters?.selected_features?.length > 0 && (
                                    <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                            <FaBrain className="text-purple-500" />
                                            Predizione (Regression)
                                        </h4>
                                        <label htmlFor="regPredictX" className="block text-sm font-medium text-gray-700 mb-2">
                                            Per <span className='font-semibold text-purple-600'>{jobResults.input_parameters.selected_features[0]}</span> =
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="number" 
                                                id="regPredictX" 
                                                value={regressionPredictFeatureValue} 
                                                onChange={(e) => setRegressionPredictFeatureValue(e.target.value)} 
                                                placeholder="Valore X" 
                                                className="flex-grow p-3 border-0 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                            />
                                            <ButtonPrimary onClick={handleRegressionPredict} disabled={isPredicting} className="!px-4 !py-3">
                                                {isPredicting ? <Spinner small color="white" /> : 'Predici'}
                                            </ButtonPrimary>
                                        </div>
                                        {regressionPredictionResult !== null && (
                                            <div className="mt-4 p-3 bg-white rounded-lg border border-purple-100">
                                                <p className="text-sm font-semibold text-gray-700">
                                                    Predetto <span className='font-bold text-purple-600'>{jobResults.input_parameters.selected_target}</span>: 
                                                    <span className="text-purple-700 font-mono text-lg ml-2">{regressionPredictionResult.toFixed(4)}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {jobResults.task_type === 'classification' && jobResults.input_parameters?.selected_features && (
                                    <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                            <FaBrain className="text-green-500" />
                                            Predizione (Classification)
                                        </h4>
                                        <div className="space-y-3">
                                            {jobResults.input_parameters.selected_features.map(feat => (
                                                <div key={feat}>
                                                    <label htmlFor={`cls_input_${feat}`} className="block text-sm font-medium text-gray-700 mb-1">{feat}:</label>
                                                    <input 
                                                        type="text" 
                                                        id={`cls_input_${feat}`} 
                                                        value={classificationInputValues[feat] || ''} 
                                                        onChange={(e) => handleClassificationInputChange(feat, e.target.value)} 
                                                        placeholder={`Valore per ${feat}`} 
                                                        className="w-full p-3 border-0 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <ButtonPrimary onClick={handleClassificationPredict} disabled={isPredicting} className="mt-4 !bg-gradient-to-r !from-green-500 !to-green-600 !hover:from-green-600 !hover:to-green-700">
                                            {isPredicting ? <Spinner small color="white" /> : 'Predici Classe'}
                                        </ButtonPrimary>
                                        {classificationPredictionResult && (
                                            <div className="mt-4 p-3 bg-white rounded-lg border border-green-100">
                                                <p className="text-sm font-semibold text-gray-700">
                                                    Classe Predetta: <span className="text-green-700 font-bold text-lg">{classificationPredictionResult.predicted_class}</span>
                                                </p>
                                            </div>
                                        )}
                                        {classificationPredictionResult?.probabilities && (
                                            <div className="mt-3 p-3 bg-white rounded-lg border border-green-100">
                                                <p className="text-sm font-medium text-gray-700 mb-2">Probabilità:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Object.entries(classificationPredictionResult.probabilities).sort(([,a],[,b]) => b-a).map(([cN,p]) => (
                                                        <div key={cN} className="flex justify-between text-xs">
                                                            <span className="font-medium text-gray-600">{cN}:</span>
                                                            <span className="font-mono text-green-600">{(p*100).toFixed(1)}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                )}

                {/* Modale CSV Sintetico */}
                <Modal show={showSyntheticModal} onClose={() => {
                    if (!isSyntheticInProgress) setShowSyntheticModal(false);
                }}>
                    <div>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                            <FaMagic className="text-purple-500" /> 
                            Genera un nuovo CSV Sintetico
                        </h2>
                        {isSyntheticInProgress ? (
                            <div className="my-10 w-full flex flex-col items-center">
                                <div className="flex items-center gap-3 mb-4">
                                    <FaMagic className="text-purple-400 animate-pulse text-3xl" />
                                    <span className="text-purple-700 font-semibold animate-pulse text-lg">{MAGIC_WORDS[magicWordIdx]}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
                                    <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-4 rounded-full transition-all duration-500" style={{ width: `${fakeProgress}%` }}></div>
                                </div>
                                <div className="text-right text-sm text-gray-500 w-full">{fakeProgress}%</div>
                            </div>
                        ) : syntheticJobStatus && syntheticJobStatus.status === 'COMPLETED' ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <FaCheckCircle className="text-green-500 text-5xl mb-4 animate-bounce" />
                                <p className="text-xl font-semibold text-green-700 mb-2">Completato!</p>
                                <p className="text-gray-600 mb-6">Il dataset sintetico è stato creato con successo.</p>
                                <ButtonPrimary onClick={() => setShowSyntheticModal(false)}>Chiudi</ButtonPrimary>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Descrizione del dataset (prompt):
                                        </label>
                                        <textarea 
                                            className="w-full p-3 border-0 rounded-xl bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                            value={syntheticPrompt} 
                                            onChange={e => setSyntheticPrompt(e.target.value)} 
                                            rows={4} 
                                            placeholder="Descrivi il tipo di dataset che vuoi generare..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Numero di righe:
                                        </label>
                                        <input 
                                            type="number" 
                                            className="w-full p-3 border-0 rounded-xl bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                            value={syntheticNumRows} 
                                            min={10} 
                                            max={1000} 
                                            onChange={e => setSyntheticNumRows(Number(e.target.value))} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Nome del dataset (opzionale):
                                        </label>
                                        <input 
                                            type="text" 
                                            className="w-full p-3 border-0 rounded-xl bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                            value={syntheticDatasetName} 
                                            onChange={e => setSyntheticDatasetName(e.target.value)} 
                                            placeholder="Nome personalizzato per il dataset"
                                        />
                                    </div>
                                </div>
                                {syntheticError && <Alert type="error" message={syntheticError} onClose={() => setSyntheticError('')} />}
                                <div className="flex justify-end space-x-3 mt-6">
                                    <ButtonSecondary onClick={() => setShowSyntheticModal(false)}>Annulla</ButtonSecondary>
                                    <ButtonPrimary onClick={handleCreateSyntheticCsv} disabled={!syntheticPrompt || syntheticNumRows < 10}>
                                        <FaMagic className="mr-2" /> Crea Dataset
                                    </ButtonPrimary>
                                </div>
                            </>
                        )}
                        {syntheticJobStatus && syntheticJobStatus.status === 'FAILED' && (
                            <Alert type="error" message={`Errore: ${syntheticJobStatus.error_message || 'Impossibile generare il dataset.'}`} />
                        )}
                    </div>
                </Modal>

                {/* Nella sezione visualizzazione, aggiungi il menu a tendina per la selezione del plot */}
                {chartDataAndOptions && Array.isArray(plotData) && plotData.length > 1 && (
                    <div className="mb-4 flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700">Tipo di grafico:</label>
                        <select className="p-2 border-0 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500" value={selectedPlotIdx} onChange={e => setSelectedPlotIdx(Number(e.target.value))}>
                            {plotData.map((p, idx) => (
                                <option key={p.type} value={idx} title={plotTypeDescriptions[p.type] || ''}>
                                    {plotTypeIcons[p.type] ? `${plotTypeIcons[p.type]} ` : ''}{plotTypeLabels[p.type] || p.type}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm text-gray-500 ml-2">{plotTypeIcons[plotData[selectedPlotIdx]?.type] || ''} {plotTypeDescriptions[plotData[selectedPlotIdx]?.type] || ''}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataAnalysisPage;