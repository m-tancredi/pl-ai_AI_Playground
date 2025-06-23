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
    
    def generate_lesson(self, topic, max_lines=None):
        """
        Genera una mini-lezione su un argomento specifico.
        
        Args:
            topic (str): Argomento della lezione
            max_lines (int): Numero massimo di righe (default da settings)
        
        Returns:
            str: Contenuto della lezione
        """
        if max_lines is None:
            max_lines = settings.DEFAULT_LESSON_LENGTH
        
        prompt = f"Scrivi una mini-lezione (max {max_lines} righe) sull'argomento: {topic}. Usa un linguaggio chiaro e didattico."
        
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
    
    def generate_quiz(self, lesson_content, lesson_title="", approfondimenti=None, num_questions=None):
        """
        Genera domande quiz basate sul contenuto della lezione.
        
        Args:
            lesson_content (str): Contenuto della lezione
            lesson_title (str): Titolo della lezione
            approfondimenti (list): Lista di approfondimenti
            num_questions (int): Numero di domande (default da settings)
        
        Returns:
            list: Lista di domande in formato standardizzato
        """
        if num_questions is None:
            num_questions = settings.DEFAULT_QUIZ_QUESTIONS
        
        # Prepara il contenuto completo includendo eventuali approfondimenti
        full_content = lesson_content
        if approfondimenti:
            full_content += "\n\nApprofondimenti:\n"
            for app in approfondimenti:
                if isinstance(app, dict) and 'title' in app:
                    app_content = app.get('text_content', app.get('content', ''))
                    # Rimuovi eventuali tag HTML residui
                    app_content = re.sub(r'<[^>]*>', ' ', app_content)
                    full_content += f"\n{app['title']}:\n{app_content}\n"
        
        prompt = f"""Crea {num_questions} domande a risposta multipla (con 4 opzioni ciascuna) basate sulla seguente mini-lezione e sui suoi approfondimenti. 
        Le domande devono essere specifiche e non generiche. 
        
        IMPORTANTE: Varia la posizione della risposta corretta! Non mettere sempre la risposta corretta come prima opzione. 
        Distribuisci le risposte corrette in posizioni diverse (indici 0, 1, 2, 3) per ogni domanda.
        
        Restituisci un JSON con una lista di oggetti con questa struttura: 
        [{{
            "question": "Testo della domanda",
            "options": ["Opzione 1", "Opzione 2", "Opzione 3", "Opzione 4"],
            "correct_index": 0
        }}]
        
        Ricorda: correct_index può essere 0, 1, 2 o 3 - varia la posizione della risposta corretta!
        
        Lezione{f' - {lesson_title}' if lesson_title else ''}:
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
    
    def generate_approfondimenti(self, lesson_title, lesson_content, max_items=None):
        """
        Genera approfondimenti correlati alla lezione.
        
        Args:
            lesson_title (str): Titolo della lezione
            lesson_content (str): Contenuto della lezione
            max_items (int): Numero massimo di approfondimenti
        
        Returns:
            list: Lista di approfondimenti
        """
        if max_items is None:
            max_items = settings.MAX_LESSON_APPROFONDIMENTI
        
        prompt = f"""Basandoti sulla seguente lezione dal titolo '{lesson_title}', genera {max_items} possibili approfondimenti correlati.
        Ogni approfondimento deve avere un titolo breve (massimo 5-6 parole) e una breve descrizione (2-3 frasi).
        Gli approfondimenti devono essere correlati al tema principale ma esplorare aspetti diversi o complementari.
        
        Lezione:
        {lesson_content}
        
        Restituisci il risultato in formato JSON con la seguente struttura:
        [{{
            "title": "Titolo approfondimento",
            "content": "Contenuto dell'approfondimento"
        }}]
        """
        
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