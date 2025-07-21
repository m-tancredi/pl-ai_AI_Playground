# Guida all'Implementazione del Sistema di Tracking Consumi

## Panoramica

Questo documento spiega come implementare il sistema di tracking dei consumi (token e costi in $ e €) negli altri microservizi del progetto, riutilizzando il codice sviluppato per `image_generator_service`.

**⚠️ IMPORTANTE: Sistema Anti-Frode**
Il sistema implementa un meccanismo di protezione anti-frode: **le chiamate fallite non vengono addebitate**. Costi e token delle chiamate con `success=False` sono esclusi dai totali, ma vengono comunque tracciati per statistiche e debugging.

## Architettura del Sistema

### Componenti Principali

1. **Backend**:
   - `models.py`: Modello per tracking consumi
   - `utils.py`: Funzioni per calcolo costi (con separazione fallimenti)
   - `views.py`: API endpoint per recuperare dati
   - `serializers.py`: Serializzatori per API response

2. **Frontend**:
   - `UsageWidget.jsx`: Widget compatto per monitoraggio (include info fallimenti)
   - `UsageModal.jsx`: Modale dettagliata per analisi (costi barrati per fallimenti)
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
    
    # Metadata (CAMPO CRITICO PER ANTI-FRODE)
    success = models.BooleanField(default=True, help_text="Whether the operation was successful")
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

⚠️ **IMPORTANTE**: Le funzioni di summary DEVONO separare chiamate riuscite da quelle fallite!

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
        'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'gpt-4o': {'input': 0.0025, 'output': 0.01},
        'claude-3-haiku-20240307': {'input': 0.00025, 'output': 0.00125},
        'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
        'gemini-1.5-pro-001': {'input': 0.0015, 'output': 0.002},
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
    
    ⚠️ IMPORTANTE: Esclude costi e token delle chiamate fallite (success=False)
    
    Args:
        user_id: ID dell'utente
        service_name: Nome del servizio
        period: Periodo di calcolo ('current_month', 'last_30_days', 'all_time')
    
    Returns:
        dict: Riassunto dei consumi con statistiche di successo/fallimento
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
    
    # Filtra per utente e servizio
    base_queryset = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name=service_name
    ).filter(filter_date)
    
    # Separa record riusciti da quelli falliti
    successful_records = base_queryset.filter(success=True)
    failed_records = base_queryset.filter(success=False)
    
    # Query per i totali (SOLO PER CHIAMATE RIUSCITE)
    successful_totals = successful_records.aggregate(
        total_tokens=Sum('tokens_consumed'),
        total_cost_usd=Sum('cost_usd'),
        total_cost_eur=Sum('cost_eur'),
        total_calls=Count('id')
    )
    
    # Conta le chiamate fallite
    failed_count = failed_records.count()
    total_calls = base_queryset.count()
    
    # Query per breakdown per modello (SOLO PER CHIAMATE RIUSCITE)
    by_model = successful_records.values('model_used').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    # Query per breakdown per operazione (SOLO PER CHIAMATE RIUSCITE)
    by_operation = successful_records.values('operation_type').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    return {
        'total_tokens': successful_totals['total_tokens'] or 0,
        'total_cost_usd': successful_totals['total_cost_usd'] or Decimal('0.000000'),
        'total_cost_eur': successful_totals['total_cost_eur'] or Decimal('0.000000'),
        'total_calls': total_calls or 0,
        'successful_calls': successful_totals['total_calls'] or 0,
        'failed_calls': failed_count,
        'success_rate': round((successful_totals['total_calls'] or 0) / total_calls * 100, 1) if total_calls > 0 else 0,
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
                'recent_records': [  # ⚠️ Usa 'recent_records' non 'recent_history'
                    {
                        'id': usage.id,
                        'operation_type': usage.operation_type,
                        'model_used': usage.model_used,
                        'tokens_consumed': usage.tokens_consumed,
                        'cost_usd': usage.cost_usd,
                        'cost_eur': usage.cost_eur,
                        'success': usage.success,  # Campo critico per frontend
                        'response_time_ms': usage.response_time_ms,
                        'created_at': usage.created_at,
                        'input_data': usage.input_data[:100] + '...' if len(usage.input_data) > 100 else usage.input_data,
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
    
    ⚠️ IMPORTANTE: Impostare sempre success=False per chiamate fallite
    
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
            tokens_consumed=tokens_consumed if success else 0,  # ⚠️ Zero per fallimenti
            cost_usd=cost_usd if success else Decimal('0.000000'),  # ⚠️ Zero per fallimenti
            cost_eur=cost_eur if success else Decimal('0.000000'),  # ⚠️ Zero per fallimenti
            success=success,
            response_time_ms=response_time_ms
        )
    except Exception as e:
        print(f"Error tracking service usage: {e}")
```

### 4. Serializers (`serializers.py`)

⚠️ **IMPORTANTE**: Includere i nuovi campi per statistiche fallimenti

```python
from rest_framework import serializers

class UsageSummarySerializer(serializers.Serializer):
    """Serializer per il riassunto dei consumi."""
    total_tokens = serializers.IntegerField()
    total_cost_usd = serializers.DecimalField(max_digits=10, decimal_places=6)
    total_cost_eur = serializers.DecimalField(max_digits=10, decimal_places=6)
    total_calls = serializers.IntegerField()
    successful_calls = serializers.IntegerField()  # ⚠️ NUOVO CAMPO
    failed_calls = serializers.IntegerField()      # ⚠️ NUOVO CAMPO
    success_rate = serializers.FloatField()        # ⚠️ NUOVO CAMPO
    by_model = serializers.ListSerializer(child=serializers.DictField())
    by_operation = serializers.ListSerializer(child=serializers.DictField())

class UsageRecordSerializer(serializers.Serializer):
    """Serializer per singolo record di utilizzo."""
    id = serializers.IntegerField()
    operation_type = serializers.CharField()
    model_used = serializers.CharField()
    tokens_consumed = serializers.IntegerField()
    cost_usd = serializers.DecimalField(max_digits=10, decimal_places=6)
    cost_eur = serializers.DecimalField(max_digits=10, decimal_places=6)
    success = serializers.BooleanField()  # ⚠️ CAMPO CRITICO
    response_time_ms = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    input_data = serializers.CharField()

class UsageResponseSerializer(serializers.Serializer):
    """Serializer per la risposta completa dell'API di consumo."""
    summary = UsageSummarySerializer()
    recent_records = serializers.ListSerializer(child=UsageRecordSerializer())
    period = serializers.CharField()
    user_id = serializers.IntegerField()
```

### 5. URL Configuration (`urls.py`)

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

⚠️ **IMPORTANTE**: Il servizio deve gestire le nuove statistiche sui fallimenti

```javascript
// Funzioni specifiche per servizio (aggiorna in base ai tuoi servizi)
export const getChatbotUsage = async (period = 'current_month') => {
    try {
        const response = await apiClient.get('/api/chatbot/usage/', {
            params: { period }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching chatbot usage:`, error);
        throw error;
    }
};

export const getAnalysisUsage = async (period = 'current_month') => {
    try {
        const response = await apiClient.get('/api/analysis/usage/', {
            params: { period }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching analysis usage:`, error);
        throw error;
    }
};

export const getUserUsage = async (period = 'current_month') => {  // Per images
    try {
        const response = await apiClient.get('/api/images/usage/', {
            params: { period }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching image usage:`, error);
        throw error;
    }
};

// Funzioni display name specifiche per servizio
export const getChatbotOperationDisplayName = (operationType) => {
    const operationNames = {
        'conversation': 'Conversazione',
        'system_message': 'Messaggio Sistema'
    };
    return operationNames[operationType] || operationType;
};

export const getChatbotModelDisplayName = (modelName) => {
    const modelNames = {
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-4': 'GPT-4',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4o-mini': 'GPT-4o Mini',
        'gpt-4o': 'GPT-4o',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'gemini-1.5-pro-001': 'Gemini 1.5 Pro'
    };
    return modelNames[modelName] || modelName;
};

export const getAnalysisOperationDisplayName = (operationType) => {
    const operationNames = {
        'algorithm-suggestion': 'Suggerimento Algoritmo',
        'data-analysis': 'Analisi Dati',
        'instance-prediction': 'Predizione Istanza',
        'synthetic-dataset': 'Dataset Sintetico'
    };
    return operationNames[operationType] || operationType;
};

export const getAnalysisModelDisplayName = (modelName) => {
    const modelNames = {
        'gpt-4': 'GPT-4',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'custom-ml': 'Modello ML Custom',
        'scikit-learn': 'Scikit-learn'
    };
    return modelNames[modelName] || modelName;
};

// Funzioni display name generiche
export const getModelDisplayName = (modelKey) => {
    const modelNames = {
        'dalle-2': 'DALL-E 2',
        'dalle-3': 'DALL-E 3', 
        'dalle-3-hd': 'DALL-E 3 HD',
        'gpt-image-1': 'GPT-Image-1',
        'stability': 'Stability AI',
        'gpt-4': 'GPT-4 (enhancement)'
    };
    return modelNames[modelKey] || modelKey;
};

export const getOperationDisplayName = (operationType) => {
    const operationNames = {
        'text-to-image': 'Testo → Immagine',
        'image-to-image': 'Immagine → Immagine', 
        'prompt-enhancement': 'Miglioramento Prompt'
    };
    return operationNames[operationType] || operationType;
};

// Utility functions
export const formatCurrency = (amount, currency = 'EUR') => {
    if (amount === null || amount === undefined) return `${currency === 'EUR' ? '€' : '$'}0.00`;
    const value = parseFloat(amount);
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'EUR' ? 4 : 6,
        maximumFractionDigits: currency === 'EUR' ? 4 : 6,
    }).format(value);
};

export const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('it-IT').format(num);
};
```

### 2. Widget Compatto (`UsageWidget.jsx`)

⚠️ **IMPORTANTE**: Usa sempre `UsageWidget.jsx`, non `ServiceUsageWidget.jsx`

```jsx
import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FaChartBar, FaCoins, FaImages, FaEye, FaSpinner, FaBrain, FaDatabase } from 'react-icons/fa';
import { getUserUsage, formatCurrency, formatNumber } from '../services/usageService';

const UsageWidget = forwardRef(({ 
    onOpenDetails,
    serviceName = 'images', 
    serviceDisplayName = 'Generazione Immagini',
    getUsageData = getUserUsage 
}, ref) => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsageData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getUsageData('current_month');
            setUsage(data);
        } catch (err) {
            console.error(`Error fetching ${serviceName} usage:`, err);
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
                const freshData = await getUsageData('current_month');
                setUsage(freshData);
                onOpenDetails(freshData);
            } catch (err) {
                console.error(`Error fetching fresh ${serviceName} usage data:`, err);
                onOpenDetails(usage); // Fallback ai dati cached
            } finally {
                setLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-gray-100">
                <div className="flex items-center justify-center space-x-2">
                    <FaSpinner className="animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">Caricamento...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-red-100">
                <div className="text-red-600 text-sm">{error}</div>
            </div>
        );
    }

    const summary = usage?.summary || {};
    const totalCalls = summary.total_calls || 0;
    const totalCostUSD = summary.total_cost_usd || 0;
    const totalCostEUR = summary.total_cost_eur || 0;
    const totalTokens = summary.total_tokens || 0;
    const failedCalls = summary.failed_calls || 0;          // ⚠️ NUOVO CAMPO
    const successRate = summary.success_rate || 100;        // ⚠️ NUOVO CAMPO

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
                {/* Operazioni eseguite (CON INFO FALLIMENTI) */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {serviceName === 'analysis' ? (
                            <FaBrain className="text-blue-500 text-xs" />
                        ) : serviceName === 'images' ? (
                            <FaImages className="text-blue-500 text-xs" />
                        ) : (
                            <FaDatabase className="text-blue-500 text-xs" />
                        )}
                        <span className="text-xs text-gray-600">
                            {serviceName === 'analysis' ? 'Analisi' : 'Operazioni'}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-semibold text-gray-800">
                            {formatNumber(totalCalls)}
                        </span>
                        {failedCalls > 0 && (
                            <div className="text-xs text-red-500">
                                {failedCalls} fallite
                            </div>
                        )}
                    </div>
                </div>

                {/* Costi (SOLO PER CHIAMATE RIUSCITE) */}
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

                {/* Token (SOLO PER CHIAMATE RIUSCITE) */}
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

            {/* Footer CON TASSO SUCCESSO */}
            <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                    {failedCalls > 0 ? (
                        <>Questo mese • Successo: {successRate.toFixed(1)}% • Click per dettagli</>
                    ) : (
                        <>Questo mese • Click per dettagli</>
                    )}
                </p>
            </div>
        </div>
    );
});

UsageWidget.displayName = 'UsageWidget';

export default UsageWidget; 
```

### 3. Modale Dettagliata (`UsageModal.jsx`)

⚠️ **IMPORTANTE**: Usa sempre `UsageModal.jsx`, non `ServiceUsageModal.jsx`

Il modale implementa la visualizzazione dei fallimenti con:
- **Costi barrati** per chiamate fallite
- **Sfondo rosso** per record falliti
- **Statistiche di successo** nell'overview
- **Label "(FALLITA)"** sui record falliti

```jsx
// Esempio di uso del componente UsageModal
const UsageModal = ({ isOpen, onClose, serviceName, serviceDisplayName, getUsageData, customGetOperationDisplayName, customGetModelDisplayName }) => {
    // ... resto del codice del modale
    
    // ESEMPIO: Come vengono visualizzati i record falliti
    {history.map((item) => (
        <div key={item.id} className={`rounded-lg p-4 ${item.success ? 'bg-gray-50' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center mb-2">
                        {item.success ? (
                            <FaCheck className="text-green-500 mr-2" />
                        ) : (
                            <FaTimesCircle className="text-red-500 mr-2" />
                        )}
                        <span className={`font-medium ${!item.success ? 'text-red-700' : ''}`}>
                            {customGetOperationDisplayName ? customGetOperationDisplayName(item.operation_type) : item.operation_type}
                            {!item.success && <span className="text-red-600 ml-2">(FALLITA)</span>}
                        </span>
                    </div>
                </div>
                <div className="text-right ml-4">
                    {item.success ? (
                        <>
                            <div className="text-sm font-medium text-green-600">
                                {formatCurrency(item.cost_eur)}
                            </div>
                            <div className="text-xs text-gray-500">
                                {formatNumber(item.tokens_consumed)} token
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-sm font-medium text-red-500 line-through">
                                {formatCurrency(item.cost_eur)}
                            </div>
                            <div className="text-xs text-red-400 line-through">
                                {formatNumber(item.tokens_consumed)} token
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-1">
                                Costo: 0 €
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    ))}
};
```

## Esempi di Implementazione per Servizio

### 1. Chatbot Service

⚠️ **IMPORTANTE**: Tracciare sempre i fallimenti con `success=False`

```python
# In chatbot_service/chatbot_api/views.py
from .utils import calculate_service_cost, track_service_usage
import time

class ChatCompletionView(views.APIView):
    def post(self, request):
        start_time = time.time()
        user_id = request.user.id
        model_name = request.data.get('model', 'gpt-3.5-turbo')
        prompt = request.data.get('message', '')
        
        try:
            # ... logica esistente per chat completion
            
            # Esempio: calcola token e costi
            input_tokens = len(prompt.split()) * 1.3  # Approssimazione
            output_tokens = len(response_text.split()) * 1.3
            total_tokens, cost_usd, cost_eur = calculate_service_cost(
                'chatbot', model_name, input_tokens, output_tokens
            )
            
            # Traccia utilizzo RIUSCITO
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
                success=True,  # ⚠️ CHIAMATA RIUSCITA
                response_time_ms=response_time_ms
            )
            
            return Response({
                'response': response_text,
                'tokens_used': total_tokens,
                'cost_eur': cost_eur
            })
            
        except Exception as e:
            # ⚠️ IMPORTANTE: Traccia anche i fallimenti con success=False
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='chatbot',
                operation_type='conversation',
                model_used=model_name,
                input_data=prompt,
                output_summary='',
                tokens_consumed=0,        # ⚠️ ZERO per fallimenti
                cost_usd=Decimal('0.000000'),  # ⚠️ ZERO per fallimenti
                cost_eur=Decimal('0.000000'),  # ⚠️ ZERO per fallimenti
                success=False,            # ⚠️ CHIAMATA FALLITA
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
                success=True,             # ⚠️ CHIAMATA RIUSCITA
                response_time_ms=response_time_ms
            )
            
            return Response({
                'analysis_result': result,
                'tokens_used': total_tokens,
                'cost_eur': cost_eur
            })
            
        except Exception as e:
            # ⚠️ IMPORTANTE: Traccia fallimenti
            response_time_ms = int((time.time() - start_time) * 1000)
            track_service_usage(
                user_id=user_id,
                service_name='analysis',
                operation_type='data_analysis',
                model_used='gpt-4',
                input_data=f"Dataset: {dataset_name}",
                output_summary='',
                tokens_consumed=0,        # ⚠️ ZERO per fallimenti
                cost_usd=Decimal('0.000000'),  # ⚠️ ZERO per fallimenti  
                cost_eur=Decimal('0.000000'),  # ⚠️ ZERO per fallimenti
                success=False,            # ⚠️ CHIAMATA FALLITA
                response_time_ms=response_time_ms
            )
            raise e
```

## Integrazione nel Frontend

⚠️ **IMPORTANTE**: Usa sempre `UsageModal` e `UsageWidget`, non i componenti con prefisso `Service`

```jsx
// In ChatbotServicePage.jsx
import UsageWidget from '../components/UsageWidget';      // ⚠️ NON ServiceUsageWidget
import UsageModal from '../components/UsageModal';        // ⚠️ NON ServiceUsageModal
import { getChatbotUsage, getChatbotOperationDisplayName, getChatbotModelDisplayName } from '../services/usageService';

const ChatbotServicePage = () => {
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [usageData, setUsageData] = useState(null);
    const usageWidgetRef = useRef(null);

    const handleOpenUsageModal = async () => {
        try {
            const freshData = await getChatbotUsage('current_month');
            setUsageData(freshData);
            setShowUsageModal(true);
        } catch (error) {
            console.error('Error fetching usage data:', error);
            setShowUsageModal(true); // Apri comunque il modale
        }
    };

    const handleCloseUsageModal = () => {
        setShowUsageModal(false);
        setUsageData(null);
    };

    // Dopo ogni chiamata API al chatbot
    const handleChatCompletion = async (message) => {
        try {
            const response = await chatbotService.sendMessage(message);
            
            // ⚠️ IMPORTANTE: Aggiorna widget consumi dopo ogni operazione
            if (usageWidgetRef.current) {
                usageWidgetRef.current.refreshUsage();
            }
            
            return response;
        } catch (error) {
            console.error('Chat error:', error);
            // ⚠️ Aggiorna anche in caso di errore per mostrare il fallimento
            if (usageWidgetRef.current) {
                usageWidgetRef.current.refreshUsage();
            }
        }
    };

    return (
        <div className="container mx-auto p-4">
            {/* Header con widget consumi */}
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Chatbot Service</h1>
                <div className="w-full max-w-xs">
                    <UsageWidget 
                        ref={usageWidgetRef}
                        serviceName="chatbot"
                        serviceDisplayName="Chatbot"
                        getUsageData={getChatbotUsage}
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

            {/* Modale consumi CON ANTI-FRODE */}
            <UsageModal
                isOpen={showUsageModal}
                onClose={handleCloseUsageModal}
                serviceName="chatbot"
                serviceDisplayName="Chatbot"
                getUsageData={getChatbotUsage}
                customGetOperationDisplayName={getChatbotOperationDisplayName}
                customGetModelDisplayName={getChatbotModelDisplayName}
            />
        </div>
    );
};
```

## Configurazione Database

### Migration per ogni servizio

⚠️ **IMPORTANTE**: Il campo `success` è CRITICO per il sistema anti-frode

```python
# Esempio: chatbot_service/chatbot_api/migrations/0002_add_usage_tracking.py
from django.db import migrations, models
import django.utils.timezone
from decimal import Decimal

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
                ('cost_usd', models.DecimalField(decimal_places=6, default=Decimal('0.000000'), max_digits=10)),
                ('cost_eur', models.DecimalField(decimal_places=6, default=Decimal('0.000000'), max_digits=10)),
                ('success', models.BooleanField(default=True, help_text='Whether the operation was successful')),  # ⚠️ CAMPO CRITICO
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
        # ⚠️ IMPORTANTE: Index sul campo success per performance
        migrations.AddIndex(
            model_name='serviceusagetracking',
            index=models.Index(fields=['user_id', 'success'], name='chatbot_api_user_success_idx'),
        ),
    ]
```

## Checklist di Implementazione

### Backend
- [ ] Aggiungere modello `ServiceUsageTracking` con campo `success` in `models.py`
- [ ] Creare file `utils.py` con funzioni che SEPARANO fallimenti da successi
- [ ] Aggiornare funzione summary per escludere costi/token dei fallimenti
- [ ] Aggiungere view `ServiceUsageTrackingView` in `views.py`
- [ ] Aggiornare serializers con campi `successful_calls`, `failed_calls`, `success_rate`
- [ ] Configurare URL in `urls.py`
- [ ] Creare e applicare migration con index su campo `success`
- [ ] Aggiungere chiamate a `track_service_usage()` con `success=False/True` appropriato

### Frontend
- [ ] Aggiungere servizio specifico in `usageService.js`
- [ ] Importare `UsageWidget` e `UsageModal` (NON Service*) nella pagina
- [ ] Configurare stati e ref per gestione widget
- [ ] Passare funzioni `customGetOperationDisplayName` e `customGetModelDisplayName`
- [ ] Aggiungere chiamate a `refreshUsage()` dopo ogni operazione (anche fallite)
- [ ] Testare visualizzazione fallimenti con costi barrati

### Configurazione
- [ ] Aggiornare prezzi in `SERVICE_PRICING` in `utils.py`
- [ ] Configurare nomi display nelle funzioni `*DisplayName` in `usageService.js`
- [ ] Aggiungere configurazione specifica per il servizio
- [ ] Testare calcolo costi e tracking con chiamate riuscite E fallite

### Test Anti-Frode
- [ ] Verificare che chiamate fallite abbiano `success=False`
- [ ] Verificare che chiamate fallite abbiano costi/token = 0 nei totali
- [ ] Verificare che fallimenti siano visibili ma non fatturati nel frontend
- [ ] Testare statistiche `success_rate`, `failed_calls`, `successful_calls`

## Note Finali

1. **Anti-Frode**: Il campo `success` è CRITICO - mai fatturare chiamate fallite
2. **Consistenza**: Usa sempre `UsageModal` e `UsageWidget`, mai i componenti Service*
3. **Performance**: Indicizza campo `success` per query di separazione veloce
4. **Sicurezza**: Validare sempre user_id e permessi
5. **Monitoraggio**: Aggiungere log per debugging dei costi E fallimenti
6. **Aggiornamenti**: Mantenere aggiornati i prezzi dei modelli AI
7. **Testing**: Testare accuratezza con chiamate riuscite E fallite
8. **Visualizzazione**: I fallimenti devono essere evidenziati ma mai fatturati

**⚠️ PROTEZIONE ANTI-FRODE ATTIVA: Le chiamate fallite sono tracciate ma NON addebitate**

Questo sistema garantisce trasparenza totale all'utente e protezione da addebiti impropri per operazioni non riuscite. 