import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Users, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Product } from '../../services/productService';
import { getLancamentos, getDestaques, getMaisVendidos, getEmAlta, getRecomendados, fillFallback, getHomeScore } from '../../lib/ranking';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { HeroBanner } from '../../components/ui/HeroBanner';
import { ImperdiveisCarousel } from '../../components/home/ImperdiveisCarousel';
import { LimitedPromoSection } from '../../components/home/LimitedPromoSection';
import { useUIStore } from '../../store/uiStore';
import { ProductItemCard, SkeletonCard } from '../../components/ui/ProductItemCard';
import { LazyLoad } from '../../components/ui/LazyLoad';
import { visualHomeService } from '../../services/visualHomeService';
import { cacheService } from '../../services/cacheService';
import { optimizeImageUrl } from '../../components/ui/ResponsiveImage';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
}

interface OfferBanner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
}

// Progressive loader with automatic mobile quality compression and dynamic domain fallback
function SafeOptimizedImage({ 
  src, 
  alt, 
  className, 
  width, 
  quality = 65, 
  ...props 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
  width?: number; 
  quality?: number; 
  [key: string]: any; 
}) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(src, { width, quality }));

  useEffect(() => {
    setCurrentSrc(optimizeImageUrl(src, { width, quality }));
    setLoaded(false);
  }, [src, width, quality]);

  const handleError = () => {
    if (currentSrc !== src) {
      setCurrentSrc(src);
    }
  };

  return (
    <div className={cn("relative w-full h-full bg-zinc-950 overflow-hidden flex items-center justify-center", !loaded && "animate-pulse")}>
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        className={cn(
          "transition-opacity duration-1000",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}

export function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offerBanners, setOfferBanners] = useState<OfferBanner[]>([]);
  const [sections, setSections] = useState<{
    lancamentos: Product[],
    destaques: Product[],
    maisVendidos: Product[],
    emAlta: Product[],
    recomendados: Product[],
    ofertas: Product[]
  }>({ lancamentos: [], destaques: [], maisVendidos: [], emAlta: [], recomendados: [], ofertas: [] });
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredCategorySections, setFeaturedCategorySections] = useState<{ category: Category; products: Product[] }[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiFrase, setAiFrase] = useState("");
  const setHomeReady = useUIStore(s => s.setHomeReady);

  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [visualStructure, setVisualStructure] = useState<{
    settings: Record<string, any>;
    layouts: Record<string, any>;
    schedules: Record<string, any>;
    order: string[];
  } | null>(null);

  const loadCriticalData = useCallback(async () => {
    try {
      const cachedBanners = cacheService.get('home_banners');
      const cachedOffers = cacheService.get('home_offer_banners');
      
      if (cachedBanners && cachedOffers) {
        setBanners(cachedBanners);
        setOfferBanners(cachedOffers);
        setLoading(false); // Render top elements immediately
        return;
      }

      // Load Banners first to show Hero as fast as possible
      const bSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
      const bannersList = bSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner));
      setBanners(bannersList);
      cacheService.set('home_banners', bannersList);
      
      // We can already transition from full screen loading once banners are loaded
      setLoading(false);

      const oSnap = await getDocs(query(collection(db, 'offer_banners'), where('active', '==', true)));
      const now = new Date();
      const filteredOffers = oSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as OfferBanner))
        .filter(o => {
          if (!o.active) return false;
          if (o.startDate && new Date(o.startDate) > now) return false;
          if (o.endDate && new Date(o.endDate) < now) return false;
          return true;
        });
      setOfferBanners(filteredOffers);
      cacheService.set('home_offer_banners', filteredOffers);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  const loadDeferredData = useCallback(async () => {
    try {
      // 1. Check memory cache for already computed home data
      const cachedDeferred = cacheService.get('home_deferred_data');
      if (cachedDeferred) {
        setAiFrase(cachedDeferred.aiFrase || "");
        setVisibleProducts(cachedDeferred.visibleProducts || []);
        setSections(cachedDeferred.sections || {});
        setCategories(cachedDeferred.categories || []);
        setFeaturedCategorySections(cachedDeferred.featuredCategorySections || []);
        setVisualStructure(cachedDeferred.visualStructure || null);
        setHomeReady(true);
        setLoading(false);
        return;
      }

      // 2. Fetch visual home structure FIRST to know what extra custom elements are requested
      let visualData = null;
      try {
        visualData = await visualHomeService.getFullHomeStructure();
        setVisualStructure(visualData);
      } catch (err) {
        console.error("Error loading home structure:", err);
      }

      // Extract specific custom items mentioned in dynamic home configuration
      let customProductIdsToFetch: string[] = [];
      let categoryIdsToFetch: string[] = [];
      if (visualData && visualData.settings) {
        Object.values(visualData.settings).forEach((s: any) => {
          if (s.active) {
            if ((s.source === 'custom_products' || s.source === 'limited_promo') && s.sourceDetails && s.sourceDetails.length > 0) {
              customProductIdsToFetch.push(...s.sourceDetails);
            } else if (s.source === 'categories' && s.sourceDetails && s.sourceDetails.length > 0) {
              categoryIdsToFetch.push(...s.sourceDetails);
            }
          }
        });
      }
      // Deduplicate arrays
      customProductIdsToFetch = Array.from(new Set(customProductIdsToFetch));
      categoryIdsToFetch = Array.from(new Set(categoryIdsToFetch));

      // 3. Get Home Curation (AI curation)
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

      // 4. Fetch categories first to display category bubbles immediately!
      let allCats: Category[] = [];
      try {
        const cSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true)));
        allCats = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        // Show them immediately with a quick fallback rank
        const initialSortedCats = [...allCats].filter(c => c.level === 0).sort((a, b) => {
          const scoreB = b.accessCount || 0;
          const scoreA = a.accessCount || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
          return a.name.localeCompare(b.name);
        });
        setCategories(initialSortedCats);
      } catch (e) {
        console.error("Error loading categories:", e);
      }

      // 5. Fetch products and combos in background (including explicit custom targets)
      const [pSnap, combosSnap, customProdsDocs, categoryProdsSnaps] = await Promise.all([
        getDocs(query(
          collection(db, 'products'), 
          where('active', '==', true),
          limit(150)
        )),
        getDocs(query(
          collection(db, 'combos'),
          where('active', '==', true),
          where('showInCatalog', '==', true)
        )),
        // Fetch explicit product IDs
        customProductIdsToFetch.length > 0
          ? Promise.all(customProductIdsToFetch.slice(0, 50).map(id => getDoc(doc(db, 'products', id))))
          : Promise.resolve([]),
        // Fetch category-specific products (for custom categories source)
        categoryIdsToFetch.length > 0
          ? Promise.all(categoryIdsToFetch.slice(0, 10).map(catId => 
              getDocs(query(collection(db, 'products'), where('active', '==', true), where('categoryId', '==', catId), limit(24)))
            ))
          : Promise.resolve([])
      ]);
      
      const allFetchedProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      // Parse custom products fetched by direct ID
      const explicitlyFetchedProducts: Product[] = [];
      customProdsDocs.forEach((d: any) => {
        if (d && d.exists()) {
          explicitlyFetchedProducts.push({ id: d.id, ...d.data() } as Product);
        }
      });

      // Parse custom category products
      const categoryFetchedProducts: Product[] = [];
      categoryProdsSnaps.forEach((snap: any) => {
        if (snap) {
          snap.docs.forEach((d: any) => {
            categoryFetchedProducts.push({ id: d.id, ...d.data() } as Product);
          });
        }
      });

      // Deduplicate using Map for robust memory consolidation
      const mergedProductsMap = new Map<string, Product>();
      allFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));
      explicitlyFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));
      categoryFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));

      const finalFetchedProductsList = Array.from(mergedProductsMap.values());

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

      const actualVisibleProducts = [...finalFetchedProductsList, ...comboProducts].filter(p => 
        (p.images && p.images.length > 0) && 
        (p.extras?.showInCatalog !== false) &&
        (p.isCombo || (Number((p as any).stock) || 0) > 0)
      );

      setVisibleProducts(actualVisibleProducts);

      // Recalculate categories (filtering out those without products)
      const categoryIdsWithProducts = new Set<string>();
      actualVisibleProducts.forEach(p => {
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

        const productsOfThisCat = actualVisibleProducts.filter(p => {
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

      const sortedCategoriesWithImages = [...categoriesWithImages].sort((a, b) => {
        const scoreB = b.accessCount || 0;
        const scoreA = a.accessCount || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
        return a.name.localeCompare(b.name);
      });

      setCategories(sortedCategoriesWithImages);

      // Compute sections/curation
      const usedIds = new Set<string>();
      let lancamentos, destaques, maisVendidos, emAlta, recomendados, ofertas;
      ofertas = actualVisibleProducts.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));

      if (curadoria) {
        const pickAi = (ids: string[]) => ids.map(id => actualVisibleProducts.find(p => p.id === id)).filter(p => !!p && !usedIds.has(p.id!)) as Product[];
        
        lancamentos = pickAi(curadoria.lancamentos);
        lancamentos.forEach(p => usedIds.add(p.id!));

        destaques = pickAi(curadoria.destaques);
        destaques.forEach(p => usedIds.add(p.id!));

        maisVendidos = pickAi(curadoria.maisVendidos);
        maisVendidos.forEach(p => usedIds.add(p.id!));

        emAlta = pickAi(curadoria.emAlta);
        emAlta.forEach(p => usedIds.add(p.id!));

        recomendados = getRecomendados(actualVisibleProducts, usedIds);
      } else {
        lancamentos = getLancamentos(actualVisibleProducts, usedIds);
        destaques = getDestaques(actualVisibleProducts, usedIds);
        maisVendidos = getMaisVendidos(actualVisibleProducts, usedIds);
        emAlta = getEmAlta(actualVisibleProducts, usedIds);
        recomendados = getRecomendados(actualVisibleProducts, usedIds);
      }

      [lancamentos, destaques, maisVendidos, emAlta, recomendados].forEach(sec => {
        if (sec.length < 8) sec.push(...fillFallback(actualVisibleProducts, usedIds, 8 - sec.length));
      });

      const processedSections = { lancamentos, destaques, maisVendidos, emAlta, recomendados, ofertas };
      setSections(processedSections);

      // Create featuredCategorySections
      const isProductInCategory = (product: Product, categoryId: string, listCats: Category[]): boolean => {
        if (product.categoryId === categoryId) return true;
        if (product.categoryIds && Array.isArray(product.categoryIds) && product.categoryIds.includes(categoryId)) {
          return true;
        }
        
        const checkParent = (catId: string | null | undefined): boolean => {
          if (!catId) return false;
          if (catId === categoryId) return true;
          const cat = listCats.find(c => c.id === catId);
          if (!cat) return false;
          if (cat.parentId === categoryId) return true;
          return checkParent(cat.parentId);
        };

        if (checkParent(product.categoryId)) return true;
        if (product.categoryIds && Array.isArray(product.categoryIds)) {
          if (product.categoryIds.some(cid => checkParent(cid))) return true;
        }

        return false;
      };

      const categoriesWithHomeSec = allCats
        .filter(c => c.showInHome === true)
        .sort((a, b) => {
          const scoreB = b.accessCount || 0;
          const scoreA = a.accessCount || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
          return a.name.localeCompare(b.name);
        });

      const featuredSecs = categoriesWithHomeSec.map(cat => {
        const productsOfThisCat = actualVisibleProducts
          .filter(p => isProductInCategory(p, cat.id, allCats))
          .sort((a, b) => getHomeScore(b) - getHomeScore(a));
        return {
          category: cat,
          products: productsOfThisCat
        };
      }).filter(sec => sec.products.length > 0);

      setFeaturedCategorySections(featuredSecs);

      // Cache all processed homepage components in MEMORY_CACHE
      cacheService.set('home_deferred_data', {
        aiFrase: curadoria?.fraseImpacto || "",
        visibleProducts: actualVisibleProducts,
        sections: processedSections,
        categories: sortedCategoriesWithImages,
        featuredCategorySections: featuredSecs,
        visualStructure: visualData
      });

      setHomeReady(true);
    } catch (e) {
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

  const getProductsForSection = (id: string, settings: any, layout: any) => {
    if (!settings) return [];
    
    let result: Product[] = [];
    
    // 1. Resolve product source
    switch (settings.source) {
      case 'limited_promo':
        if (settings.sourceDetails && settings.sourceDetails.length > 0) {
          result = settings.sourceDetails
            .map((prodId: string) => {
              const originalProd = visibleProducts.find(p => p.id === prodId);
              if (!originalProd) return null;
              const customizedPromoPrice = settings.promoPrices?.[prodId];
              if (customizedPromoPrice !== undefined && Number(customizedPromoPrice) > 0) {
                return {
                  ...originalProd,
                  promoPrice: parseFloat(customizedPromoPrice as string),
                  onSale: true
                };
              }
              return originalProd;
            })
            .filter((p: any) => !!p) as Product[];
        } else {
          result = [];
        }
        break;
      case 'promo':
        result = visibleProducts.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));
        break;
      case 'categories':
        if (settings.sourceDetails && settings.sourceDetails.length > 0) {
          result = visibleProducts.filter(p => 
            p.categoryId && settings.sourceDetails.includes(p.categoryId)
          );
        } else {
          result = [];
        }
        break;
      case 'custom_products':
        if (settings.sourceDetails && settings.sourceDetails.length > 0) {
          result = settings.sourceDetails
            .map((prodId: string) => visibleProducts.find(p => p.id === prodId))
            .filter((p: any) => !!p) as Product[];
        } else {
          result = [];
        }
        break;
      case 'best_seller':
        result = [...sections.maisVendidos];
        if (result.length === 0) result = getMaisVendidos(visibleProducts, new Set());
        break;
      case 'views':
        result = [...sections.emAlta];
        if (result.length === 0) result = getEmAlta(visibleProducts, new Set());
        break;
      case 'recent':
        result = [...sections.lancamentos];
        if (result.length === 0) result = getLancamentos(visibleProducts, new Set());
        break;
      case 'ai_recs':
        result = [...sections.recomendados];
        if (result.length === 0) result = getRecomendados(visibleProducts, new Set());
        break;
      case 'random':
        result = [...visibleProducts].sort(() => Math.random() - 0.5);
        break;
      case 'stock':
        result = [...visibleProducts].sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
        break;
      case 'auto':
      default:
        // Default standard fallbacks based on id
        if (id === 'lancamentos') result = sections.lancamentos;
        else if (id === 'destaques') result = sections.destaques;
        else if (id === 'maisVendidos') result = sections.maisVendidos;
        else if (id === 'emAlta') result = sections.emAlta;
        else if (id === 'recomendados') result = sections.recomendados;
        else if (id === 'ofertas') result = sections.ofertas;
        else result = sections.destaques; // fallback for custom sections
        break;
    }

    // 2. Perform advanced ordering on the resulting array if specified
    if (settings.orderByField && settings.orderByField !== 'manual') {
      switch (settings.orderByField) {
        case 'recent':
          result = [...result].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
            return dateB - dateA;
          });
          break;
        case 'sales':
          result = [...result].sort((a, b) => getHomeScore(b) - getHomeScore(a));
          break;
        case 'discount':
          result = [...result].sort((a, b) => {
            const dA = a.promoPrice ? (a.price - a.promoPrice) : 0;
            const dB = b.promoPrice ? (b.price - b.promoPrice) : 0;
            return dB - dA;
          });
          break;
        case 'price_asc':
          result = [...result].sort((a, b) => (a.promoPrice || a.price) - (b.promoPrice || b.price));
          break;
        case 'price_desc':
          result = [...result].sort((a, b) => (b.promoPrice || b.price) - (a.promoPrice || a.price));
          break;
        case 'random':
          result = [...result].sort(() => Math.random() - 0.5);
          break;
      }
    }

    // 3. Slice according to limit
    if (layout?.limit) {
      result = result.slice(0, layout.limit);
    }

    return result;
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-white">
      {/* 1. HERO BANNERS */}
      {banners.length > 0 && (
        <section className="relative z-10 w-full max-w-xl md:max-w-2xl mx-auto bg-transparent group px-4 pt-6 pb-8 sm:px-6 md:pt-8 md:pb-10">
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-950">
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
        </section>
      )}

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
                        <SafeOptimizedImage 
                          src={cat.image.url} 
                          alt={cat.name} 
                          width={140}
                          quality={60}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
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
                    <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[1px] text-zinc-400 group-hover:text-red-500 text-center transition-colors duration-500 line-clamp-2 leading-tight px-1">
                      {cat.name}
                    </h3>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* 1.7 DAILY OFFERS BANNERS (OFERTAS DO DIA) */}
      {!loading && offerBanners.length > 0 && (
        <section className="bg-black py-4 md:py-10 border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col mb-6 md:mb-8">
              <h2 className="text-sm font-black uppercase tracking-[4px] text-zinc-600 mb-2">Ofertas do Dia</h2>
              <div className="w-12 h-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
            </div>

            <div className="flex items-start gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
              {offerBanners.map(banner => (
                <Link 
                  key={banner.id} 
                  to={banner.linkUrl || '#'} 
                  className="group relative flex-none w-[280px] md:w-[400px] aspect-square rounded-[2rem] overflow-hidden bg-zinc-900 border border-zinc-800 transition-all duration-500 hover:scale-[1.02] hover:border-red-600/30"
                >
                  <SafeOptimizedImage 
                    src={banner.imageUrl} 
                    alt={banner.name} 
                    width={500}
                    quality={60}
                    className="w-full h-full object-contain transition-transform duration-700 ease-out group-hover:scale-110" 
                  />
                  
                  {/* Glassmorphism Title Box */}
                  <div className="absolute inset-x-4 bottom-4 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                    <h3 className="text-xs md:text-sm font-black uppercase italic tracking-tighter text-white line-clamp-1">
                      {banner.name}
                    </h3>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Aproveite agora</p>
                  </div>

                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. CARROUSÉIS DE PRODUTOS */}
      <div className="w-full flex flex-col pt-6 md:pt-10 pb-16 space-y-8 md:space-y-16 overflow-hidden">
        
        {loading ? (
          <>
            <ProductCarousel title="Lançamentos" products={[]} loading={true} link="/catalogo" />
            <ProductCarousel title="Destaques" products={[]} loading={true} link="/catalogo" />
          </>
        ) : (
          <>
            {/* Dynamic Featured Category Sections at the very top (first session on the Home Page below daily offer banners) */}
            {featuredCategorySections.map(sec => (
              <ProductCarousel 
                key={sec.category.id}
                title={sec.category.name} 
                products={sec.products} 
                link={`/catalogo?categoria=${sec.category.slug || sec.category.id}`} 
              />
            ))}

            {visualStructure && visualStructure.order && visualStructure.order.length > 0 ? (
              visualStructure.order.map((sectionId: string) => {
                const sectionSettings = visualStructure.settings[sectionId];
                const sectionLayout = visualStructure.layouts[sectionId];
                const sectionSchedule = visualStructure.schedules[sectionId];

                if (!sectionSettings || !sectionSettings.active) return null;

                // Check schedule
                if (sectionSchedule?.hasSchedule) {
                  const now = new Date();
                  if (sectionSchedule.startDate) {
                    const startStr = `${sectionSchedule.startDate}T${sectionSchedule.startTime || '00:00'}:00`;
                    if (now < new Date(startStr)) return null;
                  }
                  if (sectionSchedule.endDate) {
                    const endStr = `${sectionSchedule.endDate}T${sectionSchedule.endTime || '23:59'}:59`;
                    if (now > new Date(endStr)) return null;
                  }
                }

                const sectionProducts = getProductsForSection(sectionId, sectionSettings, sectionLayout);
                if (!sectionProducts || sectionProducts.length === 0) return null;

                if (sectionSettings.source === 'limited_promo') {
                  return (
                    <LazyLoad key={sectionId} rootMargin="300px">
                      <LimitedPromoSection 
                        title={sectionSettings.title}
                        subtitle={sectionSettings.subtitle}
                        emoji={sectionSettings.emoji}
                        products={sectionProducts}
                        endDate={sectionSchedule?.endDate}
                        endTime={sectionSchedule?.endTime}
                        themeColor={sectionSettings.themeColor}
                        themeBg={sectionSettings.themeBg}
                        layout={sectionLayout}
                      />
                    </LazyLoad>
                  );
                }

                if (sectionId === 'ofertas' && (!sectionLayout || sectionLayout.style === 'standard')) {
                  return (
                    <LazyLoad key={sectionId} rootMargin="300px">
                      <ImperdiveisCarousel products={sectionProducts} loading={loading} />
                    </LazyLoad>
                  );
                }

                return (
                  <LazyLoad key={sectionId} rootMargin="300px">
                    <ProductCarousel 
                      title={sectionSettings.title}
                      subtitle={sectionSettings.subtitle}
                      emoji={sectionSettings.emoji}
                      alignment={sectionSettings.alignment}
                      products={sectionProducts}
                      link={sectionSettings.buttonUrl || `/catalogo?secao=${sectionId}`}
                      showButton={sectionSettings.showButton ?? true}
                      buttonText={sectionSettings.buttonText || 'Ver Todos'}
                      themeColor={sectionSettings.themeColor}
                      themeBg={sectionSettings.themeBg}
                      layout={sectionLayout}
                    />
                  </LazyLoad>
                );
              })
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

function ProductCarousel({ 
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

  const isVertical = layout?.orientation === 'vertical';
  const isCompactStyle = layout?.style === 'compact';

  // Build responsive column classes for vertical layout
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

          {/* Navigation Buttons for sliders only */}
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

