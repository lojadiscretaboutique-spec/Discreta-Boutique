import { Search, Loader2, ArrowRight, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
}

export function SearchBar({ className, placeholder = "O que você busca hoje?" }: SearchBarProps) {
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close search focus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    
    // Immediate navigation
    navigate(`/catalogo?q=${encodeURIComponent(term.trim())}`);
    
    // Reset state after navigation
    setTimeout(() => {
      setLoading(false);
      setSearch(term);
      setIsFocused(false);
    }, 500);
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
      </form>
    </div>
  );
}
