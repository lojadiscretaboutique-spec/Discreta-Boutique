import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import Papa from 'papaparse';
import { 
  Plus, Edit2, Trash2, Upload, Save, ArrowLeft, 
  Info, Layers, Image as ImageIcon, Search, 
  Check, ChevronRight, Copy, Eye, EyeOff, Tag, 
  Globe, Settings2, Palette, Layout, Download,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { categoryService, Category } from '../../services/categoryService';
import { useFeedback } from '../../contexts/FeedbackContext';

type FormSection = 'basic' | 'structure' | 'visual' | 'display' | 'seo' | 'config';

export function AdminCategories() {
  const { hasPermission } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);

  const canCreate = hasPermission('categorias', 'criar');
  const canEdit = hasPermission('categorias', 'editar');
  const canDelete = hasPermission('categorias', 'excluir');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeTab, setActiveTab] = useState<FormSection>('basic');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState<'all' | 'root' | 'sub'>('all');

  const initialCategory: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'productCount'> = {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    parentId: null,
    level: 0,
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    showInMenu: true,
    showInHome: true,
    icon: '',
    color: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    defaultCommission: 0,
    extraFee: 0,
    internalNotes: ''
  };

  const [form, setForm] = useState<Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'productCount'>>(initialCategory);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'banner' | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    // Generate data rows from simple mapping
    const exportData = categories.map(cat => {
      const parent = categories.find(c => c.id === cat.parentId);
      return {
        id: cat.id,
        nome: cat.name,
        slug: cat.slug,
        categoria_pai_id: cat.parentId || '',
        categoria_pai_nome: parent?.name || '',
        ordem: cat.sortOrder,
        ativa: cat.isActive ? 'sim' : 'nao',
        em_destaque: cat.isFeatured ? 'sim' : 'nao',
        exibir_no_menu: cat.showInMenu ? 'sim' : 'nao',
        exibir_na_home: cat.showInHome ? 'sim' : 'nao',
        descricao_curta: cat.shortDescription || '',
        descricao: cat.description || ''
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `categorias_discreta_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("CSV exportado com sucesso!");
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          let successCount = 0;
          let errorCount = 0;

          // Load current state to map parents and check existence
          const currentCats = await categoryService.listCategories();
          
          for (const row of rows) {
            try {
              const name = row.nome || row.name;
              if (!name) continue;

              const catData: Partial<Category> = {
                name: name,
                slug: row.slug || generateSlug(name),
                sortOrder: Number(row.ordem || row.sortOrder || 0),
                isActive: (row.ativa || row.active)?.toString().toLowerCase() === 'sim' || (row.ativa || row.active)?.toString().toLowerCase() === 'true',
                isFeatured: (row.em_destaque || row.featured)?.toString().toLowerCase() === 'sim' || (row.em_destaque || row.featured)?.toString().toLowerCase() === 'true',
                showInMenu: (row.exibir_no_menu || row.showInMenu)?.toString().toLowerCase() !== 'nao',
                showInHome: (row.exibir_na_home || row.showInHome)?.toString().toLowerCase() !== 'nao',
                shortDescription: row.descricao_curta || row.shortDescription || '',
                description: row.descricao || row.description || '',
                level: 0
              };

              // Resolve parentId
              let parentId = row.categoria_pai_id || row.parentId || null;
              if (!parentId && (row.categoria_pai_nome || row.parentName)) {
                const parent = currentCats.find(c => c.name.toLowerCase() === (row.categoria_pai_nome || row.parentName).toLowerCase());
                if (parent) parentId = parent.id;
              }
              
              catData.parentId = parentId || null;
              catData.level = parentId ? 1 : 0;

              const existingId = row.id;
              const exists = currentCats.find(c => (existingId && c.id === existingId) || c.slug === catData.slug);

              if (exists) {
                await categoryService.updateCategory(exists.id, catData);
              } else {
                await categoryService.createCategory(catData);
              }
              successCount++;
            } catch (err) {
              console.error("Erro ao importar linha:", row, err);
              errorCount++;
            }
          }

          toast(`Importação concluída: ${successCount} sucesso(s), ${errorCount} erro(s).`);
          loadData();
        } catch (err) {
          console.error("Erro processando CSV:", err);
          toast("Erro ao processar o arquivo CSV.", "error");
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoryService.listCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    const formValues: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'productCount'> = {
      name: cat.name,
      slug: cat.slug,
      shortDescription: cat.shortDescription || '',
      description: cat.description || '',
      parentId: cat.parentId,
      level: cat.level,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      isFeatured: cat.isFeatured,
      showInMenu: cat.showInMenu,
      showInHome: cat.showInHome,
      image: cat.image,
      banner: cat.banner,
      icon: cat.icon || '',
      color: cat.color || '',
      seoTitle: cat.seoTitle || '',
      seoDescription: cat.seoDescription || '',
      seoKeywords: cat.seoKeywords || '',
      defaultCommission: cat.defaultCommission || 0,
      extraFee: cat.extraFee || 0,
      internalNotes: cat.internalNotes || ''
    };
    setForm(formValues);
    setView('form');
    setActiveTab('basic');
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(initialCategory);
    setView('list'); // Reset view first
    setTimeout(() => {
      setView('form');
      setActiveTab('basic');
    }, 0);
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir Categoria',
      message: `Tem certeza que deseja excluir a categoria "${name}"?`,
      confirmText: 'Excluir',
      variant: 'danger'
    });

    if (ok) {
      try {
        await categoryService.deleteCategory(id);
        loadData();
        toast("Categoria excluída com sucesso!");
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro ao excluir categoria.";
        toast(msg, 'error');
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const ok = await confirm({
      title: 'Duplicar Categoria',
      message: "Deseja duplicar esta categoria?",
      confirmText: 'Duplicar'
    });

    if (ok) {
      try {
        await categoryService.duplicateCategory(id);
        loadData();
        toast("Categoria duplicada com sucesso!");
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro ao duplicar categoria.";
        toast(msg, 'error');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast("O nome da categoria é obrigatório.", 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const finalForm = {
        ...form,
        slug: form.slug || generateSlug(form.name),
        level: form.parentId ? 1 : 0 // Simplified for now, can be updated for deeper levels
      };

      if (editingId) {
        await categoryService.updateCategory(editingId, finalForm);
      } else {
        await categoryService.createCategory(finalForm);
      }
      
      setView('list');
      loadData();
      toast(editingId ? "Categoria atualizada com sucesso!" : "Categoria criada com sucesso!");
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar categoria.", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'banner') => {
    if (!e.target.files?.length) return;
    
    setUploading(type);
    try {
      const file = e.target.files[0];
      const result = await categoryService.uploadImage(file);
      if (type === 'image') {
        setForm({ ...form, image: result });
      } else {
        setForm({ ...form, banner: result });
      }
    } catch (err: unknown) {
      console.error("Upload error detail:", err);
      const errorMessage = err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente';
      toast(`Erro no upload: ${errorMessage}`, 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleGenerateAI = async () => {
    if (!form.name) {
      toast("Digite o nome da categoria primeiro para a IA analisar.", "warning");
      return;
    }

    setGeneratingAI(true);
    try {
      const response = await fetch('/api/ia/gerar-categoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.name })
      });

      if (!response.ok) throw new Error('Falha ao gerar conteúdo');

      const data = await response.json();
      setForm(prev => ({
        ...prev,
        description: data.conteudo_seo,
        shortDescription: data.descricao,
        seoTitle: data.meta_title,
        seoDescription: data.meta_description,
        seoKeywords: data.palavras_chave.join(', ')
      }));

      toast("Conteúdo gerado pela IA com sucesso!", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao gerar conteúdo com IA.", "error");
    } finally {
      setGeneratingAI(false);
    }
  };

  const removeImage = async (type: 'image' | 'banner') => {
    const img = type === 'image' ? form.image : form.banner;
    if (img) {
      const ok = await confirm({
        title: 'Remover Imagem',
        message: `Deseja remover ${type === 'image' ? 'a imagem' : 'o banner'}?`,
        confirmText: 'Remover',
        variant: 'danger'
      });

      if (ok) {
        await categoryService.deleteImage(img.path);
        if (type === 'image') {
          setForm({ ...form, image: undefined });
        } else {
          setForm({ ...form, banner: undefined });
        }
        toast("Imagem removida.");
      }
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase()) || cat.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? cat.isActive : !cat.isActive);
    const matchesType = filterType === 'all' || (filterType === 'root' ? !cat.parentId : !!cat.parentId);
    return matchesSearch && matchesStatus && matchesType;
  });

  // Helper to build hierarchy for display
  const rootCategories = filteredCategories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => filteredCategories.filter(c => c.parentId === parentId);

  const tabs: {id: FormSection, label: string, icon: React.ElementType}[] = [
    { id: 'basic', label: 'Básico', icon: Info },
    { id: 'structure', label: 'Estrutura', icon: Layout },
    { id: 'visual', label: 'Visual', icon: Palette },
    { id: 'display', label: 'Exibição', icon: Eye },
    { id: 'seo', label: 'SEO', icon: Globe },
    { id: 'config', label: 'Configurações', icon: Settings2 },
  ];

  if (view === 'form') {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 md:relative z-[60] bg-slate-950 py-2">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-slate-900 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h1>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{form.name || 'Sem nome'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-red-600 hover:bg-red-700">
              {submitting ? 'Salvando...' : <><Save size={18} className="mr-2"/> Salvar Categoria</>}
            </Button>
          </div>
        </header>

        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          <div className="w-full md:w-64 border-r bg-slate-800 flex flex-col pt-4 shrink-0">
             {tabs.map(tab => {
               const Icon = tab.icon;
               return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 px-6 py-4 text-sm font-medium transition-all text-left",
                      activeTab === tab.id 
                        ? "bg-slate-900 text-red-600 border-r-2 border-red-600 shadow-sm" 
                        : "text-slate-400 hover:bg-slate-950"
                    )}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
               )
             })}
          </div>

          <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* 1. BÁSICO */}
            {activeTab === 'basic' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Info size={20} className="text-slate-400" /> Informações Básicas</h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={generatingAI}
                    onClick={handleGenerateAI}
                    className="border-red-600/30 text-red-500 hover:bg-red-950/20"
                  >
                    {generatingAI ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2"></div> : <Sparkles size={14} className="mr-2" />}
                    {generatingAI ? 'Gerando...' : 'Gerar com IA'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">Nome da Categoria *</label>
                    <Input 
                      value={form.name} 
                      onChange={e => {
                        const name = e.target.value;
                        setForm({ ...form, name, slug: editingId ? form.slug : generateSlug(name) });
                      }} 
                      placeholder="Ex: Lingerie de Renda" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">Slug da URL</label>
                    <Input value={form.slug} onChange={e => setForm({ ...form, slug: generateSlug(e.target.value) })} placeholder="lingerie-de-renda" />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold mb-1">Descrição Curta (Resumo)</label>
                   <textarea 
                     className="w-full min-h-[80px] p-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                     value={form.shortDescription}
                     onChange={e => setForm({ ...form, shortDescription: e.target.value })}
                   />
                </div>

                <div>
                   <label className="block text-sm font-bold mb-1">Descrição Completa</label>
                   <textarea 
                     className="w-full min-h-[150px] p-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                     value={form.description}
                     onChange={e => setForm({ ...form, description: e.target.value })}
                     placeholder="Informações detalhadas sobre a categoria..."
                   />
                </div>
              </div>
            )}

            {/* 2. ESTRUTURA */}
            {activeTab === 'structure' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2"><Layout size={20} className="text-slate-400" /> Estrutura</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-slate-200">Tipo de Categoria</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        type="button"
                        onClick={() => setForm({ ...form, parentId: null })}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 border rounded-xl transition-all",
                          !form.parentId ? "border-red-600 bg-red-50 text-red-600" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <Layers size={24} />
                        <span className="font-bold text-sm">Categoria Raiz</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!form.parentId) {
                            const firstRoot = categories.find(c => !c.parentId);
                            setForm({ ...form, parentId: firstRoot?.id || '' });
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 border rounded-xl transition-all",
                          form.parentId ? "border-red-600 bg-red-50 text-red-600" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <Tag size={24} />
                        <span className="font-bold text-sm">Subcategoria</span>
                      </button>
                    </div>
                  </div>

                  {form.parentId !== null && (
                    <div className="motion-safe:animate-in slide-in-from-top-2">
                      <label className="block text-sm font-bold mb-1">Categoria Pai</label>
                      <select 
                        className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                        value={form.parentId || ''}
                        onChange={e => setForm({ ...form, parentId: e.target.value })}
                      >
                        <option value="">Selecione a categoria raiz...</option>
                        {categories.filter(c => !c.parentId && c.id !== editingId).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold mb-1">Ordem de Exibição</label>
                    <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} placeholder="0" />
                    <p className="text-[10px] text-slate-400 mt-1 uppercase">Menores números aparecem primeiro.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. VISUAL */}
            {activeTab === 'visual' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2"><Palette size={20} className="text-slate-400" /> Identidade Visual</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold">Imagem da Categoria (Quadrada)</label>
                    <div className={cn("relative aspect-square max-w-[200px] rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center transition-all", form.image ? "border-slate-700" : "border-slate-600 hover:border-red-400")}>
                      {form.image ? (
                        <>
                          <img 
                            src={form.image.url || undefined} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              toast("A imagem original desta categoria não foi encontrada no servidor e foi removida do cadastro.", "warning");
                              setForm(prev => ({ ...prev, image: undefined }));
                              if (editingId) categoryService.updateCategory(editingId, { image: null }).catch(console.error);
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 hidden peer-invalid:flex">
                             <ImageIcon size={32} className="text-slate-300" />
                          </div>
                          <button onClick={() => removeImage('image')} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg z-10"><Trash2 size={16}/></button>
                        </>
                      ) : (
                        <label className="flex flex-col items-center gap-2 cursor-pointer text-slate-400">
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'image')} disabled={!!uploading} />
                          {uploading === 'image' ? <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div> : <><Upload size={32} /> <span className="text-xs font-bold uppercase tracking-wider">Subir Imagem</span></>}
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-bold">Banner da Categoria (Horizontal)</label>
                    <div className={cn("relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center transition-all", form.banner ? "border-slate-700" : "border-slate-600 hover:border-red-400")}>
                      {form.banner ? (
                        <>
                          <img 
                            src={form.banner.url || undefined} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              toast("O banner original desta categoria não foi encontrado servidor e foi removido do cadastro.", "warning");
                              setForm(prev => ({ ...prev, banner: undefined }));
                              if (editingId) categoryService.updateCategory(editingId, { banner: null }).catch(console.error);
                            }}
                          />
                          <button onClick={() => removeImage('banner')} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg z-10"><Trash2 size={16}/></button>
                        </>
                      ) : (
                        <label className="flex flex-col items-center gap-2 cursor-pointer text-slate-400">
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'banner')} disabled={!!uploading} />
                          {uploading === 'banner' ? <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div> : <><ImageIcon size={32} /> <span className="text-xs font-bold uppercase tracking-wider">Subir Banner</span></>}
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Ícone (Nome do Lucide ou Emoji)</label>
                    <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="Ex: Shirt, Heart, 👗" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Cor de Destaque (HEX)</label>
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded border" style={{ backgroundColor: form.color || '#f1f5f9' }}></div>
                      <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#D32F2F" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. EXIBICAO */}
            {activeTab === 'display' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2"><Eye size={20} className="text-slate-400" /> Controle de Exibição</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-bold text-sm">Categoria Ativa</p>
                      <p className="text-xs text-slate-400">Visível no sistema para clientes.</p>
                    </div>
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-5 h-5 accent-red-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-bold text-sm">Categoria em Destaque</p>
                      <p className="text-xs text-slate-400">Aparece com prioridade.</p>
                    </div>
                    <input type="checkbox" checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} className="w-5 h-5 accent-red-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-bold text-sm">Exibir no Menu</p>
                      <p className="text-xs text-slate-400">Visível no menu de navegação.</p>
                    </div>
                    <input type="checkbox" checked={form.showInMenu} onChange={e => setForm({ ...form, showInMenu: e.target.checked })} className="w-5 h-5 accent-red-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-bold text-sm">Exibir na Home</p>
                      <p className="text-xs text-slate-400">Aparece na página inicial.</p>
                    </div>
                    <input type="checkbox" checked={form.showInHome} onChange={e => setForm({ ...form, showInHome: e.target.checked })} className="w-5 h-5 accent-red-600" />
                  </div>
                </div>
              </div>
            )}

            {/* 5. SEO */}
            {activeTab === 'seo' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Globe size={20} className="text-slate-400" /> Otimização para Buscadores (SEO)</h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={generatingAI}
                    onClick={handleGenerateAI}
                    className="border-red-600/30 text-red-500 hover:bg-red-950/20"
                  >
                    {generatingAI ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2"></div> : <Sparkles size={14} className="mr-2" />}
                    {generatingAI ? 'Gerando...' : 'Otimizar com IA'}
                  </Button>
                </div>
                <div className="space-y-6">
                   <div>
                     <label className="block text-sm font-bold mb-1">Título da Página (Meta Title)</label>
                     <Input value={form.seoTitle} onChange={e => setForm({...form, seoTitle: e.target.value})} placeholder="Padrão: Nome da Categoria" />
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Meta Descrição</label>
                     <textarea 
                        className="w-full h-24 border p-3 rounded text-sm focus:ring-2 focus:ring-red-600 outline-none" 
                        value={form.seoDescription} 
                        onChange={e => setForm({...form, seoDescription: e.target.value})} 
                        placeholder="Resumo que aparecerá no Google..."
                      />
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Palavras-chave (Tags)</label>
                     <Input value={form.seoKeywords} onChange={e => setForm({...form, seoKeywords: e.target.value})} placeholder="moda, lingerie, sutiã, renda" />
                   </div>

                   <div className="p-4 bg-slate-900 rounded-xl text-slate-400 space-y-2">
                      <p className="text-blue-400 font-medium text-sm truncate">https://sualoja.com/categoria/{form.slug || 'url'}</p>
                      <p className="text-white font-bold text-lg">{form.seoTitle || form.name || 'Título da Categoria'}</p>
                      <p className="text-xs leading-relaxed line-clamp-2">{form.seoDescription || 'A descrição SEO configurada acima aparecerá aqui nos resultados de busca do Google e redes sociais.'}</p>
                   </div>
                </div>
              </div>
            )}

            {/* 6. CONFIGURAÇÕES */}
            {activeTab === 'config' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2"><Settings2 size={20} className="text-slate-400" /> Regras de Negócio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-slate-200">Comissão de Venda Padrão (%)</label>
                    <Input type="number" step="0.1" value={form.defaultCommission} onChange={e => setForm({ ...form, defaultCommission: Number(e.target.value) })} />
                    <p className="text-[10px] text-slate-400 mt-1">Será aplicada a todos os produtos desta categoria.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-slate-200">Taxa Extra por Venda (R$)</label>
                    <Input type="number" step="0.01" value={form.extraFee} onChange={e => setForm({ ...form, extraFee: Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1 text-slate-200">Observações Internas (Não visível ao cliente)</label>
                    <textarea 
                      className="w-full h-24 border p-3 rounded text-sm focus:ring-2 focus:ring-red-600 outline-none"
                      value={form.internalNotes} 
                      onChange={e => setForm({ ...form, internalNotes: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gerenciamento de Categorias</h1>
          <p className="text-slate-400">Organize sua estrutura de produtos e otimize a navegação da loja.</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImportCSV} 
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()} 
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
                title="Importar de CSV"
              >
                <Upload size={18} className="mr-2" /> Importar
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportCSV} 
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
                title="Exportar para CSV"
              >
                <Download size={18} className="mr-2" /> Exportar
              </Button>
              <Button onClick={handleNew} className="bg-slate-950 hover:bg-slate-800 shadow-xl shadow-slate-200">
                <Plus size={18} className="mr-2" /> Nova Categoria
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden min-h-[500px]">
        {/* Barra de Ferramentas */}
        <div className="p-4 border-b bg-slate-800/50 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="Buscar categorias..." 
                  className="pl-10 h-10 w-full" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex flex-wrap items-center gap-3">
               <select 
                 className="h-10 px-3 bg-slate-900 border rounded-lg text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
                 value={filterStatus}
                 onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
               >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Inativas</option>
               </select>
               <select 
                 className="h-10 px-3 bg-slate-900 border rounded-lg text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
                 value={filterType}
                 onChange={e => setFilterType(e.target.value as 'all' | 'root' | 'sub')}
               >
                  <option value="all">Todos os Tipos</option>
                  <option value="root">Somente Raiz</option>
                  <option value="sub">Somente Sub</option>
               </select>
               <div className="flex items-center gap-4 text-[10px] font-black tracking-widest text-slate-400 border-l pl-4 shrink-0">
                  <span className="flex items-center gap-1 uppercase"><Check size={14} className="text-green-500" /> {categories.filter(c => c.isActive).length} Ativas</span>
                  <span className="flex items-center gap-1 uppercase"><EyeOff size={14} className="text-red-500" /> {categories.filter(c => !c.isActive).length} Ocultas</span>
               </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
             <thead className="bg-slate-800 text-slate-400 font-bold border-b text-[11px] uppercase tracking-widest">
                <tr>
                   <th className="px-6 py-4">Nome / Slug</th>
                   <th className="px-6 py-4 text-center">Produtos</th>
                   <th className="px-6 py-4 text-center">Ordem</th>
                   <th className="px-6 py-4 text-center">Status</th>
                   <th className="px-6 py-4 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Carregando categorias...</p>
                    </div>
                  </td></tr>
                ) : rootCategories.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center text-slate-300">Nenhuma categoria encontrada.</td></tr>
                ) : rootCategories.map(cat => (
                  <CategoryRow 
                    key={cat.id} 
                    category={cat} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                    onDuplicate={handleDuplicate}
                    subcategories={getSubcategories(cat.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canCreate={canCreate}
                  />
                ))}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  subcategories?: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}

function CategoryRow({ 
  category, 
  subcategories = [], 
  onEdit, 
  onDelete, 
  onDuplicate,
  canEdit,
  canDelete,
  canCreate
}: CategoryRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [imgError, setImgError] = useState(false);

  return (
    <>
      <tr className="group hover:bg-slate-800 transition-colors">
         <td className="px-6 py-3">
            <div className="flex items-center gap-3">
               {subcategories.length > 0 ? (
                 <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-slate-900 rounded transition-colors text-slate-400">
                    <ChevronRight size={16} className={cn("transition-transform", isExpanded && "rotate-90")} />
                 </button>
               ) : <div className="w-6" />}
               
               <div className="w-10 h-10 bg-slate-950 rounded-lg overflow-hidden border border-slate-700 shrink-0 flex items-center justify-center">
                  {category.image && !imgError ? (
                    <img 
                      src={category.image.url || undefined} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setImgError(true);
                        categoryService.updateCategory(category.id, { image: null }).catch(console.error);
                      }}
                    />
                  ) : (
                    <Layers className="text-slate-300" size={18} />
                  )}
               </div>

               <div className="flex flex-col min-w-0 max-w-[250px]">
                  <h4 className="font-bold text-white text-sm group-hover:text-red-600 transition-colors uppercase whitespace-normal break-words">{category.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono tracking-tighter">/{category.slug}</span>
                    {category.isFeatured && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1 rounded uppercase">Destaque</span>}
                  </div>
               </div>
            </div>
         </td>
         <td className="px-6 py-3 text-center">
            <div className="flex flex-col items-center">
              <span className="font-black text-slate-200">{category.productCount || 0}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Produtos</span>
            </div>
         </td>
         <td className="px-6 py-3 text-center">
            <span className="text-xs font-mono text-slate-400">#{category.sortOrder}</span>
         </td>
         <td className="px-6 py-3 text-center">
            {category.isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase italic"><Check size={10} /> Ativa</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950 text-slate-400 text-[10px] font-bold uppercase italic"><EyeOff size={10} /> Oculta</span>
            )}
         </td>
         <td className="px-6 py-3 text-right">
            <div className="flex justify-end items-center gap-1">
               {canCreate && (
                 <button onClick={() => onDuplicate(category.id)} className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" title="Duplicar">
                    <Copy size={16} />
                 </button>
               )}
               {canEdit && (
                 <button onClick={() => onEdit(category)} className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-red-600 transition-colors" title="Editar">
                    <Edit2 size={16} />
                 </button>
               )}
               {canDelete && (
                 <button onClick={() => onDelete(category.id, category.name)} className="p-2 hover:bg-slate-900 rounded-lg text-slate-200 hover:text-red-600 transition-colors" title="Excluir">
                    <Trash2 size={16} />
                 </button>
               )}
               {!canCreate && !canEdit && !canDelete && <span className="text-[10px] text-slate-400 font-bold uppercase italic">Sem Ações</span>}
            </div>
         </td>
      </tr>
      
      {isExpanded && subcategories.map(sub => (
        <SubcategoryRow 
          key={sub.id} 
          sub={sub} 
          onEdit={onEdit} 
          onDelete={onDelete} 
        />
      ))}
    </>
  );
}

function SubcategoryRow({ sub, onEdit, onDelete }: { sub: Category, onEdit: (cat: Category) => void, onDelete: (id: string, name: string) => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <tr key={sub.id} className="group bg-slate-800/30 hover:bg-slate-800 transition-colors border-l-2 border-slate-700">
      <td className="px-6 py-3 pl-12 border-l-2 border-red-600/20">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 border rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              {sub.image && !imgError ? (
                <img 
                  src={sub.image.url || undefined} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setImgError(true);
                    categoryService.updateCategory(sub.id, { image: null }).catch(console.error);
                  }}
                />
              ) : (
                <Tag className="text-slate-300" size={14} />
              )}
            </div>
            <div className="flex flex-col">
               <h4 className="font-bold text-slate-200 text-xs group-hover:text-red-600 transition-colors">{sub.name}</h4>
               <span className="text-[10px] text-slate-400 font-mono tracking-tighter">/{sub.slug}</span>
            </div>
         </div>
      </td>
      <td className="px-6 py-3 text-center">
         <span className="font-bold text-slate-400 text-xs">{sub.productCount || 0}</span>
      </td>
      <td className="px-6 py-3 text-center">
         <span className="text-xs font-mono text-slate-400">#{sub.sortOrder}</span>
      </td>
      <td className="px-6 py-3 text-center">
         {sub.isActive ? (
           <span className="text-green-600/60"><Check size={14} className="mx-auto" /></span>
         ) : (
           <span className="text-slate-300"><EyeOff size={14} className="mx-auto" /></span>
         )}
      </td>
      <td className="px-6 py-3 text-right">
         <div className="flex justify-end items-center gap-1">
            <button onClick={() => onEdit(sub)} className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-red-600 transition-colors" title="Editar">
               <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(sub.id, sub.name)} className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-200 hover:text-red-600 transition-colors" title="Excluir">
               <Trash2 size={14} />
            </button>
         </div>
      </td>
    </tr>
  );
}
