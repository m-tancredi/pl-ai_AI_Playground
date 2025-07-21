"""
Utility functions for cost calculation and currency conversion.
"""
import requests
from decimal import Decimal
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# Pricing per modello (in USD)
MODEL_PRICING = {
    # OpenAI Image Models (per immagine)
    'dalle-2': {
        'price_per_image': Decimal('0.020'),  # $0.020 per 1024x1024
        'tokens_per_image': 1000,  # Approssimativo
    },
    'dalle-3': {
        'price_per_image': Decimal('0.040'),  # $0.040 per 1024x1024  
        'tokens_per_image': 1000,  # Approssimativo
    },
    'dalle-3-hd': {
        'price_per_image': Decimal('0.080'),  # $0.080 per 1024x1024 HD
        'tokens_per_image': 1000,  # Approssimativo
    },
    'gpt-image-1': {
        'price_per_image': Decimal('0.100'),  # $0.100 per immagine (stima)
        'tokens_per_image': 1000,  # Approssimativo
    },
    # Stability AI
    'stability': {
        'price_per_image': Decimal('0.030'),  # $0.030 per immagine
        'tokens_per_image': 1000,  # Approssimativo
    },
    # GPT-4 per prompt enhancement (per 1K tokens)
    'gpt-4': {
        'price_per_1k_tokens': Decimal('0.030'),  # $0.030 per 1K tokens input
        'tokens_per_request': 100,  # Approssimativo per prompt enhancement
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

def calculate_cost_for_model(
    model_name: str,
    operation_type: str,
    quality: str = 'standard',
    aspect_ratio: str = '1:1',
    prompt_length: int = 0
) -> Tuple[int, Decimal, Decimal]:
    """
    Calcola il costo per una specifica operazione AI.
    
    Args:
        model_name: Nome del modello (es. 'dalle-3', 'gpt-image-1')
        operation_type: Tipo di operazione ('text-to-image', 'image-to-image', 'prompt-enhancement')
        quality: Qualità dell'immagine ('standard', 'hd')
        aspect_ratio: Rapporto d'aspetto ('1:1', '16:9', etc.)
        prompt_length: Lunghezza del prompt (per calcolo token)
    
    Returns:
        Tuple[tokens_consumed, cost_usd, cost_eur]
    """
    
    if model_name not in MODEL_PRICING:
        logger.warning(f"Unknown model: {model_name}")
        return 0, Decimal('0.000000'), Decimal('0.000000')
    
    pricing = MODEL_PRICING[model_name]
    
    # Calcolo token e costo base
    if operation_type == 'prompt-enhancement':
        # Per GPT-4 (prompt enhancement)
        estimated_tokens = max(prompt_length // 4, 50)  # Approssimazione: 1 token = 4 caratteri
        tokens_consumed = estimated_tokens
        cost_usd = (Decimal(tokens_consumed) / Decimal('1000')) * pricing['price_per_1k_tokens']
    else:
        # Per modelli di generazione immagini
        tokens_consumed = pricing['tokens_per_image']
        cost_usd = pricing['price_per_image']
        
        # Aggiusta per qualità HD
        if quality == 'hd' and model_name in ['dalle-3', 'dalle-3-hd', 'gpt-image-1']:
            cost_usd *= Decimal('2.0')  # HD costa il doppio
        
        # Aggiusta per aspect ratio (immagini più grandi costano di più)
        if aspect_ratio in ['16:9', '9:16']:
            cost_usd *= Decimal('1.5')  # Aspect ratio non quadrato costa il 50% in più
    
    # Conversione in EUR
    eur_rate = get_usd_to_eur_rate()
    cost_eur = cost_usd * eur_rate
    
    return tokens_consumed, cost_usd, cost_eur

def calculate_monthly_usage_summary(usage_records) -> Dict:
    """
    Calcola un riassunto mensile dei consumi.
    Separa le chiamate riuscite da quelle fallite per i calcoli di costo/token.
    
    Args:
        usage_records: QuerySet di ImageGenerationUsage
    
    Returns:
        Dict con statistiche mensili
    """
    from django.db.models import Sum, Count, Q
    
    # Separa record riusciti da quelli falliti
    successful_records = usage_records.filter(success=True)
    failed_records = usage_records.filter(success=False)
    
    # Aggregazione (solo per chiamate riuscite)
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
    )
    
    # Breakdown per tipo operazione (solo chiamate riuscite)
    by_operation = successful_records.values('operation_type').annotate(
        tokens=Sum('tokens_consumed'),
        cost_usd=Sum('cost_usd'),
        cost_eur=Sum('cost_eur'),
        calls=Count('id')
    )
    
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