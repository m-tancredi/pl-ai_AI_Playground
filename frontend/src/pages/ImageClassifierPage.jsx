// src/pages/ImageClassifierPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { FaUpload, FaPlus, FaInfoCircle, FaSpinner, FaTimes, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import {
    trainClassifier,
    predictImage,
    getModelStatus,
} from '../services/classifierService';
import ClassInputBox from '../components/ClassInputBox';
import PredictionDisplay from '../components/PredictionDisplay';
import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal';

// --- Componenti UI Base ---
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

const AlertModalShell = ({ isOpen, onClose, title = "Alert", children }) => {
     if (!isOpen) return null;
     return ( <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"> <div className="relative mx-auto p-6 border-0 w-full max-w-md shadow-xl rounded-lg bg-white"> <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4"> <h3 className="text-lg font-medium text-gray-900">{title}</h3> <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal"> <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg> </button> </div> <div className="mt-2 text-sm text-gray-600">{children}</div> <div className="mt-4 pt-3 border-t border-gray-200 text-right"> <button onClick={onClose} type="button" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> OK </button> </div> </div> </div> );
};
// --- Fine UI ---

const MIN_CLASSES = 2;
const MAX_CLASSES = 5;
const MIN_IMAGES_PER_CLASS = 10;

const ImageClassifierPage = () => {
    const { isAuthenticated } = useAuth();

    const [classes, setClasses] = useState([
        { id: uuidv4(), name: 'Class 1', images: [], imageCount: 0 },
        { id: uuidv4(), name: 'Class 2', images: [], imageCount: 0 }
    ]);
    const [trainingState, setTrainingState] = useState('idle');
    const [modelId, setModelId] = useState(null);
    const [trainingStatusMessage, setTrainingStatusMessage] = useState(`Requires >= ${MIN_CLASSES} classes with >= ${MIN_IMAGES_PER_CLASS} images each.`);
    const [trainingError, setTrainingError] = useState('');
    const [modelAccuracy, setModelAccuracy] = useState(null);
    const [realtimePredictions, setRealtimePredictions] = useState([]);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({ title: '', message: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [warning, setWarning] = useState('');

    const realtimeVideoRef = useRef(null);
    const realtimeCanvasRef = useRef(null);
    const realtimeLoopRef = useRef(null);
    const streamRef = useRef(null);
    const pollingIntervalRef = useRef(null);

    const trainingStateRef = useRef(trainingState);
    const isRealtimeActiveRef = useRef(isRealtimeActive);

    useEffect(() => { trainingStateRef.current = trainingState; }, [trainingState]);
    useEffect(() => { isRealtimeActiveRef.current = isRealtimeActive; }, [isRealtimeActive]);

    const logMessage = useCallback((message) => {
        console.log("UI Log:", message);
        setConsoleLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(-100));
    }, []);

    const showAlert = (title, message) => {
        setAlertModalContent({ title, message });
        setShowAlertModal(true);
    };

    const addClass = () => {
        if (classes.length < MAX_CLASSES) {
            let nextClassNumber = 1;
            const existingClassNumbers = classes.map(cls => {
                const match = cls.name.match(/^Class (\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            });
            if (existingClassNumbers.length > 0) {
                nextClassNumber = Math.max(0, ...existingClassNumbers) + 1; // Max di 0 per gestire array vuoto
            }
            if (nextClassNumber > MAX_CLASSES) nextClassNumber = MAX_CLASSES;
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

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            logMessage("Stopped polling model status.");
        }
    }, [logMessage]);

    const startTrainingPolling = useCallback((currentModelId) => {
        stopPolling();
        logMessage(`Polling status for model ID: ${currentModelId.substring(0, 8)}...`);
        pollingIntervalRef.current = setInterval(async () => {
             if (trainingStateRef.current !== 'training') {
                 console.log("Polling interval: Stopping because trainingStateRef is no longer 'training'. Current:", trainingStateRef.current);
                 stopPolling(); return;
             }
             try {
                const statusData = await getModelStatus(currentModelId);
                logMessage(`Polling check: Status = ${statusData.status}`);
                if (trainingStateRef.current === 'training') setTrainingStatusMessage(`Training status: ${statusData.status}...`);

                if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                     stopPolling();
                     if(statusData.status === 'COMPLETED'){
                         setTrainingState('completed'); setModelAccuracy(statusData.accuracy);
                         setTrainingStatusMessage(`Training completed! Acc: ${statusData.accuracy ? (statusData.accuracy * 100).toFixed(1) : 'N/A'}%`);
                         logMessage(`Training completed for ${currentModelId.substring(0,8)}.`);
                     } else {
                         setTrainingState('error'); const errorMsg = statusData.error_message || 'Unknown';
                         setTrainingError(errorMsg); setTrainingStatusMessage('Training failed.');
                         logMessage(`Training failed for ${currentModelId.substring(0, 8)}: ${errorMsg}`);
                     }
                }
            } catch (error) {
                 console.error(`Polling error for model ID ${currentModelId}:`, error);
                 logMessage(`Polling error: ${error.message}.`);
                 if (error.response?.status === 404) {
                     setTrainingState('error'); setTrainingError('Model not found during polling.'); stopPolling();
                 }
             }
        }, 5000);
    }, [stopPolling, logMessage]);

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

    const stopRealtimePrediction = useCallback(() => {
        if (!isRealtimeActiveRef.current && !realtimeLoopRef.current && !streamRef.current) return;
        logMessage("stopRealtimePrediction called");
        if (realtimeLoopRef.current) cancelAnimationFrame(realtimeLoopRef.current);
        realtimeLoopRef.current = null;
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (realtimeVideoRef.current) realtimeVideoRef.current.srcObject = null;
        setRealtimePredictions([]);
    }, [logMessage]);

    const startRealtimePrediction = useCallback(async () => {
        if (!modelId || trainingStateRef.current !== 'completed') {
             logMessage(`Cannot start prediction. Conditions: modelId=${!!modelId}, trainingState=${trainingStateRef.current}`);
             if (isRealtimeActiveRef.current) setIsRealtimeActive(false);
             return;
        }
        if (isRealtimeActiveRef.current && streamRef.current) {
            logMessage("Realtime prediction already active."); return;
        }
        logMessage("Attempting to start real-time prediction webcam..."); setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 224, height: 224 } });
            streamRef.current = stream;
            if (realtimeVideoRef.current) {
                realtimeVideoRef.current.srcObject = stream;
                await realtimeVideoRef.current.play();
                logMessage("Webcam stream started for prediction.");
            }

            const predictFrame = async () => {
                if (!isRealtimeActiveRef.current || !streamRef.current || !modelId) {
                    console.log("Prediction Loop: Stopping - main conditions failed.");
                    return;
                }
                if (!realtimeVideoRef.current || !realtimeCanvasRef.current) {
                    console.log("Prediction Loop: Stopping - video/canvas refs missing.");
                    return;
                }
                const video = realtimeVideoRef.current; const canvas = realtimeCanvasRef.current;
                if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
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
                    console.warn("Realtime prediction API error:", predictErr);
                    if (isRealtimeActiveRef.current) setRealtimePredictions([]);
                    if (predictErr.response?.status === 404) {
                        if (isRealtimeActiveRef.current) setError("Model for prediction not found. Stopping.");
                        setIsRealtimeActive(false); return; // Trigger stop via useEffect
                    }
                }
                if (isRealtimeActiveRef.current) realtimeLoopRef.current = requestAnimationFrame(predictFrame);
            };
            // Avvia il loop solo se siamo ancora nello stato attivo
            if (isRealtimeActiveRef.current) {
                realtimeLoopRef.current = requestAnimationFrame(predictFrame);
            }
        } catch (err) {
            console.error("Webcam access error:", err); setError(`Webcam error: ${err.message}.`);
            setIsRealtimeActive(false); // Trigger stop
        }
    }, [modelId, logMessage]);

    // Effetto per avviare/fermare il realtime basato su isRealtimeActive
    useEffect(() => {
        if (isRealtimeActive) {
            // Verifica le condizioni *prima* di chiamare start
            if (modelId && trainingStateRef.current === 'completed') {
                logMessage("Effect: isRealtimeActive true, starting prediction components.");
                startRealtimePrediction();
            } else {
                logMessage(`Effect: isRealtimeActive true, but conditions not met for start. Forcing false.`);
                setIsRealtimeActive(false); // Non dovrebbe partire, forza lo stop
            }
        } else {
            logMessage("Effect: isRealtimeActive false, stopping prediction components.");
            stopRealtimePrediction();
        }
        // Cleanup per questo effetto: quando isRealtimeActive cambia a false, o al unmount
        return () => {
            logMessage("Effect cleanup for isRealtimeActive: calling stopRealtimePrediction.");
            stopRealtimePrediction();
        };
    }, [isRealtimeActive, startRealtimePrediction, stopRealtimePrediction, modelId]);

    // Effetto per impostare isRealtimeActive quando il training completa
    useEffect(() => {
        if (trainingState === 'completed' && modelId) {
            if (!isRealtimeActiveRef.current) { // Imposta solo se non era già attivo
                logMessage("Effect: Training completed, setting isRealtimeActive to true.");
                setIsRealtimeActive(true);
            }
        }
        // Ferma realtime se il training fallisce o viene resettato
        if ((trainingState === 'error' || trainingState === 'idle' || trainingState === 'sending')) {
             if (isRealtimeActiveRef.current) {
                 logMessage(`Effect: Training state is ${trainingState}, setting isRealtimeActive to false.`);
                 setIsRealtimeActive(false);
             }
        }
    }, [trainingState, modelId, logMessage]);

    // Cleanup globale finale al unmount del componente
    useEffect(() => {
        return () => {
            console.log("ImageClassifierPage unmounting: final cleanup.");
            stopPolling();
            // stopRealtimePrediction sarà chiamata dal cleanup dell'effetto di isRealtimeActive
        };
    }, [stopPolling]);

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            {/* Header Pagina */}
            <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Custom Image Classifier</h1>
                <button onClick={() => setShowTutorialModal(true)} title="Show Tutorial" className="text-indigo-600 hover:text-indigo-800 p-1">
                    <FaInfoCircle size={24}/>
                </button>
            </div>

             {/* Messaggi Principali */}
             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {warning && <Alert type="warning" message={warning} onClose={() => setWarning('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

            {/* Layout a Colonne */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

                {/* Colonna Sinistra: Input Classi */}
                <div className="md:col-span-1 space-y-4">
                     <h2 className="text-lg font-semibold text-gray-700 mb-1">1. Define Classes & Capture</h2>
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
                        <button onClick={addClass} className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-400 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                           <FaPlus className="mr-2" /> Add Class ({classes.length}/{MAX_CLASSES})
                        </button>
                    )}
                </div>

                {/* Colonna Centrale: Training */}
                <div className="md:col-span-1 flex flex-col items-center space-y-4 bg-white p-6 rounded-lg shadow-lg border border-gray-200 md:sticky md:top-4 min-h-[250px]">
                     <h2 className="text-lg font-semibold text-gray-700">2. Train Model</h2>
                     <button
                        onClick={handleTrainClick}
                        disabled={!canTrain || trainingState === 'sending' || trainingState === 'training'}
                        className="w-full px-8 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg transition-colors duration-200"
                    >
                        {(trainingState === 'sending' || trainingState === 'training') && <Spinner />}
                        {trainingState === 'completed' ? 'TRAIN AGAIN' : 'TRAIN MODEL'}
                    </button>
                     <div className="text-sm text-gray-600 text-center h-12 flex items-center justify-center px-2 border rounded-md bg-gray-50 w-full">
                         {trainingStatusMessage}
                     </div>
                     {trainingError && <p className="text-xs text-red-600 text-center px-1">{trainingError}</p>}
                     {modelId && ( <p className="text-xs text-gray-500">Active Model ID: <span className="font-mono">{modelId.substring(0,8)}...</span></p> )}
                     {modelAccuracy !== null && trainingState === 'completed' && ( <p className="text-xs text-green-600 font-medium">Final Accuracy: {(modelAccuracy * 100).toFixed(1)}%</p> )}
                </div>

                {/* Colonna Destra: Predizione Realtime */}
                <div className="md:col-span-1 space-y-4 bg-white p-6 rounded-lg shadow-lg border border-gray-200 md:sticky md:top-4 min-h-[250px]">
                     <h2 className="text-lg font-semibold text-gray-700">3. Real-time Classification</h2>
                     <div className="bg-black border border-gray-300 rounded aspect-video overflow-hidden flex items-center justify-center relative text-white">
                        <video ref={realtimeVideoRef} className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-300 ${isRealtimeActive ? 'opacity-100' : 'opacity-0'}`} autoPlay playsInline muted />
                         {!isRealtimeActive && (
                             <div className="z-10 p-4 text-center">
                                 {trainingState !== 'completed' ? ( <p className="text-sm text-gray-400 italic">Train a model first.</p> )
                                 : ( <button onClick={() => setIsRealtimeActive(true)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 shadow">Start Webcam</button> )}
                             </div>
                         )}
                          {isRealtimeActive && ( <button onClick={() => setIsRealtimeActive(false)} title="Stop Webcam" className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow hover:bg-red-600 z-20 opacity-70 hover:opacity-100"><FaVideoSlash size={14}/></button> )}
                         <canvas ref={realtimeCanvasRef} style={{ display: 'none' }}></canvas>
                     </div>
                     <PredictionDisplay predictions={realtimePredictions} />
                 </div>
            </div>

            {/* Console Log */}
            <ConsoleLog logs={consoleLogs} onClear={() => setConsoleLogs([])} />

             {/* Modali */}
             <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
             <AlertModalShell isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title={alertModalContent.title}>
                 {alertModalContent.message}
             </AlertModalShell>
        </div>
    );
};

export default ImageClassifierPage;