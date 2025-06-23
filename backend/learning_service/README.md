# 🎓 Learning Service

Microservizio per la generazione automatica di lezioni personalizzate, quiz interattivi e approfondimenti tramite intelligenza artificiale.

## 🚀 Funzionalità

- **Generazione Lezioni AI**: Crea lezioni personalizzate su qualsiasi argomento
- **Quiz Interattivi**: Quiz automatici a risposta multipla con valutazione
- **Approfondimenti**: Contenuti aggiuntivi base e dettagliati
- **Tracciamento Progresso**: Monitoraggio dell'apprendimento utente
- **API REST Completa**: Integrazione facile con frontend React

## 🏗️ Architettura

```
learning_service/
├── service_config/          # Configurazione Django
│   ├── settings.py         # Impostazioni progetto
│   ├── urls.py            # URL routing principale
│   └── wsgi.py            # WSGI application
├── learning_api/           # App principale
│   ├── models.py          # Modelli database
│   ├── views.py           # ViewSets API
│   ├── serializers.py     # Serializzatori DRF
│   ├── permissions.py     # Permessi custom
│   ├── admin.py           # Admin interface
│   └── config/            # Configurazioni
│       └── openai_client.py  # Client OpenAI
├── requirements.txt        # Dipendenze Python
├── Dockerfile             # Container configuration
├── entrypoint.sh          # Script avvio container
└── start_learning_service.sh  # Script sviluppo locale
```

## 📋 Modelli Database

### Lesson
- `user_id`: ID utente proprietario
- `title`: Titolo lezione
- `content`: Contenuto completo
- `status`: Stato (in_progress/completed)
- `lesson_length`: Lunghezza stimata

### Quiz
- `lesson`: Foreign key a Lesson
- `questions`: JSON con domande e risposte
- `total_questions`: Numero totale domande

### QuizAnswer
- `quiz`: Foreign key al Quiz
- `user_id`: ID utente
- `answers`: JSON con risposte utente
- `score`: Punteggio ottenuto
- `completed`: Booleano completamento

### Approfondimento
- `lesson`: Foreign key a Lesson
- `title`: Titolo approfondimento
- `base_content`: Contenuto base
- `detailed_content`: Contenuto dettagliato

### UserProgress
- `user_id`: ID utente
- `lessons_completed`: Numero lezioni completate
- `total_score`: Punteggio totale
- `avg_score`: Media punteggi

## 🔧 Installazione e Setup

### 1. Locale (Sviluppo)

```bash
# Naviga nella directory del servizio
cd backend/learning_service

# Installa dipendenze
pip install -r requirements.txt

# Configura variabili ambiente
cp .env.example .env
# Modifica .env con le tue configurazioni

# Avvia il servizio
./start_learning_service.sh
```

### 2. Docker (Produzione)

```bash
# Dalla root del progetto
docker-compose up learning_service
```

## 🌐 API Endpoints

### Lezioni
- `GET /api/learning-service/lessons/` - Lista lezioni
- `POST /api/learning-service/lessons/generate/` - Genera nuova lezione
- `GET /api/learning-service/lessons/{id}/` - Dettaglio lezione
- `GET /api/learning-service/lessons/{id}/with_related/` - Lezione con quiz/approfondimenti
- `DELETE /api/learning-service/lessons/{id}/` - Elimina lezione

### Quiz
- `POST /api/learning-service/lessons/{id}/generate_quiz/` - Genera quiz per lezione
- `POST /api/learning-service/quiz-answers/submit_answer/` - Invia risposta quiz

### Approfondimenti
- `POST /api/learning-service/lessons/{id}/generate_approfondimenti/` - Genera approfondimenti
- `POST /api/learning-service/approfondimenti/{id}/generate_detailed/` - Genera versione dettagliata

### Progresso
- `GET /api/learning-service/progress/my_progress/` - Progresso utente
- `GET /api/learning-service/progress/stats/` - Statistiche utente

## 🔑 Autenticazione

Il servizio utilizza JWT tokens per l'autenticazione:

```javascript
// Header richieste
Authorization: Bearer <jwt_token>
```

## 🤖 Integrazione OpenAI

Il servizio utilizza OpenAI GPT per:
- Generare contenuti lezioni personalizzati
- Creare quiz con domande multiple choice
- Sviluppare approfondimenti tematici

### Configurazione OpenAI

#### Docker (Produzione)
Il servizio utilizza il sistema di secrets di Docker:
```bash
# La chiave viene letta da /run/secrets/openai_api_key_secret
# File: .secrets/openai_api_key.txt (nella root del progetto)
```

#### Sviluppo Locale
```bash
# Nel file .env o variabile d'ambiente
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo  # o gpt-4
OPENAI_MAX_TOKENS=2000
```

Il sistema cerca la chiave in questo ordine:
1. File secret: `/run/secrets/openai_api_key_secret` (Docker)
2. Variabile d'ambiente: `OPENAI_API_KEY` (locale)

## 📊 Database

### PostgreSQL
- **Host**: learning_db (container) / localhost (locale)
- **Port**: 5439
- **Database**: learning_db
- **User**: learning_user

### Schema Migrations

```bash
# Crea nuove migrazioni
python manage.py makemigrations

# Applica migrazioni
python manage.py migrate

# Reset database (⚠️ ATTENZIONE: cancella tutti i dati)
python manage.py flush
```

## 🧪 Testing

```bash
# Esegui tutti i test
python manage.py test

# Test con coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Report HTML in htmlcov/
```

## 📈 Monitoring e Logging

### Logs Location
- **Sviluppo**: Console output
- **Produzione**: `/app/logs/learning_service.log`

### Health Check
```bash
curl http://localhost:8007/api/learning-service/health/
```

## 🚀 Deploy

### Variabili Ambiente Produzione
```bash
DEBUG=false
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:pass@host:port/dbname
OPENAI_API_KEY=your_production_key
SECRET_KEY=your_django_secret_key
```

### Docker Compose
```yaml
learning_service:
  build: ./backend/learning_service
  ports:
    - "8007:8000"
  environment:
    - DEBUG=false
    - DATABASE_URL=postgresql://...
  depends_on:
    - learning_db
```

## 🔧 Troubleshooting

### Problemi Comuni

1. **Database Connection Error**
   ```bash
   # Verifica che il database sia in esecuzione
   docker-compose ps
   
   # Controlla logs del database
   docker-compose logs learning_db
   ```

2. **OpenAI API Error**
   ```bash
   # Verifica API key
   echo $OPENAI_API_KEY
   
   # Test connessione OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

3. **Migration Issues**
   ```bash
   # Reset migrazioni (⚠️ perdita dati)
   python manage.py migrate learning_api zero
   python manage.py migrate
   ```

## 📝 Contribuire

1. Fork del repository
2. Crea branch feature: `git checkout -b feature/AmazingFeature`
3. Commit modifiche: `git commit -m 'Add AmazingFeature'`
4. Push branch: `git push origin feature/AmazingFeature`
5. Apri Pull Request

## 📄 License

Questo progetto è proprietà di **Fondazione Golinelli** e **G-lab srl Impresa Sociale** - tutti i diritti riservati.

## 👥 Team

- **Fondazione Golinelli** - Ideazione e requirements
- **G-lab srl** - Sviluppo e implementazione
- **PL-AI Team** - Architettura microservizi

---

## 🎯 Quick Start

### Docker (Raccomandato)
```bash
# 1. Assicurati che il file .secrets/openai_api_key.txt contenga la tua chiave API
# 2. Dalla root del progetto:
docker-compose up learning_service learning_db

# 3. Il servizio sarà disponibile su http://localhost:8007
```

### Sviluppo Locale
```bash
# 1. Naviga nel learning service
cd backend/learning_service

# 2. Setup ambiente Python
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o venv\Scripts\activate  # Windows

# 3. Installa dipendenze
pip install -r requirements.txt

# 4. Configura OpenAI API Key
export OPENAI_API_KEY=sk-your-openai-api-key-here

# 5. Avvia il servizio (con controlli automatici)
./start_learning_service.sh

# 6. Testa la configurazione OpenAI
python test_openai_config.py

# 7. Testa l'API
curl http://localhost:8007/api/learning-service/lessons/
```

### Verifica Configurazione
```bash
# Test configurazione OpenAI
cd backend/learning_service
python test_openai_config.py

# Questo script verificherà:
# ✅ Lettura secrets o variabili d'ambiente
# ✅ Inizializzazione client OpenAI
# ✅ Test generazione lezione base
```

Il servizio sarà disponibile su `http://localhost:8007` 🚀

**📝 Nota**: Il sistema cerca la chiave OpenAI in questo ordine:
1. File secret `/run/secrets/openai_api_key_secret` (Docker)
2. Variabile d'ambiente `OPENAI_API_KEY` (locale) 