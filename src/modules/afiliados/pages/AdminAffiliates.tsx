import React, { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Check, 
  X, 
  AlertCircle, 
  Settings, 
  Percent, 
  Search, 
  Filter, 
  ExternalLink, 
  Phone,
  Grid,
  FileText,
  BadgeAlert,
  Sliders,
  MoreVertical,
  SlidersHorizontal,
} from 'lucide-react';
import { affiliateService, Affiliate, Commission, AffiliateSettings } from '../services/affiliateService';

// Format currency helper
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

export function AdminAffiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'affiliates' | 'commissions' | 'settings'>('affiliates');
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [commFilter, setCommFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'>('all');

  // UI States
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Bulk Selection for payment
  const [selectedCommIds, setSelectedCommIds] = useState<string[]>([]);

  // Settings form states
  const [formDefaultRate, setFormDefaultRate] = useState<number>(10);
  const [formMinPayout, setFormMinPayout] = useState<number>(50);
  const [formTerms, setFormTerms] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const activeSettings = await affiliateService.getSettings();
      setSettings(activeSettings);
      
      // Load form fields
      setFormDefaultRate(activeSettings.defaultCommissionRate);
      setFormMinPayout(activeSettings.minimumPayoutAmount);
      setFormTerms(activeSettings.termsText || '');
      setFormActive(activeSettings.active !== false);

      const affList = await affiliateService.getAllAffiliates();
      setAffiliates(affList);

      const commList = await affiliateService.getAdminCommissionsReport(activeSettings.defaultCommissionRate);
      setCommissions(commList);
    } catch (e) {
      console.error("Erro ao carregar dados do admin de afiliados:", e);
      showToast("Não foi possível carregar os dados de afiliados.", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    setUpdatingId(id);
    try {
      await affiliateService.updateAffiliateStatus(id, status);
      showToast(`Status da afiliada atualizado com sucesso para: ${status === 'approved' ? 'Aprovado' : 'Rejeitado'}.`, "success");
      
      // Update local state
      setAffiliates(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (e) {
      showToast("Falha ao atualizar o status do cadastro de afiliada.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateRate = async (id: string, rateStr: string) => {
    const rateNum = rateStr.trim() === '' ? null : parseFloat(rateStr);
    if (rateNum !== null && (isNaN(rateNum) || rateNum < 0 || rateNum > 100)) {
      showToast("Insira um percentual de comissão válido entre 0 e 100.", "error");
      return;
    }

    try {
      await affiliateService.updateAffiliateRate(id, rateNum);
      showToast("Comissão personalizada atualizada para esta afiliada.", "success");
      setAffiliates(prev => prev.map(a => a.id === id ? { ...a, commissionRate: rateNum === null ? undefined : rateNum } : a));
    } catch (e) {
      showToast("Erro ao salvar comissão modificada.", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await affiliateService.updateSettings({
        defaultCommissionRate: formDefaultRate,
        minimumPayoutAmount: formMinPayout,
        termsText: formTerms,
        active: formActive
      });
      showToast("Configurações do programa de afiliados atualizadas!", "success");
      await loadData();
    } catch (e) {
      showToast("Erro ao gravar novas configurações.", "error");
    }
  };

  const handleMarkAsPaid = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja marcar esta comissão como PAGA via PIX?")) return;
    try {
      await affiliateService.markCommissionsAsPaid([orderId]);
      showToast("Comissão marcada de forma segura como PAGA!", "success");
      
      // Update local state
      setCommissions(prev => prev.map(c => c.orderId === orderId ? { ...c, status: 'PAID' } : c));
    } catch (e) {
      showToast("Erro ao liquidar comissão.", "error");
    }
  };

  const handleBulkPay = async () => {
    if (selectedCommIds.length === 0) return;
    if (!confirm(`Confirmar o pagamento das ${selectedCommIds.length} comissões selecionadas via PIX?`)) return;

    try {
      await affiliateService.markCommissionsAsPaid(selectedCommIds);
      showToast(`${selectedCommIds.length} comissões liquidadas simultaneamente das afiliadas!`, "success");
      
      // Update state
      setCommissions(prev => prev.map(c => selectedCommIds.includes(c.orderId) ? { ...c, status: 'PAID' } : c));
      setSelectedCommIds([]);
    } catch (e) {
      showToast("Falha técnica ao marcar lote de comissões como pago.", "error");
    }
  };

  // Calculations for dashboard
  const stats = (() => {
    const totalAffiliates = affiliates.length;
    const pendingCount = affiliates.filter(a => a.status === 'pending').length;
    
    let totalSalesVolume = 0;
    let pendingPayoutVol = 0;
    let paidPayoutVol = 0;

    commissions.forEach(c => {
      totalSalesVolume += c.orderTotal || 0;
      if (c.status === 'APPROVED') {
        pendingPayoutVol += c.commissionValue || 0;
      } else if (c.status === 'PAID') {
        paidPayoutVol += c.commissionValue || 0;
      }
    });

    return {
      totalAffiliates,
      pendingCount,
      totalSalesVolume,
      pendingPayoutVol,
      paidPayoutVol
    };
  })();

  const toggleSelectOrder = (orderId: string) => {
    setSelectedCommIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAllEligibleComms = () => {
    const eligibleIds = filteredCommissions
      .filter(c => c.status === 'APPROVED')
      .map(c => c.orderId);
    
    if (selectedCommIds.length === eligibleIds.length) {
      setSelectedCommIds([]);
    } else {
      setSelectedCommIds(eligibleIds);
    }
  };

  // Filtering
  const filteredAffiliates = affiliates.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCommissions = commissions.filter(c => {
    const matchesSearch = c.affiliateName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.affiliateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.orderShortId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = commFilter === 'all' || c.status === commFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 text-slate-100 min-h-screen">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-12 right-6 z-[999] px-6 py-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-2xl ${
          toast.type === 'error' ? 'bg-red-950 border border-red-500/50 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-900 border border-green-500/50 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="text-red-500 font-black text-[10px] tracking-[0.2em] uppercase">🚀 MÓDULO REMOTO DE INDICAÇÕES</span>
          <h1 className="text-2xl md:text-3xl font-black uppercase text-white mt-1 flex items-center gap-2">
            Programa de Afiliados
          </h1>
          <p className="text-xs text-slate-400 mt-1">Gerencie afiliadas parceiras, aprove novos cadastros e faça pagamentos de repasse via PIX.</p>
        </div>
        
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button 
            onClick={() => { setActiveTab('affiliates'); setSearchQuery(''); }}
            className={`px-4 py-2 text-[10px] uppercase font-black tracking-wider rounded-xl transition-all ${
              activeTab === 'affiliates' ? 'bg-red-600 text-white font-black hover:bg-red-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Afiliadas Cadastradas ({affiliates.length})
          </button>
          <button 
            onClick={() => { setActiveTab('commissions'); setSearchQuery(''); }}
            className={`px-4 py-2 text-[10px] uppercase font-black tracking-wider rounded-xl transition-all ${
              activeTab === 'commissions' ? 'bg-red-600 text-white font-black hover:bg-red-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ledger de Comissões ({commissions.length})
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-[10px] uppercase font-black tracking-wider rounded-xl transition-all ${
              activeTab === 'settings' ? 'bg-red-600 text-white font-black hover:bg-red-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Configurações
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {activeTab !== 'settings' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Lista de Afiliadas</div>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">{stats.totalAffiliates}</div>
            {stats.pendingCount > 0 && (
              <span className="text-[9px] bg-red-950/40 text-red-500 border border-red-900 px-2 py-0.5 rounded-full font-black mt-2 inline-block">
                ⚠️ {stats.pendingCount} pendentes de aprovação
              </span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Indicações e Pedidos</div>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">{commissions.length}</div>
            <p className="text-[9px] text-slate-500 mt-1">Vendas capturadas via link</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Volume de Venda Gerado</div>
            <div className="text-2xl md:text-3xl font-black text-indigo-400 mt-1">{formatCurrency(stats.totalSalesVolume)}</div>
            <p className="text-[9px] text-slate-500 mt-1">Faturamento total por afiliadas</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="text-[9px] font-bold text-slate-400 uppercase">A Pagar (Disponível)</div>
            <div className="text-2xl md:text-3xl font-black text-rose-500 mt-1">{formatCurrency(stats.pendingPayoutVol)}</div>
            <p className="text-[9px] text-slate-500 mt-1">Estoque entregue prontas para saque</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Total Pago e Liquidado</div>
            <div className="text-2xl md:text-3xl font-black text-green-500 mt-1">{formatCurrency(stats.paidPayoutVol)}</div>
            <p className="text-[9px] text-slate-500 mt-1">Repasses fechados com sucesso</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Processando dados, um momento...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: AFFILIATES LIST */}
          {activeTab === 'affiliates' && (
            <div className="space-y-6">
              {/* Search filter row */}
              <div className="flex flex-col md:flex-row gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome de afiliada, e-mail de login ou ID..."
                    className="w-full bg-slate-900 text-xs h-10 border border-slate-800 rounded-xl px-10 font-medium"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex bg-slate-900/60 p-0.5 rounded-xl border border-slate-800 items-center">
                    <span className="text-[9px] uppercase font-black text-slate-500 px-3">Status:</span>
                    {(['all', 'approved', 'pending', 'rejected'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`text-[9px] uppercase px-3 py-1.5 font-bold rounded-lg ${
                          statusFilter === status ? 'bg-red-600 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {status === 'all' ? 'Ver Todos' : status === 'approved' ? 'Aprovados' : status === 'pending' ? 'Pendentes' : 'Rejeitados'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredAffiliates.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 p-12 text-center rounded-2xl">
                  <span className="text-slate-600 font-black block text-sm">Nenhuma parceira de vendas encontrada.</span>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">Tente ajustar seus termos de busca ou mude os filtros de status.</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-950/60 font-bold uppercase text-[9px] tracking-wider text-slate-500 border-b border-slate-800">
                          <th className="p-4">Código / ID</th>
                          <th className="p-4">Nome Social</th>
                          <th className="p-4">E-mail & WhatsApp</th>
                          <th className="p-4">PIX / Dados</th>
                          <th className="p-4 text-center">Cliques</th>
                          <th className="p-4 text-center">Comissão (%)</th>
                          <th className="p-4">Status de Inscrição</th>
                          <th className="p-4 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAffiliates.map((aff, index) => (
                          <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/10">
                            <td className="p-4">
                              <div className="font-extrabold text-white text-xs select-all">
                                {aff.id}
                              </div>
                              <span className="text-[8px] font-mono select-all text-slate-500 block mt-0.5">/{aff.id}</span>
                            </td>
                            <td className="p-4">
                              <span className="font-extrabold text-sm text-slate-200">{aff.name}</span>
                              <p className="text-[10px] text-slate-500">Membro desde {aff.createdAt ? new Date((aff.createdAt).toMillis ? aff.createdAt.toMillis() : aff.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
                            </td>
                            <td className="p-4 font-mono">
                              <div className="text-slate-300 font-semibold">{aff.email}</div>
                              {aff.whatsapp && (
                                <a 
                                  href={`https://wa.me/55${aff.whatsapp}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 mt-0.5"
                                >
                                  <Phone size={10} /> +55 {aff.whatsapp}
                                </a>
                              )}
                            </td>
                            <td className="p-4 text-slate-300">
                              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{aff.pixType}:</div>
                              <div className="font-mono text-xs select-all font-semibold break-all leading-tight max-w-[200px]">
                                {aff.pixKey}
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-white text-sm">
                              {aff.clicks}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <input 
                                  type="number"
                                  step="0.5"
                                  placeholder={`${settings?.defaultCommissionRate || 10}%`}
                                  defaultValue={aff.commissionRate !== undefined && aff.commissionRate !== null ? aff.commissionRate : ''}
                                  onBlur={(e) => handleUpdateRate(aff.id, e.target.value)}
                                  className="w-16 h-8 text-center bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                                />
                                <span className="text-zinc-500 text-[10px] font-bold">%</span>
                              </div>
                              <span className="text-[8px] text-zinc-500 uppercase block mt-1">
                                {aff.commissionRate !== undefined && aff.commissionRate !== null ? 'Comissão Custom' : 'Default Geral'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wider border ${
                                aff.status === 'approved' ? 'bg-green-950/40 border-green-500/50 text-green-400' :
                                aff.status === 'rejected' ? 'bg-red-950/40 border-red-500/30 text-red-500' :
                                'bg-yellow-950/40 border-yellow-500/30 text-yellow-500 animate-pulse'
                              }`}>
                                {aff.status === 'approved' ? 'Aprovada' : aff.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2 justify-end">
                                {aff.status !== 'approved' && (
                                  <button
                                    onClick={() => handleUpdateStatus(aff.id, 'approved')}
                                    disabled={updatingId === aff.id}
                                    title="Aprovar Cadastro"
                                    className="h-9 w-9 bg-green-600/10 border border-green-500/20 hover:bg-green-600 hover:text-white rounded-xl text-green-500 flex items-center justify-center transition-all cursor-pointer"
                                  >
                                    <Check size={14} />
                                  </button>
                                )}
                                {aff.status !== 'rejected' && (
                                  <button
                                    onClick={() => handleUpdateStatus(aff.id, 'rejected')}
                                    disabled={updatingId === aff.id}
                                    title="Rejeitar Cadastro"
                                    className="h-9 w-9 bg-red-600/10 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-xl text-red-500 flex items-center justify-center transition-all cursor-pointer"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                                {aff.status !== 'pending' && (
                                  <button
                                    onClick={() => handleUpdateStatus(aff.id, 'pending')}
                                    disabled={updatingId === aff.id}
                                    title="Voltar para Em Análise"
                                    className="h-9 w-9 bg-slate-950 border border-slate-800 hover:border-yellow-500/40 text-slate-500 hover:text-yellow-500 rounded-xl flex items-center justify-center transition-all"
                                  >
                                    <AlertCircle size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LEDGER AND PIX PAYOUTS */}
          {activeTab === 'commissions' && (
            <div className="space-y-6">
              {/* Search filter row */}
              <div className="flex flex-col md:flex-row gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome da afiliada, código de rastreamento ou ID do pedido..."
                    className="w-full bg-slate-900 text-xs h-10 border border-slate-800 rounded-xl px-10 font-medium"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex bg-slate-900/60 p-0.5 rounded-xl border border-slate-800 items-center">
                    <span className="text-[9px] uppercase font-black text-slate-500 px-3">Visualização:</span>
                    {(['all', 'APPROVED', 'PENDING', 'PAID', 'CANCELLED'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setCommFilter(f)}
                        className={`text-[9px] uppercase px-3 py-1.5 font-bold rounded-lg ${
                          commFilter === f ? 'bg-red-600 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f === 'all' ? 'Ver Todos' : f === 'APPROVED' ? 'Disponíveis' : f === 'PENDING' ? 'Pendentes' : f === 'PAID' ? 'Repassados' : 'Cancelados'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bulk operations panel */}
              {selectedCommIds.length > 0 && (
                <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-ping"></div>
                    <span className="text-xs font-black uppercase text-slate-100">
                      ⚙️ {selectedCommIds.length} Comissões Selecionadas em Lote
                    </span>
                    <p className="text-[10px] text-slate-400">Total das comissões marcadas: <strong>
                      {formatCurrency(filteredCommissions.filter(c => selectedCommIds.includes(c.orderId)).reduce((sum, c) => sum + c.commissionValue, 0))}
                    </strong></p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCommIds([])}
                      className="px-4 py-2 border border-slate-800 text-[10px] uppercase font-black hover:bg-slate-900 rounded-xl text-slate-400"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      onClick={handleBulkPay}
                      className="px-5 py-2 bg-green-600 text-white text-[10px] uppercase font-black hover:bg-green-500 rounded-xl"
                    >
                      Liquidar em Lote via PIX (Marcar como Pago)
                    </button>
                  </div>
                </div>
              )}

              {filteredCommissions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 p-12 text-center rounded-2xl">
                  <span className="text-slate-600 font-black block text-sm">Nenhum repasse ou comissão encontrado.</span>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">Para receber comissões, vendas online devem usar links ativos de afiliadas (`?ref=id`).</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-950/60 font-bold uppercase text-[9px] tracking-wider text-slate-500 border-b border-slate-800">
                          <th className="p-4 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedCommIds.length === filteredCommissions.filter(c => c.status === 'APPROVED').length && filteredCommissions.filter(c => c.status === 'APPROVED').length > 0}
                              onChange={selectAllEligibleComms}
                              className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900" 
                            />
                          </th>
                          <th className="p-4">Pedido ID</th>
                          <th className="p-4">Data</th>
                          <th className="p-4">Afiliada & Contato PIX</th>
                          <th className="p-4">Cliente / Status Pedido</th>
                          <th className="p-4 text-right">Total Transado</th>
                          <th className="p-4 text-center">Comissão %</th>
                          <th className="p-4 text-right">Sua Comissão</th>
                          <th className="p-4 text-right">Repasse / Status</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCommissions.map((comm, idx) => (
                          <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/10 transition-colors">
                            <td className="p-4 text-center">
                              {comm.status === 'APPROVED' ? (
                                <input 
                                  type="checkbox"
                                  checked={selectedCommIds.includes(comm.orderId)}
                                  onChange={() => toggleSelectOrder(comm.orderId)}
                                  className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                                />
                              ) : (
                                <div className="h-4 w-4 bg-slate-950 rounded border border-slate-800 inline-block opacity-40"></div>
                              )}
                            </td>
                            <td className="p-4 font-black font-mono text-white select-all text-xs">
                              #{comm.orderShortId}
                            </td>
                            <td className="p-4 text-slate-500 font-mono text-[10px]">
                              {comm.orderDate.toLocaleDateString('pt-BR')} {comm.orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4">
                              <div className="font-extrabold text-slate-100 flex items-center gap-1.5 uppercase text-xs">
                                {comm.affiliateName} 
                                <span className="text-[9px] text-zinc-500 font-mono font-bold lowercase">({comm.affiliateId})</span>
                              </div>
                              <div className="text-[10px] text-zinc-400 font-semibold break-all max-w-[200px] mt-0.5">
                                {comm.affiliatePix}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-zinc-300">{comm.customerName}</div>
                              <span className="text-[8px] uppercase tracking-widest font-black text-slate-500 block mt-0.5">
                                Pedido: {comm.orderStatus}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono text-slate-400">
                              {formatCurrency(comm.orderTotal)}
                            </td>
                            <td className="p-4 text-center font-bold text-red-500">
                              {comm.commissionRate}%
                            </td>
                            <td className="p-4 text-right font-black font-semibold text-emerald-400">
                              {formatCurrency(comm.commissionValue)}
                            </td>
                            <td className="p-4 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-black border ${
                                comm.status === 'PAID' ? 'bg-green-950/30 border-green-500/40 text-green-400' :
                                comm.status === 'APPROVED' ? 'bg-sky-950/30 border-sky-500/40 text-sky-400' :
                                comm.status === 'CANCELLED' ? 'bg-red-950/30 border-red-500/40 text-red-550' :
                                'bg-yellow-950/30 border-yellow-500/40 text-yellow-400'
                              }`}>
                                {comm.status === 'PAID' ? 'Pago' :
                                 comm.status === 'APPROVED' ? 'Disponível PIX' :
                                 comm.status === 'CANCELLED' ? 'Cancelado' :
                                 'Pendente (Preparando)'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {comm.status === 'APPROVED' ? (
                                <button
                                  onClick={() => handleMarkAsPaid(comm.orderId)}
                                  className="h-8 px-3 bg-green-600 hover:bg-green-550 active:bg-green-700 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 ml-auto cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                                >
                                  <Check size={10} /> Liquidar
                                </button>
                              ) : (
                                <div className="text-[9px] text-slate-650 italic">-</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONFIGURATION SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-xl animate-fadeIn">
              <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-black uppercase text-white">Configurações Gerais de Afiliados</h3>
                  <p className="text-xs text-slate-400 mt-1">Ajuste os parâmetros padrão para as taxas de ganho e regulação do programa Discreta Boutique.</p>
                </div>

                <div className="h-px bg-slate-800"></div>

                <div className="space-y-4">
                  {/* Toggle Active */}
                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-white">Ativar Programa de Afiliadas</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Controla a abertura pública do formulário de submissão e cadastro de afiliadas.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formActive}
                        onChange={(e) => setFormActive(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  {/* Normal rate */}
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Taxa de Comissão Padrão (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        step="0.5"
                        min="0.5"
                        max="90"
                        value={formDefaultRate}
                        onChange={(e) => setFormDefaultRate(parseFloat(e.target.value))}
                        placeholder="Ex: 10"
                        className="w-full bg-slate-950 h-11 border border-slate-850 rounded-xl px-4 text-xs font-semibold font-mono"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 leading-snug">Taxa padrão aplicada para qualquer nova afiliada que se cadastrar na plataforma, a menos que uma taxa customizada seja definida para ela.</p>
                  </div>

                  {/* Min Payout */}
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Valor Mínimo para Transferência (BRL)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        min="5"
                        max="1000"
                        value={formMinPayout}
                        onChange={(e) => setFormMinPayout(parseInt(e.target.value))}
                        placeholder="Ex: 50"
                        className="w-full bg-slate-950 h-11 border border-slate-850 rounded-xl px-4 text-xs font-semibold font-mono"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">R$</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 leading-snug">O valor mínimo que a afiliada deve acumular em seu painel antes de poder solicitar o resgate de PIX de repasses aprovados.</p>
                  </div>

                  {/* Reg / Pitch text */}
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Texto de Introdução e Pitch</label>
                    <textarea 
                      value={formTerms}
                      onChange={(e) => setFormTerms(e.target.value)}
                      rows={4}
                      placeholder="Cole aqui as regras do programa..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-white leading-relaxed"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">Exibido na página de cadastro e landing page do programa para novas afiliadas.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-12 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.15)] mt-4"
                  >
                    Salvar Alterações de Administração
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
