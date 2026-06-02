import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Kanban, 
  Calendar, 
  BookOpen, 
  Users, 
  Gift, 
  MessageSquare, 
  Share2, 
  Percent, 
  TrendingUp, 
  Sparkles,
  ArrowLeft,
  Bell,
  Menu,
  Trash2
} from 'lucide-react';
import { useMarketingData } from './marketingHook';

// Modular Sub-views
import { MktDashboard } from './components/MktDashboard';
import { MktKanban } from './components/MktKanban';
import { MktCalendar } from './components/MktCalendar';
import { MktInfluencers } from './components/MktInfluencers';
import { MktContentLibrary } from './components/MktContentLibrary';
import { MktAffiliatesPanel } from './components/MktAffiliatesPanel';

export default function AdminMarketingHub() {
  const { subpage } = useParams();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  
  const activeTab = subpage || 'dashboard';

  // Retrieve encapsulated state mutations from our customized hook
  const {
    loading,
    campaigns,
    tasks,
    influencers,
    affiliates,
    promotions,
    giveaways,
    contentItems,
    alerts,
    whatsAppShots,

    // Operations
    moveTask,
    saveTask,
    createTask,
    deleteTask,
    addCommentToTask,
    updateChecklistItem,
    addChecklistItem,
    
    saveInfluencer,
    createInfluencer,
    deleteInfluencer,

    createWhatsAppShot,
    deleteWhatsAppShot,

    createPromotion,
    deletePromotion,

    createGiveaway,
    deleteGiveaway,

    createAffiliateCampaign,
    deleteAffiliateCampaign,
    saveAffiliateCampaign,

    saveContentItem,
    createContentItem,
    deleteContentItem,

    dismissAlert,
    saveCampaign,
    createCampaign,
    deleteCampaign,
    wipeAllData,
    loadDemoData
  } = useMarketingData();

  // Sidebar navigation options
  const navItems = [
    { id: 'dashboard', label: 'Estatísticas Gerais', icon: LayoutDashboard },
    { id: 'tasks', label: 'Kanban Action Plan', icon: Kanban },
    { id: 'calendar', label: 'Calendário Integrado', icon: Calendar },
    { id: 'content', label: 'Central de Conteúdos', icon: BookOpen },
    { id: 'influencers', label: 'Influenciadores CRM', icon: Users },
    { id: 'giveaways', label: 'Sorteios & Countdown', icon: Gift },
    { id: 'whats', label: 'Recorrências WhatsApp', icon: MessageSquare },
    { id: 'affiliates', label: 'Afiliados Ranking', icon: Share2 },
    { id: 'promotions', label: 'Promoções & Cupons', icon: Percent },
    { id: 'reports', label: 'Relatórios Inteligência', icon: TrendingUp },
  ];

  const handleTabChange = (tabId: string) => {
    navigate(`/admin/marketing/${tabId}`);
    setMobileMenuOpen(false);
  };

  const activeAlertsCount = alerts.filter(a => !a.read).length;

  return (
    <div id="marketing-hub-wrapper" className="min-h-screen bg-zinc-950 font-sans antialiased text-white flex flex-col md:flex-row relative overflow-hidden">
      {/* GLOW DECORATIONS (Sedução & Sigilo) */}
      <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(220,38,38,0.08)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.06)_0%,_transparent_70%)] pointer-events-none" />

      {/* MOBILE TOP BAR HEADER */}
      <div className="md:hidden flex items-center justify-between bg-zinc-900/85 border-b border-zinc-900 px-6 py-4 backdrop-blur-md z-30 sticky top-0 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-red-600 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider uppercase text-rose-50 leading-none">Mkt Hub Pro</h1>
            <span className="text-[9px] text-zinc-550 block font-bold tracking-widest leading-none font-mono mt-0.5">Discreta Boutique</span>
          </div>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm md:hidden z-35"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* LEFT MODULE NAVIGATION DRAWBAR */}
      <aside className={`
        fixed inset-y-0 left-0 w-[260px] md:relative md:w-[260px] 
        bg-zinc-950 md:bg-zinc-900/40 
        border-r border-zinc-900 backdrop-blur-md shrink-0 
        flex flex-col justify-between py-6 px-4 z-40 
        transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          {/* Hub brand heading */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-600 rounded-xl shadow-[0_0_12px_rgba(220,38,38,0.4)]">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wider uppercase text-rose-50 leading-tight">Mkt Hub Pro</h1>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-widest leading-none font-mono">Discreta Boutique</span>
              </div>
            </div>
            
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 hover:bg-zinc-900 bg-zinc-950 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer w-8 h-8 flex items-center justify-center border border-zinc-850"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Quick alert bar indicator */}
          {activeAlertsCount > 0 && (
            <div className="p-3 bg-red-950/20 border border-red-900/20 rounded-xl flex items-center justify-between text-zinc-350">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-extrabold text-red-400">
                <Bell className="w-3.5 h-3.5 animate-bounce" />
                <span>Notificações</span>
              </div>
              <span className="px-1.5 py-0.5 bg-red-600 text-[9px] font-mono font-bold text-white rounded-full">
                {activeAlertsCount}
              </span>
            </div>
          )}

          {/* Nav groups */}
          <nav className="space-y-1">
            <span className="text-[9px] text-zinc-650 px-2.5 font-bold uppercase tracking-widest block mb-2 font-mono">WORKSPACE</span>
            {navItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-red-600 text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] font-extrabold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'}`}
                >
                  <IconComp className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Back Link to store panels & Administrative triggers */}
        <div className="pt-4 border-t border-zinc-900/80 space-y-2">
          <button 
            onClick={async () => {
              if (confirm('Atenção: Realmente deseja apagar TODOS os seus dados planejados do Strategic Marketing Hub? Isso limpará todas as suas tarefas, campanhas, influenciadores, mídias e cupons. Essa ação é irreversível.')) {
                await wipeAllData();
                alert('Tudo limpo! Suas listas e estatísticas agora estão vazias e prontas para sua inclusão manual.');
              }
            }}
            className="w-full flex items-center gap-2 text-xs text-red-500 hover:text-red-400 px-3 py-2 transition-colors cursor-pointer rounded-lg hover:bg-zinc-950"
          >
            <Trash2 className="w-4 h-4 text-red-500" /> Limpar Banco de Dados
          </button>

          <button 
            onClick={async () => {
              if (confirm('Deseja carregar as configurações e os logs demonstrativos do Dia dos Namorados? Os dados que você gerou manualmente serão mantidos e os registros de exemplo serão adicionados.')) {
                await loadDemoData();
                alert('Dados de demonstração carregados com sucesso!');
              }
            }}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-white px-3 py-2 transition-colors cursor-pointer rounded-lg"
          >
            <Sparkles className="w-4 h-4 text-zinc-500" /> Carregar Demonstração
          </button>

          <button 
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-white px-3 py-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Painel de Vendas
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE MAIN CONTENT CONTAINER */}
      <main className="flex-grow p-6 md:p-8 overflow-y-auto max-h-screen">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
            <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin shadow-inner" />
            <div className="space-y-1 text-center">
              <h3 className="text-sm font-bold text-zinc-100">Sincronizando com Firebase Firestore...</h3>
              <p className="text-[11px] text-zinc-500 leading-none">Carregando métricas e cronogramas da Boutique</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* 1. Dashboard View */}
            {activeTab === 'dashboard' && (
              <MktDashboard 
                campaigns={campaigns}
                tasks={tasks}
                alerts={alerts}
                dismissAlert={dismissAlert}
                moveTask={moveTask}
                saveCampaign={saveCampaign}
                createCampaign={createCampaign}
                deleteCampaign={deleteCampaign}
                onTabChange={handleTabChange}
              />
            )}

            {/* 2. Action Kanban View */}
            {activeTab === 'tasks' && (
              <MktKanban 
                tasks={tasks}
                moveTask={moveTask}
                saveTask={saveTask}
                createTask={createTask}
                deleteTask={deleteTask}
                addCommentToTask={addCommentToTask}
                updateChecklistItem={updateChecklistItem}
                addChecklistItem={addChecklistItem}
              />
            )}

            {/* 3. Calendar View */}
            {activeTab === 'calendar' && (
              <MktCalendar 
                tasks={tasks}
                influencers={influencers}
                giveaways={giveaways}
                whatsAppShots={whatsAppShots}
                promotions={promotions}
                saveTask={saveTask}
                createTask={createTask}
                deleteTask={deleteTask}
              />
            )}

            {/* 4. Content Library view */}
            {activeTab === 'content' && (
              <MktContentLibrary 
                contentItems={contentItems}
                saveContentItem={saveContentItem}
                createContentItem={createContentItem}
                deleteContentItem={deleteContentItem}
              />
            )}

            {/* 5. Influencers CRM Spreadsheet */}
            {activeTab === 'influencers' && (
              <MktInfluencers 
                influencers={influencers}
                tasks={tasks}
                saveInfluencer={saveInfluencer}
                createInfluencer={createInfluencer}
                deleteInfluencer={deleteInfluencer}
              />
            )}

            {/* 6. Composite views */}
            {(activeTab === 'giveaways' || activeTab === 'whats' || activeTab === 'affiliates' || activeTab === 'promotions' || activeTab === 'reports') && (
              <MktAffiliatesPanel 
                subView={activeTab as any}
                affiliates={affiliates}
                promotions={promotions}
                giveaways={giveaways}
                whatsAppShots={whatsAppShots}
                createWhatsAppShot={createWhatsAppShot}
                deleteWhatsAppShot={deleteWhatsAppShot}
                createPromotion={createPromotion}
                deletePromotion={deletePromotion}
                createGiveaway={createGiveaway}
                deleteGiveaway={deleteGiveaway}
                createAffiliateCampaign={createAffiliateCampaign}
                deleteAffiliateCampaign={deleteAffiliateCampaign}
                saveAffiliateCampaign={saveAffiliateCampaign}
              />
            )}
            
          </div>
        )}
      </main>
    </div>
  );
}
