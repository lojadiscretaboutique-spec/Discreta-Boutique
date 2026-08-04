import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  FileSpreadsheet, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  RefreshCw,
  Clock,
  ChevronRight,
  Printer
} from 'lucide-react';
import { inventoryBalanceService } from '../../../services/inventoryBalanceService';
import { InventoryBalance, InventoryBalanceStatus } from '../../../types/inventoryBalance';
import { useFeedback } from '../../../contexts/FeedbackContext';

export function AdminInventoryBalanceList() {
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadBalances = async () => {
    try {
      setLoading(true);
      const data = await inventoryBalanceService.listBalances();
      setBalances(data);
    } catch (error) {
      console.error("Error loading balances:", error);
      toast("Erro ao carregar lista de balanços.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  const handleCancel = async (balance: InventoryBalance) => {
    const isConfirmed = await confirm({
      title: "Cancelar Balanço?",
      message: `Tem certeza que deseja cancelar o balanço "${balance.code} - ${balance.name}"? Nenhuma alteração de estoque será aplicada.`,
      confirmText: "Sim, Cancelar",
      cancelText: "Voltar",
      variant: "danger"
    });

    if (isConfirmed && balance.id) {
      try {
        await inventoryBalanceService.cancelBalance(balance.id);
        toast("Balanço cancelado com sucesso.", "success");
        loadBalances();
      } catch (e) {
        toast("Erro ao cancelar balanço.", "error");
      }
    }
  };

  const filteredBalances = balances.filter(b => {
    const matchesSearch = 
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.createdByName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: InventoryBalanceStatus) => {
    switch (status) {
      case 'EM_CONTAGEM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
            <Play className="w-3 h-3" /> Em Contagem
          </span>
        );
      case 'RASCUNHO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Clock className="w-3 h-3" /> Rascunho
          </span>
        );
      case 'PAUSADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Pause className="w-3 h-3" /> Pausado
          </span>
        );
      case 'AGUARDANDO_CONFERENCIA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <AlertTriangle className="w-3 h-3" /> Em Conferência
          </span>
        );
      case 'FINALIZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <CheckCircle2 className="w-3 h-3" /> Finalizado
          </span>
        );
      case 'CANCELADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return <span className="text-xs text-zinc-400">{status}</span>;
    }
  };

  const totalBalances = balances.length;
  const activeBalances = balances.filter(b => b.status === 'EM_CONTAGEM' || b.status === 'PAUSADO').length;
  const finishedBalances = balances.filter(b => b.status === 'FINALIZADO').length;
  const totalShortageVal = balances.reduce((acc, b) => acc + (b.shortageCostValue || 0), 0);
  const totalSurplusVal = balances.reduce((acc, b) => acc + (b.surplusCostValue || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-500 uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4" /> Gestão de Estoque e Inventário
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Balanço de Estoque
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Realize inventários físicos com snapshot de segurança, leitura de código de barras e relatórios de divergência.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadBalances}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/admin/estoque/balancos/novo"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo Balanço
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalBalances}</div>
            <div className="text-xs text-zinc-400 font-medium">Total de Balanços</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Play className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{activeBalances}</div>
            <div className="text-xs text-zinc-400 font-medium">Balanços Em Andamento</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-rose-400">
              R$ {totalShortageVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-zinc-400 font-medium">Faltas Acumuladas (Custo)</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-400">
              R$ {totalSurplusVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-zinc-400 font-medium">Sobras Acumuladas (Custo)</div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por código, nome ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 font-medium shrink-0">Filtrar:</span>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'EM_CONTAGEM', label: 'Em Contagem' },
            { id: 'PAUSADO', label: 'Pausados' },
            { id: 'FINALIZADO', label: 'Finalizados' },
            { id: 'RASCUNHO', label: 'Rascunho' },
            { id: 'CANCELADO', label: 'Cancelados' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Balances List Table */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-sm">Carregando balanços de estoque...</p>
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-3">
            <ClipboardList className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
            <div className="text-base font-semibold text-white">Nenhum balanço encontrado</div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'ALL'
                ? "Nenhum resultado corresponde aos filtros selecionados."
                : "Ainda não há inventários ou balanços cadastrados. Clique no botão abaixo para iniciar a primeira contagem física."}
            </p>
            {(!searchTerm && statusFilter === 'ALL') && (
              <Link
                to="/admin/estoque/balancos/novo"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold mt-2"
              >
                <Plus className="w-4 h-4" /> Criar Primeiro Balanço
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800">
                  <th className="py-3.5 px-4">Código / Balanço</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Criado por / Data</th>
                  <th className="py-3.5 px-4 text-center">Itens (Esperados vs Contados)</th>
                  <th className="py-3.5 px-4 text-center">Divergências</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
                {filteredBalances.map((balance) => {
                  const createdDate = balance.createdAt?.toDate 
                    ? balance.createdAt.toDate().toLocaleDateString('pt-BR') 
                    : new Date(balance.createdAt || Date.now()).toLocaleDateString('pt-BR');

                  const expected = balance.expectedItems || 0;
                  const counted = balance.countedItems || 0;
                  const percent = expected > 0 ? Math.round((counted / expected) * 100) : 0;

                  return (
                    <tr key={balance.id} className="hover:bg-zinc-800/40 transition-colors group">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-mono font-bold text-amber-400 text-xs shrink-0">
                            {balance.code.split('-')[2] || '01'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                              {balance.code}
                            </div>
                            <div className="text-xs text-zinc-400 font-medium line-clamp-1">
                              {balance.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {getStatusBadge(balance.status)}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-xs text-zinc-400">
                        <div className="font-medium text-zinc-300">{balance.createdByName}</div>
                        <div>{createdDate}</div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-bold text-white text-xs">
                            {counted} / {expected} itens ({percent}%)
                          </span>
                          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                            <div 
                              className={`h-full transition-all ${
                                percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`} 
                              style={{ width: `${Math.min(100, percent)}%` }} 
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            -{balance.shortageItems || 0} faltas
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            +{balance.surplusItems || 0} sobras
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {(balance.status === 'EM_CONTAGEM' || balance.status === 'PAUSADO') && (
                            <Link
                              to={`/admin/estoque/balancos/${balance.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors shadow-md shadow-emerald-500/20"
                            >
                              <Play className="w-3.5 h-3.5" /> Bipar / Contar
                            </Link>
                          )}

                          {(balance.status === 'EM_CONTAGEM' || balance.status === 'PAUSADO' || balance.status === 'AGUARDANDO_CONFERENCIA') && (
                            <Link
                              to={`/admin/estoque/balancos/${balance.id}/divergencias`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 font-semibold text-xs transition-colors"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> Conferir / Finalizar
                            </Link>
                          )}

                          {balance.status === 'FINALIZADO' && (
                            <Link
                              to={`/admin/estoque/balancos/${balance.id}/divergencias`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-xs transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" /> Relatório Final
                            </Link>
                          )}

                          {(balance.status === 'EM_CONTAGEM' || balance.status === 'PAUSADO' || balance.status === 'RASCUNHO') && (
                            <button
                              onClick={() => handleCancel(balance)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Cancelar Balanço"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
