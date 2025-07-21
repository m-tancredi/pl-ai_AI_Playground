#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chatbot_service.settings')
django.setup()

from chatbot_api.models import ServiceUsageTracking
from chatbot_api.utils import track_chatbot_usage, calculate_chatbot_cost

print("=== Test Sistema Tracking Chatbot ===")

# Test basic cost calculation
print("\n1. Test Calcolo Costi:")
tokens, cost_usd, cost_eur = calculate_chatbot_cost('gpt-4', 100, 50)
print(f'   GPT-4 (100 input + 50 output tokens): {tokens} tokens, ${cost_usd:.6f} USD, €{cost_eur:.6f} EUR')

tokens2, cost_usd2, cost_eur2 = calculate_chatbot_cost('gpt-3.5-turbo', 200, 100)
print(f'   GPT-3.5-Turbo (200 input + 100 output tokens): {tokens2} tokens, ${cost_usd2:.6f} USD, €{cost_eur2:.6f} EUR')

# Test tracking function
print("\n2. Test Tracking:")
try:
    track_chatbot_usage(
        user_id=1,
        operation_type='conversation', 
        model_used='gpt-4',
        input_data='Test message from automated test',
        output_summary='Test response from chatbot',
        tokens_consumed=150,
        cost_usd=cost_usd,
        cost_eur=cost_eur,
        success=True,
        response_time_ms=1500
    )
    print("   ✅ Track usage successful")
except Exception as e:
    print(f"   ❌ Track usage failed: {e}")

# Check if record was created
print("\n3. Verifica Database:")
try:
    count = ServiceUsageTracking.objects.count()
    print(f"   Total records: {count}")
    
    if count > 0:
        latest = ServiceUsageTracking.objects.latest('created_at')
        print(f"   Latest record: User {latest.user_id}, {latest.model_used}, {latest.tokens_consumed} tokens, €{latest.cost_eur}")
        print(f"   Operation: {latest.operation_type}, Success: {latest.success}")
    
except Exception as e:
    print(f"   ❌ Database check failed: {e}")

print("\n=== Test Completato ===") 