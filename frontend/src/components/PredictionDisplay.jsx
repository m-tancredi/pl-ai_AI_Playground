// src/components/PredictionDisplay.jsx
import React from 'react';

const PredictionDisplay = ({ predictions }) => {
    if (!predictions || predictions.length === 0) {
        return <p className="text-sm text-gray-500 italic text-center py-4">No predictions yet. Point webcam at an object after training.</p>;
    }

    // Trova confidenza massima per normalizzazione barra (opzionale)
    // const maxConfidence = Math.max(...predictions.map(p => p.confidence), 0);

    return (
        <div className="space-y-2">
             <h3 className="text-md font-semibold text-gray-700">Real-time Predictions:</h3>
            {predictions.map((pred, index) => {
                const confidencePercent = (pred.confidence * 100).toFixed(1);
                // Colore barra basato su confidenza (esempio)
                const barColor = pred.confidence > 0.7 ? 'bg-green-500' : pred.confidence > 0.3 ? 'bg-yellow-500' : 'bg-red-500';

                return (
                    <div key={pred.label || index} className="text-sm">
                        <div className="flex justify-between mb-0.5">
                            <span className="font-medium text-gray-800">{pred.label}</span>
                            <span className="text-gray-600">{confidencePercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all duration-150 ${barColor}`}
                                style={{ width: `${confidencePercent}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PredictionDisplay;