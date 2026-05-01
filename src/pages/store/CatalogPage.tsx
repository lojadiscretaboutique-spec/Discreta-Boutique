import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, ShoppingBag, X, Minus, Plus } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Product } from '../../services/productService';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../../store/cartStore';

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const qCat = searchParams.get('categoria');

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(qCat || 'all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  useEffect(() => {
    async function loadData() {
      try {
        const now = Date.now();
        const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

        let catsData: Category[] = [];
        const cachedCats = sessionStorage.getItem('catalog_cats');
        const catTime = sessionStorage.getItem('catalog_cats_time');
        
        if (cachedCats && catTime && now - parseInt(catTime) < CACHE_TTL) {
          catsData = JSON.parse(cachedCats);
        } else {
          const cSnap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
          catsData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Category));
          sessionStorage.setItem('catalog_cats', JSON.stringify(catsData));
          sessionStorage.setItem('catalog_cats_time', now.toString());
        }
        setCategories(catsData);
        
        let prods: Product[] = [];
        const cachedProducts = sessionStorage.getItem('catalog_products');
        const prodTime = sessionStorage.getItem('catalog_products_time');

        if (cachedProducts && prodTime && now - parseInt(prodTime) < CACHE_TTL) {
          prods = JSON.parse(cachedProducts);
        } else {
          const pSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
          prods = pSnap.docs.map(d => ({id: d.id, ...d.data()} as Product));
          sessionStorage.setItem('catalog_products', JSON.stringify(prods));
          sessionStorage.setItem('catalog_products_time', now.toString());
        }

        // Filter products: Must have at least one image and be visible in catalog
        const visibleProds = prods.filter(p => 
          p.images && p.images.length > 0 && 
          (!p.extras || p.extras.showInCatalog !== false)
        );

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
        setProducts(visibleProds);
        setFiltered(visibleProds);
      } catch (error) {
        console.error("Error loading catalog:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [qCat]);

  useEffect(() => {
    const getAllChildCategoryIds = (catId: string): string[] => {
      const children = categories.filter(c => c.parentId === catId);
      let ids = [catId];
      children.forEach(child => {
        ids = [...ids, ...getAllChildCategoryIds(child.id)];
      });
      return ids;
    };

    let result = products;
    if (selectedCat !== 'all') {
      const allCategoryIds = getAllChildCategoryIds(selectedCat);
      result = result.filter(p => p.categoryId && allCategoryIds.includes(p.categoryId));
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(s));
    }

    // Sort by stock status (out of stock last)
    result.sort((a, b) => {
      const aOut = a.controlStock && !a.allowBackorder && a.stock <= 0;
      const bOut = b.controlStock && !b.allowBackorder && b.stock <= 0;
      if (aOut && !bOut) return 1;
      if (!aOut && bOut) return -1;
      return 0;
    });

    setFiltered(result);
    setCurrentPage(1); // Reset to page 1 unconditionally when filtering
  }, [search, selectedCat, products, categories]);

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
      {/* Header / Search Area - Optimized for Space */}
      <section className="bg-zinc-950 border-b border-zinc-900 pt-4 pb-2 px-4 sticky top-14 md:top-16 z-30 backdrop-blur-md bg-black/90">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-500 transition-colors" size={14} />
              <Input 
                type="text"
                placeholder="Pesquisar..." 
                className="w-full bg-zinc-900/50 border-zinc-800 text-white pl-9 pr-4 py-2 rounded-xl focus:ring-1 focus:ring-red-600/50 font-medium placeholder:text-zinc-600 transition-all h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Minimal Title only on Desktop to save height */}
            <div className="hidden lg:block shrink-0">
              <h1 className="text-lg font-black uppercase tracking-tighter italic text-zinc-500">Catálogo</h1>
            </div>
          </div>

          {/* Category Navigation - More Compact */}
          <div className="space-y-2">
            {/* Root Categories Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5">
              <button 
                onClick={() => setSelectedCat('all')}
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
                  onClick={() => setSelectedCat(c.id)}
                  className={cn(
                    "whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                    activeRootId === c.id 
                      ? "bg-white text-black border-white shadow-sm" 
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
                    onClick={() => setSelectedCat(activeRootId)}
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
                      onClick={() => setSelectedCat(sub.id)}
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
        {/* Results Info */}
        <div className="flex justify-between items-center mb-8">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[2px]">
            {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
          </p>
          {(selectedCat !== 'all' || search) && (
            <button 
              onClick={() => { setSelectedCat('all'); setSearch(''); }}
              className="text-[10px] font-black text-red-500 uppercase tracking-[2px] hover:underline flex items-center gap-1"
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Product Grid - Optimized Columns */}
        <main className="w-full">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {[1,2,3,4,5,6,7,8,9,10].map(i => (
                <div key={i} className="aspect-[4/5] bg-zinc-900 rounded-3xl border border-zinc-800 animate-pulse"></div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-center py-32 bg-zinc-950/50 border border-dashed border-zinc-800 rounded-[3rem]"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
                  <Search size={40} />
                </div>
              </div>
              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm mb-6 px-4">Não encontramos o que você procura...</p>
              <Button 
                variant="outline" 
                className="rounded-full border-zinc-800 hover:bg-zinc-900 font-bold px-10 py-6 h-auto uppercase tracking-widest text-[10px]"
                onClick={() => { setSearch(''); setSelectedCat('all'); }}
              >
                Tentar novamente
              </Button>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
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
                      <ProductGridCard product={p} />
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

function ProductGridCard({ product }: { product: Product }) {
  const image = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
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
        imageUrl: image || '',
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
        isOut ? "grayscale opacity-40" : "hover:border-red-600/30 hover:bg-zinc-950 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] hover:shadow-red-900/10"
      )}
    >
      <div className="aspect-[3/4] relative bg-white overflow-hidden group-hover:bg-zinc-50 transition-colors duration-500">
        {image ? (
          <img 
            src={image} 
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
        <h3 className="text-xs md:text-sm font-medium text-zinc-300 group-hover:text-white transition-colors duration-300 line-clamp-2 leading-snug min-h-[2.5rem] md:min-h-[2.75rem] mb-3 capitalize">
          {product.name.toLowerCase()}
        </h3>

        <div className="mt-auto flex flex-col w-full relative">
          <div className="flex flex-col gap-1.5 mb-3">
            {/* A Vista */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] md:text-xs font-bold text-red-600 tracking-tight">à vista</span>
              <span className="text-base md:text-lg font-black text-red-600 tracking-tighter">
                {formatCurrency(hasPromo ? product.promoPrice! : product.price)}
              </span>
            </div>
            
            {/* Installments */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold tracking-tight uppercase">
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

