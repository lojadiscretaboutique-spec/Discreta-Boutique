import { useEffect, useState, useRef, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { Search, X, Minus, Plus, Frown, Loader2, Truck, Heart } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Product, productService } from '../../services/productService';
import { searchCustomerCatalog } from '../../lib/customerCatalogSearch';
import { customerCatalogDataService } from '../../services/customerCatalogDataService';
import { Category, categoryService } from '../../services/categoryService';
import { customerService } from '../../services/customerService';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { catalogSectionsService, SECTION_METADATA, CatalogSection } from '../../services/catalogSectionsService';
import { usePromotion } from '../../contexts/PromotionContext';
import { visualHomeService, VisualHomeSettings } from '../../services/visualHomeService';

import { useTheme } from '../../contexts/ThemeContext';


function hexToRgb(hexColor: string) {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return { r: 5, g: 5, b: 5 };
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

function normalizeSectionId(secId: string): string {
  if (secId === 'mais-vendidos') return 'maisVendidos';
  if (secId === 'em-alta') return 'emAlta';
  if (secId === 'promocoes' || secId === 'ofertas') return 'ofertas';
  return secId;
}

export function CatalogPage() {
  const { currentTheme } = useTheme();
  const { slug: routeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const qCat = searchParams.get('categoria') || routeSlug;
  const qSearch = searchParams.get('q');
  const qSection = searchParams.get('secao');
  const qSubcat = searchParams.get('subcategoria');
  const qCollection = searchParams.get('colecao');

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(qSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(qSearch || '');
  const [selectedCat, setSelectedCat] = useState<string>(qCat || 'all');
  const [selectedSection, setSelectedSection] = useState<string | null>(qSection);
  const [selectedSubcat, setSelectedSubcat] = useState<string | null>(qSubcat);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(qCollection);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const lastRankedSection = useRef<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  const [fullHomeStructure, setFullHomeStructure] = useState<any | null>(null);
  const [activeSectionSettings, setActiveSectionSettings] = useState<VisualHomeSettings | null>(null);
  const [sectionLoadError, setSectionLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 160);
    return () => clearTimeout(timer);
  }, [search]);

  // Sincroniza o campo de busca com o parâmetro 'q' da URL
  useEffect(() => {
    setSearch(qSearch || '');
  }, [qSearch]);

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
      const cat = categories.find(c => c.id === catValue || c.slug === catValue);
      if (cat) {
        newParams.set('categoria', cat.slug || cat.id);
      } else {
        newParams.set('categoria', catValue);
      }
    }
    setSearchParams(newParams);
    
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
    setSearching(false);
  };

  const trackProductClick = async (productId: string) => {
    productService.trackInteraction(productId, 'click');
  };


  // Track customer category accesses to rank categories
  useEffect(() => {
    if (selectedCat && selectedCat !== 'all') {
      categoryService.trackCategoryAccess(selectedCat);
    }
  }, [selectedCat]);

  // One catalog fetch per mount, NOT on each keystroke/URL parameter change.
  useEffect(() => {
    let disposed = false;
    async function loadData() {
      setLoading(true);
      try {
        const data = await customerCatalogDataService.load();
        if (disposed) return;
        setProducts(data.products);
        setCategories([...data.categories].sort((a, b) =>
          (b.accessCount || 0) - (a.accessCount || 0) ||
          (a.sortOrder || 0) - (b.sortOrder || 0) ||
          a.name.localeCompare(b.name, 'pt-BR')
        ));
        try {
          const structure = await visualHomeService.getFullHomeStructure();
          if (!disposed) setFullHomeStructure(structure);
        } catch (error) {
          console.warn('[CATALOG] Home layout unavailable:', error);
        }
      } catch (error) {
        if (!disposed) console.error('[CATALOG] Error loading products:', error);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    loadData();
    return () => { disposed = true; };
  }, []);

  // URL state only changes filters; it must not re-download the entire catalog.
  useEffect(() => {
    const section = searchParams.get('secao');
    const slug = searchParams.get('categoria') || routeSlug;
    setSelectedSection(section);
    setSelectedSubcat(searchParams.get('subcategoria'));
    setSelectedCollection(searchParams.get('colecao'));
    if (!slug || slug === 'all') {
      setSelectedCat('all');
    } else {
      const clean = decodeURIComponent(slug);
      const found = categories.find(c => c.id === clean || c.slug === clean);
      setSelectedCat(found?.id || 'all');
    }
    if (section) {
      const settings = fullHomeStructure?.settings?.[normalizeSectionId(section)];
      if (fullHomeStructure && (!settings || !settings.active)) {
        setSectionLoadError('Esta coleção ou seção não está ativa no momento. Confira nossos outros produtos abaixo!');
        setActiveSectionSettings(null);
      } else {
        setSectionLoadError(null);
        setActiveSectionSettings(settings || null);
      }
    } else {
      setSectionLoadError(null);
      setActiveSectionSettings(null);
    }
  }, [searchParams, routeSlug, categories, fullHomeStructure]);

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

  const filteredProducts = useMemo(() => {
    const getAllChildCategoryIds = (catId: string): string[] => {
      const children = categories.filter(c => c.parentId === catId);
      let ids = [catId];
      children.forEach(child => {
        ids = [...ids, ...getAllChildCategoryIds(child.id)];
      });
      return ids;
    };

    const getCreationTime = (createdAt?: any) => {
      if (!createdAt) return 0;
      if (createdAt.seconds) return createdAt.seconds * 1000;
      return new Date(createdAt).getTime() || 0;
    };

    let result = [...products];

    // 1. Filtro de Seção (Home Context)
    if (selectedSection) {
      const normalizedId = normalizeSectionId(selectedSection);
      const settings = fullHomeStructure?.settings?.[normalizedId];

      if (settings) {
        let sectionProds: Product[] = [];
        
        switch (settings.source) {
          case 'promo':
            sectionProds = products.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));
            break;
          case 'categories':
            if (settings.sourceDetails && settings.sourceDetails.length > 0) {
              const allTargetCatIds = [...settings.sourceDetails];
              settings.sourceDetails.forEach((catId: string) => {
                const getChildIds = (id: string): string[] => {
                  const children = categories.filter(c => c.parentId === id);
                  let ids: string[] = [];
                  children.forEach(child => {
                    ids = [...ids, child.id, ...getChildIds(child.id)];
                  });
                  return ids;
                };
                allTargetCatIds.push(...getChildIds(catId));
              });
              sectionProds = products.filter(p => p.categoryId && allTargetCatIds.includes(p.categoryId));
            }
            break;
          case 'brands':
            if (settings.sourceDetails && settings.sourceDetails.length > 0) {
              sectionProds = products.filter(p => p.brand && settings.sourceDetails.includes(p.brand));
            }
            break;
          case 'limited_promo':
            if (settings.sourceDetails && settings.sourceDetails.length > 0) {
              sectionProds = settings.sourceDetails
                .map((prodId: string) => {
                  const originalProd = products.find(p => p.id === prodId);
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
                .filter(Boolean) as Product[];
            }
            break;
          case 'custom_products':
            if (settings.sourceDetails && settings.sourceDetails.length > 0) {
              sectionProds = settings.sourceDetails
                .map((prodId: string) => products.find(p => p.id === prodId))
                .filter(Boolean) as Product[];
            }
            break;
          case 'best_seller':
            sectionProds = products.filter(p => (p.conversoes || 0) > 0);
            if (sectionProds.length === 0) {
              sectionProds = [...products];
            }
            sectionProds = [...sectionProds].sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0));
            break;
          case 'views':
            sectionProds = products.filter(p => (p.cliques || 0) > 0);
            if (sectionProds.length === 0) {
              sectionProds = [...products];
            }
            sectionProds = [...sectionProds].sort((a, b) => (b.cliques || 0) - (a.cliques || 0));
            break;
          case 'recent':
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            sectionProds = products.filter(p => !!p.newRelease || (p.createdAt && getCreationTime(p.createdAt) > thirtyDaysAgo));
            if (sectionProds.length === 0) {
              sectionProds = [...products];
            }
            sectionProds = [...sectionProds].sort((a, b) => {
              const dateA = getCreationTime(a.createdAt);
              const dateB = getCreationTime(b.createdAt);
              return dateB - dateA;
            });
            break;
          case 'ai_recs':
          case 'recomendados':
            sectionProds = products.filter(p => (p.score || 0) > 0);
            if (sectionProds.length === 0) {
              sectionProds = [...products];
            }
            sectionProds = [...sectionProds].sort((a, b) => (b.score || 0) - (a.score || 0));
            break;
          case 'random':
            sectionProds = [...products];
            break;
          case 'stock':
            sectionProds = products.filter(p => (Number(p.stock) || 0) > 0);
            sectionProds = [...sectionProds].sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
            break;
          case 'auto':
          default:
            if (normalizedId === 'lancamentos') {
              const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;
              sectionProds = products.filter(p => !!p.newRelease || (p.createdAt && getCreationTime(p.createdAt) > fortyFiveDaysAgo));
              if (sectionProds.length === 0) {
                sectionProds = [...products];
              }
              sectionProds = [...sectionProds].sort((a, b) => {
                if (a.newRelease && !b.newRelease) return -1;
                if (!a.newRelease && b.newRelease) return 1;
                const dA = getCreationTime(a.createdAt);
                const dB = getCreationTime(b.createdAt);
                return dB - dA;
              });
            } else if (normalizedId === 'destaques') {
              sectionProds = products.filter(p => !!p.featured);
              sectionProds = [...sectionProds].sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return (b.score || 0) - (a.score || 0);
              });
            } else if (normalizedId === 'maisVendidos') {
              sectionProds = products.filter(p => (p.conversoes || 0) > 0);
              if (sectionProds.length === 0) {
                sectionProds = [...products];
              }
              sectionProds = [...sectionProds].sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0));
            } else if (normalizedId === 'emAlta') {
              sectionProds = products.filter(p => (p.cliques || 0) > 0);
              if (sectionProds.length === 0) {
                sectionProds = [...products];
              }
              sectionProds = [...sectionProds].sort((a, b) => (b.cliques || 0) - (a.cliques || 0));
            } else if (normalizedId === 'recomendados') {
              sectionProds = products.filter(p => (p.score || 0) > 0);
              if (sectionProds.length === 0) {
                sectionProds = [...products];
              }
              sectionProds = [...sectionProds].sort((a, b) => (b.score || 0) - (a.score || 0));
            } else if (normalizedId === 'ofertas') {
              sectionProds = products.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));
              sectionProds = [...sectionProds].sort((a, b) => {
                const isAPromo = !!a.onSale || (a.promoPrice && a.promoPrice < a.price);
                const isBPromo = !!b.onSale || (b.promoPrice && b.promoPrice < b.price);
                if (isAPromo && !isBPromo) return -1;
                if (!isAPromo && isBPromo) return 1;
                if (isAPromo && isBPromo) {
                  const discA = (a.price - (a.promoPrice || a.price)) / a.price;
                  const discB = (b.price - (b.promoPrice || b.price)) / b.price;
                  return discB - discA;
                }
                return 0;
              });
            } else {
              sectionProds = [...products];
            }
            break;
        }

        // Apply advanced sorting on the resolved section array
        if (settings.orderByField && settings.orderByField !== 'manual') {
          switch (settings.orderByField) {
            case 'recent':
              sectionProds = [...sectionProds].sort((a, b) => {
                const dateA = getCreationTime(a.createdAt);
                const dateB = getCreationTime(b.createdAt);
                return dateB - dateA;
              });
              break;
            case 'sales':
              sectionProds = [...sectionProds].sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0));
              break;
            case 'discount':
              sectionProds = [...sectionProds].sort((a, b) => {
                const dA = a.promoPrice ? (a.price - a.promoPrice) : 0;
                const dB = b.promoPrice ? (b.price - b.promoPrice) : 0;
                return dB - dA;
              });
              break;
            case 'price_asc':
              sectionProds = [...sectionProds].sort((a, b) => (a.promoPrice || a.price) - (b.promoPrice || b.price));
              break;
            case 'price_desc':
              sectionProds = [...sectionProds].sort((a, b) => (b.promoPrice || b.price) - (a.promoPrice || a.price));
              break;
            case 'random':
              sectionProds = [...sectionProds].sort((a, b) => {
                const codeA = a.id ? a.id.charCodeAt(0) : 0;
                const codeB = b.id ? b.id.charCodeAt(0) : 0;
                return codeA - codeB;
              });
              break;
          }
        }

        result = sectionProds;
      } else {
        result = catalogSectionsService.applySectionLogic(result, selectedSection as CatalogSection);
      }
    }

    // 2. Filtro de Coleção
    if (selectedCollection) {
      const col = selectedCollection.toLowerCase();
      result = result.filter(p => 
        (p as any).colecoes?.includes(col) || 
        (p.tags || []).some(t => String(t).toLowerCase() === col)
      );
    }

    // 3. Filtro de Subcategoria
    if (selectedSubcat) {
      const sub = selectedSubcat.toLowerCase();
      result = result.filter(p => 
        String(p.subcategory || "").toLowerCase() === sub || 
        (p as any).subcategoria?.toLowerCase() === sub
      );
    }

    // 4. Filtro de Categoria
    if (selectedCat !== 'all') {
      const allCategoryIds = getAllChildCategoryIds(selectedCat);
      result = result.filter(p => p.categoryId && allCategoryIds.includes(p.categoryId));
    }

    // 5. Filtro de Busca (Estrito, Simples, Eficiente, Objetivo e Sem IA)
    if (debouncedSearch.trim()) {
      // The same deterministic relevance engine powers the header autocomplete.
      // It searches every eligible item, not just the current page or category.
      const names = Object.fromEntries(categories.map(c => [c.id, c.name]));
      return searchCustomerCatalog(products, debouncedSearch, names);
    }

    // 6. Ordenação Padrão do Catálogo (Sem IA)
    const hasAnyFilter = !!selectedSection || !!selectedCollection || !!selectedSubcat || selectedCat !== 'all';
    if (!hasAnyFilter) {
      result = [...result].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return (b.conversoes || 0) - (a.conversoes || 0);
      });
    }

    return result;
  }, [debouncedSearch, selectedCat, selectedSection, selectedSubcat, selectedCollection, products, categories, fullHomeStructure]);

  useEffect(() => {
    setFiltered(filteredProducts);
    setCurrentPage(1);
  }, [filteredProducts]);


  const getContextTitle = () => {
    if (search) return `Resultados para "${search}"`;
    
    let baseTitle = '';
    if (selectedSection) {
      if (activeSectionSettings) {
        baseTitle = (activeSectionSettings.emoji ? activeSectionSettings.emoji + ' ' : '') + activeSectionSettings.title;
      } else {
        const meta = SECTION_METADATA[selectedSection as CatalogSection];
        baseTitle = meta?.title || 'Coleção';
      }
    } else if (selectedSubcat) {
      baseTitle = selectedSubcat.charAt(0).toUpperCase() + selectedSubcat.slice(1);
    } else if (selectedCollection) {
      baseTitle = selectedCollection.charAt(0).toUpperCase() + selectedCollection.slice(1);
    }

    const cat = categories.find(c => c.id === selectedCat);
    
    if (baseTitle && cat) {
      return `${baseTitle} > ${cat.name}`;
    } else if (baseTitle) {
      return baseTitle;
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
      {/* Category Navigation - Compact & Clean */}
      <section className="bg-zinc-950 border-b border-zinc-900 pt-3 pb-3 px-4 sticky top-14 md:top-16 z-30 backdrop-blur-md bg-black/95">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="space-y-2">
            {/* Root Categories Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5">
              <button 
                onClick={() => updateCategoryParam('all')}
                className={cn(
                  "whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  selectedCat === 'all' 
                    ? "shadow-md shadow-red-900/20" 
                    : "bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:border-zinc-700"
                )}
                style={selectedCat === 'all' ? {
                  backgroundColor: currentTheme.primaryColor,
                  borderColor: currentTheme.primaryColor,
                  color: currentTheme.primaryTextColor === 'light' ? '#ffffff' : (currentTheme.primaryTextColor === 'dark' ? '#000000' : getContrastColor(currentTheme.primaryColor))
                } : {}}
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
                      ? "shadow-sm" 
                      : "bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:border-zinc-700"
                  )}
                  style={activeRootId === c.id ? {
                    backgroundColor: currentTheme.primaryColor,
                    borderColor: currentTheme.primaryColor,
                    color: currentTheme.primaryTextColor === 'light' ? '#ffffff' : (currentTheme.primaryTextColor === 'dark' ? '#000000' : getContrastColor(currentTheme.primaryColor))
                  } : {}}
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
                      "whitespace-nowrap px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all"
                    )}
                    style={selectedCat === activeRootId ? {
                      backgroundColor: `${currentTheme.primaryColor}15`,
                      color: currentTheme.primaryColor,
                    } : {
                      color: 'rgb(113, 113, 122)'
                    }}
                  >
                    Tudo
                  </button>
                  {activeSubcategories.map(sub => (
                    <button 
                      key={sub.id}
                      onClick={() => updateCategoryParam(sub.id)}
                      className={cn(
                        "whitespace-nowrap px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all"
                      )}
                      style={selectedCat === sub.id ? {
                        backgroundColor: `${currentTheme.primaryColor}15`,
                        color: currentTheme.primaryColor,
                      } : {
                        color: 'rgb(113, 113, 122)'
                      }}
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


        {/* Section Error Notification with clean fallback container */}
        {sectionLoadError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-8 bg-zinc-950/80 border border-zinc-900 rounded-[2.5rem] text-center max-w-4xl mx-auto flex flex-col items-center"
          >
            <div className="w-12 h-12 bg-red-650/10 rounded-full flex items-center justify-center text-red-500 mb-3 border border-red-900/30">
              <Frown size={24} />
            </div>
            <p className="text-sm font-bold text-zinc-300 mb-5 leading-relaxed max-w-md">
              {sectionLoadError}
            </p>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchParams({});
                setSelectedSection(null);
                setSectionLoadError(null);
                setActiveSectionSettings(null);
              }}
              className="text-[9px] font-black uppercase tracking-widest border-zinc-850 hover:bg-zinc-900 rounded-xl px-6 py-4 bg-zinc-950"
            >
              Explorar todo o catálogo
            </Button>
          </motion.div>
        )}

        {/* Results Info and Visual Badges for active section filter */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 border-b border-zinc-900 pb-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[2px]">
              {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
            </p>
            {search.trim() && (
              <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[8px] md:text-[9.5px] font-bold uppercase tracking-[2px] px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                <Search size={12} className="text-red-500" />
                Busca: "{search}"
              </span>
            )}
            {activeSectionSettings && (
              <span className="bg-red-600/10 border border-red-650/25 text-red-500 text-[8px] md:text-[9.5px] font-black uppercase tracking-[2.5px] px-3.5 py-1.5 rounded-full">
                Exibindo Seção: {activeSectionSettings.title}
              </span>
            )}
            {selectedCat !== 'all' && (
              <span className="bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[8px] md:text-[9.5px] font-black uppercase tracking-[2.5px] px-3.5 py-1.5 rounded-full">
                Categoria: {categories.find(c => c.id === selectedCat)?.name}
              </span>
            )}
          </div>
          {(selectedCat !== 'all' || search || selectedSection || selectedSubcat || selectedCollection) && (
            <button 
              onClick={() => { 
                updateCategoryParam('all');
                setSearch(''); 
                setSelectedSection(null);
                setSelectedSubcat(null);
                setSelectedCollection(null);
                setSectionLoadError(null);
                setActiveSectionSettings(null);
                const newParams = new URLSearchParams();
                setSearchParams(newParams);
              }}
              className="text-[10px] font-black text-red-500 uppercase tracking-[2px] hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <X size={12} /> Limpar Filtros
            </button>
          )}
        </div>

        {/* Product Grid - Optimized Columns */}
        <main className="w-full">
          {loading ? (
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

export function ProductGridCard({ product, onItemClick }: { product: Product, onItemClick?: () => void }) {
  const navigate = useNavigate();
  const { calculateProductPrice } = usePromotion();
  
  const { user, userData } = useAuthStore();
  const { currentCustomer, toggleFavorite } = useCustomerAuthStore();
  
  const favoritesList = userData?.favorites || currentCustomer?.favorites || [];
  const isFavorited = !!(product?.id && favoritesList.includes(product.id));
  
  const handleToggleFavorite = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!product.id) return;
      
      if (!user && !currentCustomer) {
        navigate('/login');
        return;
      }
      
      const newFavorites = isFavorited 
        ? favoritesList.filter(id => id !== product.id!)
        : [...favoritesList, product.id!];
      
      if (currentCustomer?.id) {
        toggleFavorite(product.id!);
        try {
          await customerService.toggleFavorite(currentCustomer.id, product.id!, newFavorites);
        } catch (err) {
          console.error("Erro ao salvar favorito do cliente local:", err);
        }
      }
      
      if (user?.uid) {
        useAuthStore.setState((state) => {
          const prevUserData = state.userData || { role: 'customer', active: true };
          return {
            userData: {
              ...prevUserData,
              favorites: newFavorites
            }
          };
        });

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            favorites: newFavorites,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Erro ao salvar favorito no Firestore de usuários:", err);
        }
      }
  };

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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.id) return;
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
            alt={`${product.name} | Discreta Boutique`} 
            loading="lazy"
            className={cn(
              "w-full h-full object-cover transition-transform duration-1000 ease-out",
              !isOut && "group-hover:scale-105"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-zinc-800 text-[10px] font-black uppercase tracking-widest text-center px-4 italic">Sem Imagem</div>
        )}
        
        {/* Floating Favorite Heart Button */}
        <button 
          onClick={handleToggleFavorite}
          className={cn(
            "absolute top-4 right-4 p-2 transition-all duration-300 z-30 cursor-pointer rounded-full",
            isFavorited ? "bg-transparent text-red-600 hover:scale-110" : "bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 hover:scale-105 shadow-lg"
          )}
          title={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={16} fill={isFavorited ? "currentColor" : "none"} className="transition-transform duration-300 active:scale-125" />
        </button>

        {/* Organic Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 font-sans">
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

