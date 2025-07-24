from decimal import Decimal
import datetime
from django.db.models import Sum, Count, Q
from ..models import ServiceUsageTracking

# Configurazione prezzi per Learning Service
LEARNING_SERVICE_PRICING = {
    'learning': {
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},  # per 1K tokens
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
        'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'gpt-4o': {'input': 0.0025, 'output': 0.01},
        'claude-3-haiku-20240307': {'input': 0.00025, 'output': 0.00125},
        'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
        'gemini-1.5-pro-001': {'input': 0.0015, 'output': 0.002},
    }
}

# Tasso di cambio USD -> EUR (aggiornare periodicamente)
USD_TO_EUR_RATE = Decimal('0.85')

def calculate_learning_service_cost(model_name, input_tokens, output_tokens=0):
    """
    Calcola il costo per una chiamata al Learning Service.
    
    Args:
        model_name: Nome del modello AI
        input_tokens: Numero di token in input
        output_tokens: Numero di token in output (default 0)
    
    Returns:
        tuple: (total_tokens, cost_usd, cost_eur)
    """
    if model_name not in LEARNING_SERVICE_PRICING['learning']:
        # Fallback per modelli non configurati
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    pricing = LEARNING_SERVICE_PRICING['learning'][model_name]
    
    # Calcola costi per input e output
    input_cost = Decimal(str(input_tokens)) * Decimal(str(pricing['input'])) / Decimal('1000')
    output_cost = Decimal(str(output_tokens)) * Decimal(str(pricing['output'])) / Decimal('1000')
    
    total_tokens = input_tokens + output_tokens
    cost_usd = input_cost + output_cost
    cost_eur = cost_usd * USD_TO_EUR_RATE
    
    return total_tokens, cost_usd, cost_eur

def calculate_learning_usage_summary(user_id, period='current_month'):
    """
    Calcola un riassunto dei consumi del Learning Service per un utente.
    
    ⚠️ IMPORTANTE: Esclude costi e token delle chiamate fallite (success=False)
    
    Args:
        user_id: ID dell'utente
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
    
    # Filtra per utente e servizio learning
    base_queryset = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name='learning'
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
        'success_rate': round((successful_totals['total_calls'] or 0) / total_calls * 100, 1) if total_calls > 0 else 100,
        'by_model': list(by_model),
        'by_operation': list(by_operation),
    }

def track_learning_service_usage(user_id, operation_type, model_used, 
                                input_data, output_summary, tokens_consumed, 
                                cost_usd, cost_eur, success, response_time_ms):
    """
    Salva automaticamente i dati di utilizzo del Learning Service.
    
    ⚠️ IMPORTANTE: Impostare sempre success=False per chiamate fallite
    
    Chiamare questa funzione alla fine di ogni operazione AI.
    
    Args:
        user_id: ID dell'utente
        operation_type: Tipo operazione ('lesson_generation', 'quiz_generation', 'approfondimenti_generation')
        model_used: Modello AI utilizzato
        input_data: Dati di input (topic, prompt, etc.)
        output_summary: Riassunto dell'output
        tokens_consumed: Token utilizzati
        cost_usd: Costo in USD
        cost_eur: Costo in EUR
        success: Se l'operazione è riuscita
        response_time_ms: Tempo di risposta in ms
    """
    try:
        ServiceUsageTracking.objects.create(
            user_id=user_id,
            service_name='learning',
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
        print(f"Error tracking learning service usage: {e}")

def estimate_tokens_from_text(text):
    """
    Stima approssimativa dei token basata sul testo.
    
    Args:
        text: Testo da analizzare
        
    Returns:
        int: Numero stimato di token
    """
    if not text:
        return 0
    
    # Approssimazione: ~1.3 token per parola per testi italiani
    word_count = len(text.split())
    return int(word_count * 1.3) 