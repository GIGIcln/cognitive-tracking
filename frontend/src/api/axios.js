import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
})

let isRedirecting = false

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (isRedirecting) return Promise.reject(error)
      isRedirecting = true
      localStorage.removeItem('ct_token')
      window.location.replace('/login')
      setTimeout(() => { isRedirecting = false }, 1000)
    }
    return Promise.reject(error)
  }
)

// Interceptor offline queue — aggiungere DOPO gli interceptor esistenti
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Errore HTTP normale (4xx, 5xx): gestione standard
    if (error.response) {
      return Promise.reject(error);
    }

    // Errore di rete (no risposta) su metodi in scrittura: accoda offline
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/') || url.includes('auth/login');
    if (!error.response && error.config && ['POST', 'PUT', 'PATCH'].includes(method) && !isAuthEndpoint) {
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

    if (!error.response && url.includes('/auth/login')) {
      const friendlyError = new Error(
        'Sei offline. Connettiti a Internet per accedere.'
      );
      friendlyError.isOffline = true;
      return Promise.reject(friendlyError);
    }

    return Promise.reject(error);
  }
);

export default api
