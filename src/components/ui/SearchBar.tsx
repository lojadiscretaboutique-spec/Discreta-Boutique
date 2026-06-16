import { Search, Loader2, ArrowRight, X, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { useTheme } from '../../contexts/ThemeContext';
import { Product } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
}

export function SearchBar({ className, placeholder = "O que você busca hoje?" }: SearchBarProps) {
  const { currentTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Dynamic autocomplete states
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load categories mapping dictionary once on mount
  useEffect(() => {
    async function loadCategoriesMap() {
      try {
        const cats = await categoryService.listCategories();
        // Translate categories to lightweight mapping dictionary
        const catMap: Record<string, string> = {};
        cats.forEach(c => {
          catMap[c.id] = c.name;
        });
        setCategoriesMap(catMap);
      } catch (e) {
        console.warn("Failed loading categories mapping inside SearchBar:", e);
      }
    }
    loadCategoriesMap();
  }, []);

  // Debounced effect to query Firestore for autocomplete suggestions
  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Query active products from Firestore limited to 8 items using searchTerms array
        const q = query(
          collection(db, 'products'),
          where('searchTerms', 'array-contains', term),
          limit(8)
        );
        const snap = await getDocs(q);
        const activeProds = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.active !== false);

        setSuggestions(activeProds.slice(0, 5));
      } catch (e) {
        console.warn("Firestore search suggestions index warning or missing index, falling back to simple redirection:", e);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Handle outside layout clicks to blur/close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    
    // Support ESC key to dismiss suggestions gracefully
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Input change only triggers state updates
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    
    // Navigate immediately to Catalog search route
    navigate(`/catalogo?q=${encodeURIComponent(term.trim())}`);
    
    setTimeout(() => {
      setLoading(false);
      setSearch(term);
      setIsFocused(false);
    }, 450);
  };

  const handleSelectProduct = (p: Product) => {
    setSearch('');
    setSuggestions([]);
    setIsFocused(false);
    navigate(`/produto/${p.seo?.slug || p.id}?id=${p.id}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(search);
  };

  // Automated design dynamic layout variables mapping
  const isDarkBackground = currentTheme.backgroundTextColor === '#ffffff';
  const textSecondaryColor = isDarkBackground ? '#a0a0a0' : '#4b5563';
  const borderColor = isDarkBackground ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

  return (
    <div ref={containerRef} className={cn("w-full max-w-2xl mx-auto px-4 relative z-[100]", className)}>
      <form onSubmit={onSubmit} className="relative">
        
        {/* Integrated Premium Container Single Piece */}
        <div 
          className="relative flex items-center overflow-hidden transition-all duration-300 rounded-full border-transparent group pr-1.5 pl-4"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            boxShadow: 'none',
            height: '56px'
          }}
        >
          {/* Magnifying Glass Indicator - Premium Highlight on Click */}
          <div 
            className="transition-colors duration-300 mr-2 flex items-center justify-center"
            style={{ color: isFocused ? currentTheme.primaryColor : textSecondaryColor }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={20} />}
          </div>

          {/* Campo de Pesquisa */}
          <input 
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:border-none focus:ring-0 focus:ring-offset-0 py-4 px-1 font-bold text-lg md:text-xl h-full placeholder:text-sm md:placeholder:text-base placeholder:font-medium appearance-none"
            style={{ 
              color: currentTheme.backgroundTextColor
            }}
          />

          {/* Action Buttons Container */}
          <div className="flex items-center gap-1.5 h-full py-1.5">
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                className="p-2 transition-colors rounded-full hover:bg-white/10"
                style={{ color: textSecondaryColor }}
                title="Limpar busca"
              >
                <X size={18} />
              </button>
            )}
            
            {/* Custom Theme Master Action Button */}
            <button
              type="submit"
              className="h-full px-5 md:px-7 rounded-full text-[10px] md:text-xs font-black uppercase tracking-[2px] transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 shadow-md select-none"
              style={{
                backgroundColor: currentTheme.buttonColor,
                color: currentTheme.buttonTextColor
              }}
            >
              <span className="hidden sm:inline">Pesquisar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Premium Dropdown with Framer Motion Layout animations */}
        <AnimatePresence>
          {isFocused && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute left-4 right-4 mt-3 rounded-2xl overflow-hidden shadow-2xl border z-[999] backdrop-blur-md"
              style={{
                backgroundColor: currentTheme.cardColor,
                borderColor: borderColor,
                color: currentTheme.cardTextColor
              }}
            >
              {/* Header */}
              <div 
                className="p-3 border-b flex items-center justify-between text-[9px] font-black uppercase tracking-[2.5px]" 
                style={{ borderColor, color: textSecondaryColor }}
              >
                <span>Sugestões de Produtos</span>
                <span className="flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500 animate-pulse" /> 
                  {suggestions.length} Encontrado{suggestions.length > 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Rows */}
              <div className="max-h-[360px] overflow-y-auto divide-y" style={{ borderColor }}>
                {suggestions.map((p) => {
                  const mainImage = p.images?.find(img => img.isMain)?.url || p.images?.[0]?.url;
                  const catName = categoriesMap[p.categoryId] || 'Estilo';
                  const finalPrice = p.promoPrice || p.price;
                  const hasPromo = !!p.promoPrice;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-4 p-3 hover:bg-neutral-500/10 cursor-pointer transition-all duration-200 select-none group"
                      onClick={() => handleSelectProduct(p)}
                      style={{ borderBottom: `1px solid ${borderColor}` }}
                    >
                      {/* Product Visual Photo */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800/20 flex-shrink-0 border border-white/5 flex items-center justify-center relative">
                        {mainImage ? (
                          <img 
                            src={mainImage} 
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Search size={16} style={{ color: textSecondaryColor }} />
                        )}
                        {hasPromo && (
                          <div 
                            className="absolute top-0 left-0 text-[7px] font-black px-1 py-0.5 rounded-br uppercase tracking-wider shadow"
                            style={{ 
                              backgroundColor: currentTheme.primaryColor,
                              color: currentTheme.primaryTextColor
                            }}
                          >
                            Promo
                          </div>
                        )}
                      </div>

                      {/* Product Meta Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span 
                            className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" 
                            style={{ 
                              backgroundColor: currentTheme.backgroundColor, 
                              color: currentTheme.backgroundTextColor 
                            }}
                          >
                            {catName}
                          </span>
                          <span className="text-[8px] font-mono tracking-wider" style={{ color: textSecondaryColor }}>
                            SKU {p.sku}
                          </span>
                        </div>
                        <h4 
                          className="text-xs md:text-sm font-black truncate transition-colors duration-200"
                          style={{ color: currentTheme.cardTextColor }}
                        >
                          {p.name}
                        </h4>
                      </div>

                      {/* Product Costings */}
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs md:text-sm font-bold block" style={{ color: currentTheme.primaryColor }}>
                          {formatCurrency(finalPrice)}
                        </span>
                        {hasPromo && (
                          <span className="text-[9px] line-through block" style={{ color: textSecondaryColor }}>
                            {formatCurrency(p.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View All Matches Banner */}
              <div 
                className="p-3 bg-neutral-500/5 text-center border-t text-[11px] font-black uppercase tracking-widest" 
                style={{ borderColor }}
              >
                <button
                  type="button"
                  onClick={() => handleSearch(search)}
                  className="w-full text-center py-1 transition-colors hover:scale-[1.01] flex items-center justify-center gap-2"
                  style={{ color: currentTheme.primaryColor }}
                >
                  <span>Ver classificação geral de "{search}"</span> 
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </form>
    </div>
  );
}
