// src/pages/ImageClassifierPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone'; // Assicurati sia installato: npm install react-dropzone
import { v4 as uuidv4 } from 'uuid'; // Per ID classi univoci - npm install uuid
import { FaUpload, FaPlus, FaInfoCircle, FaSpinner, FaTimes, FaVideo, FaVideoSlash, FaRedo } from 'react-icons/fa'; // Importa icone base
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

// --- Componenti UI Base (Definiti qui per autocontenimento) ---
const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative mb-4 shadow-sm';
    let typeStyle = '', iconColor = '';
    switch (type) {
        case 'success': typeStyle = 'bg-green-100 border-green-300 text-green-700'; iconColor = 'text-green-500 hover:text-green-700'; break;
        case 'warning': typeStyle = 'bg-yellow-100 border-yellow-300 text-yellow-700'; iconColor = 'text-yellow-500 hover:text-yellow-700'; break;
        case 'error': default: typeStyle = 'bg-red-100 border-red-300 text-red-700'; iconColor = 'text-red-500 hover:text-red-700'; break;
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

// Modale Alert Generico (Definito qui per sicurezza)
const AlertModalShell = ({ isOpen, onClose, title = "Alert", children }) => {
     if (!isOpen) return null;
     return ( <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"> <div className="relative mx-auto p-6 border-0 w-full max-w-md shadow-xl rounded-lg bg-white"> <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4"> <h3 className="text-lg font-medium text-gray-900">{title}</h3> <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal"> <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg> </button> </div> <div className="mt-2 text-sm text-gray-600">{children}</div> <div className="mt-4 pt-3 border-t border-gray-200 text-right"> <button onClick={onClose} type="button" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> OK </button> </div> </div> </div> );
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

    useEffect(() => { fetchUserModels(); }, [fetchUserModels]); // Carica al montaggio

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
                        fetchUserModels(); // Aggiorna lista modelli
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
    }, [stopPolling, logMessage, fetchUserModels]); // Aggiunto fetchUserModels

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
        setIsRealtimeActive(true); // Triggera avvio webcam
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
            else { setIsRealtimeActive(false); } // Condizioni non soddisfatte, forza stop
        } else {
            stopRealtimePrediction();
        }
        return () => { stopRealtimePrediction(); }; // Cleanup quando isRealtimeActive cambia o unmount
    }, [isRealtimeActive, startRealtimePrediction, stopRealtimePrediction, modelId]);

    useEffect(() => {
        if (trainingState === 'completed' && modelId) {
            if (!isRealtimeActiveRef.current) setIsRealtimeActive(true);
        }
        if (['error', 'idle', 'sending', 'training'].includes(trainingState)) {
             if (isRealtimeActiveRef.current) setIsRealtimeActive(false);
        }
    }, [trainingState, modelId, logMessage]);

    useEffect(() => { // Cleanup finale
        return () => { stopPolling(); stopRealtimePrediction(); };
    }, [stopPolling, stopRealtimePrediction]);


    // --- Rendering ---
    return (
        <div className="container mx-auto px-2 py-6 space-y-8 max-w-7xl">
            {/* Header Pagina */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 mb-6 gap-2">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                    <span className="inline-block bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-lg mr-2">🖼️</span>
                    Custom Image Classifier
                </h1>
                <button onClick={() => setShowTutorialModal(true)} title="Mostra tutorial" className="text-indigo-600 hover:text-indigo-800 p-2 rounded-full bg-indigo-50 border border-indigo-200 shadow-sm transition">
                    <FaInfoCircle size={24}/>
                </button>
            </div>

             {/* Messaggi Principali */}
             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* Layout a Colonne Responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Step 1: Dati & Classi */}
                <section className="lg:col-span-1 shadow-lg rounded-xl bg-white p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="text-indigo-500 text-2xl">1.</span> <span className="text-2xl">📂</span> Dati & Classi</h2>
                    {classes.map((cls) => (
                        <ClassInputBox key={cls.id} classData={cls} onNameChange={handleClassNameChange} onImagesUpdate={handleClassImagesUpdate} onRemove={removeClass} canRemove={classes.length > MIN_CLASSES}/>
                    ))}
                    {classes.length < MAX_CLASSES && (
                        <button onClick={addClass} className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg text-base font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 mt-4 transition">
                            <FaPlus className="mr-2" /> Aggiungi Classe ({classes.length}/{MAX_CLASSES})
                        </button>
                    )}
                </section>

                {/* Step 2: Training Modello */}
                <section className="lg:col-span-1 shadow-lg rounded-xl bg-white p-6 mb-6 lg:sticky lg:top-6 flex flex-col items-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="text-green-500 text-2xl">2.</span> <span className="text-2xl">⚙️</span> Training Modello</h2>
                    <button onClick={handleTrainClick} disabled={!canTrain || trainingState === 'sending' || trainingState === 'training'} className="w-full py-3 text-lg font-bold rounded-lg shadow-md flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        {(trainingState === 'sending' || trainingState === 'training') && <Spinner />} 
                        {trainingState === 'completed' && modelId && !classes.some(c => c.imageCount > 0) ? 'MODELLO CARICATO - NUOVO TRAINING?' : trainingState === 'completed' ? 'TRAINA DI NUOVO' : 'TRAINA MODELLO'}
                    </button>
                    {/* Progress bar */}
                    {(trainingState === 'sending' || trainingState === 'training') && (
                        <div className="w-full mt-4">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-2 bg-indigo-500 rounded-full animate-pulse" style={{width: trainingState === 'sending' ? '30%' : '70%'}}></div>
                            </div>
                        </div>
                    )}
                    {/* Stato Training */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${trainingState === 'completed' ? 'bg-green-100 text-green-700' : trainingState === 'training' ? 'bg-yellow-100 text-yellow-700' : trainingState === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{trainingState.toUpperCase()}</span>
                        <span className="text-sm text-gray-600">{trainingStatusMessage}</span>
                    </div>
                    {trainingError && <p className="text-xs text-red-600 text-center px-1 mt-2">{trainingError}</p>}
                    {modelId && (<p className="text-xs text-gray-500 mt-2">Model ID: <span className="font-mono">{modelId.substring(0,8)}...</span></p>)}
                    {modelAccuracy !== null && (trainingState === 'completed' || (modelId && selectedExistingModelId === modelId)) && (
                        <p className="text-base text-green-600 font-bold mt-2">Accuracy: {(modelAccuracy * 100).toFixed(1)}%</p>
                    )}
                </section>

                {/* Step 3: Predizione Realtime */}
                <section className="lg:col-span-1 shadow-lg rounded-xl bg-white p-6 mb-6 lg:sticky lg:top-6 flex flex-col items-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="text-blue-500 text-2xl">3.</span> <span className="text-2xl">🤖</span> Predizione Realtime</h2>
                    <div className="bg-black border border-gray-300 rounded-xl aspect-video overflow-hidden flex items-center justify-center relative text-white w-full max-w-md mx-auto">
                        <video ref={realtimeVideoRef} className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-300 ${isRealtimeActive ? 'opacity-100' : 'opacity-0'}`} autoPlay playsInline muted />
                        {!isRealtimeActive && (
                            <div className="z-10 p-4 text-center">
                                {(trainingState === 'completed' && modelId) || selectedExistingModelId ? (
                                    <button onClick={() => setIsRealtimeActive(true)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow text-lg font-bold transition flex items-center gap-2"><FaVideo className="mr-2"/> Avvia Webcam</button>
                                ) : (
                                    <p className="text-base text-gray-400 italic">Allena o carica un modello prima.</p>
                                )}
                </div>
                        )}
                        {isRealtimeActive && (
                            <button onClick={() => setIsRealtimeActive(false)} title="Stop Webcam" className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow hover:bg-red-600 z-20 opacity-80 hover:opacity-100"><FaVideoSlash size={18}/></button>
                        )}
                         <canvas ref={realtimeCanvasRef} style={{ display: 'none' }}></canvas>
                     </div>
                    <div className="w-full mt-4">
                     <PredictionDisplay predictions={realtimePredictions} />
                 </div>
                </section>
            </div>

            {/* Modelli salvati */}
            <section className="max-w-2xl mx-auto bg-white shadow rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center gap-2"><FaInfoCircle className="text-indigo-400"/> Modelli salvati</h3>
                {modelsError && <Alert type="error" message={modelsError} onClose={() => setModelsError('')} />}
                {isLoadingModels ? <div className="text-center"><Spinner/></div> :
                    userModels.length > 0 ? (
                        <div className="flex flex-col md:flex-row gap-2 items-center">
                            <select value={selectedExistingModelId} onChange={(e) => setSelectedExistingModelId(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm bg-white text-base focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">-- Seleziona un modello addestrato --</option>
                                {userModels.map(m => (
                                    <option key={m.id} value={m.id} disabled={m.status !== 'COMPLETED'}>
                                        {m.name || `Model ${m.id.substring(0,8)}`} ({m.status}) - Acc: {m.accuracy ? (m.accuracy*100).toFixed(1) : 'N/A'}%
                                    </option>
                                ))}
                            </select>
                            <button onClick={handleLoadExistingModel} disabled={!selectedExistingModelId || isRealtimeActive} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 disabled:opacity-50 ml-2">Carica & Avvia Webcam</button>
                            <button onClick={fetchUserModels} disabled={isLoadingModels} className="text-xs text-indigo-500 hover:underline ml-2 flex items-center">{isLoadingModels ? <Spinner small/> : <FaRedo className="mr-1"/>} Aggiorna</button>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">Nessun modello addestrato trovato.</p>
                    )}
            </section>

            {/* Console Log */}
            <section className="max-w-3xl mx-auto mb-8">
            <ConsoleLog logs={consoleLogs} onClear={() => setConsoleLogs([])} />
            </section>
            <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
            <AlertModalShell isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title={alertModalContent.title}> {alertModalContent.message} </AlertModalShell>
        </div>
    );
};

export default ImageClassifierPage;