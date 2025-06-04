# Chatbot Service Frontend

Questo documento descrive l'implementazione del frontend per il servizio chatbot, ispirato al file `chatbot2.html` e integrato nell'architettura React esistente.

## Struttura dei File

### Services
- `src/services/chatbotService.js` - Service per le API del chatbot
  - `sendMessage()` - Invia messaggi al bot
  - `getChatHistory()` - Recupera cronologia chat
  - `getChatDetail()` - Dettagli di una chat specifica
  - `deleteChat()` - Elimina una chat
  - `deleteAllChats()` - Elimina tutte le chat

### Components
- `src/components/ChatMessage.jsx` - Componente per singoli messaggi con supporto Markdown
- `src/components/ChatHistoryItem.jsx` - Item della cronologia chat nella sidebar
- `src/components/LoadingDots.jsx` - Animazione di caricamento per i messaggi del bot
- `src/components/ChatbotTutorialModal.jsx` - Modal del tutorial del chatbot

### Pages
- `src/pages/ChatbotServicePage.jsx` - Pagina principale del chatbot

## Funzionalità Implementate

### 🎯 Configurazione Chatbot
- **Selezione parametri**: grado scolastico, modalità, argomento, modello AI
- **Context area**: per personalizzare la personalità del bot
- **Modalità speciali**:
  - Interrogazione: il bot fa domande su un argomento
  - Interazione: conversazione libera
  - Intervista Impossibile: il bot interpreta personaggi storici

### 💬 Sistema Chat
- **Cronologia chat**: sidebar con lista delle conversazioni
- **Messaggi**: supporto completo per Markdown e syntax highlighting
- **Caricamento**: animazione dots durante l'attesa delle risposte
- **Auto-scroll**: scorrimento automatico ai nuovi messaggi

### 🛠 Gestione Chat
- **Nuova chat**: avvia nuove conversazioni
- **Elimina chat**: singole o tutte
- **Download chat**: esporta conversazioni in formato testo
- **Caricamento chat**: riprendi conversazioni precedenti

### 🎨 UI/UX
- **Responsive design**: ottimizzato per desktop e mobile
- **Theme moderno**: gradient purple/pink, design pulito
- **Tutorial modal**: guida completa per l'utilizzo
- **Error handling**: gestione errori con notifiche

## Packages Aggiuntivi Installati

```bash
npm install marked highlight.js react-markdown react-syntax-highlighter
```

- `marked` - Parser Markdown (backup)
- `highlight.js` - Syntax highlighting per codice
- `react-markdown` - Componente React per Markdown
- `react-syntax-highlighter` - Syntax highlighting per React

## Integrazione con Backend

### Endpoint API Utilizzati
- `POST /api/chatbot/chat/` - Invia messaggio
- `GET /api/chatbot/chat-history/` - Cronologia
- `GET /api/chatbot/chat/<id>/` - Dettagli chat
- `DELETE /api/chatbot/chat/<id>/` - Elimina chat
- `DELETE /api/chatbot/chats/` - Elimina tutte

### Payload Esempio
```json
{
  "message": "Ciao, come stai?",
  "context": {
    "grade": "sec2-triennio",
    "mode": "interazione",
    "subject": "scienze",
    "model": "gpt4o-mini",
    "systemPrompt": "Sei un tutor gentile e paziente..."
  },
  "chatId": 123
}
```

## Modalità Speciali

### Interrogazione
- Il bot fa domande su un argomento specifico
- L'utente risponde e riceve feedback
- Adatto per verifiche e ripasso

### Intervista Impossibile
- Il bot interpreta personaggi storici
- Configurabile: accuratezza storica, linguaggio d'epoca
- Immersivo per l'apprendimento della storia

### Interazione
- Conversazione libera su qualsiasi argomento
- Personalizzabile tramite system prompt
- Modalità più flessibile

## Styling e Design

- **Tema**: Purple/Pink gradient per differenziare dal resto della piattaforma
- **Layout**: Sidebar + area chat principale
- **Responsive**: Ottimizzato per mobile e desktop
- **Accessibilità**: Focus states e ARIA labels

## Note Tecniche

- Tutti i componenti utilizzano React Hooks moderni
- State management locale (nessun Redux necessario)
- Auto-scroll implementato con `useRef` e `useEffect`
- Gestione keyboard shortcuts (Enter per inviare)
- Markdown rendering sicuro con sanitizzazione

## Come Usare

1. Vai su `/chatbot` dopo il login
2. Configura: grado, modalità, argomento, modello
3. Inserisci context per personalizzare il bot
4. Clicca "Inizia" per avviare la conversazione
5. Chatta normalmente - il bot mantiene il contesto
6. Usa la sidebar per gestire le chat

## Troubleshooting

- **Errore 403**: Verifica autenticazione JWT
- **Errore 500**: Controlla connessione al backend
- **Markdown non renderizzato**: Verifica installazione `react-markdown`
- **Chat non caricate**: Controlla endpoint API chatbot

## Future Enhancements

- [ ] Modalità RAG con upload documenti
- [ ] Export chat in formati multipli (PDF, HTML)
- [ ] Temi personalizzabili
- [ ] Supporto vocale (speech-to-text)
- [ ] Chat condivise tra utenti
- [ ] Templates di conversazione predefiniti 