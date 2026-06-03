import { useState, useEffect } from 'react';
import { useTypography, APPROVED_FONTS, TYPOGRAPHY_PRESETS, TypographyConfig } from '../../contexts/TypographyContext';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Button } from '../../components/ui/button';
import { Check, RotateCcw, Save, Sparkles, Type, Eye, Palette, Sliders, Type as FontIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../contexts/ThemeContext';

export function AdminTypography() {
  const { config, saveTypography, resetToDefault, loading } = useTypography();
  const { hasPermission } = useAuthStore();
  const { toast } = useFeedback();
  const { currentTheme } = useTheme();

  const canEdit = hasPermission('settings', 'editar');

  // Internal form state for real-time adjustments before saving
  const [formData, setFormData] = useState<TypographyConfig>(config);
  const [activePreset, setActivePreset] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Sync internal state when DB configuration changes
  useEffect(() => {
    if (config) {
      setFormData(config);
      // Try to determine if the loaded config matches any pre-configured preset
      const matched = TYPOGRAPHY_PRESETS.find(preset => {
        return (
          preset.config.titles === config.titles &&
          preset.config.products === config.products &&
          preset.config.prices === config.prices &&
          preset.config.buttons === config.buttons &&
          preset.config.menus === config.menus &&
          preset.config.banners === config.banners &&
          preset.config.general === config.general &&
          preset.config.brandColor === config.brandColor &&
          preset.config.brandSize === config.brandSize &&
          preset.config.brandLetterSpacing === config.brandLetterSpacing
        );
      });
      if (matched) {
        setActivePreset(matched.id);
      } else {
        setActivePreset('');
      }
    }
  }, [config]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] gap-4 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
        <p className="text-xs uppercase font-bold tracking-widest">Carregando Identidade Tipográfica...</p>
      </div>
    );
  }

  const handleFieldChange = (key: keyof TypographyConfig, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: value };
      setActivePreset(''); // User custom adjusted, clear active preset mark
      return updated;
    });
  };

  const handleSelectPreset = (presetId: string, presetConfig: TypographyConfig) => {
    setFormData(presetConfig);
    setActivePreset(presetId);
    toast(`Preset "${TYPOGRAPHY_PRESETS.find(p => p.id === presetId)?.name}" carregado! Veja a pré-visualização ao lado.`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTypography(formData);
      toast('Configuração tipográfica atualizada com sucesso! Todas as páginas públicas estão sincronizadas.');
    } catch (e) {
      console.error(e);
      toast('Erro fatal ao salvar configurações tipográficas', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Deseja realmente restaurar as fontes para o padrão clássico da boutique?')) return;
    try {
      await resetToDefault();
      toast('Fontes padrão restauradas!');
    } catch {
      toast('Falha ao restaurar fontes', 'error');
    }
  };

  // Build a Google Font URL snippet specifically for the preview container
  const uniquePreviewFonts = Array.from(new Set([
    formData.titles,
    formData.products,
    formData.prices,
    formData.buttons,
    formData.menus,
    formData.banners,
    formData.general
  ]));
  const previewFontsQuery = uniquePreviewFonts.map(f => f.replace(/ /g, '+')).map(f => `family=${f}:wght@450;500;700;800;900`).join('&');
  const previewFontsLink = `https://fonts.googleapis.com/css2?${previewFontsQuery}&display=swap`;

  const getFontChain = (fontName: string) => APPROVED_FONTS[fontName] || APPROVED_FONTS['DM Sans'];

  return (
    <div className="flex flex-col gap-8 w-full pb-20">
      {/* Dynamic Font Loader specifically for this preview screen */}
      <link rel="stylesheet" href={previewFontsLink} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Tipografia da Loja</h1>
          <p className="text-sm text-slate-500">
            Gerencie e personalize de forma centralizada toda a identidade visual e fontes utilizadas nas páginas públicas.
          </p>
        </div>
        
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleReset}
              className="dark:border-slate-800 dark:hover:bg-slate-900 text-xs gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Padrão
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white text-xs gap-2 shadow-lg shadow-red-900/10"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Gravando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Adjustment Column */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* Quick Presets Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-red-500" />
              Presets de Tipografia Recomendados
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Escolha uma combinação projetada por nossos designers de marca para harmonizar perfeitamente a leitura com o tema ativo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPOGRAPHY_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id, preset.config)}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-xl border transition-all hover:scale-[1.01] active:scale-95 cursor-pointer relative overflow-hidden",
                      isActive
                        ? "bg-red-500/10 border-red-500 text-slate-900 dark:text-white dark:border-red-500 shadow-md"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <span className="font-bold text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                      {preset.description}
                    </span>
                    <div className="mt-3 flex gap-1 items-center flex-wrap">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 font-mono">
                        Titles: {preset.config.titles}
                      </span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 font-mono">
                        Body: {preset.config.general}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Centralized Category Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-base font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FontIcon className="w-4 h-4 text-red-500" />
              Customização Individual por Área
            </h2>

            <div className="flex flex-col gap-5">
              {/* Titles Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Títulos Principais (H1 - H6)
                  </label>
                  <p className="text-[11px] text-slate-500">Páginas de destaque, seções e cabeçalhos.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.titles}
                    onChange={(e) => handleFieldChange('titles', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Products Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Nomes de Produtos
                  </label>
                  <p className="text-[11px] text-slate-500">Títulos de produtos no catálogo, grids e carrosséis.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.products}
                    onChange={(e) => handleFieldChange('products', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Prices Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Preços & Valores
                  </label>
                  <p className="text-[11px] text-slate-500">Destaque de valores, parcelamentos e Pix.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.prices}
                    onChange={(e) => handleFieldChange('prices', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Buttons Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Botões de Ação
                  </label>
                  <p className="text-[11px] text-slate-500">Comprar agora, Adicionar e CTAs principais.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.buttons}
                    onChange={(e) => handleFieldChange('buttons', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Menus Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Links & Menus Comerciais
                  </label>
                  <p className="text-[11px] text-slate-500">Navegação superior, rodapé e abas de categorias.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.menus}
                    onChange={(e) => handleFieldChange('menus', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Banners Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Banners e Promoções
                  </label>
                  <p className="text-[11px] text-slate-500">Títulos e slogans dentro dos cards promocionais.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.banners}
                    onChange={(e) => handleFieldChange('banners', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* General Text Select */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    Textos Gerais & Descrições
                  </label>
                  <p className="text-[11px] text-slate-500">Parágrafos de suporte, informativos e descrições.</p>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={formData.general}
                    onChange={(e) => handleFieldChange('general', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    {Object.keys(APPROVED_FONTS).map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Special Brand Identity Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Sliders className="w-4 h-4 text-red-500" />
              Identidade da Logomarca (DISCRETA)
            </h2>
            <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 mb-6">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                🔒 <span className="font-bold text-red-600">Regra de Segurança da Identidade:</span> A tipografia clássica da marca <span className="italic font-bold">DISCRETA</span> é fixa para garantir integridade e consistência da logo. No entanto, você pode ajustar as propriedades de tamanho, cor de destaque e espaçamento entre letras.
              </p>
            </div>

            <div className="space-y-6">
              {/* Color picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cor de Destaque da Logo</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={formData.brandColor}
                    onChange={(e) => handleFieldChange('brandColor', e.target.value)}
                    className="w-12 h-10 rounded-lg p-0 bg-transparent border border-slate-200 dark:border-slate-800 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.brandColor}
                    onChange={(e) => handleFieldChange('brandColor', e.target.value)}
                    placeholder="#hexcode"
                    maxLength={7}
                    className="h-10 px-3 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-lg text-xs font-mono font-bold w-32 text-center"
                  />
                  {/* Quick Color Pickers for theme sync */}
                  <button
                    type="button"
                    onClick={() => handleFieldChange('brandColor', currentTheme.primaryColor)}
                    className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Usar Cor Primária ({currentTheme.primaryColor})
                  </button>
                </div>
              </div>

              {/* Logo Size */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tamanho da Logo (px)</label>
                  <span className="text-[11px] font-mono font-bold">{formData.brandSize}</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="42"
                  value={parseInt(formData.brandSize, 10) || 24}
                  onChange={(e) => handleFieldChange('brandSize', `${e.target.value}px`)}
                  className="w-full accent-red-650 h-2 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Letter spacing slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Espaçamento entre Letras (Letter Spacing)</label>
                  <span className="text-[11px] font-mono font-bold">{formData.brandLetterSpacing}</span>
                </div>
                <select
                  value={formData.brandLetterSpacing}
                  onChange={(e) => handleFieldChange('brandLetterSpacing', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:border-slate-800 border rounded-xl h-10 px-3 text-xs font-bold"
                >
                  <option value="-0.08em">Estreito Extra (-0.08em)</option>
                  <option value="-0.05em">Estreito Clássico (-0.05em)</option>
                  <option value="-0.02em">Médio Estreito (-0.02em)</option>
                  <option value="0em">Normal (0em)</option>
                  <option value="0.05em">Espaçamento Suave (0.05em)</option>
                  <option value="0.1em">Espaçamento Moderado (0.1em)</option>
                  <option value="0.15em">Espaçamento Premium (0.15em)</option>
                  <option value="0.2em">Espaçamento Luxo (0.2em)</option>
                  <option value="0.3em">Brutalist (/0.3em)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Box / Showcase */}
        <div className="xl:col-span-5 lg:sticky lg:top-24 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-xl overflow-hidden p-6 relative">
            <h2 className="text-xs font-black uppercase tracking-[3px] text-red-500 mb-6 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Pré-Visualização em Tempo Real (Área Pública)
            </h2>

            <div className="bg-black/40 rounded-xl p-5 border border-white/5 space-y-6">
              {/* Header Showcase */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                {/* Simulated navigation */}
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ fontFamily: getFontChain(formData.menus) }}>
                  <span>Início</span>
                  <span>Produtos</span>
                </div>

                {/* Brand Logo Lock */}
                <span 
                  className="italic uppercase font-extrabold select-none"
                  style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    color: formData.brandColor,
                    fontSize: formData.brandSize,
                    letterSpacing: formData.brandLetterSpacing
                  }}
                >
                  DISCRETA
                </span>

                <div className="flex gap-2 text-[10px] font-bold uppercase opacity-60" style={{ fontFamily: getFontChain(formData.menus) }}>
                  <span>Sacola</span>
                </div>
              </div>

              {/* Banner / Category showcase */}
              <div className="rounded-lg p-5 bg-gradient-to-tr from-red-900/40 via-red-950/20 to-transparent border border-red-500/10 text-center relative overflow-hidden">
                <span className="text-[9px] font-bold uppercase tracking-[2px] text-red-400 mb-1 block" style={{ fontFamily: getFontChain(formData.general) }}>
                  Nova Coleção Exclusiva
                </span>
                <h3 className="text-lg font-black uppercase leading-tight mb-2 tracking-tight block" style={{ fontFamily: getFontChain(formData.banners) }}>
                  A Arte Segura da Sedução
                </h3>
                <p className="text-[10px] text-slate-300 leading-normal max-w-xs mx-auto" style={{ fontFamily: getFontChain(formData.general) }}>
                  Descubra itens premium formulados sob sigilo absoluto e materiais hipoalergênicos importados.
                </p>
              </div>

              {/* Product Showcase */}
              <div className="bg-zinc-950 rounded-xl p-4 border border-white/5 relative flex gap-4">
                <div className="w-16 h-16 shrink-0 bg-red-950/20 border border-white/5 rounded-lg flex items-center justify-center font-black text-red-500 text-xs italic">
                  IMAGE
                </div>
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-tight block" style={{ fontFamily: getFontChain(formData.products) }}>
                      Língua Vibratória Premium Discreta
                    </h4>
                    <span className="text-[9px] uppercase tracking-wider font-bold opacity-50 block" style={{ fontFamily: getFontChain(formData.general) }}>
                      Cód: DB-92043
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-black block" style={{ fontFamily: getFontChain(formData.prices) }}>
                      R$ 189,90
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 font-mono">
                      PromoPix
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Action Buttons */}
              <button 
                type="button"
                className="w-full h-12 bg-red-600 active:scale-95 text-white text-xs font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-transform h-12"
                style={{ fontFamily: getFontChain(formData.buttons) }}
              >
                Comprar Agora
              </button>

              <button 
                type="button"
                className="w-full h-12 border border-red-650 active:scale-95 text-red-500 text-xs font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-transform bg-transparent"
                style={{ fontFamily: getFontChain(formData.buttons), borderColor: formData.brandColor, color: formData.brandColor }}
              >
                Adicionar ao Carrinho
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest mt-6">
              © 2026 Discreta. Design Seguro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
