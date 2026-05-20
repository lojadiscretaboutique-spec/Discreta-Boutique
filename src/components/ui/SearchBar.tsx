import { Search, Loader2, ArrowRight, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { aiFrontendService } from '../../services/aiFrontendService';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
}

export function SearchBar({ className, placeholder = "O que você busca hoje?" }: SearchBarProps) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions as user types - faster debounce for "instant" feel
  useEffect(() => {
    if (isNavigating) return;

    const timer = setTimeout(async () => {
      if (search.trim().length >= 1 && isFocused) {
        setLoading(true);
        try {
          const results = await aiFrontendService.getSearchSuggestions(search.trim());
          setSuggestions(results.suggestions || []);
          setProductResults(results.products || []);
          if ((results.suggestions?.length || 0) > 0 || (results.products?.length || 0) > 0) {
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setSuggestions([]);
        setProductResults([]);
        setShowSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search, isFocused, isNavigating]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    setIsNavigating(true);
    setLoading(true);
    setShowSuggestions(false);
    
    // Immediate navigation
    navigate(`/catalogo?q=${encodeURIComponent(term.trim())}`);
    
    // After navigation, we allow suggestions again if user refocuses
    // But we give it a tiny bit of time for the page change to settle
    setTimeout(() => {
      setIsNavigating(false);
      setLoading(false);
      setSearch(term);
      setIsFocused(false);
    }, 500);
  };

  const goToProduct = (slug: string) => {
    setShowSuggestions(false);
    navigate(`/produto/${slug}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(search);
  };

  return (
    <div ref={containerRef} className={cn("w-full max-w-2xl mx-auto px-4 relative z-[100]", className)}>
      <form 
        onSubmit={onSubmit}
        className="relative shadow-2xl"
      >
        <div className={cn(
          "relative flex items-center bg-zinc-950/90 backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-500 border-2",
          isFocused ? "border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.2)]" : "border-zinc-700 hover:border-zinc-600"
        )}>
          {/* Icon */}
          <div className="pl-5 text-zinc-500 group-focus-within:text-red-500 transition-colors">
            {loading ? <Loader2 size={18} className="animate-spin text-red-500" /> : <Search size={18} />}
          </div>

          {/* Input Area - Pure text, no background or inner borders */}
          <input 
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none text-zinc-100 py-4 px-3 font-medium text-sm md:text-base h-12 md:h-14 placeholder:text-zinc-600 appearance-none selection:bg-red-500/30"
          />

          {/* Action Buttons Container */}
          <div className="flex items-center gap-1 pr-3">
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSuggestions([]);
                  setProductResults([]);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-full hover:bg-white/5"
                title="Limpar busca"
              >
                <X size={16} />
              </button>
            )}
            
            {search.trim() && (
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-red-900/20"
              >
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions Dropdown - Dark & Clean */}
        <AnimatePresence>
          {showSuggestions && (suggestions.length > 0 || productResults.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-[110]"
            >
              <div className="flex flex-col md:flex-row max-h-[70vh] overflow-y-auto">
                {/* Text Suggestions */}
                {suggestions.length > 0 && (
                   <div className={cn(
                     "flex-1 py-2",
                     productResults.length > 0 ? "border-b md:border-b-0 md:border-r border-zinc-800" : ""
                   )}>
                     <div className="px-5 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Sugestões</div>
                     {suggestions.map((suggestion, index) => (
                       <button
                         key={index}
                         type="button"
                         onClick={() => handleSearch(suggestion)}
                         className="w-full text-left px-5 py-3 hover:bg-zinc-900 flex items-center gap-4 text-zinc-300 transition-colors group"
                       >
                         <Search size={14} className="text-zinc-700 group-hover:text-red-500 transition-colors" />
                         <span className="text-sm md:text-base font-normal">{suggestion}</span>
                       </button>
                     ))}
                   </div>
                )}

                {/* Product Results */}
                {productResults.length > 0 && (
                   <div className="flex-[1.5] py-2">
                     <div className="px-5 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Produtos Encontrados</div>
                     <div className="flex flex-col gap-1 px-1">
                        {productResults.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => goToProduct(product.slug || product.id)}
                            className="w-full text-left p-3 hover:bg-zinc-900 flex items-center gap-4 text-zinc-300 transition-colors group rounded-md"
                          >
                            <div className="w-12 h-12 rounded bg-zinc-900 flex-shrink-0 overflow-hidden border border-zinc-800">
                               <img 
                                 src={product.imageUrl || '/logo.png'} 
                                 alt={product.name} 
                                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                 referrerPolicy="no-referrer"
                               />
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="text-sm font-medium text-zinc-100 truncate">{product.name}</div>
                               <div className="text-xs text-red-500 font-bold mt-0.5">
                                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.promoPrice || product.price)}
                               </div>
                            </div>
                            <ArrowRight size={14} className="text-zinc-700 opacity-0 group-hover:opacity-100 group-hover:text-red-500 transition-all -translate-x-2 group-hover:translate-x-0" />
                          </button>
                        ))}
                     </div>
                     <button
                       type="button"
                       onClick={() => handleSearch(search)}
                       className="w-full mt-2 py-3 text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-900"
                     >
                       Ver todos os resultados para "{search}"
                     </button>
                   </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
