import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

console.log("[BOOT-TRACE] main.tsx carregado");

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("[BOOT-ERROR] Elemento root não encontrado");
    return;
  }

  try {
    console.log("[BOOT-TRACE] Carregando App.tsx dinamicamente...");
    // Dynamic import to prevent hoisting and catch any evaluation-level crashes
    let module;
    try {
      module = await import('./App.tsx');
    } catch (importErr: any) {
      console.warn("[BOOT-WARN] Falha inicial ao importar App.tsx:", importErr?.message || importErr);
      const isFetchOrChunkError =
        importErr?.message?.includes('Failed to fetch dynamically imported module') ||
        importErr?.message?.includes('dynamically imported module') ||
        importErr?.name === 'ChunkLoadError' ||
        importErr?.name === 'TypeError';

      const RECOVERY_KEY = 'discreta_boot_recovery_attempted';
      const alreadyAttempted = sessionStorage.getItem(RECOVERY_KEY);

      if (isFetchOrChunkError && !alreadyAttempted) {
        sessionStorage.setItem(RECOVERY_KEY, 'true');
        console.info("[BOOT-RECOVERY] Limpando caches e service worker para recuperação automática...");
        try {
          if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((k) => caches.delete(k)));
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
        } catch (cleanErr) {
          console.warn("[BOOT-RECOVERY] Erro na limpeza preventiva:", cleanErr);
        }

        // Tentar novamente com cache-busting
        try {
          module = await import(/* @vite-ignore */ `./App.tsx?t=${Date.now()}`);
          console.info("[BOOT-RECOVERY] App.tsx carregado com sucesso na recuperação!");
        } catch (retryErr) {
          console.warn("[BOOT-RECOVERY] Segunda tentativa falhou, recarregando a página...", retryErr);
          window.location.reload();
          return;
        }
      } else {
        throw importErr;
      }
    }

    const App = module.default;
    
    console.log("[BOOT-TRACE] App.tsx carregado. Montando React...");
    sessionStorage.removeItem('discreta_boot_recovery_attempted');
    
    createRoot(rootElement).render(
      <StrictMode>
        <BrowserRouter>
          <FeedbackProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </FeedbackProvider>
        </BrowserRouter>
      </StrictMode>
    );
    console.log("[BOOT-TRACE] React montado com sucesso");
  } catch (error: any) {
    console.error("[BOOT-ERROR] Falha crítica durante o carregamento/montagem:", error);
    
    // Removendo splash screen se estiver ativa para exibir o erro
    const splash = document.getElementById('initial-splash');
    if (splash) {
      splash.remove();
    }
    
    // Exibindo erro de forma legível na tela em vez de uma tela preta
    rootElement.innerHTML = `
      <div style="
        padding: 24px;
        background-color: #0c0a09;
        color: #f5f5f4;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
      ">
        <div style="
          max-width: 800px;
          width: 100%;
          background: #1c1917;
          border: 1px solid #ef4444;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        ">
          <h1 style="color: #ef4444; margin-top: 0; font-size: 20px; font-weight: 600;">
            🚨 Falha Crítica de Inicialização (Safe Bootstrap)
          </h1>
          <p style="margin: 12px 0; font-size: 14px; line-height: 1.5; color: #a8a29e;">
            A aplicação travou durante a avaliação do módulo principal ou de suas dependências estáticas. Isso geralmente ocorre devido a um erro de importação, variáveis de ambiente ausentes ou problemas de sintaxe em tempo de execução.
          </p>
          <div style="
            background: #0c0a09;
            padding: 16px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 13px;
            color: #ef4444;
            border-left: 4px solid #ef4444;
            margin-top: 16px;
          ">
            <strong>Erro:</strong> ${error?.message || error || 'Erro desconhecido'}
          </div>
          <pre style="
            background: #0c0a09;
            padding: 16px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 11px;
            color: #78716c;
            margin-top: 12px;
            white-space: pre-wrap;
            word-break: break-all;
          ">${error?.stack || 'Nenhum stack trace disponível'}</pre>
          <div style="margin-top: 20px; text-align: right;">
            <button onclick="window.location.reload(true)" style="
              background-color: #ef4444;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              font-weight: 500;
              cursor: pointer;
              font-size: 13px;
            ">Recarregar Página</button>
          </div>
        </div>
      </div>
    `;
  }
}

bootstrap();


