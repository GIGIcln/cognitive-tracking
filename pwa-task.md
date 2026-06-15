# TASK: Implementazione PWA — Cognitive Tracking Frontend

## CONTESTO
Sei nella root di un progetto full-stack (FastAPI + React/Vite).
Il frontend è in `frontend/`. Usa già la libreria `idb` per IndexedDB.
Auth JWT: token salvato in `localStorage` con chiave `ct_token`.
Il piano architetturale è già approvato. Implementa ESATTAMENTE quanto segue.

---

## STEP 1 — Leggi prima questi file esistenti

Leggi i seguenti file prima di scrivere qualsiasi codice:
- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/src/main.jsx`
- `frontend/src/layouts/MainLayout.jsx`
- `frontend/src/api/axios.js`

---

## STEP 2 — Installa la dipendenza

```bash
cd frontend && npm install vite-plugin-pwa -D
```

---

## STEP 3 — Crea `frontend/public/manifest.json`

```json
{
  "name": "Cognitive Tracking",
  "short_name": "CogTrack",
  "description": "Monitoraggio cognitivo giocatori di calcio giovanile",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192x192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

---

## STEP 4 — Crea le icone SVG

Crea `frontend/public/icons/icon-192x192.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#0f172a"/>
  <rect x="16" y="16" width="160" height="160" rx="24" fill="#1e293b"/>
  <text x="96" y="118" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="700" text-anchor="middle" fill="#3b82f6">CT</text>
  <line x1="48" y1="140" x2="144" y2="140" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
</svg>
```

Crea `frontend/public/icons/icon-512x512.svg` (stesso contenuto, viewBox="0 0 512 512" con proporzioni scalate):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0f172a"/>
  <rect x="40" y="40" width="432" height="432" rx="60" fill="#1e293b"/>
  <text x="256" y="310" font-family="system-ui,-apple-system,sans-serif" font-size="192" font-weight="700" text-anchor="middle" fill="#3b82f6">CT</text>
  <line x1="128" y1="370" x2="384" y2="370" stroke="#3b82f6" stroke-width="10" stroke-linecap="round" opacity="0.4"/>
</svg>
```

---

## STEP 5 — Modifica `frontend/vite.config.js`

Aggiungi l'import di VitePWA in cima al file (dopo gli import esistenti) e aggiungilo all'array `plugins`. NON rimuovere nulla di esistente.

Import da aggiungere:
```js
import { VitePWA } from 'vite-plugin-pwa'
```

Plugin da aggiungere nell'array `plugins`:
```js
VitePWA({
  registerType: 'autoUpdate',
  devOptions: {
    enabled: true,
    type: 'module',
  },
  manifest: {
    name: 'Cognitive Tracking',
    short_name: 'CogTrack',
    description: 'Monitoraggio cognitivo giocatori di calcio giovanile',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#3b82f6',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/auth'),
        handler: 'NetworkOnly',
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /\.(woff2?|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts-cache',
          expiration: {
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
    ],
  },
})
```

---

## STEP 6 — Crea `frontend/src/utils/offlineQueue.js`

```js
import { openDB } from 'idb';

const DB_NAME = 'cognitive-tracking-offline';
const STORE_NAME = 'sync_queue';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

export async function addToQueue({ url, method, body, label = 'Operazione offline' }) {
  const db = await getDB();
  return db.add(STORE_NAME, {
    url,
    method,
    body,
    timestamp: Date.now(),
    retries: 0,
    label,
  });
}

export async function getAllItems() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getCount() {
  const db = await getDB();
  return db.count(STORE_NAME);
}

export async function removeItem(id) {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
}

export async function incrementRetry(id) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.retries += 1;
    await tx.store.put(item);
  }
  await tx.done;
}
```

---

## STEP 7 — Crea `frontend/src/hooks/useOnlineStatus.js`

```js
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
```

---

## STEP 8 — Crea `frontend/src/context/OfflineContext.jsx`

```jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  addToQueue,
  getAllItems,
  getCount,
  removeItem,
  incrementRetry,
} from '../utils/offlineQueue';

const OfflineContext = createContext(null);

function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function OfflineContextProvider({ children }) {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getCount();
      setPendingCount(count);
    } catch {
      // silently ignore — IndexedDB non disponibile
    }
  }, []);

  // Polling ogni 5s per aggiornare il badge
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  const addItem = useCallback(
    async (item) => {
      await addToQueue(item);
      await refreshCount();
    },
    [refreshCount]
  );

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);

    const token = localStorage.getItem('ct_token');

    if (!token || !isTokenValid(token)) {
      setSyncError(
        'Sessione scaduta: accedi di nuovo per completare la sincronizzazione.'
      );
      setIsSyncing(false);
      return;
    }

    try {
      const items = await getAllItems();
      for (const item of items) {
        // Piccolo delay tra le richieste per non sovraccaricare il server
        await new Promise((r) => setTimeout(r, 300));
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.body),
          });

          if (res.ok) {
            await removeItem(item.id);
          } else if (res.status >= 400 && res.status < 500) {
            // Errore client permanente (es. 422 validation) → rimuovi senza retry
            await removeItem(item.id);
            console.warn(
              `[OfflineSync] Errore permanente ${res.status} su ${item.url}. Item rimosso.`
            );
          } else {
            // Errore server (5xx) → incrementa retry
            await incrementRetry(item.id);
            if (item.retries + 1 >= 3) {
              await removeItem(item.id);
              console.error(
                `[OfflineSync] Max retry raggiunti per ${item.url}. Item rimosso.`
              );
            }
          }
        } catch {
          await incrementRetry(item.id);
          if (item.retries + 1 >= 3) {
            await removeItem(item.id);
          }
        }
      }
    } finally {
      await refreshCount();
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  // Sync automatica quando si torna online
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      syncNow();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, syncNow]);

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, addToQueue: addItem, syncNow, syncError, isSyncing }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline deve essere usato dentro OfflineContextProvider');
  return ctx;
}
```

---

## STEP 9 — Crea `frontend/src/components/OfflineBanner.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useOffline } from '../context/OfflineContext';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncError, syncNow } = useOffline();
  const [showOnlinePill, setShowOnlinePill] = useState(false);

  useEffect(() => {
    if (isOnline && pendingCount === 0 && !isSyncing) {
      setShowOnlinePill(true);
      const t = setTimeout(() => setShowOnlinePill(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, pendingCount, isSyncing]);

  if (!isOnline) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
        <span>
          Modalità offline
          {pendingCount > 0 &&
            ` — ${pendingCount} operazion${pendingCount === 1 ? 'e' : 'i'} in coda`}
        </span>
      </div>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
        <svg
          className="h-4 w-4 flex-shrink-0 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>
          Sincronizzazione in corso
          {pendingCount > 0 && ` (${pendingCount})`}
        </span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
        <span className="truncate">{syncError}</span>
        <button
          onClick={syncNow}
          className="ml-auto flex-shrink-0 text-xs underline hover:no-underline"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (showOnlinePill) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
        <span>Online</span>
      </div>
    );
  }

  return null;
}
```

---

## STEP 10 — Modifica `frontend/src/layouts/MainLayout.jsx`

Leggi il file. Aggiungi SOLO queste due cose, senza modificare nulla d'altro:

1. Aggiungi questo import in cima (dopo gli import esistenti):
```jsx
import OfflineBanner from '../components/OfflineBanner';
```

2. Inserisci `<OfflineBanner />` subito prima dell'inizio del contenuto principale (dentro la sidebar o il nav, dove gli altri elementi di navigazione sono già presenti). Scegli il punto più logico in base alla struttura che trovi.

---

## STEP 11 — Modifica `frontend/src/api/axios.js`

Leggi il file. Aggiungi UN SOLO nuovo interceptor sull'errore (come ULTIMO interceptor, dopo quelli esistenti). NON rimuovere gli interceptor esistenti.

```js
// Interceptor offline queue — aggiungere DOPO gli interceptor esistenti
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Errore HTTP normale (4xx, 5xx): gestione standard
    if (error.response) {
      return Promise.reject(error);
    }

    // Errore di rete (no risposta) su metodi in scrittura: accoda offline
    const method = error.config?.method?.toUpperCase();
    if (!error.response && error.config && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const { addToQueue } = await import('../utils/offlineQueue');
        let body = {};
        try {
          body = JSON.parse(error.config.data || '{}');
        } catch {}

        await addToQueue({
          url: error.config.url,
          method,
          body,
          label: `${method} ${error.config.url} — ${new Date().toLocaleTimeString('it-IT')}`,
        });

        const offlineError = new Error(
          'Operazione salvata offline. Verrà sincronizzata al ripristino della connessione.'
        );
        offlineError.isOfflineQueued = true;
        return Promise.reject(offlineError);
      } catch (queueError) {
        console.error('[OfflineQueue] Errore durante l\'accodamento:', queueError);
      }
    }

    return Promise.reject(error);
  }
);
```

ATTENZIONE: `axiosInstance` è il nome dell'istanza Axios — usa il nome effettivo che trovi nel file.

---

## STEP 12 — Modifica `frontend/src/main.jsx`

Leggi il file. Aggiungi:

1. Questi due import PRIMA di tutti gli altri import (eccetto React stesso):
```jsx
import { registerSW } from 'virtual:pwa-register';
import { OfflineContextProvider } from './context/OfflineContext';
```

2. Chiama `registerSW` PRIMA della chiamata a `ReactDOM.createRoot` o `render`:
```js
registerSW({
  onNeedRefresh() {
    console.log('[PWA] Nuova versione disponibile, aggiornamento automatico in corso...');
  },
  onOfflineReady() {
    console.log('[PWA] App pronta per l\'uso offline.');
  },
});
```

3. Avvolgi il componente root esistente con `<OfflineContextProvider>`. Mantieni tutto il resto (React.StrictMode, BrowserRouter, App, AuthContext — qualsiasi cosa ci sia) invariato. Aggiungi SOLO il wrapper esterno.

---

## STEP 13 — Verifica finale

Dopo aver completato tutte le modifiche:
1. Mostra un riepilogo di tutti i file creati/modificati
2. Mostra la struttura della directory `frontend/public/icons/`
3. Segnala se hai trovato nomi diversi da quelli attesi (es. istanza Axios con nome diverso da `axiosInstance`)

---

## VINCOLI ASSOLUTI
- NON toccare nessun file in `backend/`
- NON modificare `src/context/AuthContext.jsx`
- NON modificare nessun file in `src/pages/`
- NON modificare `src/components/PlayerFormModal.jsx` né `ProtectedRoute.jsx`
- NON rimuovere import o codice esistente nei file che modifichi
- USA SOLO `idb` e `vite-plugin-pwa` — zero altre librerie
- Stile Tailwind puro — nessun CSS esterno

