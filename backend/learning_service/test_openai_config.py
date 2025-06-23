#!/usr/bin/env python
"""
Script per testare la configurazione OpenAI del Learning Service
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service_config.settings')
django.setup()

def read_secret(path):
    """Legge un secret da file"""
    try:
        if path and os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
    except Exception as e:
        print(f"❌ Errore leggendo secret da {path}: {e}")
    return None

def test_openai_config():
    """Testa la configurazione OpenAI"""
    print("🔍 Testing OpenAI Configuration...")
    print("=" * 50)
    
    # Test 1: Secrets file (Docker)
    secret_file = os.environ.get('OPENAI_API_KEY_FILE', '/run/secrets/openai_api_key_secret')
    secret_key = read_secret(secret_file)
    
    if secret_key:
        print(f"✅ Secret file trovato: {secret_file}")
        print(f"✅ Chiave API caricata (lunghezza: {len(secret_key)} caratteri)")
        masked_key = secret_key[:7] + "*" * (len(secret_key) - 11) + secret_key[-4:]
        print(f"✅ Chiave mascherata: {masked_key}")
    else:
        print(f"❌ Secret file non trovato: {secret_file}")
    
    # Test 2: Environment variable (Locale)
    env_key = os.environ.get('OPENAI_API_KEY')
    if env_key:
        print(f"✅ Variabile d'ambiente trovata")
        print(f"✅ Chiave API caricata (lunghezza: {len(env_key)} caratteri)")
        masked_key = env_key[:7] + "*" * (len(env_key) - 11) + env_key[-4:]
        print(f"✅ Chiave mascherata: {masked_key}")
    else:
        print(f"❌ Variabile d'ambiente OPENAI_API_KEY non trovata")
    
    # Test 3: OpenAI Client initialization
    try:
        from learning_api.config.openai_client import OpenAIClient
        client = OpenAIClient()
        print("✅ OpenAI client inizializzato correttamente")
        
        # Test basic functionality
        test_topic = "Test matematica"
        print(f"🧪 Test generazione lezione: '{test_topic}'")
        try:
            lesson_content = client.generate_lesson(test_topic, max_lines=3)
            print(f"✅ Lezione generata con successo ({len(lesson_content)} caratteri)")
            print(f"📄 Anteprima: {lesson_content[:100]}...")
        except Exception as e:
            print(f"❌ Errore generazione lezione: {e}")
            
    except Exception as e:
        print(f"❌ Errore inizializzazione client: {e}")
    
    print("=" * 50)
    print("🏁 Test completato")

if __name__ == "__main__":
    test_openai_config() 