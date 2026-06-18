import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  Folder, 
  Settings, 
  MessageSquare, 
  BarChart, 
  ListOrdered,
  Sparkles,
  Archive,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  Layers,
  Activity,
  Mail,
  LayoutGrid
} from "lucide-react";
import { blogService, BlogPost, BlogCategory } from "../../../services/blogService";

interface AdminBlogHubProps {
  initialTab?: 'publicados' | 'rascunhos' | 'lixeira';
}

export function AdminBlogHub({ initialTab = 'publicados' }: AdminBlogHubProps) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'publicados' | 'rascunhos' | 'lixeira'>(initialTab);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showOportunidades, setShowOportunidades] = useState(false);

  useEffect(() => {
    loadBlogPosts();
  }, []);

  async function loadBlogPosts() {
    setLoading(true);
    try {
      const loadedPosts = await blogService.listPosts(true) || [];
      const loadedCats = await blogService.listCategories() || [];
      const loadedClusters = await blogService.listClusters() || [];
      setPosts(loadedPosts);
      setCategories(loadedCats);
      setClusters(loadedClusters);
    } catch (err) {
      console.error("Erro ao carregar artigos:", err);
      showFeedback('error', "Erro ao carregar a lista de artigos.");
    } finally {
      setLoading(false);
    }
  }

  const getClusterScore = (c: any) => {
    let sc = 0;
    if (c.pillarPostId) sc += 20;
    if ((c.clusterPostIds || []).length >= 3) sc += 15;
    if ((c.internalLinks || []).length >= 5) sc += 10;
    if ((c.relatedProductIds || []).length > 0) sc += 10;
    if ((c.relatedCategoryIds || []).length > 0) sc += 10;
    
    const associatePosts = posts.filter(p => p.clusterId === c.id || p.id === c.pillarPostId || (c.clusterPostIds || []).includes(p.id!));
    if (associatePosts.length > 0) {
      if (associatePosts.every(p => p.seo?.title)) sc += 10;
      if (associatePosts.every(p => p.seo?.description)) sc += 10;
      if (associatePosts.every(p => {
        const hasFaq = (p.seo?.faq && p.seo.faq.length > 0) || p.contentBlocks?.some(b => b.type === 'faq');
        const hasCta = p.contentBlocks?.some(b => b.type === 'cta') || p.content?.includes('cta');
        return hasFaq || hasCta;
      })) sc += 10;
    }
    if (c.mainKeyword) sc += 5;
    return sc;
  };

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleStatusChange(post: BlogPost, newStatus: 'publicado' | 'rascunho' | 'lixeira') {
    if (!post.id) return;
    try {
      await blogService.updatePostStatus(post.id, newStatus);
      showFeedback('success', `Artigo "${post.title}" movido para ${newStatus === 'publicado' ? 'Publicados' : newStatus === 'rascunho' ? 'Rascunhos' : 'Lixeira'}.`);
      loadBlogPosts();
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      showFeedback('error', "Não foi possível alterar o status do artigo.");
    }
  }

  async function handlePermanentDelete(postId: string, titleStr: string) {
    if (!confirm(`Tem certeza que deseja de forma PERMANENTE e IRREVERSÍVEL excluir o artigo "${titleStr}"?`)) {
      return;
    }
    try {
      await blogService.deletePost(postId);
      showFeedback('success', "Artigo excluído permanentemente com sucesso.");
      loadBlogPosts();
    } catch (err) {
      console.error("Erro ao remover permanentemente:", err);
      showFeedback('error', "Erro ao tentar remover o artigo.");
    }
  }

  const getCategoryName = (catId?: string) => {
    return categories.find(c => c.id === catId)?.name || "Geral";
  };

  const filteredPosts = posts.filter(post => {
    const matchesQuery = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (post.subtitle?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                         (post.summary?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                         (post.slug?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    if (activeTab === 'publicados') {
      return matchesQuery && post.status === 'publicado';
    } else if (activeTab === 'rascunhos') {
      return matchesQuery && post.status === 'rascunho';
    } else {
      return matchesQuery && post.status === 'lixeira';
    }
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      {/* Upper Navigation Links */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
            <FileText className="text-red-500" />
            Ecossistema de Blog SEO
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Crie, programe, interaja e otimize os artigos da Discreta Boutique.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/blog/novo"
            className="flex items-center gap-2 bg-red-650 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]"
          >
            <Plus size={14} /> Novo Artigo
          </Link>
          <Link
            to="/admin/blog/ia"
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.25)]"
          >
            <Sparkles size={14} className="animate-pulse text-purple-200" /> Gerar com IA
          </Link>
          <Link
            to="/admin/blog/categorias"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Folder size={13} className="text-zinc-500" /> Categorias
          </Link>
          <Link
            to="/admin/blog/comentarios"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <MessageSquare size={13} className="text-zinc-500" /> Comentários
          </Link>
          <Link
            to="/admin/blog/estatisticas"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <BarChart size={13} className="text-zinc-500" /> Estatísticas
          </Link>
          <Link
            to="/admin/blog/seo"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Sparkles size={13} className="text-zinc-500" /> Checklist SEO
          </Link>
          <Link
            to="/admin/blog/autoridade"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-emerald-300 hover:text-emerald-200 font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <BarChart size={13} className="text-emerald-400" /> Autoridade
          </Link>
          <Link
            to="/admin/blog/inteligencia"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-purple-300 hover:text-purple-200 font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Activity size={13} className="text-purple-400" /> Inteligência SEO
          </Link>
          <Link
            to="/admin/blog/web-stories"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-pink-300 hover:text-pink-200 font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <LayoutGrid size={13} className="text-pink-400" /> Web Stories
          </Link>
          <Link
            to="/admin/blog/newsletter"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-blue-300 hover:text-blue-200 font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Mail size={13} className="text-blue-400" /> Newsletter
          </Link>
          <Link
            to="/admin/blog/clusters"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-purple-300 hover:text-purple-200 font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Layers size={13} className="text-purple-400" /> Clusters SEO
          </Link>
          <Link
            to="/admin/blog/configuracoes"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
          >
            <Settings size={13} className="text-zinc-500" /> Configuração
          </Link>
        </div>
      </div>

      {/* Floating Alert Messages */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400' 
            : 'bg-red-950/20 border-red-500/25 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="text-xs font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* Dashboard de Clusters & Oportunidades SEO */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">Clusters Ativos</span>
          <span className="text-2xl font-black text-white mt-1 block">
            {clusters.filter(c => c.status === 'active').length}
          </span>
          <span className="text-[9px] text-purple-400 font-semibold uppercase mt-1 block">No Google</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">Clusters Fracos</span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">
            {clusters.filter(c => getClusterScore(c) < 50).length}
          </span>
          <span className="text-[9px] text-zinc-500 uppercase mt-1 block">Score &lt; 50%</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">Sem Cluster</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">
            {posts.filter(p => !p.clusterId && p.status === 'publicado').length}
          </span>
          <span className="text-[9px] text-zinc-500 uppercase mt-1 block">Perdendo força</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block font-sans">Artigos Pilares</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {posts.filter(p => p.clusterType === 'pillar' && p.status === 'publicado').length}
          </span>
          <span className="text-[9px] text-zinc-500 uppercase mt-1 block">Pillar content</span>
        </div>

        <button
          type="button"
          onClick={() => setShowOportunidades(!showOportunidades)}
          className={`col-span-2 md:col-span-1 p-4 border rounded-2xl text-left transition-all ${
            showOportunidades 
              ? 'bg-purple-950/20 border-purple-500 text-purple-200' 
              : 'bg-zinc-900 border-zinc-800 hover:border-purple-600/50 text-zinc-300'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-widest block">Análise Geral</span>
          <span className="text-lg font-black mt-1 flex items-center gap-1.5 uppercase font-sans text-white">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse animate-[spin_4s_linear_infinite]" />
            Oportunidades
          </span>
          <span className="text-[9px] text-purple-400 font-bold uppercase mt-1 block">
            {showOportunidades ? 'Ocultar Relatório' : 'Ver Recomendações'}
          </span>
        </button>
      </div>

      {showOportunidades && (
        <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-purple-950 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-400 animate-[spin_10s_linear_infinite]" size={18} />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Relatório Inteligente de Oportunidades SEO</h3>
            </div>
            <button
              onClick={() => setShowOportunidades(false)}
              className="text-[10px] font-bold text-zinc-400 hover:text-white uppercase"
            >
              Fechar
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            
            {/* Oportunidade 1: Artigos sem cluster */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-400">Artigos Órfãos</span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                  {posts.filter(p => !p.clusterId && p.status === 'publicado').length} órfãos
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Estes artigos não estão vinculados a nenhum Cluster SEO. Vinculá-los aumenta a força e a relevância mútua das páginas.
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {posts.filter(p => !p.clusterId && p.status === 'publicado').length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nenhum artigo órfão! Ótimo trabalho.</p>
                ) : (
                  posts.filter(p => !p.clusterId && p.status === 'publicado').slice(0, 5).map(p => (
                    <div key={p.id} className="text-[10.5px] py-1 border-b border-zinc-900 text-zinc-300 truncate font-medium">
                      ✦ {p.title}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Oportunidade 2: Clusters fracos / poucos artigos */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-rose-400 font-sans">Clusters Desnutridos</span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                  {clusters.filter(c => (c.clusterPostIds || []).length < 3).length} fracos
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Clusters com menos de 3 artigos secundários. Escreva ou vincule mais posts para que o Google reconheça a autoridade temática.
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {clusters.filter(c => (c.clusterPostIds || []).length < 3).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Todos os clusters possuem artigos secundários adequados.</p>
                ) : (
                  clusters.filter(c => (c.clusterPostIds || []).length < 3).slice(0, 5).map(c => (
                    <div key={c.id} className="text-[10.5px] py-1 border-b border-zinc-900 text-zinc-300 truncate font-semibold">
                      ⎔ {c.title} ({c.clusterPostIds ? c.clusterPostIds.length : 0}/3)
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Oportunidade 3: Sem FAQ ou CTA */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-purple-400">Baixa Conversão (Sem CTA/FAQ)</span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                  {posts.filter(p => p.status === 'publicado' && !p.contentBlocks?.some(b => b.type === 'cta') && !p.content?.includes('cta')).length} sem CTA
                </span>
              </div>
              <p className="text-[11px] text-zinc-450">
                Artigos sem blocos interativos de FAQ ou chamadas de ação para o WhatsApp/Loja. Otimize a jornada de compra e captação do Lead de Icó-CE.
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {posts.filter(p => p.status === 'publicado' && !p.contentBlocks?.some(b => b.type === 'cta') && !p.content?.includes('cta')).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Excelente! Todos os artigos possuem FAQ ou CTA.</p>
                ) : (
                  posts.filter(p => p.status === 'publicado' && !p.contentBlocks?.some(b => b.type === 'cta') && !p.content?.includes('cta')).slice(0, 5).map(p => (
                    <div key={p.id} className="text-[10.5px] py-1 border-b border-zinc-900 text-zinc-300 truncate font-medium">
                      🗲 {p.title}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main filter tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tab buttons */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800/80 w-fit">
          <button
            onClick={() => setActiveTab('publicados')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'publicados' ? 'bg-red-650 text-white shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Publicados ({posts.filter(p => p.status === 'publicado').length})
          </button>
          <button
            onClick={() => setActiveTab('rascunhos')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'rascunhos' ? 'bg-red-650 text-white shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Rascunhos ({posts.filter(p => p.status === 'rascunho').length})
          </button>
          <button
            onClick={() => setActiveTab('lixeira')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'lixeira' ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Lixeira ({posts.filter(p => p.status === 'lixeira').length})
          </button>
        </div>

        {/* Query Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por título ou tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-850 bg-zinc-900 text-xs text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Articles Table or Empty List */}
      {loading ? (
        <div className="text-center py-20 space-y-4">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-600 animate-spin mx-auto" />
          <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500">Sincronizando com Firestore...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 border border-zinc-850 rounded-2xl bg-zinc-900/40 p-10 space-y-4">
          <FileText size={40} className="text-zinc-700 mx-auto" />
          <p className="text-zinc-400 text-sm">Nenhum artigo encontrado para a aba "{activeTab.toUpperCase()}".</p>
          <Link
            to="/admin/blog/novo"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:underline"
          >
            <Plus size={14} /> Comece a escrever agora
          </Link>
        </div>
      ) : (
        <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-900/80 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <th className="py-4 px-6">Imagem & Artigo</th>
                  <th className="py-4 px-6">Categoria</th>
                  <th className="py-4 px-6">Leitura</th>
                  <th className="py-4 px-6">Estatísticas</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 text-xs">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-zinc-850/20 transition-all">
                    <td className="py-4 px-6 flex items-center gap-4">
                      {post.coverImage ? (
                        <img 
                          src={post.coverImage} 
                          alt={post.title} 
                          className="w-16 h-10 object-cover rounded-lg border border-zinc-800"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                          <FileText size={16} className="text-zinc-550" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Link 
                          to={`/admin/blog/editar/${post.id}`} 
                          className="font-extrabold text-sm hover:text-red-500 hover:underline transition-colors block text-zinc-100"
                        >
                          {post.title}
                        </Link>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          <span>/{post.slug}</span>
                          {post.featured && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black text-[8px] uppercase tracking-wide">
                              Destaque
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded bg-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">
                        {getCategoryName(post.categoryId)}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-zinc-400 font-bold lowercase">
                      Leitura: <span className="text-zinc-200">{post.readingTime || 4} min</span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4 text-zinc-400 text-[11px] font-semibold">
                        <span className="flex items-center gap-1.5" title="Visualizações">
                          <Eye size={13} className="text-zinc-500" />
                          <strong className="text-zinc-200">{post.views || 0}</strong>
                        </span>
                        <span className="flex items-center gap-1.5" title="Comentários">
                          <MessageSquare size={13} className="text-zinc-500" />
                          <strong className="text-zinc-200">{post.commentsCount || 0}</strong>
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {activeTab === 'publicados' && (
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                            title="Ver Publicação Oficial"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                        <Link
                          to={`/admin/blog/editar/${post.id}`}
                          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                          title="Editar Artigo"
                        >
                          <Edit size={15} />
                        </Link>
                        
                        {activeTab !== 'lixeira' ? (
                          <button
                            onClick={() => handleStatusChange(post, 'lixeira')}
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-800"
                            title="Mover para Lixeira"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStatusChange(post, 'rascunho')}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold uppercase rounded text-zinc-300 transition-all"
                              title="Restaurar como Rascunho"
                            >
                              Restaurar
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(post.id!, post.title)}
                              className="p-1.5 text-red-500 hover:text-red-400 rounded-lg hover:bg-zinc-800"
                              title="Excluir Permanentemente"
                            >
                              Excluir Definitivo
                            </button>
                          </>
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
  );
}
