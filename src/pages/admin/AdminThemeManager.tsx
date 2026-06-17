import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeConfig } from '../../types/theme';
import { getAutoTextColor } from '../../utils/themeUtils';
import { themeService, PREMADE_THEMES } from '../../services/themeService';
import { AuditLog } from '../../services/auditLogService';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { 
  Palette, 
  Check, 
  Trash2, 
  Plus, 
  Calendar, 
  History, 
  Save, 
  Clock, 
  Sparkles, 
  Copy, 
  RotateCcw, 
  Eye, 
  AlertCircle, 
  ChevronRight, 
  Sliders,
  CheckCircle2,
  ListFilter,
  UploadCloud,
  Globe,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminThemeManager() {
  const { 
    currentTheme, 
    allThemes, 
    previewTheme, 
    setPreviewTheme, 
    activateTheme, 
    saveCustomTheme, 
    deleteCustomTheme, 
    refreshThemes 
  } = useTheme();

  const { userData } = useAuthStore();
  const { toast } = useFeedback();

  // State management for Theme customizer/editor
  const [editingTheme, setEditingTheme] = useState<Partial<ThemeConfig> | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'themes' | 'customizer' | 'logs'>('themes');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Load audit logs on page mount or refresh
  const loadLogs = async (): Promise<void> => {
    try {
      const logList = await themeService.getThemeLogs(30);
      setLogs(logList);
    } catch (e) {
      console.warn("Could not load theme logs directly, showing general logs as fallback.", e);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentTheme]);

  // Handle immediate selection of preconfigured color templates
  const selectThemeTemplate = (theme: ThemeConfig) => {
    setPreviewTheme(theme);
    setEditingTheme({ ...theme });
  };

  const handleImageUpload = async (key: keyof NonNullable<ThemeConfig['branding']>, file: File) => {
    try {
      setSaving(true);
      const { optimizeImage, uploadBrandingImage } = await import('../../utils/imageOptimizer');
      
      let maxWidth = 1200;
      let maxHeight = 1200;
      let forceWebp = true;
      let quality = 0.85;

      // Rules mapped to keys
      if (key === 'logoHorizontal') { maxWidth = 1200; maxHeight = 300; forceWebp = true; }
      else if (key === 'logoSquare') { maxWidth = 1024; maxHeight = 1024; forceWebp = true; }
      else if (key === 'favicon') { maxWidth = 128; maxHeight = 128; forceWebp = false; } // maintain format for favicons usually
      else if (key === 'icon192') { maxWidth = 192; maxHeight = 192; forceWebp = false; } // PWA icon needs to be valid png/webp
      else if (key === 'icon512' || key === 'maskableIcon') { maxWidth = 512; maxHeight = 512; forceWebp = false; }
      else if (key === 'appleTouchIcon') { maxWidth = 180; maxHeight = 180; forceWebp = false; }
      else if (key === 'socialPreviewImage') { maxWidth = 1200; maxHeight = 630; forceWebp = true; }

      const optimized = await optimizeImage(file, maxWidth, maxHeight, quality, forceWebp);
      const uploadedResult = await uploadBrandingImage(optimized);
      
      const currentBranding = editingTheme?.branding || {};
      const newBranding = {
        ...currentBranding,
        [key]: uploadedResult,
        pwaVersion: (currentBranding.pwaVersion || Date.now()) + 1
      };
      
      handleFieldChange('branding', newBranding);
      toast('Imagem otimizada e salva com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      toast('Erro ao carregar a imagem. Verifique o console.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key: keyof ThemeConfig, value: any) => {
    if (!editingTheme) return;

    const updated = { ...editingTheme, [key]: value };

    // Automatically recalculate high contrast text colors based on background
    if (key === 'backgroundColor') {
      updated.backgroundTextColor = getAutoTextColor(value);
    } else if (key === 'primaryColor') {
      updated.primaryTextColor = getAutoTextColor(value);
    } else if (key === 'secondaryColor') {
      updated.secondaryTextColor = getAutoTextColor(value);
    } else if (key === 'cardColor') {
      updated.cardTextColor = getAutoTextColor(value);
    } else if (key === 'buttonColor') {
      updated.buttonTextColor = getAutoTextColor(value);
    } else if (key === 'linkColor') {
      updated.linkTextColor = getAutoTextColor(value);
    } else if (key === 'highlightColor') {
      updated.highlightTextColor = getAutoTextColor(value);
    }

    setEditingTheme(updated);
    setPreviewTheme(updated as ThemeConfig);
  };

  // Turn active editing or chosen template into the permanent system theme
  const handleActivateTheme = async (theme: ThemeConfig) => {
    try {
      setSaving(true);
      await activateTheme(theme);
      toast(`Tema "${theme.name}" ativado com sucesso em toda a loja!`, "success");
      await loadLogs();
    } catch (err) {
      console.error(err);
      toast("Ocorreu um erro ao ativar o tema. Tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Cancel custom previews
  const handleCancelPreview = () => {
    setPreviewTheme(null);
    setEditingTheme(null);
    toast("Pré-visualização resetada para o tema ativo", "info");
  };

  // Launch editing panel for custom or new themes
  const handleStartCustomizer = (themeToEdit?: ThemeConfig) => {
    if (themeToEdit) {
      setEditingTheme({ ...themeToEdit });
      setPreviewTheme(themeToEdit);
    } else {
      const defaultNew: Partial<ThemeConfig> = {
        id: 'new',
        name: 'Novo Tema Personalizado',
        isCustom: true,
        primaryColor: '#D32F2F',
        secondaryColor: '#0A0A0A',
        backgroundColor: '#0A0A0A',
        cardColor: '#161616',
        buttonColor: '#D32F2F',
        linkColor: '#FFFFFF',
        highlightColor: '#D32F2F',
        primaryTextColor: '#ffffff',
        secondaryTextColor: '#ffffff',
        backgroundTextColor: '#ffffff',
        cardTextColor: '#ffffff',
        buttonTextColor: '#ffffff',
        linkTextColor: '#ffffff',
        highlightTextColor: '#ffffff',
        scheduled: false,
        startDate: null,
        endDate: null
      };
      setEditingTheme(defaultNew);
      setPreviewTheme(defaultNew as ThemeConfig);
    }
    setActiveTab('customizer');
  };

  // Save changes to Firestore custom theme collection
  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTheme || !editingTheme.name) {
      toast("Por favor, preencha o nome do tema.", "error");
      return;
    }

    // Schedule validations
    if (editingTheme.scheduled) {
      if (!editingTheme.startDate || !editingTheme.endDate) {
        toast("Por favor, configure as datas de Início e Fim para o agendamento.", "error");
        return;
      }
      const start = new Date(editingTheme.startDate);
      const end = new Date(editingTheme.endDate);
      if (start >= end) {
        toast("A data de início deve ser anterior à data de término.", "error");
        return;
      }
    }

    try {
      setSaving(true);
      const userMail = userData?.email || 'Admin';
      const savedId = await saveCustomTheme(editingTheme as ThemeConfig);
      toast(`Tema "${editingTheme.name}" salvo com sucesso!`, "success");
      
      // Update local state with the newly created ID
      setEditingTheme(prev => prev ? { ...prev, id: savedId } : null);
      await loadLogs();
    } catch (err) {
      console.error(err);
      toast("Falha ao salvar configuração do tema.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Duplicate a custom/premade template quickly
  const handleDuplicateTheme = (theme: ThemeConfig) => {
    const duplicated: Partial<ThemeConfig> = {
      ...theme,
      id: 'new',
      name: `${theme.name} (Cópia)`,
      isCustom: true,
      scheduled: false,
      startDate: null,
      endDate: null
    };
    setEditingTheme(duplicated);
    setPreviewTheme(duplicated as ThemeConfig);
    setActiveTab('customizer');
    toast(`Cópia criada para editar: "${duplicated.name}"`, "info");
  };

  // Deletion helper for custom theme records
  const handleDeleteTheme = async (id: string, name: string) => {
    if (!window.confirm(`Você tem certeza que quer excluir o tema "${name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      setSaving(true);
      await deleteCustomTheme(id, name);
      toast(`Tema "${name}" foi excluído com sucesso.`, "success");
      
      // Revert preview if we deleted the current previewed item
      if (previewTheme?.id === id) {
        setPreviewTheme(null);
        setEditingTheme(null);
      }
      await loadLogs();
    } catch (err) {
      console.error(err);
      toast("Erro ao excluir tema.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Returns true if current theme is currently being scheduled
  const isScheduledNow = (theme: ThemeConfig): boolean => {
    if (!theme.scheduled || !theme.startDate || !theme.endDate) return false;
    const now = new Date();
    const start = new Date(theme.startDate);
    const end = new Date(theme.endDate);
    return now >= start && now <= end;
  };

  // Filters themes on search query
  const filteredThemes = allThemes.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-red-650 font-bold uppercase tracking-widest text-[11px]">
            <Palette size={14} />
            CONTEÚDO E APARÊNCIA
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Gerenciador de Temas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personalize as cores, botões e campanhas sazonais da Discreta Boutique.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {previewTheme && (
            <button
              onClick={handleCancelPreview}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <RotateCcw size={14} className="animate-spin-slow" />
              Cancelar Preview
            </button>
          )}
          <button
            onClick={() => handleStartCustomizer()}
            className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)] hover:scale-[1.02] cursor-pointer"
          >
            <Plus size={16} />
            Novo Tema
          </button>
        </div>
      </div>

      {/* ACTIVE THEME CURRENT STATUS & PREVIEW CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* STATS & QUICK VIEW BLOCK */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Tema Aplicado Agora
              </span>
              {isScheduledNow(currentTheme) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  <Clock size={10} />
                  Programado Ativo
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  Tema Padrão
                </span>
              )}
            </div>

            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              {currentTheme.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentTheme.isCustom ? 'Tema personalizado criado pelo usuário.' : 'Tema de biblioteca padrão do sistema.'}
            </p>

            {currentTheme.scheduled && currentTheme.startDate && currentTheme.endDate && (
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 mt-4 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar size={13} />
                  <span>Ativo de: <strong className="text-slate-800 dark:text-slate-200">{new Date(currentTheme.startDate).toLocaleString()}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={13} />
                  <span>Até: <strong className="text-slate-800 dark:text-slate-200">{new Date(currentTheme.endDate).toLocaleString()}</strong></span>
                </div>
              </div>
            )}

            {/* COLOR MATRIX */}
            <div className="grid grid-cols-4 gap-2 mt-5">
              {[
                { label: 'Primária', val: currentTheme.primaryColor },
                { label: 'Secund.', val: currentTheme.secondaryColor },
                { label: 'Fundo', val: currentTheme.backgroundColor },
                { label: 'Cards', val: currentTheme.cardColor },
                { label: 'Botões', val: currentTheme.buttonColor },
                { label: 'Links', val: currentTheme.linkColor },
                { label: 'Destaque', val: currentTheme.highlightColor },
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center bg-slate-50 dark:bg-slate-950/60 rounded-xl p-2 border border-slate-100 dark:border-slate-800/40">
                  <div 
                    className="w-8 h-8 rounded-full border border-black/20 shadow-inner mb-1"
                    style={{ backgroundColor: item.val }}
                  />
                  <span className="text-[9px] font-semibold text-slate-400 truncate w-full text-center">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 mt-6 pt-4 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
            <AlertCircle size={15} className="text-slate-500 shrink-0 mt-0.5" />
            <span>Mudanças aplicadas aqui atualizam em tempo real nas páginas dos clientes sem precisar de deploys.</span>
          </div>
        </div>

        {/* INTERACTIVE STORE-FRONT MINI PREVIEW CONTAINER */}
        <div className="lg:col-span-8 bg-zinc-950 rounded-[2rem] border border-zinc-900 p-6 flex flex-col justify-between shadow-2xl overflow-hidden relative min-h-[300px]">
          <div className="absolute top-2 right-4 text-[9px] uppercase tracking-widest text-zinc-600 font-bold flex items-center gap-1.5">
            <Eye size={12} />
            Live Preview Sincronizado
          </div>

          <div>
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-4">
              Simulador do Catálogo e Botões (Tempo Real)
            </span>

            {/* Simulated Header */}
            <div 
              className="rounded-2xl p-4 flex items-center justify-between border border-zinc-900 shadow-lg text-sm font-bold"
              style={{ backgroundColor: currentTheme.backgroundColor, color: currentTheme.backgroundTextColor }}
            >
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800 font-black text-red-500">DB</span>
                <span className="text-xs uppercase tracking-tight">Discreta Boutique</span>
              </div>
              <div className="flex gap-4 text-[11px] uppercase tracking-wider">
                <span style={{ color: currentTheme.linkColor }}>Home</span>
                <span style={{ color: currentTheme.linkColor }} className="opacity-70">Lingerie</span>
                <span style={{ color: currentTheme.linkColor }} className="opacity-70">Acessórios</span>
              </div>
            </div>

            {/* Simulated Banner or Tagline */}
            <div 
              className="mt-4 p-4 rounded-2xl border text-center flex flex-col items-center justify-center"
              style={{ 
                backgroundColor: currentTheme.cardColor, 
                borderColor: currentTheme.primaryColor,
                color: currentTheme.cardTextColor
              }}
            >
              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1" style={{ backgroundColor: currentTheme.highlightColor, color: currentTheme.highlightTextColor }}>
                Campanha Sazonal Ativa
              </span>
              <h3 className="text-xs font-black uppercase tracking-tight">Sua noite merece mais autoestima & romance</h3>
              <p className="text-[10px] opacity-70 mt-0.5">Sedução e discrição absoluta direto na sua casa</p>
            </div>

            {/* Simulated Products Grid */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[
                { name: 'Conjunto Renda Lux', price: 'R$ 129,90', originalPrice: 'R$ 159,90', badge: 'Sexy' },
                { name: 'Vibrador Bullet Intimate', price: 'R$ 89,90', originalPrice: null, badge: 'Popular' }
              ].map((prod, i) => (
                <div 
                  key={i}
                  className="rounded-2xl p-3 border border-zinc-900/50 flex flex-col gap-2 relative shadow-md"
                  style={{ backgroundColor: currentTheme.cardColor, color: currentTheme.cardTextColor }}
                >
                  {prod.badge && (
                    <span 
                      className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: currentTheme.primaryColor, color: currentTheme.primaryTextColor }}
                    >
                      {prod.badge}
                    </span>
                  )}
                  {/* Mock Image Box */}
                  <div className="w-full h-16 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                    <Palette size={20} style={{ color: currentTheme.primaryColor }} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold truncate">{prod.name}</h4>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xs font-black" style={{ color: currentTheme.primaryColor }}>{prod.price}</span>
                      {prod.originalPrice && <span className="text-[9px] opacity-50 line-through">{prod.originalPrice}</span>}
                    </div>
                  </div>
                  
                  {/* Purchase CTA buttons dynamically listening */}
                  <button 
                    disabled 
                    className="w-full text-[9px] font-black uppercase py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-md"
                    style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                  >
                    Comprar Agora
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500">
            <span>Elemento Ativo: <strong className="text-zinc-200">{previewTheme ? `PREVIEW (${previewTheme.name})` : 'TEMA ATUAL DA PRODUÇÃO'}</strong></span>
            {previewTheme && (
              <span className="text-amber-500 font-bold uppercase animate-pulse">Sem salvar ainda - Modo Visualizer</span>
            )}
          </div>
        </div>

      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('themes')}
          className={`px-4 py-2.5 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'themes'
              ? 'border-red-650 text-red-650'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Biblioteca de Temas
        </button>
        <button
          onClick={() => handleStartCustomizer()}
          className={`px-4 py-2.5 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'customizer'
              ? 'border-red-650 text-red-650'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Customizador / Editor
        </button>
        <button
          onClick={() => { setActiveTab('logs'); loadLogs(); }}
          className={`px-4 py-2.5 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-red-650 text-red-650'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Histórico / Logs
        </button>
      </div>

      {/* TAB CONTENT PANEL */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: ALL THEMES LIST */}
        {activeTab === 'themes' && (
          <motion.div
            key="themes-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Filter and search */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 max-w-md shadow-sm">
              <ListFilter size={16} className="text-slate-400 shrink-0 mr-3" />
              <input
                type="text"
                placeholder="Filtrar temas por nome..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-xs focus:ring-0 text-slate-850 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Themes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredThemes.map((theme) => {
                const isCurrentlyActive = currentTheme.id === theme.id;
                const isScheduledActive = isScheduledNow(theme);
                
                return (
                  <div 
                    key={theme.id}
                    className={`bg-white dark:bg-slate-900 rounded-[2rem] border p-5 flex flex-col justify-between transition-all duration-300 relative group/card ${
                      isCurrentlyActive 
                        ? 'border-red-600/60 ring-2 ring-red-600/10' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-zinc-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                          theme.isCustom 
                            ? 'bg-blue-500/20 text-blue-500' 
                            : 'bg-indigo-500/20 text-indigo-500'
                        }`}>
                          {theme.isCustom ? 'Personalizado' : 'Sistema'}
                        </span>
                        
                        <div className="flex gap-1.5">
                          {isCurrentlyActive && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                              Ativo
                            </span>
                          )}
                          {isScheduledActive && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-500 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                              <Calendar size={10} />
                              Ativo Sazonal
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {theme.name}
                      </h3>

                      {theme.scheduled && theme.startDate && theme.endDate && (
                        <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1.5">
                          <Clock size={11} />
                          <span>Sazonal Programado</span>
                        </div>
                      )}

                      {/* Small Theme Palette Bar preview */}
                      <div className="flex gap-1 mt-4">
                        {[
                          theme.primaryColor,
                          theme.secondaryColor,
                          theme.backgroundColor,
                          theme.cardColor,
                          theme.buttonColor,
                          theme.linkColor,
                          theme.highlightColor
                        ].map((col, cIdx) => (
                          <div 
                            key={cIdx} 
                            className="flex-1 h-3 rounded-full border border-black/10" 
                            style={{ backgroundColor: col }}
                            title={col}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800/60 mt-5 pt-4 flex gap-2">
                      <button
                        onClick={() => selectThemeTemplate(theme)}
                        className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Ver no Simulador"
                      >
                        <Eye size={12} />
                        Simular
                      </button>

                      <button
                        onClick={() => handleActivateTheme(theme)}
                        disabled={isCurrentlyActive && !isScheduledActive}
                        className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isCurrentlyActive && !isScheduledActive
                            ? 'bg-slate-100 dark:bg-slate-950 text-slate-400 cursor-not-allowed border border-dotted border-slate-300 dark:border-slate-800'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/10'
                        }`}
                      >
                        <Check size={12} />
                        Ativar
                      </button>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDuplicateTheme(theme)}
                          className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 rounded-xl transition-all cursor-pointer"
                          title="Duplicar Tema"
                        >
                          <Copy size={12} />
                        </button>

                        {theme.isCustom && (
                          <>
                            <button
                              onClick={() => handleStartCustomizer(theme)}
                              className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 rounded-xl transition-all cursor-pointer"
                              title="Editar Tema"
                            >
                              <Sliders size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTheme(theme.id, theme.name)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl transition-all cursor-pointer"
                              title="Excluir Tema"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}

              {filteredThemes.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-100 dark:bg-slate-950 rounded-[22px] border border-dashed text-xs text-slate-400 font-bold space-y-1">
                  <Palette size={32} className="mx-auto text-slate-500 mb-2 animate-bounce-slow" />
                  <p>Nenhum tema coincide com sua pesquisa.</p>
                  <button onClick={() => setSearchQuery('')} className="text-red-500 underline uppercase text-[10px] mt-1 hover:text-red-600 cursor-pointer">
                    Limpar Filtro
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: ACTIVE CUSTOMIZER FORM */}
        {activeTab === 'customizer' && (
          <motion.div
            key="customizer-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8"
          >
            {editingTheme ? (
              <form onSubmit={handleSaveTheme} className="space-y-6">
                
                {/* Form Title */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                    {editingTheme.id === 'new' ? 'Criar Novo Tema Sazonal' : `Editando: ${editingTheme.name}`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Defina o nome do tema e selecione as cores usando os seletores de cores do navegador.
                  </p>
                </div>

                {/* Form Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Name field */}
                  <div className="col-span-full">
                    <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2">
                      Nome do Tema Sazonal / Campanha
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-950 border text-slate-850 dark:text-white border-slate-200 dark:border-slate-800"
                      placeholder="Ex: Campanha Dia dos Namorados, Liquidação de Inverno..."
                      value={editingTheme.name || ''}
                      onChange={e => handleFieldChange('name', e.target.value)}
                    />
                  </div>

                  {/* Primary Color Pickers */}
                  <div className="space-y-4 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Cores Principais
                    </span>

                    {/* Primary */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor Primária</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Usada nos botões principais e tags.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.primaryColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.primaryColor || '#D32F2F'}
                          onChange={e => handleFieldChange('primaryColor', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Secondary */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor Secundária</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Bordas, sublinhas e ícones secundários.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.secondaryColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.secondaryColor || '#0A0A0A'}
                          onChange={e => handleFieldChange('secondaryColor', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Button */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor dos Botões</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">CTA principal (Comprar, Ver Mais, Adicionar).</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.buttonColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.buttonColor || '#D32F2F'}
                          onChange={e => handleFieldChange('buttonColor', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Surface and Layout Pickers */}
                  <div className="space-y-4 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Fundo e Estrutura
                    </span>

                    {/* Background */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor de Fundo</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Cor de fundo do site e catálogo global.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.backgroundColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.backgroundColor || '#0A0A0A'}
                          onChange={e => handleFieldChange('backgroundColor', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor dos Cards</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Contêineres de produtos, ofertas e modais.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.cardColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.cardColor || '#161616'}
                          onChange={e => handleFieldChange('cardColor', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor dos Links</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Menus, rodape e hiperlinks principais.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.linkColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.linkColor || '#FFFFFF'}
                          onChange={e => handleFieldChange('linkColor', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Highlight Color */}
                  <div className="col-span-full md:col-span-1 space-y-4 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Destaques e Ofertas
                    </span>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">Cor de Destaque</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Selos de promoção, porcentagem de desconto.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 text-slate-500">{editingTheme.highlightColor}</span>
                        <input
                          type="color"
                          className="w-8 h-8 rounded-full border-none cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                          value={editingTheme.highlightColor || '#D32F2F'}
                          onChange={e => handleFieldChange('highlightColor', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CONTRAST AUTO-INFO COMPONENT */}
                  <div className="col-span-full md:col-span-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border text-xs leading-relaxed space-y-2">
                    <div className="flex items-center gap-2 text-red-650 font-bold uppercase tracking-wider text-[10px]">
                      <Sparkles size={14} className="animate-pulse" />
                      Calculador de Contraste Inteligente
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      O sistema calcula automaticamente a melhor cor para o texto dependendo de cada cor que você selecionar para garantir alta legibilidade do catálogo sob as diretrizes de acessibilidade e design.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-2.5 py-1 bg-zinc-900 border text-white font-mono rounded-lg">Fundo Escuro &rarr; Texto Branco</span>
                      <span className="px-2.5 py-1 bg-white border text-black font-auto rounded-lg">Fundo Claro &rarr; Texto Preto</span>
                    </div>
                  </div>

                  {/* BRANDING, PWA, AND SOCIAL IDENTITY */}
                  <div className="col-span-full space-y-4 bg-slate-50/50 dark:bg-slate-950/40 p-5 rounded-[22px] border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wide border-b dark:border-slate-800 pb-2.5">
                      <ImageIcon size={15} className="text-red-650" />
                      Identidade Visual e Compartilhamento
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Name/ShortName for PWA */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                            Nome do App (PWA)
                          </label>
                          <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border text-slate-850 dark:text-white"
                            placeholder="Ex: Discreta Boutique"
                            value={editingTheme.branding?.appName || 'Discreta Boutique'}
                            onChange={e => handleFieldChange('branding', { ...editingTheme.branding, appName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                            Nome Curto (PWA)
                          </label>
                          <input
                            type="text"
                            className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border text-slate-850 dark:text-white"
                            placeholder="Ex: Discreta"
                            value={editingTheme.branding?.shortName || 'Discreta'}
                            onChange={e => handleFieldChange('branding', { ...editingTheme.branding, shortName: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Social Preview Image Component */}
                      <div className="space-y-3 col-span-full xl:col-span-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Imagem de Compartilhamento (Open Graph)
                        </label>
                        <p className="text-[10px] text-slate-400">Recomendado: 1200x630 px • Proporção 1.91:1. Usado em WhatsApp, Facebook, Instagram.</p>
                        <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center min-h-[160px]">
                          {(() => {
                            let sg = editingTheme.branding?.socialPreviewImage;
                            let urlSg = typeof sg === 'string' ? sg : sg?.url;
                            if (urlSg) {
                              return <img src={urlSg} alt="Social Preview" className="w-full h-full object-cover" />;
                            }
                            return (
                              <div className="text-center p-4">
                                <Globe className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                                <p className="text-[10px] font-bold text-slate-400 capitalize">Nenhuma imagem personalizada (usará Padrão)</p>
                              </div>
                            );
                          })()}
                          <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageUpload('socialPreviewImage', e.target.files[0]);
                              }
                            }} />
                            <div className="text-white text-[10px] uppercase font-black flex items-center gap-2 bg-red-600 px-4 py-2 rounded-xl">
                              <UploadCloud size={14} /> Substituir (1200x630)
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Icon Grid */}
                      <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-6 mt-4 border-t dark:border-slate-800 pt-6">
                        {[
                          { key: 'logoHorizontal', label: 'Logo Horizontal', help: 'Cabeçalho e Rodapé. Prop. 4:1 (ex: 1200x300)' },
                          { key: 'logoSquare', label: 'Logo Quadrada', help: 'Splash screen, Fallback. Prop 1:1 (ex: 1024x1024)' },
                          { key: 'favicon', label: 'Favicon', help: 'Aba do navegador. Prop 1:1 (64x64 ou 128x128)' },
                          { key: 'icon192', label: 'Ícone PWA 192', help: 'Android PWA. Obrigatório 192x192' },
                          { key: 'icon512', label: 'Ícone PWA 512', help: 'Android Splash. Obrigatório 512x512' },
                          { key: 'maskableIcon', label: 'Maskable Icon', help: 'Android adaptável. Centralizado, 512x512' },
                          { key: 'appleTouchIcon', label: 'Apple Touch', help: 'iPhone/iPad Home. Obrigatório 180x180' }
                        ].map(item => {
                          const val = editingTheme.branding?.[item.key as keyof NonNullable<ThemeConfig['branding']>];
                          const url = typeof val === 'string' ? val : val?.url;

                          return (
                            <div key={item.key} className="space-y-2 flex flex-col">
                              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">{item.label}</label>
                              <p className="text-[9px] text-slate-400 text-center flex-grow leading-tight">{item.help}</p>
                              <div className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-2">
                                {url ? (
                                  <img src={url} alt={item.label} className="w-full h-full object-contain drop-shadow-sm" />
                                ) : (
                                  <ImageIcon className="text-slate-200 dark:text-slate-800" size={32} />
                                )}
                                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                                  <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleImageUpload(item.key as keyof NonNullable<ThemeConfig['branding']>, e.target.files[0]);
                                    }
                                  }} />
                                  <UploadCloud size={20} className="mb-1" />
                                  <span className="text-[9px] font-bold uppercase">Trocar</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Header Previews */}
                      <div className="col-span-full mt-6 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-5">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2"><Eye size={14}/> Pré-visualização do Cabeçalho</h4>
                        <div className="flex flex-col xl:flex-row gap-6">
                          <div className="flex-1 border bg-white dark:bg-slate-950 rounded-xl overflow-hidden border-slate-200 dark:border-slate-700">
                             <div className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold uppercase py-1 text-center text-slate-400 border-b dark:border-slate-700">Desktop</div>
                             <div className="flex px-6 h-[72px] items-center" style={{ backgroundColor: editingTheme.backgroundColor }}>
                               {(() => {
                                  const img = editingTheme.branding?.logoHorizontal;
                                  const url = typeof img === 'string' ? img : img?.url;
                                  if (url) return <img src={url} className="h-10 w-auto object-contain" alt="Logo" />;
                                  return <span className="font-black text-xl text-white">Discreta Boutique</span>;
                               })()}
                             </div>
                          </div>
                          
                          <div className="w-[200px] mx-auto border bg-white dark:bg-slate-950 rounded-[28px] overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                             <div className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold uppercase py-1 text-center text-slate-400 border-b dark:border-slate-700">Mobile</div>
                             <div className="flex px-4 h-32 items-end pb-4 justify-center" style={{ backgroundColor: editingTheme.backgroundColor }}>
                               {(() => {
                                  const img = editingTheme.branding?.logoHorizontal || editingTheme.branding?.logoSquare;
                                  const url = typeof img === 'string' ? img : img?.url;
                                  if (url) return <img src={url} className="h-8 w-auto object-contain" alt="Logo" />;
                                  return <span className="font-black text-sm text-white drop-shadow-md">Discreta</span>;
                               })()}
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Social Preview Box */}
                      <div className="col-span-full p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-wider flex items-center gap-2"><Globe size={14}/> Pré-visualização Open Graph (WhatsApp)</h4>
                        <div className="max-w-[320px] border border-[#25D366]/20 rounded-xl overflow-hidden bg-[#E1F3DB] dark:bg-[#071E10] shadow-sm">
                          {(() => {
                            let sg = editingTheme.branding?.socialPreviewImage;
                            let urlSg = typeof sg === 'string' ? sg : sg?.url;
                            return (
                              <img src={urlSg || 'https://discretaboutique.com.br/default-share-image.jpg'} alt="Preview" className="w-full aspect-[1.91/1] object-cover border-b border-[#25D366]/20" />
                            );
                          })()}
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-green-950 dark:text-green-100 truncate">{editingTheme.branding?.appName || 'Discreta Boutique'}</h3>
                            <p className="text-xs text-green-800 dark:text-green-400 mt-1 line-clamp-2">A boutique íntima mais elegante e discreta de Icó-CE. Compre com sigilo absoluto.</p>
                            <p className="text-[10px] text-green-600 dark:text-green-600 font-medium mt-2 flex items-center gap-1">discretaboutique.com.br</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SCHEDULING OF THEME BLOCK */}
                  <div className="col-span-full bg-slate-50 dark:bg-slate-950/60 p-5 rounded-[22px] border space-y-4">
                    <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wide">
                        <Calendar size={15} className="text-red-650" />
                        Agendar Ativação Automática (Opcional)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Ativar Agendamento:</span>
                        <input
                          type="checkbox"
                          id="scheduled"
                          className="w-4 h-4 text-red-600 rounded cursor-pointer"
                          checked={editingTheme.scheduled || false}
                          onChange={e => handleFieldChange('scheduled', e.target.checked)}
                        />
                      </div>
                    </div>

                    {editingTheme.scheduled ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                            Data e Hora de Início
                          </label>
                          <input
                            type="datetime-local"
                            className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-900 border text-slate-850 dark:text-white"
                            value={editingTheme.startDate || ''}
                            onChange={e => handleFieldChange('startDate', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                            Data e Hora de Fim (Expiração)
                          </label>
                          <input
                            type="datetime-local"
                            className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-900 border text-slate-850 dark:text-white"
                            value={editingTheme.endDate || ''}
                            onChange={e => handleFieldChange('endDate', e.target.value)}
                          />
                        </div>
                        <p className="col-span-full text-[10px] text-amber-500 leading-relaxed font-semibold">
                          * Nota: Ao estourar o tempo programado final, a Discreta Boutique retornará automaticamente ao Tema Padrão sem necessidade de nenhuma intervenção manual.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Este tema está configurado para ativação contínua direta, sem intervalos agendados de data.
                      </p>
                    )}
                  </div>

                </div>

                {/* Form CTA Buttons */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Resetar Editor
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase border border-zinc-800 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    {saving ? 'Gravando...' : 'Salvar Tema'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActivateTheme(editingTheme as ThemeConfig)}
                    disabled={saving || !editingTheme.name}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-black uppercase transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)] cursor-pointer"
                  >
                    Ativar Agora
                  </button>
                </div>

              </form>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                <p>Nenhum tema foi selecionado para personalização rápida.</p>
                <button
                  onClick={() => handleStartCustomizer()}
                  className="mt-3 px-4 py-2 bg-red-650 hover:bg-red-750 text-white font-black uppercase rounded-lg tracking-wider text-[10px] cursor-pointer"
                >
                  Novo Tema do Zero
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: AUDIT LOGS HISTORY */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Registro de Alterações do Tema
                </h3>
                <p className="text-xs text-slate-500">
                  Logs auditáveis obrigatórios registrando quem ativou e alterou os temas.
                </p>
              </div>
              <button 
                onClick={loadLogs}
                className="p-2 border rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                title="Recarregar logs"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[400px] overflow-y-auto pr-2">
              {logs.map((log) => (
                <div key={log.id} className="py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase">
                      {(log.userName || 'U').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white truncate">
                        {log.userName || 'Sistema'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Ação: <strong className="text-red-500 uppercase tracking-widest text-[9px] bg-red-500/10 px-1.5 py-0.2 rounded-md">{log.action || 'Alteração'}</strong>
                      </p>
                      <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5 font-medium leading-relaxed">
                        {log.details?.themeName ? `Tema envolvido: "${log.details.themeName}"` : 'Alterações nas configurações globais de estilo.'}
                        {log.details?.previousTheme && ` (Trocado de: "${log.details.previousTheme}")`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 font-mono shrink-0 text-left sm:text-right flex sm:flex-col gap-1 items-center sm:items-end">
                    <Clock size={11} className="sm:hidden" />
                    <span>{log.createdAt ? (log.createdAt.toDate ? log.createdAt.toDate().toLocaleString() : new Date(log.createdAt).toLocaleString()) : 'Agora'}</span>
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum registro de log para o gerenciador de temas encontrado.
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
export default AdminThemeManager;
