import React, { useEffect, useState, useMemo } from 'react';
import { 
  Percent, 
  Search, 
  Filter, 
  X, 
  Download, 
  Printer, 
  Eye, 
  Calendar, 
  User, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ShoppingBag, 
  RefreshCcw, 
  ChevronRight,
  Info,
  DollarSign,
  Tag,
  CreditCard,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { 
  DiscountAuditLog, 
  DiscountAuditFilter, 
  DiscountStatus, 
  DISCOUNT_STATUS_LABELS 
} from '../../types/pdvDiscountAudit';
import { 
  getDiscountAuditLogs, 
  normalizeDate 
} from '../../services/pdvDiscountAuditService';
import { Link } from 'react-router-dom';

export function AdminPDVDiscountHistory() {
  const { user, userData, isAdmin, hasPermission } = useAuthStore();
  const { toast } = useFeedback();

  const [logs, setLogs] = useState<DiscountAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<DiscountAuditLog | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Check cost permission
  const canViewCost = isAdmin || hasPermission('stock', 'visualizar_custo') || hasPermission('products', 'visualizar_custo');

  // Filters State
  const [filters, setFilters] = useState<DiscountAuditFilter>({
    startDate: '',
    endDate: '',
    orderNumber: '',
    operatorSearch: '',
    authorizerSearch: '',
    customerSearch: '',
    reasonSearch: '',
    status: 'ALL',
    requiresAuthorization: 'ALL',
    authLevel: 'ALL',
    discountScope: 'ALL',
    minPercent: '',
    maxPercent: '',
    minDiscountValue: '',
    maxDiscountValue: '',
    productSearch: '',
    terminalSearch: ''
  });

  // Load Audit Logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const companyId = (userData as any)?.companyId || 'discreta';
      const data = await getDiscountAuditLogs(filters, companyId, 300);
      setLogs(data);
    } catch (err) {
      console.error('Erro ao carregar histórico de descontos:', err);
      toast('Erro ao carregar histórico de descontos do PDV.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters.startDate, filters.endDate, filters.status, filters.requiresAuthorization, filters.discountScope]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      orderNumber: '',
      operatorSearch: '',
      authorizerSearch: '',
      customerSearch: '',
      reasonSearch: '',
      status: 'ALL',
      requiresAuthorization: 'ALL',
      authLevel: 'ALL',
      discountScope: 'ALL',
      minPercent: '',
      maxPercent: '',
      minDiscountValue: '',
      maxDiscountValue: '',
      productSearch: '',
      terminalSearch: ''
    });
  };

  // Top Metrics Indicators calculated directly from filtered results
  const metrics = useMemo(() => {
    let countWithDiscount = 0;
    let sumGrossValue = 0;
    let sumDiscountTotal = 0;
    let countNoAuth = 0;
    let countWithAuth = 0;
    let countCancelledDiscounts = 0;
    let countCancelledSales = 0;

    logs.forEach((log) => {
      sumGrossValue += log.grossTotal || 0;
      sumDiscountTotal += log.totalDiscount || 0;

      if (log.totalDiscount > 0) {
        countWithDiscount++;
      }

      if (log.requiresAuthorization) {
        countWithAuth++;
      } else {
        countNoAuth++;
      }

      if (log.status === 'CANCELLED' || log.status === 'INVALIDATED' || log.status === 'EXPIRED' || log.status === 'REJECTED') {
        countCancelledDiscounts++;
      }

      if (log.status === 'SALE_CANCELLED' || log.saleStatus === 'CANCELADO' || log.saleStatus === 'cancelado') {
        countCancelledSales++;
      }
    });

    const avgDiscountPercent = sumGrossValue > 0 ? ((sumDiscountTotal / sumGrossValue) * 100).toFixed(1) : '0.0';

    return {
      totalRecords: logs.length,
      countWithDiscount,
      sumGrossValue,
      sumDiscountTotal,
      avgDiscountPercent,
      countNoAuth,
      countWithAuth,
      countCancelledDiscounts,
      countCancelledSales
    };
  }, [logs]);

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast('Nenhum registro para exportar.', 'warning');
      return;
    }

    try {
      const headers = [
        'Data/Hora',
        'Venda',
        'Operador',
        'Cliente',
        'Terminal',
        'Valor Bruto (R$)',
        'Desconto Total (R$)',
        'Percentual (%)',
        'Valor Final (R$)',
        'Motivo',
        'Observação',
        'Exigiu Autorização',
        'Autorizador',
        'Nível Autorização',
        'Status'
      ];

      const rows = logs.map(log => [
        `"${normalizeDate(log.dateTime || log.createdAt).toLocaleString('pt-BR')}"`,
        `"${log.orderNumber || log.orderId || 'Não finalizada'}"`,
        `"${log.operatorName || 'Não informado'}"`,
        `"${log.customerName || 'Cliente Balcão'}"`,
        `"${log.terminalId || 'Caixa 01'}"`,
        `"${(log.grossTotal || 0).toFixed(2)}"`,
        `"${(log.totalDiscount || 0).toFixed(2)}"`,
        `"${(log.effectivePercent || 0).toFixed(2)}%"`,
        `"${(log.finalTotal || 0).toFixed(2)}"`,
        `"${(log.reason || 'Desconto PDV').replace(/"/g, '""')}"`,
        `"${(log.observation || '').replace(/"/g, '""')}"`,
        `"${log.requiresAuthorization ? 'Sim' : 'Não'}"`,
        `"${log.authorizerName || 'Não se aplica'}"`,
        `"${log.requiredAuthLevel || 'Dentro do limite'}"`,
        `"${DISCOUNT_STATUS_LABELS[log.status]?.label || log.status}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historico_descontos_pdv_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('Exportação CSV gerada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast('Falha ao exportar relatório CSV.', 'error');
    }
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <Percent className="w-4 h-4" />
            <span>Auditoria & Governança de Caixa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Histórico e Auditoria de Descontos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Registro unificado e auditável de todos os descontos concedidos no PDV e autorizações gerenciais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            variant="outline"
            className={cn(
              "h-10 px-3.5 text-xs font-bold rounded-xl gap-2 transition-all",
              isFilterOpen ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700" : ""
            )}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros {isFilterOpen ? 'Ativos' : ''}</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="h-10 px-3.5 text-xs font-bold rounded-xl gap-2 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-10 px-3.5 text-xs font-bold rounded-xl gap-2 border-slate-200 dark:border-slate-800"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>

          <Button
            onClick={loadLogs}
            variant="ghost"
            className="h-10 w-10 p-0 rounded-xl"
            title="Atualizar lista"
          >
            <RefreshCcw className={cn("w-4 h-4", loading ? "animate-spin text-red-600" : "")} />
          </Button>
        </div>
      </div>

      {/* Resumo Superior / Top Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Vendas c/ Desconto</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
            {metrics.countWithDiscount}
          </span>
          <span className="text-[10px] text-slate-400">Total no período</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Valor Bruto Total</span>
          <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block truncate" title={formatCurrency(metrics.sumGrossValue)}>
            {formatCurrency(metrics.sumGrossValue)}
          </span>
          <span className="text-[10px] text-slate-400">Sem reduções</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">Total Descontos</span>
          <span className="text-lg font-black text-red-600 dark:text-red-400 mt-1 block truncate" title={formatCurrency(metrics.sumDiscountTotal)}>
            {formatCurrency(metrics.sumDiscountTotal)}
          </span>
          <span className="text-[10px] text-slate-400">Concedidos em R$</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">% Médio Desconto</span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {metrics.avgDiscountPercent}%
          </span>
          <span className="text-[10px] text-slate-400">Impacto na receita</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Sem Autorização</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {metrics.countNoAuth}
          </span>
          <span className="text-[10px] text-slate-400">Limite operador</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Com Autorização</span>
          <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
            {metrics.countWithAuth}
          </span>
          <span className="text-[10px] text-slate-400">Exigiram PIN</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">Desc. Cancelados</span>
          <span className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1 block">
            {metrics.countCancelledDiscounts}
          </span>
          <span className="text-[10px] text-slate-400">Expir/Inval/Recus</span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Vendas Canceladas</span>
          <span className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1 block">
            {metrics.countCancelledSales}
          </span>
          <span className="text-[10px] text-slate-400">Com desconto</span>
        </div>
      </div>

      {/* Filter Panel */}
      {isFilterOpen && (
        <form onSubmit={handleApplyFilters} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-red-600" />
              Filtros Avançados de Pesquisa
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsFilterOpen(false)} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Data Inicial</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Data Final</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Order Number */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Nº da Venda / ID</label>
              <input
                type="text"
                placeholder="Ex: #1042..."
                value={filters.orderNumber}
                onChange={e => setFilters(prev => ({ ...prev, orderNumber: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Status do Desconto</label>
              <select
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              >
                <option value="ALL">Todos os Status</option>
                <option value="APPLIED">Aplicado (Sem PIN)</option>
                <option value="AUTHORIZED">Autorizado</option>
                <option value="USED">Utilizado na Venda</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="INVALIDATED">Invalidado</option>
                <option value="EXPIRED">Expirado</option>
                <option value="REJECTED">Recusado</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="SALE_CANCELLED">Venda Cancelada</option>
              </select>
            </div>

            {/* Requires Authorization */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Exigiu Autorização?</label>
              <select
                value={String(filters.requiresAuthorization)}
                onChange={e => setFilters(prev => ({ 
                  ...prev, 
                  requiresAuthorization: e.target.value === 'ALL' ? 'ALL' : e.target.value === 'true' 
                }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              >
                <option value="ALL">Todos</option>
                <option value="true">Sim (Exigiu Autorização)</option>
                <option value="false">Não (Limite Operador)</option>
              </select>
            </div>

            {/* Operator */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Operador do Caixa</label>
              <input
                type="text"
                placeholder="Nome do operador..."
                value={filters.operatorSearch}
                onChange={e => setFilters(prev => ({ ...prev, operatorSearch: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Authorizer */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Gerente / Autorizador</label>
              <input
                type="text"
                placeholder="Nome do autorizador..."
                value={filters.authorizerSearch}
                onChange={e => setFilters(prev => ({ ...prev, authorizerSearch: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Customer */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Cliente</label>
              <input
                type="text"
                placeholder="Nome do cliente..."
                value={filters.customerSearch}
                onChange={e => setFilters(prev => ({ ...prev, customerSearch: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Motivo / Observação</label>
              <input
                type="text"
                placeholder="Palavra-chave do motivo..."
                value={filters.reasonSearch}
                onChange={e => setFilters(prev => ({ ...prev, reasonSearch: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Scope */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Escopo do Desconto</label>
              <select
                value={filters.discountScope}
                onChange={e => setFilters(prev => ({ ...prev, discountScope: e.target.value as any }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              >
                <option value="ALL">Todos os Escopos</option>
                <option value="ITEM">Desconto por Item</option>
                <option value="GLOBAL">Desconto Geral na Venda</option>
              </select>
            </div>

            {/* Product / SKU */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Produto / SKU / Cód. Barras</label>
              <input
                type="text"
                placeholder="Busca por item..."
                value={filters.productSearch}
                onChange={e => setFilters(prev => ({ ...prev, productSearch: e.target.value }))}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-hidden dark:text-slate-100"
              />
            </div>

            {/* Min / Max Percent */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Faixa de % (Mín / Máx)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min %"
                  value={filters.minPercent}
                  onChange={e => setFilters(prev => ({ ...prev, minPercent: e.target.value ? Number(e.target.value) : '' }))}
                  className="w-1/2 h-9 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-hidden dark:text-slate-100"
                />
                <input
                  type="number"
                  placeholder="Máx %"
                  value={filters.maxPercent}
                  onChange={e => setFilters(prev => ({ ...prev, maxPercent: e.target.value ? Number(e.target.value) : '' }))}
                  className="w-1/2 h-9 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-hidden dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs h-9 font-bold border-slate-200 dark:border-slate-800"
            >
              Limpar Filtros
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs h-9 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 shadow-sm"
            >
              Aplicar Filtros
            </Button>
          </div>
        </form>
      )}

      {/* Main Table / List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Carregando auditoria de descontos...
            </span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Percent className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              Nenhum registro de desconto encontrado
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Não foram encontrados descontos aplicados ou solicitações de autorização para os filtros selecionados.
            </p>
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs font-bold mt-2">
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-black text-[10px] tracking-wider">
                    <th className="p-3.5 pl-4">Data e Hora</th>
                    <th className="p-3.5">Venda</th>
                    <th className="p-3.5">Operador</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5 text-right">Valor Bruto</th>
                    <th className="p-3.5 text-right">Desconto Total</th>
                    <th className="p-3.5 text-center">% Efetivo</th>
                    <th className="p-3.5 text-right">Valor Final</th>
                    <th className="p-3.5">Motivo</th>
                    <th className="p-3.5">Autorizador</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 pr-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {logs.map((log) => {
                    const statusMeta = DISCOUNT_STATUS_LABELS[log.status] || {
                      label: log.status,
                      colorClass: 'text-slate-600',
                      bgClass: 'bg-slate-100'
                    };

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="p-3.5 pl-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {normalizeDate(log.dateTime || log.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                          {log.orderNumber || (log.orderId ? `#${log.orderId.slice(-6).toUpperCase()}` : 'Venda N/F')}
                        </td>

                        <td className="p-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {log.operatorName || 'Caixa'}
                        </td>

                        <td className="p-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={log.customerName || 'Cliente Balcão'}>
                          {log.customerName || 'Balcão'}
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                          {formatCurrency(log.grossTotal)}
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap font-bold text-red-600 dark:text-red-400">
                          -{formatCurrency(log.totalDiscount)}
                        </td>

                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {log.effectivePercent}%
                          </span>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(log.finalTotal)}
                        </td>

                        <td className="p-3.5 max-w-[150px] truncate text-slate-700 dark:text-slate-300" title={log.reason}>
                          {log.reason || 'Desconto no PDV'}
                        </td>

                        <td className="p-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {log.requiresAuthorization ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              {log.authorizerName || 'Gerente'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Limite Caixa</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider", statusMeta.bgClass, statusMeta.colorClass)}>
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="p-3.5 pr-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-8 px-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Detalhes
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => {
                const statusMeta = DISCOUNT_STATUS_LABELS[log.status] || {
                  label: log.status,
                  colorClass: 'text-slate-600',
                  bgClass: 'bg-slate-100'
                };

                return (
                  <div key={log.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {log.orderNumber || (log.orderId ? `#${log.orderId.slice(-6).toUpperCase()}` : 'Venda N/F')}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border uppercase", statusMeta.bgClass, statusMeta.colorClass)}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                        {log.effectivePercent}% desc.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Data/Hora</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {normalizeDate(log.dateTime || log.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Operador</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {log.operatorName || 'Caixa'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Desconto Concedido</span>
                        <span className="text-red-600 dark:text-red-400 font-black">
                          -{formatCurrency(log.totalDiscount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor Final Venda</span>
                        <span className="text-slate-900 dark:text-slate-100 font-black">
                          {formatCurrency(log.finalTotal)}
                        </span>
                      </div>
                    </div>

                    {log.reason && (
                      <div className="text-xs bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-slate-500 text-[10px] uppercase block">Motivo:</span>
                        <span className="text-slate-800 dark:text-slate-200">{log.reason}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Autorizador: <strong className="text-slate-700 dark:text-slate-200">{log.authorizerName || 'Limite Operador'}</strong>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-8 px-3 text-xs font-bold rounded-xl gap-1 text-red-600 dark:text-red-400"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center font-bold">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Detalhes do Desconto {selectedLog.orderNumber || (selectedLog.orderId ? `#${selectedLog.orderId.slice(-6).toUpperCase()}` : '')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Registro de auditoria gravado em {normalizeDate(selectedLog.dateTime || selectedLog.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Status do Registro</span>
                  <span className={cn(
                    "inline-block mt-1 px-3 py-1 rounded-full text-xs font-black uppercase border",
                    DISCOUNT_STATUS_LABELS[selectedLog.status]?.bgClass || 'bg-slate-100',
                    DISCOUNT_STATUS_LABELS[selectedLog.status]?.colorClass || 'text-slate-700'
                  )}>
                    {DISCOUNT_STATUS_LABELS[selectedLog.status]?.label || selectedLog.status}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Status da Venda</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                    {selectedLog.saleStatus || 'ENTREGUE'}
                  </span>
                </div>
              </div>

              {/* 1. Dados da Venda & Operação */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-red-600" />
                  Dados da Venda e Atendimento
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nº da Venda</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedLog.orderNumber || selectedLog.orderId || 'Venda não finalizada'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Operador do Caixa</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedLog.operatorName || 'Não informado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedLog.customerName || 'Cliente Balcão'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Terminal / Caixa</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedLog.terminalId || 'Caixa 01'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. Resumo Financeiro do Desconto */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Resumo Financeiro
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor Bruto</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {formatCurrency(selectedLog.grossTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Desc. nos Itens</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {formatCurrency(selectedLog.itemsDiscountTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Desc. Geral Carrinho</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {formatCurrency(selectedLog.globalDiscount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-bold block">Desconto Total Concedido</span>
                    <strong className="text-red-600 dark:text-red-400 text-sm font-black">
                      -{formatCurrency(selectedLog.totalDiscount)} ({selectedLog.effectivePercent}%)
                    </strong>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>Valor Final cobrado do cliente:</span>
                  <span className="text-base font-black text-slate-900 dark:text-slate-100">
                    {formatCurrency(selectedLog.finalTotal)}
                  </span>
                </div>
              </div>

              {/* 3. Justificativa e Motivo */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-600" />
                  Justificativa do Desconto
                </h4>
                <div className="bg-slate-50/60 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Motivo do Desconto:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {selectedLog.reason || 'Desconto Concedido no Balcão'}
                    </span>
                  </div>
                  {selectedLog.observation && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Observação Registrada:</span>
                      <p className="text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap">
                        "{selectedLog.observation}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Governança e Autorização */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Governança & Nível de Autorização
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Exigiu PIN/Autorização?</span>
                    <strong className={cn("font-bold", selectedLog.requiresAuthorization ? "text-blue-600" : "text-emerald-600")}>
                      {selectedLog.requiresAuthorization ? 'Sim (Gerencial)' : 'Não (Limite Caixa)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nível Exigido</span>
                    <strong className="text-slate-900 dark:text-slate-100 uppercase">
                      {selectedLog.requiredAuthLevel || 'Dentro do limite'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Autorizador</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedLog.authorizerName || 'Não se aplica'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Perfil Autorizador</span>
                    <strong className="text-slate-900 dark:text-slate-100 uppercase">
                      {selectedLog.authorizerRole || 'Sistema'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 5. Detalhamento dos Produtos Descontados */}
              {selectedLog.discountItems && selectedLog.discountItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Produtos com Desconto Aplicado ({selectedLog.discountItems.length})</span>
                    {canViewCost && <span className="text-[10px] text-slate-400 font-normal">Controle de Margem de Custo Ativo</span>}
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5 pl-3">Produto / Variação</th>
                          <th className="p-2.5 text-center">Qtd</th>
                          <th className="p-2.5 text-right">Preço Orig.</th>
                          <th className="p-2.5 text-right">Desc. Unit.</th>
                          <th className="p-2.5 text-right">Preço Final</th>
                          {canViewCost && <th className="p-2.5 text-right">Custo</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {selectedLog.discountItems.map((item, idx) => (
                          <tr key={`item-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                            <td className="p-2.5 pl-3">
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.productName}</span>
                              {item.variantName && (
                                <span className="text-[10px] text-slate-500">{item.variantName}</span>
                              )}
                              {item.isBelowCost && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded-sm mt-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Abaixo do Custo
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300">{item.quantity}</td>
                            <td className="p-2.5 text-right text-slate-500 line-through">{formatCurrency(item.originalUnitPrice)}</td>
                            <td className="p-2.5 text-right text-red-600 font-bold">-{formatCurrency(item.unitDiscount)}</td>
                            <td className="p-2.5 text-right font-black text-slate-900 dark:text-slate-100">{formatCurrency(item.finalUnitPrice)}</td>
                            {canViewCost && (
                              <td className="p-2.5 text-right text-slate-500 font-mono">
                                {item.costPrice ? formatCurrency(item.costPrice) : 'N/I'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. Trilha de Auditoria & Timestamp */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-500">
                <span className="font-bold uppercase text-[10px] text-slate-400 block tracking-wider">Trilha de Auditoria do Sistema</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    • ID do Registro: <code className="text-slate-700 dark:text-slate-300 font-mono">{selectedLog.id}</code>
                  </div>
                  {selectedLog.authorizationId && (
                    <div>
                      • ID da Autorização PIN: <code className="text-slate-700 dark:text-slate-300 font-mono">{selectedLog.authorizationId}</code>
                    </div>
                  )}
                  {selectedLog.cancellationDate && (
                    <div className="col-span-2 text-red-600 dark:text-red-400 font-bold">
                      • Cancelado em: {normalizeDate(selectedLog.cancellationDate).toLocaleString('pt-BR')} por {selectedLog.cancelledBy || 'Sistema'} ({selectedLog.cancellationReason || 'Sem justificativa'})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-b-2xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="text-xs font-bold border-slate-200 dark:border-slate-800"
              >
                Fechar
              </Button>

              {selectedLog.orderId && (
                <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400">
                  <span>Ir para Gestão de Pedidos</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
