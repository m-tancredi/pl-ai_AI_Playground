// src/pages/ImageClassifierPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone'; // Assicurati sia installato: npm install react-dropzone
import { v4 as uuidv4 } from 'uuid'; // Per ID classi univoci - npm install uuid
import { FaUpload, FaPlus, FaInfoCircle, FaSpinner, FaTimes, FaVideo, FaVideoSlash, FaRedo, FaBrain, FaRobot, FaImages, FaQuestionCircle } from 'react-icons/fa'; // Importa icone base
import { useAuth } from '../context/AuthContext'; // Verifica path
// Importa funzioni API per questo servizio specifico
import {
    trainClassifier,
    predictImage,
    getModelStatus,
    listUserModels,      // Per caricare modelli esistenti
    // updateModelMetadata, // Implementare se si aggiunge un modale di modifica per i modelli
    // deleteModel          // Implementare se si aggiunge opzione delete per i modelli
} from '../services/classifierService'; // Verifica path

// Importa componenti figli (Assicurati che questi file esistano e i path siano corretti)
import ClassInputBox from '../components/ClassInputBox';
import PredictionDisplay from '../components/PredictionDisplay';
import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal'; // Assumi esista un file TutorialModal.jsx

// --- Componenti UI moderni - stile chatbot ---
const Spinner = ({ small = false, color = 'purple-500' }) => (
    <div className={`inline-block animate-spin rounded-full border-t-4 border-b-4 border-${color} ${small ? 'h-5 w-5 mr-2' : 'h-6 w-6 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const colorClasses = {
        error: 'bg-red-50 text-red-700 border-red-200',
        warning: 'bg-orange-50 text-orange-700 border-orange-200',
        success: 'bg-green-50 text-green-700 border-green-200',
        info: 'bg-blue-50 text-blue-700 border-blue-200'
    };

    if (!message) return null;

    return (
        <div className={`max-w-6xl mx-auto ${colorClasses[type]} border px-4 py-3 rounded-xl flex items-center justify-between`}>
            <span className="font-medium">{message}</span>
            {onClose && (
                <button onClick={onClose} className="text-current hover:opacity-70 font-bold text-lg" aria-label="Close">
                    ×
                </button>
            )}
        </div>
    );
};

// Card moderna - stile chatbot
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl ${className}`}>{children}</div>
);

// Header card con icona grande - stile chatbot
const CardHeader = ({ title, icon, number, right }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            {number && (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                    {number}
                </div>
            )}
            <div className="flex items-center gap-3">
                <span className="text-purple-600 text-xl">{icon}</span>
                <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            </div>
        </div>
        {right && right}
    </div>
);

// Bottoni moderni - stile chatbot
const ButtonPrimary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);

const ButtonSecondary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>
);

// Progress bar moderna - stile chatbot
const ProgressBar = ({ progress, color = 'purple' }) => (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div 
            className={`bg-gradient-to-r from-${color}-400 to-${color === 'purple' ? 'pink' : color}-400 h-3 rounded-full transition-all duration-500`} 
            style={{ width: `${progress}%` }}
        ></div>
    </div>
);

// Status badge moderno - stile chatbot
const StatusBadge = ({ status, message }) => {
    const getStatusStyle = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700';
            case 'training': case 'sending': return 'bg-purple-100 text-purple-700';
            case 'error': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="flex items-center gap-3 mt-4">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getStatusStyle(status)}`}>
                {status.toUpperCase()}
            </span>
            <span className="text-sm text-gray-600 font-medium">{message}</span>
        </div>
    );
};

// Modale Alert moderna - stile chatbot
const AlertModalShell = ({ isOpen, onClose, title = "Alert", children }) => {
     if (!isOpen) return null;
     return (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-8 border-0 w-full max-w-md shadow-2xl rounded-2xl bg-white">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                        <FaInfoCircle className="text-xl" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
                </div>
                <div className="text-gray-600 mb-6 leading-relaxed">{children}</div>
                <div className="flex justify-end">
                    <ButtonPrimary onClick={onClose}>OK</ButtonPrimary>
                </div>
            </div>
        </div>
     );
};
// --- Fine UI ---

// --- Costanti ---
const MIN_CLASSES = 2;
const MAX_CLASSES = 5;
const MIN_IMAGES_PER_CLASS = 10;

// --- Componente Pagina ---
const ImageClassifierPage = () => {
    const { isAuthenticated } = useAuth();

    // Stato Classi e Immagini
    const [classes, setClasses] = useState([
        { id: uuidv4(), name: 'Class 1', images: [], imageCount: 0 },
        { id: uuidv4(), name: 'Class 2', images: [], imageCount: 0 }
    ]);

    // Stato Training e Modello
    const [trainingState, setTrainingState] = useState('idle');
    const [modelId, setModelId] = useState(null); // ID del modello ATTIVO (nuovo o caricato)
    const [trainingStatusMessage, setTrainingStatusMessage] = useState(`Requires >= ${MIN_CLASSES} classes with >= ${MIN_IMAGES_PER_CLASS} images each.`);
    const [trainingError, setTrainingError] = useState('');
    const [modelAccuracy, setModelAccuracy] = useState(null);

    // Stato Predizione Realtime
    const [realtimePredictions, setRealtimePredictions] = useState([]);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);

    // Stati Galleria Modelli
    const [userModels, setUserModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelsError, setModelsError] = useState('');
    const [selectedExistingModelId, setSelectedExistingModelId] = useState('');

    // Stato UI Console e Modali
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({ title: '', message: '' });

    // Stato UI generico
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [warning, setWarning] = useState('');

    // Refs
    const realtimeVideoRef = useRef(null);
    const realtimeCanvasRef = useRef(null);
    const realtimeLoopRef = useRef(null);
    const streamRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const trainingStateRef = useRef(trainingState);
    const isRealtimeActiveRef = useRef(isRealtimeActive);

    useEffect(() => { trainingStateRef.current = trainingState; }, [trainingState]);
    useEffect(() => { isRealtimeActiveRef.current = isRealtimeActive; }, [isRealtimeActive]);


    // --- Funzioni Helper ---
    const logMessage = useCallback((message) => {
        console.log("UI Log:", message);
        setConsoleLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(-100));
    }, []);

    const showAlert = (title, message) => {
        setAlertModalContent({ title, message });
        setShowAlertModal(true);
    };

    // --- Gestione Classi ---
    const addClass = () => {
        if (classes.length < MAX_CLASSES) {
            let nextClassNumber = 1;
            const classNumbers = classes.map(cls => {
                const match = cls.name.match(/^Class (\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            });
            if (classNumbers.length > 0) {
                 nextClassNumber = Math.max(0, ...classNumbers) + 1;
            }
            if (nextClassNumber > MAX_CLASSES) nextClassNumber = MAX_CLASSES; // Dovrebbe essere già gestito da classes.length < MAX_CLASSES
            setClasses(prev => [...prev, { id: uuidv4(), name: `Class ${nextClassNumber}`, images: [], imageCount: 0 }]);
            logMessage(`Added new class slot: Class ${nextClassNumber}.`);
        } else {
            showAlert('Limit Reached', `Maximum of ${MAX_CLASSES} classes allowed.`);
        }
    };

    const removeClass = (idToRemove) => {
        if (classes.length > MIN_CLASSES) {
            setClasses(prev => prev.filter(cls => cls.id !== idToRemove));
            logMessage(`Removed class slot.`);
        } else {
             showAlert('Minimum Classes', `At least ${MIN_CLASSES} classes are required.`);
        }
    };

    const handleClassNameChange = (id, newName) => {
        setClasses(prev => prev.map(cls => cls.id === id ? { ...cls, name: newName } : cls));
    };

    const handleClassImagesUpdate = (id, getNewImages) => {
        setClasses(prev => prev.map(cls => {
            if (cls.id === id) {
                const updatedImages = typeof getNewImages === 'function' ? getNewImages(cls.images) : getNewImages;
                return { ...cls, images: updatedImages, imageCount: updatedImages.length };
            }
            return cls;
        }));
    };

    const canTrain = useMemo(() => {
        const validClasses = classes.filter(cls => cls.name.trim() !== '' && cls.imageCount >= MIN_IMAGES_PER_CLASS);
        return validClasses.length >= MIN_CLASSES;
    }, [classes]);

    // --- Fetch Modelli Utente ---
    const fetchUserModels = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingModels(true); setModelsError('');
        try {
            const models = await listUserModels();
            setUserModels(Array.isArray(models) ? models : []);
            logMessage(`Fetched ${Array.isArray(models) ? models.length : 0} user models.`);
        } catch (err) { setModelsError('Failed to load your trained models.'); setUserModels([]); console.error(err);
        } finally { setIsLoadingModels(false); }
    }, [isAuthenticated, logMessage]);

    useEffect(() => { fetchUserModels(); }, [fetchUserModels]);

    // --- Gestione Training & Polling ---
    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            logMessage("Polling: Stopped.");
        }
    }, [logMessage]);

    const startTrainingPolling = useCallback((currentModelId) => {
        stopPolling();
        logMessage(`Polling: Started for model ${currentModelId.substring(0,8)}...`);
        pollingIntervalRef.current = setInterval(async () => {
            if (trainingStateRef.current !== 'training') {
                console.log("Polling: Stopping - trainingState is no longer 'training'. Current:", trainingStateRef.current);
                stopPolling(); return;
            }
            try {
                const statusData = await getModelStatus(currentModelId);
                logMessage(`Polling: Status = ${statusData.status} for ${currentModelId.substring(0,8)}`);
                if (trainingStateRef.current === 'training') setTrainingStatusMessage(`Status: ${statusData.status}...`);

                if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                    stopPolling();
                    if (statusData.status === 'COMPLETED') {
                        setTrainingState('completed'); setModelAccuracy(statusData.accuracy);
                        setTrainingStatusMessage(`Training complete! Acc: ${statusData.accuracy ? (statusData.accuracy * 100).toFixed(1) : 'N/A'}%`);
                        logMessage(`Training model ${currentModelId.substring(0,8)} COMPLETED.`);
                        fetchUserModels();
                    } else {
                        setTrainingState('error'); const errorMsg = statusData.error_message || 'Unknown error';
                        setTrainingError(errorMsg); setTrainingStatusMessage('Training FAILED.');
                        logMessage(`Training model ${currentModelId.substring(0,8)} FAILED: ${errorMsg}`);
                    }
                }
            } catch (error) {
                console.error(`Polling: Error for ${currentModelId}:`, error);
                logMessage(`Polling error: ${error.message}.`);
                if (error.response?.status === 404) {
                    setTrainingState('error'); setTrainingError('Model not found during polling.'); stopPolling();
                }
            }
        }, 5000);
    }, [stopPolling, logMessage, fetchUserModels]);

    const handleTrainClick = async () => {
        const validClasses = classes.filter(cls => cls.name.trim() !== '' && cls.imageCount >= MIN_IMAGES_PER_CLASS);
        if (validClasses.length < MIN_CLASSES) {
             showAlert('Insufficient Data', `Need >= ${MIN_CLASSES} classes with names and >= ${MIN_IMAGES_PER_CLASS} images each.`); return;
        }
        setTrainingState('sending'); setTrainingStatusMessage('Preparing & sending data...');
        setTrainingError(''); setModelId(null); setModelAccuracy(null); setIsRealtimeActive(false);
        setError(''); setSuccess('');

        let allImages = []; let allLabels = []; let classNames = [];
        validClasses.forEach((cls, index) => {
            allImages = [...allImages, ...cls.images];
            allLabels = [...allLabels, ...Array(cls.imageCount).fill(index)];
            classNames.push(cls.name.trim());
        });
        logMessage(`Sending ${allImages.length} images for ${classNames.length} classes...`);
        try {
            const payload = { images: allImages, labels: allLabels, class_names: classNames };
            const response = await trainClassifier(payload);
            setModelId(response.model_id); setTrainingState('training');
            setTrainingStatusMessage('Training started. Polling status...');
            logMessage(`Training submitted. Model ID: ${response.model_id.substring(0, 8)}...`);
            startTrainingPolling(response.model_id);
            setSuccess('Training request sent!');
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to start training.';
            setTrainingState('error'); setTrainingError(errorMsg);
            setTrainingStatusMessage('Failed to submit training.');
            logMessage(`Error submitting training: ${errorMsg}`);
            setError('Failed to submit training request.');
        }
    };

    // --- Gestione Caricamento Modello Esistente ---
    const handleLoadExistingModel = () => {
        if (!selectedExistingModelId) { showAlert("No Model", "Select a model."); return; }
        const modelToLoad = userModels.find(m => m.id === selectedExistingModelId);
        if (!modelToLoad) { showAlert("Error", "Selected model not found."); return; }
        if (modelToLoad.status !== 'COMPLETED') { showAlert("Not Ready", `Model status: ${modelToLoad.status}.`); return; }

        logMessage(`Loading model ${modelToLoad.id.substring(0,8)}...`);
        setError(''); setSuccess(''); setWarning(''); setTrainingError('');
        setModelId(modelToLoad.id); setModelAccuracy(modelToLoad.accuracy);
        setTrainingState('completed');
        setTrainingStatusMessage(`Loaded: ${modelToLoad.name || 'Model'} (Acc: ${(modelToLoad.accuracy * 100).toFixed(1)}%)`);
        setIsRealtimeActive(true);
        setSuccess(`Model "${modelToLoad.name || 'Model'}" loaded!`);
        setClasses([ { id: uuidv4(), name: 'Class 1', images: [], imageCount: 0 }, { id: uuidv4(), name: 'Class 2', images: [], imageCount: 0 } ]);
    };

    // --- Gestione Predizione Realtime ---
    const stopRealtimePrediction = useCallback(() => {
        if (!isRealtimeActiveRef.current && !realtimeLoopRef.current && !streamRef.current) return;
        logMessage("Realtime: Stopping prediction components.");
        if (realtimeLoopRef.current) cancelAnimationFrame(realtimeLoopRef.current);
        realtimeLoopRef.current = null;
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (realtimeVideoRef.current) realtimeVideoRef.current.srcObject = null;
        setRealtimePredictions([]);
    }, [logMessage]);

    const startRealtimePrediction = useCallback(async () => {
        if (!modelId || trainingStateRef.current !== 'completed') {
            logMessage(`Realtime: Cannot start. modelId=${!!modelId}, trainingState=${trainingStateRef.current}`);
            setIsRealtimeActive(false); return;
        }
        if (isRealtimeActiveRef.current && streamRef.current) { logMessage("Realtime: Already active."); return; }
        logMessage("Realtime: Attempting to start webcam..."); setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 224, height: 224 } });
            streamRef.current = stream;
            if (realtimeVideoRef.current) {
                realtimeVideoRef.current.srcObject = stream;
                await realtimeVideoRef.current.play();
                logMessage("Realtime: Webcam stream started.");
            }

            const predictFrame = async () => {
                if (!isRealtimeActiveRef.current || !streamRef.current || !modelId) { console.log("Realtime Loop: Stopping."); return; }
                if (!realtimeVideoRef.current || !realtimeCanvasRef.current) { console.log("Realtime Loop: Refs missing."); return; }
                const video = realtimeVideoRef.current; const canvas = realtimeCanvasRef.current;
                if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
                    if (isRealtimeActiveRef.current) realtimeLoopRef.current = requestAnimationFrame(predictFrame); return;
                }
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                try {
                    if (!isRealtimeActiveRef.current) return;
                    const result = await predictImage({ image: frameDataUrl, model_id: modelId });
                    if (isRealtimeActiveRef.current) setRealtimePredictions(result.predictions || []);
                } catch (predictErr) {
                    console.warn("Realtime API error:", predictErr);
                    if (isRealtimeActiveRef.current) setRealtimePredictions([]);
                    if (predictErr.response?.status === 404) {
                        if(isRealtimeActiveRef.current) setError("Model not found. Stopping.");
                        setIsRealtimeActive(false); return;
                    }
                }
                if (isRealtimeActiveRef.current) realtimeLoopRef.current = requestAnimationFrame(predictFrame);
            };
            if (isRealtimeActiveRef.current) realtimeLoopRef.current = requestAnimationFrame(predictFrame);
        } catch (err) {
            console.error("Webcam access error:", err); setError(`Webcam error: ${err.message}.`);
            setIsRealtimeActive(false);
        }
    }, [modelId, logMessage]);

    // --- EFFETTI ---
    useEffect(() => {
        if (isRealtimeActive) {
            if (modelId && trainingStateRef.current === 'completed') { startRealtimePrediction(); }
            else { setIsRealtimeActive(false); }
        } else {
            stopRealtimePrediction();
        }
        return () => { stopRealtimePrediction(); };
    }, [isRealtimeActive, startRealtimePrediction, stopRealtimePrediction, modelId]);

    useEffect(() => {
        if (trainingState === 'completed' && modelId) {
            if (!isRealtimeActiveRef.current) setIsRealtimeActive(true);
        }
        if (['error', 'idle', 'sending', 'training'].includes(trainingState)) {
             if (isRealtimeActiveRef.current) setIsRealtimeActive(false);
        }
    }, [trainingState, modelId, logMessage]);

    useEffect(() => {
        return () => { stopPolling(); stopRealtimePrediction(); };
    }, [stopPolling, stopRealtimePrediction]);

    // --- Rendering ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Alert/banner */}
                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

                {/* Layout a Grid Responsive */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                    {/* Step 1: Dati & Classi */}
                    <Card className="lg:col-span-1">
                        <CardHeader 
                            title="Dati & Classi" 
                            icon={<FaImages />}
                            number="1"
                        />
                        {classes.map((cls) => (
                            <ClassInputBox 
                                key={cls.id} 
                                classData={cls} 
                                onNameChange={handleClassNameChange} 
                                onImagesUpdate={handleClassImagesUpdate} 
                                onRemove={removeClass} 
                                canRemove={classes.length > MIN_CLASSES}
                            />
                        ))}
                        {classes.length < MAX_CLASSES && (
                            <button 
                                onClick={addClass} 
                                className="w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-purple-300 rounded-xl text-base font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 mt-6 transition-all duration-200"
                            >
                                <FaPlus className="mr-2" /> 
                                Aggiungi Classe ({classes.length}/{MAX_CLASSES})
                            </button>
                        )}
                    </Card>

                    {/* Step 2: Training Modello */}
                    <Card className="lg:col-span-1 lg:sticky lg:top-6">
                        <CardHeader 
                            title="Training Modello" 
                            icon={<FaBrain />}
                            number="2"
                        />
                        
                        <ButtonPrimary 
                            onClick={handleTrainClick} 
                            disabled={!canTrain || trainingState === 'sending' || trainingState === 'training'} 
                            className="w-full py-4 text-lg font-bold"
                        >
                            {(trainingState === 'sending' || trainingState === 'training') && <Spinner small />} 
                            {trainingState === 'completed' && modelId && !classes.some(c => c.imageCount > 0) ? 'MODELLO CARICATO - NUOVO TRAINING?' : trainingState === 'completed' ? 'TRAINA DI NUOVO' : 'TRAINA MODELLO'}
                        </ButtonPrimary>
                        
                        {/* Progress bar */}
                        {(trainingState === 'sending' || trainingState === 'training') && (
                            <div>
                                <ProgressBar progress={trainingState === 'sending' ? 30 : 70} />
                            </div>
                        )}
                        
                        {/* Stato Training */}
                        <StatusBadge status={trainingState} message={trainingStatusMessage} />
                        
                        {trainingError && (
                            <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
                                <p className="text-sm text-red-600 font-medium">{trainingError}</p>
                            </div>
                        )}
                        
                        {modelId && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                <p className="text-xs text-gray-500">
                                    Model ID: <span className="font-mono font-medium">{modelId.substring(0,8)}...</span>
                                </p>
                            </div>
                        )}
                        
                        {modelAccuracy !== null && (trainingState === 'completed' || (modelId && selectedExistingModelId === modelId)) && (
                            <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                                <p className="text-lg text-green-600 font-bold text-center">
                                    Accuracy: {(modelAccuracy * 100).toFixed(1)}%
                                </p>
                            </div>
                        )}
                    </Card>

                    {/* Step 3: Predizione Realtime */}
                    <Card className="lg:col-span-1 lg:sticky lg:top-6">
                        <CardHeader 
                            title="Predizione Realtime" 
                            icon={<FaRobot />}
                            number="3"
                        />
                        
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-300 rounded-2xl aspect-video overflow-hidden flex items-center justify-center relative text-white shadow-inner">
                            <video 
                                ref={realtimeVideoRef} 
                                className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-300 ${isRealtimeActive ? 'opacity-100' : 'opacity-0'}`} 
                                autoPlay 
                                playsInline 
                                muted 
                            />
                            {!isRealtimeActive && (
                                <div className="z-10 p-6 text-center">
                                    {(trainingState === 'completed' && modelId) || selectedExistingModelId ? (
                                        <ButtonPrimary 
                                            onClick={() => setIsRealtimeActive(true)} 
                                            className="!bg-gradient-to-r !from-blue-500 !to-blue-600 !hover:from-blue-600 !hover:to-blue-700"
                                        >
                                            <FaVideo className="mr-2"/> 
                                            Avvia Webcam
                                        </ButtonPrimary>
                                    ) : (
                                        <p className="text-base text-gray-400 italic">Allena o carica un modello prima.</p>
                                    )}
                                </div>
                            )}
                            {isRealtimeActive && (
                                <button 
                                    onClick={() => setIsRealtimeActive(false)} 
                                    title="Stop Webcam" 
                                    className="absolute top-3 right-3 p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg z-20 transition-all duration-200"
                                >
                                    <FaVideoSlash size={18}/>
                                </button>
                            )}
                             <canvas ref={realtimeCanvasRef} style={{ display: 'none' }}></canvas>
                        </div>
                        
                        <div className="mt-6">
                            <PredictionDisplay predictions={realtimePredictions} />
                        </div>
                    </Card>
                </div>

                {/* Modelli salvati */}
                <Card className="max-w-4xl mx-auto mt-8">
                    <CardHeader 
                        title="Modelli Salvati" 
                        icon={<FaInfoCircle />}
                        right={
                            <ButtonSecondary onClick={fetchUserModels} disabled={isLoadingModels} className="!px-4 !py-2">
                                {isLoadingModels ? <Spinner small /> : <FaRedo className="mr-1"/>} 
                                Aggiorna
                            </ButtonSecondary>
                        }
                    />
                    {modelsError && <Alert type="error" message={modelsError} onClose={() => setModelsError('')} />}
                    {isLoadingModels ? (
                        <div className="text-center py-8">
                            <Spinner/>
                            <span className="ml-3 font-medium text-gray-600">Loading models...</span>
                        </div>
                    ) : userModels.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <select 
                                    value={selectedExistingModelId} 
                                    onChange={(e) => setSelectedExistingModelId(e.target.value)} 
                                    className="flex-1 p-4 border-0 bg-gray-50 rounded-xl shadow-sm text-base focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    <option value="">-- Seleziona un modello addestrato --</option>
                                    {userModels.map(m => (
                                        <option key={m.id} value={m.id} disabled={m.status !== 'COMPLETED'}>
                                            {m.name || `Model ${m.id.substring(0,8)}`} ({m.status}) - Acc: {m.accuracy ? (m.accuracy*100).toFixed(1) : 'N/A'}%
                                        </option>
                                    ))}
                                </select>
                                <ButtonPrimary 
                                    onClick={handleLoadExistingModel} 
                                    disabled={!selectedExistingModelId || isRealtimeActive}
                                    className="!bg-gradient-to-r !from-blue-500 !to-blue-600 !hover:from-blue-600 !hover:to-blue-700"
                                >
                                    Carica & Avvia Webcam
                                </ButtonPrimary>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <FaBrain className="text-4xl mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Nessun modello addestrato trovato</p>
                            <p className="text-sm">Allena il tuo primo modello per iniziare!</p>
                        </div>
                    )}
                </Card>

                {/* Console Log */}
                <div className="max-w-4xl mx-auto mt-8">
                    <ConsoleLog logs={consoleLogs} onClear={() => setConsoleLogs([])} />
                </div>

                {/* Modali */}
                <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
                <AlertModalShell isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title={alertModalContent.title}>
                    {alertModalContent.message}
                </AlertModalShell>
            </div>
        </div>
    );
};

export default ImageClassifierPage;