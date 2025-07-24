import openai
import os
from django.conf import settings
import json
import re
import logging

logger = logging.getLogger(__name__)

def read_secret(path):
    """
    Legge un secret da file, con fallback a variabile d'ambiente
    """
    try:
        if path and os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
    except Exception as e:
        logger.warning(f"Impossibile leggere secret da {path}: {e}")
    return None

class OpenAIClient:
    """Client per le chiamate OpenAI del Learning Service."""
    
    def __init__(self):
        # Leggi la chiave API da secrets o fallback a variabile d'ambiente
        api_key = read_secret(os.environ.get('OPENAI_API_KEY_FILE', '')) or os.environ.get('OPENAI_API_KEY')
        
        if not api_key:
            logger.error("OPENAI_API_KEY non trovata né in secrets né in variabili d'ambiente")
            raise ValueError("OPENAI_API_KEY è richiesta per il Learning Service")
        
        # Non impostare openai.api_key - usa solo il client moderno
        self.client = openai.OpenAI(api_key=api_key)
        logger.info("OpenAI client inizializzato con successo")
    
    def generate_lesson(self, topic, max_lines=None, depth_level=3):
        """
        Genera una mini-lezione su un argomento specifico.
        
        Args:
            topic (str): Argomento della lezione
            max_lines (int): Numero massimo di righe (default da settings)
            depth_level (int): Livello di approfondimento (1-5)
        
        Returns:
            str: Contenuto della lezione
        """
        if max_lines is None:
            max_lines = settings.DEFAULT_LESSON_LENGTH
        
        # Definisce il livello di approfondimento con condizionamento molto più forte
        depth_specifications = {
            1: {
                "description": "🟢 LIVELLO BASE - Panoramica introduttiva per principianti assoluti",
                "language": "Linguaggio elementare, parole comuni, frasi brevi e dirette",
                "concepts": "Solo concetti fondamentali e essenziali, evita terminologia tecnica",
                "examples": "Esempi della vita quotidiana, molto concreti e familiari",
                "structure": "Massimo 3-4 concetti principali, presentazione lineare e semplice",
                "depth": "Definizioni base, 'cosa è' senza entrare nel 'come' o 'perché' complesso"
            },
            2: {
                "description": "🟡 LIVELLO ELEMENTARE - Introduzione con prime spiegazioni",
                "language": "Linguaggio semplice ma più articolato, prime definizioni tecniche spiegate",
                "concepts": "Concetti base + prime relazioni causa-effetto semplici",
                "examples": "Esempi concreti con brevi spiegazioni del 'perché'",
                "structure": "4-5 punti principali con collegamenti logici chiari",
                "depth": "Definizioni + funzioni base + prime relazioni semplici"
            },
            3: {
                "description": "🟨 LIVELLO INTERMEDIO - Spiegazione equilibrata e completa",
                "language": "Linguaggio standard con terminologia appropriata ben spiegata",
                "concepts": "Concetti principali + relazioni + prime applicazioni pratiche",
                "examples": "Mix di esempi concreti e teorici con spiegazioni articolate",
                "structure": "5-6 aspetti principali con sottopunti e collegamenti",
                "depth": "Meccanismi, processi, relazioni causali, applicazioni pratiche"
            },
            4: {
                "description": "🟠 LIVELLO AVANZATO - Analisi approfondita con aspetti tecnici",
                "language": "Linguaggio tecnico-scientifico, terminologia specializzata spiegata in contesto",
                "concepts": "Concetti complessi + variabili + casi particolari + eccezioni",
                "examples": "Esempi specialistici, casi studio, situazioni complesse",
                "structure": "Analisi multi-dimensionale con interrelazioni e sfumature",
                "depth": "Dettagli tecnici, varianti, implicazioni, aspetti critici"
            },
            5: {
                "description": "🔴 LIVELLO SPECIALISTICO - Trattazione esaustiva per esperti",
                "language": "Linguaggio altamente tecnico, terminologia avanzata, precisione scientifica",
                "concepts": "Tutti gli aspetti + dibattiti + frontiere della ricerca + controversie",
                "examples": "Casi limite, ricerca recente, applicazioni innovative, problemi aperti",
                "structure": "Analisi sistematica completa con tutti i fattori e le interconnessioni",
                "depth": "Massima profondità: meccanismi molecolari/matematici, teorie avanzate, frontiere"
            }
        }
        
        spec = depth_specifications.get(depth_level, depth_specifications[3])
        
        prompt = f"""Scrivi una mini-lezione (max {max_lines} righe) sull'argomento: {topic}.

🎯 {spec['description']}

SPECIFICHE RIGOROSE PER QUESTO LIVELLO:

📝 LINGUAGGIO: {spec['language']}
🧠 CONCETTI: {spec['concepts']}
💡 ESEMPI: {spec['examples']}
🏗️ STRUTTURA: {spec['structure']}
🔍 PROFONDITÀ: {spec['depth']}

DIRETTIVE OBBLIGATORIE:
- RISPETTA RIGOROSAMENTE il livello richiesto - non andare oltre né rimanere sotto
- Se livello 1-2: usa solo parole comuni, evita assolutamente terminologia tecnica
- Se livello 4-5: usa terminologia precisa e approfondimenti tecnici/scientifici
- Calibra la complessità degli esempi ESATTAMENTE al livello richiesto
- Mantieni coerenza nel registro linguistico per tutta la lezione

Argomento: {topic}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content.strip()
            logger.info(f"Lezione generata per argomento: {topic}")
            return content
            
        except Exception as e:
            logger.error(f"Errore nella generazione della lezione: {str(e)}")
            raise Exception(f"Errore nella generazione della lezione: {str(e)}")
    
    def generate_quiz(self, lesson_content, lesson_title="", approfondimenti=None, num_questions=None, difficulty_level=3):
        """
        Genera domande quiz basate sul contenuto della lezione.
        
        Args:
            lesson_content (str): Contenuto della lezione
            lesson_title (str): Titolo della lezione
            approfondimenti (list): Lista di approfondimenti
            num_questions (int): Numero di domande (default da settings)
            difficulty_level (int): Livello di difficoltà (1-5)
        
        Returns:
            list: Lista di domande in formato standardizzato
        """
        if num_questions is None:
            num_questions = settings.DEFAULT_QUIZ_QUESTIONS
        
        # Prepara il contenuto completo includendo SEMPRE gli approfondimenti se disponibili
        full_content = lesson_content
        approfondimenti_included = False
        
        if approfondimenti:
            approfondimenti_included = True
            full_content += "\n\n🔍 APPROFONDIMENTI (INCLUSI NEL QUIZ):\n"
            for app in approfondimenti:
                if isinstance(app, dict) and 'title' in app:
                    app_content = app.get('text_content', app.get('content', ''))
                    # Rimuovi eventuali tag HTML residui
                    app_content = re.sub(r'<[^>]*>', ' ', app_content)
                    full_content += f"\n📌 {app['title']}:\n{app_content}\n"
        
        # Definisce il livello di difficoltà con specifiche molto più dettagliate
        difficulty_specifications = {
            1: {
                "description": "🟢 QUIZ FACILE - Comprensione elementare",
                "question_type": "Riconoscimento diretto di definizioni e fatti espliciti",
                "language": "Linguaggio semplice nelle domande, terminologia di base",
                "complexity": "Una sola informazione per domanda, risposta trovabile direttamente nel testo",
                "distractors": "Opzioni errate ovviamente diverse dalla risposta corretta"
            },
            2: {
                "description": "🟡 QUIZ SEMPLICE - Comprensione base con prime connessioni",
                "question_type": "Comprensione diretta + semplici relazioni causa-effetto",
                "language": "Linguaggio chiaro, prime definizioni tecniche se presenti nel testo",
                "complexity": "Domande su singoli concetti + semplici 'perché' o 'come'",
                "distractors": "Opzioni errate plausibili ma distinguibili con attenzione"
            },
            3: {
                "description": "🟨 QUIZ MEDIO - Applicazione e connessioni logiche",
                "question_type": "Applicazione di concetti + relazioni + confronti semplici",
                "language": "Linguaggio standard, terminologia appropriata usata nel testo",
                "complexity": "Collegamento tra concetti diversi, inferenze dirette",
                "distractors": "Opzioni che richiedono comprensione per essere scartate"
            },
            4: {
                "description": "🟠 QUIZ DIFFICILE - Analisi critica e sintesi",
                "question_type": "Analisi di situazioni complesse + valutazioni + implicazioni",
                "language": "Linguaggio tecnico coerente con il livello del contenuto",
                "complexity": "Domande che richiedono sintesi di più parti + ragionamento",
                "distractors": "Opzioni molto sottili, richiedono padronanza completa"
            },
            5: {
                "description": "🔴 QUIZ ESPERTO - Valutazione critica e applicazione avanzata",
                "question_type": "Valutazione critica + applicazione in contesti nuovi + edge cases",
                "language": "Linguaggio altamente preciso e tecnico",
                "complexity": "Domande che testano comprensione profonda + capacità di trasferimento",
                "distractors": "Opzioni estremamente sottili, tutte tecnicamente corrette ma una sola è la migliore"
            }
        }
        
        spec = difficulty_specifications.get(difficulty_level, difficulty_specifications[3])
        
        approfondimenti_instruction = ""
        if approfondimenti_included:
            approfondimenti_instruction = f"""
🔥 IMPORTANTE - APPROFONDIMENTI INCLUSI:
Il contenuto include {len(approfondimenti)} approfondimenti che DEVONO essere testati nel quiz.
- Almeno {min(2, len(approfondimenti))} domande devono riguardare gli approfondimenti
- Bilancia le domande tra lezione base e approfondimenti
- Indica chiaramente quando una domanda proviene da un approfondimento
"""
        
        prompt = f"""Crea {num_questions} domande a risposta multipla (con 4 opzioni ciascuna) basate ESCLUSIVAMENTE sul contenuto fornito.

🎯 {spec['description']}

SPECIFICHE RIGOROSE PER QUESTO LIVELLO:
📝 TIPO DOMANDE: {spec['question_type']}
🧠 LINGUAGGIO: {spec['language']}  
🔍 COMPLESSITÀ: {spec['complexity']}
❌ DISTRATTORI: {spec['distractors']}

{approfondimenti_instruction}

VINCOLI ASSOLUTI:
❗ Le domande devono testare SOLO argomenti esplicitamente trattati nel contenuto
❗ ZERO domande su argomenti non menzionati o accennati superficialmente  
❗ Ogni domanda deve essere verificabile dalla lettura del materiale fornito
❗ RISPETTA il livello di difficoltà: non andare oltre né rimanere sotto

FORMATO E DISTRIBUZIONE:
✅ Varia SEMPRE la posizione della risposta corretta (indici 0,1,2,3)
✅ Non mettere mai tutte le risposte corrette nella stessa posizione
✅ Crea distrattori appropriati al livello di difficoltà richiesto

Restituisci SOLO un JSON valido con questa struttura:
[{{
    "question": "Testo della domanda",
    "options": ["Opzione 1", "Opzione 2", "Opzione 3", "Opzione 4"],
    "correct_index": 0
}}]

CONTENUTO DA TESTARE:
{full_content}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=2000
            )
            
            quiz_content = response.choices[0].message.content
            
            # Estrai e valida il JSON dalle risposte
            quiz_json = re.search(r'\{.*\}|\[.*\]', quiz_content, re.DOTALL)
            if quiz_json:
                questions = json.loads(quiz_json.group())
                
                # Valida il formato delle domande
                validated_questions = []
                for q in questions:
                    if (isinstance(q, dict) and 
                        'question' in q and 
                        'options' in q and 
                        'correct_index' in q and
                        len(q['options']) == 4 and
                        isinstance(q['correct_index'], int) and
                        0 <= q['correct_index'] <= 3):
                        validated_questions.append(q)
                
                if validated_questions:
                    logger.info(f"Quiz generato con {len(validated_questions)} domande")
                    return validated_questions
                else:
                    raise ValueError("Nessuna domanda valida generata")
            else:
                raise ValueError("Formato JSON non valido nella risposta")
                
        except json.JSONDecodeError as e:
            logger.error(f"Errore nel parsing JSON del quiz: {str(e)}")
            raise Exception("Errore nel parsing delle domande del quiz")
        except Exception as e:
            logger.error(f"Errore nella generazione del quiz: {str(e)}")
            raise Exception(f"Errore nella generazione del quiz: {str(e)}")
    
    def generate_approfondimenti(self, lesson_title, lesson_content, max_items=None, depth_level=3, existing_approfondimenti=None):
        """
        Genera approfondimenti correlati alla lezione.
        
        Args:
            lesson_title (str): Titolo della lezione
            lesson_content (str): Contenuto della lezione
            max_items (int): Numero massimo di approfondimenti
            depth_level (int): Livello di dettaglio (eredita dalla lezione)
            existing_approfondimenti (list): Lista approfondimenti esistenti per anti-duplicazione
        
        Returns:
            list: Lista di approfondimenti
        """
        if max_items is None:
            max_items = settings.MAX_LESSON_APPROFONDIMENTI
        
        if existing_approfondimenti is None:
            existing_approfondimenti = []
        
        # Sistema anti-duplicazione
        existing_titles = [app.get('title', '') for app in existing_approfondimenti]
        anti_duplication_instruction = ""
        if existing_titles:
            anti_duplication_instruction = f"""
ATTENZIONE - EVITA DUPLICAZIONI:
I seguenti approfondimenti esistono già, NON ricrearli:
{chr(10).join(f'- {title}' for title in existing_titles)}

Genera approfondimenti COMPLETAMENTE DIVERSI e UNICI.
"""
        
        # Definisce il livello di dettaglio con specifiche molto più rigorose (eredita dalle lezioni)
        depth_specifications = {
            1: {
                "description": "🟢 APPROFONDIMENTI BASE - Accessibili a principianti assoluti",
                "language": "Linguaggio elementare, parole comuni, spiegazioni molto semplici",
                "content_type": "Curiosità interessanti, esempi quotidiani, fatti divertenti",
                "complexity": "Informazioni aggiuntive semplici, senza tecnicismi",
                "length": "2-3 paragrafi brevi, concetti singoli e chiari"
            },
            2: {
                "description": "🟡 APPROFONDIMENTI ELEMENTARI - Prime espansioni dei concetti",
                "language": "Linguaggio semplice ma più ricco, prime definizioni specifiche",
                "content_type": "Dettagli interessanti, confronti semplici, prime spiegazioni del 'perché'",
                "complexity": "Approfondimenti diretti con collegamenti logici evidenti",
                "length": "3-4 paragrafi, un concetto principale per approfondimento"
            },
            3: {
                "description": "🟨 APPROFONDIMENTI INTERMEDI - Espansione equilibrata e informativa",
                "language": "Linguaggio standard con terminologia appropriata ben contestualizzata",
                "content_type": "Analisi più dettagliate, applicazioni pratiche, esempi articolati",
                "complexity": "Aspetti complementari con relazioni e implicazioni",
                "length": "4-5 paragrafi strutturati, multiple sfaccettature del tema"
            },
            4: {
                "description": "🟠 APPROFONDIMENTI AVANZATI - Analisi specialistiche e tecniche",
                "language": "Linguaggio tecnico-scientifico, terminologia specializzata precisa",
                "content_type": "Dettagli tecnici, casi studio, meccanismi specifici, varianti complesse",
                "complexity": "Aspetti avanzati, eccezioni, considerazioni critiche",
                "length": "5-6 paragrafi densi, analisi multi-dimensionale"
            },
            5: {
                "description": "🔴 APPROFONDIMENTI SPECIALISTICI - Livello esperto e ricerca",
                "language": "Linguaggio altamente tecnico, precisione scientifica massima",
                "content_type": "Frontiere della ricerca, dibattiti accademici, teorie avanzate",
                "complexity": "Tutti gli aspetti critici, controversie, sviluppi recenti",
                "length": "6+ paragrafi molto dettagliati, trattazione sistematica completa"
            }
        }
        
        spec = depth_specifications.get(depth_level, depth_specifications[3])
        
        prompt = f"""Basandoti sulla lezione '{lesson_title}', genera {max_items} approfondimenti che RISPETTINO RIGOROSAMENTE il livello richiesto.

🎯 {spec['description']}

SPECIFICHE OBBLIGATORIE PER QUESTO LIVELLO:
📝 LINGUAGGIO: {spec['language']}
📚 TIPO CONTENUTO: {spec['content_type']}
🔍 COMPLESSITÀ: {spec['complexity']}
📏 LUNGHEZZA: {spec['length']}

DIRETTIVE ASSOLUTE:
- RISPETTA RIGOROSAMENTE il livello di dettaglio richiesto
- Se livello 1-2: evita assolutamente terminologia tecnica complessa
- Se livello 4-5: usa terminologia precisa e approfondimenti scientifici/tecnici
- Titoli: massimo 5-6 parole, chiari e pertinenti al livello
- Mantieni PERFETTA coerenza con il registro linguistico della lezione

{anti_duplication_instruction}

CONTENUTO BASE:
{lesson_content}

Restituisci SOLO un JSON valido:
[{{
    "title": "Titolo approfondimento",
    "content": "Contenuto dell'approfondimento"
}}]"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1500
            )
            
            # Estrai il JSON dalla risposta
            json_match = re.search(r'\[\s*\{.*\}\s*\]', response.choices[0].message.content, re.DOTALL)
            if json_match:
                approfondimenti = json.loads(json_match.group())
                logger.info(f"Generati {len(approfondimenti)} approfondimenti per {lesson_title}")
                return approfondimenti
            else:
                raise ValueError("Formato JSON non valido nella risposta")
                
        except json.JSONDecodeError as e:
            logger.error(f"Errore nel parsing JSON degli approfondimenti: {str(e)}")
            raise Exception("Errore nel parsing degli approfondimenti")
        except Exception as e:
            logger.error(f"Errore nella generazione degli approfondimenti: {str(e)}")
            raise Exception(f"Errore nella generazione degli approfondimenti: {str(e)}")
    
    def generate_detailed_approfondimento(self, title, lesson_title, lesson_content):
        """
        Genera un approfondimento dettagliato in HTML.
        
        Args:
            title (str): Titolo dell'approfondimento
            lesson_title (str): Titolo della lezione originale
            lesson_content (str): Contenuto della lezione originale
        
        Returns:
            str: Contenuto HTML dell'approfondimento dettagliato
        """
        prompt = f"""Basandoti sulla seguente lezione dal titolo '{lesson_title}', genera un approfondimento dettagliato sul tema specifico '{title}'.
        L'approfondimento deve essere completo, informativo e ben strutturato, con una lunghezza di almeno 300-400 parole.
        Includi informazioni rilevanti, esempi, e dettagli che espandono la comprensione dell'argomento.
        
        Lezione originale:
        {lesson_content}
        
        Titolo dell'approfondimento: {title}
        
        Fornisci un approfondimento completo e ben strutturato in formato HTML con paragrafi (<p>), titoli (<h3>, <h4>) e liste (<ul>, <li>) dove appropriato.
        """
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=2000
            )
            
            detailed_content = response.choices[0].message.content
            logger.info(f"Approfondimento dettagliato generato per: {title}")
            return detailed_content
            
        except Exception as e:
            logger.error(f"Errore nella generazione dell'approfondimento dettagliato: {str(e)}")
            raise Exception(f"Errore nella generazione dell'approfondimento dettagliato: {str(e)}")


# Istanza globale del client
openai_client = OpenAIClient() 