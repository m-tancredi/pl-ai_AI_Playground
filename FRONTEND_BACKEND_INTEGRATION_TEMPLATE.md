# Template Integrazione Frontend-Backend AI PlayGround

Questo documento fornisce una guida completa per integrare il frontend React/Vite con i microservizi backend Django del progetto AI PlayGround.

## Indice

1. [Architettura Sistema](#architettura-sistema)
2. [Setup Frontend Service](#setup-frontend-service)
3. [Pattern API Client](#pattern-api-client)
4. [Autenticazione JWT](#autenticazione-jwt)
5. [Gestione Microservizi](#gestione-microservizi)
6. [Error Handling](#error-handling)
7. [Docker Integration](#docker-integration)
8. [Testing & Development](#testing--development)
9. [Best Practices](#best-practices)
10. [Template Files](#template-files)

## Architettura Sistema

### Stack Tecnologico
- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Django + DRF microservizi
- **Comunicazione**: REST API + JWT
- **Proxy**: Nginx per routing
- **Orchestrazione**: Docker Compose

### Flusso Comunicazione
```
[React App] → [Nginx] → [Microservizio Backend]
     ↑                           ↓
[Auth Context] ← [JWT Token] ← [Auth Service]
```

## Setup Frontend Service

### Struttura Directory Frontend
```
frontend/
├── src/
│   ├── components/          # Componenti React riutilizzabili
│   ├── pages/              # Pagine/Route principali
│   ├── services/           # API clients per microservizi
│   ├── context/            # React Context (Auth, Theme, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── main.jsx           # Entry point
├── public/                 # Asset statici
├── package.json           # Dependencies
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # TailwindCSS config
└── Dockerfile             # Container config
```

### package.json Base Template
```json
{
  "name": "pl-ai-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "serve -s dist -l 3000"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2",
    "jwt-decode": "^4.0.0",
    "react-hot-toast": "^2.5.2",
    "@heroicons/react": "^2.2.0",
    "@tailwindcss/forms": "^0.5.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "^3.5.0",
    "vite": "^5.0.3",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### vite.config.js Template
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Per Docker
    // Proxy per development locale
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

## Pattern API Client

### API Client Base (src/services/apiClient.js)
```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/', // Nginx proxy
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor - JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - Token Refresh
let isRefreshing = false;
let failedQueue = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/v1/token/refresh/', {
          refresh: refreshToken
        });

        const newToken = response.data.access;
        localStorage.setItem('accessToken', newToken);
        
        // Retry failed requests
        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Logout user
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

## Autenticazione JWT

### AuthContext Template (src/context/AuthContext.jsx)
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import apiClient from '../services/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const decodeToken = (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) return null;
      return { 
        id: decoded.user_id, 
        username: decoded.username,
        email: decoded.email 
      };
    } catch {
      return null;
    }
  };

  const login = async (credentials) => {
    try {
      const response = await apiClient.post('/api/v1/token/', credentials);
      const { access, refresh } = response.data;
      
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      
      const userData = decodeToken(access);
      setUser(userData);
      setIsAuthenticated(true);
      
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    delete apiClient.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const userData = decodeToken(token);
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Gestione Microservizi

### Template Servizio API (src/services/{serviceName}Service.js)
```javascript
import apiClient from './apiClient';

// Configurazione endpoint per microservizio
const SERVICE_ENDPOINTS = {
  // Sostituire con path specifici del microservizio
  base: '/api/v1/{service}',
  list: '/api/v1/{service}/',
  detail: '/api/v1/{service}/{id}/',
  me: '/api/v1/{service}/me/',
  stats: '/api/v1/{service}/stats/',
};

// CRUD Operations
export const {serviceName}Service = {
  
  // GET Lista
  getList: async (params = {}) => {
    try {
      const response = await apiClient.get(SERVICE_ENDPOINTS.list, { params });
      return response.data;
    } catch (error) {
      console.error('Get list failed:', error);
      throw error;
    }
  },

  // GET Singolo
  getById: async (id) => {
    try {
      const response = await apiClient.get(
        SERVICE_ENDPOINTS.detail.replace('{id}', id)
      );
      return response.data;
    } catch (error) {
      console.error('Get by ID failed:', error);
      throw error;
    }
  },

  // POST Crea
  create: async (data) => {
    try {
      const response = await apiClient.post(SERVICE_ENDPOINTS.list, data);
      return response.data;
    } catch (error) {
      console.error('Create failed:', error);
      throw error;
    }
  },

  // PUT/PATCH Aggiorna
  update: async (id, data, partial = true) => {
    try {
      const method = partial ? 'patch' : 'put';
      const response = await apiClient[method](
        SERVICE_ENDPOINTS.detail.replace('{id}', id),
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  },

  // DELETE
  delete: async (id) => {
    try {
      await apiClient.delete(SERVICE_ENDPOINTS.detail.replace('{id}', id));
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  },

  // Endpoint personalizzati
  getMe: async () => {
    try {
      const response = await apiClient.get(SERVICE_ENDPOINTS.me);
      return response.data;
    } catch (error) {
      console.error('Get me failed:', error);
      throw error;
    }
  },

  // File upload
  uploadFile: async (id, file, fieldName = 'file') => {
    try {
      const formData = new FormData();
      formData.append(fieldName, file);
      
      const response = await apiClient.post(
        `${SERVICE_ENDPOINTS.detail.replace('{id}', id)}upload/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }
};

export default {serviceName}Service;
```

### Esempio UserService per user_service
```javascript
import apiClient from './apiClient';

const USER_ENDPOINTS = {
  list: '/api/v1/users/',
  detail: '/api/v1/users/{id}/',
  me: '/api/v1/users/me/',
  preferences: '/api/v1/users/{id}/preferences/',
  uploadAvatar: '/api/v1/users/{id}/upload-avatar/',
  public: '/api/v1/users/{id}/public/',
  stats: '/api/v1/users/stats/',
};

export const userService = {
  getProfile: async () => {
    const response = await apiClient.get(USER_ENDPOINTS.me);
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await apiClient.patch(USER_ENDPOINTS.me, data);
    return response.data;
  },

  getPreferences: async (userId) => {
    const response = await apiClient.get(
      USER_ENDPOINTS.preferences.replace('{id}', userId)
    );
    return response.data;
  },

  updatePreferences: async (userId, preferences) => {
    const response = await apiClient.put(
      USER_ENDPOINTS.preferences.replace('{id}', userId),
      { preferences }
    );
    return response.data;
  },

  uploadAvatar: async (userId, file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await apiClient.post(
      USER_ENDPOINTS.uploadAvatar.replace('{id}', userId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }
};

export default userService;
```

## Error Handling

### Global Error Handler (src/utils/errorHandler.js)
```javascript
import toast from 'react-hot-toast';

export const handleApiError = (error, customMessage = null) => {
  console.error('API Error:', error);

  let message = customMessage || 'Si è verificato un errore';

  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        message = data.detail || 'Dati non validi';
        break;
      case 401:
        message = 'Accesso non autorizzato';
        break;
      case 403:
        message = 'Permessi insufficienti';
        break;
      case 404:
        message = 'Risorsa non trovata';
        break;
      case 429:
        message = 'Troppo molte richieste. Riprova più tardi';
        break;
      case 500:
        message = 'Errore del server';
        break;
      default:
        message = data.detail || `Errore ${status}`;
    }

    // Handle field errors
    if (data.errors || data.non_field_errors) {
      const fieldErrors = data.errors || data.non_field_errors;
      message = Object.values(fieldErrors).flat().join(', ');
    }
  } else if (error.request) {
    message = 'Nessuna risposta dal server';
  }

  toast.error(message);
  return message;
};

// Custom hook per error handling
export const useErrorHandler = () => {
  return {
    handleError: handleApiError,
    handleAsyncError: async (asyncFn, errorMsg = null) => {
      try {
        return await asyncFn();
      } catch (error) {
        handleApiError(error, errorMsg);
        throw error;
      }
    }
  };
};
```

## Docker Integration

### Dockerfile Frontend
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf per Frontend
```nginx
server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gestione SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache assets statici
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### Docker Compose Integration
```yaml
# Aggiungere al docker-compose.yml principale

services:
  # Frontend Service
  frontend:
    build:
      context: ./frontend
    container_name: pl-ai-frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules  # Anonymous volume for node_modules
    expose: ["3000"]
    networks: [pl-ai-network]
    environment:
      - NODE_ENV=development
    restart: unless-stopped
    depends_on:
      - nginx

  # Nginx come API Gateway
  nginx:
    build:
      context: ./nginx
    container_name: pl-ai-nginx
    ports: ["8080:80"]
    networks: [pl-ai-network]
    depends_on:
      - auth_service
      - user_service
      - frontend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    restart: unless-stopped
```

## Testing & Development

### Environment Setup
```bash
# Development locale
cd frontend
npm install
npm run dev  # http://localhost:5173

# Docker development
docker-compose up frontend

# Production build test
npm run build
npm run preview
```

### API Testing Pattern
```javascript
// src/utils/apiTest.js
export const testApiEndpoints = async () => {
  const tests = [
    { name: 'Auth Login', fn: () => authService.login({}) },
    { name: 'User Profile', fn: () => userService.getProfile() },
    // Aggiungere altri test
  ];

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}: OK`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
};
```

## Best Practices

### Struttura Codice
```javascript
// Organizzazione imports
import React from 'react';           // External libraries
import { useState } from 'react';    // Named imports

import { useAuth } from '../context'; // Internal context/hooks
import userService from '../services'; // Internal services
import Button from '../components';   // Internal components

// Constants
const API_ENDPOINTS = {};
const DEFAULT_VALUES = {};

// Component
const MyComponent = () => {
  // Hooks prima
  const { user } = useAuth();
  const [state, setState] = useState();

  // Event handlers
  const handleSubmit = async () => {};

  // Render
  return <div></div>;
};
```

### Performance
- Lazy loading per routes
- Memoization componenti pesanti
- Debouncing per search/input
- Virtual scrolling per liste lunghe
- Image optimization

### Security
- Sanitizzazione input utente
- Validazione client + server
- HTTPS enforcement
- CSP headers
- XSS protection

---

**Versione**: 1.0.0  
**Ultima Modifica**: 2024  
**Compatibilità**: React 18+, Vite 5+, Docker Compose 3.9+ 