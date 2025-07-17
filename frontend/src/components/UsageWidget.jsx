import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FaChartBar, FaCoins, FaImages, FaEye, FaSpinner } from 'react-icons/fa';
import { getUserUsage, formatCurrency, formatNumber } from '../services/usageService';

const UsageWidget = forwardRef(({ onOpenDetails }, ref) => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsageData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getUserUsage('current_month');
            setUsage(data);
        } catch (err) {
            console.error('Error fetching usage:', err);
            setError('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    };

    // Esportiamo il metodo refresh per essere chiamato dall'esterno
    useImperativeHandle(ref, () => ({
        refreshUsage: fetchUsageData
    }));

    useEffect(() => {
        fetchUsageData();
    }, []);

    const handleClick = async () => {
        if (onOpenDetails) {
            // Ricarica i dati prima di aprire il modale
            try {
                setLoading(true);
                const freshData = await getUserUsage('current_month');
                setUsage(freshData);
                onOpenDetails(freshData);
            } catch (err) {
                console.error('Error fetching fresh usage data:', err);
                onOpenDetails(usage); // Fallback ai dati cached
            } finally {
                setLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-gray-100">
                <div className="flex items-center justify-center h-20">
                    <FaSpinner className="animate-spin text-purple-500 text-2xl" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-red-200">
                <div className="text-center">
                    <FaChartBar className="text-red-400 text-2xl mx-auto mb-2" />
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                    <button
                        onClick={fetchUsageData}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                        Riprova
                    </button>
                </div>
            </div>
        );
    }

    const summary = usage?.summary || {};
    const totalCalls = summary.total_calls || 0;
    const totalCostUSD = summary.total_cost_usd || 0;
    const totalCostEUR = summary.total_cost_eur || 0;
    const totalTokens = summary.total_tokens || 0;

    return (
        <div
            className="bg-white rounded-xl shadow-lg p-4 border-2 border-gray-100 hover:border-purple-300 transition-all duration-200 cursor-pointer group"
            onClick={handleClick}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <FaChartBar className="text-white text-sm" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">Consumi</h3>
                </div>
                <FaEye className="text-gray-400 group-hover:text-purple-500 transition-colors duration-200" />
            </div>

            <div className="space-y-2">
                {/* Immagini generate */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaImages className="text-blue-500 text-xs" />
                        <span className="text-xs text-gray-600">Immagini</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                        {formatNumber(totalCalls)}
                    </span>
                </div>

                {/* Costi */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaCoins className="text-green-500 text-xs" />
                        <span className="text-xs text-gray-600">Costo</span>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">
                            {formatCurrency(totalCostUSD, 'USD')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {formatCurrency(totalCostEUR, 'EUR')}
                        </div>
                    </div>
                </div>

                {/* Token */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">Token</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                        {formatNumber(totalTokens)}
                    </span>
                </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                    Questo mese • Click per dettagli
                </p>
            </div>
        </div>
    );
});

UsageWidget.displayName = 'UsageWidget';

export default UsageWidget; 