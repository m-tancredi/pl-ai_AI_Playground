import os
import re
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai
from .models import Chat, ChatMessage, ChatSettings
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

    # Gestione risposta speciale per START_INTERVIEW
    if mode == 'intervista' and message == 'START_INTERVIEW':
        character_match = re.search(r'Interpreta il personaggio storico: ([^.\n]+)', system_prompt)
        if character_match:
            character_name = character_match.group(1).strip()
            response = f"Salve, sono {character_name}. Sono pronto per questa intervista impossibile. Cosa vorreste chiedermi?"
    
    # Gestione risposta speciale per START_INTERROGATION  
    elif mode == 'interrogazione' and message == 'START_INTERROGATION':
        response = "Iniziamo l'interrogazione. Ti farò delle domande sull'argomento specificato."

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
                completion = openai_client.chat.completions.create(
                    model="gpt-4" if model_name == 'gpt4' else "gpt-3.5-turbo",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024
                )
                response = completion.choices[0].message.content
            elif model_name == 'claude':
                message_response = anthropic_client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1024,
                    messages=messages,
                    temperature=0.7,
                    system=system_prompt if system_prompt else None
                )
                response = message_response.content[0].text
            else:  # Gemini
                model_version = "gemini-1.5-pro-001"
                model = genai.GenerativeModel(model_version)
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
        except Exception as e:
            last_error = str(e)
            response = f"Errore nella generazione della risposta: {last_error}"

    # Salva la risposta AI
    ChatMessage.objects.create(chat=chat, role='assistant', content=response, model=context.get('model'))

    # Conteggio token
    input_messages = [{"role": "user", "content": message}]
    input_tokens = count_tokens(input_messages)
    output_messages = [{'role': 'assistant', 'content': response}]
    output_tokens = count_tokens(output_messages)
    total_tokens = input_tokens + output_tokens

    token_info = {
        'total': total_tokens,
        'input': input_tokens,
        'output': output_tokens
    }

    return {
        'response': response,
        'chatId': chat_id,
        'token_info': token_info
    } 