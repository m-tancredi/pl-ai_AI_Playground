import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    generateTextToImage,
    generateImageToImage,
    enhancePrompt,
    saveImage
} from '../services/imageGeneratorService'; // Assicurati che il percorso sia corretto

// --- Componenti UI Semplici (Riutilizza o migliora) ---
const Spinner = () => (
    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2 align-middle"></div>
);

const Alert = ({ type = 'error', message, onClose }) => {
    const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
    if (!message) return null;
    return (
        <div className={`border px-4 py-3 rounded relative mb-4 ${bgColor}`} role="alert">
            <span className="block sm:inline">{message}</span>
            {onClose && (
                <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                     <svg className="fill-current h-6 w-6 text-red-500 hover:text-red-700" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.818l-2.651 3.031a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
            )}
        </div>
    );
};
// --- Fine Componenti UI ---

const ImageGeneratorPage = () => {
    // Input State
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [model, setModel] = useState('dalle'); // 'dalle' o 'stability'
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [selectedFile, setSelectedFile] = useState(null); // Per img2img
    const [imageStrength, setImageStrength] = useState(0.35); // Per img2img
    const [imagePreview, setImagePreview] = useState(null); // URL preview per img2img

    // Output/Result State
    // Rimosso: const [enhancedPrompt, setEnhancedPrompt] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState(null); // URL temporaneo
    const [savedImageUrl, setSavedImageUrl] = useState(null);
    const [lastUsedPrompt, setLastUsedPrompt] = useState(''); // Per salvare l'immagine
    const [lastUsedModel, setLastUsedModel] = useState('');   // Per salvare l'immagine

    // UI State
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fileInputRef = useRef(null);

    // Cleanup per image preview URL
    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    // Gestione cambio file
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
             setSelectedFile(file);
             setError('');
             if (imagePreview) URL.revokeObjectURL(imagePreview);
             setImagePreview(URL.createObjectURL(file));
             setGeneratedImageUrl(null);
             setSavedImageUrl(null);
        } else if (file) {
            setError('Invalid file type. Please upload a PNG or JPEG image.');
            setSelectedFile(null);
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
            event.target.value = '';
        } else {
             setSelectedFile(null);
             if (imagePreview) URL.revokeObjectURL(imagePreview);
             setImagePreview(null);
        }
    };

    // Reset dello stato principale
    const resetForm = () => {
        setPrompt('');
        setStyle('');
        setModel('dalle');
        setAspectRatio('1:1');
        setSelectedFile(null);
        setImageStrength(0.35);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        // Rimosso: setEnhancedPrompt('');
        setGeneratedImageUrl(null);
        setSavedImageUrl(null);
        setLastUsedPrompt('');
        setLastUsedModel('');
        setError('');
        setSuccess('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Enhance Prompt - Aggiornato per modificare direttamente 'prompt'
    const handleEnhance = async () => {
        if (!prompt) {
            setError('Please enter a prompt to enhance.');
            return;
        }
        setIsEnhancing(true);
        setError('');
        setSuccess('');
        // Rimosso: setEnhancedPrompt('');

        try {
            const result = await enhancePrompt({ prompt });
            setPrompt(result.enhanced_prompt); // <-- Aggiorna stato prompt principale
            setSuccess('Prompt enhanced successfully!');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to enhance prompt.');
        } finally {
            setIsEnhancing(false);
        }
    };

    // Generate Image (Text-to-Image o Image-to-Image)
    const handleGenerate = async () => {
        if (!prompt) {
            setError('A prompt is required to generate an image.');
            return;
        }
        setIsGenerating(true);
        setError('');
        setSuccess('');
        setGeneratedImageUrl(null);
        setSavedImageUrl(null);

        const currentFormattedPrompt = style ? `${prompt}, style: ${style}` : prompt;
        setLastUsedPrompt(currentFormattedPrompt);
        setLastUsedModel(selectedFile ? 'stability_img2img' : model);

        try {
            let result;
            if (selectedFile) {
                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('image', selectedFile);
                if (style) formData.append('style', style);
                formData.append('image_strength', imageStrength.toString());
                result = await generateImageToImage(formData);
                setSuccess('Image-to-Image generation successful!');
            } else {
                const data = { prompt, model, aspect_ratio: aspectRatio };
                if (style) data.style = style;
                result = await generateTextToImage(data);
                setSuccess('Text-to-Image generation successful!');
            }
            // Log per Debug URL Immagine
            console.log("API Response Image URL:", result?.image_url);
            setGeneratedImageUrl(result.image_url);

        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Image generation failed.');
            console.error("Generation error details:", err.response?.data || err);
        } finally {
            setIsGenerating(false);
        }
    };

    // Save Image
    const handleSave = async () => {
        if (!generatedImageUrl) {
            setError('No generated image available to save.');
            return;
        }
        setIsSaving(true);
        setError('');
        setSuccess('');
        try {
            const urlObject = new URL(generatedImageUrl);
            const relativeTempUrl = urlObject.pathname;

            const data = {
                image_url: relativeTempUrl,
                prompt: lastUsedPrompt,
                model: lastUsedModel,
                style: style,
            };
            const result = await saveImage(data);
            setSavedImageUrl(result.saved_url);
            setGeneratedImageUrl(null); // Rimuovi temp dopo salvataggio
            setSuccess(result.message || 'Image saved successfully!');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to save image.');
        } finally {
            setIsSaving(false);
        }
    };

    // Log per Debug Stato Immagine nel Rendering
    console.log("Rendering - generatedImageUrl State:", generatedImageUrl);

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">AI Image Generator</h1>

             {/* Messaggi Globali */}
             {error && <Alert type="error" message={error} onClose={() => setError('')} />}
             {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

             {/* Form Principale */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Colonna Input */}
                <div className="bg-white p-6 rounded shadow space-y-4">
                     <h2 className="text-xl font-semibold border-b pb-2 mb-4">Generation Parameters</h2>

                     {/* Prompt */}
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Prompt:</label>
                        <textarea
                            id="prompt"
                            rows="4"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the image you want to create..."
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                         <button
                            onClick={handleEnhance}
                            disabled={isEnhancing || !prompt}
                            className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50 flex items-center"
                         >
                             {isEnhancing && <Spinner />} Enhance Prompt (AI)
                         </button>
                    </div>

                    {/* Style */}
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-gray-700">Style (Optional):</label>
                        <input
                            type="text"
                            id="style"
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            placeholder="e.g., cinematic, anime art, photorealistic, cyberpunk"
                             className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>

                    {/* Selettore Modello (solo per text-to-image) */}
                     {!selectedFile && (
                         <div>
                             <label htmlFor="model" className="block text-sm font-medium text-gray-700">Generation Model:</label>
                             <select
                                id="model"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white"
                             >
                                 <option value="dalle">DALL-E 3</option>
                                 <option value="stability">Stability AI (XL)</option>
                             </select>
                         </div>
                     )}

                     {/* Selettore Aspect Ratio (solo per text-to-image) */}
                     {!selectedFile && (
                         <div>
                             <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-700">Aspect Ratio:</label>
                             <select
                                id="aspectRatio"
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white"
                                disabled={model === 'dalle' && !['1:1', '16:9', '9:16'].includes(aspectRatio) && setAspectRatio('1:1')} // Reset per DALL-E se non supportato
                             >
                                 <option value="1:1">1:1 (Square)</option>
                                 <option value="16:9">16:9 (Widescreen)</option>
                                 <option value="9:16">9:16 (Portrait)</option>
                                 {model === 'stability' && <option value="4:3">4:3</option>}
                                 {model === 'stability' && <option value="3:4">3:4</option>}
                                 {model === 'stability' && <option value="3:2">3:2</option>}
                                 {model === 'stability' && <option value="2:3">2:3</option>}
                             </select>
                              {model === 'dalle' && !['1:1', '16:9', '9:16'].includes(aspectRatio) && <p className="text-xs text-red-600 mt-1">DALL-E 3 only supports 1:1, 16:9, 9:16. Defaulting to 1:1.</p>}
                         </div>
                     )}

                     {/* Input Image-to-Image */}
                     <div className="border-t pt-4 mt-4 space-y-4">
                          <h3 className="text-md font-semibold text-gray-600">Or Generate from Image (Image-to-Image):</h3>
                         <div>
                            <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700">Upload Initial Image (PNG/JPEG):</label>
                            <input
                                type="file"
                                id="imageFile"
                                accept="image/png, image/jpeg"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            />
                            {imagePreview && (
                                <div className="mt-2 border rounded p-2 inline-block">
                                    <img src={imagePreview} alt="Image preview" className="max-h-40 rounded" />
                                </div>
                            )}
                         </div>
                         {selectedFile && (
                             <div>
                                <label htmlFor="imageStrength" className="block text-sm font-medium text-gray-700">Image Strength (0.0 - 1.0):</label>
                                <input
                                    type="range"
                                    id="imageStrength"
                                    min="0" max="1" step="0.01"
                                    value={imageStrength}
                                    onChange={(e) => setImageStrength(parseFloat(e.target.value))}
                                    className="mt-1 block w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="text-sm text-gray-500">{imageStrength.toFixed(2)}</span>
                                <p className="text-xs text-gray-500">Lower values adhere more to the initial image, higher values more to the prompt.</p>
                             </div>
                         )}
                     </div>

                     {/* Bottone Genera */}
                    <div className="border-t pt-4 mt-4">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt}
                            className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center text-lg"
                        >
                            {isGenerating && <Spinner />}
                            {selectedFile ? 'Generate Image from Image' : 'Generate Image from Text'}
                        </button>
                    </div>
                     {/* Bottone Reset */}
                      <button onClick={resetForm} className="text-xs text-gray-500 hover:underline mt-2">Reset Form</button>

                </div>

                {/* Colonna Output */}
                <div className="bg-gray-50 p-6 rounded shadow space-y-4 min-h-[400px] flex flex-col items-center justify-center"> {/* Aggiunto min-h e flex per centrare in caso di no-img */}
                     <h2 className="text-xl font-semibold border-b pb-2 mb-4 w-full text-center">Result</h2>

                     {isGenerating && (
                        <div className="text-center py-10">
                            <Spinner />
                            <p className="text-gray-600 mt-2">Generating image... this may take a moment.</p>
                        </div>
                     )}

                     {/* Immagine Generata (Temporanea) */}
                     {generatedImageUrl && !isGenerating && (
                         <div className="space-y-3 text-center">
                            <h3 className="font-semibold">Generated Image (Temporary):</h3>
                            <img
                                src={generatedImageUrl}
                                alt="AI Generated Image"
                                className="max-w-full h-auto mx-auto rounded shadow border" // Aggiunto bordo per visibilità
                                onError={(e) => { // Aggiunto gestione errore caricamento immagine
                                     console.error("Error loading generated image URL:", generatedImageUrl);
                                     setError("Failed to load the generated image. Check the URL or network connection.");
                                     setGeneratedImageUrl(null); // Resetta URL se non caricabile
                                 }}
                             />
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center mx-auto"
                            >
                                 {isSaving && <Spinner />} Save This Image
                            </button>
                            <p className="text-xs text-gray-500">Saving will move the image to a persistent location.</p>
                         </div>
                     )}

                      {/* Immagine Salvata */}
                     {savedImageUrl && !isSaving && (
                         <div className="space-y-3 text-center border-t pt-4 mt-4">
                            <h3 className="font-semibold text-green-700">Image Saved Successfully!</h3>
                             <img
                                src={savedImageUrl}
                                alt="Saved AI Generated Image"
                                className="max-w-full h-auto mx-auto rounded shadow border-2 border-green-500"
                                onError={(e) => {
                                     console.error("Error loading saved image URL:", savedImageUrl);
                                     setError("Failed to load the saved image.");
                                     setSavedImageUrl(null);
                                 }}
                             />
                             <p className="text-sm">Persistent URL:</p>
                             <input
                                type="text"
                                readOnly
                                value={savedImageUrl}
                                className="w-full text-xs text-gray-600 bg-gray-100 p-1 border rounded"
                                onFocus={(e) => e.target.select()}
                            />
                         </div>
                     )}

                     {/* Messaggio Placeholder */}
                     {!generatedImageUrl && !savedImageUrl && !isGenerating && (
                        <p className="text-center text-gray-500 py-10">Generated image will appear here.</p>
                     )}
                </div>
            </div>
        </div>
    );
};

export default ImageGeneratorPage;