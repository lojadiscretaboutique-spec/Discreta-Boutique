import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Search, Menu, X, Download } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { categoryService, Category } from '../services/categoryService';

// @ts-ignore
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function StoreLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const location = useLocation();

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if not already installed (just in case)
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Install App Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-900 border-b border-zinc-800"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.webp" alt="Discreta App" className="w-10 h-10 rounded-md object-cover border border-zinc-800" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-tight">Instale o App Discreta</span>
                  <span className="text-xs text-zinc-400">Mais rápido, seguro e discreto.</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleInstallApp}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-md transition-colors flex items-center gap-2 uppercase tracking-wide"
                >
                  <Download size={14} />
                  Baixar App
                </button>
                <button 
                  onClick={() => setShowInstallBanner(false)}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-black/80 backdrop-blur-md text-white fixed top-0 w-full z-50 border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">
          
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-red-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest">
              <Link to="/" className="hover:text-red-500 transition-colors">Início</Link>
              <Link to="/catalogo" className="hover:text-red-500 transition-colors">Produtos</Link>
              <Link to="/area-cliente" className="hover:text-red-500 transition-colors">Área do Cliente</Link>
            </nav>
          </div>

          {/* Logo Text Only - Absolute Centered */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <span className="text-xl font-black tracking-tighter text-white uppercase italic">DISCRETA</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link to="/catalogo" className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
              <Search size={20} />
            </Link>
            <Link to="/carrinho" className="p-2 text-zinc-400 hover:text-red-500 relative transition-colors">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-zinc-900 bg-black absolute w-full left-0 overflow-hidden shadow-2xl"
            >
              <div className="p-6 flex flex-col space-y-6">
                <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black uppercase tracking-tighter hover:text-red-600 transition-colors">Início</Link>
                <Link to="/catalogo" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black uppercase tracking-tighter hover:text-red-600 transition-colors">Catálogo Completo</Link>
                <Link to="/area-cliente" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black uppercase tracking-tighter hover:text-red-600 transition-colors">Área do Cliente</Link>
                <div className="pt-4 flex gap-4 text-zinc-500">
                   <span className="text-xs font-bold uppercase tracking-widest">Sigilo absoluto</span>
                   <span className="text-xs font-bold uppercase tracking-widest">Entrega Discreta</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 text-white py-16 px-4 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-4">
               <h2 className="text-2xl font-black tracking-tighter italic">DISCRETA BOUTIQUE</h2>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Sua boutique especializada em momentos inesquecíveis. Produtos selecionados com rigor, 
              garantindo máxima qualidade, prazer e segurança.
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div className="flex flex-col space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[3px] text-zinc-300 mb-2">Shopping</h3>
              {categories.map(cat => (
                <Link key={cat.id} to={`/catalogo?categoria=${cat.id}`} className="text-zinc-500 hover:text-red-500 text-sm transition-colors">
                  {cat.name}
                </Link>
              ))}
            </div>
            <div className="flex flex-col space-y-3 min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-[3px] text-zinc-300 mb-2">Institucional</h3>
              <Link to="/quem-somos" className="text-zinc-500 hover:text-red-500 text-sm transition-colors">Quem Somos</Link>
              <Link to="/politica-de-privacidade" className="text-zinc-500 hover:text-red-500 text-sm transition-colors">Privacidade</Link>
              <Link to="/politica-de-troca" className="text-zinc-500 hover:text-red-500 text-sm transition-colors">Trocas e Devoluções</Link>
              <Link to="/lgpd" className="text-zinc-500 hover:text-red-500 text-sm transition-colors">LGPD</Link>
              <h3 className="text-xs font-bold uppercase tracking-[3px] text-zinc-300 mb-2 mt-4">Suporte</h3>
              <a href="mailto:contato@discretaboutique.com.br" className="text-zinc-500 hover:text-red-500 text-sm transition-colors break-all">contato@discretaboutique.com.br</a>
              <a href="https://wa.me/5588992340317" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-red-500 text-sm transition-colors">WhatsApp</a>
              <Link to="/admin" className="text-zinc-500 hover:text-red-500 text-sm transition-colors mt-2">Painel Admin</Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center md:text-left">
           <p className="whitespace-normal break-words max-w-[300px] md:max-w-none px-4 md:px-0">© 2026 Discreta Boutique. Todos os direitos reservados. CNPJ: 37.633.308/0001-84</p>
           <div className="flex flex-wrap justify-center gap-4 px-4">
              <span className="whitespace-nowrap">Proibido para menores de 18 anos</span>
              <span className="whitespace-nowrap">Sigilo garantido</span>
           </div>
        </div>
      </footer>
    </div>
  );
}

