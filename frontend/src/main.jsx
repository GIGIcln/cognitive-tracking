import React from 'react'
import { registerSW } from 'virtual:pwa-register';
import { OfflineContextProvider } from './context/OfflineContext';
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

registerSW({
  onNeedRefresh() {
    console.log('[PWA] Nuova versione disponibile, aggiornamento automatico in corso...');
  },
  onOfflineReady() {
    console.log('[PWA] App pronta per l\'uso offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OfflineContextProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </OfflineContextProvider>
  </React.StrictMode>,
)
