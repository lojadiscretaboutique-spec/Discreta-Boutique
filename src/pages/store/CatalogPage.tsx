import { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, X, Minus, Plus, Frown, Loader2, Truck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Product, productService } from '../../services/productService';
import { getRankingProfissional } from '../../lib/ranking';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../../store/cartStore';
import { catalogSectionsService, SECTION_METADATA, CatalogSection } from '../../services/catalogSectionsService';
import { usePromotion } from '../../contexts/PromotionContext';

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qCat = searchParams.get('categoria');
  const qSearch = searchParams.get('q');
  const qSection = searchParams.get('secao');
  const qSubcat = searchParams.get('subcategoria');
  const qCollection = searchParams.get('colecao');

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(qSearch || '');
  const [selectedCat, setSelectedCat] = useState<string>(qCat || 'all');
  const [selectedSection, setSelectedSection] = useState<string | null>(qSection);
  const [selectedSubcat, setSelectedSubcat] = useState<string | null>(qSubcat);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(qCollection);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const lastRankedSection = useRef<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  const updateCategoryParam = (catValue: string | 'all', clearSearch = true) => {
    const newParams = new URLSearchParams(searchParams);
    
    // Clear search but keep other contextual filters
    if (clearSearch) {
      setSearch('');
      newParams.delete('q');
    }

    if (catValue === 'all') {
      newParams.delete('categoria');
    } else {
      // Find the slug for this ID if we're passing an ID, or vice versa
      // But here we receive from the buttons which use IDs (mostly)
      // Actually, it's safer to check what we have
      const cat = categories.find(c => c.id === catValue || c.slug === catValue);
      if (cat) {
        newParams.set('categoria', cat.slug || cat.id);
      } else {
        newParams.set('categoria', catValue);
      }
    }
    setSearchParams(newParams);
    
    // Also update local state for immediate feedback
    if (catValue === 'all') {
      setSelectedCat('all');
    } else {
      const found = categories.find(c => c.id === catValue || c.slug === catValue);
      if (found) setSelectedCat(found.id);
    }
  };

  const handleRealSearch = async (forcedSearch?: string) => {
    const searchTerm = typeof forcedSearch === 'string' ? forcedSearch : search;
    
    if (!searchTerm?.trim()) return;

    // Reset categories and contextual filters to ensure search covers the entire catalog
    setSelectedCat('all');
    setSelectedSection(null);
    setSelectedSubcat(null);
    setSelectedCollection(null);

    const newParams = new URLSearchParams(searchParams);
    newParams.delete('categoria');
    newParams.delete('secao');
    newParams.delete('subcategoria');
    newParams.delete('colecao');
    newParams.set('q', searchTerm.trim());
    setSearchParams(newParams);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    setSearching(true);
    // Standard local ranking is used in the filter effect
    setSearching(false);
  };

  const trackProductClick = async (productId: string) => {
    // Register for overall ranking
    productService.trackInteraction(productId, 'click');
  };

  const isCategoriesEmpty = categories.length === 0;
  useEffect(() => {
    if (qSearch) {
      handleRealSearch(qSearch);
    }
  }, [qSearch]);

  useEffect(() => {
    async function loadData() {
      try {
        const CACHE_VERSION = 'v3'; // To force clear old incorrect stock sums and ensure SEO data
        const now = Date.now();
        const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

        let catsData: Category[] = [];
        const cachedCats = sessionStorage.getItem(`catalog_cats_${CACHE_VERSION}`);
        const catTime = sessionStorage.getItem(`catalog_cats_time_${CACHE_VERSION}`);
        
        if (cachedCats && catTime && now - parseInt(catTime) < CACHE_TTL) {
          catsData = JSON.parse(cachedCats);
        } else {
          const cSnap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
          catsData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Category));
          try {
            // Save minimized version to avoid quota issues
            const minimizedCats = catsData.map(c => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              parentId: c.parentId,
              level: c.level
            }));
            sessionStorage.setItem(`catalog_cats_${CACHE_VERSION}`, JSON.stringify(minimizedCats));
            sessionStorage.setItem(`catalog_cats_time_${CACHE_VERSION}`, now.toString());
          } catch (e) {
            // Silently fail if quota exceeded
          }
        }
        setCategories(catsData);
        
        let prods: Product[] = [];
        const cachedProducts = sessionStorage.getItem(`catalog_products_${CACHE_VERSION}`);
        const prodTime = sessionStorage.getItem(`catalog_products_time_${CACHE_VERSION}`);

        if (cachedProducts && prodTime && now - parseInt(prodTime) < CACHE_TTL) {
          try {
            prods = JSON.parse(cachedProducts);
          } catch (e) {
            console.warn('Failed to parse cached products', e);
          }
        }

        if (prods.length === 0) {
          const [pSnap, cSnap] = await Promise.all([
            getDocs(query(collection(db, 'products'), where('active', '==', true))),
            getDocs(query(collection(db, 'combos'), where('active', '==', true), where('showInCatalog', '==', true)))
          ]);

          const regularProds = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
          const combosAsProducts = cSnap.docs.map(d => {
            const combo = d.data() as Combo;
            return {
              id: d.id,
              name: combo.name,
              description: combo.description,
              price: combo.price,
              images: combo.images || (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
              categoryId: 'combos', // Treat as a special category or use the first one from combo.categories
              active: combo.active,
              isCombo: true,
              showInCatalog: combo.showInCatalog,
              featured: combo.isFeatured,
              seo: {
                title: combo.seoTitle,
                description: combo.seoDescription
              }
            } as any;
          });

          prods = [...regularProds, ...combosAsProducts];
          
          try {
            // Minimize product data for session storage more aggressively
            const minimizedProds = prods.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              promoPrice: p.promoPrice,
              images: p.images?.slice(0, 1), // Only first image for cache
              categoryId: p.categoryId,
              stock: p.stock,
              controlStock: p.controlStock,
              allowBackorder: p.allowBackorder,
              extras: p.extras,
              seo: { keywords: p.seo?.keywords, slug: p.seo?.slug },
              ai_keywords: p.ai_keywords,
              ai_synonyms: p.ai_synonyms,
              searchTerms: p.searchTerms,
              newRelease: p.newRelease,
              hasVariants: p.hasVariants,
              sku: p.sku,
              isCombo: (p as any).isCombo
            }));
            
            const serialized = JSON.stringify(minimizedProds);
            // Only save if under a reasonable limit for sessionStorage (usually 5MB total, but let's be safe per item)
            if (serialized.length < 4 * 1024 * 1024) { 
               sessionStorage.setItem(`catalog_products_${CACHE_VERSION}`, serialized);
               sessionStorage.setItem(`catalog_products_time_${CACHE_VERSION}`, now.toString());
            }
          } catch (e) {
            console.warn('[CATALOG][CACHE] Quota exceeded or failure. Reverting to memory-only for this session.');
          }
        }

        // Filter products: Strictly active, with at least one image and showInCatalog marked
        const visibleProds = prods.filter(p => 
          p.active !== false &&
          (p.images && p.images.length > 0) &&
          (p.extras?.showInCatalog !== false) &&
          (!p.controlStock || p.allowBackorder || (Number(p.stock) || 0) > 0)
        );

        console.log(`[CATALOG][LOAD] Total Loaded: ${prods.length} | Visible: ${visibleProds.length}`);

        // Identify which categories have at least one visible product
        const categoryIdsWithProducts = new Set<string>();
        visibleProds.forEach(p => {
          if (p.categoryId) {
            categoryIdsWithProducts.add(p.categoryId);
            // Also add all parents
            let parent = catsData.find(c => c.id === p.categoryId);
            while (parent && parent.parentId) {
              categoryIdsWithProducts.add(parent.parentId);
              parent = catsData.find(c => c.id === parent?.parentId);
            }
          }
        });

        // Filter categories: Only those that have products (directly or in subcats)
        const visibleCats = catsData.filter(c => categoryIdsWithProducts.has(c.id));

        setCategories(visibleCats);

        // Resolve params from URL
        const resolveParams = () => {
          const s = searchParams.get('secao');
          const cat = searchParams.get('categoria');
          const sub = searchParams.get('subcategoria');
          const col = searchParams.get('colecao');
          const q = searchParams.get('q');

          setSelectedSection(s);
          setSelectedSubcat(sub);
          setSelectedCollection(col);
          if (q !== null) setSearch(q);

          if (cat && cat !== 'all') {
            const found = catsData.find(c => c.id === cat || c.slug === cat);
            if (found) setSelectedCat(found.id);
            else setSelectedCat('all');
          } else {
            setSelectedCat('all');
          }
        };

        resolveParams();
        setProducts(visibleProds);
        setFiltered(visibleProds);
      } catch (error) {
        console.error("Error loading catalog:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchParams, isCategoriesEmpty]); // Categories dependency is handled inside loadData but we need to re-run if params change

  useEffect(() => {
    async function rankSpecialSections() {
      // Local ranking for special sections to avoid extra AI calls
      const rankKey = `${selectedSection}-${filtered.length}`;
      if (selectedSection === 'promocoes' && filtered.length > 0 && lastRankedSection.current !== rankKey) {
        // Optimized local sort for promotions (biggest discount first)
        const sorted = [...filtered].sort((a, b) => {
          const discountA = a.price > 0 ? (a.price - (a.promoPrice || a.price)) / a.price : 0;
          const discountB = b.price > 0 ? (b.price - (b.promoPrice || b.price)) / b.price : 0;
          return discountB - discountA;
        });
        lastRankedSection.current = rankKey;
        setFiltered(sorted);
      }
    }
    rankSpecialSections();
  }, [selectedSection, filtered]); 

  useEffect(() => {
    const getAllChildCategoryIds = (catId: string): string[] => {
      const children = categories.filter(c => c.parentId === catId);
      let ids = [catId];
      children.forEach(child => {
        ids = [...ids, ...getAllChildCategoryIds(child.id)];
      });
      return ids;
    };

    let result = [...products];
    const startTime = Date.now();

    // 1. Filtro de Seção (Home Context)
    if (selectedSection) {
      result = catalogSectionsService.applySectionLogic(result, selectedSection as CatalogSection);
      
      // Se for recomendados, podemos tentar um ranqueamento IA se houver poucos itens
      // ou apenas registrar que estamos em uma sessão especial.
      if (selectedSection === 'recomendados' && result.length > 0) {
        // AI logic could go here if needed, but for now we follow the centralized service
      }
    }

    // 2. Filtro de Coleção (Atributo manual)
    if (selectedCollection) {
      const col = selectedCollection.toLowerCase();
      result = result.filter(p => 
        (p as any).colecoes?.includes(col) || 
        (p.tags || []).some(t => String(t).toLowerCase() === col)
      );
    }

    // 3. Filtro de Subcategoria (Texto ou Atributo)
    if (selectedSubcat) {
      const sub = selectedSubcat.toLowerCase();
      result = result.filter(p => 
        String(p.subcategory || "").toLowerCase() === sub || 
        (p as any).subcategoria?.toLowerCase() === sub
      );
    }

    // 4. Filtro de Categoria (Hierárquico)
    if (selectedCat !== 'all') {
      const allCategoryIds = getAllChildCategoryIds(selectedCat);
      result = result.filter(p => p.categoryId && allCategoryIds.includes(p.categoryId));
      console.log(`[FILTER][CATEGORY] Found ${result.length} products for cat ${selectedCat}`);
    }

    // 5. Filtro de Busca (Profissional Local)
    if (search.trim()) {
      // Use standard local ranking as requested by customer
      result = getRankingProfissional(result, search, categories);
      console.log(`[CATALOG][PROFESSIONAL_SEARCH] Found ${result.length} matches for "${search}"`);
    }

    console.log(`[CATALOG][FILTER_COMPLETE] ${result.length} results | Time: ${Date.now() - startTime}ms`);
    
    setFiltered(result);
    setCurrentPage(1);
  }, [search, selectedCat, selectedSection, selectedSubcat, selectedCollection, products, categories]);

  const getContextTitle = () => {
    if (search) return `Resultados para "${search}"`;
    
    let baseTitle = '';
    if (selectedSection) {
      const meta = SECTION_METADATA[selectedSection as CatalogSection];
      baseTitle = meta?.title || 'Coleção';
    } else if (selectedSubcat) {
      baseTitle = selectedSubcat.charAt(0).toUpperCase() + selectedSubcat.slice(1);
    } else if (selectedCollection) {
      baseTitle = selectedCollection.charAt(0).toUpperCase() + selectedCollection.slice(1);
    }

    const cat = categories.find(c => c.id === selectedCat);
    
    if (baseTitle && cat) {
      return `${baseTitle} > ${cat.name}`;
    } else if (baseTitle) {
      return `Explorando ${baseTitle}`;
    } else if (cat) {
      return `Produtos ${cat.name}`;
    }
    
    return 'Nosso Catálogo';
  };

  const rootCategories = categories.filter(c => c.level === 0 || !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

  // Check if current selected is a subcategory to find its parent for the UI
  const currentCategory = categories.find(c => c.id === selectedCat);
  const activeRootId = currentCategory?.parentId || (currentCategory?.level === 0 ? currentCategory.id : null);
  const activeSubcategories = activeRootId ? getSubcategories(activeRootId) : [];

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-white min-h-screen">
      {/* Category Navigation - More Compact */}
      <section className="bg-zinc-950 border-b border-zinc-900 pt-6 pb-4 px-4 sticky top-14 md:top-16 z-30 backdrop-blur-md bg-black/95">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="space-y-2">
            {/* Root Categories Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5">
              <button 
                onClick={() => updateCategoryParam('all')}
                className={cn(
                  "whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  selectedCat === 'all' 
                    ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-900/20" 
                    : "bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:border-zinc-700"
                )}
              >
                Todos
              </button>
              {rootCategories.map(c => (
                <button 
                  key={c.id}
                  onClick={() => updateCategoryParam(c.id)}
                  className={cn(
                    "whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                    activeRootId === c.id 
                      ? "bg-white text-red-600 border-white shadow-sm" 
                      : "bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:border-zinc-700"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Subcategories - Mini Row */}
            <AnimatePresence mode="wait">
              {activeRootId && activeSubcategories.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1 border-t border-zinc-900/30 pt-2"
                >
                  <button 
                    onClick={() => updateCategoryParam(activeRootId!)}
                    className={cn(
                      "whitespace-nowrap px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all",
                      selectedCat === activeRootId 
                        ? "text-red-500 bg-red-500/5" 
                        : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    Tudo
                  </button>
                  {activeSubcategories.map(sub => (
                    <button 
                      key={sub.id}
                      onClick={() => updateCategoryParam(sub.id)}
                      className={cn(
                        "whitespace-nowrap px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all",
                        selectedCat === sub.id 
                          ? "text-red-500 bg-red-500/5" 
                          : "text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto w-full px-4 py-8">
        {/* Context Header */}
        {(selectedSection || selectedSubcat || selectedCollection || (selectedCat !== 'all' && !search)) && (
          <div className="mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] overflow-hidden bg-zinc-950 border border-zinc-900 border-dashed"
            >
              {/* Decorative elements for sections */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] -z-10 rounded-full" />
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 text-center md:text-left">
                <div>
                  {selectedSection && (
                    <span className="inline-block bg-red-600 text-white text-[9px] font-black uppercase tracking-[3px] px-4 py-1.5 rounded-full mb-4 shadow-xl shadow-red-900/20">
                      {SECTION_METADATA[selectedSection as CatalogSection]?.badge || 'Coleção'}
                    </span>
                  )}
                  <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic text-white mb-4 leading-[0.9]">
                    {getContextTitle()}
                  </h1>
                  {selectedSection && (
                    <p className="text-zinc-500 font-bold text-sm md:text-lg max-w-2xl leading-relaxed">
                      {SECTION_METADATA[selectedSection as CatalogSection]?.description}
                    </p>
                  )}
                  <div className="w-20 h-1.5 bg-red-600 rounded-full mt-6 mx-auto md:mx-0"></div>
                </div>

                <div className="flex justify-center md:justify-end">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white border-zinc-800 rounded-2xl px-8 py-7 h-auto bg-black/40 backdrop-blur-sm"
                    onClick={() => {
                      setSearchParams({});
                      setSelectedCat('all');
                      setSelectedSection(null);
                      setSelectedSubcat(null);
                      setSelectedCollection(null);
                      setSearch('');
                    }}
                  >
                    Ver catálogo completo
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Results Info */}
        <div className="flex justify-between items-center mb-8">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[2px]">
            {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
          </p>
          {(selectedCat !== 'all' || search || selectedSection || selectedSubcat || selectedCollection) && (
            <button 
              onClick={() => { 
                updateCategoryParam('all');
                setSearch(''); 
                setSelectedSection(null);
                setSelectedSubcat(null);
                setSelectedCollection(null);
                const newParams = new URLSearchParams();
                setSearchParams(newParams);
              }}
              className="text-[10px] font-black text-red-500 uppercase tracking-[2px] hover:underline flex items-center gap-1"
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Product Grid - Optimized Columns */}
        <main className="w-full">
          {searching ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-12"
              >
                <div className="absolute inset-0 bg-red-600/10 blur-[60px] rounded-full animate-pulse"></div>
                <div className="w-24 h-24 bg-zinc-900 border-2 border-zinc-800 rounded-full flex items-center justify-center text-red-500 relative z-10">
                  <Search size={40} className="animate-pulse" />
                </div>
              </motion.div>
              
              <h3 className="text-white font-black text-2xl md:text-3xl mb-4 tracking-tighter uppercase">
                Buscando no Catálogo...
              </h3>
              <div className="flex items-center gap-3 text-red-500 font-black uppercase tracking-[0.2em] text-[10px]">
                <Loader2 className="animate-spin" size={14} />
                Localizando produtos reais
              </div>
            </motion.div>
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 mt-6">
              {[1,2,3,4,5,6,7,8,9,10].map(i => (
                <div key={i} className="aspect-[4/5] bg-zinc-900 rounded-3xl border border-zinc-800 animate-pulse"></div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-32 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-[4rem] mt-6 flex flex-col items-center max-w-4xl mx-auto shadow-2xl"
            >
              <motion.div 
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="mb-8 flex justify-center"
              >
                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 border border-zinc-800 shadow-inner">
                  <Frown size={48} strokeWidth={1.5} />
                </div>
              </motion.div>
              
              <h3 className="text-white font-black text-2xl md:text-3xl mb-4 tracking-tighter px-6 uppercase">
                Produtos Não Encontrados
              </h3>
              
              <p className="text-zinc-500 font-bold text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed px-8">
                Tente buscar por termos mais genéricos ou verifique se a categoria selecionada possui o item que você procura.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 px-6 w-full justify-center">
                <Button 
                  variant="outline" 
                  className="rounded-2xl border-zinc-700 hover:bg-zinc-900 font-black px-12 py-7 h-auto uppercase tracking-widest text-[11px] transition-all bg-zinc-950/80"
                  onClick={() => { 
                    setSearch(''); 
                    updateCategoryParam('all');
                  }}
                >
                  <X size={14} className="mr-2" /> Limpar Filtros
                </Button>
              </div>

              <div className="mt-12 p-4 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 max-w-xs">
                <p className="text-[10px] text-zinc-600 font-medium italic">
                  Dica: Busque pelo nome do produto ou pela categoria (ex: "vibradores", "algemas").
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              <div id="products-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 scroll-mt-32 mt-6">
                <AnimatePresence mode="popLayout">
                  {paginatedProducts.map((p) => (
                    <motion.div
                      layout
                      key={p.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ProductGridCard 
                        product={p} 
                        onItemClick={() => trackProductClick(p.id!)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-12 bg-zinc-900/50 p-2 rounded-full w-fit mx-auto border border-zinc-800">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    &lt;
                  </button>
                  {startPage > 1 && (
                    <>
                      <button onClick={() => handlePageChange(1)} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">1</button>
                      {startPage > 2 && <span className="text-zinc-600">...</span>}
                    </>
                  )}
                  {pageNumbers.map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm",
                        currentPage === page 
                          ? "bg-red-600 text-white" 
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                  {endPage < totalPages && (
                    <>
                      {endPage < totalPages - 1 && <span className="text-zinc-600">...</span>}
                      <button onClick={() => handlePageChange(totalPages)} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">{totalPages}</button>
                    </>
                  )}
                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ProductGridCard({ product, onItemClick }: { product: Product, onItemClick?: () => void }) {
  const { calculateProductPrice } = usePromotion();
  const pricing = calculateProductPrice({
    id: product.id!,
    categoryId: product.categoryId,
    price: product.price,
    promoPrice: product.promoPrice
  });

  const image = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
  const isOut = product.controlStock && !product.allowBackorder && product.stock <= 0;
  
  const finalPrice = pricing.price;
  const originalPrice = pricing.originalPrice;
  const hasPromo = (!!product.promoPrice && product.promoPrice < product.price) || !!pricing.promotion;
  
  const hasVariants = !!product.hasVariants;
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore(s => s.addItem);
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      navigate(`/produto/${product.seo?.slug || product.id}?id=${product.id}`);
    } else {
      addItem({
        id: `${product.id}-base`,
        productId: product.id,
        name: product.name,
        price: finalPrice,
        costPrice: product.costPrice || 0,
        quantity: quantity,
        sku: product.sku,
        gtin: product.gtin,
        imageUrl: image || '',
        variantId: undefined,
        variantName: undefined,
        isFreeShipping: pricing.isFreeShipping
      });
      // Track conversion
      productService.trackInteraction(product.id!, 'conversion');
      navigate('/carrinho');
    }
  };
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}?id=${product.id}`} 
      onClick={() => onItemClick?.()}
      className={cn(
        "group relative bg-zinc-950/40 rounded-[2.5rem] overflow-hidden flex flex-col border border-zinc-900 transition-all duration-700 h-full",
        isOut ? "grayscale opacity-40" : "hover:border-red-600/30 hover:bg-zinc-950 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] hover:shadow-red-900/10"
      )}
    >
      <div className="aspect-[3/4] relative bg-white overflow-hidden group-hover:bg-zinc-50 transition-colors duration-500">
        {image ? (
          <img 
            src={image || undefined} 
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
              {pricing.promotion?.name || 'Oferta'}
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
        <h3 className="text-xs md:text-sm font-medium text-zinc-300 group-hover:text-white transition-colors duration-300 line-clamp-4 leading-snug min-h-[4.25rem] md:min-h-[4.875rem] mb-3 capitalize">
          {product.name.toLowerCase()}
        </h3>

        {/* Frete Grátis Label - Positioning between Title and Price */}
        {pricing.isFreeShipping && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[8px] md:text-[10px] font-black uppercase tracking-[2px] px-3 py-1 rounded-md shadow-lg shadow-emerald-900/20">
              <Truck size={10} className="md:w-3 md:h-3" /> Frete Grátis
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col w-full relative">
          <div className="flex flex-col gap-0.5 mb-3">
            {/* Preço Anterior (Riscado) */}
            {hasPromo && (
              <span className="text-[10px] md:text-xs text-zinc-500 font-bold line-through opacity-70 tracking-tighter">
                {formatCurrency(originalPrice)}
              </span>
            )}

            {/* Preço Atual */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-base md:text-lg font-black text-red-600 tracking-tighter">
                {formatCurrency(finalPrice)}
              </span>
              <span className="text-[9px] md:text-xs font-bold text-red-600 tracking-tight uppercase">no pix</span>
            </div>
            
            {/* Parcelamento */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold tracking-tight uppercase">
                OU 10X DE {(() => {
                  const promo = pricing.promotion;
                  const isPromoRestrictedToCashOnly = !!(promo && promo.allowedPaymentMethods && promo.allowedPaymentMethods.length > 0 && !promo.allowedPaymentMethods.includes('credit_card'));
                  const installmentBasePrice = isPromoRestrictedToCashOnly ? originalPrice : finalPrice;
                  return formatCurrency(installmentBasePrice / 10);
                })()} SEM JUROS
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

