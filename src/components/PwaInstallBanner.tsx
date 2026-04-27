import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useState, useEffect } from 'react';

export function PwaInstallBanner() {
  const { isInstallable, isInstalled, installApp } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show after a small delay to not overwhelm the user
    // Only show if it's installable and not already installed
    if (isInstallable && !isInstalled) {
      const hasDismissed = sessionStorage.getItem('pwa-dismissed');
      if (!hasDismissed) {
        const timer = setTimeout(() => setIsVisible(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isInstalled]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[60] p-3 px-4 sm:px-6"
        >
          <div className="max-w-4xl mx-auto bg-zinc-950/95 backdrop-blur-xl border border-red-600/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(220,38,38,0.1)] overflow-hidden">
            <div className="flex items-center gap-4 p-4 py-3">
              {/* App Icon Mockup */}
              <div className="hidden sm:flex w-12 h-12 bg-red-600 rounded-xl items-center justify-center shadow-lg shadow-red-600/20">
                <Smartphone className="text-white" size={24} />
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider italic leading-none mb-1">
                  Discreta Boutique
                </h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest leading-none">
                  Instale nosso App para uma experiência exclusiva
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={installApp}
                  className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-red-600/20"
                >
                  <Download size={14} />
                  <span>Instalar</span>
                </button>
                
                <button
                  onClick={handleDismiss}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {/* Animated background accent */}
            <motion.div 
              className="absolute bottom-0 left-0 h-[2px] bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
