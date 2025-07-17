// src/components/ModelManager.jsx
import React, { useState } from 'react';
import { FaSave, FaDownload, FaEdit, FaCheck, FaTimes, FaSpinner, FaRobot, FaFileExport } from 'react-icons/fa';

const ModelManager = ({ 
    modelId, 
    modelName, 
    modelAccuracy, 
    isTrainingComplete, 
    onSaveModel, 
    onRenameModel, 
    onDownloadModel,
    isLoading = false 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newModelName, setNewModelName] = useState(modelName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');

    const handleSaveModel = async () => {
        if (!modelId || !isTrainingComplete) return;
        
        setIsSaving(true);
        setError('');
        
        try {
            const modelNameToSave = newModelName.trim() || `Model_${new Date().getTime()}`;
            await onSaveModel(modelId, modelNameToSave);
            setIsEditing(false);
        } catch (err) {
            setError(err.message || 'Errore durante il salvataggio del modello');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRenameModel = async () => {
        if (!modelId || !newModelName.trim()) return;
        
        setIsSaving(true);
        setError('');
        
        try {
            await onRenameModel(modelId, newModelName.trim());
            setIsEditing(false);
        } catch (err) {
            setError(err.message || 'Errore durante la rinomina del modello');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadModel = async () => {
        if (!modelId || !isTrainingComplete) return;
        
        setIsDownloading(true);
        setError('');
        
        try {
            await onDownloadModel(modelId);
        } catch (err) {
            setError(err.message || 'Errore durante il download del modello');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            modelName ? handleRenameModel() : handleSaveModel();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setNewModelName(modelName || '');
        }
    };

    if (!isTrainingComplete || !modelId) {
        return (
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
                <FaRobot className="text-gray-400 text-2xl mx-auto mb-3" />
                <p className="text-sm text-gray-500">Addestra un modello per abilitare la gestione</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-sm">
                    <FaSave className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Gestione Modello</h3>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Informazioni Modello */}
            <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Model ID:</span>
                    <span className="text-sm font-mono text-gray-800">{modelId.substring(0, 8)}...</span>
                </div>
                {modelAccuracy && (
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Accuratezza:</span>
                        <span className="text-sm font-bold text-green-600">{(modelAccuracy * 100).toFixed(1)}%</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm font-bold text-green-600">Addestrato</span>
                </div>
            </div>

            {/* Nome Modello */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nome Modello:</label>
                {isEditing ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Inserisci nome modello"
                            autoFocus
                        />
                        <button
                            onClick={modelName ? handleRenameModel : handleSaveModel}
                            disabled={isSaving || !newModelName.trim()}
                            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setNewModelName(modelName || '');
                            }}
                            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            <FaTimes />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-gray-800">
                            {modelName || 'Modello Non Salvato'}
                        </span>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            title={modelName ? 'Rinomina modello' : 'Salva modello'}
                        >
                            <FaEdit />
                        </button>
                    </div>
                )}
            </div>

            {/* Azioni */}
            <div className="flex gap-3">
                {!modelName && (
                    <button
                        onClick={() => setIsEditing(true)}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                    >
                        {isSaving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                        {isSaving ? 'Salvando...' : 'Salva Modello'}
                    </button>
                )}
                
                <button
                    onClick={handleDownloadModel}
                    disabled={isDownloading || !modelName}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                >
                    {isDownloading ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                    {isDownloading ? 'Scaricando...' : 'Scarica'}
                </button>
            </div>

            {!modelName && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm text-amber-800">
                        <strong>Nota:</strong> Il modello non è ancora stato salvato. Usa "Salva Modello" per conservarlo permanentemente.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ModelManager; 