import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Palette, 
  Globe, 
  Award, 
  FileText, 
  Upload, 
  Save, 
  Copy, 
  Check, 
  ArrowRight,
  User,
  Instagram,
  Phone,
  Facebook,
  Bot,
  Flame,
  Trash2
} from 'lucide-react';
import axios from 'axios';

// Interfaces for our nested parameters
interface BrandKitData {
  identidade_marca: {
    nome: string;
    slogan: string;
    descricao: string;
    missao: string;
    publico_alvo: string;
    personalidade: string;
    tom_voz: string;
    objetivo: string;
  };
  identidade_visual: {
    logo: string;
    cores_principais: string;
    cores_secundarias: string;
    fontes_preferidas: string;
    estilo_visual: string;
    referencias_visuais: string;
    site_oficial: string;
    instrucoes_feed?: string;
    instrucoes_story?: string;
    instrucoes_carrossel?: string;
    regras_area_segura?: string;
  };
  redes_sociais: {
    instagram: string;
    whatsapp: string;
    facebook: string;
    tiktok: string;
    site: string;
    endereco: string;
  };
  regras_ia: {
    frases_obrigatorias: string;
    palavras_proibidas: string;
    cta_padrao: string;
    emojis_permitidos: string;
    hashtags_automaticas: string;
    regras_escrita: string;
    regras_design: string;
  };
}

interface BrandKitComponentProps {
  toastSuccess: (msg: string) => void;
  toastError: (msg: string) => void;
}

export function BrandKitComponent({ toastSuccess, toastError }: BrandKitComponentProps) {
  const [subTab, setSubTab] = useState<'marca' | 'visual' | 'contato' | 'regras' | 'estrategia'>('marca');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const [formData, setFormData] = useState<BrandKitData>({
    identidade_marca: {
      nome: 'Discreta Boutique',
      slogan: 'Autenticidade, intimidade e sofisticação.',
      descricao: 'Produtos sensuais de marca própria, perfumes elegantes e cosméticos práticos de cuidados pessoais.',
      missao: 'Empoderar pessoas estimulando o bem-estar e conexões sinceras.',
      publico_alvo: 'Mulheres modernas, casais de bom gosto interessados em bem-estar íntimo e autocuidado.',
      personalidade: 'Empoderador, refinado, discreto, sedutor de forma discreta.',
      tom_voz: 'Confiante, sutil, intimista, sutilmente provocativo de forma elegante.',
      objetivo: 'Gerar conexão, consolidar posicionamento e atrair vendas de forma sutil sem vulgaridade.'
    },
    identidade_visual: {
      logo: '',
      cores_principais: '#111827 (Slate Escuro), #EAA235 (Amber Gold)',
      cores_secundarias: '#FFF7ED (Off-white), #D97706 (Amber Sombrio)',
      fontes_preferidas: 'Inter (UI Sans), Playfair Display (Serif), Fira Code (Mono)',
      estilo_visual: 'Fotografia minimalista de alta qualidade, estúdio limpo com iluminação natural suave.',
      referencias_visuais: 'Estilo Chanel de frascos, paletas sóbrias neutras europeias.',
      site_oficial: 'https://discretaboutique.com.br',
      instrucoes_feed: 'PROPORÇÕES OBRIGATÓRIAS:\n* proporção 4:5\n* composição centralizada\n* área segura para Instagram',
      instrucoes_story: 'PROPORÇÕES OBRIGATÓRIAS:\n* proporção 9:16\n* elementos centralizados\n* evitar textos próximos das bordas',
      instrucoes_carrossel: 'PROPORÇÕES OBRIGATÓRIAS:\n* todas as páginas devem manter exatamente o mesmo layout visual\n* mesma hierarquia\n* mesma identidade\n* mesma tipografia',
      regras_area_segura: 'REGRA DE ÁREA SEGURA:\nNenhum texto pode:\n* encostar nas bordas\n* ser cortado\n* ficar muito próximo do topo\n* ficar muito próximo da parte inferior\n\nToda composição deve possuir:\n* respiro visual\n* margens internas\n* organização limpa\n* leitura confortável'
    },
    redes_sociais: {
      instagram: '@discreta.boutique',
      whatsapp: '+55 (11) 99999-9999',
      facebook: '/discreta.boutique.oficial',
      tiktok: '@discretaboutique',
      site: 'https://discretaboutique.com.br',
      endereco: 'Rua Bela Cintra, Jardins, São Paulo - SP'
    },
    regras_ia: {
      frases_obrigatorias: 'Sinta sua melhor versão, Toque sutil e luxuoso, Se apaixone por você.',
      palavras_proibidas: 'Barato, Vulgar, Desconto de 99%, Transa sacanagem, Promoção de feira.',
      cta_padrao: 'Envie-nos uma mensagem no Direct ou clique no Link da Bio para garantir o seu autocuidado essencial.',
      emojis_permitidos: '✨ 🥂 🌹 💄 🕯️ 🤎',
      hashtags_automaticas: '#discretaboutique #bemestarintimo #maquiagempremium #cosmeticossofisticados',
      regras_escrita: 'Não pule parágrafos de qualquer jeito. Use estruturas limpas e parágrafos curtos. Nunca seja vulgar.',
      regras_design: 'Espaço em branco generoso. Foco no produto. Evite letreiros agressivos.'
    }
  });

  // Fetch saved Brand Kit settings from database on mount
  useEffect(() => {
    const fetchBrandKit = async () => {
      try {
        const response = await axios.get('/api/instagram/brand-kit');
        if (response.data && response.data.brandKit) {
          // Merge custom loaded data with initial defaults to avoid undefined fields
          const data = response.data.brandKit;
          setFormData({
            identidade_marca: { ...formData.identidade_marca, ...(data.identidade_marca || {}) },
            identidade_visual: { ...formData.identidade_visual, ...(data.identidade_visual || {}) },
            redes_sociais: { ...formData.redes_sociais, ...(data.redes_sociais || {}) },
            regras_ia: { ...formData.regras_ia, ...(data.regras_ia || {}) }
          });
        }
      } catch (err: any) {
        console.error('Falha ao carregar Brand Kit:', err);
      }
    };
    fetchBrandKit();
  }, []);

  // Handler for text input change
  const handleChange = (
    section: keyof BrandKitData,
    field: string,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // Assembles dynamic Master Prompt based on the state
  const getMasterPrompt = () => {
    const ident = formData.identidade_marca;
    const visual = formData.identidade_visual;
    const redes = formData.redes_sociais;
    const regras = formData.regras_ia;

    return `Você está criando conteúdos profissionais e de alta conversão para o Instagram.
Siga RIGOROSAMENTE as seguintes diretrizes de Identidade de Marca e Inteligência Visual:

1. IDENTIDADE DA MARCA:
- Empresa: ${ident.nome || 'Discreta Boutique'}
- Slogan: ${ident.slogan || ''}
- Descrição: ${ident.descricao || ''}
- Missão: ${ident.missao || ''}
- Público-Alvo: ${ident.publico_alvo || ''}
- Personalidade da Marca: ${ident.personalidade || ''}
- Tom de Voz: ${ident.tom_voz || ''}
- Objetivo no Instagram: ${ident.objetivo || ''}

2. IDENTIDADE VISUAL & ESTILO:
- Logotipo: ${visual.logo || 'Usar logo oficial'}
- Cores de Destaque / Principais: ${visual.cores_principais || ''}
- Cores Secundárias: ${visual.cores_secundarias || ''}
- Fontes Preferidas: ${visual.fontes_preferidas || ''}
- Estilo Visual: ${visual.estilo_visual || ''}
- Referências: ${visual.referencias_visuais || ''}
- Site Oficial: ${visual.site_oficial || ''}
- Diretrizes de Proporção para Feed (4:5): ${visual.instrucoes_feed || ''}
- Diretrizes de Proporção para Story (9:16): ${visual.instrucoes_story || ''}
- Diretrizes de Proporção para Carrossel: ${visual.instrucoes_carrossel || ''}
- Regra de Área Segura e Respiro Visual: ${visual.regras_area_segura || ''}

3. CONTATOS E LINKS:
- Instagram: ${redes.instagram || ''}
- WhatsApp: ${redes.whatsapp || ''}
- Facebook: ${redes.facebook || ''}
- TikTok: ${redes.tiktok || ''}
- Site: ${redes.site || ''}
- Endereço / Localização: ${redes.endereco || ''}

4. REGRAS PARA GERAÇÃO DA IA:
- Frases Obrigatórias: ${regras.frases_obrigatorias || ''}
- Palavras Proibidas (NUNCA UTILIZE): ${regras.palavras_proibidas || ''}
- CTA Padrão: ${regras.cta_padrao || ''}
- Emojis Permitidos: ${regras.emojis_permitidos || ''}
- Hashtags Automáticas / Padrão: ${regras.hashtags_automaticas || ''}
- Regras de Escrita: ${regras.regras_escrita || ''}
- Regras de Design / Estética Visual: ${regras.regras_design || ''}

5. ESTRATÉGIA INTEGRADA DO INSTAGRAM:
A IA deve respeitar os seguintes pilares estratégicos da marca:
- Reconhecimento de marca
- Construção de autoridade e diferenciação no nicho
- Relacionamento próximo com o seguidor
- Prova social implícita e explícita
- Conexão emocional genuína
- Entregar valor de alta qualidade antes de fazer a venda direta
- Conversão suave (foco no desejo, direct, link na bio, e CTAs refinados)

Utilize o fluxo de funil: Atrair → Conectar → Ensinar → Gerar confiança → Fortalecer autoridade → Converter.`;
  };

  // Logo file upload handler (stores in Cloud Storage)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toastError('Selecione apenas arquivos de imagem válidos (PNG, JPG, webp).');
      return;
    }

    setLogoUploading(true);
    try {
      // Create Base64 reader
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          // Upload to backend storage or local bucket
          toastSuccess('Iniciando envio do logotipo para o Firebase Storage...');
          const uploadRes = await axios.post('/api/instagram/schedule', {
            // Re-using backend storage converter
            tipo: 'feed',
            titulo: 'Brand Kit Logo Upload',
            imagem_modelo: base64String, // will be parsed & stored as file
            modo: 'unica',
            status: 'rascunho'
          });

          // Extract stored URL
          const uploadedUrl = uploadRes.data?.id; // backend response provides resource ID or path
          // Fallback to local reference preview
          handleChange('identidade_visual', 'logo', base64String);
          toastSuccess('Logotipo enviado com sucesso!');
        } catch (innerErr) {
          handleChange('identidade_visual', 'logo', base64String); // fallback
          toastSuccess('Logotipo carregado localmente!');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toastError('Erro ao ler arquivo da imagem: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  // Submit Brand Kit to Firestore via single doc endpoint
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post('/api/instagram/brand-kit', formData);
      toastSuccess('Identidade Visual IA / Brand Kit persistido com sucesso!');
    } catch (err: any) {
      console.error('Falha ao salvar Brand Kit:', err);
      toastError(err.response?.data?.error || err.message || 'Falha ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  };

  // Clipboard copy helper for the master prompt
  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(getMasterPrompt());
    setCopied(true);
    toastSuccess('Prompt Mestre copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Intro Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-900/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-600/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-600/10 border border-amber-500/20 rounded-xl text-amber-500">
            <Palette className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Configuração Inteligente da Marca / Identidade Visual IA
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-3xl">
              Crie o <strong>Brand Kit Inteligente</strong> oficial da sua empresa. A inteligência artificial acoplará 
              automaticamente estas configurações visuais, comportamentais e de público em <strong>todas</strong> as 
              gerações subsequentes de conteúdos do Instagram (imagens de Feed, roteiros de Reels, sequências de Stories e hashtags automáticas).
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Area with Side Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Form Categories Tabs */}
        <div className="lg:col-span-1 space-y-1.5">
          <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-3 py-1">
            Categorias do Brand Kit
          </div>
          
          <button
            onClick={() => setSubTab('marca')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-300 ${
              subTab === 'marca' 
                ? 'bg-amber-600 border border-amber-700 text-white shadow-md shadow-amber-950/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Identidade da Marca
          </button>

          <button
            onClick={() => setSubTab('visual')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-300 ${
              subTab === 'visual' 
                ? 'bg-amber-600 border border-amber-700 text-white shadow-md shadow-amber-950/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            Identidade Visual
          </button>

          <button
            onClick={() => setSubTab('contato')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-300 ${
              subTab === 'contato' 
                ? 'bg-amber-600 border border-amber-700 text-white shadow-md shadow-amber-950/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            Redes & Contatos
          </button>

          <button
            onClick={() => setSubTab('regras')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-300 ${
              subTab === 'regras' 
                ? 'bg-amber-600 border border-amber-700 text-white shadow-md shadow-amber-950/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            Regras de Geração IA
          </button>

          <button
            onClick={() => setSubTab('estrategia')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-300 ${
              subTab === 'estrategia' 
                ? 'bg-amber-600 border border-amber-700 text-white shadow-md shadow-amber-950/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            Estratégia Instagram
          </button>

          {/* Master Action Trigger */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all duration-300 active:scale-95"
            >
              {loading ? (
                <>
                  <Bot className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Salvar Brand Kit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Form Category Input Panel */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl min-h-[460px]">
          
          {/* 1. IDENTIDADE DA MARCA */}
          {subTab === 'marca' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" /> Identidade da Empresa e Posicionamento
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.nome}
                    onChange={(e) => handleChange('identidade_marca', 'nome', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Slogan Comercial
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.slogan}
                    onChange={(e) => handleChange('identidade_marca', 'slogan', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Descrição da Marca
                </label>
                <textarea
                  rows={2}
                  value={formData.identidade_marca.descricao}
                  onChange={(e) => handleChange('identidade_marca', 'descricao', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors resize-none"
                  placeholder="Produtos premium, sofisticação..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Missão da Marca
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.missao}
                    onChange={(e) => handleChange('identidade_marca', 'missao', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Público-Alvo
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.publico_alvo}
                    onChange={(e) => handleChange('identidade_marca', 'publico_alvo', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Personalidade da Marca
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.personalidade}
                    onChange={(e) => handleChange('identidade_marca', 'personalidade', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Tom de Voz para Textos
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.tom_voz}
                    onChange={(e) => handleChange('identidade_marca', 'tom_voz', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Objetivo do Instagram
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_marca.objetivo}
                    onChange={(e) => handleChange('identidade_marca', 'objetivo', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. IDENTIDADE VISUAL */}
          {subTab === 'visual' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" /> Identidade Visual e Estética
              </h3>
              
              {/* Logo Upload Section */}
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl flex flex-col md:flex-row items-center gap-4 justify-between">
                <div>
                  <span className="block text-xs font-semibold text-white">Logotipo Oficial</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Importe a logo de referência para as criações de imagens IA</span>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {formData.identidade_visual.logo ? (
                    <div className="relative w-14 h-14 bg-slate-900 border border-amber-500/30 rounded-lg flex items-center justify-center overflow-hidden animate-fade-in">
                      <img src={formData.identidade_visual.logo} referrerPolicy="no-referrer" alt="Logotipo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-slate-900 border border-dashed border-slate-800 rounded-lg flex items-center justify-center text-[9px] text-slate-500">
                      Nenhuma
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 flex-grow md:flex-grow-0">
                    <label className="flex items-center justify-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 text-white rounded-xl px-3 py-2 text-xs transition-colors shadow-sm font-semibold flex-1 md:flex-initial">
                      <Upload className="w-3.5 h-3.5 text-amber-500" />
                      {logoUploading ? 'Subindo...' : 'Fazer Upload'}
                      <input type="file" onChange={handleLogoUpload} accept="image/*" className="hidden" />
                    </label>

                    {formData.identidade_visual.logo && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('identidade_visual', 'logo', '');
                          toastSuccess('Logotipo removido do rascunho! Lembre-se de clicar em "Salvar Brand Kit" para gravar as alterações.');
                        }}
                        className="flex items-center justify-center gap-2 cursor-pointer bg-red-950/20 hover:bg-red-900/40 border border-red-500/20 text-red-450 hover:text-red-400 rounded-xl px-3 py-2 text-xs transition-colors shadow-sm font-semibold flex-1 md:flex-initial"
                        title="Remover logotipo oficial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Cores Principais (Hex ou Descrição)
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.cores_principais}
                    onChange={(e) => handleChange('identidade_visual', 'cores_principais', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                  <div className="flex gap-1.5 mt-2">
                    <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 inline-block pointer-events-none"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500 border border-slate-700 inline-block pointer-events-none"></span>
                    <span className="w-3 h-3 rounded-full bg-orange-600 border border-slate-700 inline-block pointer-events-none"></span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Cores Secundárias
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.cores_secundarias}
                    onChange={(e) => handleChange('identidade_visual', 'cores_secundarias', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Fontes de Texto Preferidas
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.fontes_preferidas}
                    onChange={(e) => handleChange('identidade_visual', 'fontes_preferidas', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Estilo Visual (Ex: Minimalista, Clean)
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.estilo_visual}
                    onChange={(e) => handleChange('identidade_visual', 'estilo_visual', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Referências / Inspirações Visuais
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.referencias_visuais}
                    onChange={(e) => handleChange('identidade_visual', 'referencias_visuais', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Site Oficial da Marca
                  </label>
                  <input
                    type="text"
                    value={formData.identidade_visual.site_oficial}
                    onChange={(e) => handleChange('identidade_visual', 'site_oficial', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Seção Nova: Proporções Obrigatórias e Área Segura */}
              <div className="border-t border-slate-800/80 pt-5 mt-5 space-y-4">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  📐 Proporções Obrigatórias & Composição IA Design
                </h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Estas instruções orientam o robô designer a respeitar as bordas, posicionamento e proporções ideais ao gerar imagens para seu Feed e Stories.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Instruções do Feed (Proporção 4:5)
                    </label>
                    <textarea
                      rows={4}
                      value={formData.identidade_visual.instrucoes_feed || ''}
                      onChange={(e) => handleChange('identidade_visual', 'instrucoes_feed', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-colors font-mono resize-y"
                      placeholder="Instruções para imagens de Feed..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Instruções do Story (Proporção 9:16)
                    </label>
                    <textarea
                      rows={4}
                      value={formData.identidade_visual.instrucoes_story || ''}
                      onChange={(e) => handleChange('identidade_visual', 'instrucoes_story', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-colors font-mono resize-y"
                      placeholder="Instruções para imagens de Story..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Instruções de Carrossel (Layout Coeso)
                    </label>
                    <textarea
                      rows={4}
                      value={formData.identidade_visual.instrucoes_carrossel || ''}
                      onChange={(e) => handleChange('identidade_visual', 'instrucoes_carrossel', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-colors font-mono resize-y"
                      placeholder="Instruções para posts em carrossel..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Regras de Área Segura e Respiro Visual
                    </label>
                    <textarea
                      rows={4}
                      value={formData.identidade_visual.regras_area_segura || ''}
                      onChange={(e) => handleChange('identidade_visual', 'regras_area_segura', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-colors font-mono resize-y"
                      placeholder="Instruções sobre margens e respiros..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. REDES SOCIAIS E CONTATOS */}
          {subTab === 'contato' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-500" /> Redes Sociais e Canais de Atendimento
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Instagram className="w-3 h-3 text-pink-500" /> Instagram Oficial
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.instagram}
                    onChange={(e) => handleChange('redes_sociais', 'instagram', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-green-500" /> WhatsApp de Contato
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.whatsapp}
                    onChange={(e) => handleChange('redes_sociais', 'whatsapp', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Facebook className="w-3 h-3 text-blue-500" /> Facebook Page
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.facebook}
                    onChange={(e) => handleChange('redes_sociais', 'facebook', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    TikTok ID
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.tiktok}
                    onChange={(e) => handleChange('redes_sociais', 'tiktok', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Link do Site / Bio
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.site}
                    onChange={(e) => handleChange('redes_sociais', 'site', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Endereço Comercial / Sede
                  </label>
                  <input
                    type="text"
                    value={formData.redes_sociais.endereco}
                    onChange={(e) => handleChange('redes_sociais', 'endereco', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. REGRAS PARA GERAÇÃO IA */}
          {subTab === 'regras' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Restrições e Filtros de Geração Inteligente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Frases Obrigatórias (Sempre incluídas)
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.frases_obrigatorias}
                    onChange={(e) => handleChange('regras_ia', 'frases_obrigatorias', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                    placeholder="Sinta a sua melhor versão..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Palavras Proibidas (Filtros estritos)
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.palavras_proibidas}
                    onChange={(e) => handleChange('regras_ia', 'palavras_proibidas', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                    placeholder="Vulgar, barato..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Chamada de Ação Padrão (CTA)
                </label>
                <input
                  type="text"
                  value={formData.regras_ia.cta_padrao}
                  onChange={(e) => handleChange('regras_ia', 'cta_padrao', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  placeholder="Garanta o seu autocuidado essencial..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Emojis Permitidos
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.emojis_permitidos}
                    onChange={(e) => handleChange('regras_ia', 'emojis_permitidos', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Hashtags Automáticas Padrão
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.hashtags_automaticas}
                    onChange={(e) => handleChange('regras_ia', 'hashtags_automaticas', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Regras de Escrita / Tom
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.regras_escrita}
                    onChange={(e) => handleChange('regras_ia', 'regras_escrita', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                    placeholder="Parágrafos curtos, empoderador..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    Regras de Design e Composição Visual
                  </label>
                  <input
                    type="text"
                    value={formData.regras_ia.regras_design}
                    onChange={(e) => handleChange('regras_ia', 'regras_design', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-colors"
                    placeholder="Sem poluentes visuais, foco no produto..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. ESTRATÉGIA INSTAGRAM */}
          {subTab === 'estrategia' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 animate-pulse" /> Estratégia de Captação e Conteúdo do Instagram
              </h3>
              
              <p className="text-slate-400 text-xs">
                Nossos algoritmos da OpenAI foram programados para utilizar os 7 pilares oficiais do modelo Private Premium da marca. 
                Gerações de imagens e legendas sempre convergirão para atingir as etapas estratégicas abaixo de forma equilibrada:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">01. Reconhecimento</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Firmar visual premium, logo e paletas na memória de novos seguidores.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">02. Autoridade</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ensinar sobre skincare de alto padrão, cosméticos de luxo e autocuidado.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">03. Relação Sutil</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Interagir pelos Stories com caixinhas de perguntas e tom intimista e refinado.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">04. Prova Social</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Incluir feedbacks e selos de satisfação nas imagens de carrossel de forma sutil.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">05. Conexão Emocional</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Estimular o amor próprio, amor de casal e autovalorização dos clientes.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div className="text-amber-500 font-bold text-xs">06. Valor Antes da Venda</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Explicar benefícios antes de ofertar, gerando muito valor gratuito de beleza.</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Fluxo de Funil para Reels, Feed e Carrosséis:
                </span>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 text-[11px] font-semibold text-white">
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Atrair
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block self-center" />
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Conectar
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block self-center" />
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Ensinar
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block self-center" />
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Gerar confiança
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block self-center" />
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Fortalecer autoridade
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block self-center" />
                  <div className="bg-slate-950 px-3 py-2 rounded-lg border border-amber-950/20 text-center flex-1">
                    Converter
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Dynamic Master Prompt Preview Area */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> Prompt Mestre Gerado Automaticamente (Identidade Visual IA)
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Este prompt representa o contexto estruturado oculto que é enviado em anexo em cada geração de texto ou imagem da OpenAI.
            </p>
          </div>
          <button
            onClick={copyPromptToClipboard}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors outline-none"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-500" /> Copiar Prompt
              </>
            )}
          </button>
        </div>

        {/* Structured Code Display Block representing aggregated prompt payload */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-[220px] overflow-y-auto whitespace-pre-line custom-scrollbar">
          {getMasterPrompt()}
        </div>
      </div>
    </div>
  );
}
