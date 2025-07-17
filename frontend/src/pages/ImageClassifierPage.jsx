// src/pages/ImageClassifierPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { FaUpload, FaPlus, FaSpinner, FaTimes, FaVideo, FaVideoSlash, FaRedo, FaBrain, FaRobot, FaImages, FaQuestionCircle, FaPlay, FaStop } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

// Importa servizi API
import {
    trainClassifier,
    predictImage,
    getModelStatus,
    listUserModels,
    updateModel,
    downloadModel,
} from '../services/classifierService';

// Importa componenti
import ClassInputBox from '../components/ClassInputBox';
import PredictionDisplay from '../components/PredictionDisplay';
import ConsoleLog from '../components/ConsoleLog';
import TutorialModal from '../components/TutorialModal';
import WorkflowConnector from '../components/WorkflowConnector';
import ModelManager from '../components/ModelManager';

// --- Componenti UI minimali ---
const MinimalButton = ({ children, variant = 'primary', ...props }) => {
    const baseClass = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClass = {
        primary: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg",
        secondary: "bg-gray-100 hover:bg-gray-200 text-gray-800 shadow",
        success: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg",
        danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
    };
    return (
        <button {...props} className={`${baseClass} ${variantClass[variant]} ${props.className || ''}`}>
            {children}
        </button>
    );
};

const MinimalCard = ({ children, className = '', title, icon, action }) => (
    <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
        {title && (
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">{icon}</div>}
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                </div>
                {action}
            </div>
        )}
        {children}
    </div>
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
        <div className={`max-w-7xl mx-auto ${colorClasses[type]} border px-4 py-3 rounded-xl flex items-center justify-between mb-6`}>
            <span className="font-medium">{message}</span>
            {onClose && (
                <button onClick={onClose} className="text-current hover:opacity-70 font-bold text-lg">×</button>
            )}
        </div>
    );
};

// --- Costanti ---
const MIN_CLASSES = 2;
const MAX_CLASSES = 5;
const MIN_IMAGES_PER_CLASS = 10;

// --- Componente Pagina ---
const ImageClassifierPage = () => {
    const { isAuthenticated } = useAuth();

    // Stati principali
    const [classes, setClasses] = useState([
        { id: uuidv4(), name: 'Class 1', images: [], imageCount: 0 },
        { id: uuidv4(), name: 'Class 2', images: [], imageCount: 0 }
    ]);

    const [trainingState, setTrainingState] = useState('idle');
    const [modelId, setModelId] = useState(null);
    const [modelName, setModelName] = useState('');
    const [trainingStatusMessage, setTrainingStatusMessage] = useState(`Requires >= ${MIN_CLASSES} classes with >= ${MIN_IMAGES_PER_CLASS} images each.`);
    const [trainingError, setTrainingError] = useState('');
    const [modelAccuracy, setModelAccuracy] = useState(null);

    const [realtimePredictions, setRealtimePredictions] = useState([]);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);

    const [userModels, setUserModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [selectedExistingModelId, setSelectedExistingModelId] = useState('');

    const [consoleLogs, setConsoleLogs] = useState([]);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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

    // --- Gestione Classi ---
    const addClass = () => {
        if (classes.length < MAX_CLASSES) {
            let nextClassNumber = Math.max(...classes.map(cls => {
                const match = cls.name.match(/^Class (\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            }), 0) + 1;
            
            setClasses(prev => [...prev, { id: uuidv4(), name: `Class ${nextClassNumber}`, images: [], imageCount: 0 }]);
            logMessage(`Added new class: Class ${nextClassNumber}`);
        }
    };

    const removeClass = (idToRemove) => {
        if (classes.length > MIN_CLASSES) {
            setClasses(prev => prev.filter(cls => cls.id !== idToRemove));
            logMessage(`Removed class slot.`);
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

    // --- Calcoli per il workflow ---
    const { canTrain, totalImages, validClassCount } = useMemo(() => {
        const validClasses = classes.filter(cls => cls.name.trim() !== '' && cls.imageCount >= MIN_IMAGES_PER_CLASS);
        const total = classes.reduce((sum, cls) => sum + cls.imageCount, 0);
        return {
            canTrain: validClasses.length >= MIN_CLASSES,
            totalImages: total,
            validClassCount: validClasses.length
        };
    }, [classes]);

    // --- Gestione Training ---
    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            logMessage("Polling stopped.");
        }
    }, [logMessage]);

    const startTrainingPolling = useCallback((currentModelId) => {
        stopPolling();
        logMessage(`Started polling for model ${currentModelId.substring(0,8)}...`);
        
        pollingIntervalRef.current = setInterval(async () => {
            if (trainingStateRef.current !== 'training') {
                stopPolling();
                return;
            }
            
            try {
                const statusData = await getModelStatus(currentModelId);
                logMessage(`Training status: ${statusData.status}`);
                
                if (statusData.status === 'COMPLETED') {
                    stopPolling();
                    setTrainingState('completed');
                    setModelAccuracy(statusData.accuracy);
                    setTrainingStatusMessage(`Training completed! Accuracy: ${statusData.accuracy ? (statusData.accuracy * 100).toFixed(1) : 'N/A'}%`);
                    logMessage(`Training completed successfully.`);
                    fetchUserModels();
                } else if (statusData.status === 'FAILED') {
                    stopPolling();
                    setTrainingState('error');
                    setTrainingError(statusData.error_message || 'Training failed');
                    setTrainingStatusMessage('Training failed.');
                    logMessage(`Training failed: ${statusData.error_message}`);
                }
            } catch (error) {
                console.error('Polling error:', error);
                if (error.response?.status === 404) {
                    stopPolling();
                    setTrainingState('error');
                    setTrainingError('Model not found.');
                }
            }
        }, 3000);
    }, [stopPolling, logMessage]);

    const handleTrainClick = async () => {
        if (!canTrain) return;

        setTrainingState('sending');
        setTrainingStatusMessage('Preparing training data...');
        setTrainingError('');
        setModelId(null);
        setModelName('');
        setModelAccuracy(null);
        setIsRealtimeActive(false);
        setError('');
        setSuccess('');

        const validClasses = classes.filter(cls => cls.name.trim() !== '' && cls.imageCount >= MIN_IMAGES_PER_CLASS);
        let allImages = [];
        let allLabels = [];
        let classNames = [];

        validClasses.forEach((cls, index) => {
            allImages = [...allImages, ...cls.images];
            allLabels = [...allLabels, ...Array(cls.imageCount).fill(index)];
            classNames.push(cls.name.trim());
        });

        logMessage(`Training ${allImages.length} images for ${classNames.length} classes...`);

        try {
            const payload = { images: allImages, labels: allLabels, class_names: classNames };
            const response = await trainClassifier(payload);
            
            setModelId(response.model_id);
            setTrainingState('training');
            setTrainingStatusMessage('Training in progress...');
            logMessage(`Training started. Model ID: ${response.model_id.substring(0, 8)}...`);
            
            startTrainingPolling(response.model_id);
            setSuccess('Training started successfully!');
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to start training.';
            setTrainingState('error');
            setTrainingError(errorMsg);
            setTrainingStatusMessage('Training failed to start.');
            logMessage(`Training error: ${errorMsg}`);
            setError('Failed to start training.');
        }
    };

    // --- Gestione Predizioni Real-time ---
    const stopRealtimePrediction = useCallback(() => {
        if (realtimeLoopRef.current) cancelAnimationFrame(realtimeLoopRef.current);
        realtimeLoopRef.current = null;
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (realtimeVideoRef.current) realtimeVideoRef.current.srcObject = null;
        setRealtimePredictions([]);
        logMessage("Realtime prediction stopped.");
    }, [logMessage]);

    const startRealtimePrediction = useCallback(async () => {
        if (!modelId || trainingState !== 'completed') return;

        logMessage("Starting webcam for realtime prediction...");
        setError('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 224, height: 224 } });
            streamRef.current = stream;
            
            if (realtimeVideoRef.current) {
                realtimeVideoRef.current.srcObject = stream;
                await realtimeVideoRef.current.play();
                logMessage("Webcam started successfully.");
            }

            const predictFrame = async () => {
                if (!isRealtimeActiveRef.current || !streamRef.current || !modelId) return;
                
                const video = realtimeVideoRef.current;
                const canvas = realtimeCanvasRef.current;
                
                if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
                    if (isRealtimeActiveRef.current) {
                        realtimeLoopRef.current = requestAnimationFrame(predictFrame);
                    }
                    return;
                }

                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                try {
                    const result = await predictImage({ image: frameDataUrl, model_id: modelId });
                    if (isRealtimeActiveRef.current) {
                        setRealtimePredictions(result.predictions || []);
                    }
                } catch (predictErr) {
                    console.warn("Prediction error:", predictErr);
                    if (isRealtimeActiveRef.current) {
                        setRealtimePredictions([]);
                    }
                }

                if (isRealtimeActiveRef.current) {
                    realtimeLoopRef.current = requestAnimationFrame(predictFrame);
                }
            };

            realtimeLoopRef.current = requestAnimationFrame(predictFrame);
        } catch (err) {
            console.error("Webcam error:", err);
            setError(`Webcam error: ${err.message}`);
            setIsRealtimeActive(false);
        }
    }, [modelId, trainingState, logMessage]);

    // --- Gestione Modelli Utente ---
    const fetchUserModels = useCallback(async () => {
        if (!isAuthenticated) return;
        
        setIsLoadingModels(true);
        try {
            const models = await listUserModels();
            setUserModels(Array.isArray(models) ? models : []);
            logMessage(`Fetched ${Array.isArray(models) ? models.length : 0} user models.`);
        } catch (err) {
            console.error('Error fetching models:', err);
            setUserModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    }, [isAuthenticated, logMessage]);

    const handleLoadExistingModel = () => {
        if (!selectedExistingModelId) return;
        
        const modelToLoad = userModels.find(m => m.id === selectedExistingModelId);
        if (!modelToLoad || modelToLoad.status !== 'COMPLETED') return;

        logMessage(`Loading model ${modelToLoad.id.substring(0,8)}...`);
        setModelId(modelToLoad.id);
        setModelName(modelToLoad.name || '');
        setModelAccuracy(modelToLoad.accuracy);
        setTrainingState('completed');
        setTrainingStatusMessage(`Loaded: ${modelToLoad.name || 'Model'}`);
        setSuccess(`Model loaded successfully!`);
    };

    // --- Gestione Salvataggio/Rinomina/Download Modello ---
    const handleSaveModel = async (modelId, modelName) => {
        try {
            logMessage(`Saving model ${modelId.substring(0,8)} as "${modelName}"`);
            await updateModel(modelId, { name: modelName });
            setModelName(modelName);
            await fetchUserModels();
            logMessage(`Model saved successfully as "${modelName}"`);
        } catch (error) {
            logMessage(`Error saving model: ${error.message}`);
            throw error;
        }
    };

    const handleRenameModel = async (modelId, newName) => {
        try {
            logMessage(`Renaming model ${modelId.substring(0,8)} to "${newName}"`);
            await updateModel(modelId, { name: newName });
            setModelName(newName);
            await fetchUserModels();
            logMessage(`Model renamed successfully to "${newName}"`);
        } catch (error) {
            logMessage(`Error renaming model: ${error.message}`);
            throw error;
        }
    };

    const handleDownloadModel = async (modelId) => {
        try {
            logMessage(`Downloading model ${modelId.substring(0,8)}...`);
            await downloadModel(modelId);
            logMessage(`Model downloaded successfully`);
        } catch (error) {
            logMessage(`Error downloading model: ${error.message}`);
            throw error;
        }
    };

    // --- Effetti ---
    useEffect(() => {
        if (isRealtimeActive && trainingState === 'completed' && modelId) {
            startRealtimePrediction();
        } else {
            stopRealtimePrediction();
        }
        return () => stopRealtimePrediction();
    }, [isRealtimeActive, trainingState, modelId, startRealtimePrediction, stopRealtimePrediction]);

    useEffect(() => {
        fetchUserModels();
    }, [fetchUserModels]);

    useEffect(() => {
        return () => {
            stopPolling();
            stopRealtimePrediction();
        };
    }, [stopPolling, stopRealtimePrediction]);

    // --- Rendering ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Image Classifier AI</h1>
                    <p className="text-gray-600">Crea il tuo classificatore di immagini personalizzato</p>
                </div>

                {/* Alerts */}
                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

                {/* Workflow Connector */}
                <WorkflowConnector
                    classesReady={canTrain}
                    trainingComplete={trainingState === 'completed'}
                    predictionActive={isRealtimeActive}
                    trainingError={trainingError}
                    classCount={validClassCount}
                    totalImages={totalImages}
                />

                {/* Main Content */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Step 1: Classi */}
                    <div className="xl:col-span-1">
                        <MinimalCard title="1. Definisci le Classi" icon={<FaImages />}>
                            <div className="space-y-4">
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
                                    <MinimalButton
                                        onClick={addClass}
                                        variant="secondary"
                                        className="w-full"
                                    >
                                        <FaPlus />
                                        Aggiungi Classe ({classes.length}/{MAX_CLASSES})
                                    </MinimalButton>
                                )}
                            </div>
                        </MinimalCard>
                    </div>

                    {/* Step 2: Training */}
                    <div className="xl:col-span-1">
                        <MinimalCard title="2. Addestra il Modello" icon={<FaBrain />}>
                            <div className="space-y-4">
                                <MinimalButton
                                    onClick={handleTrainClick}
                                    disabled={!canTrain || trainingState === 'sending' || trainingState === 'training'}
                                    className="w-full"
                                >
                                    {(trainingState === 'sending' || trainingState === 'training') && (
                                        <FaSpinner className="animate-spin" />
                                    )}
                                    {trainingState === 'completed' ? 'Addestra Nuovo Modello' : 'Avvia Addestramento'}
                                </MinimalButton>

                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-sm text-gray-600 mb-2">Stato:</p>
                                    <p className="text-sm font-medium text-gray-800">{trainingStatusMessage}</p>
                                    
                                    {trainingError && (
                                        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                            <p className="text-sm text-red-600">{trainingError}</p>
                                        </div>
                                    )}
                                    
                                    {modelAccuracy && (
                                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                            <p className="text-sm text-green-600 font-medium">
                                                Accuratezza: {(modelAccuracy * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </MinimalCard>

                        {/* Gestione Modello */}
                        <div className="mt-6">
                            <ModelManager
                                modelId={modelId}
                                modelName={modelName}
                                modelAccuracy={modelAccuracy}
                                isTrainingComplete={trainingState === 'completed'}
                                onSaveModel={handleSaveModel}
                                onRenameModel={handleRenameModel}
                                onDownloadModel={handleDownloadModel}
                            />
                        </div>
                    </div>

                    {/* Step 3: Predizioni */}
                    <div className="xl:col-span-1">
                        <MinimalCard title="3. Test in Tempo Reale" icon={<FaRobot />}>
                            <div className="space-y-4">
                                {/* Webcam */}
                                <div className="bg-gray-900 rounded-2xl aspect-video overflow-hidden relative">
                                    <video
                                        ref={realtimeVideoRef}
                                        className={`w-full h-full object-cover ${!isRealtimeActive ? 'hidden' : ''}`}
                                        autoPlay
                                        playsInline
                                        muted
                                    />
                                    <canvas ref={realtimeCanvasRef} className="hidden" />
                                    
                                    {!isRealtimeActive && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white">
                                            <div className="text-center">
                                                <FaVideo className="text-4xl mb-4 opacity-50" />
                                                <p className="text-sm opacity-75">Webcam non attiva</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Controlli Webcam */}
                                <div className="flex gap-3">
                                    <MinimalButton
                                        onClick={() => setIsRealtimeActive(!isRealtimeActive)}
                                        disabled={trainingState !== 'completed'}
                                        variant={isRealtimeActive ? "danger" : "success"}
                                        className="flex-1"
                                    >
                                        {isRealtimeActive ? (
                                            <>
                                                <FaStop />
                                                Ferma Webcam
                                            </>
                                        ) : (
                                            <>
                                                <FaPlay />
                                                Avvia Webcam
                                            </>
                                        )}
                                    </MinimalButton>
                                </div>

                                {/* Predizioni */}
                                <PredictionDisplay predictions={realtimePredictions} />
                            </div>
                        </MinimalCard>
                    </div>
                </div>

                {/* Modelli Esistenti */}
                {userModels.length > 0 && (
                    <div className="mt-8">
                        <MinimalCard 
                            title="Modelli Salvati" 
                            icon={<FaRobot />}
                            action={
                                <MinimalButton
                                    onClick={fetchUserModels}
                                    disabled={isLoadingModels}
                                    variant="secondary"
                                >
                                    {isLoadingModels ? <FaSpinner className="animate-spin" /> : <FaRedo />}
                                    Aggiorna
                                </MinimalButton>
                            }
                        >
                            <div className="flex gap-4 items-center">
                                <select
                                    value={selectedExistingModelId}
                                    onChange={(e) => setSelectedExistingModelId(e.target.value)}
                                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="">Seleziona un modello...</option>
                                    {userModels.map(m => (
                                        <option key={m.id} value={m.id} disabled={m.status !== 'COMPLETED'}>
                                            {m.name || `Model ${m.id.substring(0,8)}`} - {m.accuracy ? (m.accuracy*100).toFixed(1) : 'N/A'}%
                                        </option>
                                    ))}
                                </select>
                                <MinimalButton
                                    onClick={handleLoadExistingModel}
                                    disabled={!selectedExistingModelId}
                                    variant="primary"
                                >
                                    Carica Modello
                                </MinimalButton>
                            </div>
                        </MinimalCard>
                    </div>
                )}

                {/* Console Log */}
                <div className="mt-8">
                    <ConsoleLog logs={consoleLogs} onClear={() => setConsoleLogs([])} />
                </div>

                {/* Tutorial Modal */}
                <TutorialModal
                    isOpen={showTutorialModal}
                    onClose={() => setShowTutorialModal(false)}
                />
            </div>
        </div>
    );
};

export default ImageClassifierPage;