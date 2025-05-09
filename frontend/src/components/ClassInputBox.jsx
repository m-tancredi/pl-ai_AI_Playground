// src/components/ClassInputBox.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaCamera, FaTrashAlt, FaVideo, FaVideoSlash, FaPlayCircle, FaStopCircle, FaTimes } from 'react-icons/fa'; // Aggiunta FaTimes

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

    const MAX_PREVIEWS = 9; // Mostra solo le ultime N preview
    const CAPTURE_LIMIT = 100;
    const CAPTURE_INTERVAL = 200;

    // Sincronizza capturedImagesPreview con classData.images
    useEffect(() => {
        // Mostra le ultime MAX_PREVIEWS immagini
        setCapturedImagesPreview(classData.images.slice(-MAX_PREVIEWS).reverse()); // reverse() per mostrare le più recenti prima
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
        if (isCapturingRef.current) { // Sta catturando -> Ferma
            console.log(`ClassInputBox (${classData.id}): Stopping image capture.`);
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
            setIsCapturing(false);
        } else { // Non sta catturando -> Avvia (se non al limite)
            if (classData.imageCount >= CAPTURE_LIMIT) {
                // Non usiamo showAlert qui perché non è passato come prop, usiamo setError
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
                    setIsCapturing(false); // Assicura che lo stato sia corretto
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

    // --- NUOVA FUNZIONE PER ELIMINARE IMMAGINE DALLA PREVIEW ---
    const handleDeletePreviewImage = (imageIndexToRemove) => {
        // L'indice in capturedImagesPreview è l'inverso dell'indice in classData.images
        // a causa del .reverse() e .slice(-MAX_PREVIEWS)
        // Se capturedImagesPreview mostra img [c,b,a] da [a,b,c,d,e]
        // e imageIndexToRemove è 0 (img c), l'indice reale è (total - MAX_PREVIEWS + 0) se MAX_PREVIEWS < total
        // o (total - 1 - imageIndexToRemove) se MAX_PREVIEWS >= total

        // Modo più semplice: aggiorna l'array completo in onImagesUpdate
        onImagesUpdate(classData.id, (prevImagesInParent) => {
            // Trova l'indice reale nell'array completo
            // `capturedImagesPreview` è mostrato in ordine inverso, e potrebbe essere un sottoinsieme
            // Per semplicità, assumiamo che l'utente stia eliminando dall'array completo
            // e che `imageIndexToRemove` sia l'indice dell'immagine nell'array `classData.images`
            // Questo richiede di passare l'indice corretto dal bottone di eliminazione.
            // SE `imageIndexToRemove` si riferisce all'indice in `capturedImagesPreview`:
            const actualIndexInFullArray = classData.images.length - 1 - (capturedImagesPreview.length - 1 - imageIndexToRemove);
            // Questo è complicato. È più semplice passare l'URL o un ID univoco dell'immagine.
            // Per ora, assumiamo che `imageIndexToRemove` sia l'indice dell'immagine *nell'array completo*
            // OPPURE, ancora più semplice, passiamo l'URL dell'immagine da rimuovere.

            // Passiamo l'URL dell'immagine da rimuovere (più robusto)
            const imageToRemoveDataUrl = capturedImagesPreview[imageIndexToRemove];
            return prevImagesInParent.filter(imgDataUrl => imgDataUrl !== imageToRemoveDataUrl);
        });
        // `capturedImagesPreview` si aggiornerà automaticamente tramite l'useEffect
    };

    useEffect(() => { // Cleanup
        return () => { stopEverything(); };
    }, [stopEverything]);

    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3 relative">
            {canRemove && ( <button onClick={() => onRemove(classData.id)} className="absolute top-1 right-1 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100" title="Remove Class" aria-label="Remove Class"> <FaTrashAlt size={12}/> </button> )}
            <div>
                <label htmlFor={`class-name-${classData.id}`} className="block text-sm font-medium text-gray-700">Class Name:</label>
                <input type="text" id={`class-name-${classData.id}`} value={classData.name} onChange={handleNameChange} placeholder={`Class ${classData.id.substring(0, 4)}...`} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
            <div className="bg-gray-100 border rounded aspect-video overflow-hidden relative flex items-center justify-center">
                 <video ref={videoRef} className={`w-full h-full object-contain ${!webcamActive ? 'hidden' : ''}`} autoPlay playsInline muted />
                 {!webcamActive && ( <FaCamera className="text-gray-300 text-4xl"/> )}
                 <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={toggleWebcam} className={`w-full px-3 py-2 text-sm font-medium rounded-md shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 ${webcamActive ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-500'}`}>
                    {webcamActive ? <FaVideoSlash className="mr-2"/> : <FaVideo className="mr-2"/>}
                    {webcamActive ? 'Stop Webcam' : 'Activate Webcam'}
                </button>
                <button onClick={toggleCapture} disabled={!webcamActive || (classData.imageCount >= CAPTURE_LIMIT && !isCapturing)} className={`w-full px-3 py-2 text-sm font-medium rounded-md shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isCapturing ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500' : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500'}`}>
                    {isCapturing ? <FaStopCircle className="mr-2"/> : <FaPlayCircle className="mr-2"/>}
                    {isCapturing ? 'Stop Capture' : 'Start Capture'}
                </button>
            </div>
            <div className="text-right">
                 <span className={`text-sm font-medium ${classData.imageCount >= CAPTURE_LIMIT ? 'text-red-600' : 'text-gray-700'}`}>
                    {classData.imageCount} / {CAPTURE_LIMIT} images
                 </span>
            </div>

            {/* Image Previews con Bottone Delete */}
             {capturedImagesPreview.length > 0 && (
                 <div className="mt-2">
                     <p className="text-xs text-gray-500 mb-1">Recent captures ({capturedImagesPreview.length} shown):</p>
                     <div className="grid grid-cols-3 gap-1">
                        {capturedImagesPreview.map((imgSrc, index) => ( // L'indice qui è relativo a capturedImagesPreview
                            <div key={`preview-${classData.id}-${index}`} className="aspect-square bg-gray-200 rounded overflow-hidden relative group">
                                <img src={imgSrc} alt={`Capture ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => handleDeletePreviewImage(index)} // Passa l'indice della preview
                                    className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-opacity"
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
    );
};

export default ClassInputBox;