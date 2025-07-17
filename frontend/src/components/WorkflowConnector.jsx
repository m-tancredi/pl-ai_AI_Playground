// src/components/WorkflowConnector.jsx
import React from 'react';
import { FaArrowRight, FaCheckCircle, FaCircle, FaTimesCircle } from 'react-icons/fa';

const WorkflowStep = ({ 
    stepNumber, 
    title, 
    status, 
    isActive, 
    isComplete, 
    isError,
    description 
}) => {
    const getStatusIcon = () => {
        if (isError) return <FaTimesCircle className="text-red-500" />;
        if (isComplete) return <FaCheckCircle className="text-green-500" />;
        return <FaCircle className={isActive ? "text-blue-500" : "text-gray-300"} />;
    };

    const getStepColor = () => {
        if (isError) return 'border-red-300 bg-red-50';
        if (isComplete) return 'border-green-300 bg-green-50';
        if (isActive) return 'border-blue-300 bg-blue-50';
        return 'border-gray-200 bg-gray-50';
    };

    return (
        <div className={`flex-1 p-4 rounded-xl border-2 transition-all duration-300 ${getStepColor()}`}>
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    isError ? 'bg-red-500 text-white' :
                    isComplete ? 'bg-green-500 text-white' :
                    isActive ? 'bg-blue-500 text-white' :
                    'bg-gray-300 text-gray-600'
                }`}>
                    {stepNumber}
                </div>
                <h3 className={`font-bold text-sm ${
                    isError ? 'text-red-700' :
                    isComplete ? 'text-green-700' :
                    isActive ? 'text-blue-700' :
                    'text-gray-500'
                }`}>
                    {title}
                </h3>
                {getStatusIcon()}
            </div>
            <p className={`text-xs ${
                isError ? 'text-red-600' :
                isComplete ? 'text-green-600' :
                isActive ? 'text-blue-600' :
                'text-gray-500'
            }`}>
                {description}
            </p>
        </div>
    );
};

const WorkflowConnector = ({ 
    classesReady, 
    trainingComplete, 
    predictionActive,
    trainingError,
    classCount,
    totalImages
}) => {
    const getStepStatus = (stepIndex) => {
        switch (stepIndex) {
            case 0: // Classi
                return {
                    isActive: !classesReady,
                    isComplete: classesReady,
                    isError: false,
                    description: classesReady 
                        ? `${classCount} classi con ${totalImages} immagini pronte`
                        : 'Aggiungi classi e immagini per continuare'
                };
            case 1: // Addestramento
                return {
                    isActive: classesReady && !trainingComplete,
                    isComplete: trainingComplete,
                    isError: !!trainingError,
                    description: trainingError 
                        ? 'Errore durante l\'addestramento' 
                        : trainingComplete 
                            ? 'Modello addestrato con successo'
                            : classesReady 
                                ? 'Pronto per l\'addestramento'
                                : 'Completa prima il passo 1'
                };
            case 2: // Anteprima
                return {
                    isActive: trainingComplete && predictionActive,
                    isComplete: trainingComplete,
                    isError: false,
                    description: trainingComplete 
                        ? predictionActive 
                            ? 'Webcam attiva - predizioni in corso'
                            : 'Pronto per le predizioni in tempo reale'
                        : 'Completa prima l\'addestramento'
                };
            default:
                return {
                    isActive: false,
                    isComplete: false,
                    isError: false,
                    description: ''
                };
        }
    };

    const steps = [
        { number: 1, title: 'Classi', ...getStepStatus(0) },
        { number: 2, title: 'Addestramento', ...getStepStatus(1) },
        { number: 3, title: 'Anteprima', ...getStepStatus(2) }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
                    <FaArrowRight className="text-sm" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Flusso di Lavoro</h2>
            </div>

            <div className="flex items-center gap-4">
                {steps.map((step, index) => (
                    <React.Fragment key={step.number}>
                        <WorkflowStep
                            stepNumber={step.number}
                            title={step.title}
                            isActive={step.isActive}
                            isComplete={step.isComplete}
                            isError={step.isError}
                            description={step.description}
                        />
                        {index < steps.length - 1 && (
                            <div className="flex-shrink-0 px-2">
                                <FaArrowRight className={`text-2xl transition-colors duration-300 ${
                                    step.isComplete ? 'text-green-500' : 'text-gray-300'
                                }`} />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Indicatore di Progresso */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Progresso Complessivo</span>
                    <span className="text-sm font-bold text-gray-800">
                        {steps.filter(s => s.isComplete).length} / {steps.length} completati
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(steps.filter(s => s.isComplete).length / steps.length) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default WorkflowConnector; 