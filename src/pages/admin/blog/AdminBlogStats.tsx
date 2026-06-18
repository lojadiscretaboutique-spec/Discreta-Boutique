import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart, Eye, Share2, MessageSquare, Award, RefreshCw, TrendingUp } from "lucide-react";
import { blogService, BlogPost, BlogStatistic } from "../../../services/blogService";

export function AdminBlogStats() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState<BlogStatistic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  async function loadStatistics() {
    setLoading(true);
    try {
      const loadedPosts = await blogService.listPosts();
      const loadedStats = await blogService.listStats();
      setPosts(loadedPosts);
      setStats(loadedStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Aggregate stats counts to show in cards
  const getTotalViews = () => {
    return posts.reduce((sum, p) => sum + (p.views || 0), 0) + stats.filter(s => s.actionType === 'view').length;
  };

  const getTotalShares = () => {
    return stats.filter(s => s.actionType === 'share').length;
  };

  const getTotalClicks = () => {
    return stats.filter(s => s.actionType === 'click').length;
  };

  const getTopPosts = () => {
    // Return posts sorted by views descending
    return [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-655 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Calculando cliques e engajamento...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white tracking-tight flex items-center gap-1.5">
              <BarChart size={22} className="text-red-500" />
              Estatísticas & Analytics
            </h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Mensure o engajamento de leituras, cliques em Recomendações e compartilhamentos.</p>
          </div>
        </div>

        <button
          onClick={loadStatistics}
          className="flex items-center gap-1 px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
        >
          <RefreshCw size={13} /> Atualizar Real-Time
        </button>
      </div>

      {/* Numerical Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 border border-zinc-85a border-zinc-800/80 rounded-2xl bg-zinc-900/40 space-y-1">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-[10px] uppercase font-black tracking-wider">Artigos Totais</span>
          </div>
          <p className="text-4xl font-black text-white">{posts.length}</p>
          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Artigos indexados</span>
        </div>

        <div className="p-6 border border-zinc-85a border-zinc-800/80 rounded-2xl bg-zinc-900/40 space-y-1">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-[10px] uppercase font-black tracking-wider">Leituras Totais</span>
            <Eye size={14} className="text-red-500" />
          </div>
          <p className="text-4xl font-black text-white">{getTotalViews()}</p>
          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Leituras registradas</span>
        </div>

        <div className="p-6 border border-zinc-85a border-zinc-800/80 rounded-2xl bg-zinc-900/40 space-y-1">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-[10px] uppercase font-black tracking-wider">Compartilhados</span>
            <Share2 size={14} className="text-red-500" />
          </div>
          <p className="text-4xl font-black text-white">{getTotalShares()}</p>
          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Via link ou redes</span>
        </div>

        <div className="p-6 border border-zinc-85a border-zinc-800/80 rounded-2xl bg-zinc-900/40 space-y-1">
          <div className="flex justify-between items-center text-zinc-500">
            <span className="text-[10px] uppercase font-black tracking-wider">CLIQUES PRODUTOS</span>
            <TrendingUp size={14} className="text-red-500" />
          </div>
          <p className="text-4xl font-black text-white">{getTotalClicks()}</p>
          <span className="text-[9px] text-zinc-500 uppercase font-bold block">Cliques em Recomendações</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Top matching articles list */}
        <div className="md:col-span-2 border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-900/50">
          <div className="p-5 border-b border-zinc-850 bg-zinc-900/80 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Award size={15} className="text-amber-500" /> Top Artigos Mais Lidos
            </h3>
            <span className="text-[9px] bg-red-600/10 text-red-500 font-bold uppercase py-0.5 px-2 rounded-full border border-red-500/10">Views</span>
          </div>

          <div className="p-6 space-y-5">
            {getTopPosts().length === 0 ? (
              <p className="text-center text-zinc-500 text-xs py-10 uppercase font-bold">Nenhum artigo publicado no banco de dados.</p>
            ) : (
              getTopPosts().map((post, idx) => {
                const maxViews = Math.max(...posts.map(p => p.views || 1), 1);
                // Simple percentage calculate as a percentage of max view
                const pct = Math.round(((post.views || 0) / maxViews) * 100);
                return (
                  <div key={post.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-zinc-200 truncate pr-6">
                        {idx + 1}. {post.title}
                      </span>
                      <span className="font-mono text-zinc-400 font-bold shrink-0">{post.views || 0} visualizações</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-850">
                      <div 
                        className="bg-red-650 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 4)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Traffic channels source breakdown */}
        <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-5 h-fit">
          <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3">
            Canais de Origem
          </h3>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="font-semibold uppercase tracking-wide text-xs">Direct / Orgânico</span>
                <span className="font-bold">75%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full rounded-full" style={{ width: "75%" }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="font-semibold uppercase tracking-wide text-xs">Redes Sociais</span>
                <span className="font-bold">18%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full rounded-full" style={{ width: "18%" }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="font-semibold uppercase tracking-wide text-xs">WhatsApp / Recomendações</span>
                <span className="font-bold">7%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full rounded-full" style={{ width: "7%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
