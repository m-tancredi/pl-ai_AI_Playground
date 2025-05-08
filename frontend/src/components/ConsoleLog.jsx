// src/components/ConsoleLog.jsx
import React, { useRef, useEffect, useState } from 'react';
import { FaAngleDown, FaAngleUp, FaTrash } from 'react-icons/fa';

const ConsoleLog = ({ logs, onClear }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const consoleEndRef = useRef(null);

    const scrollToBottom = () => {
        consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [logs]); // Scrolla quando arrivano nuovi log

    return (
        <div className="mt-6 border rounded-lg shadow-sm bg-gray-800 text-white font-mono text-xs overflow-hidden">
            {/* Header Console */}
            <div className="flex justify-between items-center p-2 bg-gray-700 border-b border-gray-600">
                <span className="font-semibold">Console Output</span>
                <div className="flex items-center space-x-2">
                     {onClear && (
                         <button onClick={onClear} title="Clear Logs" className="text-gray-400 hover:text-white">
                            <FaTrash size={12}/>
                        </button>
                     )}
                     <button onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Collapse" : "Expand"} className="text-gray-400 hover:text-white">
                        {isExpanded ? <FaAngleUp size={14} /> : <FaAngleDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Corpo Console (Collassabile) */}
            {isExpanded && (
                <div className="p-3 h-40 overflow-y-auto bg-black bg-opacity-80">
                    {logs.map((log, index) => (
                        <p key={index} className="whitespace-pre-wrap leading-relaxed break-words">
                           <span className="text-gray-500 mr-2">{new Date().toLocaleTimeString()} > </span> {log}
                        </p>
                    ))}
                    <div ref={consoleEndRef} /> {/* Elemento vuoto per lo scroll */}
                </div>
            )}
        </div>
    );
};

export default ConsoleLog;