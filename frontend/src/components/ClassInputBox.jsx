// src/components/ClassInputBox.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaCamera, FaTrashAlt, FaVideo, FaVideoSlash } from 'react-icons/fa';

const Spinner = () => <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500 mr-1"></div>;

const ClassInputBox = ({ classData, onNameChange, onImagesUpdate, onRemove, canRemove }) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState('');
    const [capturedImagesPreview, setCapturedImagesPreview] = useState([]); // Store only few previews
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const streamRef = useRef(null); // Store the stream reference

    const MAX_PREVIEWS = 9; // Limit previews shown in UI
    const CAPTURE_LIMIT = 100; // Max images per class
    const CAPTURE_INTERVAL = 200; // Milliseconds between captures

    // Update previews when parent data changes (e.g., on load)
    useEffect(() => {
        setCapturedImagesPreview(classData.images.slice(-MAX_PREVIEWS));
    }, [classData.images]);

    const handleNameChange = (event) => {
        onNameChange(classData.id, event.target.value);
    };

    const stopCapture = useCallback(() => {
        console.log(`Stopping capture for class ${classData.id}`);
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCapturing(false);
    }, [classData.id]); // Include classData.id in dependencies if needed, though likely stable

    const startCapture = async () => {
        if (isCapturing) {
             stopCapture();
             return;
        }
        setError('');
        setCapturedImagesPreview([]); // Clear previews for new capture session

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('Webcam access is not supported by this browser.');
            return;
        }

        try {
            console.log(`Starting capture for class ${classData.id}`);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 224, height: 224 } }); // Request specific size
            streamRef.current = stream; // Store stream reference
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play(); // Ensure video plays
            }
            setIsCapturing(true);

            // Reset images in parent state for this class
            onImagesUpdate(classData.id, []);

            // Start capture loop
            captureIntervalRef.current = setInterval(() => {
                if (!videoRef.current || !canvasRef.current) return;

                const video = videoRef.current;
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                // Set canvas dimensions to match video (important!)
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw video frame onto canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Get data URL
                const dataUrl = canvas.toDataURL('image/jpeg'); // Use JPEG for smaller size

                // Update parent state (pass new array)
                onImagesUpdate(classData.id, (prevImages) => {
                     const newImages = [...prevImages, dataUrl];
                     // Update local preview state (limited)
                     setCapturedImagesPreview(newImages.slice(-MAX_PREVIEWS));
                     // Stop capture if limit reached
                     if (newImages.length >= CAPTURE_LIMIT) {
                         console.log(`Capture limit reached for class ${classData.id}`);
                         stopCapture();
                     }
                     return newImages; // Return new array to parent
                 });

            }, CAPTURE_INTERVAL);

        } catch (err) {
            console.error("Webcam access error:", err);
            setError(`Webcam error: ${err.message}. Check browser permissions.`);
            setIsCapturing(false);
            if (streamRef.current) { // Ensure stream stopped on error
                 streamRef.current.getTracks().forEach(track => track.stop());
                 streamRef.current = null;
            }
        }
    };

     // Ensure capture stops when component unmounts
     useEffect(() => {
         return () => {
             stopCapture();
         };
     }, [stopCapture]);

    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3 relative">
             {/* Remove Button */}
             {canRemove && (
                 <button
                    onClick={() => onRemove(classData.id)}
                    className="absolute top-1 right-1 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100"
                    title="Remove Class"
                    aria-label="Remove Class"
                >
                    <FaTrashAlt size={12}/>
                </button>
             )}

            {/* Class Name Input */}
            <div>
                <label htmlFor={`class-name-${classData.id}`} className="block text-sm font-medium text-gray-700">Class Name:</label>
                <input
                    type="text"
                    id={`class-name-${classData.id}`}
                    value={classData.name}
                    onChange={handleNameChange}
                    placeholder={`Class ${classData.id.substring(0, 4)}...`}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>

            {/* Webcam Area */}
            <div className="bg-gray-100 border rounded aspect-video overflow-hidden relative flex items-center justify-center">
                 <video
                    ref={videoRef}
                    className={`w-full h-full object-contain ${!isCapturing ? 'hidden' : ''}`}
                    autoPlay
                    playsInline
                    muted // Mute to avoid feedback loops
                />
                 {!isCapturing && (
                     <FaCamera className="text-gray-300 text-4xl"/>
                 )}
                 {/* Canvas for capturing frames (hidden) */}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
             </div>
             {error && <p className="text-xs text-red-600">{error}</p>}

            {/* Capture Button & Counter */}
            <div className="flex items-center justify-between">
                 <button
                    onClick={startCapture}
                    className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCapturing ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:ring-indigo-500'}`}
                    disabled={classData.imageCount >= CAPTURE_LIMIT && !isCapturing} // Disable start if limit reached
                 >
                    {isCapturing ? <FaVideoSlash className="mr-2"/> : <FaVideo className="mr-2"/>}
                    {isCapturing ? 'Stop Capture' : 'Start Capture'}
                 </button>
                 <span className={`text-sm font-medium ${classData.imageCount >= CAPTURE_LIMIT ? 'text-red-600' : 'text-gray-700'}`}>
                    {classData.imageCount} / {CAPTURE_LIMIT} images
                 </span>
             </div>

            {/* Image Previews */}
             {capturedImagesPreview.length > 0 && (
                 <div className="mt-2">
                     <p className="text-xs text-gray-500 mb-1">Recent captures:</p>
                     <div className="grid grid-cols-3 gap-1">
                        {capturedImagesPreview.map((imgSrc, index) => (
                            <div key={index} className="aspect-square bg-gray-200 rounded overflow-hidden">
                                <img src={imgSrc} alt={`Capture ${index + 1}`} className="w-full h-full object-cover" />
                             </div>
                         ))}
                     </div>
                 </div>
             )}
        </div>
    );
};

export default ClassInputBox;