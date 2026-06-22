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
    console.error('Erro capturado no ErrorBoundary do Sistema Discreta:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Safe retry navigation: transition towards safe-zone
    window.location.hash = '';
    // If the error was a dynamic import chunk load failed error, we could try going to home
    if (this.state.error?.message?.includes('dynamically imported module') || this.state.error?.message?.includes('Failed to fetch')) {
      console.log('Recuperando de falha de carregamento de chunk. Direcionando ao painel principal.');
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      console.log('Renderizando componente: ErrorBoundary');
      
      const isChunkError = this.state.error?.message?.includes('dynamically imported module') || 
                          this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black px-6 text-center select-none overflow-hidden">
          {/* Fundo de brilho neon pulsante */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-red-950/35 to-transparent animate-pulse pointer-events-none"></div>

          <div className="relative max-w-md w-full flex flex-col items-center">
            {/* Logo da Discreta em destaque elegante */}
            <div className="mb-8 relative">
              <span className="text-4xl md:text-5xl font-black italic tracking-[-0.05em] text-white uppercase block">
                DISCRETA
              </span>
              <span className="text-[9px] font-black tracking-[7px] uppercase text-zinc-500 block mt-1">
                Sedução & Sigilo
              </span>
              {/* Barra vermelha neon horizontal */}
              <div className="h-0.5 bg-red-650 mt-4 mx-auto w-32 rounded-full shadow-[0_0_15px_#dc2626]" />
            </div>

            {/* Ícone e Container com estilo premium */}
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-3xl p-8 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-md mb-8 w-full border-t-red-900/30">
              <div className="h-12 w-12 rounded-2xl bg-red-950/30 border border-red-900/50 flex items-center justify-center mx-auto mb-5 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.15)] animate-bounce">
                <AlertOctagon className="h-6 w-6" />
              </div>

              <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-wider mb-2">
                Conexão Interrompida
              </h2>
              
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto mb-4">
                {isChunkError 
                  ? 'A sincronização com um dos nossos módulos seguros falhou. Isso acontece normalmente após uma atualização ou devido à conexão instável.'
                  : 'Ocorreu um desvio inesperado na inicialização da página. Suas informações continuam salvas e seguras.'}
              </p>

              {/* Informações técnicas de erro amigáveis e elegantes em fonte mono */}
              <div className="bg-zinc-900/40 rounded-xl px-4 py-2.5 text-[10px] font-mono text-zinc-500 border border-zinc-900/80 text-left truncate max-w-xs mx-auto">
                <span className="text-red-700/80 mr-1.5">&#9654;</span>
                {this.state.error?.message || 'Erro de Execução Desconhecido'}
              </div>
            </div>

            {/* Ações elegantes */}
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-red-650 to-red-750 text-white rounded-2xl px-6 py-4 text-sm font-bold shadow-[0_0_20px_rgba(220,38,38,0.25)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border border-red-500/15"
              >
                <RefreshCw className="h-4 w-4 animate-spin-reverse" />
                <span>Tentar Novamente</span>
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-600 uppercase tracking-[3px] mt-10">
              Discreta Boutique &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
