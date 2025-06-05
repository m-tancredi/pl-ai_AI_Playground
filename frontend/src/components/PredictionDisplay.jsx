// src/components/PredictionDisplay.jsx
import React from 'react';
import { FaRobot, FaEye, FaChartBar } from 'react-icons/fa';

const PredictionDisplay = ({ predictions }) => {
    if (!predictions || predictions.length === 0) {
        return (
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
                <FaEye className="text-gray-400 text-2xl mx-auto mb-3" />
                <p className="text-sm text-gray-500 italic">No predictions yet</p>
                <p className="text-xs text-gray-400 mt-1">Point webcam at an object after training</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
                    <FaRobot className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Live Predictions</h3>
            </div>
            
            <div className="space-y-3">
                {predictions.map((pred, index) => {
                    const confidencePercent = (pred.confidence * 100).toFixed(1);
                    
                    // Colore dinamico basato su confidenza
                    const getConfidenceStyle = (confidence) => {
                        if (confidence > 0.7) {
                            return {
                                bg: 'bg-gradient-to-r from-green-400 to-green-500',
                                text: 'text-green-700',
                                bgLight: 'bg-green-50',
                                border: 'border-green-200'
                            };
                        } else if (confidence > 0.4) {
                            return {
                                bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
                                text: 'text-yellow-700',
                                bgLight: 'bg-yellow-50',
                                border: 'border-yellow-200'
                            };
                        } else {
                            return {
                                bg: 'bg-gradient-to-r from-red-400 to-red-500',
                                text: 'text-red-700',
                                bgLight: 'bg-red-50',
                                border: 'border-red-200'
                            };
                        }
                    };

                    const style = getConfidenceStyle(pred.confidence);

                    return (
                        <div 
                            key={pred.label || index} 
                            className={`p-4 rounded-xl border ${style.bgLight} ${style.border} transition-all duration-200 hover:shadow-md`}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <FaChartBar className={`${style.text} text-sm`} />
                                    <span className="font-semibold text-gray-800">{pred.label}</span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${style.text} ${style.bgLight} border ${style.border}`}>
                                    {confidencePercent}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className={`h-3 rounded-full transition-all duration-300 ${style.bg} shadow-sm`}
                                    style={{ width: `${confidencePercent}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {predictions.length > 1 && (
                <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2">
                        <FaRobot className="text-purple-500 text-sm" />
                        <p className="text-xs text-purple-700 font-medium">
                            Showing top {predictions.length} predictions
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PredictionDisplay;