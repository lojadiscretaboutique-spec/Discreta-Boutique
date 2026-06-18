import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  Eye, 
  ListOrdered, 
  MessageSquare, 
  ShoppingBag, 
  ChevronRight, 
  FileText, 
  X, 
  Check, 
  Globe, 
  Coins, 
  RefreshCw,
  FolderOpen,
  Bold,
  Info,
  Calendar,
  AlertHorizontal,
  Layout,
  BookOpen
} from "lucide-react";
import { blogService, BlogPost, BlogCategory } from "../../../services/blogService";
import { productService, Product } from "../../../services/productService";
import { auth } from "../../../lib/auth";

export function AdminBlogAI() {
  const navigate = useNavigate();
  
  // Data loading states
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form input states
  const [tema, setTema] = useState("");
  const [palavraChavePrincipal, setPalavraChavePrincipal] = useState("");
  const [palavrasChaveSecundariasStr, setPalavrasChaveSecundariasStr] = useState("");
  const [objetivo, setObjetivo] = useState("SEO & Tráfego Orgânico");
  const [publicoIn, setPublicoIn] = useState("Mulheres sofisticadas e casais que buscam elegância e bem-estar íntimo");
  const [tomVoz, setTomVoz] = useState("elegante, empoderado, sofisticado, romântico e educativo");
  const [palavras, setPalavras] = useState(900);
  const [categoryId, setCategoryId] = useState("");
  const [tagsStr, setTagsStr] = useState("lingerie, bem-estar, auto-estima, dicas de relacionamento");
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [sugerirProdutos, setSugerirProdutos] = useState(true);
  const [faqRequested, setFaqRequested] = useState(true);
  const [ctaRequested, setCtaRequested] = useState(true);
  const [seoLocal, setSeoLocal] = useState(true);
  
  // Product filter
  const [productFilter, setProductFilter] = useState("");

  // AI execution states
  const [generating, setGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [errorText, setErrorText] = useState("");
  
  // Result state
  const [generatedPayload, setGeneratedPayload] = useState<any | null>(null);
  
  // Review modifications (allows user to tune AI response before committing)
  const [finalTitle, setFinalTitle] = useState("");
  const [finalSubtitle, setFinalSubtitle] = useState("");
  const [finalSlug, setFinalSlug] = useState("");
  const [finalSummary, setFinalSummary] = useState("");
  const [finalMetaTitle, setFinalMetaTitle] = useState("");
  const [finalMetaDescription, setFinalMetaDescription] = useState("");
  const [finalCoverImage, setFinalCoverImage] = useState("");
  const [finalCoverAlt, setFinalCoverAlt] = useState("");
  const [finalCategory, setFinalCategory] = useState("");
  const [finalTags, setFinalTags] = useState<string[]>([]);
  const [savingAction, setSavingAction] = useState(false);

  // Pre-seed "Sugestões Rápidas" for intuitive onboarding
  const deSugestoes = [
    {
      label: "Guia de Lingerie Especial",
      tema: "Como escolher a lingerie vermelha perfeita para elevar a autoestima e autoconfiança",
      principal: "lingerie vermelha",
      secundarias: "lingerie para autoestima, lingerie de renda, lingerie vermelha em Icó",
      tags: "lingerie, empoderamento, renda vermelhada, boudoir"
    },
    {
      label: "Vibrador de Casal",
      tema: "Benefícios do vibrador de casal para reaquecer e intensificar a cumplicidade na rotina",
      principal: "vibrador de casal",
      secundarias: "relação de casal, brinquedos sensuais, dicas de sexualidade, Discreta Boutique",
      tags: "bem-estar intimo, vibradores, casais, intimidade"
    },
    {
      label: "Primeiro Vibrador",
      tema: "Primeiro vibrador: guia essencial, discreto e sem julgamentos para a primeira escolha da mulher moderna",
      principal: "primeiro vibrador",
      secundarias: "vibrador feminino, auto-descoberta, bem-estar íntimo, entrega discreta",
      tags: "saude intima, autocuidado, sexualidade, auto-amor"
    }
  ];

  useEffect(() => {
    async function init() {
      try {
        const [cats, prods] = await Promise.all([
          blogService.listCategories(),
          productService.listProducts()
        ]);
        setCategories(cats);
        // Active catalog items
        setCatalogProducts(prods.filter(p => p.active !== false && p.stock > 0));
        
        if (cats.length > 0) {
          setCategoryId(cats[0].id || "");
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de catálogo:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    init();
  }, []);

  const selectSuggestion = (sug: typeof deSugestoes[0]) => {
    setTema(sug.tema);
    setPalavraChavePrincipal(sug.principal);
    setPalavrasChaveSecundariasStr(sug.secundarias);
    setTagsStr(sug.tags);
  };

  const handleToggleProduct = (id: string) => {
    if (produtosSelecionados.includes(id)) {
      setProdutosSelecionados(produtosSelecionados.filter(pId => pId !== id));
    } else {
      setProdutosSelecionados([...produtosSelecionados, id]);
    }
  };

  const handleGenerate = async () => {
    if (!tema.trim() || !palavraChavePrincipal.trim() || !categoryId) {
      setErrorText("Por favor, preencha o Tema do Artigo, a Palavra-Chave Principal e selecione uma Categoria.");
      return;
    }
    
    setErrorText("");
    setGenerating(true);
    setLoadingText("Conectando-se ao cérebro de copywriter inteligente...");

    const intervals = [
      "Iniciando servidores OpenAI...",
      "Estruturando parágrafos elegantes e discretos...",
      "Buscando correspondência de produtos do estoque em Icó-CE...",
      "Formatando blocos estruturados (Fase 2)...",
      "Otimizando Meta titles e descriptions para rankeamento orgânico...",
      "Processando verificação de qualidade local e conformidade de visual..."
    ];
    let intervalIndex = 0;
    const textTimer = setInterval(() => {
      if (intervalIndex < intervals.length) {
        setLoadingText(intervals[intervalIndex]);
        intervalIndex++;
      }
    }, 4500);

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) {
        throw new Error("Você não está autenticado no painel. Faça login novamente.");
      }

      const postBody = {
        tema,
        palavraChavePrincipal,
        palavrasChaveSecundarias: palavrasChaveSecundariasStr.split(",").map(s => s.trim()).filter(Boolean),
        objetivo,
        publico: publicoIn,
        tomVoz,
        palavras: Number(palavras),
        categoria: categories.find(c => c.id === categoryId)?.name || "Geral",
        tags: tagsStr.split(",").map(s => s.trim()).filter(Boolean),
        produtosSelecionados,
        sugerirProdutos,
        faqRequested,
        ctaRequested,
        seoLocal
      };

      const res = await fetch("/api/admin/blog/generate-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(postBody)
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossível conectar ao serviço operacional OpenAI.");
      }

      const generatedObj = data.post;
      setGeneratedPayload(generatedObj);

      // Pre-populate modification fields
      setFinalTitle(generatedObj.titulo || "");
      setFinalSubtitle(generatedObj.subtitulo || "");
      setFinalSlug(generatedObj.slug || "");
      setFinalSummary(generatedObj.resumo || "");
      setFinalMetaTitle(generatedObj.metaTitle || "");
      setFinalMetaDescription(generatedObj.metaDescription || "");
      setFinalCoverImage(generatedObj.coverImage || "https://images.unsplash.com/photo-1515688594390-b649af70d282?q=80&w=1200");
      setFinalCoverAlt(generatedObj.coverImageAlt || "");
      setFinalCategory(generatedObj.categoriaSugerida || "");
      setFinalTags(generatedObj.tags || []);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Erro desconhecido na geração com IA. Verifique as variáveis de ambiente.");
    } finally {
      clearInterval(textTimer);
      setGenerating(false);
    }
  };

  const handleSaveToDatabase = async (isPublish: boolean) => {
    setSavingAction(true);
    try {
      if (!finalTitle.trim() || !finalSlug.trim()) {
        alert("Preencha o título e slug legíveis antes de salvar.");
        return;
      }

      // Reformat faqs if provided
      const customFaqs = generatedPayload.faqs || [];

      // Structure post based on metadata and blocks
      const newPost: Partial<BlogPost> = {
        title: finalTitle,
        subtitle: finalSubtitle,
        slug: finalSlug,
        summary: finalSummary,
        content: generatedPayload.content || "", // Fallback markdown content
        contentBlocks: generatedPayload.contentBlocks || [], // Phase 2 blocks
        categoryId: categoryId,
        tags: finalTags,
        coverImage: finalCoverImage,
        status: isPublish ? "publicado" : "rascunho",
        featured: false,
        readingTime: Math.max(3, Math.ceil((generatedPayload.content || "").split(/\s+/).length / 200)),
        seo: {
          title: finalMetaTitle,
          description: finalMetaDescription,
          keywords: palavraChavePrincipal + (palavrasChaveSecundariasStr ? ", " + palavrasChaveSecundariasStr : ""),
          ogImage: finalCoverImage,
          faq: customFaqs.map((f: any) => ({ question: f.question, answer: f.answer }))
        },
        publishedAt: isPublish ? new Date().toISOString() : null,
        scheduledAt: null,
        commentsCount: 0,
        viewsCount: 0,
        likesCount: 0,
        authorId: auth.currentUser?.uid || "admin",
        authorName: auth.currentUser?.displayName || "Discreta Boutique"
      };

      await blogService.savePost(undefined, newPost as BlogPost);
      alert(isPublish ? "Artigo salvo e PUBLICADO com sucesso no site!" : "Artigo salvo como rascunho com sucesso para revisão posterior.");
      navigate("/admin/blog");
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar artigo gerado: ${err.message}`);
    } finally {
      setSavingAction(false);
    }
  };

  // real-time client-side SEO checklist validation
  const runSeoChecklist = () => {
    if (!generatedPayload) return [];
    
    const bodyStr = (generatedPayload.content || "").toLowerCase();
    const lcKeyword = palavraChavePrincipal.toLowerCase();
    const lcTitle = finalTitle.toLowerCase();
    const lcMetaTitle = finalMetaTitle.toLowerCase();
    const lcMetaDesc = finalMetaDescription.toLowerCase();

    // Check conditions
    const wordCount = bodyStr.split(/\s+/).filter(Boolean).length;
    
    // Count of H2s and H3s
    const h2Count = (generatedPayload.contentBlocks || []).filter((b: any) => b.type === "heading" && b.level === 2).length;
    const h3Count = (generatedPayload.contentBlocks || []).filter((b: any) => b.type === "heading" && b.level === 3).length;

    const checklist = [
      {
        text: `Palavra-chave principal ("${palavraChavePrincipal}") no título`,
        pass: lcTitle.includes(lcKeyword),
        points: 15
      },
      {
        text: `Palavra-chave principal no Meta Title`,
        pass: lcMetaTitle.includes(lcKeyword),
        points: 15
      },
      {
        text: `Palavra-chave principal na Meta Description`,
        pass: lcMetaDesc.includes(lcKeyword),
        points: 15
      },
      {
        text: "Tamanho do artigo superior a 600 palavras",
        pass: wordCount >= 600,
        points: 20
      },
      {
        text: `Presença de pelo menos 2 cabeçalhos H2 estruturados`,
        pass: h2Count >= 2,
        points: 10
      },
      {
        text: "Inclusão de imagem com descrição Alt SEO configurada",
        pass: !!finalCoverAlt.trim(),
        points: 10
      },
      {
        text: "Adição de FAQ respondendo dúvidas diretas",
        pass: (generatedPayload.faqs || []).length > 0,
        points: 10
      },
      {
        text: "Grelha ou links de produtos correspondentes",
        pass: (generatedPayload.suggestedProductIds || []).length > 0 || (generatedPayload.relatedProducts || []).length > 0,
        points: 5
      }
    ];

    return checklist;
  };

  const getSeoHeuristicScore = () => {
    const list = runSeoChecklist();
    if (list.length === 0) return 0;
    const scored = list.reduce((acc, curr) => acc + (curr.pass ? curr.points : 0), 0);
    return scored;
  };

  const filteredProdOptions = catalogProducts.filter(p => 
    p.name.toLowerCase().includes(productFilter.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      
      {/* Dynamic pulse background during generation */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 border border-purple-500/30 rounded-full animate-ping" />
            <div className="absolute w-20 h-20 border border-pink-500/20 rounded-full animate-pulse" />
            <div className="p-6 bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl border border-purple-400/25 shadow-[0_0_30px_rgba(147,51,234,0.4)]">
              <Sparkles className="w-10 h-10 text-pink-300 animate-spin" />
            </div>
          </div>
          <div className="text-center max-w-md px-6 space-y-2">
            <h2 className="text-xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Geração de Artigo com IA
            </h2>
            <p className="text-xs text-zinc-400 tracking-wide font-extrabold transition-all uppercase animate-pulse">
              {loadingText}...
            </p>
            <div className="w-48 h-1 bg-zinc-900 mx-auto rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-[shimmer_2s_infinite] w-2/3" />
            </div>
            <p className="text-[10px] text-zinc-600 uppercase font-bold mt-4">Essa operação custará ~0.015 créditos de processamento.</p>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
              <Sparkles className="text-purple-500" />
              Redação de Blog com IA
            </h1>
            <p className="text-xs text-zinc-400 mt-1 uppercase font-bold tracking-wider">
              Gere artigos profissionais perfeitos para os bots do Google e elegantes para as suas clientes.
            </p>
          </div>
        </div>
      </div>

      {errorText && (
        <div className="p-4 rounded-xl flex items-center gap-3 border bg-red-950/20 border-red-500/25 text-red-400">
          <AlertTriangle size={18} />
          <span className="text-xs font-semibold">{errorText}</span>
        </div>
      )}

      {/* Main Layout split into Forms and Active Review Results */}
      {!generatedPayload ? (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Form input sections */}
          <div className="lg:col-span-2 p-6 md:p-8 bg-zinc-900/30 border border-zinc-850 rounded-3xl space-y-6">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-4">
              <Sliders size={18} className="text-red-500" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Configurações de Prompt & SEO</h3>
            </div>

            {/* Quick pre-seeded targets */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Ideias Rápidas de Artigo:</span>
              <div className="flex flex-wrap gap-2">
                {deSugestoes.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSuggestion(sug)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-purple-500 hover:text-white transition-all"
                  >
                    ✦ {sug.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Tema / Linha Editorial */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Tema principal do Artigo:</label>
                <input
                  type="text"
                  placeholder="Ex: Como a lingerie de renda vermelha atua no empoderamento feminino moderno"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all font-medium"
                />
              </div>

              {/* Keyword principal */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Palavra-Chave Principal (Altamente recomendada):</label>
                <input
                  type="text"
                  placeholder="Ex: lingerie vermelha"
                  value={palavraChavePrincipal}
                  onChange={(e) => setPalavraChavePrincipal(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                />
              </div>

              {/* Keywords secundarias */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Palavras-Chave Secundárias (Separe por vírgula):</label>
                <input
                  type="text"
                  placeholder="Ex: empoderamento feminino, sensualidade, lingerie de renda"
                  value={palavrasChaveSecundariasStr}
                  onChange={(e) => setPalavrasChaveSecundariasStr(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>

              {/* Objetivos */}
              <div className="space-y-1.5 font-sans">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Objetivo Editorial do Post:</label>
                <select
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                >
                  <option value="SEO & Tráfego Orgânico">SEO & Tráfego Orgânico</option>
                  <option value="Conversão & Venda e Indicação de Produtos">Conversão & Venda e Indicação de Produtos</option>
                  <option value="Educativo & Empoderamento Íntimo">Educativo & Empoderamento Íntimo</option>
                  <option value="Lançamento e Divulgação de Lingerie/Cosmético">Lançamento e Divulgação de Lingerie/Cosmético</option>
                </select>
              </div>

              {/* Tom de Voz */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Tom de Voz das Mensagens:</label>
                <select
                  value={tomVoz}
                  onChange={(e) => setTomVoz(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                >
                  <option value="elegante, sofisticado, feminino e romântico">Elegante & Sofisticado (Feminilidade)</option>
                  <option value="empoderado, sensual e confiante">Empoderado & Sensual (Fortalecimento)</option>
                  <option value="discreto, clínico e instrutivo">Discreto & Educativo (Tabus e Saúde)</option>
                  <option value="descontraído, moderno e focado em bem-estar">Descontraído & Focado em Bem-Estar</option>
                </select>
              </div>

              {/* Quantidade Estimada de Palavras */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Volume Estimado de Palavras:</label>
                <select
                  value={palavras}
                  onChange={(e) => setPalavras(Number(e.target.value))}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                >
                  <option value="600">600 palavras (Curto / Dinâmico)</option>
                  <option value="900">900 palavras (Otimizado padrão para SEO)</option>
                  <option value="1200">1200 palavras (Guia Intermediário)</option>
                  <option value="1600">1600 palavras (Artigo de Alta Densidade / Autoritativo)</option>
                </select>
              </div>

              {/* Categorias */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Categoria Selecionada:</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                >
                  {loadingConfig ? (
                    <option value="">Carregando categorias...</option>
                  ) : categories.length === 0 ? (
                    <option value="">Nenhuma categoria cadastrada</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Tags extras */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Tags para Listagem (Separe por vírgula):</label>
                <input
                  type="text"
                  placeholder="Ex: lingeries, guias, casal, seducao"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>

              {/* Publico alvo */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Público-Alvo Específico:</label>
                <input
                  type="text"
                  value={publicoIn}
                  onChange={(e) => setPublicoIn(e.target.value)}
                  placeholder="Ex: Mulheres contemporâneas buscando elevar intimidade"
                  className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
            </div>

            {/* Switch sliders */}
            <div className="p-4 border border-zinc-850 bg-zinc-950 rounded-2xl gap-4 grid sm:grid-cols-2 md:grid-cols-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={faqRequested}
                  onChange={(e) => setFaqRequested(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-zinc-900 border-zinc-850 rounded focus:ring-red-500"
                />
                <span className="text-[10px] text-zinc-300 font-extrabold uppercase">Incluir FAQ Otimizada</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ctaRequested}
                  onChange={(e) => setCtaRequested(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-zinc-900 border-zinc-850 rounded focus:ring-red-500"
                />
                <span className="text-[10px] text-zinc-300 font-extrabold uppercase">Incluir CTA Botões</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoLocal}
                  onChange={(e) => setSeoLocal(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-zinc-900 border-zinc-850 rounded focus:ring-red-500"
                />
                <span className="text-[10px] text-zinc-300 font-extrabold uppercase">SEO Local (Icó-CE)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sugerirProdutos}
                  onChange={(e) => setSugerirProdutos(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-zinc-900 border-zinc-850 rounded focus:ring-red-500"
                />
                <span className="text-[10px] text-zinc-300 font-extrabold uppercase">Inserir Produtos</span>
              </label>
            </div>

            {/* Sparkle submission */}
            <button
              onClick={handleGenerate}
              type="button"
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 active:scale-[0.99] text-white font-extrabold uppercase text-xs tracking-widest flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all"
            >
              <Sparkles size={16} className="animate-pulse" /> Redigir Artigo Inteligente com a OpenAI
            </button>
          </div>

          {/* Catalog items panel */}
          <div className="p-6 bg-zinc-900/30 border border-zinc-850 rounded-3xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-pink-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Estoque Relevante</h3>
              </div>
              <span className="text-[10px] bg-zinc-850 px-2.5 py-1 rounded-full text-zinc-400 font-bold">
                {produtosSelecionados.length} fixados
              </span>
            </div>
            
            <p className="text-[10.5px] text-zinc-400 leading-normal">
              Fixe produtos específicos para instruir a OpenAI a recomendá-los no final do texto em uma grade. Os outros serão auto-sugeridos caso a opção esteja ativa.
            </p>

            {/* Filter Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar produtos ativos..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white font-medium focus:outline-none focus:border-purple-600"
              />
              {productFilter && (
                <button 
                  onClick={() => setProductFilter("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Products container */}
            <div className="max-h-72 overflow-y-auto space-y-2 border border-zinc-850 bg-zinc-950/40 p-2.5 rounded-2xl">
              {loadingConfig ? (
                <div className="text-center py-6 text-[10px] uppercase font-bold text-zinc-500 animate-pulse">Buscando do Firestore...</div>
              ) : filteredProdOptions.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500">Nenhum produto correspondente.</div>
              ) : (
                filteredProdOptions.map((prod) => (
                  <div 
                    key={prod.id}
                    onClick={() => handleToggleProduct(prod.id!)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-zinc-900/50 transition-all ${
                      produtosSelecionados.includes(prod.id!) 
                        ? 'bg-purple-950/20 border-purple-500/40' 
                        : 'border-zinc-850 bg-zinc-900/10'
                    }`}
                  >
                    <div className="space-y-0.5 max-w-[85%]">
                      <p className="text-[11.5px] font-extrabold text-zinc-200 truncate">{prod.name}</p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        Preço: R$ {prod.price.toFixed(2)} | Qtd: {prod.stock}
                      </p>
                    </div>
                    {produtosSelecionados.includes(prod.id!) ? (
                      <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                        <Check size={11} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-800" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Dynamic Review Screen and metadata tuning */
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Real-time SEO checklist score card and tuning */}
          <div className="space-y-6">
            
            {/* SEO Meter */}
            <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-3xl space-y-4">
              <span className="text-[9px] uppercase font-black text-zinc-500 tracking-widest block">Auditores de Qualidade:</span>
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  <CheckSquare size={16} className="text-emerald-400" />
                  Score de SEO Geral
                </h4>
                <div className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center gap-1">
                  <span className={`text-base font-black ${
                    getSeoHeuristicScore() >= 80 ? 'text-emerald-400' : getSeoHeuristicScore() >= 55 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {getSeoHeuristicScore()}
                  </span>
                  <span className="text-xs text-zinc-500">/ 100</span>
                </div>
              </div>

              {/* Graphical score line */}
              <div className="h-2 bg-zinc-950 border border-zinc-850/60 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r transition-all duration-1000 ${
                    getSeoHeuristicScore() >= 80 ? 'from-emerald-600 to-green-500' : 'from-amber-600 to-amber-400'
                  }`}
                  style={{ width: `${getSeoHeuristicScore()}%` }}
                />
              </div>

              {/* Checklist pass fail */}
              <div className="space-y-4 border-t border-zinc-850 pt-4">
                <span className="text-[9.5px] uppercase font-bold text-zinc-400 tracking-wider">Análise de Pontos Essenciais:</span>
                <div className="space-y-2.5">
                  {runSeoChecklist().map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11.5px] text-zinc-300">
                      {item.pass ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center shrink-0 mt-0.5">
                          ×
                        </div>
                      )}
                      <span className={item.pass ? 'text-zinc-200' : 'text-zinc-500 font-medium'}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Editorial checklist */}
            <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-3xl space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Fases do Artigo:</h4>
              <p className="text-[10.5px] text-zinc-400 leading-normal">
                Compatível de forma nativa com a <strong className="text-white">Fase 2 (Blocos Estruturados)</strong>. O robô gerou múltiplos parágrafos, depoimentos em bloco e acordeões interativos perfeitamente separados.
              </p>
              
              <div className="flex gap-2.5 border-t border-zinc-850/60 pt-3">
                <button
                  onClick={() => handleSaveToDatabase(false)}
                  disabled={savingAction}
                  className="flex-1 py-3 text-xs uppercase font-extrabold tracking-widest bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-white rounded-xl active:scale-95 transition-all text-center"
                >
                  Salvar Rascunho
                </button>
                <button
                  onClick={() => handleSaveToDatabase(true)}
                  disabled={savingAction}
                  className="flex-1 py-3 text-xs uppercase font-extrabold tracking-widest bg-gradient-to-r from-emerald-600 to-green-600 hover:opacity-90 text-white rounded-xl active:scale-95 transition-all shadow-md shadow-emerald-900/20 text-center"
                >
                  Publicar Agora
                </button>
              </div>

              <button
                type="button"
                onClick={() => setGeneratedPayload(null)}
                className="w-full py-2.5 text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-white text-center"
              >
                ✕ Descartar e Redigir outro tema
              </button>
            </div>
            
          </div>

          {/* Form Tuning and interactive block rendering */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Metadata edit workspace */}
            <div className="p-6 md:p-8 bg-zinc-900/20 border border-zinc-850 rounded-3xl space-y-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-pink-300 border-b border-zinc-850 pb-3 flex items-center gap-2">
                <Globe size={16} /> Ajustar Atributos Globais (Metadados Otimizados)
              </h3>
              
              <div className="space-y-4 text-xs font-sans">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Título Amigável de SEO:</label>
                  <input
                    type="text"
                    value={finalTitle}
                    onChange={(e) => setFinalTitle(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white font-medium focus:outline-none focus:border-purple-600"
                  />
                </div>

                {/* Subtitle */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Subtítulo de Apoio:</label>
                  <input
                    type="text"
                    value={finalSubtitle}
                    onChange={(e) => setFinalSubtitle(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white font-medium focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Slug */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Link Slug (URL amigável):</label>
                    <input
                      type="text"
                      value={finalSlug}
                      onChange={(e) => setFinalSlug(e.target.value)}
                      className="w-full px-4 py-2.5 text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 font-mono focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  {/* Sugerida CoverImage */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Imagem de destaque (Unsplash Elegante):</label>
                    <input
                      type="text"
                      value={finalCoverImage}
                      onChange={(e) => setFinalCoverImage(e.target.value)}
                      className="w-full px-4 py-2.5 text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 font-mono focus:outline-none"
                    />
                  </div>

                  {/* Alt Text */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Atributo ALT Altamente Recomendável de SEO:</label>
                    <input
                      type="text"
                      value={finalCoverAlt}
                      onChange={(e) => setFinalCoverAlt(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 border-t border-zinc-850 pt-4">
                  
                  {/* Meta Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Meta Title (Google):</label>
                    <input
                      type="text"
                      value={finalMetaTitle}
                      onChange={(e) => setFinalMetaTitle(e.target.value)}
                      maxLength={65}
                      className="w-full px-4 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none font-medium"
                    />
                    <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                      <span>Máximo recomendado: 60 car.</span>
                      <span>{finalMetaTitle.length} car.</span>
                    </div>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Meta Description (Snippet):</label>
                    <textarea
                      value={finalMetaDescription}
                      onChange={(e) => setFinalMetaDescription(e.target.value)}
                      maxLength={160}
                      rows={2}
                      className="w-full px-4 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none leading-normal"
                    />
                    <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                      <span>Máximo recomendado: 152 car.</span>
                      <span>{finalMetaDescription.length} car.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Block Renderer compatibility display */}
            <div className="p-6 md:p-8 bg-zinc-900/20 border border-zinc-850 rounded-3xl space-y-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 border-b border-zinc-850 pb-3 flex items-center gap-2">
                <Layout size={16} /> Blocos Gerados em Sequência (Renderização Fase 2)
              </h3>

              <div className="space-y-4">
                {(generatedPayload.contentBlocks || []).map((block: any, idx: number) => (
                  <div key={block.id || idx} className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 text-left space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-850/60 pb-1.5 mb-1.5">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Bloque: {block.id}</span>
                      <span className="text-[10px] font-black uppercase text-pink-400 bg-pink-950/20 px-2 py-0.5 rounded border border-pink-700/20">
                        {block.type}
                      </span>
                    </div>

                    {/* Rendering indicators based on details */}
                    {block.type === 'heading' && (
                      <h4 className={`font-black uppercase text-white ${
                        block.level === 2 ? 'text-sm font-black' : 'text-xs font-extrabold'
                      }`}>
                        H{block.level}: {block.content}
                      </h4>
                    )}

                    {block.type === 'paragraph' && (
                      <p className="text-xs text-zinc-300 leading-relaxed font-normal">{block.content}</p>
                    )}

                    {block.type === 'quote' && (
                      <div className="pl-3 border-l-2 border-purple-500 italic text-zinc-300 text-xs py-1">
                        "{block.content}" {block.alt && <span className="text-[10px] text-zinc-500 not-italic block mt-1">— {block.alt}</span>}
                      </div>
                    )}

                    {block.type === 'callout' && (
                      <div className={`p-3 rounded-lg text-xs leading-normal font-medium ${
                        block.style === 'warning' ? 'bg-amber-950/20 border border-amber-500/20 text-amber-300' :
                        block.style === 'tip' ? 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-300' :
                        'bg-blue-950/20 border border-blue-500/25 text-blue-300'
                      }`}>
                        <strong>[{block.style?.toUpperCase() || 'INFO'}]</strong> {block.content}
                      </div>
                    )}

                    {block.type === 'faq' && (
                      <div className="bg-zinc-900/60 p-3 rounded-xl space-y-1">
                        <p className="text-xs font-black text-rose-300">P: {block.question}</p>
                        <p className="text-xs text-zinc-400">R: {block.answer}</p>
                      </div>
                    )}

                    {block.type === 'cta' && (
                      <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-300 font-bold">CTA Button</span>
                        <a 
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 text-[10px] font-black uppercase bg-red-650 text-white rounded-lg"
                        >
                          {block.content}
                        </a>
                      </div>
                    )}

                    {block.type === 'product_grid' && (
                      <div className="p-3 bg-zinc-900 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1.5">
                          <ShoppingBag size={11} className="text-purple-500" />
                          Linha de produtos sugeridos:
                        </span>
                        <div className="flex flex-wrap gap-1.5 text-[10.5px] font-mono text-zinc-400">
                          {(block.productIds || []).length > 0 ? (
                            (block.productIds || []).map((id: string) => (
                              <span key={id} className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">ID: {id}</span>
                            ))
                          ) : (
                            <span>Nenhum ID fixado (sugestão automática no runtime)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {block.type === 'conclusion' && (
                      <div className="space-y-1.5 border-t border-zinc-850 pt-1.5">
                        <strong className="text-[10.5px] uppercase font-black text-white">Considerações finais:</strong>
                        <p className="text-xs text-zinc-300 leading-normal">{block.content}</p>
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className="h-px bg-zinc-800 my-1 w-full" />
                    )}

                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
