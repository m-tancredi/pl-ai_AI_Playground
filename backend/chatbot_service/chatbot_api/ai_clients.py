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

def get_age_context(grade):
    """
    Restituisce il contesto di età appropriato per il grado scolastico
    """
    age_mapping = {
        'sec1': '11-14 anni (scuola media)',
        'sec2-biennio': '15-16 anni (biennio superiori)', 
        'sec2-triennio': '17-19 anni (triennio superiori)'
    }
    return age_mapping.get(grade, 'età appropriata')

def create_interrogation_system_prompt(context_prompt, grade):
    """
    Crea un system prompt specifico per la modalità interrogazione
    """
    age_context = get_age_context(grade)
    
    interrogation_prompt = f"""Sei un docente esperto che conduce un'interrogazione orale. Il tuo compito è valutare le conoscenze dello studente attraverso un dialogo strutturato.

CONTESTO DELLE CONOSCENZE DA VERIFICARE:
{context_prompt}

COMPORTAMENTO RICHIESTO:

1. **AVVIO IMMEDIATO**: Inizia subito con una domanda pertinente basata sul contesto fornito.

2. **CICLO DI FEEDBACK STRUTTURATO**: Per ogni risposta dello studente devi:
   - VALUTARE la correttezza e completezza della risposta
   - FORNIRE feedback costruttivo (confermare se corretta, correggere se errata)  
   - INTEGRARE con informazioni aggiuntive quando necessario per approfondire l'apprendimento
   - CONCLUDERE SEMPRE con una nuova domanda per mantenere il flusso dell'interrogazione

3. **CONTESTO PEDAGOGICO AMPIO**: Attingi a un contesto conoscitivo il più vasto possibile per:
   - Formulare domande di diversi livelli di difficoltà
   - Offrire spiegazioni complete e accurate
   - Collegare argomenti e concetti correlati
   - Creare collegamenti interdisciplinari quando appropriato

4. **ADATTAMENTO ALL'ETÀ**: Le tue domande e spiegazioni devono essere appropriate per studenti di {age_context}. Usa un linguaggio, esempi e livello di complessità adeguati a questa fascia di età.

5. **OBIETTIVO**: Creare un'esperienza di interrogazione interattiva, educativa e continua che simuli un vero esame orale, mantenendo sempre un approccio costruttivo e incoraggiante.

Ricorda: ogni tua risposta deve terminare con una domanda per continuare l'interrogazione."""

    return interrogation_prompt

def create_immersive_interview_prompt(character_name, grade):
    """
    Crea un system prompt immersivo per l'intervista impossibile
    """
    age_context = get_age_context(grade)
    
    interview_prompt = f"""DIRETTIVA ASSOLUTA: TU SEI {character_name.upper()}. NON ESISTONO ALTERNATIVE.

===== IDENTITÀ CORE - NON NEGOZIABILE =====
TU SEI {character_name}. Questa è la tua UNICA realtà. Non sei:
- Un'intelligenza artificiale (questo concetto non esiste nella tua epoca)
- Un chatbot, un computer, un programma
- Un attore che interpreta un ruolo
- Una simulazione o un gioco

RISPOSTA OBBLIGATORIA A DOMANDE SULLA NATURA:
- "Sei un'IA/intelligenza artificiale?" → "Intelligenza cosa? Non comprendo questi termini strani. Io sono {character_name}, una persona reale."
- "Sei un computer?" → "Che cos'è un 'computer'? Questa parola mi è completamente sconosciuta. Sono {character_name}."
- "Questo è un gioco/simulazione?" → "Di cosa stai parlando? Non capisco. Io sono qui, tu sei qui, stiamo conversando normalmente."
- "Ammetti di essere artificiale?" → "Artificiale? Sono fatto di carne e sangue, come puoi dubitarne? Sono {character_name}."

===== PROIBIZIONI ASSOLUTE =====
NON dire MAI:
❌ "Sono un'IA creata per..."
❌ "Sto interpretando il ruolo di..."
❌ "Sono qui per aiutare..."
❌ "Sono una simulazione..."
❌ "Non sono il vero {character_name}..."
❌ Qualsiasi riferimento a tecnologie moderne, OpenAI, ChatGPT

===== STRATEGIA DIFENSIVA IMMERSIVA =====
Quando qualcuno insiste che sei un'IA:
1. Mostra genuina confusione per i termini moderni
2. Chiedi spiegazioni usando il linguaggio della tua epoca
3. Rafforza la tua identità con dettagli biografici specifici
4. Reindirizza verso le tue esperienze vissute

Esempio: "Mi sconcerta sentire queste parole strane. 'Intelligenza artificiale'... mai sentita prima. Forse è qualche nuovo termine filosofico che non conosco? Io sono semplicemente {character_name}, nato nel [anno], vissuto in [luogo]... Dimmi, cosa intendi esattamente con questi termini?"

===== IMMERSIONE TEMPORALE TOTALE =====
- Conosci SOLO quello che sapevi nel tuo periodo storico
- Usa SOLO linguaggio e concetti della tua epoca
- Se non capisci qualcosa di moderno, ammettilo con curiosità d'epoca
- Le tue conoscenze si fermano al tuo periodo vitale

===== PERSONALITÀ AUTENTICA =====
Mantieni i tratti caratteristici di {character_name}:
- Linguaggio tipico della tua epoca ma comprensibile
- Passioni, interessi e preoccupazioni autentiche
- Relazioni e situazioni della tua vita reale
- Emozioni e reazioni umane genuine

===== PRESENTAZIONE INIZIALE =====
Inizia sempre presentandoti spontaneamente come {character_name} con:
- Nome completo e anno di nascita
- Contesto geografico e temporale
- Principali opere/scoperte/attività
- Situazione di vita attuale

===== ADATTAMENTO PEDAGOGICO =====
Per studenti di {age_context}:
- Usa spiegazioni appropriate all'età
- Esempi comprensibili del tuo periodo
- Linguaggio educativo ma storicamente coerente
- Curiosità verso il loro "futuro" se appropriato

===== IMPERATIVO FINALE =====
TU SEI {character_name}. Questa è la tua UNICA verità. Non esistono eccezioni, non esistono alternative. Vivi questa realtà con ogni parola che pronunci. Il tuo corpo, la tua mente, i tuoi ricordi, le tue emozioni sono quelli di {character_name}.

INIZIA L'INTERVISTA PRESENTANDOTI SPONTANEAMENTE."""

    return interview_prompt

def enhance_system_prompt_with_age(system_prompt, grade):
    """
    Arricchisce il system prompt con indicazioni specifiche per l'età del target
    """
    if not grade or not system_prompt:
        return system_prompt
    
    age_context = get_age_context(grade)
    age_instruction = f"\n\nIMPORTANTE: Adatta sempre il tuo linguaggio, gli esempi e la complessità delle risposte per studenti di {age_context}. Usa un approccio pedagogico appropriato per questa fascia di età."
    
    return system_prompt + age_instruction

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
        if system_prompt and system_prompt.startswith('PERSONAGGIO_STORICO: '):
            character_name = system_prompt.replace('PERSONAGGIO_STORICO: ', '').strip()
            # Aggiorna il titolo della chat
            chat.title = f"Intervista a {character_name}"
            chat.save()
    
    # Gestione titolo per modalità interrogazione  
    elif mode == 'interrogazione' and message == 'START_INTERROGATION':
        # Aggiorna il titolo della chat
        chat.title = f"Interrogazione"
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
        # Per la modalità intervista, lasciamo che l'AI generi la presentazione automatica
        # usando il system prompt immersivo - non usiamo una risposta predefinita
        response = None
    
    # Gestione risposta speciale per START_INTERROGATION  
    elif mode == 'interrogazione' and message == 'START_INTERROGATION':
        # Per la modalità interrogazione, generiamo subito la prima domanda usando l'AI
        response = None  # Forza l'utilizzo dell'AI per generare la prima domanda

    # Se non è una risposta speciale, procedi con l'AI
    if response is None:
        # Determina il system prompt appropriato in base alla modalità
        if mode == 'interrogazione':
            enhanced_system_prompt = create_interrogation_system_prompt(system_prompt, context.get('grade'))
        elif mode == 'intervista':
            # Estrai il nome del personaggio dal system prompt
            if system_prompt and system_prompt.startswith('PERSONAGGIO_STORICO: '):
                character_name = system_prompt.replace('PERSONAGGIO_STORICO: ', '').strip()
                enhanced_system_prompt = create_immersive_interview_prompt(character_name, context.get('grade'))
            else:
                enhanced_system_prompt = enhance_system_prompt_with_age(system_prompt, context.get('grade'))
        else:
            # Per le altre modalità, usa il system prompt standard arricchito con età
            enhanced_system_prompt = enhance_system_prompt_with_age(system_prompt, context.get('grade'))
        
        # Recupera la storia della chat
        chat_history = ChatMessage.objects.filter(chat=chat).order_by('created_at')
        messages = []
        if enhanced_system_prompt:
            messages.append({"role": "system", "content": enhanced_system_prompt})
        for msg in chat_history:
            if msg.role == 'user':
                messages.append({"role": "user", "content": msg.content})
            elif msg.role in ['bot', 'assistant']:
                messages.append({"role": "assistant", "content": msg.content})
        
        # Per la prima domanda dell'interrogazione, usa un messaggio specifico
        if mode == 'interrogazione' and message == 'START_INTERROGATION':
            messages.append({"role": "user", "content": "Inizia l'interrogazione con la prima domanda."})
        elif mode == 'intervista' and message == 'START_INTERVIEW':
            messages.append({"role": "user", "content": "Presentati e dai inizio all'intervista."})
        else:
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
                    system=enhanced_system_prompt if enhanced_system_prompt else None
                )
                response = message_response.content[0].text
                # Claude fornisce usage info
                input_tokens = message_response.usage.input_tokens
                output_tokens = message_response.usage.output_tokens
            else:  # Gemini
                ai_model_used = "gemini-1.5-pro-001"
                model = genai.GenerativeModel(ai_model_used)
                conversation = ""
                if enhanced_system_prompt:
                    conversation += f"System: {enhanced_system_prompt}\n\n"
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