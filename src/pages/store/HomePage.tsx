import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Users, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Product } from '../../services/productService';
import { getLancamentos, getDestaques, getMaisVendidos, getEmAlta, getRecomendados, fillFallback } from '../../lib/ranking';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { HeroBanner } from '../../components/ui/HeroBanner';
import { ImperdiveisCarousel } from '../../components/home/ImperdiveisCarousel';
import { useUIStore } from '../../store/uiStore';
import { ProductItemCard, SkeletonCard } from '../../components/ui/ProductItemCard';
import { LazyLoad } from '../../components/ui/LazyLoad';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
}

export function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<{
    lancamentos: Product[],
    destaques: Product[],
    maisVendidos: Product[],
    emAlta: Product[],
    recomendados: Product[],
    ofertas: Product[]
  }>({ lancamentos: [], destaques: [], maisVendidos: [], emAlta: [], recomendados: [], ofertas: [] });
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiFrase, setAiFrase] = useState("");
  const setHomeReady = useUIStore(s => s.setHomeReady);

  const loadCriticalData = useCallback(async () => {
    try {
      // Load Banners first to show Hero
      const bSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
      setBanners(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadDeferredData = useCallback(async () => {
    try {
      // 1. Get Home Curation first to know what to prioritize
      let curadoria: any = null;
      try {
        const docRef = doc(db, 'ai_curation', 'home');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          curadoria = docSnap.data();
          if (curadoria.fraseImpacto) setAiFrase(curadoria.fraseImpacto);
        }
      } catch (e) {
        console.warn('IA Home Curatory fails:', e);
      }

      // 2. Optimized fetch: Instead of ALL products, let's fetch a reasonable amount for Home
      const [pSnap, combosSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'products'), 
          where('active', '==', true),
          limit(150)
        )),
        getDocs(query(
          collection(db, 'combos'),
          where('active', '==', true),
          where('showInCatalog', '==', true)
        ))
      ]);
      
      const allFetchedProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const comboProducts = combosSnap.docs.map(d => {
        const combo = d.data();
        return {
          id: d.id,
          name: combo.name,
          description: combo.description,
          price: combo.price,
          images: combo.images || (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
          isCombo: true,
          categoryId: 'combos',
          featured: combo.isFeatured
        } as any;
      });

      const visibleProducts = [...allFetchedProducts, ...comboProducts].filter(p => 
        (p.images && p.images.length > 0) && 
        (p.extras?.showInCatalog !== false) &&
        (p.isCombo || !p.controlStock || p.allowBackorder || (Number((p as any).stock) || 0) > 0)
      );

      const usedIds = new Set<string>();
      
      let lancamentos, destaques, maisVendidos, emAlta, recomendados, ofertas;

      // Ofertas (Todas as ofertas disponíveis para passar pela IA)
      ofertas = visibleProducts.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));

      if (curadoria) {
        const pickAi = (ids: string[]) => ids.map(id => visibleProducts.find(p => p.id === id)).filter(p => !!p && !usedIds.has(p.id!)) as Product[];
        
        lancamentos = pickAi(curadoria.lancamentos);
        lancamentos.forEach(p => usedIds.add(p.id!));

        destaques = pickAi(curadoria.destaques);
        destaques.forEach(p => usedIds.add(p.id!));

        maisVendidos = pickAi(curadoria.maisVendidos);
        maisVendidos.forEach(p => usedIds.add(p.id!));

        emAlta = pickAi(curadoria.emAlta);
        emAlta.forEach(p => usedIds.add(p.id!));

        recomendados = getRecomendados(visibleProducts, usedIds);
      } else {
        lancamentos = getLancamentos(visibleProducts, usedIds);
        destaques = getDestaques(visibleProducts, usedIds);
        maisVendidos = getMaisVendidos(visibleProducts, usedIds);
        emAlta = getEmAlta(visibleProducts, usedIds);
        recomendados = getRecomendados(visibleProducts, usedIds);
      }

      // Fill fallbacks if needed
      [lancamentos, destaques, maisVendidos, emAlta, recomendados].forEach(sec => {
          if (sec.length < 8) sec.push(...fillFallback(visibleProducts, usedIds, 8 - sec.length));
      });

      setSections({ lancamentos, destaques, maisVendidos, emAlta, recomendados, ofertas });

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

      const visibleRootCats = allCats.filter(c => c.level === 0 && categoryIdsWithProducts.has(c.id));
      const categoriesWithImages = visibleRootCats.map(cat => {
        if (cat.image?.url) return cat;

        const productsOfThisCat = visibleProducts.filter(p => {
          if (p.categoryId === cat.id) return true;
          const pCat = allCats.find(c => c.id === p.categoryId);
          return pCat?.parentId === cat.id;
        });

        if (productsOfThisCat.length > 0) {
          const randomIndex = Math.floor(Math.random() * productsOfThisCat.length);
          const randomProduct = productsOfThisCat[randomIndex];
          
          if (randomProduct.images && randomProduct.images.length > 0) {
            const mainImg = randomProduct.images.find(i => i.isMain) || randomProduct.images[0];
            return { ...cat, image: { url: mainImg.url } };
          }
        }
        return cat;
      });

      setCategories(categoriesWithImages);
      // Wait for everything to be set before releasing the global splash
      setHomeReady(true);
    } catch(e) {
      console.error(e);
      setHomeReady(true);
    } finally {
      setLoading(false);
    }
  }, [setHomeReady]);

  useEffect(() => {
    loadCriticalData();
    loadDeferredData();

    return () => {
      // Reset so splash screen reappears when coming back to home
      setHomeReady(false);
    };
  }, [loadCriticalData, loadDeferredData, setHomeReady]);

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
                    <HeroBanner banner={banners[currentBanner]} isEager={currentBanner === 0} />
                  </Link>
                ) : (
                  <HeroBanner banner={banners[currentBanner]} isEager={currentBanner === 0} />
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
               className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase mb-4 text-white relative z-20 px-4 drop-shadow-2xl"
             >
               {aiFrase || "DISCRETA"}
             </motion.h1>
          </div>
        )}
      </section>

      {/* 1.5 CATEGORY EXPOSITION */}
      {(loading || categories.length > 0) && (
        <section className="bg-black py-6 md:py-16 border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col mb-4 md:mb-10">
              <h2 className="text-sm font-black uppercase tracking-[4px] text-zinc-600 mb-2">Coleções</h2>
              <div className="w-12 h-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
            </div>

            <div className="flex items-start gap-4 md:gap-8 overflow-x-auto no-scrollbar pb-6 scroll-p-4">
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <div key={i} className="flex flex-col items-center shrink-0 w-20 md:w-28 animate-pulse">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-zinc-900 border border-zinc-800 mb-3 shadow-2xl" />
                    <div className="h-3 bg-zinc-900 rounded w-16 mb-2" />
                  </div>
                ))
              ) : (
                categories.map(cat => (
                  <Link 
                    key={cat.id} 
                    to={`/catalogo?categoria=${cat.slug || cat.id}`} 
                    className="group flex flex-col items-center shrink-0 w-20 md:w-28"
                  >
                    {/* Circular Image Container - Smaller */}
                    <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden bg-zinc-900 transition-all duration-500 shadow-2xl mb-3 group-hover:shadow-red-900/20 group-hover:scale-105 border border-zinc-900">
                      {cat.image?.url ? (
                        <img 
                          src={cat.image.url || undefined} 
                          alt={cat.name} 
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl font-black italic text-zinc-800 bg-zinc-900 uppercase">
                          {cat.name.substring(0, 1)}
                        </div>
                      )}
                      
                      {/* Subtle Overlay on hover */}
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    
                    {/* Title Below - Smaller text */}
                    <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[1px] text-zinc-400 group-hover:text-red-500 text-center transition-colors duration-500 line-clamp-2 leading-tight px-1">
                      {cat.name}
                    </h3>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. CARROUSÉIS DE PRODUTOS */}
      <div className="max-w-7xl mx-auto w-full flex flex-col pt-6 md:pt-10 pb-16 px-4 space-y-8 md:space-y-16">
        
        {loading ? (
          <>
            <ProductCarousel title="Lançamentos" products={[]} loading={true} link="/catalogo" />
            <ProductCarousel title="Destaques" products={[]} loading={true} link="/catalogo" />
          </>
        ) : (
          <>
            {/* 1. LANÇAMENTOS - Carrega imediatamente */}
            {sections.lancamentos.length > 0 && <ProductCarousel title="Lançamentos" products={sections.lancamentos} link="/catalogo?secao=lancamentos" />}
            
            {/* 2. DESTAQUES - Carrega imediatamente */}
            {sections.destaques.length > 0 && <ProductCarousel title="Destaques" products={sections.destaques} link="/catalogo?secao=destaques" />}
            
            {/* Sessões carregadas conforme o scroll para performance */}
            <LazyLoad rootMargin="300px">
              {sections.maisVendidos.length > 0 && <ProductCarousel title="Mais Vendidos" products={sections.maisVendidos} link="/catalogo?secao=mais-vendidos" />}
            </LazyLoad>
 
            <LazyLoad rootMargin="300px">
              <ImperdiveisCarousel products={sections.ofertas} loading={loading} />
            </LazyLoad>
 
            <LazyLoad rootMargin="300px">
              {sections.emAlta.length > 0 && <ProductCarousel title="Em Alta" products={sections.emAlta} link="/catalogo?secao=em-alta" />}
            </LazyLoad>
 
            <LazyLoad rootMargin="300px">
              {sections.recomendados.length > 0 && <ProductCarousel title="Recomendados" products={sections.recomendados} link="/catalogo?secao=recomendados" />}
            </LazyLoad>
          </>
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

function ProductCarousel({ title, products, link, loading }: { title: string, products: Product[], link: string, loading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      // Load more items when getting close to the end (300px threshold)
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

  return (
    <section className="relative group/carousel">
      <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">{title}</h2>
        </div>
        {!loading && <Link to={link} className="text-[10px] font-black text-zinc-500 uppercase tracking-[3px] hover:text-red-500 transition-colors">Ver tudo</Link>}
      </div>

      <div className="relative">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
             displayProducts.map((_, i) => (
              <div key={i} className="min-w-[42%] sm:min-w-[240px] snap-start h-full">
                <SkeletonCard />
              </div>
            ))
          ) : displayProducts.length > 0 ? (
            displayProducts.map((product: any, idx: number) => (
              <div key={product.id} className="min-w-[42%] sm:min-w-[240px] snap-start h-full">
                <ProductItemCard product={product} isPriority={idx < 2} />
              </div>
            ))
          ) : null}
        </div>

        {/* Navigation Buttons */}
        {!loading && products.length > 0 && (
          <>
            <button 
              onClick={() => scroll('left')}
              className="absolute left-2 top-[40%] -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all z-10 md:left-[-20px] md:group-hover/carousel:opacity-100 md:opacity-0"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="absolute right-2 top-[40%] -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all z-10 md:right-[-20px] md:group-hover/carousel:opacity-100 md:opacity-0"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </section>
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

