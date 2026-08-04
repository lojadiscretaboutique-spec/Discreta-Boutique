import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ClipboardList, 
  ArrowLeft, 
  Play, 
  Save, 
  EyeOff, 
  Eye, 
  CheckSquare, 
  Layers, 
  Package, 
  Info,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { inventoryBalanceService } from '../../../services/inventoryBalanceService';
import { categoryService, Category } from '../../../services/categoryService';
import { productService, Product } from '../../../services/productService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { InventoryBalanceScope } from '../../../types/inventoryBalance';

export function AdminInventoryBalanceNew() {
  const navigate = useNavigate();
  const { toast } = useFeedback();

  const [name, setName] = useState(`Balanço de Estoque - ${new Date().toLocaleDateString('pt-BR')}`);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [scope, setScope] = useState<InventoryBalanceScope>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  
  const [onlyActive, setOnlyActive] = useState(true);
  const [includeZeroStock, setIncludeZeroStock] = useState(true);
  const [blindCount, setBlindCount] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [catList, prodList] = await Promise.all([
          categoryService.listCategories(),
          productService.listProducts()
        ]);
        setCategories(catList);
        setProducts(prodList);
      } catch (e) {
        console.error("Error loading categories or products:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate scope preview
  const filteredProductsPreview = products.filter(p => {
    if (onlyActive && !p.active) return false;
    if (scope === 'CATEGORY' && selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    if (scope === 'BRAND' && selectedBrand && (p.brand || '').toLowerCase() !== selectedBrand.toLowerCase()) return false;
    if (!includeZeroStock && Math.max(0, p.stock || 0) === 0) return false;
    return true;
  });

  const estimatedItemsCount = filteredProductsPreview.reduce((acc, p) => {
    if (p.hasVariants && p.variantIdentifiers) {
      return acc + (p.variantIdentifiers.length || 1);
    }
    return acc + 1;
  }, 0);

  const handleSave = async (startImmediately: boolean) => {
    if (!name.trim()) {
      toast("Informe um nome para o balanço de estoque.", "error");
      return;
    }

    try {
      setCreating(true);
      let scopeVal = '';
      if (scope === 'CATEGORY') scopeVal = selectedCategoryId;
      if (scope === 'BRAND') scopeVal = selectedBrand;

      const balanceId = await inventoryBalanceService.createBalance({
        name: name.trim(),
        description: description.trim(),
        scope,
        scopeValue: scopeVal,
        scopeOptions: {
          onlyActive,
          includeZeroStock,
          includeInactive: !onlyActive
        },
        blindCount,
        notes: notes.trim(),
        startImmediately
      });

      toast(
        startImmediately 
          ? "Balanço iniciado com sucesso! Snapshot de estoque gravado." 
          : "Rascunho de balanço criado com sucesso.", 
        "success"
      );

      if (startImmediately) {
        navigate(`/admin/estoque/balancos/${balanceId}`);
      } else {
        navigate('/admin/estoque/balancos');
      }
    } catch (e: any) {
      console.error("Error creating balance:", e);
      toast(e.message || "Erro ao criar balanço de estoque.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <Link
            to="/admin/estoque/balancos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para lista de balanços
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-amber-500" />
            Novo Balanço de Estoque
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure o alcance do inventário físico e congele o snapshot inicial dos saldos esperados.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={creating}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar Rascunho
          </button>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 active:scale-95"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Congelando Snapshot...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Iniciar Balanço Agora
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Basic Info */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Identificação do Inventário
            </h2>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Nome do Balanço <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Balanço Geral de Agosto / Inventário Anual Discreta"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Descrição ou Motivo
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Contagem física periódica da loja física e depósito"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Section 2: Scope & Filters */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" /> Escopo do Inventário
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'ALL', label: 'Todos os Produtos', desc: 'Lojas e catálogo completo' },
                { id: 'CATEGORY', label: 'Por Categoria', desc: 'Apenas uma categoria específica' },
                { id: 'BRAND', label: 'Por Marca', desc: 'Apenas produtos da marca informada' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id as InventoryBalanceScope)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    scope === opt.id
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold text-xs uppercase tracking-wider text-white mb-1">
                    {opt.label}
                  </div>
                  <div className="text-xs text-zinc-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Sub-selector based on scope */}
            {scope === 'CATEGORY' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Selecione a Categoria
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Escolha uma Categoria --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'BRAND' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Nome da Marca
                </label>
                <input
                  type="text"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  placeholder="Ex: Predileta / Sexy Import"
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Scope Toggles */}
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded bg-zinc-950 border-zinc-800"
                />
                <span className="text-sm text-zinc-300 font-medium">
                  Contabilizar apenas produtos e variações ATIVOS no sistema
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeZeroStock}
                  onChange={(e) => setIncludeZeroStock(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded bg-zinc-950 border-zinc-800"
                />
                <span className="text-sm text-zinc-300 font-medium">
                  Incluir itens com estoque atual ZERADO
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Counting Preferences */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-500" /> Modo de Contagem
            </h2>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="blindCountCheck"
                checked={blindCount}
                onChange={(e) => setBlindCount(e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded border-zinc-700 mt-0.5"
              />
              <div>
                <label htmlFor="blindCountCheck" className="text-sm font-bold text-white cursor-pointer">
                  Ativar "Contagem Cega" (Recomendado)
                </label>
                <p className="text-xs text-zinc-400 mt-1">
                  Oculta o saldo atual esperado dos operadores na tela de bipagem. Evita que o bipador apenas confirme os números do sistema sem contar fisicamente.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Observações do Inventário
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Responsável da equipe de contagem, observações sobre prateleiras ou gavetas..."
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Sidebar Summary Box */}
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-5 sticky top-6">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" /> Resumo do Snapshot
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Produtos no Escopo:</span>
                <span className="font-bold text-white">{filteredProductsPreview.length}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Itens / Variações Estimados:</span>
                <span className="font-bold text-amber-400 text-lg">~{estimatedItemsCount}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Modo de Contagem:</span>
                <span className="font-semibold text-zinc-200">
                  {blindCount ? 'Contagem Cega' : 'Com Saldo Visível'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0" /> Como funciona o Snapshot?
              </div>
              <p className="leading-relaxed text-amber-200/90">
                Ao clicar em "Iniciar Balanço Agora", o sistema grava uma fotografia imutável de todos os saldos atuais no banco de dados. Qualquer venda ou movimentação posterior será rastreada sem corromper o cálculo da contagem física real.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Iniciar Balanço e Bipagem
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
