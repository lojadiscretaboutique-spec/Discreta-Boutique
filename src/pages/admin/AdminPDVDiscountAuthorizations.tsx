import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { 
  Lock, 
  Unlock, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RefreshCw, 
  ShieldAlert,
  FileText
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useFeedback } from '../../contexts/FeedbackContext';

interface AuthorizationRecord {
  id: string;
  createdAt: any;
  operatorId: string;
  operatorName: string;
  authorizerId: string;
  authorizerName: string;
  authorizerRole: string;
  nivelNecessario: string;
  valorBruto: number;
  descontoTotal: number;
  percentualEfetivo: number;
  valorFinal: number;
  status: 'AUTHORIZED' | 'USED' | 'INVALIDATED' | 'EXPIRED';
  motivo: string;
  observacao: string;
  ipAddress?: string;
  timezone?: string;
  orderId?: string;
  invalidationReason?: string;
}

export const AdminPDVDiscountAuthorizations: React.FC = () => {
  const { toast } = useFeedback();
  const [authorizations, setAuthorizations] = useState<AuthorizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'pdvDiscountAuthorizations'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as AuthorizationRecord;
      });
      setAuthorizations(list);
    } catch (err) {
      console.error('Error loading authorization history:', err);
      toast('Erro ao carregar histórico de autorizações de desconto.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 uppercase tracking-widest">
            <Unlock size={12} />
            Pendente
          </span>
        );
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 uppercase tracking-widest">
            <CheckCircle2 size={12} />
            Utilizada
          </span>
        );
      case 'INVALIDATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 uppercase tracking-widest">
            <XCircle size={12} />
            Invalidada
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 uppercase tracking-widest">
            <Clock size={12} />
            Expirada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
            {status}
          </span>
        );
    }
  };

  const filteredRecords = authorizations.filter(rec => {
    // Search filter
    const matchesSearch = 
      (rec.operatorName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.authorizerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.motivo?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.orderId?.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;

    // Role filter
    const matchesRole = roleFilter === 'all' || rec.authorizerRole === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-amber-500" />
            HISTÓRICO DE AUTORIZAÇÕES DE DESCONTO
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Painel de auditoria de segurança para concessão de descontos e liberação por PIN de supervisores no PDV.
          </p>
        </div>
        <Button
          onClick={fetchRecords}
          disabled={isLoading}
          variant="outline"
          className="flex items-center gap-2 border-slate-200 dark:border-white/10 dark:text-white self-start sm:self-center uppercase font-black text-xs py-3"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          Atualizar Lista
        </Button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Emitidas</span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{authorizations.length}</h2>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Utilizadas (USED)</span>
          <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">
            {authorizations.filter(a => a.status === 'USED').length}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Pendentes (AUTHORIZED)</span>
          <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
            {authorizations.filter(a => a.status === 'AUTHORIZED').length}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Valores Concedidos</span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {formatCurrency(authorizations.filter(a => a.status === 'USED').reduce((acc, a) => acc + a.descontoTotal, 0))}
          </h2>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por operador, autorizador, motivo ou venda..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border-0 focus:ring-2 focus:ring-amber-500 rounded-2xl text-sm outline-hidden dark:text-white"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2">
          <Filter size={16} className="text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
          >
            <option value="all">Todos Status</option>
            <option value="AUTHORIZED">Pendentes</option>
            <option value="USED">Utilizadas</option>
            <option value="INVALIDATED">Invalidadas</option>
            <option value="EXPIRED">Expiradas</option>
          </select>
        </div>

        {/* Role Filter */}
        <div className="w-full md:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
          >
            <option value="all">Todos Cargos</option>
            <option value="gerente">Gerente</option>
            <option value="administrador">Administrador</option>
            <option value="proprietario">Proprietário</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <RefreshCw size={36} className="animate-spin text-amber-500" />
          <p className="text-sm font-semibold uppercase tracking-wider">Carregando dados de auditoria...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center gap-3 text-slate-400">
          <AlertCircle size={40} className="text-amber-500" />
          <p className="text-sm font-semibold uppercase tracking-wider">Nenhum registro de autorização encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((rec) => (
            <div 
              key={rec.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 hover:shadow-lg transition-all"
            >
              <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                {/* Meta details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={14} />
                      {rec.createdAt instanceof Date ? rec.createdAt.toLocaleString('pt-BR') : new Date(rec.createdAt).toLocaleString('pt-BR')}
                    </span>
                    {getStatusBadge(rec.status)}
                    <span className="text-xs font-bold bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400">
                      ID: {rec.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Operador Solicitante</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                        <User size={14} className="text-slate-400" />
                        {rec.operatorName || 'Caixa'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Autorizador (Supervisor)</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                        <User size={14} className="text-amber-500" />
                        {rec.authorizerName} ({rec.authorizerRole.toUpperCase()})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Values Panel */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-white/5 shrink-0 w-full lg:w-auto">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Valor Bruto</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(rec.valorBruto)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Desconto</span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(rec.descontoTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">% Efetivo</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{rec.percentualEfetivo.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Valor Final</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(rec.valorFinal)}</span>
                  </div>
                </div>
              </div>

              {/* Reasons and details footer */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-start text-xs font-semibold">
                <div className="space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider">Motivo:</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300 font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                    {rec.motivo || 'Não informado'}
                  </span>
                  {rec.observacao && (
                    <div className="mt-1 text-slate-500 dark:text-slate-400 italic">
                      Obs: "{rec.observacao}"
                    </div>
                  )}
                  {rec.status === 'INVALIDATED' && rec.invalidationReason && (
                    <div className="mt-1 text-red-600 dark:text-red-400 font-bold">
                      Motivo Invalidação: "{rec.invalidationReason}"
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                  {rec.orderId && (
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      Venda Vinculada: #{rec.orderId.slice(-6).toUpperCase()}
                    </span>
                  )}
                  {rec.ipAddress && (
                    <span>IP Registro: {rec.ipAddress} ({rec.timezone || 'Local'})</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AdminPDVDiscountAuthorizations;
