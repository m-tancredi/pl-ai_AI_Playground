"""
Utility functions for cost calculation and currency conversion for Data Analysis Service.
"""
import requests
from decimal import Decimal
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# Pricing per modello (in USD)
MODEL_PRICING = {
    # OpenAI Models (per 1K tokens)
    'gpt-4': {
        'input_price_per_1k_tokens': Decimal('0.030'),  # $0.030 per 1K tokens input
        'output_price_per_1k_tokens': Decimal('0.060'),  # $0.060 per 1K tokens output
    },
    'gpt-3.5-turbo': {
        'input_price_per_1k_tokens': Decimal('0.0015'),  # $0.0015 per 1K tokens input
        'output_price_per_1k_tokens': Decimal('0.002'),  # $0.002 per 1K tokens output
    },
    # Claude Models (per 1K tokens)
    'claude-3-sonnet': {
        'input_price_per_1k_tokens': Decimal('0.003'),  # $0.003 per 1K tokens input
        'output_price_per_1k_tokens': Decimal('0.015'),  # $0.015 per 1K tokens output
    },
    # Custom ML Models (costo fisso per operazione)
    'custom-ml': {
        'price_per_operation': Decimal('0.001'),  # $0.001 per operazione
        'tokens_per_operation': 10,  # Token equivalenti per operazione
    },
    'scikit-learn': {
        'price_per_operation': Decimal('0.0005'),  # $0.0005 per operazione
        'tokens_per_operation': 5,  # Token equivalenti per operazione
    },
}

def get_usd_to_eur_rate() -> Decimal:
    """
    Ottiene il tasso di cambio USD -> EUR.
    Fallback a un tasso fisso se l'API esterna non è disponibile.
    """
    try:
        # Usando un servizio di cambio gratuito (esempio: exchangerate-api.com)
        response = requests.get(
            'https://api.exchangerate-api.com/v4/latest/USD',
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        eur_rate = data['rates']['EUR']
        return Decimal(str(eur_rate))
    except Exception as e:
        logger.warning(f"Could not fetch USD->EUR rate: {e}")
        # Fallback a un tasso fisso (approssimativo)
        return Decimal('0.85')

def calculate_cost_for_analysis(
    operation_type: str,
    model_name: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    prompt_length: int = 0,
    complexity_factor: float = 1.0
) -> Tuple[int, Decimal, Decimal]:
    """
    Calcola il costo per una specifica operazione di analisi.
    
    Args:
        operation_type: Tipo di operazione ('algorithm-suggestion', 'data-analysis', etc.)
        model_name: Nome del modello (es. 'gpt-4', 'scikit-learn')
        input_tokens: Numero di token in input (se noto)
        output_tokens: Numero di token in output (se noto)
        prompt_length: Lunghezza del prompt (per stima token)
        complexity_factor: Fattore di complessità per aggiustare il costo (default 1.0)
    
    Returns:
        Tuple[tokens_consumed, cost_usd, cost_eur]
    """
    
    if model_name not in MODEL_PRICING:
        logger.warning(f"Unknown model: {model_name}")
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    pricing = MODEL_PRICING[model_name]
    
    # Calcolo token e costo base
    if model_name in ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']:
        # Per modelli linguistici: calcolo basato su token
        if input_tokens == 0 and prompt_length > 0:
            # Stima token da lunghezza prompt (approssimazione: 1 token = 4 caratteri)
            input_tokens = max(prompt_length // 4, 10)
        
        if output_tokens == 0:
            # Stima output token basata sul tipo di operazione
            if operation_type == 'algorithm-suggestion':
                output_tokens = 200  # Suggerimenti algoritmi
            elif operation_type == 'synthetic-dataset':
                output_tokens = 500  # Generazione dataset
            else:
                output_tokens = 50  # Operazioni semplici
        
        tokens_consumed = input_tokens + output_tokens
        
        # Calcola costo input e output separatamente
        input_cost = (Decimal(input_tokens) / Decimal('1000')) * pricing['input_price_per_1k_tokens']
        output_cost = (Decimal(output_tokens) / Decimal('1000')) * pricing['output_price_per_1k_tokens']
        cost_usd = input_cost + output_cost
    else:
        # Per modelli ML custom: costo fisso per operazione
        tokens_consumed = pricing['tokens_per_operation']
        cost_usd = pricing['price_per_operation']
    
    # Applica fattore di complessità
    cost_usd *= Decimal(str(complexity_factor))
    
    # Conversione in EUR
    eur_rate = get_usd_to_eur_rate()
    cost_eur = cost_usd * eur_rate
    
    return tokens_consumed, cost_usd, cost_eur

def calculate_analysis_usage_summary(usage_records) -> Dict:
    """
    Calcola un riassunto dei consumi per il servizio di analisi.
    Separa le chiamate riuscite da quelle fallite per i calcoli di costo/token.
    
    Args:
        usage_records: QuerySet di AnalysisUsageTracking
    
    Returns:
        Dict con statistiche dei consumi
    """
    from django.db.models import Sum, Count, Q
    
    # Separa record riusciti da quelli falliti
    successful_records = usage_records.filter(success=True)
    failed_records = usage_records.filter(success=False)
    
    # Aggregazione totali (solo per chiamate riuscite)
    successful_totals = successful_records.aggregate(
        total_tokens=Sum('tokens_consumed'),
        total_cost_usd=Sum('cost_usd'),
        total_cost_eur=Sum('cost_eur'),
        total_calls=Count('id')
    )
    
    # Conta le chiamate fallite
    failed_count = failed_records.count()
    total_calls = usage_records.count()
    
    # Breakdown per modello (solo chiamate riuscite)
    by_model = successful_records.values('model_used').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    # Breakdown per tipo operazione (solo chiamate riuscite)
    by_operation = successful_records.values('operation_type').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    # Breakdown per algoritmo ML (se disponibile, solo chiamate riuscite)
    by_algorithm = successful_records.filter(
        algorithm_used__isnull=False
    ).values('algorithm_used').annotate(
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
        'by_algorithm': list(by_algorithm),
    }

def estimate_analysis_complexity(task_type: str, num_features: int = 0, num_samples: int = 0, algorithm: str = '') -> float:
    """
    Stima il fattore di complessità per un'operazione di analisi.
    
    Args:
        task_type: Tipo di task ('regression', 'classification', etc.)
        num_features: Numero di features nel dataset
        num_samples: Numero di campioni nel dataset
        algorithm: Algoritmo utilizzato
    
    Returns:
        float: Fattore di complessità (1.0 = standard)
    """
    complexity = 1.0
    
    # Aggiustamento per dimensioni dataset
    if num_samples > 10000:
        complexity *= 1.5
    elif num_samples > 1000:
        complexity *= 1.2
    
    if num_features > 50:
        complexity *= 1.3
    elif num_features > 10:
        complexity *= 1.1
    
    # Aggiustamento per algoritmo
    complex_algorithms = [
        'random_forest', 'gradient_boosting', 'xgboost',
        'neural_network', 'svm', 'ensemble'
    ]
    
    if any(alg in algorithm.lower() for alg in complex_algorithms):
        complexity *= 1.4
    
    return complexity

def track_analysis_usage(
    user_id: int,
    operation_type: str,
    model_used: str,
    input_data: str,
    output_summary: str = '',
    task_type: str = '',
    algorithm_used: str = '',
    tokens_consumed: int = 0,
    cost_usd: Decimal = Decimal('0.000000'),
    cost_eur: Decimal = Decimal('0.000000'),
    success: bool = True,
    response_time_ms: int = 0
):
    """
    Salva automaticamente i dati di utilizzo per il tracking.
    
    Args:
        user_id: ID dell'utente
        operation_type: Tipo di operazione
        model_used: Modello utilizzato
        input_data: Dati di input
        output_summary: Riassunto dell'output
        task_type: Tipo di task ML
        algorithm_used: Algoritmo utilizzato
        tokens_consumed: Token consumati
        cost_usd: Costo in USD
        cost_eur: Costo in EUR
        success: Se l'operazione è riuscita
        response_time_ms: Tempo di risposta in ms
    """
    try:
        from .models import AnalysisUsageTracking
        
        AnalysisUsageTracking.objects.create(
            user_id=user_id,
            operation_type=operation_type,
            model_used=model_used,
            input_data=input_data,
            output_summary=output_summary,
            task_type=task_type,
            algorithm_used=algorithm_used,
            tokens_consumed=tokens_consumed,
            cost_usd=cost_usd,
            cost_eur=cost_eur,
            success=success,
            response_time_ms=response_time_ms
        )
        logger.info(f"Tracked usage for user {user_id}: {operation_type} with {model_used}")
    except Exception as e:
        logger.error(f"Error tracking analysis usage: {e}")
        # Non bloccare l'operazione principale se il tracking fallisce 