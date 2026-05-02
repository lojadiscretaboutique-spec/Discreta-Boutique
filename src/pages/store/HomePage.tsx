import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Users, ChevronLeft, ChevronRight, CreditCard, Plus, Minus } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { Product } from '../../services/productService';
import { getLancamentos, getDestaques, getMaisVendidos, getEmAlta, getRecomendados, fillFallback } from '../../lib/ranking';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../../store/cartStore';

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
    recomendados: Product[]
  }>({ lancamentos: [], destaques: [], maisVendidos: [], emAlta: [], recomendados: [] });
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const bSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
      setBanners(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));

      const pSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const allActiveProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const visibleProducts = allActiveProducts.filter(p => 
        p.images && p.images.length > 0 && 
        (!p.extras || p.extras.showInCatalog !== false) &&
        (!p.controlStock || p.allowBackorder || p.stock > 0)
      );

      const usedIds = new Set<string>();
      
      const lancamentos = getLancamentos(visibleProducts, usedIds);
      const destaques = getDestaques(visibleProducts, usedIds);
      const maisVendidos = getMaisVendidos(visibleProducts, usedIds);
      const emAlta = getEmAlta(visibleProducts, usedIds);
      const recomendados = getRecomendados(visibleProducts, usedIds);

      // Fill fallbacks if needed
      [lancamentos, destaques, maisVendidos, emAlta, recomendados].forEach(sec => {
          if (sec.length < 8) sec.push(...fillFallback(visibleProducts, usedIds, 8 - sec.length));
      });

      setSections({ lancamentos, destaques, maisVendidos, emAlta, recomendados });

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
                      src={banners[currentBanner].imageUrl || undefined} 
                      alt="" 
                      className="w-full h-full object-cover shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                ) : (
                  <div className="h-full w-full">
                    <img 
                      src={banners[currentBanner].imageUrl || undefined} 
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
        <section className="bg-black py-6 md:py-16 border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col mb-4 md:mb-10">
              <h2 className="text-sm font-black uppercase tracking-[4px] text-zinc-600 mb-2">Coleções</h2>
              <div className="w-12 h-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
            </div>

            <div className="flex items-start gap-6 md:gap-12 overflow-x-auto no-scrollbar pb-6 scroll-p-4">
              {categories.map(cat => (
                <Link 
                  key={cat.id} 
                  to={`/catalogo?categoria=${cat.id}`} 
                  className="group flex flex-col items-center shrink-0 w-32 md:w-44"
                >
                  {/* Circular Image Container */}
                  <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-zinc-900 transition-all duration-500 shadow-2xl mb-4 group-hover:shadow-red-900/20 group-hover:scale-105">
                    {cat.image?.url ? (
                      <img 
                        src={cat.image.url || undefined} 
                        alt={cat.name} 
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-black italic text-zinc-800">
                        {cat.name.substring(0, 1)}
                      </div>
                    )}
                    
                    {/* Subtle Overlay on hover */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                  
                  {/* Title Below */}
                  <h3 className="text-base md:text-lg font-black uppercase tracking-[1px] text-white group-hover:text-red-500 text-center transition-colors duration-500 line-clamp-2 leading-tight px-1">
                    {cat.name}
                  </h3>
                  
                  {/* Active Indicator line */}
                  <div className="mt-2 w-0 h-0.5 bg-red-600 group-hover:w-12 transition-all duration-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. CARROUSÉIS DE PRODUTOS */}
      <div className="max-w-7xl mx-auto w-full flex flex-col pt-6 md:pt-10 pb-16 px-4 space-y-8 md:space-y-16">
        
        {/* 1. LANÇAMENTOS */}
        {sections.lancamentos.length > 0 && <ProductCarousel title="Lançamentos" products={sections.lancamentos} link="/catalogo" />}
        
        {/* 2. DESTAQUES */}
        {sections.destaques.length > 0 && <ProductCarousel title="Destaques" products={sections.destaques} link="/catalogo" />}
        
        {/* 3. MAIS VENDIDOS */}
        {sections.maisVendidos.length > 0 && <ProductCarousel title="Mais Vendidos" products={sections.maisVendidos} link="/catalogo" />}

        {/* 4. EM ALTA */}
        {sections.emAlta.length > 0 && <ProductCarousel title="Em Alta" products={sections.emAlta} link="/catalogo" />}

        {/* 5. RECOMENDADOS */}
        {sections.recomendados.length > 0 && <ProductCarousel title="Recomendados" products={sections.recomendados} link="/catalogo" />}

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
      </div>
    </section>
  );
}

function ProductItemCard({ product }: { product: Product }) {
  const mainImage = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
  const isOut = product.controlStock && !product.allowBackorder && product.stock <= 0;
  const hasPromo = !!product.promoPrice && product.promoPrice < product.price && !isOut;
  const hasVariants = !!product.hasVariants;
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore(s => s.addItem);
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      navigate(`/produto/${product.seo?.slug || product.id}`);
    } else {
      addItem({
        id: `${product.id}-base`,
        productId: product.id,
        name: product.name,
        price: hasPromo ? product.promoPrice! : product.price,
        quantity: quantity,
        sku: product.sku,
        imageUrl: mainImage || '',
        variantId: undefined,
        variantName: undefined
      });
      navigate('/carrinho');
    }
  };
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}`} 
      className={cn(
        "group relative bg-zinc-950/40 rounded-[2.5rem] overflow-hidden flex flex-col border border-zinc-900 transition-all duration-700 h-full",
        isOut ? "grayscale opacity-40 shadow-none border-zinc-950" : "hover:border-red-600/30 hover:bg-zinc-950 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] hover:shadow-red-900/10"
      )}
    >
      <div className="aspect-[3/4] relative bg-white overflow-hidden group-hover:bg-zinc-50 transition-colors duration-500">
        {mainImage ? (
          <img 
            src={mainImage || undefined} 
            alt={product.name} 
            className={cn(
              "w-full h-full object-cover transition-transform duration-1000 ease-out",
              !isOut && "group-hover:scale-105"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-zinc-800 text-[10px] font-black uppercase tracking-widest text-center px-4 italic">Sem Imagem</div>
        )}
        
        {/* Organic Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          {product.newRelease && !isOut && (
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-red-600 text-white text-[7px] md:text-[8px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full shadow-[0_5px_15px_rgba(220,38,38,0.4)] backdrop-blur-sm"
            >
              Novo
            </motion.span>
          )}
          {hasPromo && (
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-red-600 text-white text-[7px] md:text-[8px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full shadow-xl"
            >
              Oferta
            </motion.span>
          )}
        </div>

        {isOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[4px] z-20">
            <span className="bg-transparent text-white text-[10px] font-black uppercase tracking-[4px] border-b-2 border-white/20 pb-1">Esgotado</span>
          </div>
        )}
        
        {/* Soft Glow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      </div>
      
      <div className="p-4 md:p-5 flex flex-col flex-1 relative bg-zinc-950">
        <h3 className="text-sm md:text-base font-bold text-zinc-100 group-hover:text-white transition-colors duration-300 line-clamp-4 leading-snug min-h-[5rem] md:min-h-[6rem] mb-3 capitalize">
          {product.name.toLowerCase()}
        </h3>

        <div className="mt-auto flex flex-col w-full relative">
          <div className="flex flex-col gap-1.5 mb-3">
            {/* A Vista */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs md:text-sm font-bold text-red-600 tracking-tight">à vista</span>
              <span className="text-xl md:text-2xl font-black text-red-600 tracking-tighter">
                {formatCurrency(hasPromo ? product.promoPrice! : product.price)}
              </span>
            </div>
            
            {/* Installments */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] md:text-[11px] text-zinc-400 font-black tracking-tight uppercase">
                {hasPromo && (
                  <span className="line-through opacity-60 mr-1.5 font-medium">{formatCurrency(product.price)}</span>
                )}
                OU 10X DE {formatCurrency((hasPromo ? product.promoPrice! : product.price) / 10)} SEM JUROS
              </span>
            </div>
          </div>
          
          {/* Bottom Actions */}
          {!isOut && (
            <div className="flex items-stretch gap-2 w-full h-9 md:h-10 relative z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              {!hasVariants && (
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-1.5 w-[4.5rem] md:w-20 shrink-0">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }} className="text-zinc-400 hover:text-white p-1 transition-colors"><Minus size={14} /></button>
                  <span className="text-xs font-bold text-white">{quantity}</span>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantity(quantity + 1); }} className="text-zinc-400 hover:text-white p-1 transition-colors"><Plus size={14} /></button>
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] md:text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center"
              >
                Comprar
              </button>
            </div>
          )}
        </div>
        
        {/* Decoration line */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
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

