import { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, X, Minus, Plus, Sparkles, Frown, Loader2 } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Product, productService } from '../../services/productService';
import { getBaseScore, getMatchScore } from '../../lib/ranking';
import { Category } from '../../services/categoryService';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../../store/cartStore';
import { useFeedback } from '../../contexts/FeedbackContext';

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const qCat = searchParams.get('categoria');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(qCat || 'all');
  const [loading, setLoading] = useState(true);
  const [interpreting, setInterpreting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    searchId: string;
    mensagem: string;
    curadoria: string;
    caracteristicas?: string[];
    termos_relacionados?: string[];
    sinonimos?: string[];
    rankedProducts?: any[];
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;
  const { toast } = useFeedback();

  const handleSmartSearch = async () => {
    if (!search.trim()) return;

    // Dismiss keyboard on search
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setInterpreting(true);
    try {
      const response = await fetch('/api/ia/interpretar-busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busca: search })
      });

      if (!response.ok) throw new Error('Falha na resposta da IA');

      const data = await response.json();

      if (data.fallback) {
        toast("Busca inteligente indisponível. Usando busca tradicional.", "info");
        setAiSuggestion(null);
        return;
      }

      setAiSuggestion({
        searchId: data.searchId,
        mensagem: data.interpretacao.mensagem_personalizada || '',
        curadoria: data.interpretacao.termo_busca || '',
        caracteristicas: data.interpretacao.caracteristicas || [],
        termos_relacionados: data.interpretacao.termos_relacionados || [],
        sinonimos: data.interpretacao.sinonimos || [],
        rankedProducts: data.produtos
      });

      // Salvar perfil do usuário
      if (data.interpretacao.nivel_usuario) {
        sessionStorage.setItem('ai_user_profile', data.interpretacao.nivel_usuario);
      }

    } catch (error) {
      console.error('Falha na busca inteligente:', error);
      toast("Busca inteligente indisponível no momento.", "warning");
    } finally {
      setInterpreting(false);
    }
  };

  const trackProductClick = async (productId: string) => {
    // Register for AI (if applicable)
    if (aiSuggestion?.searchId) {
      try {
        await fetch('/api/ia/registrar-clique', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchId: aiSuggestion.searchId, productId })
        });
      } catch (e) {
        console.warn('Erro ao registrar clique (AI):', e);
      }
    }

    // Register for overall ranking
    productService.trackInteraction(productId, 'click');
  };

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

        // Filter products: be more permissive if strict rules result in empty catalog
        let visibleProds = prods.filter(p => 
          (p.images && p.images.length > 0) && 
          (!p.extras || p.extras.showInCatalog !== false)
        );

        // Fallback: If no products have images, show all active products
        if (visibleProds.length === 0 && prods.length > 0) {
          visibleProds = prods.filter(p => !p.extras || p.extras.showInCatalog !== false);
        }

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
      
      if (aiSuggestion && aiSuggestion.rankedProducts) {
        // Se temos um resultado ranqueado da IA, usamos ele
        // Mapeamos os IDs retornados pelo backend para os objetos de produto carregados no front
        const rankedIds = aiSuggestion.rankedProducts.map(rp => rp.id);
        const rankedResult = rankedIds
          .map(id => products.find(p => p.id === id))
          .filter(p => !!p) as Product[];
        
        if (rankedResult.length > 0) {
          result = rankedResult;
        } else {
          result = result.filter(p => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
        }
      } else {
        // Busca tradicional mais permissiva (divide por palavras)
        const words = s.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          result = result.filter(p => {
            const name = p.name.toLowerCase();
            const desc = (p.description || "").toLowerCase();
            return words.some(word => name.includes(word) || desc.includes(word)) || name.includes(s);
          });
        } else {
          result = result.filter(p => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
        }
      }
    }

    // Sort by stock status (out of stock last) and combined score
    result.sort((a, b) => {
      const aOut = a.controlStock && !a.allowBackorder && a.stock <= 0;
      const bOut = b.controlStock && !b.allowBackorder && b.stock <= 0;
      if (aOut && !bOut) return 1;
      if (!aOut && bOut) return -1;
      
      const aScore = getBaseScore(a) + getMatchScore(a, aiSuggestion);
      const bScore = getBaseScore(b) + getMatchScore(b, aiSuggestion);
      
      return bScore - aScore;
    });

    setFiltered(result);
    setCurrentPage(1); // Reset to page 1 unconditionally when filtering
  }, [search, selectedCat, products, categories, aiSuggestion]);

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
      {/* Header / Search Area - AI Assistant */}
      <section className="bg-zinc-950 border-b border-zinc-900 pt-6 pb-4 px-4 sticky top-14 md:top-16 z-30 backdrop-blur-md bg-black/95">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-500 mb-1 ml-1">
              <Sparkles size={16} />
              <h2 className="text-sm font-black uppercase tracking-tight">Especialista IA: O que você deseja hoje?</h2>
            </div>
            <div className="relative group w-full">
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600/40 group-focus-within:text-red-500 transition-colors" size={18} />
              <Input 
                ref={searchInputRef}
                type="text"
                placeholder="Ex: Quero algo para usar a dois e sair da rotina..." 
                className="w-full bg-zinc-900/80 border-red-900/30 text-white pl-12 pr-14 py-6 rounded-2xl focus:ring-1 focus:ring-red-600/50 font-medium placeholder:text-zinc-600 transition-all text-sm shadow-inner"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSmartSearch();
                }}
              />
              <button 
                onClick={handleSmartSearch}
                disabled={interpreting || !search.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-0 disabled:scale-95 transition-all shadow-lg shadow-red-900/20"
                title="Analisar Pedido"
              >
                <Search size={16} className={interpreting ? "animate-pulse" : ""} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 font-medium ml-2">Descreva sua vontade. Nossa IA encontrará a seleção perfeita para você.</p>
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
          {/* AI Recommendation Banner */}
          <AnimatePresence>
            {aiSuggestion && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-red-600/30 via-zinc-900 to-zinc-950 border border-red-600/20 relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 text-red-500/5 rotate-12">
                  <Sparkles size={200} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-red-400 mb-3">
                    <div className="bg-red-600 p-1 rounded-md">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Sugestão Discreta</span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
                        {aiSuggestion.curadoria}
                      </h2>
                      <p className="text-zinc-400 text-sm max-w-2xl font-medium leading-relaxed italic">
                        "{aiSuggestion.mensagem}"
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-white hover:text-white text-[10px] uppercase font-bold px-4"
                        onClick={() => { setAiSuggestion(null); setSearch(''); setSelectedCat('all'); }}
                      >
                        Limpar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-white text-black hover:bg-zinc-200 rounded-full text-[10px] uppercase font-black px-6"
                        onClick={() => {
                          const grid = document.getElementById('products-grid');
                          if (grid) {
                            grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                      >
                        Descobrir
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {interpreting ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-12"
              >
                <div className="absolute inset-0 bg-red-600/30 blur-[60px] rounded-full animate-pulse"></div>
                <div className="w-32 h-32 bg-zinc-900 border-4 border-red-900/50 rounded-full flex items-center justify-center text-red-500 relative z-10 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                  <Sparkles size={64} className="animate-pulse" />
                </div>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 border border-dashed border-red-600/20 rounded-full"
                />
              </motion.div>
              
              <h3 className="text-white font-black text-3xl md:text-4xl mb-4 tracking-tighter">
                Sua Experiência Personalizada está Quase Pronta...
              </h3>
              <p className="text-zinc-400 font-medium text-lg max-w-md leading-relaxed">
                Nossa IA está mergulhando em nosso catálogo exclusivo para encontrar as melhores opções baseadas em seu desejo agora.
              </p>
              <div className="mt-12 flex items-center gap-3 text-red-500/60 font-black uppercase tracking-[0.2em] text-[10px]">
                <Loader2 className="animate-spin" size={14} />
                Processando intenção
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
              
              <h3 className="text-white font-black text-2xl md:text-3xl mb-4 tracking-tighter px-6">
                Ops! Não encontramos o que você deseja...
              </h3>
              
              <p className="text-zinc-500 font-bold text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed px-8">
                Pode ser que você precise de um pouco mais de detalhes na sua busca. Tente descrever sua vontade com mais palavras para nossa IA te ajudar melhor!
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 px-6 w-full justify-center">
                <Button 
                  variant="outline" 
                  className="rounded-2xl border-zinc-700 hover:bg-zinc-900 font-black px-12 py-7 h-auto uppercase tracking-widest text-[11px] transition-all bg-zinc-950/80"
                  onClick={() => { 
                    setSearch(''); 
                    setSelectedCat('all');
                    setAiSuggestion(null);
                  }}
                >
                  <X size={14} className="mr-2" /> Limpar Filtros
                </Button>
                <Button 
                  className="rounded-2xl bg-red-600 hover:bg-red-500 font-black px-12 py-7 h-auto uppercase tracking-widest text-[11px] transition-all shadow-lg shadow-red-900/20"
                  onClick={() => { 
                    searchInputRef.current?.focus();
                  }}
                >
                  <Search size={14} className="mr-2" /> Tentar Outra Busca
                </Button>
              </div>

              <div className="mt-12 p-4 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 max-w-xs">
                <p className="text-[10px] text-zinc-600 font-medium italic">
                  Dica: Busque por sensações, momentos ou tipos específicos de produtos (ex: "vibrador recarregável potente").
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
                        onItemClick={() => trackProductClick(p.id)}
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
      // Track conversion
      productService.trackInteraction(product.id!, 'conversion');
      navigate('/carrinho');
    }
  };
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}`} 
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
        <h3 className="text-xs md:text-sm font-medium text-zinc-300 group-hover:text-white transition-colors duration-300 line-clamp-4 leading-snug min-h-[4.25rem] md:min-h-[4.875rem] mb-3 capitalize">
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

