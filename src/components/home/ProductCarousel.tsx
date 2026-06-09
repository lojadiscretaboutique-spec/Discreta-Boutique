import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Product } from '../../services/productService';
import { ProductItemCard, SkeletonCard } from '../ui/ProductItemCard';

export function ProductCarousel({ 
  title, 
  subtitle,
  emoji,
  alignment = 'left',
  products, 
  link, 
  showButton = true,
  buttonText = 'Ver tudo',
  themeColor,
  themeBg,
  layout,
  loading 
}: { 
  title: string, 
  subtitle?: string,
  emoji?: string,
  alignment?: 'left' | 'center' | 'right',
  products: Product[], 
  link: string, 
  showButton?: boolean,
  buttonText?: string,
  themeColor?: string,
  themeBg?: string,
  layout?: any,
  loading?: boolean 
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      if (scrollLeft + clientWidth >= scrollWidth - 300 && visibleCount < products.length) {
        setVisibleCount(prev => Math.min(prev + 12, products.length));
      }
    }
  }, [visibleCount, products.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
      if (direction === 'right') setVisibleCount(prev => Math.min(prev + 6, products.length));
    }
  };

  const displayProducts = loading ? Array(4).fill(0) : products.slice(0, visibleCount);

  const isVertical = layout?.orientation === 'vertical';
  const isCompactStyle = layout?.style === 'compact';

  const gridColsClass = isVertical 
    ? cn(
        "grid gap-4",
        layout?.mobileCols === 1 ? "grid-cols-1" : "grid-cols-2",
        layout?.colsDesktop === 1 && "md:grid-cols-1 lg:grid-cols-1",
        layout?.colsDesktop === 2 && "md:grid-cols-2 lg:grid-cols-2",
        layout?.colsDesktop === 3 && "md:grid-cols-3 lg:grid-cols-3",
        (!layout?.colsDesktop || layout?.colsDesktop === 4) && "md:grid-cols-3 lg:grid-cols-4"
      )
    : "flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 no-scrollbar";

  return (
    <section 
      style={themeBg ? { backgroundColor: themeBg } : undefined}
      className={cn(
        "relative group/carousel py-6 md:py-8 transition-all duration-500 w-full"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 w-full">
        <div className={cn(
          "flex flex-col md:flex-row justify-between mb-8 border-b border-zinc-900 pb-4 gap-4",
          alignment === 'center' ? 'items-center text-center' : alignment === 'right' ? 'items-end text-right' : 'items-start md:items-end'
        )}>
          <div className={cn(
            "flex flex-col",
            alignment === 'center' ? 'items-center' : alignment === 'right' ? 'items-end' : 'items-start'
          )}>
            <div className="flex items-center gap-3">
              {emoji && <span className="text-xl md:text-2xl">{emoji}</span>}
              <h2 
                style={{ color: themeColor || undefined }}
                className={cn(
                  "font-black uppercase tracking-tighter italic",
                  isCompactStyle ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                )}
              >
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="text-xs text-zinc-400 mt-1 max-w-md">{subtitle}</p>
            )}
          </div>

          {!loading && showButton && (
            <Link 
              to={link} 
              className="text-[10px] font-black text-zinc-400 uppercase tracking-[3px] hover:text-red-500 hover:scale-105 active:scale-95 transition-all text-shadow-glow"
            >
              {buttonText}
            </Link>
          )}
        </div>

        <div className="relative">
          <div 
            ref={scrollRef}
            onScroll={isVertical ? undefined : handleScroll}
            className={gridColsClass}
            style={isVertical ? undefined : { scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {loading ? (
               displayProducts.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(isVertical ? "w-full" : "min-w-[42%] sm:min-w-[240px] snap-start h-full")}
                >
                  <SkeletonCard />
                </div>
              ))
            ) : displayProducts.length > 0 ? (
              displayProducts.map((product: any, idx: number) => (
                <div 
                  key={product.id} 
                  className={cn(isVertical ? "w-full" : "min-w-[42%] sm:min-w-[240px] snap-start h-full")}
                >
                  <ProductItemCard product={product} isPriority={idx < 2} />
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-zinc-600 font-bold uppercase w-full">Nenhum produto encontrado nesta seção</div>
            )}
          </div>

          {!isVertical && !loading && products.length > 0 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className="absolute left-2 top-[40%] -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all z-10 md:left-[-20px] md:group-hover/carousel:opacity-100 md:opacity-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => scroll('right')}
                className="absolute right-2 top-[40%] -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all z-10 md:right-[-20px] md:group-hover/carousel:opacity-100 md:opacity-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
