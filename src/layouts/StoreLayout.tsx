import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { categoryService, Category } from '../services/categoryService';
import { SearchBar } from '../components/ui/SearchBar';
import { useAuthStore } from '../store/authStore';
import { PopupOverlay } from '../components/PopupOverlay';
import { FloatingLivePlayer } from '../components/FloatingLivePlayer';
import { useActiveLiveShop } from '../hooks/useActiveLiveShop';
import { useUIStore } from '../store/uiStore';

import { Truck } from 'lucide-react';
import { usePromotion } from '../contexts/PromotionContext';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTypography } from '../contexts/TypographyContext';
import { hexToRgb } from '../utils/themeUtils';

import { BottomNav } from '../components/store/BottomNav';

function FreeShippingBar() {
  const { activePromotions } = usePromotion();

  const hasGlobalFreeShipping = activePromotions.some(
    p => p.active && p.type === 'free_shipping' && p.scope === 'all'
  );

  if (!hasGlobalFreeShipping) return null;

  return (
    <div className="bg-emerald-600 text-white w-full border-b border-emerald-500/20">
      <div className="py-2.5 px-4 flex items-center justify-center gap-3 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">
        <Truck size={14} className="animate-pulse" />
        <span className="drop-shadow-md">Frete Grátis em Toda a Loja - Aproveite!</span>
        <Truck size={14} className="animate-pulse" />
      </div>
    </div>
  );
}

export function StoreLayout() {
  const themeContext = useTheme();
  const currentTheme = themeContext.currentTheme;
  const settingsContext = useSettings();
  const typographyContext = useTypography();

  const isBackgroundLoading = themeContext.isUsingFallback || settingsContext.isUsingFallback || typographyContext.isUsingFallback;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const { user, isAdmin } = useAuthStore();
  const [appVersion, setAppVersion] = useState('1.1.0');

  const location = useLocation();
  const isAuthOrClientArea = ['/cadastro', '/login', '/ativar-conta'].includes(location.pathname) || location.pathname.startsWith('/area-cliente');
  const { activePromotions } = usePromotion();

  const hasGlobalFreeShipping = activePromotions.some(
    p => p.active && p.type === 'free_shipping' && p.scope === 'all'
  );

  // Active Live Shop synchronization with floating mini-player
  const { activeLive } = useActiveLiveShop();
  const { 
    setFloatingLiveId, 
    setFloatingLiveUrl, 
    setFloatingLiveTitle, 
    floatingLiveUrl 
  } = useUIStore();

  useEffect(() => {
    if (activeLive && activeLive.status === 'ao_vivo' && activeLive.settings?.enableFloatingPlayer) {
      const isDismissed = sessionStorage.getItem(`dismissed_live_${activeLive.id}`) === 'true';
      if (!isDismissed && location.pathname !== '/live' && !floatingLiveUrl) {
        setFloatingLiveId(activeLive.id);
        import('../services/liveShopService').then(({ liveShopService }) => {
          const embedUrl = liveShopService.getEmbedUrl(activeLive.streamingUrl);
          setFloatingLiveUrl(embedUrl);
          setFloatingLiveTitle(activeLive.title);
        }).catch(err => {
          console.error("Failed to load live shop services", err);
        });
      }
    } else {
      if (floatingLiveUrl) {
        setFloatingLiveUrl(null);
        setFloatingLiveId(null);
      }
    }
  }, [activeLive, location.pathname, floatingLiveUrl]);

  // Sync variables to root for full dynamic style updates
  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    const setSafe = (prop: string, val: string | undefined, fallback: string) => {
      if (val && String(val) !== 'undefined' && String(val) !== 'null' && String(val) !== 'NaN') {
        root.style.setProperty(prop, val);
      } else if (fallback) {
        root.style.setProperty(prop, fallback);
      }
    };

    setSafe('--primary-color', currentTheme.primaryColor, '#D32F2F');
    setSafe('--secondary-color', currentTheme.secondaryColor, '#0A0A0A');
    setSafe('--button-color', currentTheme.buttonColor, currentTheme.primaryColor || '#D32F2F');
    setSafe('--background-color', currentTheme.backgroundColor, '#0A0A0A');
    setSafe('--card-color', currentTheme.cardColor, '#161616');
    setSafe('--text-color', currentTheme.backgroundTextColor, '#ffffff');
    setSafe('--link-color', currentTheme.linkColor, currentTheme.primaryColor || '#D32F2F');
    setSafe('--highlight-color', currentTheme.highlightColor, currentTheme.primaryColor || '#D32F2F');

    setSafe('--primary-color-text', currentTheme.primaryTextColor, '#ffffff');
    setSafe('--secondary-color-text', currentTheme.secondaryTextColor, '#ffffff');
    setSafe('--button-color-text', currentTheme.buttonTextColor, '#ffffff');
    setSafe('--card-color-text', currentTheme.cardTextColor, '#ffffff');
    setSafe('--link-color-text', currentTheme.linkTextColor, '#ffffff');
    setSafe('--highlight-color-text', currentTheme.highlightTextColor, '#ffffff');

    // Map to legacy index.css classes for transparent compatibility
    setSafe('--color-primary', currentTheme.primaryColor, '#D32F2F');
    setSafe('--color-bg', currentTheme.backgroundColor, '#0A0A0A');
    setSafe('--color-surface', currentTheme.cardColor, '#161616');
    setSafe('--color-text-main', currentTheme.backgroundTextColor, '#ffffff');

    if (currentTheme.primaryColor) {
      const rgb = hexToRgb(currentTheme.primaryColor);
      root.style.setProperty('--color-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
    } else {
      root.style.setProperty('--color-primary-glow', `rgba(211, 47, 47, 0.25)`);
    }
  }, [currentTheme]);

  useEffect(() => {
    const version = localStorage.getItem('app_code_version') || '1.1.0';
    setAppVersion(version);
  }, []);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await categoryService.listCategories();
        // optionally filter to only show level 0 or active categories
        setCategories(cats.filter(c => c.isActive && c.level === 0));
      } catch (err) {
        console.error("Failed to load categories for footer", err);
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Affiliate Traffic & Click Tracking System
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const cleanedRef = ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (cleanedRef) {
        localStorage.setItem('discreta_ref', cleanedRef);
        // Track click asynchronously to preserve fast page loading speed
        import('../modules/afiliados/services/affiliateService')
          .then(({ affiliateService }) => {
            affiliateService.trackClick(cleanedRef);
          })
          .catch(err => console.error("Error loading affiliate tracking inside router:", err));
      }
    }
  }, [location.search]);

  const isDarkBackground = (currentTheme.backgroundTextColor || '#ffffff').toLowerCase() === '#ffffff';
  const textSecondaryColor = isDarkBackground ? '#a0a0a0' : '#4b5563';
  const borderColor = isDarkBackground ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const themeStyles = {
    '--primary-color': currentTheme.primaryColor || '#D32F2F',
    '--secondary-color': currentTheme.secondaryColor || '#0A0A0A',
    '--background-color': currentTheme.backgroundColor || '#0A0A0A',
    '--surface-color': currentTheme.cardColor || '#161616',
    '--card-color': currentTheme.cardColor || '#161616',
    '--button-color': currentTheme.buttonColor || '#D32F2F',
    '--button-text-color': currentTheme.buttonTextColor || '#ffffff',
    '--border-color': borderColor,
    '--text-color': currentTheme.backgroundTextColor || '#ffffff',
    '--text-secondary-color': textSecondaryColor,
  } as React.CSSProperties;

  return (
    <div className="storefront-theme-container dark min-h-screen flex flex-col font-sans relative" style={themeStyles}>
      <PopupOverlay />
      {/* Header */}
      <header 
        className="fixed top-0 w-full z-50 border-b backdrop-blur-md transition-colors duration-300"
        style={{
          backgroundColor: currentTheme.cardColor,
          color: currentTheme.cardTextColor,
          borderColor: borderColor
        }}
      >
        <FreeShippingBar />
        <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between relative transition-all duration-300">
          
          <div className="flex items-center">
            {/* Mobile Menu Button - Prominent Hamburger styled like the reference image */}
            <button 
              className="md:hidden p-2 -ml-2 transition-colors duration-300"
              style={{ color: currentTheme.backgroundTextColor || '#ffffff' }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? (
                <X size={32} className="stroke-[2px]" />
              ) : (
                <Menu size={32} className="stroke-[2.5px]" />
              )}
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8 text-[11px] font-bold uppercase tracking-[3px]">
              <Link 
                to="/" 
                className="transition-colors duration-300 hover:opacity-80"
                style={{ color: currentTheme.cardTextColor }}
              >
                Início
              </Link>
              <Link 
                to="/catalogo" 
                className="transition-colors duration-300 hover:opacity-80"
                style={{ color: currentTheme.cardTextColor }}
              >
                Produtos
              </Link>
            </nav>
          </div>

          {/* Logo - Center Aligned - Sized exactly like the display image */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center py-1 px-3 z-10 w-full max-w-[210px] sm:max-w-[240px] md:max-w-[290px] select-none transition-all duration-300">
            {(() => {
              const lh = currentTheme.branding?.logoHorizontal;
              const url = typeof lh === 'string' ? lh : lh?.url;
              if (url) {
                return (
                  <img 
                    src={url} 
                    alt={currentTheme.branding?.appName || "Discreta Boutique"} 
                    className="w-auto h-auto min-h-[50px] max-h-[60px] md:min-h-[64px] md:max-h-[74px] object-contain drop-shadow-sm transition-all duration-300 hover:opacity-90"
                  />
                );
              }
              // Fallback to text logo with dynamic colors from admin
              return (
                <span 
                  className="brand-logo-text text-2xl md:text-3.5xl font-black tracking-tighter uppercase italic transition-colors duration-500 line-clamp-1"
                  style={{ color: currentTheme.primaryColor }}
                >
                  {currentTheme.branding?.shortName || "DISCRETA"}
                </span>
              );
            })()}
          </Link>

          {/* Actions - Featuring the premium heart detail shopping bag with always-on badge */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link 
              to="/area-cliente" 
              className="p-2 flex items-center transition-colors duration-300 hover:opacity-80"
              style={{ color: textSecondaryColor }}
            >
               <span className="hidden md:inline mr-2 text-[10px] font-bold uppercase tracking-widest">Conta</span>
            </Link>
            <Link 
              to="/carrinho" 
              className="p-2 relative transition-colors duration-300 hover:opacity-80 flex items-center justify-center"
              style={{ color: currentTheme.primaryColor }}
              title="Carrinho de Compras"
            >
              {/* Premium Heart Shopping Bag SVG exactly matching the design of reference brand */}
              <svg 
                viewBox="0 0 24 24" 
                width="31" 
                height="31" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="transition-colors duration-300"
              >
                {/* Bag handle */}
                <path d="M16 10V7a4 4 0 0 0-8 0v3" />
                {/* Bag body */}
                <rect x="5" y="9" width="14" height="12" rx="1.5" ry="1.5" />
                {/* Custom Heart in the center */}
                <path d="M12 17.2s-2.2-1.5-2.2-2.7a1.1 1.1 0 0 1 1.9-0.8 1.1 1.1 0 0 1 1.9 0.8c0 1.2-2.2 2.7-2.2 2.7z" fill="none" strokeWidth="1.3" />
              </svg>
              
              {/* Badge showing item count, matching the color and placement of reference image */}
              <span 
                className="absolute -bottom-0.5 -right-0.5 text-[10.5px] font-bold w-[20px] h-[20px] rounded-full flex items-center justify-center text-white bg-[#dc3545] border-2 shadow-sm select-none"
                style={{ borderColor: currentTheme.cardColor }}
              >
                {cartCount}
              </span>
            </Link>
          </div>
        </div>

        {/* Global Search Bar - Premium & Seamless */}
        {(location.pathname === '/' || location.pathname === '/catalogo') && (
          <div 
            className="py-4 border-b transition-colors duration-300"
            style={{ 
              backgroundColor: currentTheme.backgroundColor, 
              borderColor: borderColor 
            }}
          >
             <SearchBar placeholder="Digite o que você procura" />
          </div>
        )}

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t absolute w-full left-0 overflow-hidden shadow-2xl"
              style={{
                backgroundColor: currentTheme.cardColor,
                borderColor: borderColor
              }}
            >
              <div className="p-6 flex flex-col space-y-6">
                <Link 
                  to="/" 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-2xl font-black uppercase tracking-tighter transition-colors"
                  style={{ color: currentTheme.cardTextColor }}
                >
                  Início
                </Link>
                <Link 
                  to="/catalogo" 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-2xl font-black uppercase tracking-tighter transition-colors"
                  style={{ color: currentTheme.cardTextColor }}
                >
                  Catálogo Completo
                </Link>
                <Link 
                  to="/area-cliente" 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-2xl font-black uppercase tracking-tighter transition-colors"
                  style={{ color: currentTheme.cardTextColor }}
                >
                  Área do Cliente
                </Link>
                <div className="pt-4 flex gap-4" style={{ color: textSecondaryColor }}>
                   <span className="text-xs font-bold uppercase tracking-widest">Sigilo absoluto</span>
                   <span className="text-xs font-bold uppercase tracking-widest">Entrega Discreta</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col pb-16 md:pb-0",
        (location.pathname === '/' || location.pathname === '/catalogo') 
          ? (hasGlobalFreeShipping ? "pt-[204px] sm:pt-[214px] md:pt-[236px]" : "pt-[168px] sm:pt-[178px] md:pt-[196px]") 
          : "pt-28 md:pt-36"
      )}>
        <Outlet />
      </main>

      <BottomNav />

      {/* Floating Live Player & Floating Admin Button */}
      <FloatingLivePlayer />

      {/* Background loading indicator */}
      {isBackgroundLoading && (
        <div className="fixed bottom-4 left-4 z-50 bg-black/85 text-white text-[10px] sm:text-xs py-2 px-4 rounded-full border border-neutral-800 shadow-2xl flex items-center gap-2 select-none pointer-events-none animate-pulse">
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0"></span>
          <span className="font-medium text-neutral-300">Carregando alguns dados em segundo plano...</span>
        </div>
      )}

      {/* Floating Admin Button */}
      {user && isAdmin && (
        <Link 
          to="/admin" 
          className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105"
        >
          <LayoutDashboard size={16} />
          Painel Admin
        </Link>
      )}

      {/* Footer */}
      {!['/carrinho', '/sucesso', '/afiliados'].includes(location.pathname) && (
        <footer 
          className="transition-colors duration-300 py-16 px-4 border-t"
          style={{
            backgroundColor: currentTheme.cardColor,
            color: currentTheme.cardTextColor,
            borderColor: borderColor
          }}
        >
          {/* Only display institutional and categories links on the home page (/) */}
          {location.pathname === '/' && (
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 mb-12">
              <div className="max-w-md">
                <div className="flex items-center gap-3 mb-6">
                   {(() => {
                      const lh = currentTheme.branding?.logoHorizontal;
                      const url = typeof lh === 'string' ? lh : lh?.url;
                      if (url) {
                        return (
                          <img 
                            src={url} 
                            alt={currentTheme.branding?.appName || "Discreta Boutique"} 
                            className="w-auto max-h-[48px] object-contain drop-shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                          />
                        );
                      }
                      return (
                        <h2 
                          className="brand-logo-text text-2xl font-black tracking-tighter italic transition-colors duration-300"
                          style={{ color: currentTheme.primaryColor }}
                        >
                          {currentTheme.branding?.appName || "DISCRETA BOUTIQUE"}
                        </h2>
                      );
                   })()}
                </div>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ color: textSecondaryColor }}
                >
                  Sua boutique especializada em momentos inesquecíveis. Produtos selecionados com rigor, 
                  garantindo máxima qualidade, prazer e segurança.
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                <div className="flex flex-col space-y-3">
                  <h3 
                    className="text-xs font-bold uppercase tracking-[3px] mb-2"
                    style={{ color: currentTheme.primaryColor }}
                  >
                    Shopping
                  </h3>
                  {categories.map(cat => (
                    <Link 
                      key={cat.id} 
                      to={`/catalogo?categoria=${cat.slug || cat.id}`} 
                      className="text-sm transition-colors hover:opacity-80"
                      style={{ color: textSecondaryColor }}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-col space-y-3 min-w-0">
                  <h3 
                    className="text-xs font-bold uppercase tracking-[3px] mb-2"
                    style={{ color: currentTheme.primaryColor }}
                  >
                    Institucional
                  </h3>
                  <Link to="/quem-somos" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Quem Somos</Link>
                  <Link to="/blog" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Blog</Link>
                  <Link to="/politica-de-privacidade" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Privacidade</Link>
                  <Link to="/trocas-e-devolucoes" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Trocas e Devoluções</Link>
                  <Link to="/entrega-discreta" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Entrega Discreta</Link>
                  <Link to="/contato" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Contato</Link>
                  <Link to="/lgpd" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>LGPD</Link>
                  <Link to="/afiliados" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Afiliados</Link>
                  <h3 
                    className="text-xs font-bold uppercase tracking-[3px] mb-2 mt-4"
                    style={{ color: currentTheme.primaryColor }}
                  >
                    Suporte
                  </h3>
                  <a href="mailto:contato@discretaboutique.com.br" className="text-sm transition-colors break-all hover:opacity-80" style={{ color: textSecondaryColor }}>contato@discretaboutique.com.br</a>
                  <a href="https://wa.me/5588992340317" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>WhatsApp</a>
                  <Link to="/admin" className="text-sm transition-colors hover:opacity-80 font-bold" style={{ color: currentTheme.primaryColor }}>Painel Admin</Link>
                </div>
              </div>
            </div>
          )}
          {!isAuthOrClientArea && (
            <div 
              className="max-w-7xl mx-auto mt-16 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-center md:text-left"
              style={{ borderColor: borderColor }}
            >
               <p className="whitespace-normal break-words max-w-[300px] md:max-w-none px-4 md:px-0" style={{ color: textSecondaryColor }}>
                 © 2026 Discreta Boutique. Todos os direitos reservados. CNPJ: 37.633.308/0001-84
               </p>
               <div className="flex flex-wrap justify-center gap-4 px-4" style={{ color: textSecondaryColor }}>
                  <span className="whitespace-nowrap">Proibido para menores de 18 anos</span>
                  <span className="whitespace-nowrap">Sigilo garantido</span>
                  <span 
                    className="whitespace-nowrap border py-0.5 px-2 rounded text-[8px] font-mono font-medium tracking-normal lowercase"
                    style={{ 
                      backgroundColor: currentTheme.backgroundColor, 
                      borderColor: borderColor,
                      color: textSecondaryColor 
                    }}
                  >
                    v{appVersion}
                  </span>
               </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

