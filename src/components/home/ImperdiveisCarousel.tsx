
import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Product } from '../../services/productService';
import { openaiOfferSorting } from '../../services/openaiOfferSorting';

interface ImperdiveisCarouselProps {
  products: Product[];
  loading?: boolean;
}

export function ImperdiveisCarousel({ products: initialProducts, loading: initialLoading }: ImperdiveisCarouselProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
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
      // If we're 200px from the end, load more
      if (scrollLeft + clientWidth >= scrollWidth - 200) {
        if (visibleCount < allProducts.length) {
          setVisibleCount(prev => Math.min(prev + 10, allProducts.length));
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
    <section className="relative group/offers py-8 md:py-12 bg-zinc-950/20 rounded-[2rem] md:rounded-[4rem] border border-zinc-900 overflow-hidden mb-16 mx-4 md:mx-0">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] -z-10 rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/5 blur-[120px] -z-10 rounded-full" />

      <div className="px-6 md:px-12 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <Flame className="text-red-600 animate-pulse" size={18} />
             <span className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Exclusividade</span>
           </div>
           <h2 className="text-3xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-none">
             Ofertas <span className="text-red-600">Imperdíveis</span>
           </h2>
        </div>
        
        <Link to="/catalogo?secao=promocoes" className="flex items-center gap-2 group/link w-fit">
          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-500 group-hover/link:text-red-500 transition-colors">Explorar Tudo</span>
          <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center group-hover/link:border-red-600 group-hover/link:bg-red-600 group-hover/link:text-white transition-all">
            <ChevronRight size={14} />
          </div>
        </Link>
      </div>

      <div className="relative">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory px-6 md:px-12 pb-8"
        >
          {visibleProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ 
                duration: 0.6,
                delay: idx % 10 * 0.05,
                ease: [0.23, 1, 0.32, 1]
              }}
              className="min-w-[260px] xs:min-w-[300px] md:min-w-[400px] snap-start"
            >
              <OfferCard product={product} />
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

function OfferCard({ product }: { product: Product }) {
  const mainImage = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
  const discount = product.promoPrice ? Math.round(((product.price - product.promoPrice) / product.price) * 100) : 0;
  
  const tags = ["HOT DEAL", "OFERTA", "SALE", "EXCLUSIVO", "LIMITADO"];
  const randomTag = tags[Math.floor(Math.random() * tags.length)];

  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}`}
      className="group block relative aspect-[3/4] md:aspect-[4/5] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden bg-zinc-900 border border-zinc-800"
    >
      {/* Image */}
      {mainImage ? (
        <img 
          src={mainImage} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-[3000ms] ease-out group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-900 font-black uppercase italic">Discreta</div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-70 transition-opacity duration-700" />
      
      {/* Content */}
      <div className="absolute inset-0 p-5 md:p-8 flex flex-col justify-end">
        {/* Badges */}
        <div className="absolute top-5 left-5 md:top-8 md:left-8 flex flex-col gap-2">
          {discount > 0 && (
            <span className="bg-red-600 text-white font-black text-[10px] md:text-xs px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(220,38,38,0.5)]">
              -{discount}%
            </span>
          )}
          <span className="bg-white/90 text-red-600 font-black text-[8px] md:text-[10px] uppercase tracking-[2px] px-4 py-2 rounded-full backdrop-blur-md">
            {randomTag}
          </span>
        </div>

        {/* Product Info */}
        <div className="relative transform translate-y-4 group-hover:translate-y-0 transition-all duration-700">
           <h3 className="text-base md:text-2xl font-black text-white line-clamp-2 mb-2 md:mb-4 leading-tight capitalize tracking-tight group-hover:text-red-500 transition-colors">
             {product.name.toLowerCase()}
           </h3>
           
           <div className="flex flex-col gap-1">
             <span className="text-[10px] md:text-sm text-white/40 line-through font-bold">De {formatCurrency(product.price)}</span>
             <div className="flex items-end gap-3">
               <div className="flex flex-col">
                  <span className="text-[8px] md:text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">Por apenas</span>
                  <span className="text-2xl md:text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    {formatCurrency(product.promoPrice || product.price)}
                  </span>
               </div>
               
               <div className="mb-1 hidden md:block">
                  <div className="bg-red-600 text-white p-2 rounded-xl group-hover:scale-110 transition-transform">
                    <Flame size={16} />
                  </div>
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* Hover Selection Ring */}
      <div className="absolute inset-0 border-4 border-red-600/0 group-hover:border-red-600/20 rounded-[1.5rem] md:rounded-[3rem] transition-all pointer-events-none duration-700" />
    </Link>
  );
}
