
import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { Product } from '../../services/productService';
import { openaiOfferSorting } from '../../services/openaiOfferSorting';
import { ProductItemCard } from '../ui/ProductItemCard';

interface ImperdiveisCarouselProps {
  products: Product[];
  loading?: boolean;
}

export function ImperdiveisCarousel({ products: initialProducts, loading: initialLoading }: ImperdiveisCarouselProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleCount, setVisibleCount] = useState(4); // Carrega 4 inicialmente (conforme pedido de carregar pouco)
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function rank() {
      if (initialLoading) return;
      setLoading(true);
      try {
        // A IA apenas ordena, não remove
        const ranked = await openaiOfferSorting.rankOffers(initialProducts);
        setAllProducts(ranked);
      } catch (err) {
        console.error('[OFFERS_RANK_ERROR]', err);
        setAllProducts(initialProducts);
      } finally {
        setLoading(false);
      }
    }
    rank();
  }, [initialProducts, initialLoading]);

  // Lazy load items on scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      // If we're 300px from the end, load more items so it feels infinite
      if (scrollLeft + clientWidth >= scrollWidth - 300) {
        if (visibleCount < allProducts.length) {
          setVisibleCount(prev => Math.min(prev + 12, allProducts.length));
        }
      }
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  // Only show section when loading is complete and we have products
  if (loading || initialLoading || allProducts.length === 0) return null;

  const visibleProducts = allProducts.slice(0, visibleCount);

  return (
    <section className="relative group/offers py-8 md:py-12">
      <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <Flame className="text-red-600 animate-pulse" size={16} />
             <span className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Exclusividade</span>
           </div>
           <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white leading-none">
             Ofertas <span className="text-red-600">Imperdíveis</span>
           </h2>
        </div>
        
        <Link to="/catalogo?secao=promocoes" className="text-[10px] font-black text-zinc-500 uppercase tracking-[3px] hover:text-red-500 transition-colors">
          Ver tudo
        </Link>
      </div>

      <div className="relative">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4"
        >
          {visibleProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-10px" }}
              transition={{ 
                duration: 0.4,
                delay: idx % 10 * 0.05,
                ease: [0.23, 1, 0.32, 1]
              }}
              className="min-w-[42%] sm:min-w-[240px] snap-start h-full"
            >
              <ProductItemCard product={product} isPriority={idx < 2} />
            </motion.div>
          ))}
          
          {/* Load more placeholder if needed */}
          {visibleCount < allProducts.length && (
            <div className="min-w-[260px] md:min-w-[400px] flex items-center justify-center">
               <div className="w-12 h-12 rounded-full border-2 border-t-red-600 border-zinc-800 animate-spin" />
            </div>
          )}
        </div>

        {/* Floating Nav - Only visible on desktop */}
        {allProducts.length > 2 && (
          <>
            <button 
              onClick={() => scroll('left')}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full items-center justify-center text-white hover:bg-red-600 hover:scale-110 transition-all z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex opacity-0 group-hover/offers:opacity-100"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full items-center justify-center text-white hover:bg-red-600 hover:scale-110 transition-all z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex opacity-0 group-hover/offers:opacity-100"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
