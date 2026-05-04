import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useState, useEffect } from 'react';

export function PwaInstallBanner() {
  const { isInstallable, isInstalled, installApp, isIos } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [showIosInstruction, setShowIosInstruction] = useState(false);

  useEffect(() => {
    // Show after a small delay to not overwhelm the user
    // Only show if it's installable or iOS, and not already installed
    if ((isInstallable || isIos) && !isInstalled) {
      const hasDismissed = sessionStorage.getItem('pwa-dismissed');
      if (!hasDismissed) {
        const timer = setTimeout(() => setIsVisible(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isInstalled, isIos]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-dismissed', 'true');
  };

  const handleInstallClick = () => {
    if (isInstallable) {
      installApp();
    } else if (isIos) {
      setShowIosInstruction(true);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] p-3 px-4 sm:px-6"
        >
          <div className="max-w-4xl mx-auto bg-zinc-950/95 backdrop-blur-2xl border-2 border-red-600/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_20px_rgba(220,38,38,0.3)] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 py-3 relative z-10">
              <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                {/* App Icon */}
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex-shrink-0 items-center justify-center shadow-lg shadow-red-600/20 overflow-hidden border border-red-600/20 p-1">
                  <img src="/logo.webp" alt="Discreta" className="w-full h-full object-cover rounded-xl" />
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider italic leading-none mb-1.5 flex items-center gap-2">
                    App Discreta <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-sm font-bold not-italic">OFICIAL</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-300 font-bold uppercase tracking-wide leading-tight">
                    Instale o app e tenha acesso mais rápido e ofertas exclusivas!
                  </p>
                </div>
              </div>

              {!showIosInstruction ? (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                  <button
                    onClick={handleInstallClick}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center gap-2 flex-1 sm:flex-none justify-center active:scale-95 shadow-lg shadow-red-600/30 border border-red-500/50"
                  >
                    <Download size={16} />
                    <span>Instalar Agora</span>
                  </button>
                  
                  <button
                    onClick={handleDismiss}
                    className="p-3 bg-zinc-900/50 sm:bg-transparent rounded-xl text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="bg-red-950/50 border border-red-600/30 p-3 rounded-xl w-full sm:w-auto mt-2 sm:mt-0 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-3">
                    <button onClick={handleDismiss} className="p-1 text-zinc-400 hover:text-white transition-colors absolute top-2 right-2 sm:hidden">
                      <X size={16} />
                    </button>
                    <div className="flex-1">
                      <p className="text-xs text-red-200 font-medium leading-tight">
                        No iPhone, toque no ícone <Share size={12} className="inline mx-1 text-zinc-300" /> 
                        <br/>
                        e selecione <strong className="text-white">"Adicionar à Tela de Início"</strong>
                      </p>
                    </div>
                    <button
                      onClick={handleDismiss}
                      className="hidden sm:block p-2 text-zinc-400 hover:text-white transition-colors ml-2"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Animated background accent */}
            <motion.div 
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
