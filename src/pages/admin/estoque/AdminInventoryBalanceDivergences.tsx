import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  RefreshCw, 
  HelpCircle, 
  Check, 
  X, 
  Barcode, 
  Search, 
  Filter, 
  ShieldCheck, 
  Lock,
  Layers,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { inventoryBalanceService } from '../../../services/inventoryBalanceService';
import { InventoryBalance, InventoryBalanceItem } from '../../../types/inventoryBalance';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { useSettings } from '../../../contexts/SettingsContext';

export function AdminInventoryBalanceDivergences() {
  const { balanceId } = useParams<{ balanceId: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const settings = useSettings();

  const [balance, setBalance] = useState<InventoryBalance | null>(null);
  const [items, setItems] = useState<InventoryBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  const [uncountedResolution, setUncountedResolution] = useState<'KEEP_CURRENT' | 'SET_ZERO'>('KEEP_CURRENT');
  const [tableFilter, setTableFilter] = useState<'ALL' | 'DIVERGENCES' | 'SHORTAGE' | 'SURPLUS' | 'UNCOUNTED'>('DIVERGENCES');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    if (!balanceId) return;
    try {
      setLoading(true);
      const [balData, itemsData] = await Promise.all([
        inventoryBalanceService.getBalance(balanceId),
        inventoryBalanceService.listBalanceItems(balanceId)
      ]);
      setBalance(balData);
      setItems(itemsData);
    } catch (e) {
      console.error("Error loading divergence data:", e);
      toast("Erro ao carregar dados do balanço.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [balanceId]);

  const handleFinalize = async () => {
    if (!balance || !balanceId) return;

    if (balance.status === 'FINALIZADO') {
      toast("Este balanço já foi finalizado.", "info");
      return;
    }

    const uncountedCount = items.filter(i => !i.counted && i.countedQuantity === 0).length;

    const isConfirmed = await confirm({
      title: "Finalizar e Aplicar Ajuste de Estoque?",
      message: `Atenção: Ao finalizar o balanço ${balance.code}, o estoque real de todos os produtos e variações será permanentemente atualizado no banco de dados com histórico de movimentação. ${
        uncountedCount > 0 
          ? `Existem ${uncountedCount} itens não contados que serão tratados com a opção "${uncountedResolution === 'KEEP_CURRENT' ? 'Manter Saldo Atual' : 'Zerar Saldo'}".`
          : ''
      } Deseja prosseguir?`,
      confirmText: "Sim, Finalizar Estoque",
      cancelText: "Voltar e Revisar",
      variant: "danger"
    });

    if (!isConfirmed) return;

    try {
      setFinalizing(true);
      const res = await inventoryBalanceService.finalizeBalance(balanceId, {
        uncountedResolution
      });

      if (res.success) {
        toast(res.message, "success");
        await loadData();
      }
    } catch (e: any) {
      console.error("Error finalizing balance:", e);
      toast(e.message || "Erro ao finalizar balanço.", "error");
    } finally {
      setFinalizing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!balance || !balanceId) return;

    const isConfirmed = await confirm({
      title: "Excluir Balanço Definitivamente?",
      message: `ATENÇÃO: Tem certeza que deseja apagar DEFINITIVAMENTE o balanço "${balance.code} - ${balance.name}"? Esta ação removerá permanentemente todos os registros, itens e histórico deste balanço e NÃO poderá ser desfeita.`,
      confirmText: "Sim, Excluir Definitivamente",
      cancelText: "Cancelar",
      variant: "danger"
    });

    if (!isConfirmed) return;

    try {
      await inventoryBalanceService.deleteBalance(balanceId);
      toast("Balanço excluído definitivamente com sucesso.", "success");
      navigate('/admin/estoque/balancos');
    } catch (e: any) {
      console.error("Error deleting balance:", e);
      toast("Erro ao excluir balanço definitivamente.", "error");
    }
  };

  // Filter items
  const filteredItems = items.filter(i => {
    const matchesSearch = 
      i.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.variantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.barcode || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (tableFilter === 'DIVERGENCES') return i.difference !== 0;
    if (tableFilter === 'SHORTAGE') return i.difference < 0;
    if (tableFilter === 'SURPLUS') return i.difference > 0;
    if (tableFilter === 'UNCOUNTED') return !i.counted && i.countedQuantity === 0;
    return true;
  });

  // Calculate totals
  const totalExpectedItems = items.length;
  const countedItemsCount = items.filter(i => i.counted || i.countedQuantity > 0).length;
  const uncountedItemsCount = totalExpectedItems - countedItemsCount;

  const shortageList = items.filter(i => i.difference < 0);
  const surplusList = items.filter(i => i.difference > 0);

  const totalShortageUnits = shortageList.reduce((acc, i) => acc + Math.abs(i.difference), 0);
  const totalShortageCost = shortageList.reduce((acc, i) => acc + (Math.abs(i.difference) * (i.unitCost || 0)), 0);

  const totalSurplusUnits = surplusList.reduce((acc, i) => acc + i.difference, 0);
  const totalSurplusCost = surplusList.reduce((acc, i) => acc + (i.difference * (i.unitCost || 0)), 0);

  const netCostImpact = totalSurplusCost - totalShortageCost;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400 space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando relatório de divergências...</p>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="p-8 text-center text-zinc-400 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="text-lg font-bold text-white">Balanço não encontrado</div>
        <Link to="/admin/estoque/balancos" className="text-amber-400 underline text-sm">
          Voltar para a lista de balanços
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block space-y-4 mb-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h1 className="text-xl font-bold">{settings.storeName || 'Discreta Boutique'}</h1>
            <p className="text-xs text-gray-600">Relatório Oficial de Inventário e Balanço de Estoque</p>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold">{balance.code}</div>
            <div>Data: {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5 print:hidden">
        <div>
          <Link
            to="/admin/estoque/balancos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para lista
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Relatório de Divergências e Finalização
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              balance.status === 'FINALIZADO' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {balance.code} — {balance.status}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Confira as faltas e sobras apuradas antes de aplicar o ajuste definitivo no estoque da loja.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório
          </button>

          <button
            onClick={handleDelete}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-2"
            title="Excluir Balanço Definitivamente"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>

          {balance.status !== 'FINALIZADO' ? (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95"
            >
              {finalizing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processando Ajuste...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Finalizar Estoque Definitivo
                </>
              )}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
              <Lock className="w-4 h-4" /> Estoque Ajustado & Finalizado
            </div>
          )}
        </div>
      </div>

      {/* Summary Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Itens Não Contados</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {uncountedItemsCount} <span className="text-xs text-zinc-500 font-normal">de {totalExpectedItems}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Pendentes de contagem física</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-500" /> Total de Faltas
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            -{totalShortageUnits} un
          </div>
          <div className="text-xs text-rose-300/80 font-mono mt-0.5">
            - R$ {totalShortageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Custo)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Total de Sobras
          </div>
          <div className="text-xl font-bold text-blue-400 mt-1">
            +{totalSurplusUnits} un
          </div>
          <div className="text-xs text-blue-300/80 font-mono mt-0.5">
            + R$ {totalSurplusCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Custo)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Impacto Financeiro Líquido</div>
          <div className={`text-xl font-bold mt-1 ${netCostImpact < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {netCostImpact < 0 ? '-' : '+'} R$ {Math.abs(netCostImpact).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Diferença total no custo do estoque</div>
        </div>
      </div>

      {/* Uncounted Items Resolution Option Box (Print Hidden) */}
      {balance.status !== 'FINALIZADO' && uncountedItemsCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl space-y-3 print:hidden">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            Opção para {uncountedItemsCount} itens pendentes não bipados:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              uncountedResolution === 'KEEP_CURRENT'
                ? 'bg-zinc-900 border-amber-500 text-amber-300'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}>
              <input
                type="radio"
                name="uncountedOption"
                checked={uncountedResolution === 'KEEP_CURRENT'}
                onChange={() => setUncountedResolution('KEEP_CURRENT')}
                className="mt-1 accent-amber-500"
              />
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-white">
                  Manter saldo atual do sistema (Seguro)
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Não altera o estoque atual dos itens que não foram bipados neste balanço.
                </div>
              </div>
            </label>

            <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              uncountedResolution === 'SET_ZERO'
                ? 'bg-zinc-900 border-rose-500 text-rose-300'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}>
              <input
                type="radio"
                name="uncountedOption"
                checked={uncountedResolution === 'SET_ZERO'}
                onChange={() => setUncountedResolution('SET_ZERO')}
                className="mt-1 accent-rose-500"
              />
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-white">
                  Zerar saldo dos itens não contados (Perdas / Quebras)
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Assume que itens não bipados estão ausentes no estoque físico e define seu saldo para ZERO.
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Table Filters (Print Hidden) */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800 print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar item na tabela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'DIVERGENCES', label: `Divergências (${shortageList.length + surplusList.length})` },
            { id: 'SHORTAGE', label: `Faltas (${shortageList.length})` },
            { id: 'SURPLUS', label: `Sobras (${surplusList.length})` },
            { id: 'UNCOUNTED', label: `Não Contados (${uncountedItemsCount})` },
            { id: 'ALL', label: `Todos (${items.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTableFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                tableFilter === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divergence Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800">
                <th className="py-3 px-4">Produto / Variação</th>
                <th className="py-3 px-4">SKU / EAN</th>
                <th className="py-3 px-4 text-center">Snapshot Frio</th>
                <th className="py-3 px-4 text-center">Contado Físico</th>
                <th className="py-3 px-4 text-center">Divergência</th>
                <th className="py-3 px-4 text-right">Custo Unit.</th>
                <th className="py-3 px-4 text-right">Impacto R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                    Nenhum item corresponde ao filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const snapshot = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
                  const counted = item.countedQuantity || 0;
                  const diff = item.difference || 0;
                  const cost = item.unitCost || 0;
                  const totalImpact = diff * cost;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {item.productName}
                            {item.variantName && (
                              <span className="text-amber-400 font-semibold text-xs ml-2">
                                ({item.variantName})
                              </span>
                            )}
                          </div>
                          <Link
                            to={`/admin/estoque/ficha/${item.productId}${item.variantId ? `?variantId=${encodeURIComponent(item.variantId)}` : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-colors shrink-0 print:hidden"
                            title="Abrir Ficha de Estoque em nova aba"
                          >
                            Ficha →
                          </Link>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                        <div>{item.sku}</div>
                        {item.barcode && <div className="text-[10px] text-zinc-500">{item.barcode}</div>}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-zinc-400">
                        {snapshot} un
                      </td>

                      <td className="py-3 px-4 text-center font-extrabold text-amber-400">
                        {counted} un
                      </td>

                      <td className="py-3 px-4 text-center">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        ) : diff < 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Falta {diff} un
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Sobra +{diff} un
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-400">
                        R$ {cost.toFixed(2)}
                      </td>

                      <td className={`py-3 px-4 text-right font-mono font-bold text-xs ${
                        totalImpact < 0 ? 'text-rose-400' : totalImpact > 0 ? 'text-blue-400' : 'text-zinc-500'
                      }`}>
                        {totalImpact === 0 ? 'R$ 0,00' : `${totalImpact > 0 ? '+' : ''} R$ ${totalImpact.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Signature Footer */}
      <div className="hidden print:block pt-12 text-xs text-gray-700 space-y-8 border-t mt-8">
        <div className="grid grid-cols-2 gap-12">
          <div className="border-t border-black pt-2 text-center">
            Assinatura do Conferente / Operador
          </div>
          <div className="border-t border-black pt-2 text-center">
            Assinatura do Gerente de Estoque / Admin
          </div>
        </div>
      </div>
    </div>
  );
}
