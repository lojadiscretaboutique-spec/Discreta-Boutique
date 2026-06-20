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
import { ProductCarousel } from '../../components/home/ProductCarousel';
import { ImperdiveisCarousel } from '../../components/home/ImperdiveisCarousel';
import { LimitedPromoSection } from '../../components/home/LimitedPromoSection';
import { BenefitItem } from '../../components/home/BenefitItem';
import { useUIStore } from '../../store/uiStore';
import { LazyLoad } from '../../components/ui/LazyLoad';
import { visualHomeService } from '../../services/visualHomeService';
import { cacheService } from '../../services/cacheService';
import { SafeOptimizedImage } from '../../components/home/SafeOptimizedImage';
import { isProductInCategory } from '../../utils/categoryUtils';
import { measurePerformance } from '../../utils/performance';
import { HomeLiveShopSection } from '../../components/home/HomeLiveShopSection';
import { StoryShopCarousel } from '../../components/store/StoryShopCarousel';

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

export function HomePage() {
  const homeStartTime = useRef<number>(performance.now());
  const hasLoggedStart = useRef(false);
  if (import.meta.env.DEV && !hasLoggedStart.current) {
    console.log('[Performance] HOME_START');
    hasLoggedStart.current = true;
  }

  const [offerBanners, setOfferBanners] = useState<OfferBanner[]>([]);
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
  const setHomeReady = useUIStore(s => s.setHomeReady);

  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const el = categoriesScrollRef.current;
      const scrollAmount = el.clientWidth * 0.75;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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

  const loadDeferredData = useCallback(async (isFull = false) => {
    try {
      // 1. Check memory cache for already computed home data
      const cacheKey = isFull ? 'home_deferred_data_full' : 'home_deferred_data_initial';
      const cachedDeferred = cacheService.get(cacheKey);
      if (cachedDeferred) {
        setVisibleProducts(cachedDeferred.visibleProducts || []);
        setSections(cachedDeferred.sections || {});
        setCategories(cachedDeferred.categories || []);
        setVisualStructure(cachedDeferred.visualStructure || null);
        if (isFull) {
          setHomeReady(true);
        }
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
      if (isFull && visualData && visualData.settings) {
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
      if (isFull) {
        try {
          const docRef = doc(db, 'ai_curation', 'home');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            curadoria = docSnap.data();
          }
        } catch (e) {
          console.warn('IA Home Curatory fails:', e);
        }
      }

      // 4. Fetch categories first to display category bubbles immediately!
      let allCats: Category[] = [];
      try {
        const cSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true)));
        allCats = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        // Show them immediately with a quick random/shuffled fallback
        const initialSortedCats = [...allCats].sort(() => Math.random() - 0.5);
        setCategories(initialSortedCats);
      } catch (e) {
        console.error("Error loading categories:", e);
      }

      // 5. Fetch products and combos in background (including explicit custom targets)
      const limitCount = isFull ? 150 : 40;
      const [pSnap, combosSnap, customProdsDocs, categoryProdsSnaps] = await Promise.all([
        getDocs(query(
          collection(db, 'products'), 
          where('active', '==', true),
          limit(limitCount)
        )),
        getDocs(query(
          collection(db, 'combos'),
          where('active', '==', true),
          where('showInCatalog', '==', true)
        )),
        // Fetch explicit product IDs
        customProductIdsToFetch.length > 0
          ? Promise.all(customProductIdsToFetch.slice(0, 15).map(id => getDoc(doc(db, 'products', id))))
          : Promise.resolve([]),
        // Fetch category-specific products (for custom categories source)
        categoryIdsToFetch.length > 0
          ? Promise.all(categoryIdsToFetch.slice(0, 5).map(catId => 
              getDocs(query(collection(db, 'products'), where('active', '==', true), where('categoryId', '==', catId), limit(12)))
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

      const visibleRootCats = allCats.filter(c => categoryIdsWithProducts.has(c.id));
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

      // Shuffle the categories randomly as requested
      const sortedCategoriesWithImages = [...categoriesWithImages].sort(() => Math.random() - 0.5);

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

      // Cache all processed homepage components in MEMORY_CACHE
      cacheService.set(cacheKey, {
        visibleProducts: actualVisibleProducts,
        sections: processedSections,
        categories: sortedCategoriesWithImages,
        visualStructure: visualData
      });

      if (isFull) {
        setHomeReady(true);
      }
    } catch (e) {
      console.error(e);
      if (isFull) {
        setHomeReady(true);
      }
    } finally {
      setLoading(false);
    }
  }, [setHomeReady]);

  const hasLoggedImagesReady = useRef(false);
  const handleBannerImageLoaded = useCallback(() => {
    if (!hasLoggedImagesReady.current) {
      measurePerformance('HOME_IMAGES_READY', homeStartTime.current);
      hasLoggedImagesReady.current = true;
    }
  }, []);

  const loadCacheOrFallback = useCallback(async () => {
    const cacheLoadStartTime = performance.now();
    try {
      setLoading(true);
      const { homeCacheService } = await import('../../services/homeCacheService');
      const cachedData = await homeCacheService.getHomeCache();

      if (cachedData) {
        measurePerformance('HOME_CACHE_LOADED', homeStartTime.current);
        const cacheFetchDuration = performance.now() - cacheLoadStartTime;
        
        const approxSize = (JSON.stringify(cachedData).length / 1024).toFixed(2);
        if (import.meta.env.DEV) {
          console.log(`[Performance] Tempo para carregar cache public_home_cache/home: ${cacheFetchDuration.toFixed(2)}ms`);
          console.log(`[Performance] Tamanho aproximado do payload de cache: ${approxSize} KB`);
          console.log('[Performance] Carregado por: CACHE');
        }

        setBanners(cachedData.banners || []);
        setOfferBanners(cachedData.offerBanners || []);
        setCategories(cachedData.categories || []);
        setVisibleProducts(cachedData.visibleProducts || []);
        setSections(cachedData.sections || {
          lancamentos: [], destaques: [], maisVendidos: [], emAlta: [], recomendados: [], ofertas: []
        });
        setVisualStructure(cachedData.visualStructure || null);
        setHomeReady(true);
        setLoading(false);
        return;
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("⚠️ Failed to resolve public home cache, falling back to original queries...", e);
      }
    }

    // Fallback: run the existing queries
    if (import.meta.env.DEV) {
      console.log('[Performance] Carregado por: FALLBACK');
      console.log("⚠️ [Performance] Optimized cache not ready or failed. Triggering fallback queries...");
    }
    await loadCriticalData();
    await loadDeferredData(false);
    
    // run the deferred load full after 1s
    const timer = setTimeout(() => {
      loadDeferredData(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [loadCriticalData, loadDeferredData, setHomeReady]);

  // 1. HOME_FIRST_RENDER when loading is done
  const hasLoggedFirstRender = useRef(false);
  useEffect(() => {
    if (!loading && !hasLoggedFirstRender.current) {
      measurePerformance('HOME_FIRST_RENDER', homeStartTime.current);
      hasLoggedFirstRender.current = true;
    }
  }, [loading]);

  // 2. Tempo até renderizar primeiro banner
  const hasLoggedFirstBanner = useRef(false);
  useEffect(() => {
    if (banners.length > 0 && !hasLoggedFirstBanner.current) {
      measurePerformance('Tempo até renderizar primeiro banner', homeStartTime.current);
      hasLoggedFirstBanner.current = true;
    }
  }, [banners]);

  // 3. Tempo até renderizar primeiros produtos
  const hasLoggedFirstProducts = useRef(false);
  useEffect(() => {
    if (visibleProducts.length > 0 && !hasLoggedFirstProducts.current) {
      measurePerformance('Tempo até renderizar primeiros produtos', homeStartTime.current);
      hasLoggedFirstProducts.current = true;
    }
  }, [visibleProducts]);

  useEffect(() => {
    let cancelTimer: (() => void) | undefined;
    loadCacheOrFallback().then((cleanup) => {
      if (typeof cleanup === 'function') {
        cancelTimer = cleanup;
      }
    });

    return () => {
      if (cancelTimer) cancelTimer();
      // Reset so splash screen reappears when coming back to home
      setHomeReady(false);
    };
  }, [loadCacheOrFallback, setHomeReady]);

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
      case 'featured_category':
        if (settings.sourceDetails && settings.sourceDetails.length > 0) {
          const catId = settings.sourceDetails[0];
          result = visibleProducts.filter(p => isProductInCategory(p, catId, categories));
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
                    <HeroBanner banner={banners[currentBanner]} isEager={currentBanner === 0} onLoad={handleBannerImageLoaded} />
                  </Link>
                ) : (
                  <HeroBanner banner={banners[currentBanner]} isEager={currentBanner === 0} onLoad={handleBannerImageLoaded} />
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

      {/* 1.2 LIVE AND UPCOMING LIVE SHOP SECTIONS */}
      <HomeLiveShopSection />

      {/* 1.5 CATEGORY EXPOSITION */}
      {(loading || categories.length > 0) && (
        <section className="bg-black py-10 md:py-20 border-b border-zinc-900 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 relative">
            <h2 
              className="text-center text-white mb-8 md:mb-14 uppercase select-none font-light tracking-[0.12em] sm:tracking-[0.25em] whitespace-nowrap overflow-hidden text-ellipsis px-2"
              style={{ fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}
            >
              COMPRE <span className="font-extrabold" style={{ color: 'var(--highlight-color)' }}>POR CATEGORIA</span>
            </h2>

            <div className="relative flex items-center group/carousel select-none">
              {/* Slider list */}
              <div 
                ref={categoriesScrollRef}
                className="w-full flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth py-6 px-4"
              >
                {loading ? (
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="flex flex-col items-center shrink-0 w-[180px] h-[180px] md:w-[280px] md:h-[280px] rounded-full animate-pulse bg-zinc-900 border border-zinc-850" />
                  ))
                ) : (
                  categories.map(cat => (
                    <Link 
                      key={cat.id} 
                      to={`/catalogo?categoria=${cat.slug || cat.id}`} 
                      className="snap-center shrink-0 group relative flex flex-col items-center justify-center w-[180px] h-[180px] md:w-[280px] md:h-[280px] rounded-full overflow-hidden border-2 transition-all duration-500 hover:scale-105 shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_30px_var(--color-primary-glow)] cursor-pointer"
                      style={{ borderColor: 'var(--primary-color)' }}
                    >
                      {/* Original image underlay blurred but still visible structure */}
                      <div className="absolute inset-0 w-full h-full scale-110">
                        {cat.image?.url ? (
                          <SafeOptimizedImage 
                            src={cat.image.url} 
                            alt={cat.name} 
                            width={320}
                            quality={75}
                            className="w-full h-full object-cover blur-[6px] opacity-65 group-hover:opacity-80 transition-all duration-700 ease-out group-hover:scale-110" 
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-950 animate-pulse" />
                        )}
                        {/* Core/primary color of the active theme with opacity for superb colorful styling */}
                        <div 
                          className="absolute inset-0 opacity-55 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-45" 
                          style={{ backgroundColor: 'var(--primary-color)' }}
                        />
                        <div className="absolute inset-0 bg-black/30" />
                      </div>

                      {/* Accent/highlight color text inside */}
                      <div className="relative z-10 text-center px-4 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105">
                        <h3 
                          className="text-sm md:text-xl font-black uppercase tracking-[2px] font-sans drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
                          style={{ color: 'var(--highlight-color)' }}
                        >
                          {cat.name}
                        </h3>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 1.3 STORY SHOP */}
      <StoryShopCarousel />

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

      {/* LOCAL SEO BRANDING INTRO */}
      <section className="bg-black py-16 px-4 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight italic text-white leading-tight">
            Discreta Boutique | <span className="text-red-600">Sex Shop</span> e Boutique Íntima em Icó - CE
          </h1>
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            A <strong className="text-white">Discreta Boutique</strong> é sua boutique íntima de referência em Icó, Ceará. Combinamos elegância e sensualidade em um catálogo exclusivo de lingeries finas, cosméticos sensuais refinados, kits românticos e estimuladores de altíssima qualidade para momentos inesquecíveis.
          </p>
          <p className="text-zinc-500 text-xs md:text-sm leading-relaxed max-w-2xl mx-auto">
            Se você busca o melhor <strong className="text-zinc-400">sex shop em Icó</strong> com entrega ultra discreta e sigilo absoluto, cuidamos de cada detalhe — da embalagem externa neutra e sem logotipos até o faturamento sigiloso em sua fatura. Compre online de forma segura e receba com total privacidade.
          </p>
        </div>
      </section>

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


export { BenefitItem } from '../../components/home/BenefitItem';
// Note: BenefitItem and ProductCarousel have been moved to ../../components/home/

