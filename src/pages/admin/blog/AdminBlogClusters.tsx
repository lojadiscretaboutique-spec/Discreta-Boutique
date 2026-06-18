import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { 
  Layers, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  Folder, 
  ShoppingBag, 
  HelpCircle, 
  FileText,
  BadgeAlert,
  Save,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";
import { blogService, BlogPost, BlogCategory, BlogCluster } from "../../../services/blogService";
import { db, auth } from "../../../lib/firebase";
import { collection, getDocs, doc, setDoc, query, limit } from "firebase/firestore";

export function AdminBlogClusters() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // View mode
  const [isNew, setIsNew] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Lists & State
  const [clusters, setClusters] = useState<BlogCluster[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [pillarPostId, setPillarPostId] = useState("");
  const [clusterPostIds, setClusterPostIds] = useState<string[]>([]);
  const [relatedCategoryIds, setRelatedCategoryIds] = useState<string[]>([]);
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [internalLinks, setInternalLinks] = useState<{ text: string; url: string }[]>([]);
  const [newLinkText, setNewLinkText] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [status, setStatus] = useState<'active' | 'draft'>('active');
  const [priority, setPriority] = useState(1);

  // AI Prompt State
  const [aiTopicInput, setAiTopicInput] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/novo")) {
      setIsNew(true);
      setIsEdit(false);
      resetForm();
    } else if (path.includes("/editar/") && id) {
      setIsEdit(true);
      setIsNew(false);
    } else {
      setIsNew(false);
      setIsEdit(false);
    }
  }, [window.location.pathname, id]);

  useEffect(() => {
    loadAllData();
  }, [id, isEdit]);

  async function loadAllData() {
    setLoading(true);
    try {
      const loadedClusters = await blogService.listClusters() || [];
      const loadedPosts = await blogService.listPosts(true) || [];
      const loadedCats = await blogService.listCategories() || [];
      
      // Load store products up to 300 items
      const pSnap = await getDocs(query(collection(db, 'products'), limit(300)));
      const loadedProducts = pSnap.docs.map(d => ({ id: d.id, name: d.data().name || "Sem Nome", ...d.data() }));

      setClusters(loadedClusters);
      setPosts(loadedPosts);
      setCategories(loadedCats);
      setStoreProducts(loadedProducts);

      if (isEdit && id) {
        const cluster = loadedClusters.find(c => c.id === id);
        if (cluster) {
          setTitle(cluster.title || "");
          setSlug(cluster.slug || "");
          setDescription(cluster.description || "");
          setMainKeyword(cluster.mainKeyword || "");
          setSecondaryKeywords(cluster.secondaryKeywords || []);
          setPillarPostId(cluster.pillarPostId || "");
          setClusterPostIds(cluster.clusterPostIds || []);
          setRelatedCategoryIds(cluster.relatedCategoryIds || []);
          setRelatedProductIds(cluster.relatedProductIds || []);
          setInternalLinks(cluster.internalLinks || []);
          setStatus(cluster.status || "active");
          setPriority(cluster.priority || 1);
        } else {
          showFeedback('error', "SEO Cluster não encontrado.");
          navigate("/admin/blog/clusters");
        }
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao sincronizar dados com o banco de dados.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setSlug("");
    setDescription("");
    setMainKeyword("");
    setSecondaryKeywords([]);
    setNewKeywordInput("");
    setPillarPostId("");
    setClusterPostIds([]);
    setRelatedCategoryIds([]);
    setRelatedProductIds([]);
    setInternalLinks([]);
    setStatus("active");
    setPriority(1);
    setAiTopicInput("");
  }

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  }

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isNew) {
      const gSlug = val
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      setSlug(gSlug);
    }
  };

  // Add keywords helper
  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;
    if (secondaryKeywords.includes(newKeywordInput.trim())) return;
    setSecondaryKeywords([...secondaryKeywords, newKeywordInput.trim()]);
    setNewKeywordInput("");
  };

  const handleRemoveKeyword = (idx: number) => {
    setSecondaryKeywords(secondaryKeywords.filter((_, i) => i !== idx));
  };

  // Add internal link helper
  const handleAddInternalLink = () => {
    if (!newLinkText.trim() || !newLinkUrl.trim()) return;
    setInternalLinks([...internalLinks, { text: newLinkText.trim(), url: newLinkUrl.trim() }]);
    setNewLinkText("");
    setNewLinkUrl("");
  };

  const handleRemoveInternalLink = (idx: number) => {
    setInternalLinks(internalLinks.filter((_, i) => i !== idx));
  };

  // Dynamic quality score calculator (0 to 100)
  const calculateScore = () => {
    let sc = 0;
    if (pillarPostId) sc += 20;
    if (clusterPostIds.length >= 3) sc += 15;
    if (internalLinks.length >= 5) sc += 10;
    if (relatedProductIds.length > 0) sc += 10;
    if (relatedCategoryIds.length > 0) sc += 10;
    
    // Check SEO details on associated posts
    const associatedPostIds = [...(pillarPostId ? [pillarPostId] : []), ...clusterPostIds];
    const clusterPosts = posts.filter(p => associatedPostIds.includes(p.id!));
    
    if (clusterPosts.length > 0) {
      if (clusterPosts.every(p => p.seo?.title)) sc += 10;
      if (clusterPosts.every(p => p.seo?.description)) sc += 10;
      if (clusterPosts.every(p => {
        const hasFaq = (p.seo?.faq && p.seo.faq.length > 0) || p.contentBlocks?.some(b => b.type === 'faq');
        const hasCta = p.contentBlocks?.some(b => b.type === 'cta') || p.content?.includes('cta');
        return hasFaq || hasCta;
      })) sc += 10;
    }
    if (mainKeyword) sc += 5;
    return sc;
  };

  const getClusterScore = (c: BlogCluster) => {
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

  // Re-ordering clusters secondary articles helpers
  const movePostInList = (index: number, direction: 'up' | 'down') => {
    const list = [...clusterPostIds];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setClusterPostIds(list);
  };

  // Safe toggler
  const toggleClusterState = async (c: BlogCluster) => {
    try {
      const targetState = c.status === 'active' ? 'draft' : 'active';
      await blogService.updateCluster(c.id!, { status: targetState });
      showFeedback('success', `Cluster "${c.title}" alterado para ${targetState === 'active' ? 'Ativo' : 'Rascunho'}.`);
      loadAllData();
    } catch {
      showFeedback('error', "Erro ao mudar status do cluster.");
    }
  };

  const handleRemoveCluster = async (cId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja apagar permanentemente o Cluster SEO "${name}"? Os artigos vinculados NÃO serão apagados.`)) return;
    try {
      await blogService.deleteCluster(cId);
      showFeedback('success', "Cluster removido permanentemente do ecossistema.");
      loadAllData();
    } catch {
      showFeedback('error', "Erro ao tentar remover o cluster.");
    }
  };

  // Suggest Cluster strategic structures using server-side OpenAI
  const triggerAiGenerations = async () => {
    if (!aiTopicInput.trim()) {
      alert("Escreva um tema ou nicho conceitual (ex: Lingerie de Noiva, Algodão vs Microfibra) para planejar!");
      return;
    }
    setGeneratingAi(true);
    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      
      const response = await fetch("/api/admin/blog/generate-cluster-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tema: aiTopicInput.trim() })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Erro desconhecido.");
      }

      const resJson = await response.json();
      const plan = resJson.cluster;

      if (plan) {
        setTitle(plan.title || "");
        setSlug(plan.slug || "");
        setDescription(plan.description || "");
        setMainKeyword(plan.mainKeyword || "");
        setSecondaryKeywords(plan.secondaryKeywords || []);
        
        // Match product ids suggested dynamically with available products
        if (plan.suggestedProducts && Array.isArray(plan.suggestedProducts)) {
          const matchedIds = storeProducts
            .filter(p => plan.suggestedProducts.includes(p.id) || plan.suggestedProducts.some((suggested: string) => p.name.toLowerCase().includes(suggested.toLowerCase())))
            .map(p => p.id!);
          setRelatedProductIds(matchedIds);
        }

        // Generate dynamic link plan
        const linksPlan = [
          { text: `O maior guia sobre ${plan.mainKeyword || 'Moda Íntima'}`, url: `/blog/guia/${plan.slug || 'slug'}` }
        ];
        setInternalLinks(linksPlan);

        alert("Estratégia do Cluster gerada via OpenAI com sucesso! Verifique a estrutura e os artigos pilares e secundários sugeridos abaixo para salvá-lo.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao arquitetar cluster com IA: ${err.message}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Submit & Save Cluster structure
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      showFeedback('error', "Por favor preencha pelo menos o Título e o Slug para o Cluster.");
      return;
    }

    setActionLoading(true);
    try {
      const payload: Partial<BlogCluster> = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        mainKeyword: mainKeyword.trim(),
        secondaryKeywords,
        pillarPostId,
        clusterPostIds,
        relatedCategoryIds,
        relatedProductIds,
        internalLinks,
        status,
        priority: Number(priority) || 1
      };

      if (isNew) {
        const newId = await blogService.createCluster(payload);
        
        // Update all associated posts to point to this cluster
        const updatePostsTasks = [];
        if (pillarPostId) {
          updatePostsTasks.push(blogService.savePost(pillarPostId, {
            ...posts.find(p => p.id === pillarPostId)!,
            clusterId: newId,
            clusterType: 'pillar'
          } as Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>));
        }
        for (const clusterPostId of clusterPostIds) {
          updatePostsTasks.push(blogService.savePost(clusterPostId, {
            ...posts.find(p => p.id === clusterPostId)!,
            clusterId: newId,
            clusterType: 'cluster'
          } as Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>));
        }
        await Promise.all(updatePostsTasks);

        showFeedback('success', "Parabéns! Novo Cluster SEO de conteúdo registrado com sucesso.");
      } else if (isEdit && id) {
        await blogService.updateCluster(id, payload);

        // Update all associated posts in reference to this cluster
        const updatePostsTasks = [];
        if (pillarPostId) {
          updatePostsTasks.push(blogService.savePost(pillarPostId, {
            ...posts.find(p => p.id === pillarPostId)!,
            clusterId: id,
            clusterType: 'pillar'
          } as Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>));
        }
        for (const clusterPostId of clusterPostIds) {
          updatePostsTasks.push(blogService.savePost(clusterPostId, {
            ...posts.find(p => p.id === clusterPostId)!,
            clusterId: id,
            clusterType: 'cluster'
          } as Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>));
        }
        await Promise.all(updatePostsTasks);

        showFeedback('success', "Configuração do Cluster SEO atualizada com sucesso.");
      }
      resetForm();
      navigate("/admin/blog/clusters");
    } catch (err: any) {
      console.error(err);
      showFeedback('error', `Falha ao salvar cluster: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle post selector changes to automatically assign types
  const handleTogglePostInCluster = (postId: string) => {
    if (clusterPostIds.includes(postId)) {
      setClusterPostIds(clusterPostIds.filter(id => id !== postId));
    } else {
      if (postId === pillarPostId) {
        setPillarPostId(""); // Free from pillar if added as child
      }
      setClusterPostIds([...clusterPostIds, postId]);
    }
  };

  const currentScore = calculateScore();

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-805 border-t-purple-600 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500">
          Sincronizando Clusters SEO & Catálogos...
        </p>
      </div>
    );
  }

  // NEW & EDIT FORM VIEW
  if (isNew || isEdit) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
        
        {/* Navigation header */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/admin/blog/clusters")}
              className="p-2 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                <Layers className="text-purple-500" />
                {isNew ? 'Desenhar Cluster SEO' : 'Editar Estrutura de Cluster'}
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                Organização semântica e fortalecimento de autoridade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-850 px-4 py-2 rounded-2xl">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Score de Qualidade Cluster:</span>
            <div className={`text-base font-black uppercase flex items-center gap-1.5 ${
              currentScore < 45 ? 'text-red-400' : currentScore < 75 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              <Sparkles className="w-4 h-4 animate-pulse" />
              {currentScore}%
            </div>
          </div>
        </div>

        {/* AI Generator Suggestion Widget (Only in NEW Mode) */}
        {isNew && (
          <div className="p-6 bg-gradient-to-r from-purple-950/20 to-pink-950/20 border border-purple-900/40 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-400 animate-pulse" size={20} />
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Projeto Temático Inteligente via OpenAI</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Digite o nicho ou produto que deseja posicionar. A inteligência criará os perfis sugeridos de palavra-chave principal, secundárias, títulos para o post pilar e os subposts e selecionará produtos complementares em estoque automaticamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Exemplo: Lingerie de Renda Vermelha, Cosméticos Sensuais..."
                value={aiTopicInput}
                onChange={(e) => setAiTopicInput(e.target.value)}
                className="flex-1 bg-zinc-900/80 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={triggerAiGenerations}
                disabled={generatingAi}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingAi ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analisando Nicho...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="animate-pulse" />
                    Arquitetar Estratégia
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmitForm} className="space-y-8 text-left">
          
          {/* Main info card */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-880/60 rounded-3xl space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">1. Dados Fundamentais e Palavras-Chave</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Título do Cluster SEO *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Guia Completo da Lingerie de Algodão Confortável"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider font-mono">Slug (URL Amigável) *</label>
                <input
                  type="text"
                  required
                  placeholder="guia-lingerie-algodao-conforto"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Descrição Estratégica / Meta Description</label>
              <textarea
                placeholder="Uma breve apresentação para aparecer nos resultados do Google de Icó-CE..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1">
                  <Sparkles size={12} /> Palavra-chave Principal *
                </label>
                <input
                  type="text"
                  placeholder="Ex: lingerie de algodão"
                  value={mainKeyword}
                  onChange={(e) => setMainKeyword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Palavras-chave Secundárias (LSI)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar palavra..."
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
                    className="flex-1 bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all px-4"
                  >
                    + Adicionar
                  </button>
                </div>
                
                {/* Keywords pill list */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {secondaryKeywords.length === 0 && (
                    <span className="text-[10px] text-zinc-500 italic">Nenhuma palavra-chave secundária vinculada.</span>
                  )}
                  {secondaryKeywords.map((kw, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-zinc-950 border border-purple-950 text-purple-300 font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full">
                      {kw}
                      <button type="button" onClick={() => handleRemoveKeyword(i)} className="text-zinc-500 hover:text-white">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Core Linking & Pillars */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-880/60 rounded-3xl space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">2. Estrutura de Conteúdo (Pillar & Clusters)</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Artigo Pilar Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-emerald-400 tracking-wider font-sans block">Artigo Pilar Principal * (Pillar Content)</label>
                <p className="text-[10px] text-zinc-500 leading-normal mb-1">
                  Este é o guia central de alta autoridade que receberá a maior parte da relevância.
                </p>
                <select
                  value={pillarPostId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPillarPostId(val);
                    // Automatically filter selected from clusters if it was chosen
                    setClusterPostIds(clusterPostIds.filter(id => id !== val));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Selecione o Artigo Principal --</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.status?.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              {/* Artigos Secundários picker list checkboxes */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-black uppercase text-purple-400 tracking-wider block">Artigos Secundários de Órbita (Cluster Content)</label>
                <p className="text-[10px] text-zinc-500 leading-normal mb-1">
                  Artigos específicos que se aprofundam e direcionam o tráfego interno ao Artigo Pilar.
                </p>
                
                <div className="bg-zinc-950 border border-zinc-805 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 flex-1">
                  {posts.filter(p => p.id !== pillarPostId).length === 0 ? (
                    <p className="text-xs text-zinc-650 italic">Nenhum artigo extra disponível.</p>
                  ) : (
                    posts.filter(p => p.id !== pillarPostId).map(p => {
                      const isChecked = clusterPostIds.includes(p.id!);
                      return (
                        <label key={p.id} className="flex items-start gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePostInCluster(p.id!)}
                            className="mt-0.5 rounded border-zinc-800 bg-zinc-900 text-purple-600 focus:ring-0 focus:ring-offset-0"
                          />
                          <span className="truncate">{p.title}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Ordering of Secondary Articles inside Cluster */}
            {clusterPostIds.length > 0 && (
              <div className="p-4 bg-zinc-950 border border-zinc-90 w-full rounded-2xl space-y-3">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">3. Configurar Ordem Temática / Prioridade de Leitura</span>
                <p className="text-[10px] text-zinc-500">
                  Defina a ordem estratégica em que as postagens satélites serão exibidas na trilha sequencial de Icó.
                </p>
                <div className="space-y-1.5">
                  {clusterPostIds.map((pId, index) => {
                    const postMatch = posts.find(p => p.id === pId);
                    return (
                      <div key={pId} className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl text-xs">
                        <span className="font-semibold text-zinc-200 truncate pr-4">
                          {index + 1}. {postMatch?.title || "Artigo Desconhecido"}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => movePostInList(index, 'up')}
                            disabled={index === 0}
                            className="p-1 px-2 border border-zinc-805 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all disabled:opacity-30"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePostInList(index, 'down')}
                            disabled={index === clusterPostIds.length - 1}
                            className="p-1 px-2 border border-zinc-805 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all disabled:opacity-30"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Related Collections and Catalog Integrations */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-880/60 rounded-3xl space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">4. Sinergia com Loja Principal (Categorias & Produtos)</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Categories Links Selector */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Categorias Relacionadas do Catálogo</label>
                <p className="text-[10px] text-zinc-500 leading-normal mb-1">
                  Quais seções de lingerie ou cosméticos herdarão links diretos do cluster de SEO?
                </p>
                <div className="bg-zinc-950 border border-zinc-805 rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 flex-1">
                  {categories.length === 0 ? (
                    <span className="text-xs text-zinc-650 italic">Carregando seções da boutique...</span>
                  ) : (
                    categories.map(cat => (
                      <label key={cat.id} className="flex items-start gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={relatedCategoryIds.includes(cat.id!)}
                          onChange={() => {
                            if (relatedCategoryIds.includes(cat.id!)) {
                              setRelatedCategoryIds(relatedCategoryIds.filter(id => id !== cat.id));
                            } else {
                              setRelatedCategoryIds([...relatedCategoryIds, cat.id!]);
                            }
                          }}
                          className="mt-0.5 rounded border-zinc-800 bg-zinc-900 text-purple-600 focus:ring-0"
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Products links multi check box */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Produtos Comerciais Relacionados</label>
                <p className="text-[10px] text-zinc-500 leading-normal mb-1">
                  Produtos que serão sugeridos para compra nos artigos associados para conversão de vendas.
                </p>
                <div className="bg-zinc-950 border border-zinc-805 rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 flex-1">
                  {storeProducts.length === 0 ? (
                    <span className="text-xs text-zinc-650 italic">Carregando catálogo...</span>
                  ) : (
                    storeProducts.map(prod => (
                      <label key={prod.id} className="flex items-start gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={relatedProductIds.includes(prod.id!)}
                          onChange={() => {
                            if (relatedProductIds.includes(prod.id!)) {
                              setRelatedProductIds(relatedProductIds.filter(id => id !== prod.id));
                            } else {
                              setRelatedProductIds([...relatedProductIds, prod.id!]);
                            }
                          }}
                          className="mt-0.5 rounded border-zinc-800 bg-zinc-900 text-purple-600 focus:ring-0"
                        />
                        <span className="truncate">{prod.name} (R${Number(prod.price || 0).toFixed(2)})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Link mapping lists */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-880/60 rounded-3xl space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">5. Mapeamento de Links Internos Adicionais</h3>
            
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Texto do Anchor Link (ex: Compre Conforto Inteligente)"
                  value={newLinkText}
                  onChange={(e) => setNewLinkText(e.target.value)}
                  className="bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="URL Relativa ou Absoluta (ex: /catalogo?tag=algodao)"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddInternalLink}
                    className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-xs uppercase tracking-wider px-4 rounded-xl transition-all"
                  >
                    + Vincular
                  </button>
                </div>
              </div>

              {/* Linked Anchor List */}
              <div className="space-y-2 mt-3">
                {internalLinks.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 italic">Nenhum anchor link mapeado para o footer do cluster.</p>
                ) : (
                  internalLinks.map((link, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-[11px]">
                      <span className="text-zinc-300">
                        <strong className="text-indigo-400">{link.text}</strong> ➔ <span className="text-zinc-500 font-mono italic">{link.url}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveInternalLink(i)}
                        className="p-1 text-zinc-505 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-zinc-850/50">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Estado de Ativação</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                    <input
                      type="radio"
                      name="cluster_status"
                      checked={status === 'active'}
                      onChange={() => setStatus('active')}
                      className="border-zinc-800 bg-zinc-950 text-purple-650 focus:ring-0 checked:bg-purple-650"
                    />
                    Ativar Cluster (Visível)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                    <input
                      type="radio"
                      name="cluster_status"
                      checked={status === 'draft'}
                      onChange={() => setStatus('draft')}
                      className="border-zinc-800 bg-zinc-950 text-purple-650 focus:ring-0 checked:bg-purple-650"
                    />
                    Rascunho (Oculto)
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Prioridade de Exibição / Peso</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 1)}
                  className="w-24 bg-zinc-950 border border-zinc-805 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

          </div>

          {/* Form Actions footer */}
          <div className="flex justify-end gap-3 sticky bottom-4 z-10 bg-zinc-950/80 backdrop-blur p-4 rounded-2xl border border-zinc-900">
            <button
              type="button"
              onClick={() => navigate("/admin/blog/clusters")}
              disabled={actionLoading}
              className="px-6 py-2.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="bg-purple-650 hover:bg-purple-600 text-white font-extrabold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando Estrutura...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Salvar Cluster SEO
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    );
  }

  // STANDARD LIST VIEW
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-80 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
            <Layers className="text-purple-500" />
            Clusters de Relevância SEO
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Reúna páginas de alta relevância sob tópicos estruturados para potencializar seu ranqueamento orgânico no Google.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/admin/blog"
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all"
          >
            <ArrowLeft size={14} /> Voltar ao Hub
          </Link>
          <Link
            to="/admin/blog/clusters/novo"
            className="flex items-center gap-2 bg-purple-650 hover:bg-purple-600 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.25)]"
          >
            <Plus size={14} /> Criar Cluster Inteligente
          </Link>
        </div>
      </div>

      {/* Floating Notifications */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border text-left ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400' 
            : 'bg-red-950/20 border-red-500/25 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="text-xs font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* Overview stats layout */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
        <div className="p-4 bg-zinc-900/60 border border-zinc-880/50 rounded-2xl">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Clusters Definidos</span>
          <span className="text-3xl font-black text-white mt-1 block">{clusters.length}</span>
          <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Nicho de lingerie íntima</span>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-880/50 rounded-2xl">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block font-sans">Artigos Pilares</span>
          <span className="text-3xl font-black text-emerald-400 mt-1 block">
            {posts.filter(p => p.clusterType === 'pillar' && p.status === 'publicado').length}
          </span>
          <span className="text-[9px] text-emerald-500 uppercase mt-0.5 block">Alta autoridade integrada</span>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-880/50 rounded-2xl">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block font-mono">Posts Sem Cluster (Órfãos)</span>
          <span className="text-3xl font-black text-amber-400 mt-1 block">
            {posts.filter(p => !p.clusterId && p.status === 'publicado').length}
          </span>
          <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Prontos para vincular</span>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-880/50 rounded-2xl">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Exibição de Leads</span>
          <span className="text-3xl font-black text-purple-400 mt-1 block">
            {clusters.filter(c => calculateScore() > 80).length}
          </span>
          <span className="text-[9px] text-purple-500 uppercase mt-0.5 block">Nível Superior de SEO</span>
        </div>
      </div>

      {/* Clusters Table List */}
      {clusters.length === 0 ? (
        <div className="text-center py-20 border border-zinc-850 rounded-2xl bg-zinc-900/40 p-10 space-y-4">
          <Layers size={45} className="text-zinc-700 mx-auto" />
          <h2 className="text-zinc-300 text-sm font-bold uppercase tracking-wide">Nenhum Cluster SEO Criado Ainda</h2>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            Agrupe seus artigos em torno de lingereies, cosméticos sensuais ou dicas de relacionamento sob uma estrutura estratégica do Google.
          </p>
          <button
            onClick={() => navigate("/admin/blog/clusters/novo")}
            className="inline-flex items-center gap-1.5 text-xs font-black text-purple-400 hover:text-purple-300 hover:underline"
          >
            + Crie seu primeiro cluster temático
          </button>
        </div>
      ) : (
        <div className="border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-900/40 text-left">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-85 bg-zinc-900/80 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <th className="py-4 px-6">Cluster & Slug</th>
                  <th className="py-4 px-6">Palavra Chave</th>
                  <th className="py-4 px-6 text-center">Estrutura (Posts/Prods/Cats)</th>
                  <th className="py-4 px-6 text-center">Score de Qualidade</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/40 text-xs">
                {clusters.map((c) => {
                  const score = getClusterScore(c);
                  const pillarPost = posts.find(p => p.id === c.pillarPostId);
                  const countPosts = (c.clusterPostIds || []).length + (c.pillarPostId ? 1 : 0);
                  const countProds = (c.relatedProductIds || []).length;
                  const countCats = (c.relatedCategoryIds || []).length;

                  return (
                    <tr key={c.id} className="hover:bg-zinc-850/10 transition-all">
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className="font-extrabold text-sm text-zinc-100 hover:text-purple-400 cursor-pointer block" onClick={() => navigate(`/admin/blog/clusters/editar/${c.id}`)}>
                            {c.title}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 block">
                            /blog/guia/{c.slug}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-purple-350">
                        {c.mainKeyword || "Não definida"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center items-center gap-4 text-zinc-400">
                          <span className="flex items-center gap-1 text-[11px]" title="Artigos Vinculados">
                            <FileText size={12} className="text-zinc-500" />
                            {countPosts}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]" title="Produtos do Catálogo">
                            <ShoppingBag size={12} className="text-zinc-500" />
                            {countProds}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]" title="Coleções Vinculadas">
                            <Folder size={12} className="text-zinc-500" />
                            {countCats}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center">
                          <span className={`inline-block font-black px-3 py-1 rounded-2xl text-[10px] uppercase tracking-wider ${
                            score < 45 ? 'bg-red-950/30 text-red-400 border border-red-900/40' : score < 75 ? 'bg-amber-950/30 text-amber-400 border border-amber-900/40' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40'
                          }`}>
                            {score}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => toggleClusterState(c)}
                          className={`inline-block text-[9.5px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full transition-all border ${
                            c.status === 'active' 
                              ? 'bg-emerald-950/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-950/20' 
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          {c.status === 'active' ? '● Ativo' : '○ Rascunho'}
                        </button>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 pr-1">
                          <a
                            href={`/blog/guia/${c.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border border-zinc-850 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-white transition-all shadow-sm"
                            title="Visualizar Landing Page pública de Icó"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            onClick={() => navigate(`/admin/blog/clusters/editar/${c.id}`)}
                            className="p-2 border border-zinc-850 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-white transition-all"
                            title="Editar Estrutura"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleRemoveCluster(c.id!, c.title)}
                            className="p-2 border border-zinc-850 hover:bg-zinc-850/50 hover:border-red-900/40 rounded-xl text-zinc-450 hover:text-red-400 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
