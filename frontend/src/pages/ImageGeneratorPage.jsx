import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    generateTextToImage,
    generateImageToImage,
    enhancePrompt,
} from '../services/imageGeneratorService'; // Assicurati che il path sia corretto
import {
    saveGeneratedImage,
    listUserGalleryImages,
    updateImageMetadata,
    deleteGalleryImage,
} from '../services/imageGalleryService'; // Servizio galleria
import { useAuth } from '../context/AuthContext'; // Importa hook per autenticazione

// Importa i componenti UI necessari
import ImageCard from '../components/ImageCard';
import ImageDetailModal from '../components/ImageDetailModal';
import ImageEditModal from '../components/ImageEditModal';

// --- Componenti UI Semplici (Spinner, Alert) ---
const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${small ? 'h-4 w-4 mr-1' : 'h-5 w-5 mr-2'} align-middle`}></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const baseStyle = 'border px-4 py-3 rounded relative shadow-sm';
    const typeStyle = type === 'error'
        ? 'bg-red-100 border-red-400 text-red-700'
        : 'bg-green-100 border-green-400 text-green-700';
    if (!message) return null;
    return (
        <div className={`${baseStyle} ${typeStyle}`} role="alert">
            <span className="block sm:inline">{message}</span>
            {onClose && (
                 <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close alert">
                     <svg className="fill-current h-6 w-6 opacity-50 hover:opacity-100" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                 </button>
            )}
        </div>
    );
};
// --- Fine Componenti UI ---

const ImageGeneratorPage = () => {
    // Ottieni stato autenticazione dal contesto
    const { isAuthenticated } = useAuth();

    // Stati Input
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [model, setModel] = useState('dalle');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageStrength, setImageStrength] = useState(0.35);
    const [imagePreview, setImagePreview] = useState(null); // URL Blob per preview locale

    // Stati Output/Risultati
    // Memorizza i dati dell'ultima immagine generata (URL relativo!)
    const [generatedImageData, setGeneratedImageData] = useState(null); // { relative_url, prompt, model, style }

    // Stati UI
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Stati Galleria
    const [galleryImages, setGalleryImages] = useState([]); // Conterrà oggetti con url relativo
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [galleryError, setGalleryError] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const [deletingImageId, setDeletingImageId] = useState(null);

    // Stati Modali Galleria
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedImageForModal, setSelectedImageForModal] = useState(null);

    const fileInputRef = useRef(null);
    
    const API_GATEWAY_ORIGIN = 'http://localhost:8080'; // Definisci la base corretta
    // Funzione Helper per costruire URL completo (essenziale)
    const buildFullImageUrl = useCallback((relativeUrl) => {
        if (!relativeUrl || typeof relativeUrl !== 'string' || !relativeUrl.startsWith('/media/')) {
            return null;
        }
        const cleanRelativeUrl = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
        return `${API_GATEWAY_ORIGIN}${cleanRelativeUrl}`; // Usa la base hardcodata
    }, []);

    // Cleanup preview blob URL
    useEffect(() => {
        return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
    }, [imagePreview]);

    // Fetch Galleria
    const fetchGallery = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingGallery(true);
        setGalleryError('');
        try {
            const images = await listUserGalleryImages();
            console.log("Fetched Gallery Images (raw response):", images); // DEBUG
            setGalleryImages(images || []); // Assicura sia un array
        } catch (err) {
            setGalleryError('Failed to load gallery. Please try refreshing.');
            console.error("Gallery fetch error:", err);
        } finally {
            setIsLoadingGallery(false);
        }
    }, [isAuthenticated]); // Ricarica solo se cambia stato auth

    // Carica galleria all'apertura (se vuota)
    useEffect(() => {
        if (showGallery && galleryImages.length === 0 && !isLoadingGallery) {
            fetchGallery();
        }
    }, [showGallery, galleryImages.length, isLoadingGallery, fetchGallery]);

    // Gestione cambio file
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        setError(''); setSuccess(''); // Pulisci messaggi
        setGeneratedImageData(null); // Resetta immagine generata precedente
        if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
            setSelectedFile(file);
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImagePreview(URL.createObjectURL(file));
        } else {
            setSelectedFile(null);
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
            if (file) setError('Invalid file type. Please upload PNG or JPEG.');
            if(fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Reset Form
    const resetForm = useCallback(() => {
        setPrompt(''); setStyle(''); setModel('dalle'); setAspectRatio('1:1');
        setSelectedFile(null); setImageStrength(0.35);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        setGeneratedImageData(null);
        setError(''); setSuccess('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [imagePreview]); // Dipende solo da imagePreview per il cleanup

    // Enhance Prompt
    const handleEnhance = async () => {
        if (!prompt) return setError('Please enter a prompt to enhance.');
        setIsEnhancing(true); setError(''); setSuccess('');
        try {
            const result = await enhancePrompt({ prompt });
            setPrompt(result.enhanced_prompt); // Aggiorna prompt principale
            setSuccess('Prompt enhanced!');
        } catch (err) { setError(err.response?.data?.error || err.message || 'Failed to enhance prompt.');
        } finally { setIsEnhancing(false); }
    };

    // Generate Image
    const handleGenerate = async () => {
        if (!prompt) return setError('A prompt is required.');
        setIsGenerating(true); setError(''); setSuccess(''); setGeneratedImageData(null);

        const currentFormattedPrompt = style ? `${prompt}, style: ${style}` : prompt;
        const modelToUse = selectedFile ? 'stability_img2img' : model;

        try {
            let result;
            if (selectedFile) { // Image-to-Image
                const formData = new FormData();
                formData.append('prompt', prompt); formData.append('image', selectedFile);
                if (style) formData.append('style', style);
                formData.append('image_strength', imageStrength.toString());
                result = await generateImageToImage(formData);
            } else { // Text-to-Image
                const data = { prompt, model, aspect_ratio: aspectRatio };
                if (style) data.style = style;
                result = await generateTextToImage(data);
            }
            console.log("API Response (raw result):", result); // DEBUG
            // Verifica che image_url sia presente e sia una stringa relativa
            // --- CORREZIONE QUI ---
            // Verifica che result.image_url sia l'URL relativo atteso
            if (result?.image_url && typeof result.image_url === 'string' && result.image_url.startsWith('/media/')) {
                // Imposta lo stato con l'oggetto strutturato
                setGeneratedImageData({
                    relative_url: result.image_url, // Salva URL relativo qui
                    prompt: currentFormattedPrompt, // Usa il prompt formattato
                    model: modelToUse,            // Usa il modello corretto
                    style: style || null,         // Salva lo stile usato
                });
                setSuccess('Image generated successfully!');
           } else {
                console.error("Invalid or missing relative 'image_url' in API response:", result);
                throw new Error("Received invalid image data from server.");
           }
           // --- FINE CORREZIONE ---
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Image generation failed.');
            console.error("Generation error details:", err.response?.data || err);
        } finally { setIsGenerating(false); }
    };

    // Save Image
    const handleSaveToGallery = async () => {
        console.log("handleSaveToGallery - Start. generatedImageData:", generatedImageData);
        if (!generatedImageData || !generatedImageData.relative_url || typeof generatedImageData.relative_url !== 'string' || !generatedImageData.relative_url.startsWith('/media/')) { // Controllo più robusto
            const errorMsg = `Cannot save: Invalid generatedImageData state. URL: ${generatedImageData?.relative_url}`;
            console.error(errorMsg);
            setError('Internal Error: Cannot save generated image data.'); // Messaggio utente generico
            return;
        }
        setIsSaving(true); setError(''); setSuccess('');
        try {
            const relativeTempUrl = generatedImageData.relative_url; // Usa URL relativo dallo stato
            console.log("handleSaveToGallery - Using relative URL:", relativeTempUrl);
    
            const dataToSave = {
                image_url: relativeTempUrl, // Passa URL relativo all'API
                prompt: generatedImageData.prompt,
                model: generatedImageData.model,
                style: generatedImageData.style,
            };
            console.log("handleSaveToGallery - Calling saveGeneratedImage with:", dataToSave);
            const savedImage = await saveGeneratedImage(dataToSave);
            console.log("API Save Response:", savedImage);
            setSuccess(`Image (ID: ${savedImage.id}) saved to gallery!`);
            setGeneratedImageData(null); // Rimuovi temp dopo salvataggio
            // Aggiungi/aggiorna la galleria UI
            setGalleryImages(prev => [savedImage, ...prev.filter(img => img.id !== savedImage.id)]);
        } catch (err) {
            let errorMsg = 'Failed to save image.'; /* ... (logica gestione errori come prima) ... */
            setError(errorMsg); console.error("Save error details:", err.response?.data || err);
        } finally { setIsSaving(false); }
    };

    // --- Funzioni Callback per Galleria ---
    const handleViewDetails = (image) => { setSelectedImageForModal(image); setShowDetailModal(true); };
    const handleEditImage = (image) => { setSelectedImageForModal(image); setShowEditModal(true); };
    const handleDeleteImage = async (imageId) => {
        if (!window.confirm(`Delete image ID ${imageId}?`)) return;
        setDeletingImageId(imageId); setGalleryError('');
        try {
            await deleteGalleryImage(imageId);
            setSuccess(`Image ID ${imageId} deleted.`);
            setGalleryImages(prev => prev.filter(img => img.id !== imageId));
        } catch (err) { setGalleryError(err.response?.data?.error || err.message || `Failed to delete image ID ${imageId}.`);
        } finally { setDeletingImageId(null); }
    };
     const handleUpdateImage = async (imageId, metadata) => {
         try {
            const updatedImage = await updateImageMetadata(imageId, metadata);
            setGalleryImages(prev => prev.map(img => img.id === imageId ? updatedImage : img));
            setShowEditModal(false); setSuccess(`Image ID ${imageId} updated.`); return true;
         } catch (err) { console.error("Update error in page:", err); return false; }
     };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
             {/* Messaggi Globali */}
             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

             {/* Form + Output */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Colonna Input */}
                 <div className="bg-white p-6 rounded-lg shadow-lg space-y-4 border border-gray-200">
                     <h2 className="text-xl font-semibold border-b pb-2 text-gray-700">Generation Parameters</h2>
                     {/* Prompt & Enhance Button */}
                     <div>
                         <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Prompt:</label>
                         <textarea id="prompt" rows="4" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image..." className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
                         <button onClick={handleEnhance} disabled={isEnhancing || !prompt} className="mt-2 px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 disabled:opacity-50 flex items-center">
                             {isEnhancing && <Spinner small />} Enhance Prompt (AI)
                         </button>
                     </div>
                     {/* Style */}
                     <div>
                         <label htmlFor="style" className="block text-sm font-medium text-gray-700">Style (Optional):</label>
                         <input type="text" id="style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g., cinematic, anime art..." className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
                     </div>
                     {/* Model (Text-to-Image only) */}
                     {!selectedFile && (
                         <div>
                             <label htmlFor="model" className="block text-sm font-medium text-gray-700">Model:</label>
                             <select id="model" value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white">
                                 <option value="dalle">DALL-E 3</option>
                                 <option value="stability">Stability AI (XL)</option>
                             </select>
                         </div>
                     )}
                      {/* Aspect Ratio (Text-to-Image only) */}
                     {!selectedFile && (
                         <div>
                              <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-700">Aspect Ratio:</label>
                              <select id="aspectRatio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white">
                                 <option value="1:1">1:1</option>
                                 <option value="16:9">16:9</option>
                                 <option value="9:16">9:16</option>
                                 {model === 'stability' && <option value="4:3">4:3</option>}
                                 {/* ... altre opzioni stability ... */}
                              </select>
                         </div>
                     )}
                     {/* Image-to-Image Input */}
                     <div className="border-t pt-4 mt-4 space-y-4">
                         <h3 className="text-md font-semibold text-gray-600">Or Use Image-to-Image (Stability):</h3>
                         <div>
                             <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">Initial Image (PNG/JPEG):</label>
                             <input type="file" id="imageFile" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleFileChange} className="..."/>
                             {imagePreview && (<div className="mt-2 ..."><img src={imagePreview} alt="Preview" className="max-h-40 rounded" /></div>)}
                         </div>
                         {selectedFile && (
                              <div>
                                 <label htmlFor="imageStrength" className="block text-sm font-medium text-gray-700">Image Strength:</label>
                                 <input type="range" id="imageStrength" min="0" max="1" step="0.01" value={imageStrength} onChange={(e) => setImageStrength(parseFloat(e.target.value))} className="..."/>
                                 <span className="text-sm text-gray-500">{imageStrength.toFixed(2)}</span>
                              </div>
                         )}
                     </div>
                     {/* Generate Button */}
                     <div className="border-t pt-4 mt-4">
                          <button onClick={handleGenerate} disabled={isGenerating || !prompt} className="w-full ...">
                              {isGenerating && <Spinner />} {selectedFile ? 'Generate from Image' : 'Generate from Text'}
                          </button>
                     </div>
                     <button onClick={resetForm} className="text-xs text-gray-500 hover:underline mt-2">Reset Form</button>
                 </div>

                 {/* Colonna Output */}
                 <div className="bg-gray-50 p-6 rounded-lg shadow-lg space-y-4 min-h-[400px] flex flex-col items-center justify-center border border-gray-200">
                     <h2 className="text-xl font-semibold border-b pb-2 w-full text-center text-gray-700">Result</h2>
                     {isGenerating && (<div className="text-center py-10"><Spinner /><p className="text-gray-600 mt-2">Generating...</p></div>)}

                     {/* Immagine Generata (Temporanea) */}
                     {generatedImageData && !isGenerating && (
                         <div className="space-y-3 text-center w-full">
                             <h3 className="font-semibold text-gray-800">Generated Image (Preview):</h3>
                             <img
                                 // Costruisci l'URL completo per la visualizzazione
                                 src={buildFullImageUrl(generatedImageData.relative_url)}
                                 alt="AI Generated Preview"
                                 className="max-w-full h-auto mx-auto rounded shadow-md border"
                                 onError={(e) => { console.error("Error loading generated image URL:", buildFullImageUrl(generatedImageData.relative_url)); setError("Failed to load generated image preview."); setGeneratedImageData(null); }}
                             />
                             <button onClick={handleSaveToGallery} disabled={isSaving} className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center mx-auto">
                                  {isSaving && <Spinner small />} Save to My Gallery
                             </button>
                         </div>
                     )}

                     {/* Placeholder */}
                     {!generatedImageData && !isGenerating && ( <p className="text-center text-gray-500 py-10 italic">Generated image will appear here.</p> )}
                 </div>
             </div>

             {/* --- Sezione Galleria Utente --- */}
             {/* La condizione isAuthenticated assicura che venga mostrata solo a utenti loggati */}
             {isAuthenticated && (
                 <div className="mt-12 pt-8 border-t border-gray-300">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">My Image Gallery</h2>
                        {/* Bottone Show/Hide */}
                        <button onClick={() => setShowGallery(!showGallery)} className="px-4 py-2 bg-white border border-gray-300 text-indigo-600 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium">
                            {showGallery ? 'Hide Gallery' : 'Show Gallery'}
                        </button>
                    </div>

                    {/* Contenuto Galleria (mostrato condizionalmente) */}
                    {showGallery && (
                        <div className="bg-gray-100 p-4 rounded-lg border">
                            {galleryError && <Alert type="error" message={galleryError} onClose={() => setGalleryError('')}/>}
                            {isLoadingGallery ? (
                                <div className="text-center py-6"><Spinner /> Loading gallery...</div>
                            ) : galleryImages.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {/* Mappa le immagini e passa buildFullImageUrl a ImageCard */}
                                    {galleryImages.map(image => (
                                        <ImageCard
                                            key={image.id}
                                            image={image}
                                            buildFullUrl={buildFullImageUrl} // Passa la funzione helper
                                            onViewDetails={handleViewDetails}
                                            onEdit={handleEditImage}
                                            onDelete={handleDeleteImage}
                                            isDeleting={deletingImageId === image.id}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-6 italic">Your gallery is empty.</p>
                            )}
                        </div>
                    )}
                 </div>
             )}

             {/* --- Modali Galleria --- */}
             <ImageDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                image={selectedImageForModal}
                buildFullUrl={buildFullImageUrl} // Passa helper
             />
            <ImageEditModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                image={selectedImageForModal}
                onSave={handleUpdateImage}
                buildFullUrl={buildFullImageUrl} // Passa helper
             />

        </div>
    );
};

export default ImageGeneratorPage;