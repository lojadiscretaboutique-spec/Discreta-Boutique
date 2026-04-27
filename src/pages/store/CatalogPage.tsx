import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, ShoppingBag, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Product } from '../../services/productService';
import { Category } from '../../services/categoryService';

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const qCat = searchParams.get('categoria');

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
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
        
        // Auto-expand category if passed in URL and it's a subcategory
        if (qCat) {
          const selected = catsData.find(c => c.id === qCat);
          if (selected && selected.parentId) {
            setExpandedCats(prev => [...prev, selected.parentId!]);
          }
        }
        
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

        setProducts(prods);
        setFiltered(prods);
      } catch (error) {
        console.error("Error loading catalog:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [qCat]);

  useEffect(() => {
    let result = products;
    if (selectedCat !== 'all') {
      result = result.filter(p => p.categoryId === selectedCat);
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
  }, [search, selectedCat, products]);

  const toggleExpand = (catId: string) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  const rootCategories = categories.filter(c => c.level === 0 || !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

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
      {/* Header / Search Area */}
      <section className="bg-zinc-950 border-b border-zinc-900 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic">Catálogo</h1>
            <p className="text-red-500 font-bold text-xs uppercase tracking-[3px] mt-2">Escolha com prazer</p>
          </div>
          <div className="w-full max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
            <Input 
              type="text"
              placeholder="O que você deseja hoje?" 
               className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-4 rounded-full focus:outline-none focus:ring-2 focus:ring-red-600 font-medium placeholder:text-zinc-700 transition-all shadow-xl h-auto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto w-full px-4 py-12 flex flex-col md:flex-row gap-12">
        {/* Simple pill filters for categories - Good for PWA/Mobile */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-28 space-y-8">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[3px] text-zinc-500 mb-6 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                 Categorias
              </h3>
              <div className="flex flex-col gap-3 overflow-x-auto no-scrollbar md:overflow-visible pb-4 md:pb-0">
                <button 
                  onClick={() => setSelectedCat('all')}
                  className={cn(
                    "whitespace-nowrap px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all border text-left",
                    selectedCat === 'all' 
                      ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/20" 
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-red-600"
                  )}
                >
                  Todos
                </button>
                {rootCategories.map(c => {
                  const subcats = getSubcategories(c.id);
                  const hasChildren = subcats.length > 0;
                  const isExpanded = expandedCats.includes(c.id);
                  const isSelected = selectedCat === c.id;

                  return (
                    <div key={c.id} className="flex flex-col gap-2">
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => setSelectedCat(c.id)}
                          className={cn(
                            "whitespace-nowrap flex-1 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all border text-left",
                            isSelected 
                              ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/20" 
                              : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-red-600"
                          )}
                        >
                          {c.name}
                        </button>
                        {hasChildren && (
                          <button 
                            onClick={() => toggleExpand(c.id)}
                            className={cn(
                              "flex shrink-0 justify-center items-center w-11 h-11 border rounded-full transition-colors",
                              isExpanded 
                                ? "bg-red-600/10 border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white" 
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-500 hover:border-red-600"
                            )}
                          >
                            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>
                        )}
                      </div>
                      
                      {isExpanded && hasChildren && (
                        <div className="flex flex-col gap-2 pl-4 border-l border-zinc-800 ml-5 mt-1">
                          {subcats.map(sub => (
                            <button 
                              key={sub.id}
                              onClick={() => setSelectedCat(sub.id)}
                              className={cn(
                                "whitespace-nowrap px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border text-left",
                                selectedCat === sub.id 
                                  ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/20" 
                                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-red-500 hover:bg-zinc-800"
                              )}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="hidden md:block bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
               <h4 className="text-sm font-bold mb-4">Privacidade Atômica</h4>
               <p className="text-xs text-zinc-500 leading-relaxed">
                 Nossa entrega é 100% blindada. Embalagem neutra e checkout sigiloso via WhatsApp.
               </p>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="aspect-[4/5] bg-zinc-900 rounded-2xl border border-zinc-800 animate-pulse"></div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32 bg-zinc-950 border border-zinc-900 rounded-[3rem]">
              <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm mb-6">Nenhum desejo encontrado.</p>
              <Button 
                variant="outline" 
                className="rounded-full border-zinc-800 hover:bg-zinc-900 font-bold px-8"
                onClick={() => { setSearch(''); setSelectedCat('all'); }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedProducts.map((p) => (
                  <ProductGridCard key={p.id} product={p} />
                ))}
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
        "group bg-zinc-900 rounded-2xl overflow-hidden flex flex-col border border-zinc-800 transition-all duration-500",
        isOut ? "grayscale opacity-60" : "hover:border-red-600"
      )}
    >
      <div className="aspect-[4/5] relative bg-zinc-800 overflow-hidden">
        {image ? (
          <img 
            src={image} 
            alt={product.name} 
            className={cn(
              "w-full h-full object-cover transition-transform duration-700",
              !isOut && "group-hover:scale-110"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs text-center px-4">Sem Imagem</div>
        )}
        
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

