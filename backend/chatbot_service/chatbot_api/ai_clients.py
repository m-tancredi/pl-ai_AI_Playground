import os
import re
import time
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai
from .models import Chat, ChatMessage, ChatSettings
from .utils import calculate_chatbot_cost, track_chatbot_usage, estimate_tokens_from_text
import tiktoken

def read_secret(path):
    try:
        if path and os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
    except Exception:
        pass
    # Fallback: prova a leggere la variabile d'ambiente classica
    return None

openai_api_key = read_secret(os.environ.get('OPENAI_API_KEY_FILE', '')) or os.environ.get('OPENAI_API_KEY')
anthropic_api_key = read_secret(os.environ.get('ANTHROPIC_API_KEY_FILE', '')) or os.environ.get('ANTHROPIC_API_KEY')
gemini_api_key = read_secret(os.environ.get('GEMINI_API_KEY_FILE', '')) or os.environ.get('GEMINI_API_KEY')

openai_client = OpenAI(api_key=openai_api_key) if openai_api_key else None
anthropic_client = Anthropic(api_key=anthropic_api_key) if anthropic_api_key else None
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

def count_tokens(messages):
    try:
        encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
        num_tokens = 0
        for message in messages:
            num_tokens += 3
            num_tokens += len(encoding.encode(message.get('role', '')))
            num_tokens += len(encoding.encode(message.get('content', '')))
        num_tokens += 3
        return num_tokens
    except Exception:
        total_chars = sum(len(m.get('content', '')) for m in messages)
        return total_chars // 4

def process_ai_message(message, context, chat_id, user_id):
    start_time = time.time()
    
    # Recupera o crea la chat
    if chat_id:
        chat = Chat.objects.get(id=chat_id, user_id=user_id)
    else:
        chat = Chat.objects.create(user_id=user_id, title=message[:50])
        ChatSettings.objects.create(
            chat=chat,
            grade=context.get('grade'),
            mode=context.get('mode'),
            subject=context.get('subject'),
            model=context.get('model'),
            system_prompt=context.get('systemPrompt')
        )
        chat_id = chat.id

    # Gestione speciale per modalità START_INTERVIEW e START_INTERROGATION
    mode = context.get('mode', '')
    system_prompt = context.get('systemPrompt', '')
    
    # Gestione titolo per modalità intervista
    if mode == 'intervista' and message == 'START_INTERVIEW':
        # Estrae il nome del personaggio dal system prompt
        character_match = re.search(r'Interpreta il personaggio storico: ([^.\n]+)', system_prompt)
        if character_match:
            character_name = character_match.group(1).strip()
            # Aggiorna il titolo della chat
            chat.title = f"Intervista a {character_name}"
            chat.save()
    
    # Gestione titolo per modalità interrogazione  
    elif mode == 'interrogazione' and message == 'START_INTERROGATION':
        subject = context.get('subject', 'materia')
        # Aggiorna il titolo della chat
        chat.title = f"Interrogazione di {subject}"
        chat.save()

    # Salva il messaggio utente
    ChatMessage.objects.create(chat=chat, role='user', content=message, model=context.get('model'))

    model_name = context.get('model', 'gpt4')
    response = None
    last_error = None
    ai_model_used = None
    input_tokens = 0
    output_tokens = 0
    operation_type = 'conversation'

    # Determina il tipo di operazione
    if mode == 'intervista':
        operation_type = 'interview'
    elif mode == 'interrogazione':
        operation_type = 'interrogation'
    elif system_prompt:
        operation_type = 'system_message'

    # Gestione risposta speciale per START_INTERVIEW
    if mode == 'intervista' and message == 'START_INTERVIEW':
        character_match = re.search(r'Interpreta il personaggio storico: ([^.\n]+)', system_prompt)
        if character_match:
            character_name = character_match.group(1).strip()
            response = f"Salve, sono {character_name}. Sono pronto per questa intervista impossibile. Cosa vorreste chiedermi?"
            ai_model_used = 'system-response'
            input_tokens = estimate_tokens_from_text(message + system_prompt)
            output_tokens = estimate_tokens_from_text(response)
    
    # Gestione risposta speciale per START_INTERROGATION  
    elif mode == 'interrogazione' and message == 'START_INTERROGATION':
        response = "Iniziamo l'interrogazione. Ti farò delle domande sull'argomento specificato."
        ai_model_used = 'system-response'
        input_tokens = estimate_tokens_from_text(message + system_prompt)
        output_tokens = estimate_tokens_from_text(response)

    # Se non è una risposta speciale, procedi con l'AI
    if response is None:
        # Recupera la storia della chat
        chat_history = ChatMessage.objects.filter(chat=chat).order_by('created_at')
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        for msg in chat_history:
            if msg.role == 'user':
                messages.append({"role": "user", "content": msg.content})
            elif msg.role in ['bot', 'assistant']:
                messages.append({"role": "assistant", "content": msg.content})
        messages.append({"role": "user", "content": message})

        try:
            if model_name.startswith('gpt'):
                # Mappa i nomi dei modelli frontend ai nomi API OpenAI
                if model_name == 'gpt4':
                    ai_model_used = "gpt-4"
                elif model_name == 'gpt4o':
                    ai_model_used = "gpt-4o"
                elif model_name == 'gpt4o-mini':
                    ai_model_used = "gpt-4o-mini"
                elif model_name == 'gpt4-turbo':
                    ai_model_used = "gpt-4-turbo"
                else:
                    ai_model_used = "gpt-3.5-turbo"  # Default fallback
                
                completion = openai_client.chat.completions.create(
                    model=ai_model_used,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024
                )
                response = completion.choices[0].message.content
                # Calcolo preciso dei token per OpenAI
                input_tokens = completion.usage.prompt_tokens
                output_tokens = completion.usage.completion_tokens
            elif model_name == 'claude':
                ai_model_used = "claude-3-haiku-20240307"
                message_response = anthropic_client.messages.create(
                    model=ai_model_used,
                    max_tokens=1024,
                    messages=messages,
                    temperature=0.7,
                    system=system_prompt if system_prompt else None
                )
                response = message_response.content[0].text
                # Claude fornisce usage info
                input_tokens = message_response.usage.input_tokens
                output_tokens = message_response.usage.output_tokens
            else:  # Gemini
                ai_model_used = "gemini-1.5-pro-001"
                model = genai.GenerativeModel(ai_model_used)
                conversation = ""
                if system_prompt:
                    conversation += f"System: {system_prompt}\n\n"
                for m in messages:
                    if m['role'] == 'user':
                        conversation += f"User: {m['content']}\n"
                    elif m['role'] == 'assistant':
                        conversation += f"Assistant: {m['content']}\n"
                conversation += f"User: {message}\n"
                result = model.generate_content(conversation)
                response = result.text
                # Stima token per Gemini (non fornisce usage esatti)
                input_tokens = estimate_tokens_from_text(conversation)
                output_tokens = estimate_tokens_from_text(response)
        except Exception as e:
            last_error = str(e)
            response = f"Errore nella generazione della risposta: {last_error}"
            # Stima token per errore
            input_tokens = estimate_tokens_from_text(' '.join([msg.get('content', '') for msg in messages]))
            output_tokens = estimate_tokens_from_text(response)

    # Salva la risposta AI
    ChatMessage.objects.create(chat=chat, role='assistant', content=response, model=context.get('model'))

    # Calcolo costi e tracking
    end_time = time.time()
    response_time_ms = int((end_time - start_time) * 1000)
    success = last_error is None
    
    total_tokens = input_tokens + output_tokens
    cost_usd = 0.0
    cost_eur = 0.0
    
    # Calcola costi solo se non è una risposta di sistema
    if ai_model_used and ai_model_used != 'system-response':
        total_tokens, cost_usd, cost_eur = calculate_chatbot_cost(ai_model_used, input_tokens, output_tokens)

    # Traccia utilizzo se user_id è disponibile
    if user_id:
        track_chatbot_usage(
            user_id=user_id,
            operation_type=operation_type,
            model_used=ai_model_used or 'unknown',
            input_data=message[:500],  # Limita per evitare DB overflow
            output_summary=response[:200] + '...' if len(response) > 200 else response,
            tokens_consumed=total_tokens,
            cost_usd=cost_usd,
            cost_eur=cost_eur,
            success=success,
            response_time_ms=response_time_ms
        )

    # Backward compatibility con il sistema esistente
    token_info = {
        'total': total_tokens,
        'input': input_tokens,
        'output': output_tokens
    }

    return {
        'response': response,
        'chatId': chat_id,
        'token_info': token_info,
        'cost_info': {  # Nuova informazione per il frontend
            'cost_usd': float(cost_usd),
            'cost_eur': float(cost_eur),
            'model_used': ai_model_used
        }
    } 