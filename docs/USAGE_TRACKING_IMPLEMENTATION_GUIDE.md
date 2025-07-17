# Guida all'Implementazione del Sistema di Tracking Consumi

## Panoramica

Questo documento spiega come implementare il sistema di tracking dei consumi (token e costi in $ e €) negli altri microservizi del progetto, riutilizzando il codice sviluppato per `image_generator_service`.

## Architettura del Sistema

### Componenti Principali

1. **Backend**:
   - `models.py`: Modello per tracking consumi
   - `utils.py`: Funzioni per calcolo costi
   - `views.py`: API endpoint per recuperare dati
   - `serializers.py`: Serializzatori per API response

2. **Frontend**:
   - `UsageWidget.jsx`: Widget compatto per monitoraggio
   - `UsageModal.jsx`: Modale dettagliata per analisi
   - `usageService.js`: Servizio per comunicazione API

## Implementazione Backend

### 1. Modello di Tracking (`models.py`)

```python
from django.db import models
from decimal import Decimal

class ServiceUsageTracking(models.Model):
    """Modello generico per tracking consumi di qualsiasi servizio AI."""
    
    # Informazioni utente
    user_id = models.PositiveBigIntegerField(db_index=True)
    
    # Informazioni operazione
    operation_type = models.CharField(max_length=50, help_text="Tipo di operazione (es: 'chat', 'analysis', 'classification')")
    service_name = models.CharField(max_length=50, help_text="Nome del servizio (es: 'chatbot', 'llm', 'rag')")
    model_used = models.CharField(max_length=100, help_text="Modello AI utilizzato")
    
    # Input/Output
    input_data = models.TextField(blank=True, help_text="Dati di input (prompt, query, etc.)")
    output_summary = models.TextField(blank=True, help_text="Riassunto dell'output")
    
    # Metriche
    tokens_consumed = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))
    cost_eur = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))
    
    # Metadata
    success = models.BooleanField(default=True)
    response_time_ms = models.PositiveIntegerField(help_text="Tempo di risposta in millisecondi")
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'service_name']),
            models.Index(fields=['created_at']),
        ]
```

### 2. Funzioni di Calcolo Costi (`utils.py`)

```python
from decimal import Decimal
import datetime
from django.db.models import Sum, Count, Q
from .models import ServiceUsageTracking

# Configurazione prezzi per servizio
SERVICE_PRICING = {
    'chatbot': {
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},  # per 1K tokens
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
    },
    'llm': {
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
    },
    'rag': {
        'text-embedding-ada-002': {'input': 0.0001, 'output': 0.0001},
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},
    },
    'analysis': {
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
    },
    'classification': {
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},
        'custom-classifier': {'input': 0.001, 'output': 0.001},
    }
}

# Tasso di cambio USD -> EUR (aggiornare periodicamente)
USD_TO_EUR_RATE = Decimal('0.85')

def calculate_service_cost(service_name, model_name, input_tokens, output_tokens=0):
    """
    Calcola il costo per una chiamata al servizio AI.
    
    Args:
        service_name: Nome del servizio ('chatbot', 'llm', 'rag', etc.)
        model_name: Nome del modello AI
        input_tokens: Numero di token in input
        output_tokens: Numero di token in output (default 0)
    
    Returns:
        tuple: (total_tokens, cost_usd, cost_eur)
    """
    if service_name not in SERVICE_PRICING:
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    if model_name not in SERVICE_PRICING[service_name]:
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    pricing = SERVICE_PRICING[service_name][model_name]
    
    # Calcola costi per input e output
    input_cost = Decimal(str(input_tokens)) * Decimal(str(pricing['input'])) / Decimal('1000')
    output_cost = Decimal(str(output_tokens)) * Decimal(str(pricing['output'])) / Decimal('1000')
    
    total_tokens = input_tokens + output_tokens
    cost_usd = input_cost + output_cost
    cost_eur = cost_usd * USD_TO_EUR_RATE
    
    return total_tokens, cost_usd, cost_eur

def calculate_service_usage_summary(user_id, service_name, period='current_month'):
    """
    Calcola un riassunto dei consumi per un utente e servizio.
    
    Args:
        user_id: ID dell'utente
        service_name: Nome del servizio
        period: Periodo di calcolo ('current_month', 'last_30_days', 'all_time')
    
    Returns:
        dict: Riassunto dei consumi
    """
    # Definisci filtro temporale
    now = datetime.datetime.now()
    if period == 'current_month':
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        filter_date = Q(created_at__gte=start_date)
    elif period == 'last_30_days':
        start_date = now - datetime.timedelta(days=30)
        filter_date = Q(created_at__gte=start_date)
    else:  # all_time
        filter_date = Q()
    
    # Query per i totali
    totals = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name=service_name
    ).filter(filter_date).aggregate(
        total_tokens=Sum('tokens_consumed'),
        total_cost_usd=Sum('cost_usd'),
        total_cost_eur=Sum('cost_eur'),
        total_calls=Count('id')
    )
    
    # Query per breakdown per modello
    by_model = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name=service_name
    ).filter(filter_date).values('model_used').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    # Query per breakdown per operazione
    by_operation = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name=service_name
    ).filter(filter_date).values('operation_type').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    return {
        'total_tokens': totals['total_tokens'] or 0,
        'total_cost_usd': totals['total_cost_usd'] or Decimal('0.000000'),
        'total_cost_eur': totals['total_cost_eur'] or Decimal('0.000000'),
        'total_calls': totals['total_calls'] or 0,
        'by_model': list(by_model),
        'by_operation': list(by_operation),
    }
```

### 3. API View (`views.py`)

```python
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .utils import calculate_service_usage_summary
from .models import ServiceUsageTracking
from .authentication import JWTCustomAuthentication

class ServiceUsageTrackingView(views.APIView):
    """API per recuperare i dati di utilizzo del servizio."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    
    def get(self, request, *args, **kwargs):
        """
        Recupera i dati di utilizzo per l'utente corrente.
        
        Query params:
        - service: Nome del servizio (richiesto)
        - period: Periodo ('current_month', 'last_30_days', 'all_time')
        """
        service_name = request.query_params.get('service')
        period = request.query_params.get('period', 'current_month')
        
        if not service_name:
            return Response(
                {'error': 'Service name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_id = request.user.id
            summary = calculate_service_usage_summary(user_id, service_name, period)
            
            # Aggiungi cronologia recente
            recent_history = ServiceUsageTracking.objects.filter(
                user_id=user_id,
                service_name=service_name
            ).order_by('-created_at')[:10]
            
            response_data = {
                'summary': summary,
                'recent_history': [
                    {
                        'id': usage.id,
                        'operation_type': usage.operation_type,
                        'model_used': usage.model_used,
                        'tokens_consumed': usage.tokens_consumed,
                        'cost_usd': usage.cost_usd,
                        'cost_eur': usage.cost_eur,
                        'success': usage.success,
                        'response_time_ms': usage.response_time_ms,
                        'created_at': usage.created_at,
                        'input_preview': usage.input_data[:100] + '...' if len(usage.input_data) > 100 else usage.input_data,
                    }
                    for usage in recent_history
                ]
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Funzione helper per tracking automatico
def track_service_usage(user_id, service_name, operation_type, model_used, 
                       input_data, output_summary, tokens_consumed, 
                       cost_usd, cost_eur, success, response_time_ms):
    """
    Salva automaticamente i dati di utilizzo.
    
    Chiamare questa funzione alla fine di ogni operazione AI.
    """
    try:
        ServiceUsageTracking.objects.create(
            user_id=user_id,
            service_name=service_name,
            operation_type=operation_type,
            model_used=model_used,
            input_data=input_data,
            output_summary=output_summary,
            tokens_consumed=tokens_consumed,
            cost_usd=cost_usd,
            cost_eur=cost_eur,
            success=success,
            response_time_ms=response_time_ms
        )
    except Exception as e:
        print(f"Error tracking service usage: {e}")
```

### 4. URL Configuration (`urls.py`)

```python
from django.urls import path
from . import views

urlpatterns = [
    # ... altre URL del servizio
    path('usage/', views.ServiceUsageTrackingView.as_view(), name='service_usage_tracking'),
]
```

## Implementazione Frontend

### 1. Servizio API (`usageService.js`)

```javascript
// Riutilizza il file esistente, aggiungendo supporto multi-servizio
import apiClient from './apiClient';

// Funzione generica per ottenere usage di qualsiasi servizio
export const getServiceUsage = async (serviceName, period = 'current_month') => {
    try {
        const response = await apiClient.get(`/api/${serviceName}/usage/`, {
            params: { service: serviceName, period }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${serviceName} usage:`, error);
        throw error;
    }
};

// Funzioni specifiche per servizio
export const getChatbotUsage = (period) => getServiceUsage('chatbot', period);
export const getLLMUsage = (period) => getServiceUsage('llm', period);
export const getRAGUsage = (period) => getServiceUsage('rag', period);
export const getAnalysisUsage = (period) => getServiceUsage('analysis', period);
export const getClassificationUsage = (period) => getServiceUsage('classification', period);

// Funzione per ottenere nome display del servizio
export const getServiceDisplayName = (serviceName) => {
    const serviceNames = {
        'chatbot': 'Chatbot',
        'llm': 'LLM',
        'rag': 'RAG',
        'analysis': 'Analisi Dati',
        'classification': 'Classificazione'
    };
    return serviceNames[serviceName] || serviceName;
};

// Funzione per ottenere nome display dell'operazione
export const getServiceOperationDisplayName = (serviceName, operationType) => {
    const operationNames = {
        'chatbot': {
            'conversation': 'Conversazione',
            'system_message': 'Messaggio Sistema'
        },
        'llm': {
            'completion': 'Completamento',
            'chat': 'Chat'
        },
        'rag': {
            'query': 'Query',
            'embedding': 'Embedding'
        },
        'analysis': {
            'data_analysis': 'Analisi Dati',
            'prediction': 'Predizione'
        },
        'classification': {
            'image_classification': 'Classificazione Immagine',
            'text_classification': 'Classificazione Testo'
        }
    };
    return operationNames[serviceName]?.[operationType] || operationType;
};
```

### 2. Widget Generico (`ServiceUsageWidget.jsx`)

```jsx
import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FaChartBar, FaCoins, FaRobot, FaEye, FaSpinner } from 'react-icons/fa';
import { getServiceUsage, formatCurrency, formatNumber, getServiceDisplayName } from '../services/usageService';

const ServiceUsageWidget = forwardRef(({ serviceName, onOpenDetails }, ref) => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsageData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getServiceUsage(serviceName, 'current_month');
            setUsage(data.summary);
        } catch (err) {
            console.error(`Error fetching ${serviceName} usage:`, err);
            setError('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsageData();
    }, [serviceName]);

    // Esporta il metodo refresh per essere chiamato dall'esterno
    useImperativeHandle(ref, () => ({
        refreshUsage: fetchUsageData
    }));

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-center space-x-2">
                    <FaSpinner className="animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">Caricamento...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
                <div className="text-red-600 text-sm">{error}</div>
            </div>
        );
    }

    const totalCalls = usage?.total_calls || 0;
    const totalTokens = usage?.total_tokens || 0;
    const totalCostEur = usage?.total_cost_eur || 0;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                    <FaChartBar className="mr-2 text-blue-500" />
                    {getServiceDisplayName(serviceName)} - Questo mese
                </h3>
                <button
                    onClick={onOpenDetails}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                    <FaEye className="mr-1" />
                    Dettagli
                </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <div className="text-2xl font-bold text-blue-600">{formatNumber(totalCalls)}</div>
                    <div className="text-xs text-gray-500">Chiamate</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCostEur)}</div>
                    <div className="text-xs text-gray-500">Costo</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-purple-600">{formatNumber(totalTokens)}</div>
                    <div className="text-xs text-gray-500">Token</div>
                </div>
            </div>
        </div>
    );
});

export default ServiceUsageWidget;
```

### 3. Modale Generica (`ServiceUsageModal.jsx`)

```jsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaChartBar, FaCoins, FaRobot, FaClock, FaCheck, FaTimes as FaTimesCircle, FaCalendarAlt, FaSpinner } from 'react-icons/fa';
import { formatCurrency, formatNumber, getServiceDisplayName, getServiceOperationDisplayName, getServiceUsage } from '../services/usageService';

const ServiceUsageModal = ({ isOpen, onClose, serviceName, usage: initialUsage }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [usage, setUsage] = useState(initialUsage);
    const [loading, setLoading] = useState(false);

    // Quando il modale si apre, ricarica sempre i dati freschi
    useEffect(() => {
        if (isOpen && serviceName) {
            const fetchFreshData = async () => {
                try {
                    setLoading(true);
                    const freshData = await getServiceUsage(serviceName, 'current_month');
                    setUsage(freshData);
                } catch (err) {
                    console.error('Error fetching fresh usage data:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchFreshData();
        }
    }, [isOpen, serviceName]);

    if (!isOpen) return null;

    const summary = usage?.summary || {};
    const history = usage?.recent_history || [];

    const totalCalls = summary.total_calls || 0;
    const totalTokens = summary.total_tokens || 0;
    const totalCostUsd = summary.total_cost_usd || 0;
    const totalCostEur = summary.total_cost_eur || 0;
    const byModel = summary.by_model || [];
    const byOperation = summary.by_operation || [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <FaChartBar className="mr-3" />
                        <h2 className="text-xl font-bold">Consumi {getServiceDisplayName(serviceName)}</h2>
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
                                ? 'border-blue-500 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                            onClick={() => setActiveTab('overview')}
                        >
                            Panoramica
                        </button>
                        <button
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'history' 
                                ? 'border-blue-500 text-blue-600' 
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
                            <FaSpinner className="animate-spin text-blue-500 mr-2" />
                            <span>Caricamento dati aggiornati...</span>
                        </div>
                    ) : (
                        <>
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <FaRobot className="text-blue-600 mr-2" />
                                                <div>
                                                    <div className="text-2xl font-bold text-blue-600">{formatNumber(totalCalls)}</div>
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
                                                            <div className="font-medium">{model.model_used}</div>
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
                                                            <div className="font-medium">{getServiceOperationDisplayName(serviceName, operation.operation_type)}</div>
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
                                                                <span className="font-medium">{getServiceOperationDisplayName(serviceName, item.operation_type)}</span>
                                                                <span className="text-sm text-gray-500 ml-2">• {item.model_used}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 mb-2">
                                                                {item.input_preview}
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

export default ServiceUsageModal;
```

## Esempi di Implementazione per Servizio

### 1. Chatbot Service

```python
# In chatbot_service/chatbot_api/views.py
from .utils import calculate_service_cost, track_service_usage
import time

class ChatCompletionView(views.APIView):
    def post(self, request):
        start_time = time.time()
        user_id = request.user.id
        
        try:
            # ... logica esistente per chat completion
            
            # Esempio: calcola token e costi
            input_tokens = len(prompt.split()) * 1.3  # Approssimazione
            output_tokens = len(response_text.split()) * 1.3
            total_tokens, cost_usd, cost_eur = calculate_service_cost(
                'chatbot', model_name, input_tokens, output_tokens
            )
            
            # Traccia utilizzo
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='chatbot',
                operation_type='conversation',
                model_used=model_name,
                input_data=prompt,
                output_summary=response_text[:200] + '...' if len(response_text) > 200 else response_text,
                tokens_consumed=total_tokens,
                cost_usd=cost_usd,
                cost_eur=cost_eur,
                success=True,
                response_time_ms=response_time_ms
            )
            
            return Response({
                'response': response_text,
                'tokens_used': total_tokens,
                'cost_eur': cost_eur
            })
            
        except Exception as e:
            # Traccia anche i fallimenti
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='chatbot',
                operation_type='conversation',
                model_used=model_name,
                input_data=prompt,
                output_summary='',
                tokens_consumed=0,
                cost_usd=0,
                cost_eur=0,
                success=False,
                response_time_ms=response_time_ms
            )
            raise e
```

### 2. Data Analysis Service

```python
# In data_analysis_service/analysis_api/views.py
class DataAnalysisView(views.APIView):
    def post(self, request):
        start_time = time.time()
        user_id = request.user.id
        
        try:
            # ... logica di analisi
            
            # Calcola costi basati sulla complessità dell'analisi
            complexity_factor = len(dataset) / 1000  # Esempio
            base_tokens = 1000
            estimated_tokens = int(base_tokens * complexity_factor)
            
            total_tokens, cost_usd, cost_eur = calculate_service_cost(
                'analysis', 'gpt-4', estimated_tokens
            )
            
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='analysis',
                operation_type='data_analysis',
                model_used='gpt-4',
                input_data=f"Dataset: {dataset_name}, Rows: {len(dataset)}",
                output_summary=f"Analysis completed: {analysis_type}",
                tokens_consumed=total_tokens,
                cost_usd=cost_usd,
                cost_eur=cost_eur,
                success=True,
                response_time_ms=response_time_ms
            )
            
            return Response({
                'analysis_result': result,
                'tokens_used': total_tokens,
                'cost_eur': cost_eur
            })
            
        except Exception as e:
            # Traccia fallimenti
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='analysis',
                operation_type='data_analysis',
                model_used='gpt-4',
                input_data=f"Dataset: {dataset_name}",
                output_summary='',
                tokens_consumed=0,
                cost_usd=0,
                cost_eur=0,
                success=False,
                response_time_ms=response_time_ms
            )
            raise e
```

## Integrazione nel Frontend

### Uso nei componenti della pagina

```jsx
// In ChatbotServicePage.jsx
import ServiceUsageWidget from '../components/ServiceUsageWidget';
import ServiceUsageModal from '../components/ServiceUsageModal';

const ChatbotServicePage = () => {
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [usageData, setUsageData] = useState(null);
    const usageWidgetRef = useRef(null);

    const handleOpenUsageModal = () => {
        setShowUsageModal(true);
    };

    const handleCloseUsageModal = () => {
        setShowUsageModal(false);
    };

    // Dopo ogni chiamata API al chatbot
    const handleChatCompletion = async (message) => {
        try {
            const response = await chatbotService.sendMessage(message);
            
            // Aggiorna widget consumi
            if (usageWidgetRef.current) {
                usageWidgetRef.current.refreshUsage();
            }
            
            return response;
        } catch (error) {
            console.error('Chat error:', error);
        }
    };

    return (
        <div className="container mx-auto p-4">
            {/* Header con widget consumi */}
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Chatbot Service</h1>
                <div className="w-full max-w-xs">
                    <ServiceUsageWidget 
                        ref={usageWidgetRef}
                        serviceName="chatbot"
                        onOpenDetails={handleOpenUsageModal}
                    />
                </div>
            </div>

            {/* Contenuto principale */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chat interface */}
                <div className="bg-white rounded-lg shadow p-6">
                    {/* Chat UI */}
                </div>
            </div>

            {/* Modale consumi */}
            <ServiceUsageModal
                isOpen={showUsageModal}
                onClose={handleCloseUsageModal}
                serviceName="chatbot"
                usage={usageData}
            />
        </div>
    );
};
```

## Configurazione Database

### Migration per ogni servizio

```python
# Esempio: chatbot_service/chatbot_api/migrations/0002_add_usage_tracking.py
from django.db import migrations, models
import django.utils.timezone

class Migration(migrations.Migration):
    dependencies = [
        ('chatbot_api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceUsageTracking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.PositiveBigIntegerField(db_index=True)),
                ('operation_type', models.CharField(help_text="Tipo di operazione (es: 'chat', 'analysis', 'classification')", max_length=50)),
                ('service_name', models.CharField(help_text="Nome del servizio (es: 'chatbot', 'llm', 'rag')", max_length=50)),
                ('model_used', models.CharField(help_text='Modello AI utilizzato', max_length=100)),
                ('input_data', models.TextField(blank=True, help_text='Dati di input (prompt, query, etc.)')),
                ('output_summary', models.TextField(blank=True, help_text="Riassunto dell'output")),
                ('tokens_consumed', models.PositiveIntegerField(default=0)),
                ('cost_usd', models.DecimalField(decimal_places=6, default=0.0, max_digits=10)),
                ('cost_eur', models.DecimalField(decimal_places=6, default=0.0, max_digits=10)),
                ('success', models.BooleanField(default=True)),
                ('response_time_ms', models.PositiveIntegerField(help_text='Tempo di risposta in millisecondi')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='serviceusagetracking',
            index=models.Index(fields=['user_id', 'service_name'], name='chatbot_api_user_service_idx'),
        ),
        migrations.AddIndex(
            model_name='serviceusagetracking',
            index=models.Index(fields=['created_at'], name='chatbot_api_created_at_idx'),
        ),
    ]
```

## Checklist di Implementazione

### Backend
- [ ] Aggiungere modello `ServiceUsageTracking` in `models.py`
- [ ] Creare file `utils.py` con funzioni di calcolo costi
- [ ] Aggiungere view `ServiceUsageTrackingView` in `views.py`
- [ ] Configurare URL in `urls.py`
- [ ] Creare e applicare migration
- [ ] Aggiungere chiamate a `track_service_usage()` in tutte le view principali

### Frontend
- [ ] Aggiungere servizio specifico in `usageService.js`
- [ ] Importare `ServiceUsageWidget` e `ServiceUsageModal` nella pagina
- [ ] Configurare stati e ref per gestione widget
- [ ] Aggiungere chiamate a `refreshUsage()` dopo ogni operazione
- [ ] Testare widget e modale con dati reali

### Configurazione
- [ ] Aggiornare prezzi in `SERVICE_PRICING` in `utils.py`
- [ ] Configurare nomi display in `usageService.js`
- [ ] Aggiungere configurazione specifica per il servizio
- [ ] Testare calcolo costi e tracking

## Note Finali

1. **Consistenza**: Mantenere la stessa struttura in tutti i servizi
2. **Performance**: Indicizzare correttamente le query più frequenti
3. **Sicurezza**: Validare sempre user_id e permessi
4. **Monitoraggio**: Aggiungere log per debugging dei costi
5. **Aggiornamenti**: Mantenere aggiornati i prezzi dei modelli AI
6. **Testing**: Testare accuratezza del calcolo costi con dati reali

Questo sistema permette di avere un monitoraggio unificato dei consumi di tutti i servizi AI, mantenendo la consistenza nell'interfaccia utente e nel backend. 