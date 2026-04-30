import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, ShoppingBag, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Product } from '../../services/productService';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';

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

        // Filter out products that have showInCatalog explicitly set to false
        const visibleProds = prods.filter(p => !p.extras || p.extras.showInCatalog !== false);
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

  return (
    <div className="flex-1 flex flex-col bg-black text-white min-h-screen">
      {/* Header / Search Area - More Compact and Sticky-friendly */}
      <section className="bg-zinc-950 border-b border-zinc-900 pt-8 pb-6 px-4 sticky top-16 z-30 backdrop-blur-md bg-black/90">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="hidden md:block">
              <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter italic">Catálogo</h1>
            </div>
            
            <div className="w-full max-w-xl relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-500 transition-colors" size={18} />
              <Input 
                type="text"
                placeholder="O que você deseja hoje?" 
                className="w-full bg-zinc-900/50 border-zinc-800 text-white pl-12 pr-4 py-6 rounded-2xl focus:ring-red-600 font-medium placeholder:text-zinc-600 transition-all h-auto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Category Navigation - Highly Ergonomic for Mobile */}
          <div className="space-y-4">
            {/* Root Categories Horizontal Scroll */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              <button 
                onClick={() => setSelectedCat('all')}
                className={cn(
                  "whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                  selectedCat === 'all' 
                    ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/40" 
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                )}
              >
                Todos
              </button>
              {rootCategories.map(c => (
                <button 
                  key={c.id}
                  onClick={() => setSelectedCat(c.id)}
                  className={cn(
                    "whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                    activeRootId === c.id 
                      ? "bg-white text-black border-white shadow-lg" 
                      : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Subcategories - Secondary Row if Root Selected */}
            <AnimatePresence mode="wait">
              {activeRootId && activeSubcategories.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1 border-t border-zinc-900/50 pt-3"
                >
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mr-2 shrink-0">Sub:</span>
                  <button 
                    onClick={() => setSelectedCat(activeRootId)}
                    className={cn(
                      "whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      selectedCat === activeRootId 
                        ? "text-red-500 bg-red-500/10" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Ver Tudo
                  </button>
                  {activeSubcategories.map(sub => (
                    <button 
                      key={sub.id}
                      onClick={() => setSelectedCat(sub.id)}
                      className={cn(
                        "whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        selectedCat === sub.id 
                          ? "text-red-500 bg-red-500/10" 
                          : "text-zinc-500 hover:text-zinc-300"
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
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    &lt;
                  </button>
                  {startPage > 1 && (
                    <>
                      <button onClick={() => setCurrentPage(1)} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">1</button>
                      {startPage > 2 && <span className="text-zinc-600">...</span>}
                    </>
                  )}
                  {pageNumbers.map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
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
                      <button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">{totalPages}</button>
                    </>
                  )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}`} 
      className={cn(
        "group bg-zinc-900/40 rounded-[2rem] overflow-hidden flex flex-col border border-zinc-900 transition-all duration-500",
        isOut ? "grayscale opacity-40" : "hover:border-red-600/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-red-900/10"
      )}
    >
      <div className="aspect-[4/5] relative bg-zinc-900 overflow-hidden">
        {image ? (
          <img 
            src={image} 
            alt={product.name} 
            className={cn(
              "w-full h-full object-cover transition-transform duration-1000 ease-out",
              !isOut && "group-hover:scale-110"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-800 text-xs text-center px-4">Sem Imagem</div>
        )}
        
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.newRelease && (
            <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">New</span>
          )}
          {!!product.promoPrice && product.promoPrice < product.price && !isOut && (
            <span className="bg-white text-black text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">Sale</span>
          )}
        </div>

        {isOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-white text-black text-[8px] font-black uppercase tracking-[2px] px-4 py-2 rounded-full border shadow-xl">Esgotado</span>
          </div>
        )}
        
        {/* Quick Add overlay or something hidden could go here if requested, but keep it clean for now */}
      </div>
      
      <div className="p-4 md:p-6 flex flex-col flex-1">
        <h3 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-red-500 transition-colors line-clamp-2 leading-snug min-h-[40px]">
          {product.name}
        </h3>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-col">
            {!!product.promoPrice && product.promoPrice < product.price && !isOut ? (
              <>
                <span className="text-[10px] text-zinc-500 line-through opacity-50">{formatCurrency(product.price)}</span>
                <span className="text-sm md:text-base font-black text-white tracking-tighter">{formatCurrency(product.promoPrice)}</span>
              </>
            ) : (
              <span className="text-sm md:text-base font-black text-white tracking-tighter">{formatCurrency(product.price)}</span>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-red-500">
             <ShoppingBag size={14} />
          </div>
        </div>
      </div>
    </Link>
  );
}

