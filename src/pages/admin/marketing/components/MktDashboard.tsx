import React, { useState } from 'react';
import { 
  TrendingUp, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  Target, 
  Megaphone, 
  Users, 
  Sparkles, 
  ArrowRight,
  Bell,
  Heart,
  CalendarDays,
  Plus,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { MktCampaign, MktTask, MktAlert } from '../marketingTypes';

interface MktDashboardProps {
  campaigns: MktCampaign[];
  tasks: MktTask[];
  alerts: MktAlert[];
  dismissAlert: (id: string) => Promise<void>;
  moveTask: (taskId: string, targetCol: MktTask['column']) => Promise<void>;
  saveCampaign: (cmp: MktCampaign) => Promise<void>;
  createCampaign: (cmp: Omit<MktCampaign, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteCampaign: (id: string) => Promise<void>;
  onTabChange: (tab: string) => void;
}

export function MktDashboard({ 
  campaigns, 
  tasks, 
  alerts, 
  dismissAlert, 
  moveTask, 
  saveCampaign,
  createCampaign,
  deleteCampaign,
  onTabChange
}: MktDashboardProps) {
  // Select active or loaded campaign state
  const [selectedCmpId, setSelectedCmpId] = useState<string | null>(null);
  
  const activeCampaign = campaigns.find(c => c.id === selectedCmpId) || campaigns.find(c => c.status === 'ativa') || campaigns[0];
  
  const pendingTasks = tasks.filter(t => t.column !== 'concluido' && t.column !== 'cancelado' && (!activeCampaign || t.campaignId === activeCampaign.id));
  const completedTasks = tasks.filter(t => t.column === 'concluido' && (!activeCampaign || t.campaignId === activeCampaign.id));
  
  // Calculate statistics
  const totalTasks = tasks.filter(t => !activeCampaign || t.campaignId === activeCampaign.id).length;
  const finishedRatio = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  
  // Custom timeline charts mock data
  const conversionData = [
    { date: '01/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.1), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.1), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.1) },
    { date: '02/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.2), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.15), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.22) },
    { date: '03/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.35), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.28), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.31) },
    { date: '04/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.5), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.42), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.45) },
    { date: '05/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.65), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.58), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.6) },
    { date: '06/06', visitas: Math.round((activeCampaign?.visitsCurrent || 0) * 0.8), vendas: Math.round((activeCampaign?.salesCurrent || 0) * 0.75), leads: Math.round((activeCampaign?.whatsappLeadsCurrent || 0) * 0.82) },
    { date: '07/06', visitas: activeCampaign?.visitsCurrent || 0, vendas: activeCampaign?.salesCurrent || 0, leads: activeCampaign?.whatsappLeadsCurrent || 0 },
  ];

  // Campaign creation / editing form modal states
  const [showCmpModal, setShowCmpModal] = useState(false);
  const [isEditingCmp, setIsEditingCmp] = useState(false);
  const [editCmpData, setEditCmpData] = useState({
    name: '',
    goal: '',
    periodStart: '',
    periodEnd: '',
    salesGoal: 0,
    followersGoal: 0,
    visitsGoal: 0,
    whatsappLeadsGoal: 0,
    status: 'ativa' as MktCampaign['status'],
    salesCurrent: 0,
    followersCurrent: 0,
    visitsCurrent: 0,
    whatsappLeadsCurrent: 0
  });

  const handleOpenCreateCampaign = () => {
    setEditCmpData({
      name: '',
      goal: '',
      periodStart: new Date().toISOString().split('T')[0],
      periodEnd: new Date(Date.now() + 11 * 86400000).toISOString().split('T')[0],
      salesGoal: 50000,
      followersGoal: 2000,
      visitsGoal: 10000,
      whatsappLeadsGoal: 500,
      status: 'ativa',
      salesCurrent: 0,
      followersCurrent: 0,
      visitsCurrent: 0,
      whatsappLeadsCurrent: 0
    });
    setIsEditingCmp(false);
    setShowCmpModal(true);
  };

  const handleOpenEditCampaign = () => {
    if (!activeCampaign) return;
    setEditCmpData({
      name: activeCampaign.name || '',
      goal: activeCampaign.goal || '',
      periodStart: activeCampaign.periodStart || '',
      periodEnd: activeCampaign.periodEnd || '',
      salesGoal: activeCampaign.salesGoal || 0,
      followersGoal: activeCampaign.followersGoal || 0,
      visitsGoal: activeCampaign.visitsGoal || 0,
      whatsappLeadsGoal: activeCampaign.whatsappLeadsGoal || 0,
      status: activeCampaign.status || 'ativa',
      salesCurrent: activeCampaign.salesCurrent || 0,
      followersCurrent: activeCampaign.followersCurrent || 0,
      visitsCurrent: activeCampaign.visitsCurrent || 0,
      whatsappLeadsCurrent: activeCampaign.whatsappLeadsCurrent || 0
    });
    setIsEditingCmp(true);
    setShowCmpModal(true);
  };

  const handleCmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCmpData.name.trim()) return;

    if (isEditingCmp && activeCampaign) {
      await saveCampaign({
        ...activeCampaign,
        ...editCmpData
      });
    } else {
      const generatedId = await createCampaign(editCmpData);
      setSelectedCmpId(generatedId);
    }
    setShowCmpModal(false);
  };

  const handleCmpDelete = async () => {
    if (!activeCampaign) return;
    if (confirm(`Atenção: Tem certeza que deseja excluir permanentemente a campanha "${activeCampaign.name}" e zerar seus registros?`)) {
      await deleteCampaign(activeCampaign.id);
      setSelectedCmpId(null);
      setShowCmpModal(false);
    }
  };

  // Goals progress state modification toggles
  const [editingGoals, setEditingGoals] = useState(false);
  const [salesCurrent, setSalesCurrent] = useState(activeCampaign?.salesCurrent || 0);
  const [followersCurrent, setFollowersCurrent] = useState(activeCampaign?.followersCurrent || 0);
  const [visitsCurrent, setVisitsCurrent] = useState(activeCampaign?.visitsCurrent || 0);
  const [leadsCurrent, setLeadsCurrent] = useState(activeCampaign?.whatsappLeadsCurrent || 0);

  const handleSaveProgress = async () => {
    if (!activeCampaign) return;
    const updated = {
      ...activeCampaign,
      salesCurrent: Number(salesCurrent),
      followersCurrent: Number(followersCurrent),
      visitsCurrent: Number(visitsCurrent),
      whatsappLeadsCurrent: Number(leadsCurrent),
    };
    await saveCampaign(updated);
    setEditingGoals(false);
  };

  // Safe parsed percentages
  const getPct = (current: number, goal: number) => {
    if (!goal || goal === 0) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  };

  const salesPct = activeCampaign ? getPct(activeCampaign.salesCurrent || 0, activeCampaign.salesGoal || 1) : 0;
  const followersPct = activeCampaign ? getPct(activeCampaign.followersCurrent || 0, activeCampaign.followersGoal || 1) : 0;
  const visitsPct = activeCampaign ? getPct(activeCampaign.visitsCurrent || 0, activeCampaign.visitsGoal || 1) : 0;
  const leadsPct = activeCampaign ? getPct(activeCampaign.whatsappLeadsCurrent || 0, activeCampaign.whatsappLeadsGoal || 1) : 0;

  // Render modal helper
  const renderCampaignModal = () => (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
        <button 
          onClick={() => setShowCmpModal(false)}
          className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h3 className="text-md font-bold text-rose-50 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            {isEditingCmp ? 'Editar Campanha de Marketing' : 'Nova Campanha de Marketing'}
          </h3>
          <p className="text-[11px] text-zinc-400">
            Preencha os dados e metas para visualizar o faturamento em tempo real.
          </p>
        </div>

        <form onSubmit={handleCmpSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 uppercase font-bold">Nome da Campanha</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Coleção Noite Sedutora 2026"
              value={editCmpData.name}
              onChange={(e) => setEditCmpData({ ...editCmpData, name: e.target.value })}
              className="w-full bg-zinc-950 p-2.5 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 uppercase font-bold">Objetivo Principal / Slogan</label>
            <textarea 
              required
              rows={2}
              placeholder="Ex: Alavancar a venda de corsets importados e conjuntos de renda na Grande São Paulo."
              value={editCmpData.goal}
              onChange={(e) => setEditCmpData({ ...editCmpData, goal: e.target.value })}
              className="w-full bg-zinc-950 p-2.5 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none h-16 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase font-bold">Início</label>
              <input 
                type="date" 
                required
                value={editCmpData.periodStart}
                onChange={(e) => setEditCmpData({ ...editCmpData, periodStart: e.target.value })}
                className="w-full bg-zinc-950 p-2 text-xs rounded border border-zinc-800 text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase font-bold">Término</label>
              <input 
                type="date" 
                required
                value={editCmpData.periodEnd}
                onChange={(e) => setEditCmpData({ ...editCmpData, periodEnd: e.target.value })}
                className="w-full bg-zinc-950 p-2 text-xs rounded border border-zinc-800 text-white outline-none"
              />
            </div>
          </div>

          <div className="bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-xl space-y-3">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block border-b border-zinc-900 pb-1.5 leading-none">Minhas Metas de Estúdio</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold">Meta Faturamento (R$)</label>
                <input 
                  type="number" 
                  value={editCmpData.salesGoal}
                  onChange={(e) => setEditCmpData({ ...editCmpData, salesGoal: Number(e.target.value) })}
                  className="w-full bg-zinc-900 p-2 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold">Meta Seguidores</label>
                <input 
                  type="number" 
                  value={editCmpData.followersGoal}
                  onChange={(e) => setEditCmpData({ ...editCmpData, followersGoal: Number(e.target.value) })}
                  className="w-full bg-zinc-900 p-2 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold">Meta Visitas no Site</label>
                <input 
                  type="number" 
                  value={editCmpData.visitsGoal}
                  onChange={(e) => setEditCmpData({ ...editCmpData, visitsGoal: Number(e.target.value) })}
                  className="w-full bg-zinc-900 p-2 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold">Meta Leads WhatsApp</label>
                <input 
                  type="number" 
                  value={editCmpData.whatsappLeadsGoal}
                  onChange={(e) => setEditCmpData({ ...editCmpData, whatsappLeadsGoal: Number(e.target.value) })}
                  className="w-full bg-zinc-900 p-2 text-xs rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 uppercase font-bold block">Status da Atividade</label>
            <select 
              value={editCmpData.status}
              onChange={(e) => setEditCmpData({ ...editCmpData, status: e.target.value as any })}
              className="bg-zinc-950 p-2 text-xs rounded border border-zinc-800 text-white outline-none w-full"
            >
              <option value="ativa">Ativa (Mostrar no Painel)</option>
              <option value="rascunho">Rascunho</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
            {isEditingCmp ? (
              <button 
                type="button" 
                onClick={handleCmpDelete}
                className="px-4 py-2 bg-red-950 hover:bg-red-900 text-red-400 hover:text-white text-xs font-bold rounded-lg transition-colors border border-red-900/35 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setShowCmpModal(false)}
                className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg"
              >
                Voltar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  // HANDLE EMPTY STATE BEAUTIFULLY
  if (campaigns.length === 0) {
    return (
      <div id="mkt-dashboard-view" className="space-y-8 animate-fade-in text-white min-h-[50vh] flex items-center justify-center">
        <div className="bg-zinc-900/40 border border-zinc-850 p-8 rounded-3xl text-center max-w-xl mx-auto space-y-5 backdrop-blur-md">
          <div className="p-5 bg-red-950/30 text-rose-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-red-900/20 shadow-inner animate-pulse">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-md font-black tracking-tight text-zinc-100 uppercase">Nenhuma Campanha Ativa</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans max-w-md mx-auto">
              Seu banco de dados do Strategic Marketing Hub está vazio e pronto para uso personalizado! Crie sua primeira campanha para habilitar o painel operacional de estatísticas.
            </p>
          </div>
          
          <button 
            onClick={handleOpenCreateCampaign}
            className="px-5 py-2.5 bg-red-650 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)] flex items-center gap-1.5 mx-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Criar Minha Primeira Campanha
          </button>
        </div>

        {showCmpModal && renderCampaignModal()}
      </div>
    );
  }

  return (
    <div id="mkt-dashboard-view" className="space-y-8 animate-fade-in text-white">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 p-6 rounded-2xl backdrop-blur-md">
        <div className="space-y-2">
          {/* Campaign Selector dropdown directly in the dashboard header! */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase bg-red-600/20 text-red-400 border border-red-500/30 rounded-full">
              Foco Operacional
            </span>
            <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-850">
              <label className="text-[10px] uppercase font-mono text-zinc-500 font-extrabold">Campanha:</label>
              <select 
                value={activeCampaign?.id} 
                onChange={(e) => setSelectedCmpId(e.target.value)}
                className="bg-transparent text-xs font-bold font-sans text-rose-50 border-none outline-none cursor-pointer"
              >
                {campaigns.map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-950 text-white font-medium">
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <h2 className="text-xl md:text-2xl font-black text-rose-50 tracking-tight font-sans flex items-center gap-2">
            {activeCampaign?.name || 'Sem nome'}
            <button 
              onClick={handleOpenEditCampaign}
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Configurar Metas e Detalhes da Campanha"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          </h2>
          <p className="text-xs text-zinc-400 max-w-xl">
            Meta: {activeCampaign?.goal || 'Nenhum objetivo específico configurado.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleOpenCreateCampaign}
            className="px-4 py-2 bg-zinc-805 text-zinc-300 rounded-lg hover:bg-zinc-800 hover:text-white text-xs font-bold border border-zinc-830 transition-all cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Campanha
          </button>
          <button 
            onClick={() => {
              setSalesCurrent(activeCampaign?.salesCurrent || 0);
              setFollowersCurrent(activeCampaign?.followersCurrent || 0);
              setVisitsCurrent(activeCampaign?.visitsCurrent || 0);
              setLeadsCurrent(activeCampaign?.whatsappLeadsCurrent || 0);
              setEditingGoals(!editingGoals);
            }}
            className="px-4 py-2 text-xs font-semibold bg-zinc-805 text-zinc-300 rounded-lg hover:bg-zinc-800 hover:text-white border border-zinc-830 transition-all cursor-pointer"
          >
            {editingGoals ? 'Cancelar' : 'Atualizar Métricas'}
          </button>
          <button 
            onClick={() => onTabChange('tasks')}
            className="px-4 py-2 text-xs font-semibold bg-red-650 hover:bg-red-700 bg-red-600 text-white rounded-lg transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)] flex items-center gap-1 cursor-pointer"
          >
            Acessar Kanban <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* METRIC UPDATER PANEL */}
      {editingGoals && (
        <div className="bg-zinc-900 border border-red-900/40 p-6 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.05)] animate-slide-down">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Atualizar Painel Operacional em Tempo Real</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Vendas Atuais (R$)</label>
              <input 
                type="number" 
                value={salesCurrent} 
                onChange={(e) => setSalesCurrent(Number(e.target.value))}
                className="w-full bg-zinc-950 p-2 text-sm rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Seguidores Ganhos</label>
              <input 
                type="number" 
                value={followersCurrent} 
                onChange={(e) => setFollowersCurrent(Number(e.target.value))}
                className="w-full bg-zinc-950 p-2 text-sm rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Visitas no Site</label>
              <input 
                type="number" 
                value={visitsCurrent} 
                onChange={(e) => setVisitsCurrent(Number(e.target.value))}
                className="w-full bg-zinc-950 p-2 text-sm rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Leads WhatsApp</label>
              <input 
                type="number" 
                value={leadsCurrent} 
                onChange={(e) => setLeadsCurrent(Number(e.target.value))}
                className="w-full bg-zinc-950 p-2 text-sm rounded border border-zinc-800 text-white focus:border-red-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={handleSaveProgress}
              className="px-4 py-2 text-xs bg-red-600 text-white hover:bg-red-700 font-bold rounded-lg transition-all"
            >
              Gravar Alterações
            </button>
          </div>
        </div>
      )}

      {/* EXECUTIVE ALERTS PANEL */}
      {alerts.filter(a => !a.read).length > 0 && (
        <div className="bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500 animate-bounce" />
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Central de Alertas & Automações</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">{alerts.filter(a => !a.read).length} pendentes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.filter(a => !a.read).map(alert => (
              <div 
                key={alert.id} 
                className="flex items-start gap-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl hover:border-red-900/30 transition-all group"
              >
                <div className="mt-0.5 p-1 bg-red-950 text-red-400 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <h4 className="text-xs font-bold text-zinc-100 group-hover:text-red-300 transition-colors">
                    {alert.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.id)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer self-start font-mono"
                >
                  [Dispensar]
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORE KPI SUMMARY GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL TASKS CARD */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all bg-[radial-gradient(circle_at_center,_rgba(220,38,38,0.5)_0%,_transparent_100%)]">
            <CheckSquare className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-3">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Volume Operacional</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-50">{totalTasks}</span>
              <span className="text-xs text-zinc-500">ações tot.</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Taxa Conclusão</span>
                <span className="font-mono text-zinc-200">{finishedRatio}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-red-650 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(220,38,38,0.8)]" 
                  style={{ width: `${finishedRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE CAMPAIGN GOALS (SALES) */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all">
            <Target className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-3">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Meta de Faturamento</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-rose-50">
                R$ {(activeCampaign?.salesCurrent || 0).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Meta R$ {(activeCampaign?.salesGoal || 50000).toLocaleString('pt-BR')}</span>
                <span className="font-mono text-zinc-200">{salesPct}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${salesPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* INSTAGRAM FOLLOWERS GOAL */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all">
            <Users className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-3">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Conversão de Seguidores</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-rose-50">
                +{(activeCampaign?.followersCurrent || 0)}
              </span>
              <span className="text-[10px] text-zinc-500">novos</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Alvo: {activeCampaign?.followersGoal || 2000}</span>
                <span className="font-mono text-zinc-200">{followersPct}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${followersPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SITE TRAFFIC & WHATS LEADS */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all">
            <TrendingUp className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-3">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Atração & Leads Zap</span>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-black text-rose-50">{(activeCampaign?.visitsCurrent || 0)}</span>
                <span className="text-[9px] text-zinc-500 block">visitas</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-2xl font-black text-rose-50">{(activeCampaign?.whatsappLeadsCurrent || 0)}</span>
                <span className="text-[9px] text-zinc-500 block">whats</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Média Conversão canais</span>
                <span className="font-mono text-emerald-400">Excelente</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.round((visitsPct + leadsPct) / 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE CONTENT GRID: NEXT ACTIONS VS CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: CRITICAL ACTIONS LIST & DAILY PROGRAM */}
        <div className="lg:col-span-5 space-y-6">
          {/* CRITICAL ACTIONS LIST */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4.5 h-4.5 text-red-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Ações Críticas Pendentes</h3>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold text-red-400 bg-red-950/40 rounded-full border border-red-900/20">
                Urgente
              </span>
            </div>

            <div className="space-y-3">
              {pendingTasks.filter(t => t.priority === 'critica' || t.priority === 'alta').slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  className="group flex items-center justify-between p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl hover:border-zinc-700/80 transition-all cursor-pointer"
                  onClick={() => onTabChange('tasks')}
                >
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-red-500 bg-red-950/40 px-1.5 py-0.5 rounded mr-1">
                      {task.priority.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors">
                      {task.name}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <Clock className="w-3 h-3 text-rose-500" />
                      <span>{task.dueDate.split('-').reverse().join('/')}</span>
                      <span>•</span>
                      <span className="capitalize">{task.phase.replace('-', ' ')}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      moveTask(task.id, 'concluido');
                    }}
                    className="p-1 px-2.5 text-[10px] font-bold bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900/40 rounded-lg transition-colors cursor-pointer"
                  >
                    Marcar Concluido
                  </button>
                </div>
              ))}

              {pendingTasks.filter(t => t.priority === 'critica' || t.priority === 'alta').length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-500">
                  🎉 Nenhuma ação urgente ou de alta prioridade pendente!
                </div>
              )}
            </div>
          </div>

          {/* CALENDARIO DO DIA WIDGET */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4.5 h-4.5 text-orange-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Agenda do Dia: 01 de Junho</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-orange-400 font-mono w-10">09:00</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-zinc-200">Story Destaque</h4>
                  <p className="text-[10px] text-zinc-400">Produto Dia dos Namorados Lançamento</p>
                </div>
                <span className="px-2 py-0.5 text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-900/40 rounded">Sucesso</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-orange-400 font-mono w-10">13:00</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-zinc-200">Story Enquete</h4>
                  <p className="text-[10px] text-zinc-400">O que você prefere ganhar no dia dos namorados?</p>
                </div>
                <span className="px-2 py-0.5 text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-900/40 rounded">Sucesso</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-orange-400 font-mono w-10">18:00</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-zinc-200">Story Oferta</h4>
                  <p className="text-[10px] text-zinc-400">Combo Amor Premium 15% Desconto</p>
                </div>
                <span className="px-2 py-0.5 text-[8px] bg-amber-950 text-amber-400 border border-amber-900/40 rounded animate-pulse">Agendado</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-orange-400 font-mono w-10">21:00</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-zinc-200">Story CTA WhatsApp</h4>
                  <p className="text-[10px] text-zinc-400">Compra secreta com especialista</p>
                </div>
                <span className="px-2 py-0.5 text-[8px] bg-zinc-800 text-zinc-500 rounded">Pendente</span>
              </div>
            </div>
            
            <button 
              onClick={() => onTabChange('calendar')}
              className="w-full py-2 bg-zinc-850 hover:bg-zinc-800 text-[11px] font-bold tracking-wider uppercase border border-zinc-800 rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Exibir Calendário Completo
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: RECHARTS ADVANCED DIAGRAMS */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-md font-bold text-zinc-150">Evolução de Conversão - Namorados 2026</h3>
                <p className="text-[11px] text-zinc-400">Faturamento diário acumulado comparado ao tráfego gerado</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  <span className="text-zinc-300">Vendas Diárias (R$)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="text-zinc-300">Visitas</span>
                </div>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartvendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chartvisitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} 
                    labelStyle={{ color: '#f4f4f5', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="vendas" name="Vendas (R$)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#chartvendas)" />
                  <Area type="monotone" dataKey="visitas" name="Visitas" stroke="#10b981" strokeWidth={1} fillOpacity={1} fill="url(#chartvisitas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TRAFFIC & ENGAGEMENT FUNNEL MAP */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 mb-1">Visualizador de Funil: Atração para Conversão</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-4 bg-rose-950/20 border border-red-900/20 rounded-xl space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Impressões</span>
                <span className="text-lg font-black text-white">45.000</span>
                <span className="text-[9px] text-zinc-500 block">Alcance Social</span>
              </div>
              <div className="p-4 bg-orange-950/20 border border-orange-900/20 rounded-xl space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Cliques / Visitas</span>
                <span className="text-lg font-black text-white">2.890</span>
                <span className="text-[9px] text-orange-400 block">6.4% Taxa</span>
              </div>
              <div className="p-4 bg-emerald-950/20 border border-emerald-950/20 rounded-xl space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">WhatsApp Leads</span>
                <span className="text-lg font-black text-white">132</span>
                <span className="text-[9px] text-emerald-400 block">4.5% Fluxo</span>
              </div>
              <div className="p-4 bg-blue-950/20 border border-blue-900/20 rounded-xl space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Vendas Feitas</span>
                <span className="text-lg font-black text-white">57</span>
                <span className="text-[9px] text-blue-450 block text-sky-400">43.1% Fech.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
