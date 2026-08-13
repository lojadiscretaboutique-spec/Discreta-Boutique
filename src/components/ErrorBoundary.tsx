import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
}

function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  const name = String(error?.name || '');
  const message = String(error?.message || '');

  return (
    name === 'ChunkLoadError' ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('failed to load module script') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    /assets\/.+\.js/i.test(message)
  );
}

function removeInitialSplash() {
  try {
    const splash = document.getElementById('initial-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => {
        if (splash.parentNode) splash.remove();
      }, 300);
    }
    document.body.style.overflow = 'auto';
  } catch (e) {
    // Ignore DOM errors
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    removeInitialSplash();

    const isChunk = isChunkLoadError(error);
    const hasSW = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

    // Detailed diagnostic logging to console (without sensitive data)
    console.error('[Discreta ErrorBoundary] Diagnostic Log:', {
      errorName: error?.name || 'Error',
      errorMessage: error?.message || 'Erro desconhecido',
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      currentUrl: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isChunkError: isChunk,
      hasActiveServiceWorker: hasSW,
    });

    this.setState({ errorInfo });

    // Handle chunk / dynamic import recovery automatically once per session
    if (isChunk) {
      const RECOVERY_KEY = 'discreta_chunk_recovery_attempted';
      const alreadyAttempted = sessionStorage.getItem(RECOVERY_KEY);

      if (!alreadyAttempted) {
        console.warn('[Discreta ErrorBoundary] Chunk load error detected. Attempting single automatic recovery...');
        sessionStorage.setItem(RECOVERY_KEY, 'true');

        // Clear code cache in CacheStorage if available
        if (typeof caches !== 'undefined') {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .catch((err) => {
              console.warn('[Discreta ErrorBoundary] Erro ao limpar caches:', err);
            })
            .finally(() => {
              window.location.reload();
            });
        } else {
          window.location.reload();
        }
      } else {
        console.warn('[Discreta ErrorBoundary] Chunk recovery already attempted in this session. Rendering fallback UI to prevent loop.');
      }
    }
  }

  handleReset = () => {
    removeInitialSplash();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    });
  };

  handleReload = () => {
    removeInitialSplash();
    window.location.reload();
  };

  handleGoHome = () => {
    removeInitialSplash();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      removeInitialSplash();

      const { error, errorInfo, isChunkError } = this.state;
      const isDev = import.meta.env.DEV;
      const errorCode = `ERR-${(error?.name || 'UNK').substring(0, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black px-6 text-center select-none overflow-y-auto py-12">
          <div className="relative max-w-lg w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-800/40 flex items-center justify-center mb-6 text-red-500 shadow-lg">
              <AlertOctagon size={36} />
            </div>

            <span className="text-2xl font-black italic tracking-[-0.03em] text-white uppercase block mb-1">
              DISCRETA BOUTIQUE
            </span>

            <h2 className="text-base font-bold text-zinc-200 mb-2">
              {isChunkError
                ? 'Falha de Carregamento de Recursos'
                : 'Ocorreu uma falha temporária no sistema'}
            </h2>

            <p className="text-xs text-zinc-400 mb-6 leading-relaxed max-w-md">
              {isChunkError
                ? 'Uma nova versão da aplicação foi disponibilizada ou houve uma interrupção na conexão ao carregar componentes.'
                : 'Lamentamos pelo inconveniente. A aplicação encontrou um erro inesperado e precisa ser reiniciada.'}
            </p>

            {/* Diagnostic Code in Production or Stack Trace in Dev */}
            {isDev ? (
              <div className="w-full text-left bg-black/80 border border-zinc-800 rounded-xl p-4 mb-6 overflow-x-auto max-h-48 text-[11px] font-mono text-red-400 select-text">
                <p className="font-bold text-zinc-300 mb-1">{error?.name}: {error?.message}</p>
                {error?.stack && <pre className="whitespace-pre-wrap text-[10px] text-zinc-400 mt-2">{error.stack}</pre>}
                {errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap text-[10px] text-zinc-500 mt-2 border-t border-zinc-800 pt-2">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-3 py-1.5 mb-6 text-[11px] font-mono text-zinc-500">
                Código do diagnóstico: <span className="text-zinc-300 font-semibold">{errorCode}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-4 py-3 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={15} />
                Tentar novamente
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-3 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-900/20"
              >
                <RefreshCw size={15} />
                Recarregar aplicação
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl px-4 py-3 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={15} />
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

