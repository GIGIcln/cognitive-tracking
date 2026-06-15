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

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const interval = setInterval(() => {
      syncNow();
    }, 60000);
    return () => clearInterval(interval);
  }, [isOnline, pendingCount, syncNow]);

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
