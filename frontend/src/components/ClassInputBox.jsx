// src/components/ClassInputBox.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaCamera, FaTrashAlt, FaVideo, FaVideoSlash, FaPlayCircle, FaStopCircle, FaTimes } from 'react-icons/fa';

const ClassInputBox = ({ classData, onNameChange, onImagesUpdate, onRemove, canRemove }) => {
    const [webcamActive, setWebcamActive] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState('');
    const [capturedImagesPreview, setCapturedImagesPreview] = useState([]);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const streamRef = useRef(null);

    const isCapturingRef = useRef(isCapturing);
    const webcamActiveRef = useRef(webcamActive);

    useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
    useEffect(() => { webcamActiveRef.current = webcamActive; }, [webcamActive]);

    const MAX_PREVIEWS = 9;
    const CAPTURE_LIMIT = 100;
    const CAPTURE_INTERVAL = 200;

    // Sincronizza capturedImagesPreview con classData.images
    useEffect(() => {
        setCapturedImagesPreview(classData.images.slice(-MAX_PREVIEWS).reverse());
    }, [classData.images]);

    const handleNameChange = (event) => {
        onNameChange(classData.id, event.target.value);
    };

    const stopEverything = useCallback(() => {
        console.log(`ClassInputBox (${classData.id}): Stopping everything.`);
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCapturing(false);
        setWebcamActive(false);
    }, [classData.id]);

    const toggleWebcam = useCallback(async () => {
        if (webcamActiveRef.current) {
            stopEverything();
        } else {
            setError('');
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError('Webcam access not supported.'); return;
            }
            try {
                console.log(`ClassInputBox (${classData.id}): Requesting webcam...`);
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 224, height: 224 } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play().catch(e => { console.error("Video play error:", e); setError("Could not play webcam."); stopEverything(); });
                        setWebcamActive(true);
                        console.log(`ClassInputBox (${classData.id}): Webcam active.`);
                    };
                }
            } catch (err) {
                console.error("Webcam access error:", err);
                setError(`Webcam error: ${err.message}. Check permissions.`);
                stopEverything();
            }
        }
    }, [stopEverything, classData.id]);

    const toggleCapture = useCallback(() => {
        if (!webcamActiveRef.current) {
            setError("Activate webcam first."); return;
        }
        if (isCapturingRef.current) {
            console.log(`ClassInputBox (${classData.id}): Stopping image capture.`);
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
            setIsCapturing(false);
        } else {
            if (classData.imageCount >= CAPTURE_LIMIT) {
                setError(`Maximum ${CAPTURE_LIMIT} images per class reached.`);
                return;
            }
            console.log(`ClassInputBox (${classData.id}): Starting image capture.`);
            setError('');
            setIsCapturing(true);

            captureIntervalRef.current = setInterval(() => {
                if (!videoRef.current || !canvasRef.current || !isCapturingRef.current || !webcamActiveRef.current) {
                    console.log(`ClassInputBox (${classData.id}): Capture interval stopping (state ref check).`);
                    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
                    setIsCapturing(false);
                    return;
                }
                const video = videoRef.current; const canvas = canvasRef.current;
                if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < video.HAVE_METADATA) {
                    console.log("Video frame not ready for capture..."); return;
                }
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                onImagesUpdate(classData.id, (prevImagesInParent) => {
                     const newImagesInParent = [...prevImagesInParent, dataUrl];
                     if (newImagesInParent.length >= CAPTURE_LIMIT) {
                         console.log(`ClassInputBox (${classData.id}): Capture limit reached, stopping capture.`);
                         if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
                         setIsCapturing(false);
                     }
                     return newImagesInParent;
                 });
            }, CAPTURE_INTERVAL);
        }
    }, [classData.id, classData.imageCount, onImagesUpdate]);

    const handleDeletePreviewImage = (imageIndexToRemove) => {
        onImagesUpdate(classData.id, (prevImagesInParent) => {
            const imageToRemoveDataUrl = capturedImagesPreview[imageIndexToRemove];
            return prevImagesInParent.filter(imgDataUrl => imgDataUrl !== imageToRemoveDataUrl);
        });
    };

    useEffect(() => {
        return () => { stopEverything(); };
    }, [stopEverything]);

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4 relative transition-all duration-200 hover:shadow-xl mb-6">
            {canRemove && (
                <button 
                    onClick={() => onRemove(classData.id)} 
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all duration-200" 
                    title="Remove Class" 
                    aria-label="Remove Class"
                > 
                    <FaTrashAlt size={14}/> 
                </button>
            )}
            
            <div>
                <label htmlFor={`class-name-${classData.id}`} className="block text-sm font-semibold text-gray-700 mb-2">
                    Class Name:
                </label>
                <input 
                    type="text" 
                    id={`class-name-${classData.id}`} 
                    value={classData.name} 
                    onChange={handleNameChange} 
                    placeholder={`Class ${classData.id.substring(0, 4)}...`} 
                    className="block w-full border-0 bg-white rounded-xl shadow-sm p-4 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
            </div>
            
            {/* Layout affiancato camera/catture */}
            <div className="flex flex-col md:flex-row gap-4 items-start">
                {/* Camera */}
                <div className="flex-1 min-w-0">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-300 rounded-2xl aspect-video overflow-hidden relative flex items-center justify-center shadow-inner">
                        <video 
                            ref={videoRef} 
                            className={`w-full h-full object-contain ${!webcamActive ? 'hidden' : ''}`} 
                            autoPlay 
                            playsInline 
                            muted 
                        />
                        {!webcamActive && ( 
                            <FaCamera className="text-gray-400 text-4xl"/> 
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    </div>
                    
                    {error && (
                        <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-200">
                            <p className="text-xs text-red-600 font-medium">{error}</p>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button 
                            onClick={toggleWebcam} 
                            className={`w-full px-4 py-3 text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                                webcamActive 
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500' 
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 focus:ring-blue-500 shadow-lg'
                            }`}
                        >
                            {webcamActive ? <FaVideoSlash className="mr-2"/> : <FaVideo className="mr-2"/>}
                            {webcamActive ? 'Stop Webcam' : 'Activate Webcam'}
                        </button>
                        
                        <button 
                            onClick={toggleCapture} 
                            disabled={!webcamActive || (classData.imageCount >= CAPTURE_LIMIT && !isCapturing)} 
                            className={`w-full px-4 py-3 text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                                isCapturing 
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-red-500 shadow-lg' 
                                : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 focus:ring-green-500 shadow-lg'
                            }`}
                        >
                            {isCapturing ? <FaStopCircle className="mr-2"/> : <FaPlayCircle className="mr-2"/>}
                            {isCapturing ? 'Stop Capture' : 'Start Capture'}
                        </button>
                    </div>
                    
                    <div className="text-right mt-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                            classData.imageCount >= CAPTURE_LIMIT 
                            ? 'bg-red-100 text-red-700' 
                            : classData.imageCount >= 10 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {classData.imageCount} / {CAPTURE_LIMIT} images
                        </span>
                    </div>
                </div>
                
                {/* Catture (thumbnail) */}
                {capturedImagesPreview.length > 0 && (
                    <div className="w-full md:w-1/3 flex-shrink-0 mt-4 md:mt-0">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Recent captures:</p>
                        <div className="grid grid-cols-3 gap-2">
                            {capturedImagesPreview.map((imgSrc, index) => (
                                <div key={`preview-${classData.id}-${index}`} className="aspect-square bg-gray-200 rounded-xl overflow-hidden relative group shadow-sm hover:shadow-md transition-shadow">
                                    <img src={imgSrc} alt={`Capture ${index + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => handleDeletePreviewImage(index)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 shadow-lg"
                                        title="Delete this capture"
                                        aria-label="Delete this capture"
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassInputBox;