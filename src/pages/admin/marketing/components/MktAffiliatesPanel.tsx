import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Share2, 
  TrendingUp, 
  MessageSquare, 
  Sliders, 
  Trash2, 
  Plus, 
  Clock, 
  Award, 
  DollarSign, 
  Users, 
  Check, 
  Copy, 
  Send, 
  Sparkles,
  Percent,
  Calendar,
  AlertTriangle,
  Info 
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { 
  MktAffiliateCampaign, 
  MktPromotion, 
  MktGiveaway, 
  MktWhatsAppShot 
} from '../marketingTypes';

interface MktAffiliatesPanelProps {
  subView: 'affiliates' | 'promotions' | 'giveaways' | 'whats' | 'reports';
  affiliates: MktAffiliateCampaign[];
  promotions: MktPromotion[];
  giveaways: MktGiveaway[];
  whatsAppShots: MktWhatsAppShot[];
  
  createWhatsAppShot: (shot: Omit<MktWhatsAppShot, 'id'>) => Promise<string>;
  deleteWhatsAppShot: (id: string) => Promise<void>;
  createPromotion: (promo: Omit<MktPromotion, 'id'>) => Promise<string>;
  deletePromotion: (id: string) => Promise<void>;
  createGiveaway: (give: Omit<MktGiveaway, 'id'>) => Promise<string>;
  deleteGiveaway: (id: string) => Promise<void>;
  createAffiliateCampaign?: (cmp: Omit<MktAffiliateCampaign, 'id' | 'createdAt'>) => Promise<string>;
  deleteAffiliateCampaign?: (id: string) => Promise<void>;
  saveAffiliateCampaign?: (cmp: MktAffiliateCampaign) => Promise<void>;
}

export function MktAffiliatesPanel({
  subView,
  affiliates,
  promotions,
  giveaways,
  whatsAppShots,
  
  createWhatsAppShot,
  deleteWhatsAppShot,
  createPromotion,
  deletePromotion,
  createGiveaway,
  deleteGiveaway,
  createAffiliateCampaign,
  deleteAffiliateCampaign,
  saveAffiliateCampaign
}: MktAffiliatesPanelProps) {
  // Countdown Timer state for Sorteios
  const [timeLeft, setTimeLeft] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });

  useEffect(() => {
    // Sorteio Dia dos Namorados end is scheduled on 2026-06-11
    const targetDate = new Date('2026-06-11T23:59:59').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
        return;
      }

      const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
      const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ dias, horas, minutos, segundos });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Copied code check state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  
  // WhatsApp form
  const [whatsTitle, setWhatsTitle] = useState('');
  const [whatsDate, setWhatsDate] = useState('2026-06-02');
  const [whatsText, setWhatsText] = useState('');
  
  // Promotion form
  const [promoCode, setPromoCode] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoStart, setPromoStart] = useState('2026-06-01');
  const [promoEnd, setPromoEnd] = useState('2026-06-12');
  const [promoActive, setPromoActive] = useState(true);

  // Giveaway form
  const [givName, setGivName] = useState('');
  const [givPub, setGivPub] = useState('2026-06-03');
  const [givEnd, setGivEnd] = useState('2026-06-11T23:59:59');
  const [givRes, setGivRes] = useState('2026-06-12');

  // Affiliates form
  const [affName, setAffName] = useState('');
  const [affSales, setAffSales] = useState<number>(0);
  const [affVol, setAffVol] = useState<number>(0);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleWhatsAppShotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsTitle.trim()) return;
    await createWhatsAppShot({
      title: whatsTitle,
      date: whatsDate,
      text: whatsText,
      sent: false
    });
    setWhatsTitle('');
    setWhatsText('');
    setShowForm(false);
  };

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    await createPromotion({
      code: promoCode.toUpperCase(),
      description: promoDesc,
      discountPct: 15, // Default for seeded promo
      startDate: promoStart,
      endDate: promoEnd,
      active: promoActive
    });
    setPromoCode('');
    setPromoDesc('');
    setShowForm(false);
  };

  const handleGiveawaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!givName.trim()) return;
    await createGiveaway({
      name: givName,
      publishedAt: givPub,
      endsAt: givEnd,
      resultAt: givRes
    });
    setGivName('');
    setShowForm(false);
  };

  const handleAffiliateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affName.trim() || !createAffiliateCampaign) return;
    await createAffiliateCampaign({
      name: affName,
      activeAffiliatesCount: 1,
      totalSales: affSales,
      commissionPaid: Math.round(affVol * 0.1),
      ranking: [
        {
          id: Math.random().toString(),
          name: affName,
          salesCount: affSales,
          totalAmount: affVol,
          commission: Math.round(affVol * 0.1)
        }
      ]
    });
    setAffName('');
    setAffSales(0);
    setAffVol(0);
    setShowForm(false);
  };

  // Mock affiliates ranking board
  const mockRanking = [
    { rank: 1, name: 'Clara Silveira (Influencer)', sales: 24, totalVol: 4890, commission: 489 },
    { rank: 2, name: 'Marcos Vasconcelos', sales: 18, totalVol: 3450, commission: 345 },
    { rank: 3, name: 'Amanda Portela (Sexóloga)', sales: 15, totalVol: 2890, commission: 289 },
    { rank: 4, name: 'Vanessa Lima', sales: 11, totalVol: 1980, commission: 198 },
    { rank: 5, name: 'Bruna Mendes', sales: 8, totalVol: 1320, commission: 132 },
  ];

  // Mock Reports Data
  const reportChannels = [
    { name: 'Instagram Orgânico', value: 450, color: '#f43f5e' },
    { name: 'Whats CRM', value: 320, color: '#10b981' },
    { name: 'Parcerias Influencers', value: 580, color: '#3b82f6' },
    { name: 'Afiliados Program', value: 290, color: '#8b5cf6' },
  ];

  const taskCompletionReport = [
    { name: 'Backlog', value: 3 },
    { name: 'Planejado', value: 5 },
    { name: 'Em Progresso', value: 8 },
    { name: 'Aguardando', value: 2 },
    { name: 'Concluído', value: 14 }
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white z-10 relative">
      {/* 1. VIEW GIVEAWAYS */}
      {subView === 'giveaways' && (
        <div className="space-y-6">
          <div className="bg-zinc-950/60 p-5 border border-zinc-805 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-zinc-400">
                <Gift className="w-4 h-4 text-rose-500" />
                <span className="text-xs uppercase font-extrabold tracking-wider">Módulo Sorteios & Desafios</span>
              </div>
              <h2 className="text-md font-bold text-rose-50">Campanhas Dia dos Namorados</h2>
            </div>
            
            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-bold rounded-xl text-zinc-300 hover:text-white transition-colors"
            >
              {showForm ? 'Cancelar' : 'Novo Sorteio'}
            </button>
          </div>

          {/* Form Create Giveaway */}
          {showForm && (
            <form onSubmit={handleGiveawaySubmit} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-down">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] text-zinc-450 uppercase font-black">Título da Campanha</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Sorteio Kit Segredo do Amor Premium"
                  value={givName}
                  onChange={(e) => setGivName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 uppercase font-black">Fim do Ticker</label>
                <input 
                  type="datetime-local" 
                  value={givEnd}
                  onChange={(e) => setGivEnd(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-white font-mono"
                />
              </div>
              <div className="flex items-end md:col-span-1">
                <button type="submit" className="w-full py-2 bg-rose-600 text-xs font-bold text-white rounded hover:bg-rose-700 transition" >
                  Criar Cronômetro
                </button>
              </div>
            </form>
          )}

          {/* Live countdown tickers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[linear-gradient(135deg,_rgba(141,92,246,0.15),_rgba(220,38,38,0.1))] border border-purple-500/20 p-6 rounded-3xl space-y-6 text-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Gift className="w-32 h-32" />
              </div>
              
              <div className="space-y-1.5 z-10 relative">
                <span className="px-3 py-1 bg-purple-950 text-purple-300 text-[9px] font-black uppercase tracking-wider rounded-full border border-purple-900/30">
                  Sorteio Oficial Ativo 🌹
                </span>
                <h3 className="text-md font-bold text-rose-50">Dia dos Namorados Boutique</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Extração direta dos comentários da publicação oficial no Instagram Graph API.</p>
              </div>

              {/* Countdown Board */}
              <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto">
                <div className="bg-zinc-950/80 border border-purple-900/10 p-3 rounded-2xl">
                  <span className="text-2xl font-black text-rose-50 font-mono block">{timeLeft.dias}</span>
                  <span className="text-[9px] uppercase text-zinc-500 block">dias</span>
                </div>
                <div className="bg-zinc-950/80 border border-purple-900/10 p-3 rounded-2xl">
                  <span className="text-2xl font-black text-rose-50 font-mono block">{timeLeft.horas}</span>
                  <span className="text-[9px] uppercase text-zinc-500 block">horas</span>
                </div>
                <div className="bg-zinc-950/80 border border-purple-900/10 p-3 rounded-2xl">
                  <span className="text-2xl font-black text-rose-50 font-mono block">{timeLeft.minutos}</span>
                  <span className="text-[9px] uppercase text-zinc-500 block">min</span>
                </div>
                <div className="bg-zinc-950/80 border border-purple-900/10 p-3 rounded-2xl">
                  <span className="text-2xl font-black text-white font-mono block animate-pulse text-purple-400">{timeLeft.segundos}</span>
                  <span className="text-[9px] uppercase text-zinc-500 block">seg</span>
                </div>
              </div>

              <div className="bg-zinc-950/40 p-4 border border-zinc-800 rounded-2xl text-left space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-zinc-500">Publicação Feed:</span> <span className="font-mono font-bold">03/06/2026</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Resultado Sorteio:</span> <span className="font-mono font-bold text-emerald-400">12/06/2026 às 18h</span></div>
              </div>
            </div>

            {/* List Giveaways */}
            <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-805 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Cronograma de Sorteios</h3>
              
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {giveaways.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-4 bg-zinc-950/60 border border-zinc-800 rounded-2xl hover:border-purple-900/30 transition-all">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-zinc-200">{g.name}</h4>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                        <span>Lançamento: {g.publishedAt.split('-').reverse().join('/')}</span>
                        <span>•</span>
                        <span>Resultado: {g.resultAt.split('-').reverse().join('/')}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteGiveaway(g.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {giveaways.length === 0 && (
                  <p className="text-center py-6 text-xs text-zinc-650 font-sans">Sem sorteios adicionais.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VIEW WHATS BROADCAST ACTIONS */}
      {subView === 'whats' && (
        <div className="space-y-6">
          <div className="bg-zinc-950/60 p-5 border border-zinc-805 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-zinc-400">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase font-extrabold tracking-wider font-mono">WhatsApp Broadcast Blasts</span>
              </div>
              <h2 className="text-md font-bold text-rose-50">Disparos & Roteiros de Lembrete</h2>
            </div>
            
            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-900/40 text-xs font-bold rounded-xl text-emerald-300 hover:text-white transition-all cursor-pointer"
            >
              {showForm ? 'Cancelar' : 'Agendar novo Envio'}
            </button>
          </div>

          {/* Form WhatsApp create */}
          {showForm && (
            <form onSubmit={handleWhatsAppShotSubmit} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-4 animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-zinc-455">Título do Lembrete</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Mensagem Dia dos Namorados Lançamento Oficial"
                    value={whatsTitle}
                    onChange={(e) => setWhatsTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs rounded text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-zinc-455">Data Sugerida do Disparo</label>
                  <input 
                    type="date" 
                    value={whatsDate}
                    onChange={(e) => setWhatsDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs rounded text-white font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-zinc-455">Texto Copiável de Disparo (Utilizar em ferramentas ou lista)</label>
                <textarea 
                  required
                  placeholder="Olá {nome}, preparamos um lançamento secreto do Dia dos Namorados na Discreta Boutique..."
                  value={whatsText}
                  onChange={(e) => setWhatsText(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 text-xs rounded text-white h-24"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" className="px-4 py-2 bg-emerald-600 font-bold text-xs rounded text-white hover:bg-emerald-700 transition" >
                  Gravar e Enfileirar
                </button>
              </div>
            </form>
          )}

          {/* List broadcast shots */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-zinc-900/40 border border-zinc-805 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Automação de Fluxo</h3>
                <p className="text-[11px] text-zinc-450 leading-relaxed font-sans text-zinc-400">
                  Esses disparos devem ser executados manualmente através do seu app de WhatsApp Business disparador ou lista de transmissão. O sistema ajuda a centralizar a cronologia e o progresso.
                </p>
              </div>

              <div className="space-y-2 bg-emerald-950/20 border border-emerald-900/20 p-4 rounded-xl text-[11px] text-emerald-400">
                <div className="font-extrabold uppercase mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Freq. Recomendações
                </div>
                <span>Disparos de cupom não devem ultrapassar 1x por semana para não desgastar o relacionamento de sua lista sigilosa.</span>
              </div>
            </div>

            <div className="lg:col-span-8 bg-zinc-900/40 border border-zinc-805 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-350 text-zinc-300">Agenda de Mensagens de Transmissão</h3>

              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                {whatsAppShots.map(shot => (
                  <div key={shot.id} className="p-4 bg-zinc-950/80 border border-zinc-805 rounded-2xl space-y-3 relative group">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="font-mono text-[9px] font-bold text-emerald-400 uppercase bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900/30">
                          Data: {shot.date.split('-').reverse().join('/')}
                        </span>
                        <h4 className="text-xs font-bold text-zinc-200">{shot.title}</h4>
                      </div>

                      <button 
                        onClick={() => deleteWhatsAppShot(shot.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-850 text-xs text-zinc-350 leading-relaxed font-mono whitespace-pre-wrap select-all">
                      {shot.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIEW AFFILIATES COMMISSION MODULE */}
      {subView === 'affiliates' && (() => {
        const leaderboardItems = affiliates.flatMap((aff) => {
          return (aff.ranking || []).map(item => {
            return {
              id: aff.id,
              campaignName: aff.name,
              name: item.name,
              sales: item.salesCount,
              totalVol: item.totalAmount,
              commission: item.commission
            };
          });
        }).sort((a, b) => b.sales - a.sales);

        const totalPartners = affiliates.length;
        const totalSalesVolume = affiliates.reduce((acc, current) => acc + (current.totalSales || 0), 0);
        const totalFinancialVolume = affiliates.reduce((acc, current) => acc + ((current.ranking || []).reduce((sum, r) => sum + (r.totalAmount || 0), 0)), 0);
        const totalCommissions = affiliates.reduce((acc, current) => acc + ((current.ranking || []).reduce((sum, r) => sum + (r.commission || 0), 0)), 0);

        return (
          <div className="space-y-6">
            <div className="bg-zinc-950/60 p-5 border border-zinc-805 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-zinc-400">
                  <Share2 className="w-4 h-4 text-violet-400" />
                  <span className="text-xs uppercase font-extrabold tracking-wider">Programa Especial de Afiliados</span>
                </div>
                <h2 className="text-md font-bold text-rose-50">Visualização de Vendas & Rankings</h2>
              </div>

              <button 
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-zinc-900 border border-zinc-805 text-xs font-bold rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                {showForm ? 'Cancelar' : 'Novo Parceiro'}
              </button>
            </div>

            {/* Form Create Affiliate */}
            {showForm && (
              <form onSubmit={handleAffiliateSubmit} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-down">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] text-zinc-450 uppercase font-bold">Nome do Parceiro</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Clara Silveira (Sexóloga)"
                    value={affName}
                    onChange={(e) => setAffName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-450 uppercase font-bold">Conversões (Vendas)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Ex: 24"
                    value={affSales}
                    onChange={(e) => setAffSales(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-450 uppercase font-bold">Faturamento (R$)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Ex: 4890"
                    value={affVol || ''}
                    onChange={(e) => setAffVol(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-white"
                  />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs rounded-xl text-white transition cursor-pointer">
                    Salvar Parceiro Afiliado
                  </button>
                </div>
              </form>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Afiliados Ativos</span>
                <span className="text-2xl font-black text-rose-50 block mt-1">{totalPartners}</span>
                <span className="text-[9px] text-zinc-500 block">Cadastrados no painel</span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Vendas Atribuídas</span>
                <span className="text-2xl font-black text-rose-50 block mt-1">{totalSalesVolume}</span>
                <span className="text-[9px] text-zinc-500 block">Via link ou cupom</span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Faturamento Agregado</span>
                <span className="text-2xl font-black text-emerald-400 block mt-1">
                  R$ {totalFinancialVolume.toLocaleString('pt-BR')}
                </span>
                <span className="text-[9px] text-zinc-500 block font-mono">Conversão real</span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Comissões Emitidas (10%)</span>
                <span className="text-2xl font-black text-amber-500 block mt-1">R$ {totalCommissions.toLocaleString('pt-BR')}</span>
                <span className="text-[9px] text-emerald-400 block font-bold">Pago & Liberado</span>
              </div>
            </div>

            {/* Top Rankings Leaderboard */}
            <div className="bg-zinc-900/40 border border-zinc-805 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-1.5">
                  <Award className="w-4.5 h-4.5 text-rose-500" /> Leaderboard: Ranking de Afiliados
                </h3>
                <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase bg-red-950 text-red-400 rounded-full border border-red-900/20">
                  Top Performers
                </span>
              </div>

              {leaderboardItems.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-400 block">Nenhum parceiro ou campanha de afiliados cadastrado.</span>
                  <button onClick={() => setShowForm(true)} className="text-[10px] font-bold text-red-400 hover:underline">
                    + Registrar primeiro afiliado agora
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="hidden md:table w-full text-xs text-left">
                    <thead>
                      <tr className="uppercase text-[9px] text-zinc-500 font-extrabold border-b border-zinc-900">
                        <th className="p-3">Posição</th>
                        <th className="p-3">Parceiro</th>
                        <th className="p-3">Conversões</th>
                        <th className="p-3">Volume Vendido (R$)</th>
                        <th className="p-3">Repasse Devido (10%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40">
                      {leaderboardItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-950/40 group font-sans">
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 font-bold font-mono">
                              {idx === 0 && <span className="p-1 px-2.5 text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded">1º 🏆</span>}
                              {idx === 1 && <span className="p-1 px-2.5 text-[9px] bg-zinc-400/10 text-zinc-300 border border-zinc-400/20 rounded">2º 🥈</span>}
                              {idx === 2 && <span className="p-1 px-2.5 text-[9px] bg-amber-700/10 text-amber-600 border border-amber-700/20 rounded">3º 🥉</span>}
                              {idx > 2 && <span className="text-zinc-500 ml-3">{idx + 1}º</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-zinc-200 group-hover:text-white transition-colors">{item.name}</span>
                          </td>
                          <td className="p-3 font-mono text-zinc-300 font-bold">{item.sales} vendas</td>
                          <td className="p-3 font-mono font-bold text-zinc-300">R$ {item.totalVol.toLocaleString('pt-BR')}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">
                            <div className="flex items-center justify-between">
                              <span>R$ {item.commission}</span>
                              {deleteAffiliateCampaign && (
                                <button 
                                  onClick={() => {
                                    if (confirm('Deletar este parceiro do banco de dados?')) deleteAffiliateCampaign(item.id);
                                  }}
                                  className="text-zinc-500 hover:text-red-400 p-1 opacity-100 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MOBILE ONLY RANKINGS BADGES */}
                  <div className="block md:hidden divide-y divide-zinc-800/40 font-sans">
                    {leaderboardItems.map((item, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between hover:bg-zinc-905/30 transition-all text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold shrink-0">
                            {idx === 0 && <span className="p-1 px-2 text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded font-black">1º 🏆</span>}
                            {idx === 1 && <span className="p-1 px-2 text-[9px] bg-zinc-400/10 text-zinc-300 border border-zinc-400/20 rounded font-black">2º 🥈</span>}
                            {idx === 2 && <span className="p-1 px-2 text-[9px] bg-amber-700/10 text-amber-600 border border-amber-700/20 rounded font-black">3º 🥉</span>}
                            {idx > 2 && <span className="text-zinc-500 font-bold ml-1.5">{idx + 1}º</span>}
                          </span>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-100">{item.name}</span>
                              {deleteAffiliateCampaign && (
                                <button 
                                  onClick={() => {
                                    if (confirm('Deletar este parceiro do banco de dados?')) deleteAffiliateCampaign(item.id);
                                  }}
                                  className="text-zinc-500 hover:text-red-400 p-0.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 block font-mono">{item.sales} conversões • R$ {item.totalVol.toLocaleString('pt-BR')} vol.</span>
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-emerald-400 block">R$ {item.commission}</span>
                          <span className="text-[9px] text-zinc-500 block font-mono uppercase tracking-wider">Repasse</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 4. VIEW PROMOTIONS & ACTIVE COUPONS */}
      {subView === 'promotions' && (
        <div className="space-y-6">
          <div className="bg-zinc-950/60 p-5 border border-zinc-805 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-zinc-400">
                <Percent className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs uppercase font-extrabold tracking-wider">Painel de Campanhas & Cupons</span>
              </div>
              <h2 className="text-md font-bold text-rose-50">Promoções de Venda Ativas</h2>
            </div>

            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-bold rounded-xl text-zinc-300 hover:text-white transition-colors"
            >
              {showForm ? 'Cancelar' : 'Cadastrar novo Cupom'}
            </button>
          </div>

          {/* Form write promotions */}
          {showForm && (
            <form onSubmit={handlePromotionSubmit} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-4 animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-zinc-455">Código do Cupom</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: NAMORADOS15"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs rounded text-white font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-zinc-455">Descrição Curta</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: 15% Desconto na linha de renda"
                    value={promoDesc}
                    onChange={(e) => setPromoDesc(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs rounded text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-xs font-bold rounded text-white hover:bg-emerald-700 transition" >
                  Gravar Cupom
                </button>
              </div>
            </form>
          )}

          {/* List promotion coupons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map(promo => (
              <div 
                key={promo.id} 
                className={`bg-zinc-95/80 border rounded-2xl p-5 hover:border-zinc-700 transition-all ${promo.active ? 'bg-zinc-950/80 border-zinc-805' : 'bg-zinc-950/40 border-zinc-900/60 opacity-60'}`}
              >
                <div className="space-y-3.5">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm font-black text-emerald-400 select-all block">
                      {promo.code}
                    </span>
                    
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-lg border ${promo.active ? 'bg-emerald-950 border-emerald-900/40 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-505'}`}>
                      {promo.active ? 'Ativo' : 'Expirado'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {promo.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-mono bg-zinc-900/30 p-2 rounded-lg">
                    <div>Validade:</div>
                    <div className="text-right text-zinc-350">{promo.endDate.split('-').reverse().join('/')}</div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900 pt-3">
                    <button 
                      onClick={() => handleCopyCode(promo.code)}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 hover:text-white rounded flex items-center gap-1 transition"
                    >
                      {copiedCode === promo.code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedCode === promo.code ? 'Copiado!' : 'Copiar'}
                    </button>

                    <button 
                      onClick={() => deletePromotion(promo.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                      title="Apagar Cupom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. VIEW ADVANCED REPORTS DIAGRAMS */}
      {subView === 'reports' && (
        <div className="space-y-6">
          <div className="bg-zinc-950/60 p-5 border border-zinc-805 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-zinc-400">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-xs uppercase font-extrabold tracking-wider">Business Intelligence Hub</span>
              </div>
              <h2 className="text-md font-bold text-rose-50">Gráficos de Performance de Campanha</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PIE CHART OR BAR CHART CHANNEL CONTRIBUTIONS */}
            <div className="bg-zinc-900/40 border border-zinc-805 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-350 text-zinc-300">Contribuição por Canal de Atração (Visitas)</h3>
              
              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportChannels} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={11} stroke="#52525b" tickLine={false} />
                    <YAxis fontSize={11} stroke="#52525b" tickLine={false} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} 
                    />
                    <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]}>
                      {reportChannels.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* BAR CHART KANBAN COMPLETIONS DIAGRAM */}
            <div className="bg-zinc-900/40 border border-zinc-805 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-305 text-zinc-300">Status Geral do Quadro Kanban de Ações</h3>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskCompletionReport} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
                    <XAxis type="number" stroke="#52525b" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={11} tickLine={false} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} 
                    />
                    <Bar dataKey="value" fill="#ec4899" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
