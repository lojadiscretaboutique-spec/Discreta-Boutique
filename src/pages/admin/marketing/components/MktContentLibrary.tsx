import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  Copy, 
  Check, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Tag, 
  X,
  ExternalLink,
  Wand2,
  Tv,
  Smartphone,
  RotateCcw,
  RefreshCw,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  FolderHeart,
  HelpCircle
} from 'lucide-react';
import { MktContentItem } from '../marketingTypes';

interface MktContentLibraryProps {
  contentItems: MktContentItem[];
  saveContentItem: (ci: MktContentItem) => Promise<void>;
  createContentItem: (ci: Omit<MktContentItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteContentItem: (id: string) => Promise<void>;
}

interface CopywritingOption {
  label: string;
  headline: string;
  copy: string;
  cta: string;
  hashtags: string[];
}

export function MktContentLibrary({
  contentItems,
  saveContentItem,
  createContentItem,
  deleteContentItem
}: MktContentLibraryProps) {
  // Navigation tabs for the Content hub
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'estudio-ia'>('biblioteca');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todas');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Creation Form fields
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MktContentItem['type']>('texto');
  const [bodyText, setBodyText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [tags, setTags] = useState('');

  // Selected item detail modal
  const [selectedItem, setSelectedItem] = useState<MktContentItem | null>(null);

  // --- AI CREATIVE STUDIO STATE VARIABLES ---
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Sensual de Luxo');
  const [ctaGoal, setCtaGoal] = useState('Comprar no site');
  const [format, setFormat] = useState('Feed');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  
  // Default creative placeholders, generated copy list
  const [copyOptions, setCopyOptions] = useState<CopywritingOption[]>([
    {
      label: "Abordagem Sensorial (Luxo & Poesia)",
      headline: "✨ Desperte seu Magnetismo Oculto",
      copy: "Um sussurro de renda premium sobre a pele. Sinta o luxo da costura sob medida redesenhando todas as suas curvas e revelando sua confiança definitiva. Na Discreta Boutique, vestir-se é um ritual de amor-próprio e sofisticação incomparável.",
      cta: "🌹 Encontre seu caimento ideal e compre direto pelo link da bio.",
      hashtags: ["discretaboutique", "lingeriepremium", "rendasdeluxo", "luxoeboutique", "autoestimafeminina"]
    },
    {
      label: "Foco Produto & Detalhes de Alto Nível",
      headline: "🖤 Renda Rubra de Luxo",
      copy: "Desenvolvida com a tecnologia de elastano soft e apliques franceses em arabescos. Um conjunto que une o suporte anatômico perfeito com a sofisticação da alta costura íntima. Conforto insuperável que acompanha sua elegância.",
      cta: "📲 Chame nossa personal stylist via direct e peça com atendimento vip privado.",
      hashtags: ["discretaboutique", "altalingerie", "detalhesperfeitos", "lingerieimportada"]
    },
    {
      label: "Foco Comercial & Desconto Limitado",
      headline: "🔥 Conquiste seu Conjunto dos Sonhos",
      copy: "A sutil diferença de se vestir para si mesma. Condições especiais de lançamento de inverno por tempo limitadíssimo. Últimas unidades disponíveis com frete expresso gratuito para pedidos selecionados.",
      cta: "⚡ Aproveite o cupom NAMORADOS15 e finalize direto na nossa loja digital.",
      hashtags: ["discretaboutique", "cupomexclusivo", "lancamentos", "fretegratis"]
    }
  ]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  // Visual Image Generator states
  const [imagePrompt, setImagePrompt] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // History of generated images
  const [generatedImagesHistory, setGeneratedImagesHistory] = useState<string[]>([
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=600",
    "https://images.unsplash.com/photo-1615396899839-c99c121888b0?q=80&w=600"
  ]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Live Simulated Preview Format
  const [previewFormat, setPreviewFormat] = useState<'feed' | 'story' | 'reels'>('feed');

  // Load manual categories
  const categories = [
    { id: 'todas', label: 'Todos Assets' },
    { id: 'arte', label: 'Artes' },
    { id: 'video', label: 'Vídeos' },
    { id: 'foto', label: 'Fotos' },
    { id: 'texto', label: 'Textos' },
    { id: 'roteiro', label: 'Roteiros' },
    { id: 'hashtag', label: 'Hashtags' },
    { id: 'ideia', label: 'Ideias' }
  ];

  // Helper copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createContentItem({
      title,
      type,
      contentUrl: mediaUrl || "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=400",
      bodyText,
      tags: tags ? tags.split(',').map(t => t.trim()) : ['Inclusão']
    });

    setTitle('');
    setBodyText('');
    setMediaUrl('');
    setTags('');
    setShowForm(false);
  };

  const filtered = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = activeCategory === 'todas' || item.type === activeCategory;
    return matchesSearch && matchesCat;
  });

  const getIcon = (type: MktContentItem['type']) => {
    switch (type) {
      case 'arte': return <Sparkles className="w-4 h-4 text-rose-450 text-rose-400" />;
      case 'foto': return <ImageIcon className="w-4 h-4 text-blue-450 text-blue-400" />;
      case 'video': return <Video className="w-4 h-4 text-orange-450 text-orange-400" />;
      default: return <FileText className="w-4 h-4 text-emerald-450 text-emerald-400" />;
    }
  };

  const getEventBadgeColor = (type: MktContentItem['type']) => {
    switch (type) {
      case 'arte': return 'bg-rose-600 text-rose-50 border border-rose-500/25';
      case 'foto': return 'bg-blue-600 text-blue-50';
      case 'video': return 'bg-orange-600 text-orange-50';
      default: return 'bg-zinc-700 text-zinc-100';
    }
  };

  // --- IA GENERATORS API OPERATIONS ---
  const handleGenerateCopy = async () => {
    if (!topic.trim()) {
      alert("Por favor, digite um tópico ou ideia base para orientar a IA.");
      return;
    }
    setIsGeneratingCopy(true);
    try {
      const response = await fetch('/api/ia/marketing-copywriting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic, tone, ctaGoal, format })
      });
      const data = await response.json();
      if (data && data.options && data.options.length > 0) {
        setCopyOptions(data.options);
        setSelectedOptionIndex(0);
      } else {
        alert("Falha na geração: a resposta de IA veio em formato inválido.");
      }
    } catch (err: any) {
      console.error("Copy generation failed:", err);
      alert("Houve um erro de comunicação com o servidor de IA. Usando opções adaptadas offline.");
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleRewriteSelectedCopy = async () => {
    if (!rewriteInstruction.trim()) {
      alert("Por favor, informe o ajuste ou instrução que deseja realizar (ex: 'Deixar mais sensual', 'Encurtar').");
      return;
    }
    const currentOption = copyOptions[selectedOptionIndex];
    if (!currentOption) return;

    setIsRewriting(true);
    try {
      const response = await fetch('/api/ia/marketing-rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalCopy: currentOption.copy,
          instruction: rewriteInstruction
        })
      });
      const data = await response.json();
      if (data && data.copy) {
        const updatedOptions = [...copyOptions];
        updatedOptions[selectedOptionIndex] = {
          ...currentOption,
          copy: data.copy
        };
        setCopyOptions(updatedOptions);
        setRewriteInstruction('');
      } else {
        alert("Falha ao reescrever legenda.");
      }
    } catch (err) {
      console.error("Rewrite failed:", err);
      alert("Falha ao comunicar com IA de reescrita.");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      alert("Por favor, digite uma descrição visual da imagem (ex: 'Lingerie preta numa colcha de seda').");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/ia/marketing-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          referenceUrl
        })
      });
      const data = await response.json();
      if (data && data.imageUrl) {
        setGeneratedImagesHistory(prev => [data.imageUrl, ...prev]);
        setSelectedImageIndex(0); // select the newly generated image
      } else {
        alert("Nenhuma imagem gerada.");
      }
    } catch (err) {
      console.error("Image generation failed:", err);
      alert("Não foi possível gerar a imagem por IA. Tente usar uma URL padrão para referências de modelagem.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const saveOptionToContentItems = async (index: number) => {
    const opt = copyOptions[index];
    if (!opt) return;

    await createContentItem({
      title: opt.headline,
      type: 'texto',
      bodyText: `${opt.copy}\n\n${opt.cta}\n\n${opt.hashtags.map(h => '#' + h).join(' ')}`,
      contentUrl: generatedImagesHistory[selectedImageIndex] || '',
      tags: ['IA-Gerado', 'Copywriting', tone]
    });
    alert("Legenda salva com sucesso na sua Biblioteca Criativa!");
  };

  const saveImageToContentItems = async (imageUrl: string) => {
    if (!imageUrl) return;
    await createContentItem({
      title: imagePrompt || `Geração Visual por IA - ${tone}`,
      type: 'arte',
      bodyText: `Criativo gerado via Imagen modelagem premium baseada em ideias.`,
      contentUrl: imageUrl,
      tags: ['IA-Visual', 'Imagem-Criada']
    });
    alert("Imagem incorporada com sucesso na sua Biblioteca Criativa!");
  };

  // Compile active copywriting text for simulated mockup render
  const activeHeadline = copyOptions[selectedOptionIndex]?.headline || 'Gancho Criativo';
  const activeCopy = copyOptions[selectedOptionIndex]?.copy || 'Texto da publicação...';
  const activeCta = copyOptions[selectedOptionIndex]?.cta || '';
  const activeHashtags = copyOptions[selectedOptionIndex]?.hashtags || [];
  const activeMockupImage = generatedImagesHistory[selectedImageIndex] || "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600";

  return (
    <div className="space-y-6 animate-fade-in text-white z-10 relative">
      
      {/* BRAND HEADER & NAVIGATION MENU */}
      <div className="bg-zinc-950/70 p-5 px-6 border border-zinc-850 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-md shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-red-500 animate-pulse" />
            <h2 className="text-md font-black uppercase tracking-wider text-zinc-100">Central de Criação Estratégica</h2>
          </div>
          <p className="text-[11px] text-zinc-400 max-w-2xl font-medium leading-relaxed">
            Sua oficina criativa premium privada. Organize o acervo operacional da Boutique ou utilize a inteligência de linguagem e imagem para gerar campanhas inteiras em segundos.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'biblioteca' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            <FolderHeart className="w-3.5 h-3.5" /> Arquivos & Biblioteca ({contentItems.length})
          </button>
          <button
            onClick={() => setActiveTab('estudio-ia')}
            className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'estudio-ia' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Estúdio de IA Direcional
          </button>
        </div>
      </div>

      {activeTab === 'biblioteca' ? (
        <>
          {/* STATIC ARCHIVE AND DIRECT UPLOAD FORM */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap border border-zinc-85c border-zinc-805 bg-zinc-950/45 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${activeCategory === cat.id ? 'bg-red-600 text-white font-extrabold shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="w-full md:w-64 relative font-medium flex gap-3">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Buscar arquivos, tags..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-805 p-2 px-3 pr-9 text-xs rounded-xl outline-none text-white focus:border-red-600 transition-colors"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-2.5" />
              </div>
              <button 
                onClick={() => setShowForm(true)}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-xs font-black rounded-xl text-white shrink-0 shadow-md cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Novo Manual
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-down">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Título da Mídia / Asset</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Legenda Lançamento Oficial Lingerie Rubra"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Categoria Formato</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white font-bold"
                >
                  <option value="arte">Arte Digital / Design</option>
                  <option value="video">Vídeo / Roteiro de Apoio</option>
                  <option value="foto">Foto de Estúdio / Produto</option>
                  <option value="texto">Texto de Legenda</option>
                  <option value="roteiro">Roteiro Story ou Reel</option>
                  <option value="hashtag">Conjunto de Hashtags</option>
                  <option value="ideia">Ideia de Campanha</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Link para Arquivo / Imagem Referência (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: https://images.unsplash.com/photo-..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Tags / Etiquetas (Separadas por vírgula)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Instagram, Cupom, Renda"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white focus:border-red-500"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Texto Copiável / Descrição / Roteiro Detalhado</label>
                <textarea 
                  placeholder="Digite aqui o texto da legenda, roteiro ou descrição da ideia criativa..."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full bg-zinc-950 p-3 text-xs border border-zinc-800 rounded-xl outline-none focus:border-red-500 text-white h-24 font-normal"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs text-zinc-450 hover:text-white"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md"
                >
                  Gravar Conteúdo
                </button>
              </div>
            </form>
          )}

          {/* ACTIVE CONTENT LIBRARY ASSET LIST VIEW */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group bg-zinc-950/80 border border-zinc-805 hover:border-zinc-700/80 rounded-2xl overflow-hidden shadow-lg transition-all cursor-pointer relative flex flex-col justify-between"
              >
                {item.contentUrl && (item.type === 'arte' || item.type === 'foto' || item.type === 'video') && (
                  <div className="h-40 w-full overflow-hidden relative border-b border-zinc-900 bg-zinc-900 flex items-center justify-center">
                    <img 
                      src={item.contentUrl} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 p-1.5 bg-zinc-950/80 backdrop-blur text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                <div className="p-5 space-y-3.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="p-1 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] font-black uppercase text-zinc-400 flex items-center gap-1 font-mono">
                      {getIcon(item.type)} {item.type}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-550 font-bold">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  <h3 className="text-xs font-black text-zinc-100 leading-snug group-hover:text-white transition-colors">
                    {item.title}
                  </h3>

                  {item.bodyText && (
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-805 text-zinc-350 leading-relaxed">
                      {item.bodyText}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.tags.map((t, index) => (
                      <span key={index} className="px-2 py-0.5 rounded text-[8.5px] font-extrabold bg-red-950/20 text-rose-300 border border-red-900/10 flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" /> {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-950 p-3 px-5 border-t border-zinc-900 flex items-center justify-between">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm('Deseja excluir este asset da biblioteca?')) {
                        await deleteContentItem(item.id);
                      }
                    }}
                    className="text-zinc-500 hover:text-red-400 p-1 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {item.bodyText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item.bodyText || '', item.id);
                      }}
                      className="px-3 py-1 bg-red-955 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar Texto
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-1 md:col-span-3 text-center py-16 text-zinc-500 font-bold text-xs bg-zinc-900/10 rounded-2xl border border-zinc-900">
                📭 Nenhum material disponível para visualização. Adicione um criativo no painel acima!
              </div>
            )}
          </div>
        </>
      ) : (
        /* --- BRAND NEW IA CREATIVE STUDIO BLOCK --- */
        <div id="ai-creative-studio-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-white relative">
          
          {/* COLUMN 1: CONTROLS & GENERATORS (8 COLS) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* PANEL 1: AI COPYWRITING FACTORY */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-6 rounded-2xl space-y-4 backdrop-blur shadow-lg">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Wand2 className="w-4.5 h-4.5 text-rose-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-50">Gerador de Copywriting Estratégico</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wide">Ideia Central, Modelo ou Campanha</label>
                  <textarea
                    rows={2}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Lançamento do espartilho rendado rubra com cinta-liga. Foco em sedução e embalagem luxuosa gratuita para o Dia dos Namorados."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs outline-none focus:border-red-500 text-white placeholder-zinc-650 leading-relaxed font-normal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wide">Tom de Voz</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 px-3 text-xs outline-none text-white font-bold"
                  >
                    <option value="Sensual de Luxo">🥀 Sensual de Luxo / Poético</option>
                    <option value="Romântico & Delicado">🌸 Romântico & Delicado</option>
                    <option value="Provocativo & Sofisticado">💄 Provocativo & Sofisticado</option>
                    <option value="Urgente & Promocional">⚡ Urgente / Foco em Cupom</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wide">Objetivo da Chamada (CTA)</label>
                  <select
                    value={ctaGoal}
                    onChange={(e) => setCtaGoal(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 px-3 text-xs outline-none text-white font-bold"
                  >
                    <option value="Comprar no site">🌐 Direcionar para Loja Online</option>
                    <option value="Chamar no WhatsApp">📲 Conversão Privada via WhatsApp</option>
                    <option value="Falar no Direct">💬 Enviar Mensagem no Direct</option>
                    <option value="Deixar comentário">✏️ Aumentar Engajamento (Perguntas)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-bold">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-600" /> IA gera 3 abordagens distintas
                </span>
                <button
                  type="button"
                  onClick={handleGenerateCopy}
                  disabled={isGeneratingCopy}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 text-xs font-black rounded-xl text-white flex items-center gap-1.5 shadow-md shadow-red-950/40 cursor-pointer"
                >
                  {isGeneratingCopy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Conectando especialista...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" /> Escrever Legendas via IA
                    </>
                  )}
                </button>
              </div>

              {/* LIST GENERATED OPTIONS */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Opções Geradas por IA</h4>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-full">Pronto para Uso</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {copyOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOptionIndex(i)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${selectedOptionIndex === i ? 'bg-red-950/20 border-red-500/80 text-rose-100 shadow' : 'bg-zinc-950 border-zinc-850 text-zinc-450 hover:bg-zinc-900'}`}
                    >
                      <span className="text-[9px] text-zinc-500 font-extrabold uppercase block truncate">VARIAÇÃO {i + 1}</span>
                      <span className="text-[10px] font-black truncate text-zinc-200 mt-1">{opt.headline}</span>
                      <span className="text-[8.5px] text-zinc-400 font-medium truncate mt-0.5 max-w-full">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* ACTIVE SELECTED OPTION DETAIL EDITOR */}
                {copyOptions[selectedOptionIndex] && (
                  <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-850 space-y-4 animate-scale-up">
                    <div className="flex items-start justify-between border-b border-zinc-900 pb-2.5">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-[8.5px] text-zinc-400 font-mono font-bold uppercase">{copyOptions[selectedOptionIndex].label}</span>
                        <h4 className="text-xs font-black text-rose-50 leading-tight">{copyOptions[selectedOptionIndex].headline}</h4>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveOptionToContentItems(selectedOptionIndex)}
                          title="Gravar Legenda na Biblioteca"
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-emerald-400 rounded-lg hover:text-emerald-300 cursor-pointer"
                        >
                          <FolderHeart className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(`${copyOptions[selectedOptionIndex].copy}\n\n${copyOptions[selectedOptionIndex].cta}\n\n${copyOptions[selectedOptionIndex].hashtags.map(h => '#' + h).join(' ')}`, 'STUDIO_COPY')}
                          className="px-3 py-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-350 hover:text-white rounded-lg cursor-pointer text-[10px] font-black flex items-center gap-1.5"
                        >
                          {copiedId === 'STUDIO_COPY' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-red-500" />}
                          {copiedId === 'STUDIO_COPY' ? 'Copiado!' : 'Copiar Completo'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 space-y-1 leading-relaxed font-sans select-text whitespace-pre-wrap">
                      <p className="font-semibold text-rose-50/90">{copyOptions[selectedOptionIndex].headline}</p>
                      <p className="text-zinc-300 font-normal">{copyOptions[selectedOptionIndex].copy}</p>
                      <p className="text-rose-400 font-medium italic pt-1">{copyOptions[selectedOptionIndex].cta}</p>
                      <div className="flex flex-wrap gap-1 hover:underline text-rose-300 font-bold select-all text-[11px] pt-1 pt-2">
                        {copyOptions[selectedOptionIndex].hashtags.map((h, i) => <span key={i}>#{h}</span>)}
                      </div>
                    </div>

                    {/* AI REWRITER INPUT FORM */}
                    <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 space-y-2">
                      <label className="text-[8.5px] text-zinc-550 font-black uppercase block tracking-wider">Reescrever Legenda por IA (Refinamento)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={rewriteInstruction}
                          onChange={(e) => setRewriteInstruction(e.target.value)}
                          placeholder="Instrua a IA: Ex 'Deixar mais ousado', 'Encurtar em 2 linhas', 'Aumentar urgência'..."
                          className="w-full bg-zinc-950 border border-zinc-800 p-2 text-xs rounded-xl outline-none text-white focus:border-red-650"
                        />
                        <button
                          onClick={handleRewriteSelectedCopy}
                          disabled={isRewriting || !rewriteInstruction.trim()}
                          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-950 text-xs text-rose-450 text-rose-400 border border-zinc-800 hover:border-red-500 rounded-xl font-bold cursor-pointer shrink-0 transition-colors"
                        >
                          {isRewriting ? 'Processando...' : 'Reescrever'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2: AI IMAGE FACTORY (IMAGEN 4.0 INTEGRATION) */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-6 rounded-2xl space-y-4 backdrop-blur shadow-lg">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <ImageIcon className="w-4.5 h-4.5 text-rose-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-50">Geração de Mídia Visual por IA (Estúdio Fotográfico)</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9.5px] font-bold text-zinc-400 uppercase">Ideia Visual da Imagem</label>
                    <input
                      type="text"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Ex: Espartilho vintage de cetim vermelho em uma penteadeira vintage de madeira escura com espelho oval ornamentado."
                      className="w-full bg-zinc-950 border border-zinc-500/20 rounded-xl p-3 text-xs outline-none focus:border-red-500 text-white leading-relaxed placeholder-zinc-600"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9.5px] font-bold text-zinc-400 uppercase">Referência Visual / Link de Imagem Modelo (Opcional)</label>
                    <input
                      type="text"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="Ex: Cole o link de uma imagem do Pinterest para orientar o estilo, cores ou iluminação"
                      className="w-full bg-zinc-950 border border-zinc-500/10 rounded-xl p-2.5 text-xs outline-none text-white font-mono placeholder-zinc-700"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[9.5px] text-zinc-550 font-black uppercase tracking-widest font-mono">
                    Model: Imagen 4.0 PRO
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 text-xs font-black rounded-xl text-white flex items-center gap-1.5 shadow-md shadow-red-950/40 cursor-pointer"
                  >
                    {isGeneratingImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Renderizando Criativo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 animate-pulse" /> Gerar Criativo de Alta Fidelidade
                      </>
                    )}
                  </button>
                </div>

                {/* GENERATED IMAGES GRID & SELECTION */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Histórico de Visualizações e Criações</h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {generatedImagesHistory.map((img, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative aspect-square rounded-xl overflow-hidden border cursor-pointer hover:opacity-100 transition-all group ${selectedImageIndex === index ? 'border-red-600 ring-2 ring-red-600/40 opacity-100' : 'border-zinc-800 opacity-60'}`}
                      >
                        <img src={img} alt={`Criado_${index}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[9px] font-bold uppercase bg-black/80 px-2 py-0.5 rounded-lg">Ampliar</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {generatedImagesHistory[selectedImageIndex] && (
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex flex-col md:flex-row items-center gap-4 animate-fade-in text-white/90">
                      <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-zinc-805">
                        <img src={generatedImagesHistory[selectedImageIndex]} alt="Modelo Selecionada" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-1 text-center md:text-left">
                        <h5 className="text-xs font-black text-rose-50 uppercase tracking-tight">Criação Visual Ativa</h5>
                        <p className="text-[10px] text-zinc-400 leading-tight">Vincule este criativo fotográfico gerado diretamente ao feed do mockup para avaliar o visual.</p>
                        <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
                          <button
                            onClick={() => saveImageToContentItems(generatedImagesHistory[selectedImageIndex])}
                            className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded-lg text-[9px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <FolderHeart className="w-3.5 h-3.5 text-emerald-400" /> Salvar Asset
                          </button>
                          <a
                            href={generatedImagesHistory[selectedImageIndex]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded-lg text-[9px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Abrir Original
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 2: INSTAGRAM HIGH-FIDELITY LIVE SIMULATED MOCKUP (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-zinc-900/60 border border-zinc-850 p-5 rounded-2xl sticky top-4 shadow-2xl space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <div className="flex items-center gap-1.5">
                  <Tv className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-rose-50 tracking-wider">Simulador Instagram Live</span>
                </div>

                {/* Render style pickers */}
                <div className="flex bg-zinc-950 p-1 border border-zinc-805 rounded-xl text-[9px] font-extrabold whitespace-nowrap">
                  <button
                    onClick={() => setPreviewFormat('feed')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${previewFormat === 'feed' ? 'bg-red-650 bg-red-600 text-white font-black' : 'text-zinc-400'}`}
                  >
                    Feed
                  </button>
                  <button
                    onClick={() => setPreviewFormat('story')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${previewFormat === 'story' ? 'bg-red-650 bg-red-600 text-white font-black' : 'text-zinc-400'}`}
                  >
                    Story
                  </button>
                  <button
                    onClick={() => setPreviewFormat('reels')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${previewFormat === 'reels' ? 'bg-red-650 bg-red-600 text-white font-black' : 'text-zinc-400'}`}
                  >
                    Reels
                  </button>
                </div>
              </div>

              {/* LIVE SIMULATED PHONE WRAPPER */}
              <div className="mx-auto w-full max-w-[290px] border-[5px] border-zinc-800 rounded-[35px] overflow-hidden shadow-2xl relative aspect-[9/18] bg-black ring-4 ring-zinc-900/30">
                
                {/* Cam/speaker notches */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-zinc-800 rounded-full z-50 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full ml-auto mr-3" />
                </div>

                {/* 1. INSTAGRAM FEED PREVIEW */}
                {previewFormat === 'feed' && (
                  <div className="h-full bg-black flex flex-col justify-between text-xs select-none">
                    {/* Header */}
                    <div className="p-3 pt-6 border-b border-zinc-950 flex items-center justify-between text-zinc-100 font-bold bg-zinc-950/80">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 rounded-full p-[1.5px]">
                          <img src="https://images.unsplash.com/photo-1549439602-43ebcb23281f?q=80&w=200" alt="Logo" className="w-full h-full rounded-full object-cover border border-black" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-tight block">discretaboutique</span>
                          <span className="text-[7.5px] text-zinc-400 font-extrabold uppercase font-mono block">Luxo Privado</span>
                        </div>
                      </div>
                      <MoreHorizontal className="w-4 h-4 text-zinc-400" />
                    </div>

                    {/* Image space */}
                    <div className="flex-1 w-full bg-zinc-950 relative overflow-hidden flex items-center/ justify-center max-h-[250px] aspect-square">
                      <img src={activeMockupImage} alt="Insta Post" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>

                    {/* Action buttons */}
                    <div className="p-3 space-y-1.5 bg-zinc-950">
                      <div className="flex items-center justify-between text-zinc-100 pb-1">
                        <div className="flex gap-3">
                          <Heart className="w-5 h-5 text-red-500 fill-current" />
                          <MessageCircle className="w-5 h-5" />
                          <Send className="w-5 h-5" />
                        </div>
                        <Bookmark className="w-5 h-5 text-zinc-400" />
                      </div>

                      <span className="text-[10px] font-black text-white block">1.482 curtidas</span>

                      {/* Decriptive caption */}
                      <div className="text-[10px] space-y-1 leading-normal text-zinc-300 font-sans break-words select-text">
                        <p><span className="font-extrabold text-white mr-1.5">discretaboutique</span> {activeHeadline}</p>
                        <p className="line-clamp-4 text-zinc-450 font-normal">{activeCopy}</p>
                        <p className="text-red-400 font-semibold italic">{activeCta}</p>
                        <div className="text-blue-400 font-bold flex flex-wrap gap-[3px]">
                          {activeHashtags.map((h, i) => <span key={i}>#{h}</span>)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. INSTAGRAM STORIES PREVIEW */}
                {previewFormat === 'story' && (
                  <div className="h-full bg-zinc-950 flex flex-col justify-between text-xs select-none relative">
                    {/* Top progress line bars */}
                    <div className="absolute top-7 inset-x-2 flex gap-1 z-50">
                      <div className="h-0.5 bg-white flex-1 rounded-full opacity-100" />
                      <div className="h-0.5 bg-white/40 flex-1 rounded-full" />
                      <div className="h-0.5 bg-white/40 flex-1 rounded-full" />
                    </div>

                    {/* Story top header */}
                    <div className="absolute top-10 inset-x-3 flex items-center gap-2 z-50 text-white font-bold">
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-red-500">
                        <img src="https://images.unsplash.com/photo-1549439602-43ebcb23281f?q=80&w=200" alt="Logo" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] font-black block tracking-tight shadow-md">discretaboutique</span>
                      <span className="text-[8px] text-zinc-300 font-bold block bg-black/30 p-0.5 px-2 rounded-full font-mono">14h</span>
                    </div>

                    {/* Vertical Background image */}
                    <div className="absolute inset-0 z-10">
                      <img src={activeMockupImage} alt="Story visual" referrerPolicy="no-referrer" className="w-full h-full object-cover brightness-95" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                    </div>

                    {/* Interactive center widget with AI copywriting overlay */}
                    <div className="absolute inset-x-4 top-1/3 z-30 space-y-4">
                      {/* Premium elegant overlay glass sticker */}
                      <div className="bg-black/75 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-2xl text-center space-y-1.5 scale-95 mx-auto max-w-[240px]">
                        <span className="text-[8px] font-black bg-rose-500/20 text-red-300 border border-red-400/20 p-0.5 px-2.5 rounded-full inline-block uppercase tracking-wider font-mono">Sensual Premium</span>
                        <h4 className="text-[11px] font-black text-rose-50 leading-snug">{activeHeadline}</h4>
                        <p className="text-[8.5px] text-zinc-350 leading-tight block truncate whitespace-nowrap">{activeCopy}</p>
                        
                        {/* Interactive sticker link badge clickable style */}
                        <div className="pt-2">
                          <span className="p-1 px-3 bg-blue-500 hover:bg-blue-600 text-white font-black text-[9px] rounded-xl inline-block shadow-md uppercase tracking-wide animate-pulse">
                            🔗 COMPRAR AGORA
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom message text input bar */}
                    <div className="absolute bottom-5 inset-x-3 z-30 flex gap-3 items-center">
                      <div className="flex-1 bg-transparent border border-white/30 rounded-full p-2 px-4 text-[10px] text-zinc-300 shadow bg-black/20 text-white/90">
                        Enviar mensagem...
                      </div>
                      <Send className="w-4.5 h-4.5 text-white filter drop-shadow cursor-pointer shrink-0" />
                    </div>
                  </div>
                )}

                {/* 3. INSTAGRAM REELS PREVIEW */}
                {previewFormat === 'reels' && (
                  <div className="h-full bg-black flex flex-col justify-between text-xs select-none relative">
                    {/* Background visual asset image */}
                    <div className="absolute inset-0 z-10 overflow-hidden">
                      <img src={activeMockupImage} alt="Reel representation" referrerPolicy="no-referrer" className="w-full h-full object-cover brightness-90 animate-pulse duration-[3000ms]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    </div>

                    {/* Top title */}
                    <div className="absolute top-10 inset-x-4 flex items-center justify-between z-30 text-white/95 font-bold">
                      <span className="text-xs font-black tracking-tight uppercase">Reels</span>
                      <Video className="w-5 h-5 text-white/80" />
                    </div>

                    {/* Right side overlays with interaction metrics */}
                    <div className="absolute right-3.5 bottom-16 z-30 flex flex-col items-center gap-4 text-white">
                      <div className="flex flex-col items-center gap-0.5">
                        <Heart className="w-6 h-6 text-red-500 fill-current filter drop-shadow shadow-black" />
                        <span className="text-[8px] font-black text-zinc-100">8.4k</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <MessageCircle className="w-6 h-6 text-white filter drop-shadow shadow-black" />
                        <span className="text-[8px] font-black text-zinc-100">242</span>
                      </div>
                      <Send className="w-5.5 h-5.5 text-white filter drop-shadow" />
                      <div className="w-5 h-5 rounded overflow-hidden border border-white shrink-0 shadow mt-2">
                        <img src="https://images.unsplash.com/photo-1549439602-43ebcb23281f?q=80&w=200" alt="Ticker" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    {/* Bottom side caption details */}
                    <div className="absolute bottom-6 left-3.5 right-12 z-30 space-y-2 text-white/95">
                      <div className="flex items-center gap-2">
                        <div className="w-6.5 h-6.5 rounded-full overflow-hidden border border-white">
                          <img src="https://images.unsplash.com/photo-1549439602-43ebcb23281f?q=80&w=200" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-black tracking-tight">discretaboutique</span>
                        <span className="text-[8px] bg-red-650 bg-red-600 px-1.5 py-0.5 rounded text-white font-extrabold uppercase scale-90">Seguir</span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black leading-tight text-rose-50">{activeHeadline}</h4>
                        <p className="text-[8.5px] text-zinc-300 leading-normal line-clamp-2 leading-tight select-text">{activeCopy}</p>
                        <p className="text-red-400 font-bold text-[8.5px] italic leading-none">{activeCta}</p>
                      </div>

                      {/* Music ticker */}
                      <div className="flex items-center gap-1.5 text-[8.5px] bg-black/40 backdrop-blur border border-white/5 p-1 rounded-lg w-fit text-zinc-300 font-mono font-bold max-w-[140px] truncate">
                        <RefreshCw className="w-2.5 h-2.5 text-red-500 animate-spin" />
                        <span>Sedução Acoustic Part 1</span>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* DETAILED CONTENT VIEWER DIALOG OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in text-white">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[95vh]">
            <div className="bg-zinc-950 p-6 flex items-start justify-between border-b border-zinc-800">
              <div className="space-y-1.5 flex-1 pr-6">
                <span className="p-1 px-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[9px] font-extrabold uppercase text-zinc-400 inline-block font-mono">
                  ✏️ Formato: {selectedItem.type.toUpperCase()}
                </span>
                <h3 className="text-sm font-black text-rose-50 leading-tight">
                  {selectedItem.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto pr-2 scrollbar-thin">
              {selectedItem.contentUrl && (
                <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 max-h-56">
                  <img 
                    src={selectedItem.contentUrl} 
                    alt={selectedItem.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {selectedItem.bodyText ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-black">
                    <span>TEXTO INTEGRAL COPIÁVEL</span>
                    <button 
                      onClick={() => handleCopy(selectedItem.bodyText || '', 'mdl_cp')}
                      className="text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'mdl_cp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === 'mdl_cp' ? 'Copiado!' : 'Copiar Texto da Caixa'}
                    </button>
                  </div>
                  <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 font-sans text-xs text-zinc-250 leading-relaxed text-zinc-300 max-h-52 overflow-y-auto whitespace-pre-wrap">
                    {selectedItem.bodyText}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic text-center py-6">Este asset não contém descrição de texto copiável.</p>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {selectedItem.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-zinc-950 border border-zinc-805 text-zinc-400">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white rounded-lg hover:bg-zinc-750 transition-colors cursor-pointer"
              >
                Fechar Biblioteca
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
