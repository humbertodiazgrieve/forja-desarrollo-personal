import React from 'react';
import ReactDOM from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App';
import './styles.css';

function registerServiceWorker() {
  if (
    typeof window === 'undefined' ||
    isTauri() ||
    !/^https?:$/.test(window.location.protocol) ||
    !('serviceWorker' in navigator)
  )
    return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('Forja: no se pudo registrar el service worker.', error);
    });
  };

  if (document.readyState === 'loading') window.addEventListener('load', register, { once: true });
  else register();
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
