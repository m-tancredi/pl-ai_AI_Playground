import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    generateTextToImage,
    generateImageToImage,
    enhancePrompt,
} from '../services/imageGeneratorService';
import {
    saveGeneratedImage,
    listUserGalleryImages,
    updateImageMetadata,
    deleteGalleryImage,
} from '../services/imageGalleryService';
import { useAuth } from '../context/AuthContext';
import { FaMagic, FaImage, FaStar, FaImages, FaEye, FaEyeSlash, FaGem, FaPlay } from 'react-icons/fa';

// Importa i componenti UI necessari
import ImageCard from '../components/ImageCard';
import ImageDetailModal from '../components/ImageDetailModal';
import ImageEditModal from '../components/ImageEditModal';
import UsageWidget from '../components/UsageWidget';
import UsageModal from '../components/UsageModal';

// --- Componenti UI Moderni ---
const Spinner = ({ small = false }) => (
    <div className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-4 w-4 mr-2' : 'h-5 w-5 mr-2'}`}></div>
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
        <div className={`${colorClasses[type]} border px-4 py-3 rounded-xl flex items-center justify-between mb-6`}>
            <span className="font-medium">{message}</span>
            {onClose && (
                <button onClick={onClose} className="text-current hover:opacity-70 font-bold text-lg ml-4" aria-label="Close">
                    ×
                </button>
            )}
        </div>
    );
};

const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl ${className}`}>
        {children}
    </div>
);

const ButtonPrimary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>
        {children}
    </button>
);

const ButtonSecondary = ({ children, ...props }) => (
    <button {...props} className={`inline-flex items-center px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>
        {children}
    </button>
);

const InputField = ({ label, children, className = '' }) => (
    <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-bold text-gray-700">{label}</label>
        {children}
    </div>
);

const ModelCard = ({ model, isSelected, onSelect, icon, title, description, badge, price }) => (
    <div
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
            isSelected 
                ? 'border-purple-500 bg-purple-50 shadow-lg' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
        onClick={() => onSelect(model)}
    >
        <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                model === 'dalle-2' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                model === 'dalle-3' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                model === 'dalle-3-hd' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 
                'bg-gray-500'
            }`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{title}</h3>
                    {badge && (
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            badge === 'HD' ? 'bg-yellow-100 text-yellow-800' :
                            badge === 'NEW' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-600'
                        }`}>
                            {badge}
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{description}</p>
                {price && <p className="text-xs text-gray-500">{price}</p>}
            </div>
        </div>
    </div>
);

const ImageToImageSection = ({ onGenerate, isGenerating, result, error }) => {
    const [editPrompt, setEditPrompt] = useState('');
    const [editImage, setEditImage] = useState(null);
    const [editModel, setEditModel] = useState('gpt-image-1');
    const [editQuality, setEditQuality] = useState('standard');
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                alert('Il file deve essere inferiore a 10MB');
                return;
            }
            
            setEditImage(file);
            const reader = new FileReader();
            reader.onload = (e) => setPreviewUrl(e.target.result);
            reader.readAsDataURL(file);
        }
    };
    
    const handleEditSubmit = () => {
        if (!editPrompt.trim()) {
            alert('Inserisci un prompt per modificare l\'immagine');
            return;
        }
        if (!editImage) {
            alert('Carica un\'immagine da modificare');
            return;
        }
        
        const formData = new FormData();
        formData.append('prompt', editPrompt);
        formData.append('image', editImage);
        formData.append('model', editModel);
        formData.append('quality', editQuality);
        
        onGenerate(formData);
    };
    
    const resetEditForm = () => {
        setEditPrompt('');
        setEditImage(null);
        setEditModel('gpt-image-1');
        setEditQuality('standard');
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Upload Immagine */}
            <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">
                    Carica Immagine da Modificare
                </label>
                <div className="flex items-center space-x-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                    />
                    <label
                        htmlFor="image-upload"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                        <FaImage className="mr-2" />
                        Seleziona Immagine
                    </label>
                    {editImage && (
                        <span className="text-sm text-gray-600">
                            {editImage.name}
                        </span>
                    )}
                </div>
                
                {/* Preview dell'immagine */}
                {previewUrl && (
                    <div className="mt-4">
                        <img
                            src={previewUrl}
                            alt="Anteprima"
                            className="max-w-xs h-auto rounded-xl shadow-lg border-2 border-gray-200"
                        />
                    </div>
                )}
            </div>
            
            {/* Prompt di Editing */}
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                    Prompt di Modifica
                </label>
                <textarea
                    rows="3"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Descrivi come vuoi modificare l'immagine..."
                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                />
            </div>
            
            {/* Selezione Modello */}
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                    Modello AI
                </label>
                <p className="text-sm text-gray-600 mb-3">
                    Solo alcuni modelli supportano l'editing di immagini
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { id: 'gpt-image-1', title: 'GPT-Image-1', badge: 'NUOVO' },
                        { id: 'dalle-2', title: 'DALL·E 2', badge: null },
                        { id: 'stability', title: 'Stability AI', badge: null }
                    ].map((modelConfig) => (
                        <div
                            key={modelConfig.id}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                editModel === modelConfig.id
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setEditModel(modelConfig.id)}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">{modelConfig.title}</span>
                                {modelConfig.badge && (
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                        modelConfig.badge === 'HD' ? 'bg-yellow-100 text-yellow-800' :
                                        modelConfig.badge === 'NUOVO' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {modelConfig.badge}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Selezione Qualità (solo per GPT-Image-1) */}
            {editModel === 'gpt-image-1' && (
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                        Qualità
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setEditQuality('standard')}
                            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                                editQuality === 'standard'
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <FaImage className="mx-auto text-2xl mb-1 text-purple-500" />
                            <p className="font-semibold text-gray-800">Standard</p>
                        </button>
                        <button
                            onClick={() => setEditQuality('hd')}
                            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                                editQuality === 'hd'
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <FaGem className="mx-auto text-2xl mb-1 text-yellow-500" />
                            <p className="font-semibold text-gray-800">HD</p>
                        </button>
                    </div>
                </div>
            )}
            
            {/* Pulsanti */}
            <div className="flex space-x-4">
                <ButtonPrimary
                    onClick={handleEditSubmit}
                    disabled={isGenerating || !editPrompt.trim() || !editImage}
                    className="flex-1"
                >
                    {isGenerating && <Spinner small />}
                    <FaMagic className="mr-2" />
                    {isGenerating ? 'Modifica in corso...' : 'Modifica Immagine'}
                </ButtonPrimary>
                <ButtonSecondary
                    onClick={resetEditForm}
                    disabled={isGenerating}
                    className="px-4"
                >
                    Reset
                </ButtonSecondary>
            </div>
        </div>
    );
};

// --- Fine Componenti UI ---

const ImageGeneratorPage = () => {
    const { isAuthenticated } = useAuth();

    // Stati Input
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [model, setModel] = useState('dalle-3');
    const [quality, setQuality] = useState('standard');
    const [aspectRatio, setAspectRatio] = useState('1:1');

    // Stati Output/Risultati
    const [generatedImageData, setGeneratedImageData] = useState(null);

    // Stati UI
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Stati Galleria
    const [galleryImages, setGalleryImages] = useState([]);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [galleryError, setGalleryError] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const [deletingImageId, setDeletingImageId] = useState(null);
    const [recentlySavedImage, setRecentlySavedImage] = useState(null);

    // Stati Modali Galleria
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedImageForModal, setSelectedImageForModal] = useState(null);

    // Stati Modale Usage
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [usageData, setUsageData] = useState(null);

    // Stati Image-to-Image
    const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
    const [editedImageData, setEditedImageData] = useState(null);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');
    
    // Ref per il UsageWidget per aggiornamento in tempo reale
    const usageWidgetRef = useRef(null);
    
    // Configurazione modelli
    const models = [
        {
            id: 'dalle-2',
            title: 'DALL·E 2',
            description: 'Modello precedente, veloce ed economico',
            icon: <FaImage />,
            price: 'Più economico',
            badge: null
        },
        {
            id: 'dalle-3',
            title: 'DALL·E 3',
            description: 'Modello avanzato con maggiore fedeltà',
            icon: <FaMagic />,
            price: 'Prezzo standard',
            badge: null
        },
        {
            id: 'dalle-3-hd',
            title: 'DALL·E 3 HD',
            description: 'Massima qualità e dettaglio',
            icon: <FaGem />,
            price: 'Prezzo premium',
            badge: 'HD'
        },
        {
            id: 'gpt-image-1',
            title: 'GPT-Image-1',
            description: 'Modello di ultima generazione con rendering testo perfetto',
            icon: <FaStar />,
            price: 'Prezzo premium+',
            badge: 'NUOVO'
        }
    ];
    
    // Funzione Helper per costruire URL completo
    const buildFullImageUrl = useCallback((relativeUrl) => {
        if (!relativeUrl || typeof relativeUrl !== 'string') {
            return null;
        }
        
        // Assicurati che l'URL inizi con /media/
        if (!relativeUrl.startsWith('/media/')) {
            return null;
        }
        
        return `${window.location.origin}${relativeUrl}`;
    }, []);

    // Carica galleria quando si apre la sezione
    useEffect(() => {
        const fetchGallery = async () => {
            if (!isAuthenticated) return;
            setIsLoadingGallery(true);
            setGalleryError('');
            try {
                const images = await listUserGalleryImages();
                let updatedImages = images || [];
                
                // Se c'è un'immagine appena salvata, assicuriamoci che sia nella galleria
                if (recentlySavedImage) {
                    const imageExists = updatedImages.some(img => img.id === recentlySavedImage.id);
                    if (!imageExists) {
                        updatedImages = [recentlySavedImage, ...updatedImages];
                    }
                }
                
                setGalleryImages(updatedImages);
            } catch (err) {
                setGalleryError('Errore durante il caricamento della galleria. Riprova.');
                console.error("Gallery fetch error:", err);
            } finally {
                setIsLoadingGallery(false);
            }
        };

        if (showGallery && isAuthenticated) {
            fetchGallery();
        }
    }, [showGallery, isAuthenticated, recentlySavedImage]);

    // Reset Form
    const resetForm = useCallback(() => {
        setPrompt('');
        setStyle('');
        setModel('dalle-3');
        setQuality('standard');
        setAspectRatio('1:1');
        setGeneratedImageData(null);
        setError('');
        setSuccess('');
    }, []);

    // Enhance Prompt
    const handleEnhance = async () => {
        if (!prompt.trim()) {
            setError('Inserisci un prompt da migliorare.');
            return;
        }
        
        setIsEnhancing(true);
        setError('');
        setSuccess('');
        
        try {
            const result = await enhancePrompt({ prompt });
            setPrompt(result.enhanced_prompt);
            setSuccess('Prompt migliorato con successo!');
            
            // Aggiorna il widget consumi in tempo reale
            if (usageWidgetRef.current && usageWidgetRef.current.refreshUsage) {
                usageWidgetRef.current.refreshUsage();
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Errore durante il miglioramento del prompt.');
        } finally {
            setIsEnhancing(false);
        }
    };

        // Generate Image
    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Un prompt è necessario per generare l\'immagine.');
            return;
        }
        
        setIsGenerating(true);
        setError('');
        setSuccess('');
        setGeneratedImageData(null);

        const currentFormattedPrompt = style ? `${prompt}, style: ${style}` : prompt;

        try {
            const data = { 
                prompt, 
                model: model,
                aspect_ratio: aspectRatio,
                quality: quality
            };
                if (style) data.style = style;
            
            const result = await generateTextToImage(data);
            
            if (result?.image_url && typeof result.image_url === 'string' && result.image_url.startsWith('/media/')) {
                const imageData = {
                    relative_url: result.image_url,
                    prompt: currentFormattedPrompt,
                    model: model,
                    quality: quality,
                    style: style || null,
                };
                
                // Salva automaticamente nella galleria
                try {
                    const dataToSave = {
                        image_url: imageData.relative_url,
                        prompt: imageData.prompt,
                        model: imageData.model,
                        quality: imageData.quality,
                        style: imageData.style,
                    };
                    
                    const savedImage = await saveGeneratedImage(dataToSave);
                    setSuccess('Immagine generata e salvata automaticamente nella galleria!');
                    
                    // Mostra l'anteprima dell'immagine generata usando l'URL permanente
                    setGeneratedImageData({
                        ...imageData,
                        relative_url: savedImage.image_url // Usa l'URL dell'immagine salvata
                    });
                    
                    // Salva l'immagine appena salvata per assicurarsi che sia visibile
                    setRecentlySavedImage(savedImage);
                    
                    // Pulisce l'immagine recentemente salvata dopo 5 secondi
                    setTimeout(() => {
                        setRecentlySavedImage(null);
                    }, 5000);
                    
                    // Aggiorna automaticamente la galleria con l'immagine salvata
                    setGalleryImages(prev => [savedImage, ...prev.filter(img => img.id !== savedImage.id)]);
                    
                    // Mostra automaticamente la galleria se è nascosta
                    if (!showGallery) {
                        setShowGallery(true);
                    }
                    
                    // Aggiorna il widget consumi in tempo reale
                    if (usageWidgetRef.current && usageWidgetRef.current.refreshUsage) {
                        usageWidgetRef.current.refreshUsage();
                    }
                    
                } catch (saveErr) {
                    console.error("Auto-save error:", saveErr);
                    setError('Immagine generata ma errore nel salvataggio automatico.');
                    // Mantieni comunque i dati dell'immagine per eventuale salvataggio manuale
                    setGeneratedImageData(imageData);
                }
           } else {
                throw new Error("Dati immagine non validi ricevuti dal server.");
           }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Errore durante la generazione dell\'immagine.');
            console.error("Generation error:", err.response?.data || err);
        } finally {
            setIsGenerating(false);
        }
    };



    // Generate Image-to-Image
    const handleImageToImageGenerate = async (formData) => {
        setIsGeneratingEdit(true);
        setEditError('');
        setEditSuccess('');
        setEditedImageData(null);

        try {
            const result = await generateImageToImage(formData);
            
            if (result?.image_url && typeof result.image_url === 'string' && result.image_url.startsWith('/media/')) {
                const imageData = {
                    relative_url: result.image_url,
                    prompt: result.prompt_used,
                    model: result.model_used,
                    quality: result.quality_used,
                };
                
                // Salva automaticamente nella galleria
                try {
                    const dataToSave = {
                        image_url: imageData.relative_url,
                        prompt: imageData.prompt,
                        model: imageData.model,
                        quality: imageData.quality,
                    };
                    
                    const savedImage = await saveGeneratedImage(dataToSave);
                    setEditSuccess('Immagine modificata e salvata automaticamente nella galleria!');
                    
                    // Mostra l'anteprima dell'immagine modificata usando l'URL permanente
                    setEditedImageData({
                        ...imageData,
                        relative_url: savedImage.image_url // Usa l'URL dell'immagine salvata
                    });
                    
                    // Salva l'immagine appena salvata per assicurarsi che sia visibile
                    setRecentlySavedImage(savedImage);
                    
                    // Pulisce l'immagine recentemente salvata dopo 5 secondi
                    setTimeout(() => {
                        setRecentlySavedImage(null);
                    }, 5000);
                    
                    // Aggiorna automaticamente la galleria con l'immagine salvata
                    setGalleryImages(prev => [savedImage, ...prev.filter(img => img.id !== savedImage.id)]);
                    
                    // Mostra automaticamente la galleria se è nascosta
                    if (!showGallery) {
                        setShowGallery(true);
                    }
                    
                    // Aggiorna il widget consumi in tempo reale
                    if (usageWidgetRef.current && usageWidgetRef.current.refreshUsage) {
                        usageWidgetRef.current.refreshUsage();
                    }
                    
                } catch (saveErr) {
                    console.error("Auto-save error:", saveErr);
                    setEditError('Immagine modificata ma errore nel salvataggio automatico.');
                    // Mantieni comunque i dati dell'immagine per eventuale salvataggio manuale
                    setEditedImageData(imageData);
                }
            } else {
                throw new Error("Dati immagine non validi ricevuti dal server.");
            }
        } catch (err) {
            setEditError(err.response?.data?.error || err.message || 'Errore durante la modifica dell\'immagine.');
            console.error("Edit error:", err.response?.data || err);
        } finally {
            setIsGeneratingEdit(false);
        }
    };



    // Funzioni Callback per Galleria
    const handleViewDetails = (image) => {
        setSelectedImageForModal(image);
        setShowDetailModal(true);
    };

    const handleEditImage = (image) => {
        setSelectedImageForModal(image);
        setShowEditModal(true);
    };

    const handleDeleteImage = async (imageId) => {
        if (!window.confirm(`Eliminare l'immagine?`)) return;
        
        setDeletingImageId(imageId);
        setGalleryError('');
        
        try {
            await deleteGalleryImage(imageId);
            setSuccess(`Immagine eliminata.`);
            setGalleryImages(prev => prev.filter(img => img.id !== imageId));
        } catch (err) {
            setGalleryError(err.response?.data?.error || err.message || `Errore durante l'eliminazione.`);
        } finally {
            setDeletingImageId(null);
        }
    };

         const handleUpdateImage = async (imageId, metadata) => {
         try {
            const updatedImage = await updateImageMetadata(imageId, metadata);
            setGalleryImages(prev => prev.map(img => img.id === imageId ? updatedImage : img));
            setShowEditModal(false);
            setSuccess(`Immagine aggiornata.`);
            return true;
        } catch (err) {
            console.error("Update error:", err);
            return false;
        }
     };

     // Funzione per aprire la modale di consumo
     const handleOpenUsageModal = (usage) => {
         setUsageData(usage);
         setShowUsageModal(true);
     };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Image Generator
                        </span>
                    </h1>
                    <p className="text-xl text-gray-600">
                        Trasforma le tue idee in immagini straordinarie con OpenAI
                    </p>
                </div>

                {/* Widget Consumi */}
                {isAuthenticated && (
                    <div className="flex justify-center mb-8">
                        <div className="w-full max-w-xs">
                            <UsageWidget ref={usageWidgetRef} onOpenDetails={handleOpenUsageModal} />
                        </div>
                    </div>
                )}

                {/* Messaggi Globali */}
                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    {/* Colonna Input */}
                    <Card>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <FaMagic className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Parametri di Generazione</h2>
                        </div>

                        <div className="space-y-6">
                            {/* Prompt & Enhance Button */}
                            <InputField label="Prompt">
                                <textarea
                                    rows="4"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Descrivi l'immagine che vuoi generare..."
                                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                                />
                                <ButtonSecondary
                                    onClick={handleEnhance}
                                    disabled={isEnhancing || !prompt.trim()}
                                    className="mt-2"
                                >
                                    {isEnhancing && <Spinner small />}
                                    <FaStar className="mr-2" />
                                    Migliora Prompt (AI)
                                </ButtonSecondary>
                            </InputField>

                            {/* Style */}
                            <InputField label="Stile (Opzionale)">
                                <input
                                    type="text"
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    placeholder="es. fotografico, anime, acquerello..."
                                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                                />
                            </InputField>

                            {/* Model Selection */}
                            <InputField label="Modello AI">
                                <div className="space-y-3">
                                    {models.map((modelConfig) => (
                                        <ModelCard
                                            key={modelConfig.id}
                                            model={modelConfig.id}
                                            isSelected={model === modelConfig.id}
                                            onSelect={setModel}
                                            icon={modelConfig.icon}
                                            title={modelConfig.title}
                                            description={modelConfig.description}
                                            badge={modelConfig.badge}
                                            price={modelConfig.price}
                                        />
                                    ))}
                                </div>
                            </InputField>

                            {/* Quality Selection (only for DALL-E 3 and GPT-image-1) */}
                            {(model === 'dalle-3' || model === 'dalle-3-hd' || model === 'gpt-image-1') && (
                                <InputField label="Qualità">
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setQuality('standard')}
                                            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                                                quality === 'standard' 
                                                    ? 'border-purple-500 bg-purple-50' 
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <FaImage className="mx-auto text-2xl mb-1 text-purple-500" />
                                            <p className="font-semibold text-gray-800">Standard</p>
                                            <p className="text-sm text-gray-600">Qualità normale</p>
                                        </button>
                                        <button
                                            onClick={() => setQuality('hd')}
                                            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                                                quality === 'hd' 
                                                    ? 'border-purple-500 bg-purple-50' 
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <FaGem className="mx-auto text-2xl mb-1 text-yellow-500" />
                                            <p className="font-semibold text-gray-800">HD</p>
                                            <p className="text-sm text-gray-600">Alta qualità</p>
                                        </button>
                                    </div>
                                </InputField>
                            )}

                            {/* Aspect Ratio */}
                            <InputField label="Rapporto d'Aspetto">
                                <select
                                    value={aspectRatio}
                                    onChange={(e) => setAspectRatio(e.target.value)}
                                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white"
                                >
                                    <option value="1:1">1:1 (Quadrato)</option>
                                    <option value="16:9">16:9 (Panoramico)</option>
                                    <option value="9:16">9:16 (Verticale)</option>
                                </select>
                            </InputField>

                            {/* Generate Button */}
                            <div className="border-t pt-6">
                                <ButtonPrimary
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="w-full justify-center py-4 text-lg"
                                >
                                    {isGenerating && <Spinner />}
                                    <FaPlay className="mr-2" />
                                    {isGenerating ? 'Generazione in corso...' : 'Genera Immagine'}
                                </ButtonPrimary>
                            </div>

                            <button
                                onClick={resetForm}
                                className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors duration-200"
                            >
                                Reimposta modulo
                            </button>
                        </div>
                    </Card>

                    {/* Colonna Output */}
                    <Card className="flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <FaImage className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Risultato</h2>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                            {isGenerating && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Spinner />
                                    </div>
                                    <p className="text-gray-600 text-lg font-medium">Generazione in corso...</p>
                                    <p className="text-gray-500 text-sm mt-1">Questo può richiedere alcuni secondi</p>
                                </div>
                            )}

                                                 {generatedImageData && !isGenerating && (
                                <div className="w-full text-center">
                                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-4">
                             <img
                                 src={buildFullImageUrl(generatedImageData.relative_url)}
                                            alt="Immagine generata"
                                            className="max-w-full h-auto mx-auto rounded-xl shadow-lg border-4 border-white"
                                            onError={(e) => {
                                                console.error("Error loading image:", buildFullImageUrl(generatedImageData.relative_url));
                                                setError("Errore durante il caricamento dell'immagine.");
                                                setGeneratedImageData(null);
                                            }}
                                        />
                                    </div>
                                    <div className="text-sm text-gray-600 mb-4">
                                        <p><strong>Modello:</strong> {generatedImageData.model}</p>
                                        {generatedImageData.quality && (
                                            <p><strong>Qualità:</strong> {generatedImageData.quality}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center text-green-600 bg-green-50 rounded-xl p-3">
                                        <FaImages className="mr-2" />
                                        <span className="font-medium">Immagine salvata automaticamente nella galleria!</span>
                                    </div>
                         </div>
                     )}

                            {!generatedImageData && !isGenerating && (
                                <div className="text-center py-12">
                                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FaImage className="text-gray-400 text-3xl" />
                                    </div>
                                    <p className="text-gray-500 text-lg">L'immagine generata apparirà qui</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Sezione Image-to-Image */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    {/* Colonna Input Image-to-Image */}
                    <Card>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <FaImage className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Image-to-Image</h2>
                        </div>
                        
                        {/* Messaggi specifici per image-to-image */}
                        {editError && <Alert type="error" message={editError} onClose={() => setEditError('')} />}
                        {editSuccess && <Alert type="success" message={editSuccess} onClose={() => setEditSuccess('')} />}
                        
                        <ImageToImageSection
                            onGenerate={handleImageToImageGenerate}
                            isGenerating={isGeneratingEdit}
                            result={editedImageData}
                            error={editError}
                        />
                    </Card>

                    {/* Colonna Output Image-to-Image */}
                    <Card className="flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <FaMagic className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Immagine Modificata</h2>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                            {isGeneratingEdit && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Spinner />
                                    </div>
                                    <p className="text-gray-600 text-lg font-medium">Modifica in corso...</p>
                                    <p className="text-gray-500 text-sm mt-1">Questo può richiedere alcuni secondi</p>
                                </div>
                            )}

                                                         {editedImageData && !isGeneratingEdit && (
                                 <div className="w-full text-center">
                                     <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 mb-4">
                                         <img
                                             src={buildFullImageUrl(editedImageData.relative_url)}
                                             alt="Immagine modificata"
                                             className="max-w-full h-auto mx-auto rounded-xl shadow-lg border-4 border-white"
                                             onError={(e) => {
                                                 console.error("Error loading edited image:", buildFullImageUrl(editedImageData.relative_url));
                                                 setEditError("Errore durante il caricamento dell'immagine modificata.");
                                                 setEditedImageData(null);
                                             }}
                                         />
                                     </div>
                                     <div className="text-sm text-gray-600 mb-4">
                                         <p><strong>Modello:</strong> {editedImageData.model}</p>
                                         {editedImageData.quality && (
                                             <p><strong>Qualità:</strong> {editedImageData.quality}</p>
                                         )}
                                     </div>
                                     <div className="flex items-center justify-center text-green-600 bg-green-50 rounded-xl p-3">
                                         <FaImages className="mr-2" />
                                         <span className="font-medium">Immagine salvata automaticamente nella galleria!</span>
                                     </div>
                                 </div>
                             )}

                            {!editedImageData && !isGeneratingEdit && (
                                <div className="text-center py-12">
                                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FaMagic className="text-gray-400 text-3xl" />
                                    </div>
                                    <p className="text-gray-500 text-lg">L'immagine modificata apparirà qui</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Sezione Galleria */}
                {isAuthenticated && (
                    <Card>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <FaImages className="text-xl" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">La Mia Galleria</h2>
                            </div>
                            <ButtonSecondary
                                onClick={() => setShowGallery(!showGallery)}
                                className="flex items-center gap-2"
                            >
                                {showGallery ? <FaEyeSlash /> : <FaEye />}
                                {showGallery ? 'Nascondi' : 'Mostra'} Galleria
                            </ButtonSecondary>
                        </div>

                        {showGallery && (
                            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-100">
                                {galleryError && (
                                    <Alert type="error" message={galleryError} onClose={() => setGalleryError('')} />
                                )}
                                
                                {isLoadingGallery ? (
                                    <div className="text-center py-12">
                                        <Spinner />
                                        <p className="text-gray-600 mt-2">Caricamento galleria...</p>
                                    </div>
                                ) : galleryImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {galleryImages.map(image => (
                                            <ImageCard
                                                key={image.id}
                                                image={image}
                                                buildFullUrl={buildFullImageUrl}
                                                onViewDetails={handleViewDetails}
                                                onEdit={handleEditImage}
                                                onDelete={handleDeleteImage}
                                                isDeleting={deletingImageId === image.id}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <FaImages className="text-gray-300 text-6xl mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg font-medium">Nessuna immagine salvata al momento</p>
                                        <p className="text-gray-400 text-sm mt-2">Le immagini che generi e salvi appariranno qui</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                )}

                                {/* Modali Galleria */}
             <ImageDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                image={selectedImageForModal}
                    buildFullUrl={buildFullImageUrl}
             />
            <ImageEditModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                image={selectedImageForModal}
                onSave={handleUpdateImage}
                    buildFullUrl={buildFullImageUrl}
             />

             {/* Modale Usage */}
             <UsageModal
                isOpen={showUsageModal}
                onClose={() => setShowUsageModal(false)}
                usage={usageData}
             />
            </div>
        </div>
    );
};

export default ImageGeneratorPage;