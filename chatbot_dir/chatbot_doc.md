# Specifica Tecnica: Microservizio Chatbot AI (Django + DRF)

## **Obiettivo**
Realizzare un microservizio RESTful in Django + Django REST Framework che replichi fedelmente la logica e le funzionalità del modulo Flask `chatbot2.py`, ovvero:
- Gestione persistente di chat multi-utente e multi-modello AI (OpenAI, Anthropic, Gemini, Ollama)
- Supporto a modalità didattiche (interrogazione, intervista, RAG)
- Gestione di file/documenti per RAG
- Conteggio token e tracciamento utilizzo
- API compatibili con frontend già esistente

---

## **1. Stack Tecnologico**
- **Backend:** Django 4.x, Django REST Framework
- **Database:** SQLite (default, facilmente migrabile a PostgreSQL)
- **AI API:** openai, anthropic, google-generativeai, requests, tiktoken, pandas, pytesseract, Pillow, pdfplumber, python-dotenv
- **Autenticazione:** Sessione Django o JWT (opzionale, supporto anche per utenti anonimi)
- **Frontend:** Non incluso, ma le API devono essere compatibili con l'attuale frontend (es. chatbot2.html)

---

## **2. Modelli Django**

```python
from django.db import models
from django.contrib.auth.models import User

class Chat(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    chat = models.ForeignKey(Chat, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=20)  # 'user' o 'assistant'
    content = models.TextField()
    model = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatSettings(models.Model):
    chat = models.OneToOneField(Chat, related_name='settings', on_delete=models.CASCADE)
    grade = models.CharField(max_length=50, null=True, blank=True)
    mode = models.CharField(max_length=50, null=True, blank=True)
    subject = models.CharField(max_length=100, null=True, blank=True)
    model = models.CharField(max_length=100, null=True, blank=True)
    system_prompt = models.TextField(null=True, blank=True)
```

---

## **3. Serializzatori**

```python
from rest_framework import serializers
from .models import Chat, ChatMessage, ChatSettings

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'model', 'created_at']

class ChatSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSettings
        fields = ['grade', 'mode', 'subject', 'model', 'system_prompt']

class ChatSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    settings = ChatSettingsSerializer(read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'title', 'created_at', 'messages', 'settings']
```

---

## **4. API Endpoints**

| Metodo | Endpoint                  | Descrizione                                      |
|--------|---------------------------|--------------------------------------------------|
| GET    | `/api/chat-history/`      | Lista chat utente (o anonime)                    |
| GET    | `/api/chat/<id>/`         | Dettaglio chat (messaggi + impostazioni)         |
| DELETE | `/api/chat/<id>/`         | Elimina una chat                                 |
| DELETE | `/api/chats/`             | Elimina tutte le chat dell'utente/anonime        |
| POST   | `/api/chat/`              | Invia messaggio, ricevi risposta AI, aggiorna DB |

---

## **5. Views (Esempio)**

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Chat, ChatMessage, ChatSettings
from .serializers import ChatSerializer
from .ai_clients import process_ai_message  # Da implementare

class ChatHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        chats = Chat.objects.filter(user=user).order_by('-created_at')
        serializer = ChatSerializer(chats, many=True)
        return Response(serializer.data)

class ChatDetailView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def get(self, request, chat_id):
        user = request.user if request.user.is_authenticated else None
        chat = Chat.objects.get(id=chat_id, user=user)
        serializer = ChatSerializer(chat)
        return Response(serializer.data)
    def delete(self, request, chat_id):
        user = request.user if request.user.is_authenticated else None
        chat = Chat.objects.get(id=chat_id, user=user)
        chat.delete()
        return Response({'success': True})

class ChatListDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def delete(self, request):
        user = request.user if request.user.is_authenticated else None
        Chat.objects.filter(user=user).delete()
        return Response({'success': True})

class ChatMessageView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def post(self, request):
        data = request.data
        message = data.get('message')
        context = data.get('context', {})
        chat_id = data.get('chatId')
        user = request.user if request.user.is_authenticated else None
        response_data = process_ai_message(message, context, chat_id, user)
        return Response(response_data)
```

---

## **6. Logica AI (ai_clients.py)**

- **Funzione principale:**  
  `process_ai_message(message, context, chat_id, user)`  
  - Recupera/crea chat e impostazioni
  - Salva messaggio utente
  - Costruisce la storia della chat
  - Gestisce modalità (interrogazione, intervista, rag, ecc)
  - Chiama il modello AI selezionato (OpenAI, Anthropic, Gemini, Ollama)
  - Salva la risposta
  - Conta i token (tiktoken)
  - Restituisce risposta e token info

- **Gestione file/documenti per RAG:**  
  Funzioni per estrarre testo da PDF, immagini (OCR), CSV, testo semplice.

- **Gestione errori:**  
  Tutte le chiamate AI devono essere protette da try/except e restituire errori chiari.

---

## **7. Routing**

```python
from django.urls import path
from .views import ChatHistoryView, ChatDetailView, ChatListDeleteView, ChatMessageView

urlpatterns = [
    path('api/chat-history/', ChatHistoryView.as_view()),
    path('api/chat/<int:chat_id>/', ChatDetailView.as_view()),
    path('api/chats/', ChatListDeleteView.as_view()),
    path('api/chat/', ChatMessageView.as_view()),
]
```

---

## **8. Dipendenze**

```
Django
djangorestframework
openai
anthropic
google-generativeai
requests
tiktoken
pandas
pytesseract
Pillow
pdfplumber
python-dotenv
```

---

## **9. Note Implementative**

- **Compatibilità frontend:**  
  Le risposte JSON devono essere compatibili con quelle di `chatbot2.py` (es. `{response, chatId, token_info}`).
- **Autenticazione:**  
  Supporto sia per utenti autenticati che anonimi (user=None).
- **Gestione file:**  
  Se necessario, aggiungere un modello `Resource` per i file/documenti.
- **Test:**  
  Scrivere test per ogni endpoint e per la logica AI.
- **Configurazione API key:**  
  Usare variabili d'ambiente e/o file `.env`.

---

## **10. Esempio di chiamata POST /api/chat/**

**Request:**
```json
{
  "message": "Ciao, spiegami la fotosintesi",
  "context": {
    "grade": "sec1",
    "mode": "interrogazione",
    "subject": "scienze",
    "model": "gpt4o-mini",
    "systemPrompt": "Sei un insegnante di scienze..."
  },
  "chatId": null
}
```

**Response:**
```json
{
  "response": "La fotosintesi è il processo...",
  "chatId": 12,
  "token_info": {
    "total": 123,
    "input": 60,
    "output": 63
  }
}
```

---

**Per dettagli su una funzione specifica, chiedere!**  
**Questo documento è pronto per essere usato come base di sviluppo o come prompt per un'altra istanza di Cursor.**
