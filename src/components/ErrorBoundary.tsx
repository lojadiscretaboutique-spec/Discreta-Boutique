import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, ChevronRight } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const message = error?.message || 'Erro desconhecido';
    if (message === 'Script error.') {
      console.warn('[Discreta ErrorBoundary] Erro mascarado pelo navegador. Verifique imports dinâmicos, scripts externos ou CORS.', errorInfo?.componentStack);
    } else {
      console.warn('[Discreta ErrorBoundary]', message, errorInfo?.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black px-6 text-center select-none overflow-hidden">
          <div className="relative max-w-md w-full flex flex-col items-center">
            <div className="mb-8 relative">
              <span className="text-4xl md:text-5xl font-black italic tracking-[-0.05em] text-white uppercase block">
                DISCRETA
              </span>
            </div>
            <p className="text-sm text-white mb-8">Estamos preparando sua experiência...</p>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="bg-white text-black rounded-xl px-6 py-3 font-bold text-sm"
            >
              Voltar para o início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
