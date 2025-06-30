# Guida all'Autenticazione Sociale con Supabase

## Panoramica

Questa guida spiega come utilizzare l'autenticazione sociale implementata con Supabase nel progetto PL-AI. L'integrazione supporta Google, Apple e GitHub come provider di autenticazione.

## Architettura

### Backend (Django)
- **Servizio Supabase**: `users_api/supabase_service.py` - Gestisce l'integrazione con Supabase
- **Viste Social Auth**: `users_api/social_auth_views.py` - Endpoint API per l'autenticazione sociale
- **Configurazione**: `service_auth/settings.py` - Configurazioni di Supabase e provider

### Frontend (React)
- **Servizio Supabase**: `src/services/supabaseService.js` - Client Supabase per il frontend
- **Componenti**: `src/components/SocialAuthButtons.jsx` - Pulsanti di autenticazione sociale
- **Pagina Callback**: `src/pages/AuthCallbackPage.jsx` - Gestisce il callback dopo l'autenticazione
- **Context**: `src/context/AuthContext.jsx` - Stato di autenticazione aggiornato

## Configurazione

### 1. Configurazione Supabase

#### Passo 1: Creare un progetto Supabase
1. Vai su [supabase.com](https://supabase.com)
2. Crea un nuovo progetto
3. Annota l'URL del progetto e le chiavi API

#### Passo 2: Configurare i provider OAuth

##### Google OAuth
1. Vai su [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita l'API Google+ e l'API OAuth 2.0
4. Crea credenziali OAuth 2.0:
   - **Tipo di applicazione**: Applicazione web
   - **URI di redirect autorizzati**: 
     - `https://your-project-id.supabase.co/auth/v1/callback`
     - `http://localhost:8080/auth/callback` (per sviluppo)
5. Copia Client ID e Client Secret

##### GitHub OAuth (Opzionale)
1. Vai su GitHub Settings > Developer settings > OAuth Apps
2. Crea una nuova OAuth App:
   - **Application name**: PL-AI
   - **Homepage URL**: `http://localhost:8080`
   - **Authorization callback URL**: `https://your-project-id.supabase.co/auth/v1/callback`
3. Copia Client ID e Client Secret

##### Apple OAuth (Opzionale)
1. Vai su [Apple Developer Console](https://developer.apple.com)
2. Configura Sign in with Apple
3. Crea un Service ID e ottieni le credenziali necessarie

#### Passo 3: Configurare Supabase Dashboard
1. Vai su Authentication > Settings nel dashboard Supabase
2. Configura ogni provider OAuth con le credenziali ottenute
3. Imposta gli URL di redirect appropriati

### 2. Configurazione Backend

#### Variabili d'ambiente
Crea un file `.env` nella directory `backend/auth_service/`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Google OAuth
SOCIAL_AUTH_GOOGLE_ENABLED=true
SOCIAL_AUTH_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SOCIAL_AUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (opzionale)
SOCIAL_AUTH_GITHUB_ENABLED=false
SOCIAL_AUTH_GITHUB_CLIENT_ID=your-github-client-id
SOCIAL_AUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Apple OAuth (opzionale)
SOCIAL_AUTH_APPLE_ENABLED=false
SOCIAL_AUTH_APPLE_CLIENT_ID=your.apple.client.id
SOCIAL_AUTH_APPLE_TEAM_ID=your-apple-team-id
SOCIAL_AUTH_APPLE_KEY_ID=your-apple-key-id
SOCIAL_AUTH_APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----

# Frontend URL
FRONTEND_BASE_URL=http://localhost:8080
```

#### Installazione dipendenze
```bash
cd backend/auth_service
pip install -r requirements.txt
```

### 3. Configurazione Frontend

#### Installazione dipendenze
```bash
cd frontend
npm install
```

## Utilizzo

### Flusso di Autenticazione

1. **Inizializzazione**: L'AuthContext inizializza automaticamente Supabase
2. **Login Sociale**: L'utente clicca su un pulsante social nella pagina di login
3. **Redirect**: L'utente viene reindirizzato al provider OAuth
4. **Callback**: Il provider reindirizza a `/auth/callback` con i token
5. **Validazione**: Il backend valida i token Supabase e crea/aggiorna l'utente
6. **Autenticazione**: L'utente viene autenticato con JWT interni

### API Endpoints

#### GET `/api/v1/social-auth/config/`
Restituisce la configurazione dei provider abilitati

**Risposta:**
```json
{
  "providers": {
    "google": {
      "name": "Google",
      "client_id": "your-google-client-id",
      "enabled": true
    }
  },
  "supabase_url": "https://your-project-id.supabase.co",
  "supabase_anon_key": "your-anon-key",
  "redirect_url": "http://localhost:8080/auth/callback"
}
```

#### GET `/api/v1/social-auth/providers/`
Restituisce la lista dei provider abilitati

**Risposta:**
```json
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "enabled": true
    }
  ]
}
```

#### POST `/api/v1/social-auth/callback/`
Gestisce il callback dopo l'autenticazione sociale

**Richiesta:**
```json
{
  "access_token": "supabase-access-token",
  "refresh_token": "supabase-refresh-token",
  "provider": "google"
}
```

**Risposta:**
```json
{
  "access": "jwt-access-token",
  "refresh": "jwt-refresh-token",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "email": "user@example.com",
    "first_name": "Nome",
    "last_name": "Cognome"
  },
  "provider": "google",
  "message": "Autenticazione tramite google completata con successo"
}
```

## Utilizzo nei Componenti React

### Esempio di utilizzo dell'AuthContext

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { 
    signInWithGoogle, 
    signInWithGitHub, 
    socialAuthProviders,
    isLoading 
  } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      // Il redirect avviene automaticamente
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div>
      {socialAuthProviders.map(provider => (
        <button 
          key={provider.id}
          onClick={() => signInWithProvider(provider.id)}
          disabled={isLoading}
        >
          Login with {provider.name}
        </button>
      ))}
    </div>
  );
}
```

## Sicurezza

### Validazione Token
- Tutti i token Supabase vengono validati usando il JWT secret
- I token scaduti vengono automaticamente rifiutati
- L'autenticazione fallisce se il token non è valido

### Gestione Utenti
- Gli utenti vengono creati automaticamente se non esistono
- L'email è usata come identificatore unico
- I dati vengono aggiornati solo se configurato

### CORS
- Le richieste sono limitate ai domini configurati
- I cookie sono supportati per la gestione delle sessioni

## Troubleshooting

### Problemi Comuni

#### 1. "SUPABASE_URL non configurata"
**Soluzione**: Verificare che tutte le variabili d'ambiente Supabase siano impostate

#### 2. "Token non valido" 
**Soluzione**: 
- Verificare che SUPABASE_JWT_SECRET sia corretto
- Controllare che il token non sia scaduto
- Verificare la configurazione del provider OAuth

#### 3. "Provider non abilitato"
**Soluzione**: Impostare `SOCIAL_AUTH_[PROVIDER]_ENABLED=true` nel file `.env`

#### 4. "Redirect URL non valido"
**Soluzione**: 
- Verificare che l'URL di callback sia configurato correttamente in Supabase
- Controllare che l'URL corrisponda a quello configurato nel provider OAuth

### Debug

#### Logging Backend
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Logging Frontend
```javascript
// Abilitare i log di debug in supabaseService.js
console.log('Debug info:', data);
```

## Estensioni Future

### Nuovi Provider
Per aggiungere nuovi provider OAuth:

1. Aggiungere la configurazione in `settings.py`
2. Implementare il metodo nel `SupabaseService`
3. Aggiungere il supporto in `SocialAuthButtons.jsx`
4. Configurare il provider in Supabase Dashboard

### Campi Utente Aggiuntivi
Per salvare informazioni aggiuntive:

1. Estendere il modello `User` 
2. Aggiornare `get_or_create_user_from_supabase()`
3. Modificare i serializer se necessario

### Gestione Errori Avanzata
- Implementare retry logic per le richieste API
- Aggiungere notifiche dettagliate per gli errori
- Implementare fallback per provider non disponibili

## Support

Per problemi o domande:
1. Consultare questa documentazione
2. Verificare i log del backend e frontend
3. Controllare la configurazione di Supabase
4. Verificare le credenziali OAuth dei provider 