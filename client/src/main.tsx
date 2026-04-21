import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registra o service worker apenas em produção
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((error) => {
          console.error('Falha ao registrar service worker:', error);
        });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } else {
      // Em desenvolvimento: desregistra qualquer service worker ativo e limpa caches
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
  });
}
