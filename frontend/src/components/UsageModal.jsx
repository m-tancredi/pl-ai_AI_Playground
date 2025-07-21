import React, { useState, useEffect } from 'react';
import { FaTimes, FaChartBar, FaCoins, FaImages, FaClock, FaCheck, FaTimes as FaTimesCircle, FaRobot, FaCalendarAlt, FaSpinner, FaBrain } from 'react-icons/fa';
import { formatCurrency, formatNumber } from '../services/usageService'; // Removed direct import of getModelDisplayName, getOperationDisplayName, getUserUsage

const UsageModal = ({ isOpen, onClose, serviceName, serviceDisplayName, getUsageData, customGetOperationDisplayName, customGetModelDisplayName }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(false);

    // When the modal opens, always reload fresh data
    useEffect(() => {
        if (isOpen) {
            const fetchFreshData = async () => {
                try {
                    setLoading(true);
                    // Use the passed getUsageData function
                    const freshData = await getUsageData('current_month');
                    setUsage(freshData);
                } catch (error) {
                    console.error(`Error fetching ${serviceDisplayName} usage data:`, error);
                    setUsage(null);
                } finally {
                    setLoading(false);
                }
            };
            fetchFreshData();
        }
    }, [isOpen, getUsageData, serviceDisplayName]);

    if (!isOpen) return null;

    const summary = usage?.summary || {};
    const history = usage?.recent_records || usage?.recent_history || []; // Support both for backwards compatibility

    const totalCalls = summary.total_calls || 0;
    const totalTokens = summary.total_tokens || 0;
    const totalCostUsd = summary.total_cost_usd || 0;
    const totalCostEur = summary.total_cost_eur || 0;
    const byModel = summary.by_model || [];
    const byOperation = summary.by_operation || [];

    // Determina icona e nome del servizio
    const getServiceInfo = (serviceName) => {
        switch (serviceName) {
            case 'analysis':
                return {
                    icon: <FaBrain className="text-blue-500" />,
                    name: 'Analisi',
                    color: 'blue'
                };
            case 'chatbot':
                return {
                    icon: <FaRobot className="text-purple-500" />,
                    name: 'Chatbot',
                    color: 'purple'
                };
            case 'generator':
            default:
                return {
                    icon: <FaImages className="text-blue-500" />,
                    name: 'Immagini',
                    color: 'blue'
                };
        }
    };
    const serviceInfo = getServiceInfo(serviceName);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className={`bg-${serviceInfo.color}-600 text-white p-4 flex items-center justify-between`}>
                    <div className="flex items-center">
                        {serviceInfo.icon}
                        <h2 className="text-xl font-bold ml-3">Consumi {serviceInfo.name}</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-white hover:text-gray-200 transition-colors"
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-4">
                        <button
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'overview' 
                                ? `border-${serviceInfo.color}-500 text-${serviceInfo.color}-600` 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('overview')}
                        >
                            Panoramica
                        </button>
                        <button
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'history' 
                                ? `border-${serviceInfo.color}-500 text-${serviceInfo.color}-600` 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('history')}
                        >
                            Cronologia
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <FaSpinner className={`animate-spin text-${serviceInfo.color}-500 mr-2`} />
                            <span>Caricamento dati aggiornati...</span>
                        </div>
                    ) : (
                        <>
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className={`bg-${serviceInfo.color}-50 rounded-lg p-4`}>
                                            <div className="flex items-center">
                                                <FaRobot className={`text-${serviceInfo.color}-600 mr-2`} />
                                                <div>
                                                    <div className={`text-2xl font-bold text-${serviceInfo.color}-600`}>{formatNumber(totalCalls)}</div>
                                                    <div className="text-sm text-gray-600">Chiamate Totali</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-green-50 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <FaCoins className="text-green-600 mr-2" />
                                                <div>
                                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCostEur)}</div>
                                                    <div className="text-sm text-gray-600">Costo in Euro</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-purple-50 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <FaChartBar className="text-purple-600 mr-2" />
                                                <div>
                                                    <div className="text-2xl font-bold text-purple-600">{formatNumber(totalTokens)}</div>
                                                    <div className="text-sm text-gray-600">Token Consumati</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-orange-50 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <FaCoins className="text-orange-600 mr-2" />
                                                <div>
                                                    <div className="text-2xl font-bold text-orange-600">${formatNumber(totalCostUsd)}</div>
                                                    <div className="text-sm text-gray-600">Costo in USD</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* By Model */}
                                    {byModel.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-3">Consumo per Modello</h3>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <div className="space-y-2">
                                                    {byModel.map((model, index) => (
                                                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                                                            <div className="font-medium">
                                                                {customGetModelDisplayName ? customGetModelDisplayName(model.model_used) : model.model_used}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm text-gray-600">
                                                                    {formatNumber(model.calls)} chiamate • {formatNumber(model.tokens)} token
                                                                </div>
                                                                <div className="text-sm font-medium text-green-600">
                                                                    {formatCurrency(model.cost_eur)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* By Operation */}
                                    {byOperation.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-3">Consumo per Operazione</h3>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <div className="space-y-2">
                                                    {byOperation.map((operation, index) => (
                                                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                                                            <div className="font-medium">
                                                                {customGetOperationDisplayName ? customGetOperationDisplayName(operation.operation_type) : operation.operation_type}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm text-gray-600">
                                                                    {formatNumber(operation.calls)} chiamate • {formatNumber(operation.tokens)} token
                                                                </div>
                                                                <div className="text-sm font-medium text-green-600">
                                                                    {formatCurrency(operation.cost_eur)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Cronologia Recente</h3>
                                    {history.length > 0 ? (
                                        <div className="space-y-4">
                                            {history.map((item) => (
                                                <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center mb-2">
                                                                {item.success ? (
                                                                    <FaCheck className="text-green-500 mr-2" />
                                                                ) : (
                                                                    <FaTimesCircle className="text-red-500 mr-2" />
                                                                )}
                                                                <span className="font-medium">
                                                                    {customGetOperationDisplayName ? customGetOperationDisplayName(item.operation_type) : item.operation_type}
                                                                </span>
                                                                <span className="text-sm text-gray-500 ml-2">
                                                                    • {customGetModelDisplayName ? customGetModelDisplayName(item.model_used) : item.model_used}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 mb-2">
                                                                {item.input_preview || item.input_data}
                                                            </div>
                                                            <div className="flex items-center text-xs text-gray-500">
                                                                <FaCalendarAlt className="mr-1" />
                                                                {new Date(item.created_at).toLocaleString('it-IT')}
                                                                <FaClock className="ml-3 mr-1" />
                                                                {item.response_time_ms}ms
                                                            </div>
                                                        </div>
                                                        <div className="text-right ml-4">
                                                            <div className="text-sm font-medium text-green-600">
                                                                {formatCurrency(item.cost_eur)}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {formatNumber(item.tokens_consumed)} token
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            Nessuna operazione registrata
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsageModal; 