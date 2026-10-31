import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// App installabile: registra il service worker (solo nella versione pubblicata)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js'); });
}
// Android/Chrome: tiene da parte la richiesta di installazione per il pulsante "Installa ora"
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { installPrompt?: Event }).installPrompt = e;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
