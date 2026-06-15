import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
})

let isRedirecting = false

// ── Interceptor 1: inietta JWT ────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor 2: gestione 401 (sessione scaduta) ───────────────────────────
// NON interviene sull'endpoint di login stesso: lì un 401 significa
// "credenziali errate" e va gestito dal componente LoginPage.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isLoginEndpoint = url.includes('/auth/login')

    if (error.response?.status === 401 && !isLoginEndpoint) {
      if (isRedirecting) return Promise.reject(error)
      isRedirecting = true
      localStorage.removeItem('ct_token')
      window.location.replace('/login')
      setTimeout(() => { isRedirecting = false }, 1000)
    }
    return Promise.reject(error)
  }
)

// ── Interceptor 3: offline queue + errori di rete ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Errore HTTP con risposta (4xx, 5xx): gestione standard dal componente
    if (error.response) {
      return Promise.reject(error)
    }

    const method = error.config?.method?.toUpperCase()
    const url = error.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/')

    // Metodi in scrittura non-auth: accoda offline per retry automatico
    if (error.config && ['POST', 'PUT', 'PATCH'].includes(method) && !isAuthEndpoint) {
      try {
        const { addToQueue } = await import('../utils/offlineQueue')
        let body = {}
        try { body = JSON.parse(error.config.data || '{}') } catch {}

        await addToQueue({
          url: error.config.url,
          method,
          body,
          label: `${method} ${url} — ${new Date().toLocaleTimeString('it-IT')}`,
        })

        const offlineError = new Error(
          'Operazione salvata offline. Verrà sincronizzata al ripristino della connessione.'
        )
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
      )
      friendlyError.isOffline = true
      return Promise.reject(friendlyError)
    }

    return Promise.reject(error)
  }
)

export default api
