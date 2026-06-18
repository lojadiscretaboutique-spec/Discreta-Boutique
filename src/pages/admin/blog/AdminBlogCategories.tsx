import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Folder, 
  CheckCircle, 
  AlertTriangle, 
  Edit2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Heart, 
  Flame, 
  Gift, 
  Compass, 
  Feather, 
  Calendar, 
  Award, 
  MapPin, 
  Globe, 
  Palette,
  X
} from "lucide-react";
import { blogService, BlogCategory } from "../../../services/blogService";

// Predefined gorgeous colors for categories
const PRESET_COLORS = [
  { name: "Slate", value: "#64748b" },
  { name: "Rose", value: "#ec4899" },
  { name: "Red", value: "#dc2626" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Fuchsia", value: "#d946ef" },
];

const PRESET_ICONS = [
  { id: "Heart", label: "Coração", icon: Heart },
  { id: "Flame", label: "Fogo / Sensual", icon: Flame },
  { id: "Feather", label: "Pena / Leveza", icon: Feather },
  { id: "Gift", label: "Presente", icon: Gift },
  { id: "Sparkles", label: "Brilhos", icon: Sparkles },
  { id: "Calendar", label: "Calendário", icon: Calendar },
  { id: "Compass", label: "Bússola / Ideias", icon: Compass },
  { id: "Award", label: "Selo / Guia", icon: Award },
  { id: "MapPin", label: "Local / Icó", icon: MapPin },
  { id: "Folder", label: "Pasta Geral", icon: Folder }
];

export function AdminBlogCategories() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Selected category for editing (null means we are in 'Create New' mode)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formColor, setFormColor] = useState("#64748b");
  const [formIcon, setFormIcon] = useState("Folder");
  const [formOrder, setFormOrder] = useState(0);
  const [formStatus, setFormStatus] = useState<'ativa' | 'oculta'>("ativa");
  
  // SEO fields
  const [formSeoTitle, setFormSeoTitle] = useState("");
  const [formSeoDescription, setFormSeoDescription] = useState("");
  const [formKeywords, setFormKeywords] = useState("");

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load categories
      const cats = await blogService.listCategories();
      // Sort by order asc, then name asc
      const sortedCats = [...cats].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setCategories(sortedCats);

      // Load posts to map quantities count
      const posts = await blogService.listPosts(true); // true to include drafts
      const counts: Record<string, number> = {};
      posts.forEach(p => {
        if (p.categoryId) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      });
      setPostCounts(counts);
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao carregar lista de categorias e artigos.");
    } finally {
      setLoading(false);
    }
  }

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  const handleCreateNewClick = () => {
    setEditingId(null);
    setFormName("");
    setFormSlug("");
    setFormShortDesc("");
    setFormDesc("");
    setFormCoverImage("");
    setFormColor("#64748b");
    setFormIcon("Folder");
    setFormOrder(0);
    setFormStatus("ativa");
    setFormSeoTitle("");
    setFormSeoDescription("");
    setFormKeywords("");
  };

  const handleEditClick = (cat: BlogCategory) => {
    setEditingId(cat.id || null);
    setFormName(cat.name || "");
    setFormSlug(cat.slug || "");
    setFormShortDesc(cat.shortDescription || "");
    setFormDesc(cat.description || "");
    setFormCoverImage(cat.coverImage || "");
    setFormColor(cat.color || "#64748b");
    setFormIcon(cat.icon || "Folder");
    setFormOrder(cat.order || 0);
    setFormStatus(cat.status || "ativa");
    setFormSeoTitle(cat.seoTitle || "");
    setFormSeoDescription(cat.seoDescription || "");
    setFormKeywords(cat.keywords || "");
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    
    // Auto-generate slug and SEO title if not manually filled
    const generatedSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
      
    setFormSlug(generatedSlug);
    
    // Auto populate SEO title
    setFormSeoTitle(`${val} | Blog Discreta Boutique`);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      showFeedback('error', "Nome e Slug são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const categoryData: Omit<BlogCategory, 'id'> = {
        name: formName.trim(),
        slug: formSlug.trim(),
        shortDescription: formShortDesc.trim(),
        description: formDesc.trim(),
        coverImage: formCoverImage.trim(),
        color: formColor,
        icon: formIcon,
        order: Number(formOrder) || 0,
        status: formStatus,
        seoTitle: formSeoTitle.trim() || `${formName.trim()} | Blog Discreta Boutique`,
        seoDescription: formSeoDescription.trim() || formShortDesc.trim(),
        keywords: formKeywords.trim()
      };

      await blogService.saveCategory(editingId || undefined, categoryData);
      
      showFeedback('success', editingId ? `Categoria "${formName}" atualizada com sucesso!` : `Categoria "${formName}" criada com sucesso!`);
      handleCreateNewClick();
      loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao salvar categoria no Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover a categoria "${name}"? Os posts associados a ela voltarão para a categoria "Geral".`)) {
      return;
    }
    try {
      await blogService.deleteCategory(catId);
      showFeedback('success', "Categoria removida com sucesso.");
      if (editingId === catId) {
        handleCreateNewClick();
      }
      loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao remover categoria.");
    }
  };

  // Pre-load the 9 official suggested categories
  const handleBootstrapCategories = async () => {
    if (!confirm("Isso irá criar as 9 categorias sugeridas (Lingeries, Relacionamento, etc.) se já não existirem. Deseja continuar?")) {
      return;
    }
    setSaving(true);
    try {
      const suggestedList = [
        {
          name: "Relacionamento",
          slug: "relacionamento",
          shortDescription: "Conteúdos sobre conexão, carinho, autoestima e momentos especiais entre casais.",
          description: "Explore artigos enriquecedores para aproximar parceiros, reacender a paixão mútua, nutrir o carinho diário e fortalecer a cumplicidade de forma transparente e afetiva. Nosso foco é promover conversas saudáveis, momentos românticos inesquecíveis e guias de bem-estar a dois.",
          icon: "Heart",
          color: "#ec4899",
          order: 1,
          status: "ativa" as const,
          seoTitle: "Relacionamento e Amor | Blog Discreta Boutique",
          seoDescription: "Aproximando casais com conteúdos de valor sobre amor, conexão afetiva e momentos especiais juntas.",
          keywords: "relacionamento, casais, namoro, casamento, intimidade, amor"
        },
        {
          name: "Lingeries",
          slug: "lingeries",
          shortDescription: "Guias, dicas e tendências sobre lingeries e moda íntima.",
          description: "Saber escolher a lingerie perfeita une poder, conforto e autoimagem. Conheça as melhores opções de rendas, conjuntos estruturados, lingeries para noivas e momentos especiais, além de dicas essenciais para conservação das suas peças.",
          icon: "Feather",
          color: "#e11d48",
          order: 2,
          status: "ativa" as const,
          seoTitle: "Lingeries e Moda Íntima | Blog Discreta Boutique",
          seoDescription: "Encontre dicas de como usar, escolher e combinar as lingeries que valorizam seu corpo e acendem sua autoestima.",
          keywords: "lingerie, moda intima, renda, espartilhos, sensualidade"
        },
        {
          name: "Cosméticos Sensuais",
          slug: "cosmeticos-sensuais",
          shortDescription: "Informações sobre óleos, géis, massagens e experiências românticas.",
          description: "Os cosméticos funcionais e aromáticos têm o potencial de transformar uma noite comum em um spa sensorial inesquecível. Aprenda como aplicar óleos térmicos, realizar massagens relaxantes e utilizar géis aromáticos com segurança e diversão.",
          icon: "Flame",
          color: "#f97316",
          order: 3,
          status: "ativa" as const,
          seoTitle: "Cosméticos Sensuais e Massagem | Blog Discreta Boutique",
          seoDescription: "Tudo sobre óleos beijáveis, aromatizadores, géis e o universo dos cosméticos para casais.",
          keywords: "cosmeticos sensuais, oleo massagem, romântico, relaxante"
        },
        {
          name: "Presentes para Casais",
          slug: "presentes-casais",
          shortDescription: "Sugestões de presentes criativos e momentos especiais.",
          description: "Dar presentes é uma linguagem do amor essencial. Descubra como montar surpresas apaixonantes, cestas temáticas personalizadas e presentear com requinte elegância, tanto em comemorações de aniversário quanto no cotidiano.",
          icon: "Gift",
          color: "#3b82f6",
          order: 4,
          status: "ativa" as const,
          seoTitle: "Presentes Criativos e Caixa Surpresa | Blog Discreta Boutique",
          seoDescription: "Opções charmosas, discretas e marcantes de presentes para comemorar marcos especiais com quem você ama.",
          keywords: "presentes, casais, dia dos namorados, surpresa romantica, caixa presente"
        },
        {
          name: "Bem-estar Íntimo",
          slug: "bem-estar-intimo",
          shortDescription: "Conteúdos educativos voltados para autoestima e qualidade de vida.",
          description: "O carinho com o próprio corpo é o primeiro passo para uma vida plena. Descubra guias didáticos, saúde íntima preventiva, pautas ligadas ao autocuidado feminino e segredos para viver de bem com o espelho.",
          icon: "Sparkles",
          color: "#10b981",
          order: 5,
          status: "ativa" as const,
          seoTitle: "Bem-estar Íntimo e Autocuidado | Blog Discreta Boutique",
          seoDescription: "Conecte-se com sua essência e cuide da sua saúde com conteúdos aprovados e de linguagem acolhedora.",
          keywords: "saude intima, autocuidado, autoestima, bem estar feminino"
        },
        {
          name: "Datas Comemorativas",
          slug: "datas-comemorativas",
          shortDescription: "Dia dos Namorados, Natal, Festa Junina, Black Friday e campanhas sazonais.",
          description: "As grandes épocas do ano reservam ótimos motivos para comemorar e surpreender. Acompanhe nossas campanhas exclusivas e ideias sazonais para dar sabor aos momentos em feriados e datas especiais.",
          icon: "Calendar",
          color: "#8b5cf6",
          order: 6,
          status: "ativa" as const,
          seoTitle: "Calendário Festivo Sazonal | Blog Discreta Boutique",
          seoDescription: "Campanhas oficiais, Dia dos Namorados, sugestões de natal e novidades sazonais da nossa boutique.",
          keywords: "dia dos namorados, natal, black friday, sazonais, festas"
        },
        {
          name: "Fantasias e Criatividade",
          slug: "fantasias-criatividade",
          shortDescription: "Ideias para surpreender e tornar momentos especiais mais divertidos.",
          description: "Sair da rotina é um exercício lúdico e saudável. Inspire-se com ideias de jogos românticos, dezenas de brincadeiras inteiramente criativas a dois e fantasias ideais para inovar o romance com muito estilo.",
          icon: "Compass",
          color: "#d946ef",
          order: 7,
          status: "ativa" as const,
          seoTitle: "Criatividade e Fantasias | Blog Discreta Boutique",
          seoDescription: "Quebre a rotina com bom humor, jogos de tabuleiro para casais e novas narrativas românticas.",
          keywords: "fantasias, criatividade, quebrar rotina, jogos casais"
        },
        {
          name: "Guia para Iniciantes",
          slug: "guia-iniciantes",
          shortDescription: "Conteúdo para quem está começando e deseja aprender mais.",
          description: "Se você está iniciando a exploração em brinquedos e cosméticos funcionais e tem dúvidas sobre por onde começar, este guia reúne análises discretas, fáceis de ler, com comparações objetivas para sanar toda insegurança.",
          icon: "Award",
          color: "#f59e0b",
          order: 8,
          status: "ativa" as const,
          seoTitle: "Guia Completo Iniciante | Blog Discreta Boutique",
          seoDescription: "Explicativo simples e direto sobre produtos, cosméticos e dicas para perder a timidez.",
          keywords: "iniciantes, primeiro brinquedo, dicas basicas, como começar"
        },
        {
          name: "Discreta Boutique em Icó",
          slug: "discreta-boutique-ico",
          shortDescription: "Novidades, bastidores, eventos e conteúdos locais da Discreta Boutique.",
          description: "Toda a nossa comunidade física em Icó conectada! Fique por dentro de eventos corporativos locais, palestras femininas exclusivas da nossa marca, lançamentos ao vivo em loja física e novidades com o toque cearense especial do Vale do Salgado.",
          icon: "MapPin",
          color: "#dc2626",
          order: 9,
          status: "ativa" as const,
          seoTitle: "Discreta Boutique Icó - Ceará | Novidades e Eventos",
          seoDescription: "Siga as novidades, campanhas presenciais regionais e eventos intimistas da moda íntima em Icó.",
          keywords: "ico ceara, discreta boutique ico, loja fisica, moda intima ico"
        }
      ];

      let createdCount = 0;
      for (const item of suggestedList) {
        // Enforce checking if already exists
        const exists = categories.some(c => c.slug === item.slug);
        if (!exists) {
          await blogService.saveCategory(undefined, item);
          createdCount++;
        }
      }

      showFeedback('success', `${createdCount} categorias iniciais sugeridas foram populadas com sucesso!`);
      loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao autopopular categorias.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-650 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Buscando categorias e métricas...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white tracking-tight">Gerenciar Categorias</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Agrupe seus artigos em silos temáticos ricos e otimizados para SEO.</p>
          </div>
        </div>
        
        {categories.length === 0 && (
          <button
            onClick={handleBootstrapCategories}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 text-white text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-950/20"
          >
            <Sparkles size={14} />
            Instalar Categorias Sugeridas
          </button>
        )}
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CREATE / EDIT FORM PANEL (Left or relative top depending on screen width) */}
        <div className="lg:col-span-5 x-fit">
          <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                {editingId ? <Edit2 size={15} className="text-blue-400" /> : <Plus size={15} className="text-red-500" />}
                {editingId ? "Editar Categoria" : "Nova Categoria"}
              </h3>
              {editingId && (
                <button 
                  onClick={handleCreateNewClick}
                  className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-[9px] uppercase tracking-widest font-black"
                >
                  <X size={12} />
                  Cancelar
                </button>
              )}
            </div>
            
            <form onSubmit={handleSaveCategory} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome da Categoria *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Lingeries"
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                  />
                </div>
                
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Slug *</label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="lingeries"
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Visual Icons Picker */}
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ícone Representativo</label>
                  <div className="relative">
                    <select
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white appearance-none"
                    >
                      {PRESET_ICONS.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                      {(() => {
                        const iconData = PRESET_ICONS.find(i => i.id === formIcon) || PRESET_ICONS[9];
                        const IconComp = iconData.icon;
                        return <IconComp size={15} />;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Color Selection */}
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Palette size={10} className="text-zinc-500" />
                    Cor Temática
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormColor(c.value)}
                          style={{ backgroundColor: c.value }}
                          className={`w-4 h-4 rounded-full border ${formColor === c.value ? 'border-white scale-110' : 'border-transparent'} hover:scale-105 transition-all`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ordem de exibição</label>
                  <input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status Visibilidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus("ativa")}
                      className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                        formStatus === "ativa" 
                          ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400" 
                          : "border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Ativa
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus("oculta")}
                      className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                        formStatus === "oculta" 
                          ? "bg-red-950/40 border-red-500/50 text-red-400" 
                          : "border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Oculta
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Imagem de Capa (URL)</label>
                <input
                  type="text"
                  value={formCoverImage}
                  onChange={(e) => setFormCoverImage(e.target.value)}
                  placeholder="https://suaimagem.com/foto-categoria.jpg"
                  className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descrição curta (Resumo ou Chaser)</label>
                <input
                  type="text"
                  value={formShortDesc}
                  onChange={(e) => setFormShortDesc(e.target.value)}
                  placeholder="Resumo de 1 frase para cards..."
                  className="w-full px-3.5 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descrição completa (Página da Categoria - Markdown / Texto)</label>
                <textarea
                  rows={4}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Escreva um texto rico descrevendo o foco desse siló temático..."
                  className="w-full px-3.5 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
                />
              </div>

              {/* SEO EXCLUSIVE PANEL */}
              <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1 border-b border-zinc-900 pb-2">
                  <Globe size={11} className="text-pink-500" />
                  Otimização para SEO e Redes Sociais
                </h4>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Meta Title (Título Único)</label>
                  <input
                    type="text"
                    value={formSeoTitle}
                    onChange={(e) => setFormSeoTitle(e.target.value)}
                    placeholder="Ex: Lingeries Finas e Rendas de Luxo | Boutique"
                    className="w-full px-3 py-1.5 border border-zinc-900 bg-zinc-900/30 text-xs rounded-lg focus:outline-none text-white font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Meta Description (Snippet de Busca)</label>
                  <input
                    type="text"
                    value={formSeoDescription}
                    onChange={(e) => setFormSeoDescription(e.target.value)}
                    placeholder="O que o leitor verá nos resultados do Google..."
                    className="w-full px-3 py-1.5 border border-zinc-900 bg-zinc-900/30 text-xs rounded-lg focus:outline-none text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Palavras-chave (keywords separated by comma)</label>
                  <input
                    type="text"
                    value={formKeywords}
                    onChange={(e) => setFormKeywords(e.target.value)}
                    placeholder="lingerie, moda intima, sensualidade"
                    className="w-full px-3 py-1.5 border border-zinc-900 bg-zinc-900/30 text-xs rounded-lg focus:outline-none text-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-gradient-to-r from-red-700 to-pink-700 hover:from-red-600 hover:to-pink-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 shadow-md shadow-pink-950/20 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {editingId ? "Salvar Alterações" : "Criar Categoria"}
              </button>
            </form>
          </div>
        </div>

        {/* CATEGORIES LIST AND STATS (Right / 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-900/50">
            <div className="p-5 border-b border-zinc-850 bg-zinc-900/80 flex justify-between items-center bg-zinc-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Silos De Artigos</h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Todas as categorias registradas no blog</p>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg">
                Total: {categories.length}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900/40">
                    <th className="py-3 px-5">Design / Nome</th>
                    <th className="py-3 px-5">Ordem</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Artigos</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 text-xs">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-zinc-500 text-[11px] uppercase tracking-wide">
                        <Folder size={28} className="mx-auto text-zinc-800 mb-3" />
                        Nenhuma categoria registrada no banco de dados.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => {
                      // Lookup icon
                      const IconData = PRESET_ICONS.find(i => i.id === cat.icon) || PRESET_ICONS[9];
                      const IconComponent = IconData.icon;
                      const catColor = cat.color || "#64748b";
                      const qty = postCounts[cat.id!] || 0;

                      return (
                        <tr key={cat.id} className={`hover:bg-zinc-850/10 transition-colors ${editingId === cat.id ? 'bg-zinc-900/60' : ''}`}>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div 
                                className="p-2 border rounded-xl flex items-center justify-center shrink-0"
                                style={{ 
                                  borderColor: `${catColor}30`, 
                                  backgroundColor: `${catColor}15`,
                                  color: catColor
                                }}
                              >
                                <IconComponent size={14} />
                              </div>
                              <div>
                                <span className="font-extrabold text-white block hover:underline cursor-pointer" onClick={() => handleEditClick(cat)}>
                                  {cat.name}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">/blog/categoria/{cat.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-zinc-400">{cat.order || 0}</td>
                          <td className="py-3.5 px-5">
                            {cat.status === "oculta" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-950/40 text-red-400 border border-red-900/40">
                                <EyeOff size={10} /> Oculta
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                                <Eye size={10} /> Ativa
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-zinc-300">{qty} {qty === 1 ? 'post' : 'posts'}</span>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(cat)}
                                className="p-1.5 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 hover:bg-zinc-900 rounded-lg transition-all"
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                              
                              <Link
                                to={`/blog/categoria/${cat.slug}`}
                                className="p-1.5 text-zinc-400 hover:text-blue-400 border border-transparent hover:border-zinc-800 hover:bg-zinc-900 rounded-lg transition-all"
                                title="Visualizar Página Pública"
                                target="_blank"
                              >
                                <Globe size={13} />
                              </Link>

                              <button
                                onClick={() => handleDeleteCategory(cat.id!, cat.name)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 border border-transparent hover:border-zinc-800 hover:bg-zinc-900 rounded-lg transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
