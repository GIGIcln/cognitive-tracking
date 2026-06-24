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

  // Polling adattivo: 5s se ci sono item in coda, 30s altrimenti
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, pendingCount > 0 ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [refreshCount, pendingCount]);

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

    try {
      const now = Date.now();
      const items = (await getAllItems()).filter((i) => (i.nextRetryAt ?? 0) <= now);
      for (const item of items) {
        // Delay inter-request con piccolo jitter per evitare burst sincronizzati
        const delay = 500 + Math.random() * 300
        await new Promise((r) => setTimeout(r, delay));
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
              setSyncError('Sincronizzazione fallita: alcuni dati non sono stati inviati al server.');
              console.error(
                `[OfflineSync] Max retry raggiunti per ${item.url}. Item rimosso.`
              );
            }
          }
        } catch {
          await incrementRetry(item.id);
          if (item.retries + 1 >= 3) {
            await removeItem(item.id);
            setSyncError('Sincronizzazione fallita: alcuni dati non sono stati inviati al server.');
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
