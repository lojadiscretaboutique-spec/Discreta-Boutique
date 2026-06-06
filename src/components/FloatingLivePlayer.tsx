import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '../store/uiStore';
import { X, Maximize2, Minimize2, VolumeX, Volume2, Radio, ExternalLink } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function FloatingLivePlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    floatingLiveUrl,
    floatingLiveTitle,
    floatingLiveIsMuted,
    floatingLiveIsMinimized,
    setFloatingLiveUrl,
    setFloatingLiveIsMuted,
    setFloatingLiveIsMinimized,
  } = useUIStore();

  // If there's no url OR we are on the /live page, do not render the floating player
  if (!floatingLiveUrl || location.pathname === '/live') return null;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFloatingLiveUrl(null);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFloatingLiveIsMuted(!floatingLiveIsMuted);
  };

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFloatingLiveIsMinimized(!floatingLiveIsMinimized);
  };

  const handleGoToLive = () => {
    navigate('/live');
  };

  // Convert muted state to YouTube embed URL parameter if needed
  const getStreamUrlWithMuted = (url: string) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      if (floatingLiveIsMuted) {
        urlObj.searchParams.set('mute', '1');
      } else {
        urlObj.searchParams.set('mute', '0');
      }
      return urlObj.toString();
    } catch {
      // Fallback manual append
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}mute=${floatingLiveIsMuted ? '1' : '0'}`;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        id="floating-live-player-container"
        className="fixed bottom-6 right-6 z-40 bg-zinc-950 border border-red-900/40 rounded-xl overflow-hidden shadow-2xl transition-all"
        style={{
          width: floatingLiveIsMinimized ? '180px' : '280px',
          boxShadow: '0 10px 40px -10px rgba(220, 38, 38, 0.3)',
        }}
      >
        {/* Title Bar */}
        <div className="bg-zinc-900/90 p-2.5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider animate-pulse whitespace-nowrap overflow-hidden text-ellipsis">
              AO VIVO: {floatingLiveTitle || 'Boutique Discreta'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleMute}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
              title={floatingLiveIsMuted ? 'Ativar Áudio' : 'Mutar'}
            >
              {floatingLiveIsMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleToggleMinimize}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
              title={floatingLiveIsMinimized ? 'Maximizar' : 'Minimizar'}
            >
              {floatingLiveIsMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-zinc-850 rounded text-zinc-400 hover:text-red-500 transition-colors"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video Player Display Container */}
        {!floatingLiveIsMinimized && (
          <div className="relative aspect-video bg-black" id="floating-live-iframe-wrap">
            <iframe
              src={getStreamUrlWithMuted(floatingLiveUrl)}
              title="Discreta Live Stream Stream"
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
            {/* Click overlap to open page */}
            <div 
              onClick={handleGoToLive}
              className="absolute inset-0 bg-transparent cursor-pointer flex items-center justify-center group"
            >
              <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}

        {/* Footer Link Button */}
        <div 
          onClick={handleGoToLive}
          className="p-2.5 bg-red-950/20 text-center hover:bg-red-900/30 border-t border-zinc-900 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 transition-all select-none"
        >
          <span>Ir para a Transmissão</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
export default FloatingLivePlayer;
