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

interface StockMovementDoc {
  id: string;
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
  createdAt?: any;
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

  const loadData = async () => {
    if (!productId) return;
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
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
      const movSnap = await getDocs(q);
      const movList = movSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovementDoc));
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
  const handleVariantTabChange = (variantId: string) => {
    setActiveVariantTab(variantId);
    if (variantId === 'ALL') {
      searchParams.delete('variantId');
    } else {
      searchParams.set('variantId', variantId);
    }
    setSearchParams(searchParams);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400 space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando Ficha de Estoque...</p>
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
  const selectedVariant = activeVariantTab !== 'ALL' ? variants.find(v => v.id === activeVariantTab) : null;

  // Filter movements by variant tab and search/type
  const filteredMovements = movements.filter(m => {
    if (activeVariantTab !== 'ALL' && m.variantId !== activeVariantTab) return false;
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
      {/* Header Breadcrumb */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <Link
            to="/admin/mov_estoque"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Movimentação de Estoque
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

        <button
          onClick={() => window.print()}
          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-2 print:hidden"
        >
          <Printer className="w-4 h-4" /> Imprimir Ficha
        </button>
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                SKU: {selectedVariant ? selectedVariant.sku : product.sku}
              </span>
              {(product.gtin || (selectedVariant && selectedVariant.barcode)) && (
                <span className="text-xs font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded">
                  EAN: {selectedVariant?.barcode || product.gtin}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {product.name}
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
      {product.hasVariants && variants.length > 0 && (
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

          {variants.map(v => (
            <button
              key={v.id}
              onClick={() => handleVariantTabChange(v.id!)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeVariantTab === v.id
                  ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {v.name} ({v.stock || 0} un)
            </button>
          ))}
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
                {lastInMovement.createdAt?.toDate 
                  ? lastInMovement.createdAt.toDate().toLocaleDateString('pt-BR') 
                  : 'Recente'}
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
                {lastOutMovement.createdAt?.toDate 
                  ? lastOutMovement.createdAt.toDate().toLocaleDateString('pt-BR') 
                  : 'Recente'}
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
        <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-amber-500/10 border border-amber-500/30">
          <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-amber-500" /> Último Balanço de Estoque
          </div>

          {lastBalanceMovement || (selectedVariant && (selectedVariant as any).lastBalanceDate) || (product as any).lastBalanceDate ? (
            <div className="mt-1 space-y-0.5">
              <div className="text-sm font-extrabold text-white">
                {(product as any).lastBalanceCode || (selectedVariant as any)?.lastBalanceCode || lastBalanceMovement?.reason?.split(':')[0] || 'Balanço Realizado'}
              </div>
              <div className="text-xs text-amber-300 font-mono">
                {(product as any).lastBalanceDate?.toDate 
                  ? (product as any).lastBalanceDate.toDate().toLocaleDateString('pt-BR')
                  : lastBalanceMovement?.createdAt?.toDate
                  ? lastBalanceMovement.createdAt.toDate().toLocaleDateString('pt-BR')
                  : 'Data não informada'}
              </div>
              <div className="text-[10px] text-zinc-400">
                Operador: {(product as any).lastBalanceUser || lastBalanceMovement?.createdByName || 'Admin'}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs font-semibold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-center">
              Nunca contabilizado em balanço.
            </div>
          )}
        </div>
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
                  const dateStr = m.createdAt?.toDate 
                    ? m.createdAt.toDate().toLocaleString('pt-BR') 
                    : new Date(m.createdAt || Date.now()).toLocaleString('pt-BR');

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
