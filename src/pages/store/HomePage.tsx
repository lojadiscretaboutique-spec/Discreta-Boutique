import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Users, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { Product } from '../../services/productService';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
}

export function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);

  const loadData = useCallback(async () => {
    try {
      // 1. Banners
      const bSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
      setBanners(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));

      // 2. All active products for filtering sections and categories
      const pSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const allActiveProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      // Filter products: Must have at least one image
      const visibleProducts = allActiveProducts.filter(p => 
        p.images && p.images.length > 0 && 
        (!p.extras || p.extras.showInCatalog !== false)
      );

      // 3. Sections
      setFeaturedProducts(visibleProducts.filter(p => p.featured && (!p.controlStock || p.allowBackorder || p.stock > 0)).slice(0, 10));
      setNewArrivals(visibleProducts.filter(p => p.newRelease && (!p.controlStock || p.allowBackorder || p.stock > 0)).slice(0, 10));
      
      let bestSellersData = [...visibleProducts].filter(p => (!p.controlStock || p.allowBackorder || p.stock > 0));
      bestSellersData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBestSellers(bestSellersData.slice(0, 15));

      // 4. Categories visibility
      const cSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true)));
      const allCats = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      
      const categoryIdsWithProducts = new Set<string>();
      visibleProducts.forEach(p => {
        if (p.categoryId) {
          categoryIdsWithProducts.add(p.categoryId);
          let parent = allCats.find(c => c.id === p.categoryId);
          while (parent && parent.parentId) {
            categoryIdsWithProducts.add(parent.parentId);
            parent = allCats.find(c => c.id === parent?.parentId);
          }
        }
      });

      // Filter root categories that have at least one product in their hierarchy
      const visibleRootCats = allCats.filter(c => c.level === 0 && categoryIdsWithProducts.has(c.id));
      setCategories(visibleRootCats);

    } catch (error) {
      console.error("Error loading home:", error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-play banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="flex-1 flex flex-col bg-black text-white">
      {/* 1. HERO BANNERS */}
      <section className="relative h-[250px] md:h-[500px] overflow-hidden bg-zinc-950 group">
        {banners.length > 0 ? (
          <div className="relative h-full w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={banners[currentBanner].id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {banners[currentBanner].linkUrl ? (
                  <Link to={banners[currentBanner].linkUrl} className="block h-full w-full cursor-pointer">
                    <img 
                      src={banners[currentBanner].imageUrl} 
                      alt="" 
                      className="w-full h-full object-cover shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                ) : (
                  <div className="h-full w-full">
                    <img 
                      src={banners[currentBanner].imageUrl} 
                      alt="" 
                      className="w-full h-full object-cover shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            
            {/* Dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
              {banners.map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentBanner(i)}
                  className={cn(
                    "h-1 transition-all rounded-full",
                    i === currentBanner ? "bg-red-600 w-10" : "bg-white/20 w-4"
                  )}
                />
              ))}
            </div>
            
            {/* Arrows (Subtle) */}
            <button 
              onClick={() => setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-600/50 transition-all z-10 opacity-0 md:group-hover:opacity-100 group-hover:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentBanner(prev => (prev + 1) % banners.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-600/50 transition-all z-10 opacity-0 md:group-hover:opacity-100 group-hover:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 bg-zinc-950">
             <motion.h1 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="text-6xl md:text-9xl font-black italic tracking-tighter uppercase mb-4 opacity-10"
             >
               DISCRETA
             </motion.h1>
          </div>
        )}
      </section>

      {/* 1.5 CATEGORY EXPOSITION */}
      {categories.length > 0 && (
        <section className="bg-black py-16 border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col mb-10">
              <h2 className="text-sm font-black uppercase tracking-[4px] text-zinc-600 mb-2">Coleções</h2>
              <div className="w-12 h-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
            </div>

            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-6">
              {categories.map(cat => (
                <Link 
                  key={cat.id} 
                  to={`/catalogo?categoria=${cat.id}`} 
                  className="group relative shrink-0 w-32 md:w-44 h-52 md:h-64 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-zinc-900 bg-zinc-950 hover:border-red-600/40 transition-all duration-700 shadow-[0_20px_50px_rgba(0,0,0,1)] hover:shadow-red-900/20"
                >
                  {/* Background Image with Parallax-like hover */}
                  <div className="absolute inset-0">
                    {cat.image?.url ? (
                      <img 
                        src={cat.image.url} 
                        alt={cat.name} 
                        className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-125 opacity-40 group-hover:opacity-60" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-black italic text-zinc-900">
                        {cat.name.substring(0, 1)}
                      </div>
                    )}
                  </div>

                  {/* Dark Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black transition-opacity duration-700" />
                  
                  {/* Centered Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                    <span className="text-[6px] md:text-[8px] font-black uppercase tracking-[4px] text-red-600 mb-2 transform -translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                      Coleção
                    </span>
                    <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter italic text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,1)] transition-transform duration-500 group-hover:scale-110">
                      {cat.name}
                    </h3>
                    <div className="mt-3 w-0 h-0.5 bg-red-600 group-hover:w-8 transition-all duration-500 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
                  </div>

                  {/* Inner Glow Border */}
                  <div className="absolute inset-0 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] pointer-events-none" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. CARROUSÉIS DE PRODUTOS */}
      <div className="max-w-7xl mx-auto w-full flex flex-col pt-10 pb-20 px-4 space-y-20">
        
        {/* DESTAQUES - CARROSSEL */}
        {featuredProducts.length > 0 && (
          <ProductCarousel 
            title="Destaques" 
            products={featuredProducts} 
            link="/catalogo"
          />
        )}

        {/* LANÇAMENTOS - CARROSSEL */}
        {newArrivals.length > 0 && (
          <ProductCarousel 
            title="Lançamentos" 
            products={newArrivals} 
            link="/catalogo"
          />
        )}

        {/* MAIS VENDIDOS - GRID (KEEP AS GRID) */}
        {bestSellers.length > 0 && (
          <section>
            <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">Mais Vendidos</h2>
              </div>
              <Link to="/catalogo" className="text-[10px] font-black text-zinc-500 uppercase tracking-[3px] hover:text-red-500 transition-colors">Ver tudo</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {bestSellers.map(product => (
                <ProductItemCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* BENEFÍCIOS */}
      <section className="bg-zinc-950 border-t border-zinc-800 py-24 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8">
          <BenefitItem 
            icon={<Package size={36} />} 
            title="Entrega Discreta" 
            desc="Embalagens sem identificação para garantir sua privacidade absoluta."
          />
          <BenefitItem 
            icon={<ShoppingCart size={36} />} 
            title="Checkout Rápido" 
            desc="Sem cadastros complexos. Finalize pelo WhatsApp em segundos de forma simples."
          />
          <BenefitItem 
            icon={<CreditCard size={36} />} 
            title="Até 10x Sem Juros" 
            desc="Parcele suas compras no cartão de crédito em até 10 vezes sem juros."
          />
          <BenefitItem 
            icon={<Users size={36} />} 
            title="Atendimento VIP" 
            desc="Equipe preparada para tirar todas as suas dúvidas com sigilo e carinho."
          />
        </div>
      </section>
    </div>
  );
}

function ProductCarousel({ title, products, link }: { title: string, products: Product[], link: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative group/carousel">
      <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">{title}</h2>
        </div>
        <Link to={link} className="text-[10px] font-black text-zinc-500 uppercase tracking-[3px] hover:text-red-500 transition-colors">Ver tudo</Link>
      </div>

      <div className="relative">
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.length > 0 ? (
            products.map(product => (
              <div key={product.id} className="min-w-[calc(50%-8px)] sm:min-w-[240px] snap-start">
                <ProductItemCard product={product} />
              </div>
            ))
          ) : (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="min-w-[calc(50%-8px)] sm:min-w-[240px] snap-start">
                <SkeletonCard />
              </div>
            ))
          )}
        </div>

        {/* Navigation Buttons */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-[-10px] md:left-[-20px] top-[40%] -translate-y-1/2 w-10 h-10 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-full items-center justify-center text-white hover:bg-red-600 transition-all z-10 opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => scroll('right')}
          className="absolute right-[-10px] md:right-[-20px] top-[40%] -translate-y-1/2 w-10 h-10 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-full items-center justify-center text-white hover:bg-red-600 transition-all z-10 opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}

function ProductItemCard({ product }: { product: Product }) {
  const mainImage = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
  const isOut = product.controlStock && !product.allowBackorder && product.stock <= 0;
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}`} 
      className={cn(
        "group bg-zinc-900 rounded-2xl overflow-hidden flex flex-col border border-zinc-800 transition-all duration-300",
        isOut ? "grayscale opacity-60" : "hover:border-red-600"
      )}
    >
      <div className="aspect-[4/5] relative bg-zinc-800 overflow-hidden">
        {mainImage ? (
          <img 
            src={mainImage} 
            alt={product.name} 
            className={cn(
              "w-full h-full object-cover transition-transform duration-700",
              !isOut && "group-hover:scale-110"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs text-center px-4">Sem Imagem</div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.newRelease && (
            <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-sm">NEW</span>
          )}
          {!!product.promoPrice && product.promoPrice < product.price && !isOut && (
            <span className="bg-white text-black text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-sm">OFF</span>
          )}
        </div>

        {isOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-zinc-900 text-white text-[9px] font-black uppercase tracking-[2px] px-3 py-1.5 rounded-full border border-zinc-700">Esgotado</span>
          </div>
        )}
      </div>
      
      <div className="p-3 md:p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-zinc-100 group-hover:text-red-500 transition-colors line-clamp-3 leading-tight min-h-[50px] md:min-h-[60px]">
          {product.name}
        </h3>
        <div className="mt-2 flex flex-col">
          {!!product.promoPrice && product.promoPrice < product.price && !isOut ? (
            <>
              <span className="text-[10px] text-zinc-500 line-through">{formatCurrency(product.price)}</span>
              <span className="text-base font-black text-red-500 tracking-tight">{formatCurrency(product.promoPrice)}</span>
            </>
          ) : (
            <span className="text-base font-black text-zinc-100 tracking-tight">{formatCurrency(product.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 animate-pulse overflow-hidden">
      <div className="aspect-[4/5] bg-zinc-800" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-6 bg-zinc-800 rounded-full w-1/3 mt-4" />
      </div>
    </div>
  );
}

function BenefitItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center text-center group cursor-default p-8 rounded-[3rem] bg-zinc-950/50 hover:bg-zinc-900/40 border border-transparent hover:border-zinc-800 transition-all duration-500"
    >
      <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 text-red-600 rounded-[2.5rem] flex items-center justify-center mb-8 group-hover:bg-red-600 group-hover:text-white group-active:bg-red-700 group-active:text-white transition-all duration-500 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-red-600 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
        <div className="relative z-10 transition-transform duration-500 group-hover:scale-110">
          {icon}
        </div>
      </div>
      <h4 className="text-xl font-black uppercase tracking-tight mb-4 text-zinc-100 group-hover:text-red-500 transition-colors">
        {title}
      </h4>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-[220px] group-hover:text-zinc-300 transition-colors">
        {desc}
      </p>
    </motion.div>
  );
}

