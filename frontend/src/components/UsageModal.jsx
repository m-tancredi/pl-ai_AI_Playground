import React, { useState, useEffect } from 'react';
import { FaTimes, FaChartBar, FaCoins, FaImages, FaClock, FaCheck, FaTimes as FaTimesCircle, FaRobot, FaCalendarAlt, FaSpinner } from 'react-icons/fa';
import { formatCurrency, formatNumber, getModelDisplayName, getOperationDisplayName, getUserUsage } from '../services/usageService';

const UsageModal = ({ isOpen, onClose, usage: initialUsage }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [usage, setUsage] = useState(initialUsage);
    const [loading, setLoading] = useState(false);

    // Quando il modale si apre, ricarica sempre i dati freschi
    useEffect(() => {
        if (isOpen) {
            const fetchFreshData = async () => {
                try {
                    setLoading(true);
                    const freshData = await getUserUsage('current_month');
                    setUsage(freshData);
                } catch (err) {
                    console.error('Error fetching fresh usage data in modal:', err);
                    // Mantieni i dati iniziali se il fetch fallisce
                    setUsage(initialUsage);
                } finally {
                    setLoading(false);
                }
            };

            fetchFreshData();
        }
    }, [isOpen, initialUsage]);

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FaChartBar className="text-2xl" />
                                <div>
                                    <h2 className="text-xl font-bold">Dettagli Consumi</h2>
                                    <p className="text-purple-100 text-sm">Caricamento dati...</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                        </div>
                    </div>

                    {/* Loading Content */}
                    <div className="p-6 flex items-center justify-center h-64">
                        <div className="text-center">
                            <FaSpinner className="animate-spin text-purple-500 text-4xl mx-auto mb-4" />
                            <p className="text-gray-600">Caricamento dati di consumo...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const summary = usage?.summary || {};
    const recentRecords = usage?.recent_records || [];
    const byModel = summary.by_model || [];
    const byOperation = summary.by_operation || [];

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatResponseTime = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const getOperationIcon = (operationType) => {
        switch (operationType) {
            case 'text-to-image': return <FaImages className="text-blue-500" />;
            case 'image-to-image': return <FaImages className="text-purple-500" />;
            case 'prompt-enhancement': return <FaRobot className="text-green-500" />;
            default: return <FaImages className="text-gray-500" />;
        }
    };

    const getModelColor = (model) => {
        const colors = {
            'dalle-2': 'bg-blue-100 text-blue-800',
            'dalle-3': 'bg-purple-100 text-purple-800',
            'dalle-3-hd': 'bg-yellow-100 text-yellow-800',
            'gpt-image-1': 'bg-green-100 text-green-800',
            'gpt-4': 'bg-orange-100 text-orange-800',
            'stability': 'bg-pink-100 text-pink-800'
        };
        return colors[model] || 'bg-gray-100 text-gray-800';
    };

    const OverviewTab = () => (
        <div className="space-y-6">
            {/* Statistiche principali */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <FaImages className="text-blue-500" />
                        <span className="text-sm font-medium text-blue-700">Immagini</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                        {formatNumber(summary.total_calls || 0)}
                    </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <FaCoins className="text-green-500" />
                        <span className="text-sm font-medium text-green-700">Costo USD</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(summary.total_cost_usd || 0, 'USD')}
                    </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <FaCoins className="text-purple-500" />
                        <span className="text-sm font-medium text-purple-700">Costo EUR</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-900">
                        {formatCurrency(summary.total_cost_eur || 0, 'EUR')}
                    </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium text-orange-700">Token</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-900">
                        {formatNumber(summary.total_tokens || 0)}
                    </div>
                </div>
            </div>

            {/* Breakdown per modello */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FaRobot className="text-purple-500" />
                    Consumi per Modello
                </h3>
                <div className="space-y-3">
                    {byModel.length > 0 ? (
                        byModel.map((model, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getModelColor(model.model_used)}`}>
                                        {getModelDisplayName(model.model_used)}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        {model.calls} chiamate
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-gray-800">
                                        {formatCurrency(model.cost_usd, 'USD')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatCurrency(model.cost_eur, 'EUR')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <FaRobot className="text-4xl mx-auto mb-2 text-gray-300" />
                            <p>Nessun dato disponibile</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Breakdown per operazione */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FaChartBar className="text-blue-500" />
                    Consumi per Operazione
                </h3>
                <div className="space-y-3">
                    {byOperation.length > 0 ? (
                        byOperation.map((operation, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                <div className="flex items-center gap-3">
                                    {getOperationIcon(operation.operation_type)}
                                    <span className="font-medium text-gray-800">
                                        {getOperationDisplayName(operation.operation_type)}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        {operation.calls} chiamate
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-gray-800">
                                        {formatCurrency(operation.cost_usd, 'USD')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatCurrency(operation.cost_eur, 'EUR')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <FaChartBar className="text-4xl mx-auto mb-2 text-gray-300" />
                            <p>Nessun dato disponibile</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const HistoryTab = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <FaClock className="text-gray-500" />
                <span className="font-medium text-gray-700">Cronologia Recente</span>
                <span className="text-sm text-gray-500">
                    (Ultimi {recentRecords.length} record)
                </span>
            </div>

            <div className="space-y-3">
                {recentRecords.length > 0 ? (
                    recentRecords.map((record, index) => (
                        <div key={index} className="bg-white border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    {getOperationIcon(record.operation_type)}
                                    <div>
                                        <div className="font-medium text-gray-800">
                                            {getOperationDisplayName(record.operation_type)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatDate(record.created_at)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-gray-800">
                                        {formatCurrency(record.cost_usd, 'USD')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatCurrency(record.cost_eur, 'EUR')}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getModelColor(record.model_used)}`}>
                                    {getModelDisplayName(record.model_used)}
                                </span>
                                <span>{formatNumber(record.tokens_consumed)} token</span>
                                <span>{formatResponseTime(record.response_time_ms)}</span>
                                <span className="flex items-center gap-1">
                                    {record.success ? (
                                        <FaCheck className="text-green-500 text-xs" />
                                    ) : (
                                        <FaTimesCircle className="text-red-500 text-xs" />
                                    )}
                                    {record.success ? 'Successo' : 'Fallito'}
                                </span>
                            </div>

                            {record.prompt && (
                                <div className="bg-gray-50 rounded p-2 text-sm text-gray-700">
                                    <span className="font-medium">Prompt: </span>
                                    {record.prompt.length > 100 
                                        ? `${record.prompt.substring(0, 100)}...` 
                                        : record.prompt}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <FaClock className="text-6xl mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">Nessuna cronologia disponibile</p>
                        <p className="text-sm mt-2">La cronologia delle tue chiamate API apparirà qui</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FaChartBar className="text-2xl" />
                            <div>
                                <h2 className="text-xl font-bold">Dettagli Consumi</h2>
                                <p className="text-purple-100 text-sm">
                                    Periodo: {usage?.period === 'current_month' ? 'Questo mese' : 'Tutti i tempi'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-3 font-medium text-sm transition-colors ${
                                activeTab === 'overview'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Panoramica
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-3 font-medium text-sm transition-colors ${
                                activeTab === 'history'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Cronologia
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'history' && <HistoryTab />}
                </div>
            </div>
        </div>
    );
};

export default UsageModal; 