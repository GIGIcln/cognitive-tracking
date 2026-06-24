import React from 'react'
import { registerSW } from 'virtual:pwa-register';
import { OfflineContextProvider } from './context/OfflineContext';
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

registerSW({
  onNeedRefresh() {
    console.log('[PWA] Nuova versione disponibile, aggiornamento automatico in corso...');
  },
  onOfflineReady() {
    console.log('[PWA] App pronta per l\'uso offline.');
  },
});

// createBrowserRouter provides DataRouterContext required by useBlocker
const router = createBrowserRouter([{ path: '*', element: <App /> }])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <OfflineContextProvider>
        <RouterProvider router={router} />
      </OfflineContextProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
