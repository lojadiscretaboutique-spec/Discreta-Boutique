import { Search, Loader2, ArrowRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from './input';
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
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions as user types - faster debounce for "instant" feel
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length >= 1) {
        const results = await aiFrontendService.getSearchSuggestions(search.trim());
        setSuggestions(results);
        if (results.length > 0) setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [search]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setShowSuggestions(false);
    
    // Smooth transition
    setTimeout(() => {
      navigate(`/catalogo?q=${encodeURIComponent(term.trim())}`);
      setLoading(false);
      setSearch(term);
    }, 150);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(search);
  };

  return (
    <div ref={containerRef} className={cn("w-full max-w-4xl mx-auto px-4 relative z-[100]", className)}>
      <form 
        onSubmit={onSubmit}
        className="relative"
      >
        <div className={cn(
          "relative flex items-center bg-transparent rounded-lg overflow-hidden transition-all duration-300 border",
          isFocused ? "border-zinc-500 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "border-zinc-800"
        )}>
          {/* Icon */}
          <div className="pl-5 text-zinc-500">
            {loading ? <Loader2 size={16} className="animate-spin text-red-500" /> : <Search size={16} />}
          </div>

          {/* Input */}
          <Input 
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none text-zinc-100 py-6 px-4 focus-visible:ring-0 placeholder:text-zinc-600 font-light text-base md:text-lg h-12 md:h-14"
          />

          {/* Action Button - Minimalist */}
          {search.trim() && (
            <button
              type="submit"
              className="pr-5 text-red-500 hover:text-red-400 transition-colors"
            >
              <ArrowRight size={18} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown - Dark & Clean */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden z-[110]"
            >
              <div className="py-2">
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
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
