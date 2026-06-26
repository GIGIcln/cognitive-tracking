import axios from 'axios'

interface OfflineError extends Error {
  isOfflineQueued?: boolean
  isOffline?: boolean
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  withCredentials: true,
})

let isRedirecting = false

// ── Interceptor: gestione 401 (sessione scaduta / cookie non valido) ──────────
// NON interviene su /auth/login (credenziali errate → gestito dal componente)
// né su /auth/me (401 = non loggato → normale al caricamento iniziale).
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as { config?: { url?: string }; response?: { status?: number } }
    const url = axiosError.config?.url ?? ''
    const isAuthInitEndpoint = url.includes('/auth/login') || url.includes('/auth/me')

    if (axiosError.response?.status === 401 && !isAuthInitEndpoint) {
      if (isRedirecting) return Promise.reject(error)
      isRedirecting = true
      window.location.replace('/login')
      setTimeout(() => { isRedirecting = false }, 1000)
    }
    return Promise.reject(error)
  }
)

// ── Interceptor 3: offline queue + errori di rete ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: unknown; config?: { url?: string; method?: string; data?: string } }

    // Errore HTTP con risposta (4xx, 5xx): gestione standard dal componente
    if (axiosError.response) {
      return Promise.reject(error)
    }

    const method = axiosError.config?.method?.toUpperCase() ?? ''
    const url = axiosError.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/')

    // Metodi in scrittura non-auth: accoda offline per retry automatico
    if (axiosError.config && ['POST', 'PUT', 'PATCH'].includes(method) && !isAuthEndpoint) {
      try {
        const { addToQueue } = await import('../utils/offlineQueue')
        let body: unknown = {}
        try { body = JSON.parse(axiosError.config.data ?? '{}') } catch {}

        await addToQueue({
          url,
          method,
          body,
          label: `${method} ${url} — ${new Date().toLocaleTimeString('it-IT')}`,
        })

        const offlineError = new Error(
          'Operazione salvata offline. Verrà sincronizzata al ripristino della connessione.'
        ) as OfflineError
        offlineError.isOfflineQueued = true
        return Promise.reject(offlineError)
      } catch (queueError) {
        console.error('[OfflineQueue] Errore durante l\'accodamento:', queueError)
      }
    }

    // Errore di rete sull'endpoint di login: messaggio contestuale
    if (url.includes('/auth/login')) {
      const isOnline = navigator.onLine
      const friendlyError = new Error(
        isOnline
          ? 'Impossibile raggiungere il server. Assicurati che il backend sia in esecuzione.'
          : 'Sei offline. Connettiti a Internet per accedere.'
      ) as OfflineError
      friendlyError.isOffline = true
      return Promise.reject(friendlyError)
    }

    return Promise.reject(error)
  }
)

export default api
