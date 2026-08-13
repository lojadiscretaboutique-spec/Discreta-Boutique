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
    const module = await import('./App.tsx');
    const App = module.default;
    
    console.log("[BOOT-TRACE] App.tsx carregado. Montando React...");
    
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


