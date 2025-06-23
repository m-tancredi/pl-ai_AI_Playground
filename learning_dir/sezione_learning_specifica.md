# Specifica Microservizio - Sezione Learning

## Panoramica

La sezione Learning è un modulo dedicato alla generazione automatica di mini-lezioni educative e quiz interattivi utilizzando l'intelligenza artificiale. Il sistema permette agli utenti di creare contenuti didattici personalizzati a partire da un argomento di interesse.

## Architettura

### Structure Directory
```
routes/
├── learning.py          # Blueprint principale con tutte le route
├── db.py               # Gestione database e autenticazione
└── openai_client.py    # Client per API OpenAI

templates/
└── learning.html       # Template HTML principale

static/
├── css/
│   └── output.css      # Stili CSS (Tailwind)
└── js/
    └── [learning logic embedded in HTML]
```

### Blueprint Flask
- **Nome Blueprint**: `learning`
- **Prefisso URL**: `/learning`
- **Dipendenze**: OpenAI API, SQLite, Flask-Session

## Database Schema

### Tabella `topics`
```sql
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                    -- Titolo della lezione
    content TEXT,                          -- Contenuto della mini-lezione
    created_at TEXT,                       -- Data di creazione
    status TEXT,                           -- Stato (completed, in_progress)
    quiz TEXT                              -- Quiz in formato JSON
)
```

### Tabella `learning_units` (alternativa/legacy)
```sql
CREATE TABLE IF NOT EXISTS learning_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    quiz TEXT,                             -- Quiz in formato JSON
    answers TEXT DEFAULT '{}',             -- Risposte dell'utente
    total_questions INTEGER DEFAULT 0,     -- Numero totale domande
    correct_answers INTEGER DEFAULT 0,     -- Numero risposte corrette
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## API Endpoints

### 1. Pagina Principale
- **Route**: `GET /learning`
- **Autenticazione**: Richiesta (@login_required)
- **Descrizione**: Serve la pagina principale dell'interfaccia learning
- **Risposta**: Template HTML `learning.html`

### 2. Generazione Lezione
- **Route**: `POST /generate_lesson`
- **Autenticazione**: Richiesta
- **Parametri**:
  ```json
  {
    "topic": "string"  // Argomento della lezione (obbligatorio)
  }
  ```
- **Processo**:
  1. Genera mini-lezione (max 15 righe) tramite OpenAI GPT-3.5-turbo
  2. Crea 5 domande quiz a risposta multipla basate sulla lezione
  3. Salva nel database utente
- **Risposta**:
  ```json
  {
    "success": true,
    "lesson": {
      "id": "integer",
      "title": "string",
      "content": "string"
    },
    "quiz": [
      {
        "question": "string",
        "options": ["string", "string", "string", "string"],
        "correct_index": "integer"
      }
    ]
  }
  ```

### 3. Lista Lezioni
- **Route**: `GET /lessons`
- **Autenticazione**: Richiesta
- **Descrizione**: Recupera tutte le lezioni salvate dell'utente
- **Risposta**:
  ```json
  {
    "lessons": [
      {
        "id": "integer",
        "title": "string",
        "status": "done|in_progress"
      }
    ]
  }
  ```

### 4. Dettaglio Lezione
- **Route**: `GET /lesson/<lesson_id>`
- **Autenticazione**: Richiesta
- **Parametri**: `lesson_id` (integer) nell'URL
- **Risposta**:
  ```json
  {
    "lesson": {
      "id": "integer",
      "title": "string",
      "content": "string"
    },
    "quiz": [/* array domande quiz */]
  }
  ```

### 5. Generazione Approfondimenti
- **Route**: `POST /generate_approfondimenti`
- **Autenticazione**: Richiesta
- **Parametri**:
  ```json
  {
    "title": "string",
    "content": "string"
  }
  ```
- **Descrizione**: Genera 3-4 approfondimenti correlati alla lezione
- **Risposta**:
  ```json
  {
    "success": true,
    "approfondimenti": [
      {
        "title": "string",
        "content": "string"
      }
    ]
  }
  ```

### 6. Approfondimento Dettagliato
- **Route**: `POST /generate_detailed_approfondimento`
- **Autenticazione**: Richiesta
- **Parametri**:
  ```json
  {
    "title": "string",
    "lesson_title": "string",
    "lesson_content": "string"
  }
  ```
- **Descrizione**: Genera un approfondimento dettagliato (300-400 parole) in HTML
- **Risposta**:
  ```json
  {
    "success": true,
    "title": "string",
    "content": "string"  // HTML formattato
  }
  ```

### 7. Invio Risposta Quiz
- **Route**: `POST /submit_answer`
- **Autenticazione**: Richiesta
- **Parametri**:
  ```json
  {
    "topic_id": "integer",
    "question_index": "integer",
    "answer_index": "integer"
  }
  ```
- **Descrizione**: Registra la risposta dell'utente e aggiorna statistiche

### 8. Gestione Lezioni
- **Eliminazione singola**: `DELETE /delete_lesson/<lesson_id>`
- **Eliminazione tutte**: `DELETE /delete_all_lessons`
- **Reset database**: `POST /reset_db`
- **Riparazione database**: `POST /repair_db`

## Interfaccia Utente

### Layout Principale
La pagina è divisa in due sezioni principali:

#### Sidebar (Sinistra)
- **Titolo**: "Lezioni salvate"
- **Lista lezioni**: Con indicatori di stato (verde=completata, arancione=in corso)
- **Bottone eliminazione**: Per ogni lezione e per tutte le lezioni
- **Template dinamico**: Per aggiungere nuove lezioni via JavaScript

#### Main Content (Destra)
- **Input argomento**: Campo di testo per inserire il topic
- **Bottone genera**: Con spinner di caricamento
- **Sezione lezione**: Con tab per "Lezione" e "Quiz"
- **Area approfondimenti**: Bottoni dinamici per approfondimenti correlati

### Interazioni JavaScript
- Caricamento dinamico lista lezioni
- Gestione tab Lezione/Quiz
- Generazione e visualizzazione approfondimenti
- Eliminazione lezioni con conferma
- Gestione stato di caricamento

## Integrazione OpenAI

### Prompts Utilizzati

#### Generazione Lezione
```
"Scrivi una mini-lezione (max 15 righe) sull'argomento: {topic}. Usa un linguaggio chiaro e didattico."
```

#### Generazione Quiz
```
"Crea 5 domande a risposta multipla (con 4 opzioni ciascuna) basate SOLO sulla seguente mini-lezione. Le domande devono essere specifiche e non generiche. Indica la risposta corretta per ciascuna domanda. Restituisci un JSON con una lista di oggetti: question, options (array), correct_index (int). Lezione:\n{lesson_content}"
```

#### Generazione Approfondimenti
```
"Basandoti sulla seguente lezione dal titolo '{title}', genera 3-4 possibili approfondimenti correlati. Ogni approfondimento deve avere un titolo breve (massimo 5-6 parole) e una breve descrizione (2-3 frasi)..."
```

### Modello Utilizzato
- **Modello**: gpt-3.5-turbo
- **Parsing JSON**: Regex per estrarre JSON dalle risposte
- **Gestione errori**: Try-catch con messaggi di errore user-friendly

## Autenticazione e Sicurezza

### Sistema di Autenticazione
- **Decoratore**: `@login_required` su tutte le route
- **Sessione**: Utilizzo di Flask sessions
- **Database separato**: Ogni utente ha il proprio database SQLite

### Gestione Errori
- Try-catch su tutte le operazioni API
- Validazione input lato server
- Logging degli errori con traceback
- Messaggi di errore localizzati in italiano

## Dipendenze Tecniche

### Python Packages
```
flask
openai
json
re
os
markdown
bs4
uuid
datetime
```

### Frontend Technologies
- **CSS Framework**: Tailwind CSS
- **JavaScript**: Vanilla JS (embedded in template)
- **Icons**: Heroicons (SVG)

## Configurazione e Deployment

### Variabili di Ambiente
- OpenAI API Key (configurata in `openai_client.py`)

### Database
- SQLite per persistenza dati utente
- Database separati per ogni utente (`user_databases/`)
- Inizializzazione automatica al primo accesso

### File Structure per Deployment
```
routes/
├── __init__.py
├── learning.py
├── db.py
└── openai_client.py

templates/
└── learning.html

static/
└── css/
    └── output.css
```

## Estensibilità e Personalizzazioni

### Punti di Estensione
1. **Nuovi tipi di contenuto**: Modificare prompts OpenAI
2. **Integrazione modelli diversi**: Sostituire client OpenAI
3. **Esportazione contenuti**: Aggiungere endpoint per PDF/Word
4. **Analisi apprendimento**: Aggiungere metriche e analytics
5. **Condivisione lezioni**: Sistema di condivisione tra utenti

### Configurazioni Personalizzabili
- Lunghezza massima lezioni
- Numero domande quiz
- Stili e temi UI
- Lingue supportate
- Modelli AI utilizzati

## Performance e Ottimizzazioni

### Caching
- Possibilità di cache delle lezioni generate
- Cache delle risposte OpenAI per argomenti comuni

### Database Optimization
- Indici sulle tabelle per query veloci
- Pulizia periodica dati vecchi

### Frontend Optimization
- Lazy loading delle lezioni
- Minimizzazione richieste AJAX
- Ottimizzazione CSS/JS

## Testing e Qualità

### Testing Strategy
- Unit test per funzioni di generazione contenuti
- Integration test per API endpoints
- UI testing per interfaccia utente
- Load testing per performance OpenAI

### Quality Assurance
- Validazione contenuti generati
- Controllo qualità domande quiz
- Verifica accuratezza approfondimenti 