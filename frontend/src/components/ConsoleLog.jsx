// src/components/ConsoleLog.jsx
import React, { useRef, useEffect, useState } from 'react';
import { FaAngleDown, FaAngleUp, FaTrash, FaTerminal } from 'react-icons/fa';

const ConsoleLog = ({ logs, onClear }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const consoleEndRef = useRef(null);

    const scrollToBottom = () => {
        consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Solo scroll se ci sono logs effettivi
    useEffect(() => {
        if (logs.length > 0) {
            scrollToBottom();
        }
    }, [logs]);

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header Console moderno */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-white shadow-lg">
                        <FaTerminal className="text-sm" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Console Output</h3>
                        <p className="text-sm text-gray-600">{logs.length} messages</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                     {onClear && (
                         <button 
                            onClick={onClear} 
                            title="Clear Logs" 
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                        >
                            <FaTrash size={14}/>
                        </button>
                     )}
                     <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        title={isExpanded ? "Collapse" : "Expand"} 
                        className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-all duration-200"
                    >
                        {isExpanded ? <FaAngleUp size={16} /> : <FaAngleDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Corpo Console (Collassabile) */}
            {isExpanded && (
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-green-400 font-mono text-xs">
                    <div className="p-4 h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                        {logs.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <div className="text-center">
                                    <FaTerminal className="text-2xl mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Console is empty</p>
                                    <p className="text-xs mt-1">System messages will appear here</p>
                                </div>
                            </div>
                        ) : (
                            logs.map((log, index) => (
                                <div key={index} className="mb-1 py-1 hover:bg-gray-800 hover:bg-opacity-50 rounded px-2 transition-colors">
                                    <span className="text-gray-500 mr-2 text-[10px]">
                                        [{index.toString().padStart(3, '0')}]
                                    </span>
                                    <span className="text-green-400 whitespace-pre-wrap break-words leading-relaxed">
                                        {log}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={consoleEndRef} />
                    </div>
                    
                    {/* Footer con indicatori */}
                    <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                                Live
                            </span>
                            <span>Lines: {logs.length}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            Auto-scroll enabled
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsoleLog;