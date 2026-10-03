import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Plus, 
  Calendar, 
  Printer, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Edit3, 
  Search, 
  Eye, 
  FileText, 
  DollarSign, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Ticket,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { raffleService } from '../../../services/raffleService';
import { RaffleCampaign, RaffleTicket, RaffleRuleType } from '../../../types/raffle';
import { RaffleTicketModal } from '../../../components/admin/RaffleTicketModal';
import { printRaffleThermalTickets } from '../../../utils/rafflePrintUtils';

export default function AdminRaffleCampaigns() {
  const [campaigns, setCampaigns] = useState<RaffleCampaign[]>([]);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'tickets'>('campaigns');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Search state for tickets
  const [ticketSearch, setTicketSearch] = useState('');

  // Modal Create/Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RaffleCampaign | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formPrize, setFormPrize] = useState('');
  const [formRules, setFormRules] = useState('');
  const [formType, setFormType] = useState<RaffleRuleType>('EVERY_X_AMOUNT');
  const [formAmountPerTicket, setFormAmountPerTicket] = useState<number>(50);
  const [formMinPurchaseValue, setFormMinPurchaseValue] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDrawDate, setFormDrawDate] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formAutoPrint, setFormAutoPrint] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview / Test Print Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTickets, setPreviewTickets] = useState<RaffleTicket[]>([]);

  // Subscribe to campaigns in real time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = raffleService.subscribeCampaigns((data) => {
      setCampaigns(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching campaigns:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch tickets history
  const fetchTicketsHistory = async () => {
    try {
      const data = await raffleService.getTickets();
      setTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTicketsHistory();
    }
  }, [activeTab]);

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormTitle('');
    setFormPrize('');
    setFormRules(
      '1. Válido para compras realizadas na Discreta Boutique dentro do período de vigência.\n' +
      '2. O cliente deve preencher o bilhete com nome e WhatsApp legíveis e depositar na urna da loja física.\n' +
      '3. O sorteio será transmitido ao vivo em nosso Instagram oficial @discretaico.\n' +
      '4. O ganhador será contatado via WhatsApp e terá até 7 dias úteis para retirar seu prêmio.'
    );
    setFormType('EVERY_X_AMOUNT');
    setFormAmountPerTicket(50);
    setFormMinPurchaseValue(0);

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setFormStartDate(today.toISOString().split('T')[0]);
    setFormEndDate(nextMonth.toISOString().split('T')[0]);
    setFormDrawDate(nextMonth.toISOString().split('T')[0]);
    setFormActive(true);
    setFormAutoPrint(true);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (camp: RaffleCampaign) => {
    setEditingCampaign(camp);
    setFormTitle(camp.title);
    setFormPrize(camp.prize);
    setFormRules(camp.rules);
    setFormType(camp.type);
    setFormAmountPerTicket(camp.amountPerTicket || 50);
    setFormMinPurchaseValue(camp.minPurchaseValue || 0);
    setFormStartDate(camp.startDate);
    setFormEndDate(camp.endDate);
    setFormDrawDate(camp.drawDate || '');
    setFormActive(camp.active);
    setFormAutoPrint(camp.autoPrint);
    setFormNotes(camp.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Por favor, informe o título da campanha.');
      return;
    }
    if (!formPrize.trim()) {
      alert('Por favor, informe o que está sendo sorteado (prêmio).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        prize: formPrize.trim(),
        rules: formRules.trim(),
        type: formType,
        amountPerTicket: formType === 'EVERY_X_AMOUNT' ? Number(formAmountPerTicket) || 50 : 0,
        minPurchaseValue: formType === 'ANY_PURCHASE' ? Number(formMinPurchaseValue) || 0 : 0,
        startDate: formStartDate,
        endDate: formEndDate,
        drawDate: formDrawDate,
        active: formActive,
        autoPrint: formAutoPrint,
        notes: formNotes.trim(),
      };

      if (editingCampaign) {
        await raffleService.updateCampaign(editingCampaign.id, payload);
      } else {
        await raffleService.createCampaign(payload);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save campaign error:', err);
      alert('Erro ao salvar campanha: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (camp: RaffleCampaign) => {
    try {
      await raffleService.updateCampaign(camp.id, { active: !camp.active });
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleToggleAutoPrint = async (camp: RaffleCampaign) => {
    try {
      await raffleService.updateCampaign(camp.id, { autoPrint: !camp.autoPrint });
    } catch (err) {
      console.error('Toggle autoPrint error:', err);
    }
  };

  const handleDeleteCampaign = async (camp: RaffleCampaign) => {
    if (!confirm(`Deseja realmente excluir a campanha "${camp.title}"? Esta ação é irreversível.`)) {
      return;
    }
    try {
      await raffleService.deleteCampaign(camp.id);
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handlePreviewTestTicket = (camp: RaffleCampaign) => {
    const dummyTicket: RaffleTicket = {
      id: 'test-preview',
      campaignId: camp.id,
      campaignTitle: camp.title,
      prize: camp.prize,
      rules: camp.rules,
      ticketNumber: 1,
      ticketCode: 'SRT-000001',
      orderId: 'PDV-TEST-80MM',
      orderTotal: camp.type === 'EVERY_X_AMOUNT' ? (camp.amountPerTicket || 50) : 100,
      orderDate: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ticketIndexInSale: 1,
      ticketsTotalInSale: 1,
      customerName: 'MARIA SILVA (CLIENTE EXEMPLO)',
      customerWhatsapp: '(88) 99876-5432',
      drawDate: camp.drawDate || camp.endDate,
      createdAt: new Date().toISOString(),
    };

    setPreviewTickets([dummyTicket]);
    setPreviewModalOpen(true);
  };

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (filterStatus === 'active') return c.active;
    if (filterStatus === 'inactive') return !c.active;
    return true;
  });

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    if (!ticketSearch) return true;
    const term = ticketSearch.toLowerCase();
    return (
      t.ticketCode.toLowerCase().includes(term) ||
      (t.customerName || '').toLowerCase().includes(term) ||
      (t.customerWhatsapp || '').includes(term) ||
      t.orderId.toLowerCase().includes(term) ||
      t.campaignTitle.toLowerCase().includes(term)
    );
  });

  // Statistics
  const activeCount = campaigns.filter(c => c.active).length;
  const totalTicketsIssued = campaigns.reduce((acc, c) => acc + (c.ticketsIssuedCount || 0), 0);

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Section */}
      <div className="bg-zinc-950/70 border border-zinc-850 p-6 md:p-8 rounded-3xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-600/20 text-red-500 rounded-xl border border-red-500/30">
                <Gift className="w-5 h-5" />
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-red-400 font-mono">
                Marketing Promocional
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-rose-50 tracking-tight">
              Campanhas de Sorteio
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Configure sorteios para compras de qualquer valor ou a cada faixa estipulada (ex: R$ 50). 
              Após cada venda no PDV, os cupons para impressora térmica de 80mm são impressos automaticamente 
              com as regras e campos para o cliente depositar na urna.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2.5 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Nova Campanha de Sorteio
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-zinc-900">
          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Campanhas Ativas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white font-mono">{activeCount}</span>
              <span className="text-xs text-emerald-400 font-medium font-mono">de {campaigns.length} cadastradas</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Cupons Emitidos no PDV</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-400 font-mono">{totalTicketsIssued}</span>
              <span className="text-xs text-zinc-400 font-medium">bilhetes gerados</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Padrão de Impressão</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-zinc-200">Bobina Térmica 80mm</span>
              <span className="text-xs text-zinc-500 font-mono">72mm útil</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-2xl self-start">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            Campanhas Cadastradas ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            Histórico de Cupons Emitidos
          </button>
        </div>

        {/* Filter controls */}
        {activeTab === 'campaigns' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 font-medium">Filtrar:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${
                filterStatus === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${
                filterStatus === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${
                filterStatus === 'inactive' ? 'bg-zinc-850 text-zinc-300' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              Pausadas
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Campaigns List */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-zinc-950/40 border border-zinc-850 rounded-3xl p-12 text-center text-zinc-400">
              <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold">Carregando campanhas de sorteio...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-zinc-950/50 border border-dashed border-zinc-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-950/30 text-red-500 rounded-3xl flex items-center justify-center mx-auto border border-red-900/20">
                <Gift className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">Nenhuma campanha encontrada</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Crie sua primeira campanha para premiar seus clientes no PDV com impressão automática de bilhetes de sorteio!
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Criar Campanha Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCampaigns.map((camp) => {
                const isEveryX = camp.type === 'EVERY_X_AMOUNT';
                const todayStr = new Date().toISOString().split('T')[0];
                const isOngoing = camp.active && (!camp.startDate || camp.startDate <= todayStr) && (!camp.endDate || camp.endDate >= todayStr);

                return (
                  <div 
                    key={camp.id}
                    className={`bg-zinc-950 border rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:border-red-900/40 relative group ${
                      isOngoing ? 'border-zinc-800 shadow-lg' : 'border-zinc-900 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-lg font-mono uppercase tracking-wider ${
                            camp.active 
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' 
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${camp.active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                            {camp.active ? 'Vigente' : 'Pausada'}
                          </span>
                          <h3 className="text-base font-extrabold text-white leading-snug line-clamp-1">
                            {camp.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleToggleActive(camp)}
                          title={camp.active ? 'Pausar campanha' : 'Ativar campanha'}
                          className="text-zinc-500 hover:text-white p-1 transition cursor-pointer"
                        >
                          {camp.active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-zinc-600" />
                          )}
                        </button>
                      </div>

                      {/* Prize Display */}
                      <div className="bg-zinc-900/70 border border-zinc-850 p-3.5 rounded-2xl mb-4 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">
                          O que está sendo sorteado:
                        </span>
                        <p className="text-sm font-black text-rose-300 flex items-center gap-2">
                          🏆 {camp.prize}
                        </p>
                      </div>

                      {/* Rule Type Details */}
                      <div className="space-y-2 mb-4 text-xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Critério de Cupons:</span>
                          <span className="font-extrabold text-white text-right">
                            {isEveryX 
                              ? `A cada R$ ${camp.amountPerTicket?.toFixed(2).replace('.', ',')} = 1 Cupom`
                              : `Compra de qualquer valor = 1 Cupom`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Vigência:</span>
                          <span className="font-mono text-zinc-300">
                            {camp.startDate ? camp.startDate.split('-').reverse().join('/') : 'Início'} até{' '}
                            {camp.endDate ? camp.endDate.split('-').reverse().join('/') : 'Indeterminada'}
                          </span>
                        </div>

                        {camp.drawDate && (
                          <div className="flex items-center justify-between text-zinc-400">
                            <span>Data do Sorteio:</span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {camp.drawDate.split('-').reverse().join('/')}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-zinc-900">
                          <span>Impressão Automática no PDV:</span>
                          <button
                            onClick={() => handleToggleAutoPrint(camp)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono cursor-pointer transition ${
                              camp.autoPrint 
                                ? 'bg-red-950 text-red-300 border border-red-900/30' 
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                            }`}
                          >
                            {camp.autoPrint ? 'Automática' : 'Manual'}
                          </button>
                        </div>
                      </div>

                      {/* Cupons emitidos */}
                      <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-2xl flex items-center justify-between mb-4">
                        <span className="text-[11px] text-zinc-400">Cupons Emitidos no PDV:</span>
                        <span className="text-xs font-mono font-black text-white bg-zinc-850 px-2 py-0.5 rounded-lg">
                          {camp.ticketsIssuedCount || 0} bilhetes
                        </span>
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="pt-4 border-t border-zinc-900/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handlePreviewTestTicket(camp)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        title="Ver prévia e testar impressão 80mm"
                      >
                        <Printer className="w-3.5 h-3.5 text-zinc-400" />
                        Teste 80mm
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(camp)}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition cursor-pointer"
                          title="Editar Campanha"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(camp)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition cursor-pointer"
                          title="Excluir Campanha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Tickets History */}
      {activeTab === 'tickets' && (
        <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white">Histórico de Bilhetes Emitidos</h2>
              <p className="text-xs text-zinc-400">Todos os cupons gerados automaticamente pelo PDV durante as vendas.</p>
            </div>

            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por código, nome, fone ou pedido..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
              <Ticket className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs font-bold">Nenhum cupom emitido encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-850">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Campanha</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">WhatsApp</th>
                    <th className="py-3 px-4">Pedido PDV</th>
                    <th className="py-3 px-4">Valor Compra</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-3 px-4 font-mono font-black text-rose-400">
                        #{t.ticketCode}
                      </td>
                      <td className="py-3 px-4 font-bold text-white max-w-[180px] truncate">
                        {t.campaignTitle}
                      </td>
                      <td className="py-3 px-4">
                        {t.customerName ? t.customerName : <span className="text-zinc-600 italic">Cliente Balcão</span>}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {t.customerWhatsapp || <span className="text-zinc-600">-</span>}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        #{t.orderId.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        R$ {Number(t.orderTotal || 0).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {t.orderDate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setPreviewTickets([t]);
                            setPreviewModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                          title="Reimprimir Bilhete 80mm"
                        >
                          <Printer className="w-3 h-3" />
                          Reimprimir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Campaign */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-2xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
            <div className="p-6 border-b border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600 rounded-2xl text-white">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    {editingCampaign ? 'Editar Campanha de Sorteio' : 'Nova Campanha de Sorteio'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Preencha os dados e regras para geração e impressão no PDV
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-850 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Título da Campanha */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[11px]">
                  Título da Campanha *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sorteio de Dia das Mães, Sorteio de Fim de Ano..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* O que está sendo sorteado (Prêmio) */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[11px]">
                  O que está sendo sorteado (Prêmio) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1 iPhone 15 128GB + Vale Compras de R$ 500 em Lingeries"
                  value={formPrize}
                  onChange={(e) => setFormPrize(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Modalidade do Sorteio */}
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[11px] block">
                  Regra para Ganhar o Cupom *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormType('EVERY_X_AMOUNT')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      formType === 'EVERY_X_AMOUNT'
                        ? 'bg-red-950/40 border-red-600 text-white'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-2 mb-1">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${formType === 'EVERY_X_AMOUNT' ? 'border-red-500 bg-red-500' : 'border-zinc-600'}`}>
                        {formType === 'EVERY_X_AMOUNT' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      A cada R$ em compras
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-5">
                      Ganha 1 cupom a cada valor configurado. Ex: a cada R$ 50, uma compra de R$ 150 ganha 3 cupons.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormType('ANY_PURCHASE')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      formType === 'ANY_PURCHASE'
                        ? 'bg-red-950/40 border-red-600 text-white'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-2 mb-1">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${formType === 'ANY_PURCHASE' ? 'border-red-500 bg-red-500' : 'border-zinc-600'}`}>
                        {formType === 'ANY_PURCHASE' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      Compra de qualquer valor
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-5">
                      Ganha exatamente 1 cupom por compra, independente do valor total da venda.
                    </p>
                  </div>
                </div>

                {/* Valor configurado */}
                {formType === 'EVERY_X_AMOUNT' ? (
                  <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-2xl mt-3 flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">Valor para cada 1 cupom (R$):</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-mono font-bold">R$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={formAmountPerTicket}
                        onChange={(e) => setFormAmountPerTicket(Number(e.target.value))}
                        className="w-24 bg-zinc-950 border border-zinc-750 rounded-xl p-2 text-right font-mono font-bold text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-2xl mt-3 flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">Valor mínimo de compra para participar (opcional):</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-mono font-bold">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formMinPurchaseValue}
                        onChange={(e) => setFormMinPurchaseValue(Number(e.target.value))}
                        className="w-24 bg-zinc-950 border border-zinc-750 rounded-xl p-2 text-right font-mono font-bold text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Datas de Vigência e Sorteio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-900">
                <div className="space-y-1.5">
                  <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[10px]">
                    Início da Vigência *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[10px]">
                    Fim da Vigência *
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[10px]">
                    Data do Sorteio
                  </label>
                  <input
                    type="date"
                    value={formDrawDate}
                    onChange={(e) => setFormDrawDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              {/* Regras e Regulamento */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                <label className="font-extrabold text-zinc-300 uppercase tracking-wider text-[11px] flex justify-between">
                  <span>Regras do Sorteio (Serão impressas no cupom térmico)</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Uma regra por linha</span>
                </label>
                <textarea
                  rows={4}
                  value={formRules}
                  onChange={(e) => setFormRules(e.target.value)}
                  placeholder="Escreva as regras do sorteio..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-500 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Switches: Impressão automática e Ativa */}
              <div className="space-y-3 pt-2 border-t border-zinc-900">
                <label className="flex items-center gap-3 p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-900 transition">
                  <input
                    type="checkbox"
                    checked={formAutoPrint}
                    onChange={(e) => setFormAutoPrint(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="font-extrabold text-white block">
                      Impressão Automática no PDV (Recomendado)
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Ao concluir a venda no PDV, o sistema abre imediatamente a impressão térmica de 80mm com os cupons do cliente.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-900 transition">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="font-extrabold text-white block">
                      Campanha Ativa para Emissão
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Habilita a geração dos cupons para vendas realizadas no período de vigência.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-zinc-850 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingCampaign ? 'Atualizar Campanha' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Preview / Test Print Modal */}
      <RaffleTicketModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        tickets={previewTickets}
        campaignTitle={previewTickets[0]?.campaignTitle}
      />
    </div>
  );
}
