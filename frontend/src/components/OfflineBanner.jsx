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

  if (isSyncing) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
        <svg className="h-4 w-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span>Sincronizzazione in corso ({pendingCount})</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
        <span>{pendingCount} operazion{pendingCount === 1 ? 'e' : 'i'} in attesa</span>
        <button
          onClick={syncNow}
          className="ml-auto flex-shrink-0 rounded px-2 py-0.5 text-xs bg-amber-500/20 hover:bg-amber-500/40 transition-colors">
          Riprova
        </button>
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
