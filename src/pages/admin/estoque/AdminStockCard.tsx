import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  ArrowLeft, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Calendar, 
  User, 
  FileText, 
  Filter, 
  Search, 
  Printer, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  DollarSign,
  Layers,
  Barcode
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { productService, Product, ProductVariant } from '../../../services/productService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { parseSafeDate, formatSafeDate } from '../../../utils/dateUtils';

interface StockMovementDoc {
  id: string;
  balanceId?: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku?: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock?: number;
  newStock?: number;
  costPrice?: number;
  reason?: string;
  notes?: string;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: Date | string | number | { toDate?: () => Date; seconds?: number } | null;
}

export function AdminStockCard() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVariantIdParam = searchParams.get('variantId') || 'ALL';

  const navigate = useNavigate();
  const { toast } = useFeedback();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<StockMovementDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeVariantTab, setActiveVariantTab] = useState<string>(selectedVariantIdParam);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadData = async () => {
    if (!productId) {
      // Load products for selector
      try {
        setLoadingProducts(true);
        const prods = await productService.listProducts();
        
        // Ensure subcollection variants are loaded for products with variants
        const prodsWithVariants = await Promise.all(
          prods.map(async (p) => {
            if (p.hasVariants && (!p.variants || p.variants.length === 0)) {
              try {
                const vSnap = await getDocs(collection(db, `products/${p.id}/variants`));
                const subVariants = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
                return { ...p, variants: subVariants };
              } catch (e) {
                console.warn(`Error loading subcollection variants for product ${p.id}:`, e);
                return p;
              }
            }
            return p;
          })
        );
        setAllProducts(prodsWithVariants);
      } catch (e) {
        console.error("Error loading products list:", e);
      } finally {
        setLoadingProducts(false);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await productService.getProduct(productId);
      if (!res || !res.product) {
        toast("Produto não encontrado.", "error");
        return;
      }

      setProduct(res.product);
      setVariants(res.variants || []);

      // Fetch stock movements for this product
      const movRef = collection(db, 'stockMovements');
      const q = query(
        movRef,
        where('productId', '==', productId)
      );
      const movSnap = await getDocs(q);
      const movList = movSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovementDoc));
      movList.sort((a, b) => {
        const dateA = parseSafeDate(a.createdAt);
        const dateB = parseSafeDate(b.createdAt);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeB - timeA;
      });
      setMovements(movList);
    } catch (e) {
      console.error("Error loading stock card data:", e);
      toast("Erro ao carregar Ficha de Estoque.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [productId]);

  // Sync query params when variant tab changes
  useEffect(() => {
    if (selectedVariantIdParam) {
      setActiveVariantTab(selectedVariantIdParam);
    }
  }, [selectedVariantIdParam]);

  const handleVariantTabChange = (variantId: string) => {
    setActiveVariantTab(variantId);
    if (variantId === 'ALL') {
      searchParams.delete('variantId');
    } else {
      searchParams.set('variantId', variantId);
    }
    setSearchParams(searchParams);
  };

  const normalizeCode = (str?: string) => (str || '').replace(/[\s\-\.\/]/g, '').toLowerCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400 space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando Ficha de Estoque...</p>
      </div>
    );
  }

  if (!productId) {
    const rawTerm = productSearch.trim();
    const term = rawTerm.toLowerCase();
    const cleanTerm = normalizeCode(rawTerm);

    interface SearchResultItem {
      id: string;
      type: 'product' | 'variant';
      name: string;
      subtitle?: string;
      sku: string;
      gtin: string;
      stock: number;
      img: string;
      badge: string;
      targetUrl: string;
    }

    const searchItems: SearchResultItem[] = [];

    allProducts.forEach(p => {
      const parentName = p.name || '';
      const parentSku = p.sku || '';
      const parentGtin = p.gtin || p.barcode || p.ean || p.codigoBarras || '';
      const parentBrand = p.brand || '';
      const parentInternalCode = p.internalCode || '';
      const mainImg = p.images?.find(i => i.isMain)?.url || p.images?.[0]?.url || '';

      const parentSkuClean = normalizeCode(parentSku);
      const parentGtinClean = normalizeCode(parentGtin);
      const parentInternalClean = normalizeCode(parentInternalCode);

      const searchTermsArray: string[] = Array.isArray(p.searchTerms) ? p.searchTerms : [];
      const variantIdentifiersArray: string[] = Array.isArray(p.variantIdentifiers) ? p.variantIdentifiers : [];

      const searchTermsClean = searchTermsArray.map(st => normalizeCode(st));
      const variantIdentifiersClean = variantIdentifiersArray.map(vi => normalizeCode(vi));

      const parentMatches = !term ||
        parentName.toLowerCase().includes(term) ||
        (parentSku && parentSku.toLowerCase().includes(term)) ||
        (parentSkuClean && cleanTerm && parentSkuClean.includes(cleanTerm)) ||
        (parentGtin && parentGtin.toLowerCase().includes(term)) ||
        (parentGtinClean && cleanTerm && parentGtinClean.includes(cleanTerm)) ||
        (parentBrand && parentBrand.toLowerCase().includes(term)) ||
        (parentInternalCode && parentInternalCode.toLowerCase().includes(term)) ||
        (parentInternalClean && cleanTerm && parentInternalClean.includes(cleanTerm)) ||
        (searchTermsArray.some(st => st.toLowerCase().includes(term))) ||
        (searchTermsClean.some(stc => cleanTerm && stc.includes(cleanTerm))) ||
        (variantIdentifiersArray.some(vi => vi.toLowerCase().includes(term))) ||
        (variantIdentifiersClean.some(vic => cleanTerm && vic.includes(cleanTerm)));

      if (parentMatches) {
        searchItems.push({
          id: `prod_${p.id}`,
          type: 'product',
          name: parentName,
          subtitle: parentBrand ? `Marca: ${parentBrand}` : undefined,
          sku: parentSku || 'N/A',
          gtin: parentGtin || (variantIdentifiersArray.length > 0 ? variantIdentifiersArray.join(', ') : 'N/A'),
          stock: p.stock || 0,
          img: mainImg,
          badge: (p.variants && p.variants.length > 0) ? `${p.variants.length} variações` : 'Produto Pai',
          targetUrl: `/admin/estoque/ficha/${p.id}`,
        });
      }

      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach((v, idx) => {
          const varSku = v.sku || '';
          const varGtin = v.barcode || v.gtin || v.ean || v.variantBarcode || v.codigoBarras || '';
          const varName = v.name || '';
          const attrValues = v.attributes ? Object.values(v.attributes).join(' ') : '';
          const fullVarStr = `${parentName} ${varName} ${attrValues}`;

          const varSkuClean = normalizeCode(varSku);
          const varGtinClean = normalizeCode(varGtin);

          const variantMatches = !!term && (
            (varSku && varSku.toLowerCase().includes(term)) ||
            (varSkuClean && cleanTerm && varSkuClean.includes(cleanTerm)) ||
            (varGtin && varGtin.toLowerCase().includes(term)) ||
            (varGtinClean && cleanTerm && varGtinClean.includes(cleanTerm)) ||
            varName.toLowerCase().includes(term) ||
            attrValues.toLowerCase().includes(term) ||
            fullVarStr.toLowerCase().includes(term)
          );

          if (variantMatches) {
            const attrDisplay = v.attributes 
              ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' / ') 
              : '';
            const displayName = varName 
              ? `${parentName} — ${varName}` 
              : attrDisplay 
                ? `${parentName} — ${attrDisplay}` 
                : `${parentName} (${attrValues || `Variação ${idx + 1}`})`;

            const variantKey = v.id || v.sku || v.barcode || v.gtin || `var_${idx}`;
            searchItems.push({
              id: `var_${p.id}_${variantKey}`,
              type: 'variant',
              name: displayName,
              subtitle: `Produto Pai: ${parentName}`,
              sku: varSku || parentSku || 'N/A',
              gtin: varGtin || parentGtin || 'N/A',
              stock: v.stock || 0,
              img: v.imageUrl || mainImg,
              badge: 'Variação',
              targetUrl: `/admin/estoque/ficha/${p.id}?variantId=${encodeURIComponent(variantKey)}`,
            });
          }
        });
      }
    });

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchItems.length > 0) {
          const cleanT = normalizeCode(productSearch);
          const exactMatch = searchItems.find(item => {
            return normalizeCode(item.sku) === cleanT || normalizeCode(item.gtin) === cleanT;
          }) || searchItems[0];

          if (exactMatch) {
            navigate(exactMatch.targetUrl);
          }
        }
      }
    };

    return (
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
        <div className="border-b border-zinc-800 pb-5">
          <Link
            to="/admin/mov_estoque"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Movimentação de Estoque
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Consultar Ficha de Estoque Individual
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Selecione ou busque um produto por Nome, SKU ou código EAN/GTIN/Código de Barras para visualizar a linha do tempo e o extrato de movimentações.
          </p>
        </div>

        {/* Product Search Box */}
        <div className="relative max-w-xl">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            autoFocus
            placeholder="Bipar código de barras, SKU, EAN/GTIN ou buscar por nome..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-12 pr-10 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-xl"
          />
          {productSearch && (
            <button
              onClick={() => setProductSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 hover:text-white bg-zinc-800 px-2 py-1 rounded"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Products Grid */}
        {loadingProducts ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-sm font-semibold text-zinc-400">Carregando catálogo de produtos...</p>
          </div>
        ) : searchItems.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 space-y-2">
            <Package className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-400">Nenhum produto ou variação encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchItems.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(item.targetUrl)}
                className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-4 rounded-2xl transition-all cursor-pointer group hover:bg-zinc-800/60 shadow-lg flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.img ? (
                    <img src={item.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Package className="w-6 h-6 text-zinc-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      SKU: {item.sku}
                    </span>
                    {item.gtin && item.gtin !== 'N/A' && (
                      <span className="text-[11px] font-mono text-zinc-400">
                        | EAN: {item.gtin}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto ${
                      item.type === 'variant'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className="font-bold text-white text-sm truncate group-hover:text-amber-400 transition-colors">
                    {item.name}
                  </div>

                  {item.subtitle && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  )}

                  <div className="text-xs text-zinc-400 mt-2 flex items-center justify-between pt-1.5 border-t border-zinc-800/60">
                    <span>Estoque: <strong className="text-white font-mono">{item.stock} un</strong></span>
                    <span className="text-amber-400 font-semibold text-[11px] group-hover:underline">
                      Ver Ficha →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-zinc-400 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="text-lg font-bold text-white">Produto não encontrado</div>
        <Link to="/admin/produtos" className="text-amber-400 underline text-sm">
          Voltar para Lista de Produtos
        </Link>
      </div>
    );
  }

  // Selected variant data if a specific variant tab is selected
  const selectedVariant = activeVariantTab !== 'ALL' 
    ? variants.find((v, idx) => {
        const vKey = v.id || v.sku || v.barcode || `var_${idx}`;
        return (
          v.id === activeVariantTab ||
          v.sku === activeVariantTab ||
          v.barcode === activeVariantTab ||
          v.gtin === activeVariantTab ||
          vKey === activeVariantTab
        );
      })
    : null;

  // Filter movements by variant tab and search/type
  const filteredMovements = movements.filter(m => {
    if (activeVariantTab !== 'ALL') {
      if (m.variantId) {
        const selectedKey = selectedVariant?.id || selectedVariant?.sku || selectedVariant?.barcode || activeVariantTab;
        const isMatch = 
          m.variantId === activeVariantTab || 
          m.variantId === selectedVariant?.id || 
          m.variantId === selectedVariant?.sku || 
          m.variantId === selectedKey;
        if (!isMatch) return false;
      }
    }
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'in' && m.type !== 'in') return false;
      if (typeFilter === 'out' && m.type !== 'out') return false;
      if (typeFilter === 'balance' && !m.reason?.toLowerCase().includes('balanço')) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matches = 
        (m.reason || '').toLowerCase().includes(term) ||
        (m.notes || '').toLowerCase().includes(term) ||
        (m.createdByName || '').toLowerCase().includes(term);
      if (!matches) return false;
    }
    return true;
  });

  // Calculate stats for current view
  const currentStock = selectedVariant ? Math.max(0, selectedVariant.stock || 0) : Math.max(0, product.stock || 0);
  const unitCost = selectedVariant ? (selectedVariant.costPrice || product.costPrice || 0) : (product.costPrice || 0);
  const totalStockCostValue = currentStock * unitCost;

  // Find last movement dates
  const lastInMovement = movements.find(m => m.type === 'in' && (activeVariantTab === 'ALL' || m.variantId === activeVariantTab));
  const lastOutMovement = movements.find(m => m.type === 'out' && (activeVariantTab === 'ALL' || m.variantId === activeVariantTab));
  const lastBalanceMovement = movements.find(m => m.reason?.toLowerCase().includes('balanço') && (activeVariantTab === 'ALL' || m.variantId === activeVariantTab));

  const mainImage = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url || '';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header Breadcrumb & Quick Scan */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <Link
            to="/admin/estoque/ficha"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Consulta de Produtos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Ficha de Estoque Individual
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Histórico completo e rastreabilidade cronológica de entradas, saídas e balanços de estoque.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => navigate('/admin/estoque/ficha')}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" /> Consultar/Bipar Outro
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir Ficha
          </button>
        </div>
      </div>

      {/* Product Summary Header Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-start md:items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
            {mainImage ? (
              <img src={mainImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-8 h-8 text-zinc-600" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                SKU: {selectedVariant ? (selectedVariant.sku || product.sku) : product.sku}
              </span>
              {(product.gtin || (selectedVariant && (selectedVariant.barcode || selectedVariant.gtin))) && (
                <span className="text-xs font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1">
                  <Barcode className="w-3 h-3 text-amber-500" /> EAN: {selectedVariant?.barcode || selectedVariant?.gtin || product.gtin}
                </span>
              )}
              {selectedVariant && (
                <span className="text-xs font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Variação Selecionada
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {product.name}
              {selectedVariant && (
                <span className="text-amber-400 font-normal ml-2">
                  — {selectedVariant.name || Object.values(selectedVariant.attributes || {}).join(' / ')}
                </span>
              )}
            </h2>
            <div className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-3">
              {product.brand && <span>Marca: <strong className="text-zinc-200">{product.brand}</strong></span>}
              {product.subcategory && <span>Categoria: <strong className="text-zinc-200">{product.subcategory}</strong></span>}
            </div>
          </div>
        </div>

        {/* Pricing & Financial Totals */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div>
            <div className="text-xs text-zinc-400">Preço de Custo Unitário:</div>
            <div className="text-lg font-mono font-bold text-zinc-200">
              R$ {unitCost.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400">Valor Total no Estoque (Custo):</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              R$ {totalStockCostValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Variant Selector Tabs (If Has Variants) */}
      {variants.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800">
          <span className="text-xs text-zinc-400 font-semibold mr-2 shrink-0 flex items-center gap-1">
            <Layers className="w-4 h-4 text-amber-500" /> Selecionar Visão:
          </span>

          <button
            onClick={() => handleVariantTabChange('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeVariantTab === 'ALL'
                ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Visão Consolidada do Pai ({product.stock || 0} un)
          </button>

          {variants.map((v, idx) => {
            const vKey = v.id || v.sku || v.barcode || `var_${idx}`;
            const isActive = 
              activeVariantTab === vKey || 
              activeVariantTab === v.id || 
              activeVariantTab === v.sku || 
              activeVariantTab === v.barcode;
            const displayName = v.name || (v.attributes ? Object.values(v.attributes).join(' / ') : `Variação ${idx + 1}`);

            return (
              <button
                key={vKey}
                onClick={() => handleVariantTabChange(vKey)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {displayName} ({v.stock || 0} un)
              </button>
            );
          })}
        </div>
      )}

      {/* Metric Cards - Stock Status & Last Balance Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Saldo Atual Físico</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">
            {currentStock} <span className="text-xs text-zinc-500 font-normal">unidades</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Em estoque na loja/depósito</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Última Entrada
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {lastInMovement ? (
              <>
                +{lastInMovement.quantity} un em{' '}
                {formatSafeDate(lastInMovement.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </>
            ) : (
              'Sem registros'
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {lastInMovement?.reason || 'Sem histórico de entrada recente'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-400" /> Última Saída / Venda
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {lastOutMovement ? (
              <>
                -{lastOutMovement.quantity} un em{' '}
                {formatSafeDate(lastOutMovement.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </>
            ) : (
              'Sem registros'
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {lastOutMovement?.reason || 'Sem histórico de saída recente'}
          </div>
        </div>

        {/* MANDATORY LAST BALANCE INFO BOX */}
        {(() => {
          const activeItem = selectedVariant || product;
          const directCode = activeItem?.lastBalanceCode;
          const directDate = activeItem?.lastBalanceDate;
          const directCounted = activeItem?.lastBalanceCounted;
          const directUser = activeItem?.lastBalanceUser;

          const hasDirectInfo = !!(directCode || directDate);
          const hasMovementInfo = !!lastBalanceMovement;

          if (!hasDirectInfo && !hasMovementInfo) {
            return (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-amber-500/10 border border-amber-500/30">
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-amber-500" /> Último Balanço de Estoque
                </div>
                <div className="mt-2 text-xs font-semibold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-center">
                  Nunca realizado
                </div>
              </div>
            );
          }

          const displayCode = directCode || (lastBalanceMovement?.reason ? lastBalanceMovement.reason.split(':')[0] : 'Balanço Realizado');
          const rawDate = directDate || lastBalanceMovement?.createdAt;

          let displayDate = 'Data não informada';
          const parsedBalanDate = parseSafeDate(rawDate);
          if (parsedBalanDate) {
            displayDate = formatSafeDate(parsedBalanDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
          }

          const displayCounted = directCounted !== undefined 
            ? directCounted 
            : lastBalanceMovement?.newStock;

          const displayUser = directUser || lastBalanceMovement?.createdByName || 'Sistema';

          return (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-amber-500/10 border border-amber-500/30">
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-500" /> Último Balanço de Estoque
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="text-sm font-extrabold text-white">
                  {displayCode}
                </div>
                <div className="text-xs text-amber-300 font-mono">
                  Data: {displayDate}
                </div>
                {displayCounted !== undefined && (
                  <div className="text-xs font-semibold text-zinc-300">
                    Contado: <strong className="text-amber-400 font-mono">{displayCounted} un</strong>
                  </div>
                )}
                <div className="text-[10px] text-zinc-400">
                  Operador: {displayUser}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Movement History Section Header & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800 print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por motivo, operador, notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Todas as Movimentações' },
            { id: 'in', label: 'Apenas Entradas (+)' },
            { id: 'out', label: 'Apenas Saídas (-)' },
            { id: 'balance', label: 'Apenas Balanços / Inventário' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                typeFilter === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Movement Timeline Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Linha do Tempo do Estoque ({filteredMovements.length})
          </h3>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <Clock className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-400">Nenhuma movimentação registrada para o filtro selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800">
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Variação</th>
                  <th className="py-3.5 px-4 text-center">Tipo</th>
                  <th className="py-3.5 px-4 text-center">Quantidade</th>
                  <th className="py-3.5 px-4 text-center">Saldo (Ant. → Novo)</th>
                  <th className="py-3.5 px-4">Motivo / Documento</th>
                  <th className="py-3.5 px-4">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
                {filteredMovements.map(m => {
                  const dateStr = formatSafeDate(m.createdAt, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  const isEntry = m.type === 'in';

                  return (
                    <tr key={m.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-zinc-400">
                        {dateStr}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-white">
                        {m.variantName ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
                            {m.variantName}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Produto Principal</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isEntry ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Entrada (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Saída (-)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-extrabold text-base whitespace-nowrap">
                        <span className={isEntry ? 'text-emerald-400' : 'text-rose-400'}>
                          {isEntry ? '+' : '-'}{m.quantity} un
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs font-mono text-zinc-400 whitespace-nowrap">
                        {m.previousStock !== undefined ? m.previousStock : '?'} un → <strong className="text-white">{m.newStock !== undefined ? m.newStock : '?'} un</strong>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-semibold text-zinc-200">{m.reason || 'Movimentação'}</div>
                        {m.notes && <div className="text-zinc-500 text-[11px] mt-0.5">{m.notes}</div>}
                        {(m.balanceId || m.reason?.toLowerCase().includes('balanço')) && (
                          <Link
                            to={`/admin/estoque/balancos/${m.balanceId || m.reason?.split(':')[0]?.trim()}/divergencias`}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-colors mt-1 print:hidden"
                          >
                            <ClipboardList className="w-3 h-3" /> Abrir Balanço →
                          </Link>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-zinc-400 whitespace-nowrap">
                        {m.createdByName || 'Sistema'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
