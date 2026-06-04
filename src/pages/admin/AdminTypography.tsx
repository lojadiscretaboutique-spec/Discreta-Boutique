import { useState, useMemo } from 'react';
import { 
  useTypography, 
  APPROVED_FONTS, 
  AdvancedTypographyConfig,
  GlobalTypography,
  HeaderTypography,
  LinksTypography,
  ProductCardsTypography,
  MiniBannerTypography,
  HeroBannerTypography,
  CatalogTypography,
  ProductDetailsTypography,
  CartTypography,
  CheckoutTypography,
  FooterTypography
} from '../../contexts/TypographyContext';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Button } from '../../components/ui/button';
import { 
  Save, 
  Type, 
  Smartphone, 
  Tablet as TabletIcon, 
  Laptop, 
  ChevronRight, 
  RotateCcw, 
  Layout, 
  ShoppingBag, 
  Menu, 
  Layers, 
  Sliders, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  MapPin, 
  CreditCard 
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Definition of each navigation tab with associated metadata
interface TabDefinition {
  id: keyof AdvancedTypographyConfig | 'brand';
  label: string;
  description: string;
  icon: any;
}

const PAGES_TABS: TabDefinition[] = [
  { id: 'global', label: 'Geral (Global)', description: 'Padrões de texto globais do storefront', icon: Type },
  { id: 'header', label: 'Cabeçalho', description: 'Logomarca textual, submenus e botões do topo', icon: Menu },
  { id: 'links', label: 'Links & Âncoras', description: 'Cores, pesos e hovers de links institucionais', icon: Sliders },
  { id: 'productCards', label: 'Cards de Produtos', description: 'Identidades visuais nos grids de produtos', icon: Layers },
  { id: 'miniBanner', label: 'Mini Banners', description: 'Chamadas e slogans de apoio em cards pequenos', icon: Layout },
  { id: 'heroBanner', label: 'Super Banner', description: 'Slides principais e headlines de impacto', icon: Layout },
  { id: 'catalog', label: 'Páginas de Catálogo', description: 'Categorias, filtros e ordenações do acervo', icon: Layers },
  { id: 'productDetails', label: 'Detalhes dos Itens', description: 'Página de produto, descrição, FAQ e tabelas', icon: ChevronRight },
  { id: 'cart', label: 'Carrinho de Compras', description: 'Tamanhos e fontes na sacola e resumo de cupons', icon: ShoppingBag },
  { id: 'checkout', label: 'Área de Checkout', description: 'Etapas de entrega, formulários e totens de PIX', icon: CreditCard },
  { id: 'footer', label: 'Rodapé Oficial', description: 'Menções legais, copyright e parágrafos de ajuda', icon: MapPin },
];

export function AdminTypography() {
  const { config, saveTypography, resetToDefault, loading } = useTypography();
  const { hasPermission } = useAuthStore();
  const { toast } = useFeedback();

  const [formData, setFormData] = useState<AdvancedTypographyConfig>(config);
  const [activeTab, setActiveTab] = useState<keyof AdvancedTypographyConfig | 'brand'>('global');
  const [devicePreview, setDevicePreview] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission('settings', 'editar');

  // Trigger internal sync when db values load
  useMemo(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] gap-4 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-650 border-t-transparent"></div>
        <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Sincronizando Identidade Visual...</p>
      </div>
    );
  }

  // Handle value setter helpers
  const updateNestedField = (section: keyof AdvancedTypographyConfig, field: string, value: any) => {
    setFormData(prev => {
      const currentSection = prev[section];
      if (typeof currentSection === 'object' && currentSection !== null) {
        return {
          ...prev,
          [section]: {
            ...currentSection,
            [field]: value
          }
        };
      }
      return prev;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTypography(formData);
      toast('Perfis tipográficos atualizados e sincronizados em tempo real!');
    } catch {
      toast('Ocorreu um erro ao gravar as alterações das fontes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Confirmar restauração de todos os valores originais da Boutique Discreta?')) return;
    try {
      await resetToDefault();
      toast('Tipografias redefinidas para o clássico.');
    } catch {
      toast('Falha ao restaurar padrões.', 'error');
    }
  };

  // Helper font chains
  const getFontFamilyChoice = (fontName: string) => APPROVED_FONTS[fontName] || APPROVED_FONTS['DM Sans'];

  // Helper renderers for typography properties
  const renderFontFamilySelect = (section: keyof AdvancedTypographyConfig, fontKey: string, label: string) => {
    const value = (formData[section] as any)?.[fontKey] || 'DM Sans';
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <select
          value={value}
          onChange={(e) => updateNestedField(section, fontKey, e.target.value)}
          className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2 focus:ring-1 focus:ring-red-500 max-w-full"
        >
          {Object.keys(APPROVED_FONTS).map(font => (
            <option key={font} value={font}>{font}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderFontWeightSelect = (section: keyof AdvancedTypographyConfig, weightKey: string, label: string) => {
    const value = (formData[section] as any)?.[weightKey] || '400';
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <select
          value={value}
          onChange={(e) => updateNestedField(section, weightKey, e.target.value)}
          className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2 focus:ring-1 focus:ring-red-500"
        >
          <option value="300">300 (Leve / Fino)</option>
          <option value="400">400 (Regular)</option>
          <option value="450">450 (Médio-Leve)</option>
          <option value="500">500 (Médio)</option>
          <option value="600">600 (Semi-Negrito)</option>
          <option value="700">700 (Negrito)</option>
          <option value="800">800 (Extra-Negrito)</option>
          <option value="900">900 (Black)</option>
        </select>
      </div>
    );
  };

  const renderColorInput = (section: keyof AdvancedTypographyConfig, colorKey: string, label: string) => {
    const value = (formData[section] as any)?.[colorKey] || '#000000';
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={value}
            onChange={(e) => updateNestedField(section, colorKey, e.target.value)}
            className="w-10 h-9 p-0 rounded-lg border border-slate-200 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={value.toUpperCase()}
            onChange={(e) => updateNestedField(section, colorKey, e.target.value)}
            className="h-9 w-24 text-center border rounded-lg text-xs font-mono font-bold"
          />
        </div>
      </div>
    );
  };

  const renderFontSizeSlider = (section: keyof AdvancedTypographyConfig, sizeKey: string, label: string, min = 8, max = 80) => {
    const rawVal = (formData[section] as any)?.[sizeKey] || '14px';
    const numValue = parseInt(rawVal, 10) || 14;
    return (
      <div className="flex flex-col gap-1.5 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{label}</span>
          <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{numValue}px</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            value={numValue}
            onChange={(e) => updateNestedField(section, sizeKey, `${e.target.value}px`)}
            className="flex-1 accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    );
  };

  const renderResponsiveSizesBlock = (section: keyof AdvancedTypographyConfig, prefixKey: string, labelHeader: string) => {
    return (
      <div className="border border-slate-100 rounded-xl p-4 bg-white space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b pb-1.5 mb-2">{labelHeader} (Tamanho Responsivo)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {renderFontSizeSlider(section, `${prefixKey}SizeDesktop`, 'Desktop 🖥️', 10, 72)}
          {renderFontSizeSlider(section, `${prefixKey}SizeTablet`, 'Tablet 📱', 10, 56)}
          {renderFontSizeSlider(section, `${prefixKey}SizeMobile`, 'Mobile 📲', 8, 42)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-24 storefront-theme-container">
      {/* Top action block bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-650 rounded-xl">
            <Type className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase italic">Identidade Tipográfica</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Discreta Boutique Sedução Secreta</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="text-xs font-bold gap-2 hover:bg-slate-50 cursor-pointer h-10 px-4"
            >
              <RotateCcw className="w-4 h-4" />
              Padrão Clássico
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-red-650 hover:bg-red-700 text-white text-xs font-bold gap-2 h-10 px-5 shadow-lg shadow-red-900/10 cursor-pointer shrink-0"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Gravando...' : 'Salvar Sincronização'}
            </Button>
          </div>
        )}
      </div>

      {/* Main Container Multi-Grid Setup */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Navigation categories sidebar layout */}
        <div className="xl:col-span-3 flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 px-3 mb-2 block">Contextos do Site</span>
          {PAGES_TABS.map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 group max-w-full outline-none",
                  isTabActive
                    ? "bg-red-600 text-white shadow-md shadow-red-600/15 scale-[1.01]"
                    : "hover:bg-slate-50 text-slate-700 hover:text-slate-900 bg-white border border-slate-100 hover:border-slate-200"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg shrink-0 transition-colors",
                  isTabActive ? "bg-white/15 text-white" : "bg-slate-50 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-700"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <span className="font-bold text-xs block leading-tight truncate">{tab.label}</span>
                  <span className={cn(
                    "text-[10px] block leading-none truncate mt-0.5",
                    isTabActive ? "text-red-100" : "text-slate-400"
                  )}>
                    {tab.description}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Secure brand lock badge info */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl mt-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-650 block mb-1">🔒 Invariante da Sedução</span>
            <p className="text-[11px] text-slate-500 leading-normal">
              A logomarca <span className="italic font-black text-red-500">DISCRETA</span> está bloqueada sobre a fonte clássica <strong>DM Sans</strong> para garantir consistência estética nas notas fiscais, sacolas e embalagens secretas.
            </p>
          </div>
        </div>

        {/* Dynamic Context Control form block */}
        <div className="xl:col-span-5 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[10px] font-black uppercase tracking-[3px] text-red-600">Painel Ajustável</span>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
              {PAGES_TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Ajuste as propriedades tipográficas deste escopo. Veja os resultados refletidos instantaneamente no celular de testes ao lado.
            </p>
          </div>

          {/* Tab Form conditional block */}
          {activeTab === 'global' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {renderFontFamilySelect('global', 'fontFamily', 'Fonte Padrão (Fallback)')}
                {renderFontWeightSelect('global', 'weight', 'Peso da Fonte')}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Transformação de Texto</span>
                  <select
                    value={formData.global.textTransform}
                    onChange={(e) => updateNestedField('global', 'textTransform', e.target.value)}
                    className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2 focus:ring-1 focus:ring-red-500"
                  >
                    <option value="none">Normal (Padrão)</option>
                    <option value="uppercase">Maiúsculo (UPPERCASE)</option>
                    <option value="lowercase">Minúsculo (lowercase)</option>
                    <option value="capitalize">Capitalizado (Capitalize)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Linha (lineHeight)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="2.5"
                    value={parseFloat(formData.global.lineHeight) || 1.6}
                    onChange={(e) => updateNestedField('global', 'lineHeight', e.target.value)}
                    className="h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-3 text-center"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500">Espaçamento de Letras</span>
                <select
                  value={formData.global.letterSpacing}
                  onChange={(e) => updateNestedField('global', 'letterSpacing', e.target.value)}
                  className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2 focus:ring-1 focus:ring-red-500"
                >
                  <option value="-0.02em">Estreito (-0.02em)</option>
                  <option value="0em">Padrão (0em)</option>
                  <option value="0.05em">Espaçado Suave (0.05em)</option>
                  <option value="0.1em">Moderado (0.1em)</option>
                  <option value="0.2em">Arrojado (0.2em)</option>
                </select>
              </div>

              {renderResponsiveSizesBlock('global', '', 'Tamanhos do Texto Geral')}
            </div>
          )}

          {activeTab === 'header' && (
            <div className="space-y-5">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Configuração da Logomarca Textual Secundária</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('header', 'logoFont', 'Família da Fonte')}
                  {renderFontWeightSelect('header', 'logoWeight', 'Peso do Texto')}
                </div>
                {renderResponsiveSizesBlock('header', 'logo', 'Tamanho do Título/Logo')}
              </div>
              
              <hr className="border-slate-100" />
              
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Menos e Itens de Navegação Superior</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('header', 'menuFont', 'Fonte do Menu')}
                  {renderFontWeightSelect('header', 'menuWeight', 'Peso dos Links')}
                </div>
                {renderResponsiveSizesBlock('header', 'menu', 'Tamanho do Menu')}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Links Superiores (Header Link)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('links', 'menuFont', 'Fonte')}
                  {renderFontWeightSelect('links', 'menuWeight', 'Peso')}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {renderColorInput('links', 'menuColor', 'Cor Standard')}
                  {renderColorInput('links', 'menuHoverColor', 'Cor em Hover')}
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Links de Promoções Rápidas (Promo Links)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('links', 'promoFont', 'Fonte')}
                  {renderFontWeightSelect('links', 'promoWeight', 'Peso')}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {renderColorInput('links', 'promoColor', 'Cor Standard')}
                  {renderColorInput('links', 'promoHoverColor', 'Cor em Hover')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'productCards' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Nome do Produto nos Catálogos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('productCards', 'nameFont', 'Fonte de Texto')}
                  {renderFontWeightSelect('productCards', 'nameWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('productCards', 'name', 'Tamanho do Nome')}
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Preços e Descontos à Vista</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('productCards', 'priceFont', 'Fonte de Preços')}
                  {renderFontWeightSelect('productCards', 'priceWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('productCards', 'price', 'Tamanho de Preços')}
              </div>
            </div>
          )}

          {activeTab === 'miniBanner' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Título de Mini Banners</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('miniBanner', 'titleFont', 'Fonte do Título')}
                  {renderFontWeightSelect('miniBanner', 'titleWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('miniBanner', 'title', 'Tamanho do Título')}
              </div>
            </div>
          )}

          {activeTab === 'heroBanner' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Headline Principal do Super Banner</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('heroBanner', 'titleFont', 'Fonte Principal')}
                  {renderFontWeightSelect('heroBanner', 'titleWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('heroBanner', 'title', 'Tamanho da Headline')}
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Títulos da Coleção / Categoria</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('catalog', 'titleFont', 'Fonte')}
                  {renderFontWeightSelect('catalog', 'titleWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('catalog', 'title', 'Tamanho de Títulos')}
              </div>
            </div>
          )}

          {activeTab === 'productDetails' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Título Principal do Detalhe do Produto</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('productDetails', 'nameFont', 'Fonte')}
                  {renderFontWeightSelect('productDetails', 'nameWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('productDetails', 'name', 'Tamanho do Destaque')}
              </div>
            </div>
          )}

          {activeTab === 'cart' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Itens do Resumo da Sacola</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('cart', 'itemNameFont', 'Fonte')}
                  {renderFontWeightSelect('cart', 'itemNameWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('cart', 'itemName', 'Tamanho')}
              </div>
            </div>
          )}

          {activeTab === 'checkout' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Segurança nos Menus do Checkout</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('checkout', 'titlesFont', 'Fonte')}
                  {renderFontWeightSelect('checkout', 'titlesWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('checkout', 'titles', 'Tamanho de Títulos')}
              </div>
            </div>
          )}

          {activeTab === 'footer' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Informações Institucionais do Rodapé</h3>
                <div className="grid grid-cols-2 gap-3">
                  {renderFontFamilySelect('footer', 'textsFont', 'Fonte')}
                  {renderFontWeightSelect('footer', 'textsWeight', 'Peso')}
                </div>
                {renderResponsiveSizesBlock('footer', 'texts', 'Tamanho do Texto')}
              </div>
            </div>
          )}
        </div>

        {/* Live Device Simulator Frame view */}
        <div className="xl:col-span-4 sticky top-6 flex flex-col gap-4">
          <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <span className="text-xs font-black uppercase text-slate-700 font-mono flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-red-650" />
                Telefone de Testes
              </span>

              {/* Viewport resizing toggles */}
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setDevicePreview('mobile')}
                  className={cn("p-1.5 rounded-md", devicePreview === 'mobile' ? "bg-white shadow text-red-650" : "text-slate-400")}
                  title="Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDevicePreview('tablet')}
                  className={cn("p-1.5 rounded-md", devicePreview === 'tablet' ? "bg-white shadow text-red-650" : "text-slate-400")}
                  title="Tablet"
                >
                  <TabletIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDevicePreview('desktop')}
                  className={cn("p-1.5 rounded-md", devicePreview === 'desktop' ? "bg-white shadow text-red-650" : "text-slate-400")}
                  title="Desktop"
                >
                  <Laptop className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated Live Frame container */}
            <div className="w-full flex justify-center bg-slate-50 border border-slate-150 p-4 rounded-xl overflow-hidden min-h-[300px]">
              <div
                className={cn(
                  "p-5 rounded-2xl bg-white border border-slate-200/80 shadow-md flex flex-col gap-5 text-slate-800 transition-all duration-300 max-h-[500px] overflow-y-auto w-full",
                  devicePreview === 'mobile' && "max-w-[280px]",
                  devicePreview === 'tablet' && "max-w-[380px]",
                  devicePreview === 'desktop' && "max-w-full"
                )}
              >
                
                {/* 1. Header & Navigation Simulation block */}
                <div className="border-b border-rose-50 pb-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span 
                      className="storefront-header-logo text-xs tracking-tight italic font-black text-rose-800"
                      style={{
                        fontFamily: getFontFamilyChoice(formData.header.logoFont),
                        fontWeight: formData.header.logoWeight,
                        fontSize: devicePreview === 'mobile' ? formData.header.logoSizeMobile : devicePreview === 'tablet' ? formData.header.logoSizeTablet : formData.header.logoSizeDesktop
                      }}
                    >
                      Boutique Secreta
                    </span>
                    <span className="brand-logo-text select-none text-red-650 font-black italic tracking-tighter" style={{ fontSize: '18px' }}>DISCRETA</span>
                  </div>
                  <nav className="flex justify-between pt-1 border-t border-slate-50">
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.header.menuFont),
                        fontWeight: formData.header.menuWeight,
                        fontSize: devicePreview === 'mobile' ? formData.header.menuSizeMobile : devicePreview === 'tablet' ? formData.header.menuSizeTablet : formData.header.menuSizeDesktop,
                        color: formData.links.menuColor
                      }}
                      className="hover:text-red-500 font-bold transition-colors cursor-pointer"
                    >
                      Calcinhas
                    </span>
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.header.menuFont),
                        fontWeight: formData.header.menuWeight,
                        fontSize: devicePreview === 'mobile' ? formData.header.menuSizeMobile : devicePreview === 'tablet' ? formData.header.menuSizeTablet : formData.header.menuSizeDesktop,
                        color: formData.links.menuColor
                      }}
                      className="hover:text-red-500 font-bold transition-colors cursor-pointer"
                    >
                      Acessórios
                    </span>
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.header.menuFont),
                        fontWeight: formData.header.menuWeight,
                        fontSize: devicePreview === 'mobile' ? formData.header.menuSizeMobile : devicePreview === 'tablet' ? formData.header.menuSizeTablet : formData.header.menuSizeDesktop,
                        color: formData.links.promoColor
                      }}
                      className="hover:text-red-900 font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      Promo 🔥
                    </span>
                  </nav>
                </div>

                {/* 2. Headline Hero banner block */}
                <div className="p-4 rounded-xl bg-gradient-to-tr from-rose-900 to-rose-950 text-white space-y-1 relative overflow-hidden">
                  <div className="absolute right-1 bottom-1 opacity-10 font-bold">DISCRETA</div>
                  <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Privacidade Sem Rastros</span>
                  <h3 
                    style={{
                      fontFamily: getFontFamilyChoice(formData.heroBanner.titleFont),
                      fontWeight: formData.heroBanner.titleWeight,
                      fontSize: devicePreview === 'mobile' ? formData.heroBanner.titleSizeMobile : devicePreview === 'tablet' ? formData.heroBanner.titleSizeTablet : formData.heroBanner.titleSizeDesktop
                    }}
                    className="leading-tight font-black tracking-tight"
                  >
                    Luxo & Êxtase Secretos
                  </h3>
                  <p className="text-[10px] text-rose-250 leading-relaxed font-semibold">Descubra perfumes sensoriais e géis afrodisíacos importados sob total segredo no Pix.</p>
                </div>

                {/* 3. Product Catalog layout simulation block */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline border-b pb-1.5">
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.catalog.titleFont),
                        fontWeight: formData.catalog.titleWeight,
                        fontSize: devicePreview === 'mobile' ? formData.catalog.titleSizeMobile : devicePreview === 'tablet' ? formData.catalog.titleSizeTablet : formData.catalog.titleSizeDesktop
                      }}
                      className="font-bold tracking-tight text-slate-900"
                    >
                      Destaques
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 font-mono">12 itens</span>
                  </div>

                  {/* Standard mock item card */}
                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2">
                    <span className="text-[8px] bg-red-650 text-white rounded font-black px-1.5 py-0.5 uppercase tracking-wider inline-block">Top de Vendas</span>
                    <h4 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.productCards.nameFont),
                        fontWeight: formData.productCards.nameWeight,
                        fontSize: devicePreview === 'mobile' ? formData.productCards.nameSizeMobile : devicePreview === 'tablet' ? formData.productCards.nameSizeTablet : formData.productCards.nameSizeDesktop,
                      }}
                      className="font-bold text-slate-800 leading-snug tracking-tight"
                    >
                      Bala Gel Gelada Estimulante
                    </h4>
                    <div className="flex items-baseline gap-2">
                      <span 
                        style={{
                          fontFamily: getFontFamilyChoice(formData.productCards.priceFont),
                          fontWeight: formData.productCards.priceWeight,
                          fontSize: devicePreview === 'mobile' ? formData.productCards.priceSizeMobile : devicePreview === 'tablet' ? formData.productCards.priceSizeTablet : formData.productCards.priceSizeDesktop,
                        }}
                        className="font-bold text-slate-900"
                      >
                        R$ 39,90
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Checkout Cart layout simulation */}
                <div className="rounded-xl border border-dashed border-red-200 p-3 bg-red-50/20 space-y-2">
                  <div className="flex justify-between border-b border-red-100/50 pb-1.5 items-center">
                    <span className="text-[10px] font-black text-rose-800 uppercase flex items-center gap-1"><CreditCard className="w-3 h-3" /> Resumo do PIX</span>
                    <span className="text-[9px] font-mono text-emerald-600 font-bold uppercase">10% Off Pix</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>Subtotal</span>
                    <span>R$ 39,90</span>
                  </div>
                  <div className="flex justify-between text-xs font-black border-t border-red-100/40 pt-1.5 text-slate-900">
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.cart.totalFont),
                        fontSize: devicePreview === 'mobile' ? formData.cart.totalSizeMobile : devicePreview === 'tablet' ? formData.cart.totalSizeTablet : formData.cart.totalSizeDesktop,
                        fontWeight: formData.cart.totalWeight
                      }}
                    >
                      Total
                    </span>
                    <span 
                      style={{
                        fontFamily: getFontFamilyChoice(formData.cart.totalFont),
                        fontSize: devicePreview === 'mobile' ? formData.cart.totalSizeMobile : devicePreview === 'tablet' ? formData.cart.totalSizeTablet : formData.cart.totalSizeDesktop,
                        fontWeight: formData.cart.totalWeight
                      }}
                    >
                      R$ 35,91
                    </span>
                  </div>
                </div>

                {/* Footer simulation */}
                <div className="border-t pt-3 pb-2 text-center space-y-1">
                  <span className="text-[8px] tracking-[1px] uppercase opacity-55 block">© 2026 Boutique Discreta</span>
                  <p 
                    style={{
                      fontFamily: getFontFamilyChoice(formData.footer.textsFont),
                      fontSize: devicePreview === 'mobile' ? formData.footer.textsSizeMobile : devicePreview === 'tablet' ? formData.footer.textsSizeTablet : formData.footer.textsSizeDesktop,
                    }}
                    className="text-[9px] text-slate-400 font-semibold leading-relaxed"
                  >
                    Embalagens discretas sem identificação do remetente na fatura do banco.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
