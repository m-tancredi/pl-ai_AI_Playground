from decimal import Decimal
import datetime
from django.db.models import Sum, Count, Q
from .models import ServiceUsageTracking

# Configurazione prezzi per modelli Chatbot (per 1K tokens in USD)
CHATBOT_PRICING = {
    'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},  # per 1K tokens
    'gpt-4': {'input': 0.03, 'output': 0.06},
    'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
    'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},  # $0.15/$0.60 per 1M = $0.00015/$0.0006 per 1K
    'gpt-4o': {'input': 0.0025, 'output': 0.01},  # $2.50/$10.00 per 1M = $0.0025/$0.01 per 1K
    'claude-3-haiku-20240307': {'input': 0.00025, 'output': 0.00125},
    'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
    'gemini-1.5-pro-001': {'input': 0.0015, 'output': 0.002},  # Stima simile a GPT-3.5
}

# Tasso di cambio USD -> EUR (aggiornare periodicamente)
USD_TO_EUR_RATE = Decimal('0.85')

def calculate_chatbot_cost(model_name, input_tokens, output_tokens=0):
    """
    Calcola il costo per una chiamata al chatbot.
    
    Args:
        model_name: Nome del modello AI ('gpt-4', 'gpt-3.5-turbo', etc.)
        input_tokens: Numero di token in input
        output_tokens: Numero di token in output (default 0)
    
    Returns:
        tuple: (total_tokens, cost_usd, cost_eur)
    """
    if model_name not in CHATBOT_PRICING:
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    pricing = CHATBOT_PRICING[model_name]
    
    # Calcola costi per input e output
    input_cost = Decimal(str(input_tokens)) * Decimal(str(pricing['input'])) / Decimal('1000')
    output_cost = Decimal(str(output_tokens)) * Decimal(str(pricing['output'])) / Decimal('1000')
    
    total_tokens = input_tokens + output_tokens
    cost_usd = input_cost + output_cost
    cost_eur = cost_usd * USD_TO_EUR_RATE
    
    return total_tokens, cost_usd, cost_eur

def calculate_chatbot_usage_summary(user_id, period='current_month'):
    """
    Calcola un riassunto dei consumi per un utente del chatbot.
    
    Args:
        user_id: ID dell'utente
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
        service_name='chatbot'
    ).filter(filter_date).aggregate(
        total_tokens=Sum('tokens_consumed'),
        total_cost_usd=Sum('cost_usd'),
        total_cost_eur=Sum('cost_eur'),
        total_calls=Count('id')
    )
    
    # Query per breakdown per modello
    by_model = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name='chatbot'
    ).filter(filter_date).values('model_used').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    # Query per breakdown per operazione
    by_operation = ServiceUsageTracking.objects.filter(
        user_id=user_id,
        service_name='chatbot'
    ).filter(filter_date).values('operation_type').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    ).order_by('-tokens')
    
    return {
        'total_tokens': totals['total_tokens'] or 0,
        'total_cost_usd': float(totals['total_cost_usd'] or Decimal('0.000000')),
        'total_cost_eur': float(totals['total_cost_eur'] or Decimal('0.000000')),
        'total_calls': totals['total_calls'] or 0,
        'by_model': [
            {
                'model_used': item['model_used'],
                'tokens': item['tokens'],
                'cost_usd': float(item['cost_usd'] or Decimal('0.000000')),
                'cost_eur': float(item['cost_eur'] or Decimal('0.000000')),
                'calls': item['calls']
            }
            for item in by_model
        ],
        'by_operation': [
            {
                'operation_type': item['operation_type'],
                'tokens': item['tokens'],
                'cost_usd': float(item['cost_usd'] or Decimal('0.000000')),
                'cost_eur': float(item['cost_eur'] or Decimal('0.000000')),
                'calls': item['calls']
            }
            for item in by_operation
        ],
    }

def calculate_chatbot_usage_summary_v2(usage_records):
    """
    Calcola un riassunto dei consumi per il chatbot service.
    Separa le chiamate riuscite da quelle fallite per i calcoli di costo/token.
    
    Args:
        usage_records: QuerySet di ServiceUsageTracking
    
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

def track_chatbot_usage(user_id, operation_type, model_used, 
                       input_data, output_summary, tokens_consumed, 
                       cost_usd, cost_eur, success, response_time_ms):
    """
    Salva automaticamente i dati di utilizzo del chatbot.
    
    Chiamare questa funzione alla fine di ogni operazione AI.
    """
    try:
        ServiceUsageTracking.objects.create(
            user_id=user_id,
            service_name='chatbot',
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
        print(f"[CHATBOT TRACKING] User {user_id}: {operation_type} with {model_used} - {tokens_consumed} tokens, €{cost_eur}")
    except Exception as e:
        print(f"[ERROR] Error tracking chatbot usage: {e}")

def estimate_tokens_from_text(text):
    """
    Stima il numero di token da un testo.
    Approssimazione: 1 token = ~4 caratteri per l'inglese, ~3.5 per l'italiano
    """
    if not text:
        return 0
    # Stima conservativa per supportare italiano e inglese
    return max(1, len(text) // 3)

def get_model_display_name(model_name):
    """Restituisce il nome user-friendly del modello."""
    model_names = {
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-4': 'GPT-4',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4o-mini': 'GPT-4o Mini',
        'gpt-4o': 'GPT-4o',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'gemini-1.5-pro-001': 'Gemini 1.5 Pro',
        'system-response': 'Sistema',
        'unknown': 'Sconosciuto'
    }
    return model_names.get(model_name, model_name)

def get_operation_display_name(operation_type):
    """Restituisce il nome display per le operazioni del chatbot."""
    operation_names = {
        'conversation': 'Conversazione',
        'system_message': 'Messaggio Sistema',
        'interview': 'Intervista',
        'interrogation': 'Interrogazione',
    }
    return operation_names.get(operation_type, operation_type) 