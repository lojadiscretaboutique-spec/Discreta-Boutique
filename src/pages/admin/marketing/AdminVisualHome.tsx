import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, doc, query, where, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  visualHomeService, 
  VisualHomeSettings, 
  VisualHomeLayout, 
  VisualHomeSchedule, 
  CustomSection,
  STANDARD_SECTION_IDS
} from '../../../services/visualHomeService';
import { 
  Layout, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Settings, 
  Plus, 
  Calendar, 
  Palette, 
  Smartphone, 
  Laptop, 
  Trash2, 
  Sparkles, 
  Save, 
  CornerDownRight, 
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  Copy,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Category } from '../../../services/categoryService';

interface ProductMock {
  id: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  promoPrice?: number;
  imageUrl?: string;
  onSale?: boolean;
  brand?: string;
  categoryId?: string;
  shortDescription?: string;
  fullDescription?: string;
}

export function AdminVisualHome() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Database configurations
  const [settings, setSettings] = useState<Record<string, VisualHomeSettings>>({});
  const [layouts, setLayouts] = useState<Record<string, VisualHomeLayout>>({});
  const [schedules, setSchedules] = useState<Record<string, VisualHomeSchedule>>({});
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [order, setOrder] = useState<string[]>([]);

  // Metadata loaders
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsList, setProductsList] = useState<ProductMock[]>([]);

  // Editing state
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Search filter for product selector
  const [productSearch, setProductSearch] = useState('');

  // New interactive states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; title: string } | null>(null);

  // 1. Initial data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load standard configurations
      const structure = await visualHomeService.getFullHomeStructure();
      setSettings(structure.settings);
      setLayouts(structure.layouts);
      setSchedules(structure.schedules);
      setCustomSections(structure.customSections);
      setOrder(structure.order);

      if (structure.order.length > 0) {
        setSelectedSectionId(prev => prev || structure.order[0]);
      }

      // Load metadata with higher limit to ensure finding all custom products safely
      const [catSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, 'categories'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'products'), where('active', '==', true), limit(600)))
      ]);

      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
      setProductsList(prodSnap.docs.map(d => {
        const data = d.data();
        const mainImg = data.images && data.images.length > 0 ? (data.images.find((i: any) => i.isMain)?.url || data.images[0].url) : '';
        return {
          id: d.id,
          name: data.name || '',
          sku: data.sku || '',
          gtin: data.gtin || data.barcode || '',
          price: data.price || 0,
          promoPrice: data.promoPrice,
          imageUrl: mainImg || data.imageUrl || '',
          onSale: data.onSale,
          brand: data.brand || '',
          categoryId: data.categoryId || '',
          shortDescription: data.shortDescription || '',
          fullDescription: data.fullDescription || ''
        };
      }));

    } catch (e) {
      console.error(e);
      toast('Erro ao carregar dados do Personalizador Visual', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Actions: Move section Up/Down
  const moveSection = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...order];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    // Swap elements
    const element = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = element;

    setOrder(newOrder);
    try {
      await visualHomeService.saveSectionOrder(newOrder);
      toast('Ordem atualizada com sucesso', 'success');
    } catch (e) {
      toast('Erro ao salvar nova ordem', 'error');
    }
  };

  // 3. Create Custom Section
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    try {
      setSaving(true);
      const newId = await visualHomeService.createCustomSection(newSectionTitle.trim());
      
      // Reload state
      const structure = await visualHomeService.getFullHomeStructure();
      setSettings(structure.settings);
      setLayouts(structure.layouts);
      setSchedules(structure.schedules);
      setCustomSections(structure.customSections);
      setOrder(structure.order);
      
      setSelectedSectionId(newId);
      setNewSectionTitle('');
      setShowCreateModal(false);
      toast('Seção customizada criada com sucesso', 'success');
    } catch (e) {
      toast('Erro ao criar seção', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 4. Delete Custom Section (completed via custom validation modal)
  const handleDeleteSection = async (id: string) => {
    if (!id.startsWith('custom_')) {
      toast('Você não pode excluir uma seção padrão, apenas ocultar.', 'error');
      return;
    }

    try {
      setSaving(true);
      await visualHomeService.deleteCustomSection(id);
      
      // Reload structure
      const structure = await visualHomeService.getFullHomeStructure();
      setSettings(structure.settings);
      setLayouts(structure.layouts);
      setSchedules(structure.schedules);
      setCustomSections(structure.customSections);
      setOrder(structure.order);

      if (selectedSectionId === id) {
        setSelectedSectionId(structure.order[0] || '');
      }

      setSectionToDelete(null);
      toast('Seção excluída com sucesso', 'success');
    } catch (e) {
      toast('Erro ao excluir seção', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 4b. Duplicate Custom or Standard Section
  const handleDuplicateSection = async (id: string) => {
    try {
      setSaving(true);
      const newId = await visualHomeService.duplicateSection(id);
      
      // Reload structure
      const structure = await visualHomeService.getFullHomeStructure();
      setSettings(structure.settings);
      setLayouts(structure.layouts);
      setSchedules(structure.schedules);
      setCustomSections(structure.customSections);
      setOrder(structure.order);

      setSelectedSectionId(newId);
      toast('Seção duplicada com sucesso! Uma cópia foi gerada e selecionada para edição.', 'success');
    } catch (e) {
      toast('Erro ao duplicar seção', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 5. Update local edit state
  const updateSettingsField = (field: keyof VisualHomeSettings, value: any) => {
    if (!selectedSectionId) return;
    setSettings(prev => ({
      ...prev,
      [selectedSectionId]: {
        ...prev[selectedSectionId],
        [field]: value
      }
    }));
  };

  const updateLayoutField = (field: keyof VisualHomeLayout, value: any) => {
    if (!selectedSectionId) return;
    setLayouts(prev => ({
      ...prev,
      [selectedSectionId]: {
        ...prev[selectedSectionId],
        [field]: value
      }
    }));
  };

  const updateScheduleField = (field: keyof VisualHomeSchedule, value: any) => {
    if (!selectedSectionId) return;
    setSchedules(prev => ({
      ...prev,
      [selectedSectionId]: {
        ...prev[selectedSectionId],
        [field]: value
      }
    }));
  };

  // 6. Save current section changes to Database
  const handleSaveSection = async () => {
    if (!selectedSectionId) return;

    setSaving(true);
    try {
      const sectionSettings = settings[selectedSectionId];
      const sectionLayout = layouts[selectedSectionId];
      const sectionSchedule = schedules[selectedSectionId];

      await visualHomeService.saveSection(
        selectedSectionId,
        sectionSettings,
        sectionLayout,
        sectionSchedule
      );

      toast('Seção salva com sucesso', 'success');
    } catch (e) {
      toast('Erro ao salvar as configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper: toggle/add items in list (for custom_products or categories source details)
  const toggleSourceDetail = (itemId: string) => {
    const currentDetails = settings[selectedSectionId]?.sourceDetails || [];
    let updatedDetails: string[] = [];
    if (currentDetails.includes(itemId)) {
      updatedDetails = currentDetails.filter(id => id !== itemId);
    } else {
      updatedDetails = [...currentDetails, itemId];
    }
    updateSettingsField('sourceDetails', updatedDetails);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-black text-white py-12">
        <div className="w-16 h-16 border-t-4 border-red-600 border-solid rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
        <p className="text-zinc-400 font-bold tracking-widest text-xs uppercase animate-pulse">Carregando Visualizer...</p>
      </div>
    );
  }

  const activeSecSettings = settings[selectedSectionId];
  const activeSecLayout = layouts[selectedSectionId];
  const activeSecSchedule = schedules[selectedSectionId];

  // Client-side simulation of products shown in preview
  const getPreviewMockProducts = () => {
    if (!activeSecSettings) return [];
    
    let list = [...productsList];
    
    // Sort according to selection
    if (activeSecSettings.source === 'promo') {
      list = list.filter(p => p.onSale || p.promoPrice);
    } else if (activeSecSettings.source === 'categories' && activeSecSettings.sourceDetails?.length) {
      // Simulate categories filtering
    } else if ((activeSecSettings.source === 'custom_products' || activeSecSettings.source === 'limited_promo') && activeSecSettings.sourceDetails?.length) {
      list = activeSecSettings.sourceDetails.map(id => {
        const p = productsList.find(prod => prod.id === id);
        if (!p) return null;
        if (activeSecSettings.source === 'limited_promo') {
          const promoPriceOverride = activeSecSettings.promoPrices?.[id];
          if (promoPriceOverride !== undefined && Number(promoPriceOverride) > 0) {
            return {
              ...p,
              promoPrice: Number(promoPriceOverride),
              onSale: true
            };
          }
        }
        return p;
      }).filter(p => !!p) as ProductMock[];
    }

    // Limit visible quantity in preview
    const limitCount = activeSecLayout?.limit || 4;
    return list.slice(0, limitCount);
  };

  // Helper: Get warnings/alerts for the current section
  const getSectionAlerts = () => {
    const alerts: { type: 'warning' | 'info' | 'error'; message: string; actionText?: string; action?: () => void }[] = [];
    if (!activeSecSettings) return [];

    // Hidden section alert
    if (!activeSecSettings.active) {
      alerts.push({
        type: 'warning',
        message: 'Esta seção está oculta e não será exibida para os clientes na página inicial.',
        actionText: 'Ativar Agora',
        action: () => updateSettingsField('active', true)
      });
    }

    // No products alert
    if ((activeSecSettings.source === 'custom_products' || activeSecSettings.source === 'limited_promo') && (!activeSecSettings.sourceDetails || activeSecSettings.sourceDetails.length === 0)) {
      alerts.push({
        type: 'error',
        message: 'Nenhum produto está vinculado a esta seção específica. Selecione produtos abaixo para exibi-la.',
      });
    }

    if (activeSecSettings.source === 'limited_promo' && !activeSecSchedule?.hasSchedule) {
      alerts.push({
        type: 'warning',
        message: 'Esta é uma promoção por tempo limitado, mas nenhum encerramento foi agendado. Ative o Agendamento de Exibição de Campanha e defina uma data e hora para que o cronômetro do site seja exibido e funcione perfeitamente.',
      });
    }

    // Date scheduling alert checks
    if (activeSecSchedule?.hasSchedule) {
      const now = new Date();
      let isFuture = false;
      let isPast = false;
      let startStr = '';
      let endStr = '';

      if (activeSecSchedule.startDate) {
        startStr = `${activeSecSchedule.startDate}T${activeSecSchedule.startTime || '00:00'}:00`;
        const startDateObj = new Date(startStr);
        if (now < startDateObj) {
          isFuture = true;
        }
      }
      if (activeSecSchedule.endDate) {
        endStr = `${activeSecSchedule.endDate}T${activeSecSchedule.endTime || '23:59'}:59`;
        const endDateObj = new Date(endStr);
        if (now > endDateObj) {
          isPast = true;
        }
      }

      if (isFuture) {
        alerts.push({
          type: 'info',
          message: `Esta seção está agendada para o futuro e iniciará em: ${new Date(startStr).toLocaleString('pt-BR')}.`,
        });
      } else if (isPast) {
        alerts.push({
          type: 'warning',
          message: `O agendamento desta seção expirou em ${new Date(endStr).toLocaleString('pt-BR')}. Ela está temporariamente oculta.`,
          actionText: 'Limpar Agendamento',
          action: () => updateScheduleField('hasSchedule', false)
        });
      }
    }

    return alerts;
  };

  const previewProducts = getPreviewMockProducts();

  return (
    <div className="flex-1 flex flex-col bg-[#050505] text-zinc-100 p-4 sm:p-6 lg:p-8">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-900 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tight text-white flex items-center gap-3">
            <span className="text-red-600 text-shadow-glow">🎨</span> Visual Home
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Personalize a ordem, títulos, layouts e conteúdos de todas as seções da página inicial da Discreta Boutique.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-red-600/30 text-white rounded-xl px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all"
          >
            <Plus size={16} className="text-red-500" /> Nova Seção
          </button>
          
          <button 
            disabled={saving}
            onClick={handleSaveSection}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(220,38,38,0.3)]"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: SECTIONS LIST & METADATA (Span 3) */}
        <div className="lg:col-span-3 bg-zinc-950/70 border border-zinc-900 rounded-3xl p-5 shadow-2xl">
          <h2 className="text-xs font-black uppercase tracking-[3px] text-zinc-500 mb-4 flex items-center gap-2">
            <ListOrdered size={14} className="text-red-500" /> Ordem das Seções
          </h2>
          
          <div className="space-y-2.5">
            {order.map((id, index) => {
              const itemSettings = settings[id];
              const isSelected = selectedSectionId === id;
              const isCustom = id.startsWith('custom_');

              if (!itemSettings) return null;

              return (
                <div 
                  key={id}
                  className={`flex items-center justify-between rounded-2xl border transition-all p-3 ${
                    isSelected 
                      ? 'bg-zinc-900 border-red-600/60 shadow-[0_0_12px_rgba(220,38,38,0.15)]' 
                      : 'bg-zinc-950/40 border-zinc-900/80 hover:bg-zinc-900/30 hover:border-zinc-800'
                  }`}
                >
                  <button 
                    onClick={() => setSelectedSectionId(id)}
                    className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                  >
                    <span className="text-lg">{itemSettings.emoji || '✨'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black uppercase tracking-tight text-white truncate">
                          {itemSettings.title}
                        </p>
                        {isCustom && (
                          <span className="bg-red-950/55 border border-red-800 text-[8px] px-1.5 py-0.5 rounded-full text-red-400 font-extrabold uppercase shrink-0 scale-90">Custom</span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-zinc-400 truncate mt-0.5 font-medium">
                        {itemSettings.source === 'custom_products' 
                          ? `Produtos: ${itemSettings.sourceDetails?.length || 0}`
                          : itemSettings.source === 'promo'
                            ? `Ofertas: ${productsList.filter(p => p.onSale || p.promoPrice).length} prod.`
                            : itemSettings.subtitle || 'Sem subtítulo'
                        }
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Up button */}
                    <button 
                      disabled={index === 0}
                      onClick={() => moveSection(index, 'up')}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 disabled:opacity-20 transition-all"
                      title="Mover para Cima"
                    >
                      <ArrowUp size={12} />
                    </button>
                    
                    {/* Down button */}
                    <button 
                      disabled={index === order.length - 1}
                      onClick={() => moveSection(index, 'down')}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 disabled:opacity-20 transition-all"
                      title="Mover para Baixo"
                    >
                      <ArrowDown size={12} />
                    </button>

                    {/* Visibility status indicator */}
                    <button 
                      onClick={async () => {
                        const newActive = !itemSettings.active;
                        // local change
                        setSettings(prev => ({
                          ...prev,
                          [id]: { ...prev[id], active: newActive }
                        }));
                        // save immediately for visibility toggle convenience
                        try {
                          await visualHomeService.saveSection(id, { ...itemSettings, active: newActive }, layouts[id], schedules[id]);
                          toast(`${itemSettings.title} ${newActive ? 'ativada' : 'desativada'} com sucesso!`, 'success');
                        } catch(e) {
                          toast('Erro ao alterar status de exibição', 'error');
                        }
                      }}
                      className={`p-1.5 rounded transition-all ${itemSettings.active ? 'text-green-500 bg-green-950/20 hover:bg-green-900/30' : 'text-zinc-600 bg-zinc-900/45 hover:bg-zinc-800'}`}
                      title={itemSettings.active ? 'Seção Ativada (Visível na Home)' : 'Seção Ocultada'}
                    >
                      {itemSettings.active ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>

                    {/* Duplicate Section */}
                    <button 
                      onClick={() => handleDuplicateSection(id)}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded bg-transparent transition-all"
                      title="Duplicar Seção"
                    >
                      <Copy size={12} />
                    </button>

                    {/* Custom sections can be completely deleted */}
                    {isCustom && (
                      <button 
                        onClick={() => setSectionToDelete({ id, title: itemSettings.title })}
                        className="p-1 text-zinc-500 hover:text-red-500 rounded bg-transparent transition-all"
                        title="Excluir Seção"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE COLUMN: PROPERTY EDITOR (Span 5) */}
        <div className="lg:col-span-5 bg-zinc-950/70 border border-zinc-900 rounded-3xl p-5 lg:p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto no-scrollbar">
          
          {selectedSectionId && activeSecSettings ? (
            <>
              <div className="pb-4 border-b border-zinc-900 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{activeSecSettings.emoji || '✨'}</span>
                    <h2 className="text-lg font-black uppercase text-white tracking-tight">{activeSecSettings.title}</h2>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Configurações visuais e de conteúdo</p>
                </div>
                
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                  activeSecSettings.active 
                    ? 'bg-green-950/30 border border-green-800 text-green-400' 
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                }`}>
                  {activeSecSettings.active ? 'Ativo na Loja' : 'Desativado'}
                </span>
              </div>

              {/* ALERTS & VALIDATIONS SYSTEM */}
              {(() => {
                const alerts = getSectionAlerts();
                if (alerts.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <div 
                        key={index}
                        className={`flex items-start justify-between gap-3 p-3 rounded-2xl border text-xs font-medium leading-relaxed shadow-sm ${
                          alert.type === 'error' 
                            ? 'bg-red-950/40 border-red-900/60 text-red-300' 
                            : alert.type === 'warning'
                              ? 'bg-amber-950/40 border-amber-900/60 text-amber-300'
                              : 'bg-zinc-900 border-zinc-900 text-zinc-300'
                        }`}
                      >
                        <div className="flex gap-2 min-w-0">
                          {alert.type === 'error' && <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />}
                          {alert.type === 'warning' && <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />}
                          {alert.type === 'info' && <Calendar size={15} className="text-zinc-400 shrink-0 mt-0.5" />}
                          <p className="line-clamp-2">{alert.message}</p>
                        </div>
                        {alert.action && (
                          <button 
                            onClick={alert.action}
                            className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] font-black uppercase text-white rounded-lg px-2 py-0.5 shrink-0 transition-all self-center cursor-pointer"
                          >
                            {alert.actionText}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* SECTION CONTROLS: ACCORDION-LIKE STYLISH BLOCKS */}
              
              {/* BLOCK 1: ESSENTIALS */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-red-500 flex items-center gap-1.5">
                  <Settings size={12} /> Dados Essenciais
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Título Exibido</label>
                    <input 
                      type="text" 
                      value={activeSecSettings.title}
                      onChange={e => updateSettingsField('title', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-600 focus:border-red-600 outline-none text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Emoji / Ícone</label>
                    <input 
                      type="text" 
                      maxLength={4}
                      placeholder="🔥"
                      value={activeSecSettings.emoji || ''}
                      onChange={e => updateSettingsField('emoji', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-center text-sm focus:ring-1 focus:ring-red-600 focus:border-red-600 outline-none text-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Subtítulo (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Subtítulo descritivo abaixo da seção..."
                    value={activeSecSettings.subtitle || ''}
                    onChange={e => updateSettingsField('subtitle', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-600 text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Alinhamento do Título</label>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button 
                          key={align}
                          onClick={() => updateSettingsField('alignment', align)}
                          className={`py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                            activeSecSettings.alignment === align 
                              ? 'bg-red-600 text-white shadow-md' 
                              : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          {align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Ativo / Exibir</label>
                    <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                      <button 
                        onClick={() => updateSettingsField('active', true)}
                        className={`py-1 text-[10px ] font-black rounded-lg uppercase transition-all ${
                          activeSecSettings.active ? 'bg-green-600 text-white' : 'text-zinc-500'
                        }`}
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => updateSettingsField('active', false)}
                        className={`py-1 text-[10px ] font-black rounded-lg uppercase transition-all ${
                          !activeSecSettings.active ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 2: DATA & PRODUCT SOURCE */}
              <div className="space-y-4 border-t border-zinc-900 pt-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-red-500 flex items-center gap-1.5">
                  <Tag size={12} /> Origem dos Produtos
                </h3>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Regra de Seleção</label>
                  <select 
                    value={activeSecSettings.source}
                    onChange={e => {
                      updateSettingsField('source', e.target.value);
                      updateSettingsField('sourceDetails', []);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs tracking-tight text-white focus:ring-1 focus:ring-red-600 outline-none font-bold"
                  >
                    <option value="auto">Regra Automática Atual</option>
                    <option value="custom_products">Produtos Específicos (Manual)</option>
                    <option value="limited_promo">🔥 Promoção por Tempo Limitado (Com Timer)</option>
                    <option value="categories">Categorias Específicas</option>
                    <option value="promo">Produtos em Promoção</option>
                    <option value="best_seller">Produtos Mais Vendidos</option>
                    <option value="views">Produtos Mais Visualizados (Em Alta)</option>
                    <option value="recent">Lançamentos (Recém-Cadastrados)</option>
                    <option value="ai_recs">Sugestões de IA Personalizada</option>
                    <option value="stock">Produtos com Maior Estoque</option>
                    <option value="random">Giro Aleatório de Produtos</option>
                  </select>
                </div>

                {/* Sub-inputs based on source selection */}
                {activeSecSettings.source === 'categories' && (
                  <div className="bg-zinc-900/50 border border-zinc-900 p-3 rounded-2xl space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400">Selecionar Categoria Principal</label>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border border-zinc-800 p-2 rounded-xl bg-zinc-950/80">
                      {categories.map(cat => {
                        const isChecked = activeSecSettings.sourceDetails?.includes(cat.id);
                        return (
                          <label key={cat.id} className="flex items-center gap-2 text-xs text-zinc-300 font-bold hover:text-white cursor-pointer py-1 block">
                            <input 
                              type="checkbox" 
                              checked={!!isChecked}
                              onChange={() => toggleSourceDetail(cat.id)}
                              className="accent-red-600 rounded bg-zinc-900 border-zinc-800 text-red-600 outline-none"
                            />
                            {cat.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(activeSecSettings.source === 'custom_products' || activeSecSettings.source === 'limited_promo') && (() => {
                  const getCategoryName = (catId?: string) => {
                    if (!catId) return '';
                    return categories.find(c => c.id === catId)?.name || '';
                  };

                  const queryLower = productSearch.toLowerCase().trim();
                  
                  const filteredProducts = productsList.filter(p => {
                    if (!queryLower) return true;
                    
                    const nameMatch = p.name ? p.name.toLowerCase().includes(queryLower) : false;
                    const skuMatch = p.sku ? p.sku.toLowerCase().includes(queryLower) : false;
                    const gtinMatch = p.gtin ? p.gtin.toLowerCase().includes(queryLower) : false;
                    const brandMatch = p.brand ? p.brand.toLowerCase().includes(queryLower) : false;
                    const shortDescMatch = p.shortDescription ? p.shortDescription.toLowerCase().includes(queryLower) : false;
                    const fullDescMatch = p.fullDescription ? p.fullDescription.toLowerCase().includes(queryLower) : false;
                    const categoryMatch = p.categoryId ? getCategoryName(p.categoryId).toLowerCase().includes(queryLower) : false;

                    return nameMatch || skuMatch || gtinMatch || brandMatch || shortDescMatch || fullDescMatch || categoryMatch;
                  });

                  const selectedProductsOrdered = (activeSecSettings.sourceDetails || [])
                    .map(id => productsList.find(p => p.id === id))
                    .filter(p => !!p) as ProductMock[];

                  return (
                    <div className="bg-zinc-900/40 border border-zinc-900/80 p-4 rounded-3xl space-y-4">
                      
                      {/* Search box & Selection List */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
                            🔍 Busca Avançada de Produtos
                          </label>
                          <span className="text-[10px] font-black tracking-widest text-[#ef4444] bg-red-950/45 px-2.5 py-0.5 rounded-full border border-red-900/60 font-mono">
                            {activeSecSettings.sourceDetails?.length || 0} SELECIONADOS
                          </span>
                        </div>

                        <p className="text-[9px] text-zinc-500 leading-tight">
                          Pesquise por SKU, Código de barras, Nome, Descrição, Marca ou Categoria.
                        </p>

                        <input 
                          type="text"
                          placeholder="Ex: SKU, Vibrador, Marca, GTIN, Lingerie, Cinta..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none text-white focus:border-red-600/70 focus:ring-1 focus:ring-red-600/35 transition-all font-sans font-medium"
                        />

                        {/* Multi-selection triggers */}
                        {productSearch && (
                          <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-xl border border-zinc-900">
                            <span className="text-[9px] text-zinc-400 font-bold">
                              {filteredProducts.length} encontrados
                            </span>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => {
                                  const ids = filteredProducts.map(p => p.id);
                                  const current = [...(activeSecSettings.sourceDetails || [])];
                                  ids.forEach(id => {
                                    if (!current.includes(id)) current.push(id);
                                  });
                                  updateSettingsField('sourceDetails', current);
                                  toast(`Selecionados ${ids.length} produtos da lista filtrada`, 'success');
                                }}
                                className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 bg-red-950/20 px-2 py-0.5 rounded-md border border-red-900/45 cursor-pointer"
                              >
                                Selecionar Tudo
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  const ids = filteredProducts.map(p => p.id);
                                  const current = [...(activeSecSettings.sourceDetails || [])];
                                  const filtered = current.filter(id => !ids.includes(id));
                                  updateSettingsField('sourceDetails', filtered);
                                  toast(`Desmarcados correspondentes da seleção`, 'info');
                                }}
                                className="text-[9px] font-black uppercase text-zinc-400 hover:text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800/80 cursor-pointer"
                              >
                                Limpar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Search list scroll box */}
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800/80 p-2.5 rounded-xl bg-zinc-950/90 no-scrollbar">
                          {filteredProducts.length === 0 ? (
                            <div className="text-center py-6 text-zinc-650 text-xs font-medium">
                              Nenhum produto encontrado com estes parâmetros.
                            </div>
                          ) : (
                            filteredProducts.map(p => {
                              const isChecked = activeSecSettings.sourceDetails?.includes(p.id);
                              return (
                                <div 
                                  key={p.id} 
                                  onClick={() => toggleSourceDetail(p.id)}
                                  className={`flex items-center justify-between text-xs rounded-lg p-1.5 border transition-all cursor-pointer font-sans select-none ${
                                    isChecked 
                                      ? 'bg-red-950/20 border-red-900/35 hover:bg-red-950/30' 
                                      : 'bg-transparent border-transparent hover:bg-zinc-900/50 hover:border-zinc-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input 
                                      type="checkbox" 
                                      checked={!!isChecked}
                                      onChange={() => {}} // handled by click container row
                                      className="accent-red-600 rounded bg-zinc-900 border-zinc-800 text-red-600 focus:ring-0 shrink-0"
                                    />
                                    {p.imageUrl && (
                                      <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover rounded bg-zinc-900 shrink-0 border border-zinc-850" />
                                    )}
                                    <div className="min-w-0">
                                      <span className="font-bold text-zinc-200 truncate block text-xs">{p.name}</span>
                                      <div className="flex flex-wrap gap-1 items-center mt-0.5">
                                        {p.sku && (
                                          <span className="text-[7.5px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded">SKU: {p.sku}</span>
                                        )}
                                        {p.brand && (
                                          <span className="text-[7.5px] font-bold text-red-400 bg-red-950/10 px-1.5 py-0.5 rounded uppercase">{p.brand}</span>
                                        )}
                                        {p.categoryId && (
                                          <span className="text-[7.5px] text-zinc-500 font-medium truncate max-w-[100px]">{getCategoryName(p.categoryId)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-white shrink-0 self-center">R$ {p.price.toFixed(2)}</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* DRAG & DROP MANUAL REORDER LIST */}
                      {selectedProductsOrdered.length > 0 && (
                        <div className="space-y-2 border-t border-zinc-900/80 pt-3">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">
                              ⇄ Ordem Exclusiva de Exibição ({selectedProductsOrdered.length})
                            </label>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wide">Arraste para Reordenar</span>
                          </div>

                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 no-scrollbar p-1">
                            {selectedProductsOrdered.map((p, idx) => (
                              <div
                                key={p.id}
                                draggable
                                onDragStart={() => setDraggedIndex(idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedIndex === null || draggedIndex === idx) return;
                                  const updated = [...(activeSecSettings.sourceDetails || [])];
                                  const [moved] = updated.splice(draggedIndex, 1);
                                  updated.splice(idx, 0, moved);
                                  updateSettingsField('sourceDetails', updated);
                                  setDraggedIndex(null);
                                }}
                                className={`flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all cursor-move select-none ${
                                  draggedIndex === idx ? 'opacity-30 border-red-500 border-dashed' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-[10px] font-black text-red-500 bg-red-950/45 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border border-red-900/60 font-mono">
                                    {idx + 1}
                                  </span>
                                  {p.imageUrl && (
                                    <img src={p.imageUrl} alt="" className="w-6 h-6 object-cover rounded bg-zinc-900 border border-zinc-850 shrink-0" />
                                  )}
                                  <p className="text-xs text-zinc-300 font-bold truncate">{p.name}</p>
                                </div>

                                {activeSecSettings.source === 'limited_promo' && (
                                  <div className="flex items-center gap-1.5 shrink-0 bg-zinc-900 border border-zinc-800/80 px-2 py-1 rounded-xl ml-auto mr-1.5 select-none">
                                    <span className="text-[7px] text-red-400 font-black uppercase shrink-0">Promo:</span>
                                    <input 
                                      type="number"
                                      step="0.01"
                                      placeholder={`${p.price}`}
                                      value={activeSecSettings.promoPrices?.[p.id] !== undefined ? activeSecSettings.promoPrices[p.id] : ''}
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                        const map = { ...(activeSecSettings.promoPrices || {}) };
                                        if (val === '') {
                                          delete map[p.id];
                                        } else {
                                          map[p.id] = isNaN(val as number) ? 0 : (val as number);
                                        }
                                        updateSettingsField('promoPrices', map);
                                      }}
                                      className="w-14 bg-zinc-950 border border-zinc-850 text-white rounded px-1.5 py-0.5 text-[9px] font-bold text-center focus:border-red-600 outline-none"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Reorder Arrows */}
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      const updated = [...(activeSecSettings.sourceDetails || [])];
                                      const element = updated[idx];
                                      updated[idx] = updated[idx - 1];
                                      updated[idx - 1] = element;
                                      updateSettingsField('sourceDetails', updated);
                                    }}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
                                    title="Mover para cima"
                                  >
                                    <ArrowUp size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === selectedProductsOrdered.length - 1}
                                    onClick={() => {
                                      const updated = [...(activeSecSettings.sourceDetails || [])];
                                      const element = updated[idx];
                                      updated[idx] = updated[idx + 1];
                                      updated[idx + 1] = element;
                                      updateSettingsField('sourceDetails', updated);
                                    }}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
                                    title="Mover para baixo"
                                  >
                                    <ArrowDown size={11} />
                                  </button>
                                  
                                  {/* Quick Remove from Selection */}
                                  <button
                                    type="button"
                                    onClick={() => toggleSourceDetail(p.id)}
                                    className="p-1 text-zinc-600 hover:text-red-500 transition-all cursor-pointer"
                                    title="Remover Seleção"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}

                {/* PRODUCT SORT ORDER */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Ordenação de Exibição</label>
                  <select 
                    value={activeSecSettings.orderByField || 'recent'}
                    onChange={e => updateSettingsField('orderByField', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs tracking-tight text-white focus:ring-1 focus:ring-red-600 outline-none font-bold"
                  >
                    <option value="recent">Mais Recentes / Novidades</option>
                    <option value="sales">Recordistas de Vendas</option>
                    <option value="discount">Maior Desconto / Promoção</option>
                    <option value="price_asc">Menor Preço das Peças</option>
                    <option value="price_desc">Maior Preço das Peças</option>
                    <option value="random">Mistura Aleatória</option>
                  </select>
                </div>
              </div>

              {/* BLOCK 3: LAYOUT CONTROLS */}
              {activeSecLayout && (
                <div className="space-y-4 border-t border-zinc-900 pt-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-red-500 flex items-center gap-1.5">
                    <Layout size={12} /> Configurações de Layout
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Alinhamento Layout</label>
                      <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button 
                          onClick={() => updateLayoutField('orientation', 'horizontal')}
                          className={`py-1 text-[10px ] font-black uppercase rounded-lg transition-all ${
                            activeSecLayout.orientation === 'horizontal' ? 'bg-red-600 text-white' : 'text-zinc-500'
                          }`}
                        >
                          Carrossel
                        </button>
                        <button 
                          onClick={() => updateLayoutField('orientation', 'vertical')}
                          className={`py-1 text-[10px ] font-black uppercase rounded-lg transition-all ${
                            activeSecLayout.orientation === 'vertical' ? 'bg-red-600 text-white' : 'text-zinc-500'
                          }`}
                        >
                          Grid Fixo
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px ] font-bold uppercase text-zinc-400 mb-1.5">Colunas Desktop</label>
                      <select 
                        value={activeSecLayout.colsDesktop}
                        onChange={e => updateLayoutField('colsDesktop', Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-red-600 outline-none font-bold"
                      >
                        <option value={1}>1 Produto por Linha</option>
                        <option value={2}>2 Produtos por Linha</option>
                        <option value={3}>3 Produtos por Linha</option>
                        <option value={4}>4 Produtos por Linha</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px ] font-bold uppercase text-zinc-400 mb-1">Máx. de Produtos</label>
                      <input 
                        type="number" 
                        min={1}
                        max={30}
                        value={activeSecLayout.limit}
                        onChange={e => updateLayoutField('limit', Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-600 text-white text-center font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px ] font-bold uppercase text-zinc-400 mb-1.5">Estilo Estético</label>
                      <select 
                        value={activeSecLayout.style}
                        onChange={e => updateLayoutField('style', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-red-600 outline-none font-bold"
                      >
                        <option value="standard">Padrão da Boutique</option>
                        <option value="compact">Compacto e Liso</option>
                        <option value="highlight">Exclusivo Destaque Grande</option>
                        <option value="premium">Premium Glamour Vermelho</option>
                      </select>
                    </div>
                  </div>

                  {/* MOBILE SECTIONS PREFERENCES */}
                  <div className="bg-zinc-900/30 border border-zinc-900/60 p-3 rounded-2xl space-y-3">
                    <h4 className="text-[9px] font-black uppercase text-zinc-400 flex items-center gap-1">
                      <Smartphone size={10} className="text-red-500" /> Preferências do Mobile / Celular
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Direção Mobile</label>
                        <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button 
                            onClick={() => updateLayoutField('mobileOrientation', 'horizontal')}
                            className={`py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                              activeSecLayout.mobileOrientation === 'horizontal' ? 'bg-zinc-800 text-white' : 'text-zinc-600'
                            }`}
                          >
                            Horizontal
                          </button>
                          <button 
                            onClick={() => updateLayoutField('mobileOrientation', 'vertical')}
                            className={`py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                              activeSecLayout.mobileOrientation === 'vertical' ? 'bg-zinc-800 text-white' : 'text-zinc-600'
                            }`}
                          >
                            Vertical
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Colunas Mobile</label>
                        <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button 
                            onClick={() => updateLayoutField('mobileCols', 1)}
                            className={`py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                              activeSecLayout.mobileCols === 1 ? 'bg-zinc-800 text-white' : 'text-zinc-600'
                            }`}
                          >
                            1 Col
                          </button>
                          <button 
                            onClick={() => updateLayoutField('mobileCols', 2)}
                            className={`py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                              activeSecLayout.mobileCols === 2 ? 'bg-zinc-800 text-white' : 'text-zinc-600'
                            }`}
                          >
                            2 Cols
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOCK 4: SCHEDULING (AGENDAMENTO) */}
              {activeSecSchedule && (
                <div className="space-y-4 border-t border-zinc-900 pt-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-red-500 flex items-center gap-1.5">
                      <Calendar size={12} /> Agendamento de Exibição
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400">Ativar Agendamento</span>
                      <input 
                        type="checkbox"
                        checked={activeSecSchedule.hasSchedule}
                        onChange={e => updateScheduleField('hasSchedule', e.target.checked)}
                        className="accent-red-600 rounded bg-zinc-900 border-zinc-800 h-4 w-4 outline-none text-red-600"
                      />
                    </div>
                  </div>

                  {activeSecSchedule.hasSchedule && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-4 bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl"
                    >
                      <div>
                        <h4 className="text-[9px] font-black text-red-500 uppercase tracking-wider mb-2">Início da Campanha</h4>
                        <label className="block text-[9px] text-zinc-500 mb-0.5">Data Início</label>
                        <input 
                          type="date" 
                          value={activeSecSchedule.startDate || ''}
                          onChange={e => updateScheduleField('startDate', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white uppercase"
                        />
                        <label className="block text-[9px] text-zinc-500 mt-2 mb-0.5">Horário Início</label>
                        <input 
                          type="time" 
                          value={activeSecSchedule.startTime || ''}
                          onChange={e => updateScheduleField('startTime', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <h4 className="text-[9px] font-black text-red-500 uppercase tracking-wider mb-2">Término da Campanha</h4>
                        <label className="block text-[9px] text-zinc-500 mb-0.5">Data Término</label>
                        <input 
                          type="date" 
                          value={activeSecSchedule.endDate || ''}
                          onChange={e => updateScheduleField('endDate', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white uppercase"
                        />
                        <label className="block text-[9px] text-zinc-500 mt-2 mb-0.5">Horário Término</label>
                        <input 
                          type="time" 
                          value={activeSecSchedule.endTime || ''}
                          onChange={e => updateScheduleField('endTime', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* BLOCK 5: ADVANCED STYLE & BOTÃO 'VER TODOS' */}
              <div className="space-y-4 border-t border-zinc-900 pt-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-red-500 flex items-center gap-1.5">
                  <Palette size={12} /> Aparência Avançada & Botões
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Cor do Título</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={activeSecSettings.themeColor || '#ef4444'}
                        onChange={e => updateSettingsField('themeColor', e.target.value)}
                        className="bg-transparent border border-zinc-800 rounded-lg w-8 h-8 cursor-pointer shrink-0"
                      />
                      <input 
                        type="text" 
                        value={activeSecSettings.themeColor || '#ef4444'}
                        onChange={e => updateSettingsField('themeColor', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Fundo da Seção</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={activeSecSettings.themeBg === 'transparent' ? '#050505' : (activeSecSettings.themeBg || '#050505')}
                        onChange={e => updateSettingsField('themeBg', e.target.value)}
                        className="bg-transparent border border-zinc-800 rounded-lg w-8 h-8 cursor-pointer shrink-0"
                      />
                      <input 
                        type="text" 
                        value={activeSecSettings.themeBg || '#050505'}
                        onChange={e => updateSettingsField('themeBg', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 text-xs text-white font-mono"
                        placeholder="#050505 ou transparent"
                      />
                      <button
                        type="button"
                        onClick={() => updateSettingsField('themeBg', 'transparent')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border shrink-0 transition-all ${
                          activeSecSettings.themeBg === 'transparent'
                            ? 'bg-red-600/30 border-red-500 text-red-500 hover:bg-red-600/40'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                        }`}
                      >
                        Transparente
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">URL do Banner da Coleção (Para o Topo do Catálogo)</label>
                    <input 
                      type="text" 
                      placeholder="https://discretaboutique.com.br/banners/exemplo.jpg"
                      value={activeSecSettings.bannerImageUrl || ''}
                      onChange={e => updateSettingsField('bannerImageUrl', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-red-600 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* VER TODOS TOGGLE AND DETAILS */}
                <div className="bg-zinc-900/30 border border-zinc-900 p-3 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold uppercase text-zinc-400">Exibir Botão "Ver Todos"</label>
                    <input 
                      type="checkbox"
                      checked={activeSecSettings.showButton ?? true}
                      onChange={e => updateSettingsField('showButton', e.target.checked)}
                      className="accent-red-600 rounded bg-zinc-900 border-zinc-800 h-4 w-4 outline-none text-red-600"
                    />
                  </div>

                  {(activeSecSettings.showButton ?? true) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <label className="block text-[9px] text-zinc-500 mb-0.5">Texto do Botão</label>
                        <input 
                          type="text" 
                          placeholder="Ver Todos"
                          value={activeSecSettings.buttonText || ''}
                          onChange={e => updateSettingsField('buttonText', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[9px] text-zinc-500 mb-0.5">URL Personalizada</label>
                        <input 
                          type="text" 
                          placeholder="/catalogo"
                          value={activeSecSettings.buttonUrl || ''}
                          onChange={e => updateSettingsField('buttonUrl', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* SAVE BUTTON INSIDE EDITOR */}
              <div className="pt-6 border-t border-zinc-900 flex justify-end gap-3">
                <button 
                  disabled={saving}
                  onClick={handleSaveSection}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                >
                  {saving ? 'Guardando...' : 'Salvar Filtros desta Seção'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <span className="text-4xl mb-3">👈</span>
              <p className="text-zinc-500 font-bold text-sm">Selecione uma seção da lista para editar as propriedades.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PREVIEW EM TEMPO REAL (Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[3px] text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-red-500" /> Preview Instantâneo
            </h3>

            {/* Device switch buttons */}
            <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl">
              <button 
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-lg transition-all ${previewDevice === 'desktop' ? 'bg-red-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                title="Visual Desktop"
              >
                <Laptop size={14} />
              </button>
              <button 
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-lg transition-all ${previewDevice === 'mobile' ? 'bg-red-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                title="Visual Celular"
              >
                <Smartphone size={14} />
              </button>
            </div>
          </div>

          {/* SIMULATED FRAME VIEWPORT */}
          <div className="flex justify-center bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-4 shadow-2xl relative overflow-hidden h-[600px]">
            <div className={`transition-all duration-500 overflow-y-auto no-scrollbar max-h-full ${
              previewDevice === 'mobile' 
                ? 'w-[280px] border-[6px] border-zinc-800 rounded-[35px] bg-[#000] p-3' 
                : 'w-full bg-[#000] rounded-2xl p-4'
            }`}>
              
              {/* Header inside simulation */}
              <div className="border-b border-zinc-900 pb-2 mb-4 flex justify-between items-center">
                <span className="text-[10px] font-black italic tracking-tighter uppercase text-white">Discreta Boutique</span>
                <span className="text-[8px] bg-red-600/30 text-red-500 text-[8px] px-1.5 py-0.5 rounded-full uppercase">Live Recs</span>
              </div>

              {/* Dynamic Preview Section Body */}
              {activeSecSettings ? (
                <section 
                  className="rounded-2xl p-4 transition-all"
                  style={{ 
                    backgroundColor: activeSecSettings.themeBg || '#000000',
                  }}
                >
                  
                  {/* Title and Header of Carousel */}
                  <div className={`mb-4 flex flex-col ${
                    activeSecSettings.alignment === 'center' 
                      ? 'items-center text-center' 
                      : activeSecSettings.alignment === 'right' 
                        ? 'items-end text-right' 
                        : 'items-start text-left'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{activeSecSettings.emoji}</span>
                      <h3 
                        className="text-base font-black uppercase italic tracking-tighter"
                        style={{ color: activeSecSettings.themeColor || '#ffffff' }}
                      >
                        {activeSecSettings.title}
                      </h3>
                    </div>
                    {activeSecSettings.subtitle && (
                      <p className="text-[9px] text-zinc-400 mt-0.5">{activeSecSettings.subtitle}</p>
                    )}
                  </div>

                  {/* Simulated Countdown for Limited Promo */}
                  {activeSecSettings.source === 'limited_promo' && (
                    <div className="mb-4 bg-zinc-950 border border-zinc-900 rounded-xl p-2.5 flex flex-col items-center gap-1.5 shadow-md">
                      <span className="text-[8px] font-black uppercase text-red-500 tracking-wider">⚡ Oferta Relâmpago Ativa:</span>
                      <div className="flex gap-1 items-center font-mono text-[9px] font-bold text-white">
                        <span className="bg-red-600 px-1.5 py-0.5 rounded text-center min-w-[14px]">01</span>
                        <span className="text-zinc-700 font-black">:</span>
                        <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-center text-red-500 min-w-[14px]">14</span>
                        <span className="text-zinc-700 font-black">:</span>
                        <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-center text-red-500 min-w-[14px]">45</span>
                        <span className="text-zinc-700 font-black">:</span>
                        <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-center text-red-500 min-w-[14px]">22</span>
                      </div>
                    </div>
                  )}

                  {/* Simulated Carousel Grid */}
                  {activeSecLayout?.orientation === 'horizontal' && previewDevice === 'desktop' ? (
                    <div className="relative">
                      <div className="flex gap-2 overflow-x-hidden pb-2">
                        {previewProducts.map((p, i) => (
                          <div key={i} className="min-w-[120px] bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                            <div className="w-full aspect-square bg-zinc-950 rounded-lg overflow-hidden relative border border-zinc-900 flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-[10px] text-zinc-700 font-bold uppercase italic">Sem Foto</div>
                              )}
                              {p.onSale && (
                                <span className="absolute top-1 left-1 bg-red-600 text-white text-[6px] px-1 font-black rounded">PROMO</span>
                              )}
                            </div>
                            <h4 className="text-[9px] font-bold text-zinc-300 truncate mt-1.5">{p.name}</h4>
                            <p className="text-[8px] text-red-500 font-extrabold mt-0.5">R$ {p.price.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Nav Mock arrows */}
                      <div className="absolute top-[40%] -translate-y-1/2 left-[-10px] w-5 h-5 bg-zinc-900/80 rounded-full flex items-center justify-center shadow">
                        <ChevronLeft size={10} className="text-white" />
                      </div>
                      <div className="absolute top-[40%] -translate-y-1/2 right-[-10px] w-5 h-5 bg-zinc-900/80 rounded-full flex items-center justify-center shadow">
                        <ChevronRight size={10} className="text-white" />
                      </div>
                    </div>
                  ) : (
                    /* Grid Simulation base depending on columns settings */
                    <div className={`grid gap-2 ${
                      previewDevice === 'mobile' 
                        ? (activeSecLayout?.mobileCols === 1 ? 'grid-cols-1' : 'grid-cols-2') 
                        : (activeSecLayout?.colsDesktop === 4 ? 'grid-cols-4' : activeSecLayout?.colsDesktop === 3 ? 'grid-cols-3' : activeSecLayout?.colsDesktop === 2 ? 'grid-cols-2' : 'grid-cols-1')
                    }`}>
                      {previewProducts.map((p, i) => (
                        <div key={i} className="bg-zinc-900 p-2 rounded-xl border border-zinc-800 flex flex-col justify-between">
                          <div className="w-full aspect-square bg-zinc-950 rounded-lg overflow-hidden relative flex items-center justify-center border border-zinc-900">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[8px] text-zinc-700">No Image</span>
                            )}
                          </div>
                          <h4 className="text-[8px] font-bold text-zinc-300 truncate mt-1.5">{p.name}</h4>
                          <p className="text-[8px] text-red-500 font-black mt-0.5">R$ {p.price.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Button View More Simulated */}
                  {(activeSecSettings.showButton ?? true) && (
                    <div className="mt-4 flex justify-center">
                      <button className="bg-red-600 text-white text-[8px] uppercase tracking-widest font-black px-4 py-1.5 rounded-full transition-all hover:scale-105 shadow-md">
                        {activeSecSettings.buttonText || 'Ver Todos'}
                      </button>
                    </div>
                  )}

                </section>
              ) : (
                <div className="flex items-center justify-center text-zinc-600 h-64 border border-dashed border-zinc-800 rounded-3xl">
                  Selecione uma seção para ver o preview.
                </div>
              )}

              {/* Small simulated banner */}
              <div className="mt-8 p-3 rounded-2xl bg-zinc-950 border border-zinc-900 flex justify-between items-center">
                <span className="text-[7px] text-zinc-500">Banner Rodapé de Confiança</span>
                <span className="text-[7px] text-red-500">Sigilo Absoluto</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* CREATE NEW CUSTOM SECTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 shadow-2xl"
          >
            <h3 className="text-lg font-black text-white italic uppercase tracking-tight mb-2 flex items-center gap-2">
              ✨ Nova Seção Customizada
            </h3>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Crie uma nova seção editável para a página inicial da loja. Uma vez criada, ela aparecerá na sua lista para você configurar os produtos e alinhamento.
            </p>

            <form onSubmit={handleCreateSection} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Título da Seção</label>
                <input 
                  type="text" 
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  placeholder="Ex: Kits para Casais, Escolha da Discreta..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-red-600"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setNewSectionTitle('');
                    setShowCreateModal(false);
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 font-bold py-2.5 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl text-white font-black py-2.5 text-xs uppercase shadow-lg shadow-red-900/30"
                >
                  Criar Seção
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DELETE CUSTOM SECTION CONFIRMATION MODAL */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-6 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-full bg-red-950/45 border border-red-900/60 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">
              Excluir Seção Customizada?
            </h3>
            <p className="text-xs text-zinc-550 mb-5 leading-relaxed">
              Você está prestes a excluir definitivamente a seção <strong className="text-white">"{sectionToDelete.title}"</strong>. Esta ação é <span className="text-red-500 font-bold uppercase tracking-wider">irreversível</span> e apagará todas as configurações e regras de vinculação desta seção.
            </p>

            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 font-bold py-2.5 text-xs uppercase transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteSection(sectionToDelete.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl text-white font-black py-2.5 text-xs uppercase transition-all shadow-lg hover:shadow-red-900/50 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
