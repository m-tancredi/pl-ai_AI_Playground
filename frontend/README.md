# AI Playground Frontend

Frontend React per la piattaforma AI Playground della Fondazione Golinelli.

## Tecnologie Utilizzate

- **React** - Libreria per l'interfaccia utente
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS per lo styling
- **React Router** - Routing per applicazioni single-page
- **Axios** - Client HTTP per le chiamate API

## Funzionalità

- 🤖 **Chatbot Service** - Interfaccia per interagire con chatbot AI
- 📊 **Data Analysis** - Strumenti per l'analisi dati
- 🖼️ **Image Generator** - Generazione di immagini tramite AI
- 🔍 **Image Classifier** - Classificazione di immagini
- 📚 **Knowledge Base** - Gestione base di conoscenza
- 🔗 **RAG Service** - Retrieval Augmented Generation
- 📁 **Resource Manager** - Gestione risorse

## Installazione

```bash
npm install
```

## Sviluppo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Struttura del Progetto

```
src/
├── components/     # Componenti riutilizzabili
├── pages/          # Pagine dell'applicazione
├── services/       # Servizi per API calls
├── context/        # React Context per stato globale
├── hooks/          # Custom hooks
├── utils/          # Utility functions
└── App.jsx         # Componente principale
```

## Configurazione API

Il frontend si connette ai servizi backend tramite le API configurate in `src/services/`.

## Contribuire

1. Fork del repository
2. Crea un branch per la feature (`git checkout -b feature/nome-feature`)
3. Commit delle modifiche (`git commit -am 'Aggiungi nuova feature'`)
4. Push al branch (`git push origin feature/nome-feature`)
5. Apri una Pull Request

## Licenza

Questo progetto è sviluppato per la Fondazione Golinelli. 