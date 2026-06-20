import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FeedbackProvider } from './contexts/FeedbackContext';
import './index.css';
import App from './App.tsx';

// Unregister active production service workers in development mode to prevent dev asset interception
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[Discreta Dev] Active service worker unregistered in development mode.');
            window.location.reload();
          }
        });
      }
    });
  }
}

// -------------------------------------------------------------------------
// RECURSO DE AUTOPURGA E BYPASS DE CACHE CASO O BUNDLE NO SERVIDOR TENHA MUDADO
// -------------------------------------------------------------------------

// Função utilitária para limpar CacheStorage silenciosamente antes do reload para forçar novos chunks
const clearAppCachesAndReload = () => {
  localStorage.removeItem('app_code_version');
  localStorage.removeItem('app_data_version');
  
  if ('caches' in window) {
    caches.keys().then((keys) => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).catch((err) => {
      console.warn('[Discreta Cache] Erro limpando caches:', err);
    }).finally(() => {
      window.location.reload();
    });
  } else {
    window.location.reload();
  }
};

// Captura erro nativo do Vite quando tenta carregar um chunk inexistente/antigo (ex. após novo deploy)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Discreta Cache] Erro de pré-carregamento do Vite (chunk desatualizado). Limpando versão e reiniciando...');
  event.preventDefault();
  clearAppCachesAndReload();
});

// Captura rejeições de Promises de imports dinâmicos que falharam por rota inexistente ou hash desatualizada
window.addEventListener('unhandledrejection', (event) => {
  const errorMsg = String(event.reason?.message || event.reason || '');
  if (
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('chunk') ||
    errorMsg.includes('Loading chunk') ||
    errorMsg.includes('Importing a module script failed') ||
    errorMsg.includes('MIME type')
  ) {
    console.warn('[Discreta Cache] Falha de import dinâmico interceptada:', errorMsg);
    event.preventDefault();
    const lastReload = sessionStorage.getItem('last_chunk_reload');
    const now = Date.now();
    // Throttle de 10 segundos para impedir reload em loop infinito se o cliente estiver 100% offline
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last_chunk_reload', String(now));
      clearAppCachesAndReload();
    }
  }
});

// Captura erros gerais de elementos de script/link ou strings contendo falha de módulo dinâmico
window.addEventListener('error', (event) => {
  const errorMsg = event.message || '';
  const target = event.target as HTMLElement;
  const isTagFailure = target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK');

  if (
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('chunk') ||
    errorMsg.includes('Loading chunk') ||
    errorMsg.includes('Importing a module script failed') ||
    isTagFailure
  ) {
    console.warn('[Discreta Cache] Erro no carregamento de tag ou recurso físico:', errorMsg);
    const lastReload = sessionStorage.getItem('last_chunk_reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last_chunk_reload', String(now));
      clearAppCachesAndReload();
    }
  }
}, true); // useCapture para capturar falha de carregamento de recursos estáticos

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>
);
