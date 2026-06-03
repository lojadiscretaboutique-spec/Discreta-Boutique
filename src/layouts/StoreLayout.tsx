import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Menu, X, LayoutDashboard } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { categoryService, Category } from '../services/categoryService';
import { SearchBar } from '../components/ui/SearchBar';
import { useAuthStore } from '../store/authStore';
import { PopupOverlay } from '../components/PopupOverlay';

import { Truck } from 'lucide-react';
import { usePromotion } from '../contexts/PromotionContext';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { hexToRgb } from '../utils/themeUtils';

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
  const { currentTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const { user } = useAuthStore();
  const [appVersion, setAppVersion] = useState('1.1.0');

  const location = useLocation();
  const { activePromotions } = usePromotion();

  const hasGlobalFreeShipping = activePromotions.some(
    p => p.active && p.type === 'free_shipping' && p.scope === 'all'
  );

  // Sync variables to root for full dynamic style updates
  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    root.style.setProperty('--primary-color', currentTheme.primaryColor);
    root.style.setProperty('--secondary-color', currentTheme.secondaryColor);
    root.style.setProperty('--button-color', currentTheme.buttonColor);
    root.style.setProperty('--background-color', currentTheme.backgroundColor);
    root.style.setProperty('--card-color', currentTheme.cardColor);
    root.style.setProperty('--text-color', currentTheme.backgroundTextColor);
    root.style.setProperty('--link-color', currentTheme.linkColor);
    root.style.setProperty('--highlight-color', currentTheme.highlightColor);

    root.style.setProperty('--primary-color-text', currentTheme.primaryTextColor);
    root.style.setProperty('--secondary-color-text', currentTheme.secondaryTextColor);
    root.style.setProperty('--button-color-text', currentTheme.buttonTextColor);
    root.style.setProperty('--card-color-text', currentTheme.cardTextColor);
    root.style.setProperty('--link-color-text', currentTheme.linkTextColor);
    root.style.setProperty('--highlight-color-text', currentTheme.highlightTextColor);

    // Map to legacy index.css classes for transparent compatibility
    root.style.setProperty('--color-primary', currentTheme.primaryColor);
    root.style.setProperty('--color-bg', currentTheme.backgroundColor);
    root.style.setProperty('--color-surface', currentTheme.cardColor);
    root.style.setProperty('--color-text-main', currentTheme.backgroundTextColor);

    const rgb = hexToRgb(currentTheme.primaryColor);
    root.style.setProperty('--color-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
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

  const isDarkBackground = currentTheme.backgroundTextColor === '#ffffff';
  const textSecondaryColor = isDarkBackground ? '#a0a0a0' : '#4b5563';
  const borderColor = isDarkBackground ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const themeStyles = {
    '--primary-color': currentTheme.primaryColor,
    '--secondary-color': currentTheme.secondaryColor,
    '--background-color': currentTheme.backgroundColor,
    '--surface-color': currentTheme.cardColor,
    '--card-color': currentTheme.cardColor,
    '--button-color': currentTheme.buttonColor,
    '--button-text-color': currentTheme.buttonTextColor,
    '--border-color': borderColor,
    '--text-color': currentTheme.backgroundTextColor,
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">
          
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 -ml-2 transition-colors duration-300"
              style={{ color: textSecondaryColor }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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

          {/* Logo Text Only - Absolute Centered */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <span 
              className="text-2xl font-black tracking-tighter uppercase italic transition-colors duration-500 animate-pulse"
              style={{ color: currentTheme.primaryColor }}
            >
              DISCRETA
            </span>
          </Link>

          {/* Actions */}
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
              className="p-2 relative transition-colors duration-300 hover:opacity-80"
              style={{ color: textSecondaryColor }}
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span 
                  className="absolute top-0 right-0 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2"
                  style={{
                    backgroundColor: currentTheme.primaryColor,
                    color: currentTheme.primaryTextColor,
                    borderColor: currentTheme.cardColor
                  }}
                >
                  {cartCount}
                </span>
              )}
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
             <SearchBar placeholder="O que você busca hoje? Encontre prazer..." />
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
        "flex-1 flex flex-col",
        (location.pathname === '/' || location.pathname === '/catalogo') 
          ? (hasGlobalFreeShipping ? "pt-[190px] sm:pt-[200px] md:pt-[210px]" : "pt-[150px] sm:pt-[160px] md:pt-[170px]") 
          : "pt-24 md:pt-28"
      )}>
        <Outlet />
      </main>

      {/* Floating Admin Button */}
      {user && (
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
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
            <div className="max-w-md">
              <div className="flex items-center gap-3 mb-4">
                 <h2 
                   className="text-2xl font-black tracking-tighter italic transition-colors duration-300"
                   style={{ color: currentTheme.primaryColor }}
                 >
                   DISCRETA BOUTIQUE
                 </h2>
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
                <Link to="/politica-de-privacidade" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Privacidade</Link>
                <Link to="/politica-de-troca" className="text-sm transition-colors hover:opacity-80" style={{ color: textSecondaryColor }}>Trocas e Devoluções</Link>
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
        </footer>
      )}
    </div>
  );
}

