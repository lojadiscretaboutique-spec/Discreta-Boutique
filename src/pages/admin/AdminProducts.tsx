import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Plus, Edit2, Trash2, X, Upload, Save, ArrowLeft, 
  Info, DollarSign, Layers, Shirt, Droplets, Image as ImageIcon, 
  Truck, Search, Settings, Check, Sparkles
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { formatCurrency, cn } from '../../lib/utils';
import { productService, Product, ProductVariant } from '../../services/productService';
import { PLACEHOLDER_IMAGE } from '../../lib/utils';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';

// Sections IDs
type FormSection = 'general' | 'price' | 'variants' | 'fashion' | 'cosmetics' | 'images' | 'seo';

export function AdminProducts() {
  const { hasPermission } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeTab, setActiveTab] = useState<FormSection>('general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const { toast, confirm } = useFeedback();

  const canCreate = hasPermission('produtos', 'criar');
  const canEdit = hasPermission('produtos', 'editar');
  const canDelete = hasPermission('produtos', 'excluir');
  
  // Categories (to be loaded from DB)
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);

  // Form State
  const initialProduct: Omit<Product, 'id'> = {
    name: '',
    active: true,
    featured: false,
    newRelease: false,
    categoryId: '',
    sku: '',
    price: 0,
    stock: 0,
    unit: 'un',
    controlStock: true,
    allowBackorder: false,
    hasVariants: false,
    images: [],
    seo: { slug: '', condition: 'new' },
    extras: { showInCatalog: true }
  };

  const [form, setForm] = useState<Omit<Product, 'id'>>(initialProduct);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAIContent = async () => {
    if (!form.name || !form.categoryId) {
      toast("Para gerar conteúdo, preencha o Nome e a Categoria primeiro.", 'warning');
      return;
    }

    setAiLoading(true);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || form.categoryId;
      const response = await fetch('/api/ia/gerar-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.name, categoria: catName })
      });

      if (!response.ok) throw new Error('Erro na resposta da IA');

      const data = await response.json();

      setForm(prev => ({
        ...prev,
        subtitle: data.titulo || prev.subtitle,
        shortDescription: data.descricao_curta || prev.shortDescription,
        fullDescription: data.descricao_longa || prev.fullDescription,
        seo: {
          ...prev.seo!,
          metaTitle: data.meta_title || prev.seo?.metaTitle,
          metaDescription: data.meta_description || prev.seo?.metaDescription,
          keywords: data.palavras_chave || prev.seo?.keywords
        }
      }));

      toast("Conteúdo gerado com IA com sucesso! Revise os campos.", 'success');
    } catch (error) {
      console.error(error);
      toast("Erro ao gerar conteúdo com IA.", 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-generation helpers
  const generateSlug = (name: string) => {
    return name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const generateSku = () => {
    const prefix = form.brand?.slice(0, 3).toUpperCase() || 'DB';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  const generateEan13 = () => {
    let ean = "789"; 
    for (let i = 0; i < 9; i++) ean += Math.floor(Math.random() * 10).toString();
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(ean[i]) * (i % 2 === 0 ? 1 : 3);
    return ean + ((10 - (sum % 10)) % 10).toString();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await productService.listProducts();
      setProducts(pData);
      
      const cSnap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
      setCategories(cSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = async (prod: Product) => {
    setLoading(true);
    try {
      const detail = await productService.getProduct(prod.id!);
      if (detail) {
        // Ensure structure for nested objects
        const p = detail.product;
        setForm({
          ...p,
          fashion: p.fashion || {},
          cosmetics: p.cosmetics || {},
          seo: p.seo || { slug: generateSlug(p.name), condition: 'new' },
          extras: p.extras || { showInCatalog: true },
        });
        setVariants(detail.variants);
        setEditingId(prod.id!);
        setView('form');
        setActiveTab('general');
      }
    } catch (error: unknown) {
      console.error(error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        toast("Você não tem permissão para visualizar os detalhes deste produto.", 'error');
      } else {
        toast("Erro ao carregar detalhes do produto.", 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setForm(initialProduct);
    setVariants([]);
    setEditingId(null);
    setView('form');
    setActiveTab('general');
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir Produto',
      message: `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'danger'
    });

    if (ok) {
      try {
        await productService.deleteProduct(id);
        loadData();
        toast("Produto excluído com sucesso!");
      } catch {
        toast("Erro ao excluir produto.", 'error');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure all variants have barcode if not provided
    const finalVariants = variants.map(v => ({
      ...v,
      barcode: v.barcode || generateEan13(),
      sku: v.sku || generateSku()
    }));

    if (!form.name || !form.categoryId || form.price <= 0) {
      toast("Por favor, preencha os campos obrigatórios (Nome, Categoria e Preço).", 'warning');
      return;
    }

    setSubmitting(true);
    // Check EAN uniqueness
    const checkMainBarcode = form.hasVariants ? null : (form.gtin || generateEan13());
    const barcodesToCheck = finalVariants.map(v => v.barcode).filter(Boolean);
    if (checkMainBarcode) barcodesToCheck.push(checkMainBarcode);

    if (barcodesToCheck.length > 0) {
      if (new Set(barcodesToCheck).size !== barcodesToCheck.length) {
        toast("Erro: Você tem Códigos de Barras (EAN) duplicados nas variações.", 'error');
        setSubmitting(false);
        return;
      }
      const gtinPromises = barcodesToCheck.map(b => productService.checkGtinExists(b as string, editingId || undefined));
      const gtinResults = await Promise.all(gtinPromises);
      if (gtinResults.some(r => r)) {
        toast("Erro: Um dos Códigos de Barras (EAN) já está em uso por outro produto ou variação.", 'error');
        setSubmitting(false);
        return;
      }
    }

    try {
      const finalForm = {
        ...form,
        sku: form.sku || generateSku(),
        gtin: form.hasVariants ? '' : (form.gtin || generateEan13()),
        searchTerms: form.hasVariants ? finalVariants.map(v => `${v.name} ${v.barcode} ${v.sku}`.toLowerCase()) : [],
        variantIdentifiers: form.hasVariants ? finalVariants.flatMap(v => [v.barcode, v.sku]).filter(Boolean) : [],
        extras: {
          ...form.extras,
          showInCatalog: form.images.length > 0 ? (form.extras?.showInCatalog !== false) : false
        },
        seo: {
          ...form.seo!,
          slug: form.seo?.slug || generateSlug(form.name)
        }
      };

      if (editingId) {
        await productService.updateProduct(editingId, finalForm, finalVariants);
      } else {
        await productService.createProduct(finalForm, finalVariants);
      }
      
      setView('list');
      loadData();
      toast(editingId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!", 'success');
    } catch (err: unknown) {
      console.error(err);
      toast("Erro ao salvar produto.", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setUploading(true);
    try {
      const files = Array.from(e.target.files);
      const newImages = [...form.images];
      
      const processImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1080;
              const MAX_HEIGHT = 1080;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);

              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas to Blob failed"));
              }, 'image/webp', 0.85); // 85% quality WEBP
            };
            img.onerror = reject;
            if (typeof event.target?.result === 'string') {
              img.src = event.target.result;
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      for (const file of files) {
        const processedBlob = await processImage(file);
        const processedFile = new File([processedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
        
        const result = await productService.uploadImage(processedFile);
        newImages.push({
          url: result.url,
          path: result.path,
          isMain: newImages.length === 0
        });
      }
      
      setForm({ ...form, images: newImages });
    } catch {
      alert("Erro no upload de imagem.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index: number) => {
    const img = form.images[index];
    if (window.confirm("Deseja remover esta imagem?")) {
      await productService.deleteImage(img.path);
      const newImages = form.images.filter((_, i) => i !== index);
      // If we removed the main image, set current first as main
      if (img.isMain && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      setForm({ ...form, images: newImages });
    }
  };

  const setMainImage = (index: number) => {
    const newImages = form.images.map((img, i) => ({
      ...img,
      isMain: i === index
    }));
    setForm({ ...form, images: newImages });
  };

  // Attribute Generator logic
  const [attrInput, setAttrInput] = useState({ name: '', values: '' });
  const [tempAttrs, setTempAttrs] = useState<{name: string, values: string[]}[]>([]);

  const addAttribute = () => {
    if (!attrInput.name || !attrInput.values) return;
    setTempAttrs([...tempAttrs, { 
      name: attrInput.name, 
      values: attrInput.values.split(',').map(v => v.trim()).filter(v => v) 
    }]);
    setAttrInput({ name: '', values: '' });
  };

  const generateVariants = () => {
    if (tempAttrs.length === 0) return;

    const cartesian = <T,>(...args: T[][]): T[][] => args.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
    const combinations = cartesian(...tempAttrs.map(a => a.values));
    
    const newVariants: ProductVariant[] = combinations.map((combo: string[] | string, index: number) => {
      const comboArr = Array.isArray(combo) ? combo : [combo];
      const name = comboArr.join(' ');
      const attrs: Record<string, string> = {};
      tempAttrs.forEach((a, i) => {
        attrs[a.name] = comboArr[i];
      });

      return {
        name: `${form.name} - ${name}`,
        sku: `${form.sku || 'SKU'}-${name.replace(/\s+/g, '-').toUpperCase()}-${index+1}`,
        barcode: generateEan13(),
        stock: 0,
        price: form.price,
        active: true,
        attributes: attrs
      };
    });

    setVariants([...variants, ...newVariants]);
    setForm({ ...form, hasVariants: true });
    setTempAttrs([]);
  };

  const tabs: {id: FormSection, label: string, icon: React.ElementType}[] = [
    { id: 'general', label: 'Geral', icon: Info },
    { id: 'price', label: 'Preço/Estoque', icon: DollarSign },
    { id: 'variants', label: 'Variações', icon: Layers },
    ...(form.categoryId === 'moda' || form.categoryId === 'lingerie' || form.fashion?.pieceType ? [{ id: 'fashion' as FormSection, label: 'Moda', icon: Shirt }] : []),
    ...(form.categoryId === 'cosmeticos' || form.cosmetics?.type ? [{ id: 'cosmetics' as FormSection, label: 'Cosméticos', icon: Droplets }] : []),
    { id: 'images', label: 'Imagens', icon: ImageIcon },
    { id: 'seo', label: 'SEO', icon: Search },
  ];

  if (view === 'form') {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 md:relative z-30 bg-slate-950 py-2">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-slate-900 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{editingId ? 'Editar Produto' : 'Novo Produto'}</h1>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{form.name || 'Sem nome'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Salvando...' : <><Save size={18} className="mr-2"/> Salvar Produto</>}
            </Button>
          </div>
        </header>

        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          {/* Internal Navigation (Desktop Sidebar) */}
          <div className="w-full md:w-64 border-r bg-slate-800 flex flex-col pt-4">
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
            {/* 1. GERAL */}
            {activeTab === 'general' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2">Informações Gerais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-bold">Nome do Produto *</label>
                      <button 
                        type="button"
                        onClick={handleAIContent}
                        disabled={aiLoading || !form.name || !form.categoryId}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                          aiLoading ? "bg-slate-800 text-slate-500" : "bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white"
                        )}
                      >
                        <Sparkles size={12} className={aiLoading ? "animate-pulse" : ""} />
                        {aiLoading ? 'Gerando...' : 'Gerar com IA'}
                      </button>
                    </div>
                    <Input value={form.name || ''} onChange={e => {
                      const name = e.target.value;
                      setForm({ ...form, name, seo: { ...form.seo!, slug: generateSlug(name), metaTitle: name } });
                    }} placeholder="Ex: Sutiã Renda Luxo" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">Subtítulo / Chamada Curta</label>
                    <Input value={form.subtitle || ''} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Ex: O toque de elegância que você merece" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Categoria Principal *</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                      value={form.categoryId || ''}
                      onChange={e => setForm({ ...form, categoryId: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Marca / Fabricante</label>
                    <Input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Ex: Discreta Boutique" />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold mb-1">Descrição Curta</label>
                   <textarea 
                     className="w-full min-h-[80px] p-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                     value={form.shortDescription || ''}
                     onChange={e => setForm({ ...form, shortDescription: e.target.value, seo: { ...form.seo!, metaDescription: e.target.value } })}
                   />
                </div>

                <div>
                   <label className="block text-sm font-bold mb-1">Descrição Completa</label>
                   <textarea 
                     className="w-full min-h-[200px] p-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                     value={form.fullDescription || ''}
                     onChange={e => {
                       const val = e.target.value;
                       setForm({ 
                         ...form, 
                         fullDescription: val, 
                         seo: { 
                           ...form.seo!, 
                           metaDescription: form.shortDescription ? form.seo?.metaDescription : val.substring(0, 160) 
                         } 
                       });
                     }}
                     placeholder="Detalhes técnicos, benefícios e diferenciais..."
                   />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
                     <input type="checkbox" id="active" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                     <label htmlFor="active" className="text-sm font-bold">Produto Ativo</label>
                   </div>
                   <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
                     <input 
                       type="checkbox" 
                       id="showInCatalog" 
                       checked={(form.extras?.showInCatalog !== false) && form.images.length > 0} 
                       onChange={e => setForm({...form, extras: {...form.extras, showInCatalog: e.target.checked}})} 
                       disabled={form.images.length === 0}
                       className="w-4 h-4 text-red-600 rounded disabled:opacity-50" 
                     />
                     <label htmlFor="showInCatalog" className={cn("text-sm font-bold whitespace-nowrap", form.images.length === 0 && "text-slate-500")} title={form.images.length === 0 ? "Requer imagens" : ""}>Exibir Catálogo</label>
                   </div>
                   <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
                     <input type="checkbox" id="featured" checked={form.featured} onChange={e => setForm({...form, featured: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                     <label htmlFor="featured" className="text-sm font-bold">Destaque</label>
                   </div>
                   <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
                     <input type="checkbox" id="newRel" checked={form.newRelease} onChange={e => setForm({...form, newRelease: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                     <label htmlFor="newRel" className="text-sm font-bold">Lançamento</label>
                   </div>
                </div>
              </div>
            )}

            {/* 2. PREÇO E ESTOQUE */}
            {activeTab === 'price' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2">Preço e Estoque</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-1">Preço de Custo (R$)</label>
                    <Input type="number" step="0.01" value={form.costPrice ?? 0} onChange={e => setForm({...form, costPrice: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-red-600">Preço de Venda (R$) *</label>
                    <Input type="number" step="0.01" value={form.price ?? 0} onChange={e => setForm({...form, price: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Preço Promocional (R$)</label>
                    <Input type="number" step="0.01" value={form.promoPrice ?? 0} onChange={e => setForm({...form, promoPrice: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-center">
                   <div>
                     <p className="text-sm font-bold text-slate-200">Margem de Lucro</p>
                     <p className="text-2xl font-black text-green-600">
                       {form.price && form.costPrice ? `${(((form.price - form.costPrice) / form.price) * 100).toFixed(1)}%` : '---'}
                     </p>
                   </div>
                   <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                   <div className="flex-1">
                     <p className="text-xs text-slate-400 mb-1">Lucro por Unidade</p>
                     <p className="font-bold text-white">{form.price && form.costPrice ? formatCurrency(form.price - form.costPrice) : '---'}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div>
                     <label className="block text-sm font-bold mb-1">SKU Principal</label>
                     <div className="relative">
                        <Input value={form.sku || ''} onChange={e => setForm({...form, sku: e.target.value})} placeholder="Gerado automaticamente" />
                        <button type="button" onClick={() => setForm({...form, sku: generateSku()})} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-600">AUTO</button>
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">EAN / Código de Barras {(!form.hasVariants) && <span className="text-red-500">*</span>}</label>
                     <div className="relative">
                        <Input value={form.gtin || ''} onChange={e => setForm({...form, gtin: e.target.value})} disabled={form.hasVariants} placeholder={form.hasVariants ? "Preencha na guia Variações" : "Gerado automaticamente"} className={form.hasVariants ? "bg-slate-800 text-slate-500" : ""} />
                        {!form.hasVariants && <button type="button" onClick={() => setForm({...form, gtin: generateEan13()})} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-600">AUTO</button>}
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Unidade</label>
                     <select 
                        className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm focus:outline-none"
                        value={form.unit || 'un'}
                        onChange={e => setForm({...form, unit: e.target.value as Product['unit']})}
                     >
                      <option value="un">Unidade (un)</option>
                      <option value="kit">Kit</option>
                      <option value="par">Par</option>
                      <option value="peça">Peça</option>
                      <option value="ml">Mililitro (ml)</option>
                      <option value="g">Grama (g)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-800 rounded-xl border">
                   <div>
                     <label className="block text-sm font-bold mb-1 flex items-center justify-between">
                       Estoque Atual
                       <span className="text-[10px] text-slate-400 font-normal ml-2">(Apenas conferência)</span>
                     </label>
                     <Input 
                        type="number" 
                        value={form.stock ?? 0} 
                        disabled 
                        title="O estoque deve ser gerenciado através do módulo Movimentação de Estoque." 
                        className="bg-slate-950 cursor-not-allowed text-slate-400 font-semibold"
                     />
                     <p className="text-[10px] text-red-500 mt-1 leading-tight">Use o módulo "Mov. Estoque" para dar entrada/saída.</p>
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Estoque Mínimo (Alerta)</label>
                     <Input type="number" value={form.minStock ?? 0} onChange={e => setForm({...form, minStock: Number(e.target.value)})} />
                   </div>
                   <div className="flex items-center gap-2">
                      <input type="checkbox" id="backorder" checked={form.allowBackorder} onChange={e => setForm({...form, allowBackorder: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                      <label htmlFor="backorder" className="text-sm font-bold">Permitir venda sem estoque</label>
                   </div>
                </div>
              </div>
            )}

            {/* 3. VARIAÇÕES */}
            {activeTab === 'variants' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <div className="flex justify-between items-end border-b pb-2">
                   <h3 className="text-lg font-bold">Gerenciador de Variações</h3>
                   <div className="flex items-center gap-2 text-xs bg-red-50 text-red-600 p-2 rounded-lg font-bold border border-red-100">
                     <Layers size={14} /> {variants.length} variações criadas
                   </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border space-y-4">
                  <p className="text-xs font-bold text-slate-400 uppercase">Gerador Automático</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                     <div>
                       <label className="text-xs font-bold block mb-1">Atributo (ex: Tamanho)</label>
                       <Input value={attrInput.name} onChange={e => setAttrInput({...attrInput, name: e.target.value})} placeholder="Tamanho" />
                     </div>
                     <div className="md:col-span-1 lg:col-span-2">
                       <label className="text-xs font-bold block mb-1">Valores (separados por vírgula)</label>
                       <div className="flex gap-2">
                         <Input value={attrInput.values} onChange={e => setAttrInput({...attrInput, values: e.target.value})} placeholder="P, M, G, GG" />
                         <Button type="button" onClick={addAttribute} variant="outline" className="shrink-0"><Plus size={18}/></Button>
                       </div>
                     </div>
                  </div>
                  
                  {tempAttrs.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {tempAttrs.map((at, idx) => (
                        <div key={idx} className="bg-slate-900 border text-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                          <span className="font-bold text-slate-400">{at.name}:</span>
                          <span>{at.values.join(', ')}</span>
                          <button onClick={() => setTempAttrs(tempAttrs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 transition-colors"><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="button" onClick={generateVariants} disabled={tempAttrs.length === 0} className="w-full bg-slate-900">
                    Gerar Combinações
                  </Button>
                </div>

                <div className="space-y-4">
                  {variants.map((v, i) => (
                    <div key={i} className="group flex flex-col p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-red-200 transition-all shadow-sm gap-4">
                       <div className="flex flex-col md:flex-row gap-4">
                         <div className="w-20 h-20 bg-slate-950 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden relative group/img">
                           {v.imageUrl ? <img src={v.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold uppercase text-center p-1">Selecionar Imagem</div>
                         </div>
                         
                         <div className="flex-1 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-100 text-sm">{v.name}</span>
                              <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">SKU</label>
                                <input className="w-full h-8 text-xs bg-slate-800 border rounded px-2 focus:ring-1 focus:ring-red-500 outline-none" value={v.sku || ''} onChange={e => {const nv = [...variants]; nv[i].sku = e.target.value; setVariants(nv)}} />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Barras (EAN)</label>
                                <div className="relative">
                                  <input className="w-full h-8 text-xs bg-slate-800 border rounded pl-2 pr-10 focus:ring-1 focus:ring-red-500 outline-none" value={v.barcode || ''} onChange={e => {const nv = [...variants]; nv[i].barcode = e.target.value; setVariants(nv)}} placeholder="789..." />
                                  <button type="button" onClick={() => {const nv = [...variants]; nv[i].barcode = generateEan13(); setVariants(nv)}} className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-600 bg-red-950 px-1 rounded">AUTO</button>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Preço (R$)</label>
                                <input type="number" step="0.01" className="w-full h-8 text-xs bg-slate-800 border rounded px-2 focus:ring-1 focus:ring-red-500 outline-none" value={v.price === null || v.price === undefined ? '' : v.price} onChange={e => {const nv = [...variants]; nv[i].price = e.target.value === '' ? 0 : Number(e.target.value); setVariants(nv)}} />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400 block mb-0.5" title="Apenas leitura. Use o mód. Movimentações.">Estoque (Leitura)</label>
                                <input 
                                  className="w-full h-8 text-xs bg-slate-950 text-slate-400 font-bold border border-slate-700 rounded px-2 cursor-not-allowed outline-none" 
                                  value={v.stock ?? 0} 
                                  disabled 
                                  title="O estoque deve ser gerenciado através do módulo Movimentação de Estoque."
                                />
                              </div>
                              <div className="flex items-end">
                                 <button 
                                   type="button" 
                                   onClick={() => {const nv = [...variants]; nv[i].active = !nv[i].active; setVariants(nv)}}
                                   className={cn("h-8 px-3 rounded text-[10px] font-black uppercase w-full transition-colors", v.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-950 text-slate-400 hover:bg-slate-200")}
                                 >
                                   {v.active ? 'Ativo' : 'Inativo'}
                                 </button>
                              </div>
                            </div>
                         </div>
                       </div>

                       {/* Image Selector for Variant */}
                       {form.images.length > 0 && (
                         <div className="border-t pt-3">
                           <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Vincular Imagem específica:</p>
                           <div className="flex flex-wrap gap-2">
                             {form.images.map((img, imgIdx) => (
                               <button 
                                 key={imgIdx}
                                 type="button"
                                 onClick={() => {
                                   const nv = [...variants];
                                   nv[i].imageUrl = img.url;
                                   setVariants(nv);
                                 }}
                                 className={cn(
                                   "w-10 h-10 rounded-lg border-2 transition-all shrink-0 overflow-hidden",
                                   v.imageUrl === img.url ? "border-red-600 scale-105 shadow-md" : "border-transparent opacity-40 hover:opacity-100"
                                 )}
                               >
                               <img src={img.url || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               </button>
                             ))}
                             <button 
                               type="button"
                               onClick={() => {
                                 const nv = [...variants];
                                 delete nv[i].imageUrl;
                                 setVariants(nv);
                               }}
                               className={cn(
                                 "w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 transition-all text-[8px] font-bold uppercase",
                                 !v.imageUrl ? "border-red-600 bg-red-50 text-red-600" : "border-slate-700"
                               )}
                             >
                               Limpar
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                  ))}
                  {variants.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-2xl text-slate-400">
                      Nenhuma variação para este produto ainda.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. MODA */}
            {activeTab === 'fashion' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2">Informações de Moda & Lingerie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-1">Gênero</label>
                    <select className="w-full h-10 px-3 border rounded-md" value={form.fashion?.gender || ''} onChange={e => setForm({...form, fashion: {...form.fashion, gender: e.target.value as Product['fashion'] extends {gender?: infer G} ? G : never}})}>
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Unissex">Unissex</option>
                      <option value="Infantil">Infantil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Material / Tecido</label>
                    <Input value={form.fashion?.material || ''} onChange={e => setForm({...form, fashion: {...form.fashion, material: e.target.value}})} placeholder="Ex: Seda, Algodão, Renda" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">Composição</label>
                    <Input value={form.fashion?.composition || ''} onChange={e => setForm({...form, fashion: {...form.fashion, composition: e.target.value}})} placeholder="Ex: 90% Poliamida, 10% Elastano" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800 p-4 rounded-xl">
                   <div className="flex items-center gap-2">
                      <input type="checkbox" id="bojo" checked={form.fashion?.hasPadding} onChange={e => setForm({...form, fashion: {...form.fashion, hasPadding: e.target.checked}})} className="w-4 h-4" />
                      <label htmlFor="bojo" className="text-sm font-bold">Possui Bojo</label>
                   </div>
                   <div className="flex items-center gap-2">
                      <input type="checkbox" id="aro" checked={form.fashion?.hasUnderwire} onChange={e => setForm({...form, fashion: {...form.fashion, hasUnderwire: e.target.checked}})} className="w-4 h-4" />
                      <label htmlFor="aro" className="text-sm font-bold">Possui Aro</label>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <label className="block text-sm font-bold mb-1">Instruções de Lavagem</label>
                     <textarea className="w-full h-24 border p-3 rounded" value={form.fashion?.washingInstructions || ''} onChange={e => setForm({...form, fashion: {...form.fashion, washingInstructions: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Tabela de Medidas (Texto ou HTML)</label>
                     <textarea className="w-full h-24 border p-3 rounded" value={form.fashion?.sizeTable || ''} onChange={e => setForm({...form, fashion: {...form.fashion, sizeTable: e.target.value}})} />
                   </div>
                </div>
              </div>
            )}

            {/* 5. COSMETICOS */}
            {activeTab === 'cosmetics' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2">Informações de Cosméticos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-1">Área de Uso</label>
                    <Input value={form.cosmetics?.usageArea || ''} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, usageArea: e.target.value}})} placeholder="Rosto, Corpo, Íntimo..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Volume (ml/g)</label>
                    <Input value={form.cosmetics?.volume || ''} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, volume: e.target.value}})} placeholder="60ml, 150g..." />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold mb-1">Modo de Uso</label>
                   <textarea className="w-full h-24 border p-3 rounded" value={form.cosmetics?.usageMode || ''} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, usageMode: e.target.value}})} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border">
                        <input type="checkbox" id="vegan" checked={form.cosmetics?.vegan} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, vegan: e.target.checked}})} className="w-5 h-5 text-green-600 mb-1" />
                        <label htmlFor="vegan" className="text-[10px] font-bold uppercase text-slate-400">Vegano</label>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border">
                        <input type="checkbox" id="cruelty" checked={form.cosmetics?.crueltyFree} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, crueltyFree: e.target.checked}})} className="w-5 h-5 text-green-600 mb-1" />
                        <label htmlFor="cruelty" className="text-[10px] font-bold uppercase text-slate-400">Cruelty Free</label>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border">
                        <input type="checkbox" id="dermato" checked={form.cosmetics?.dermatologicallyTested} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, dermatologicallyTested: e.target.checked}})} className="w-5 h-5 text-blue-600 mb-1" />
                        <label htmlFor="dermato" className="text-[10px] font-bold uppercase text-slate-400">Dermato Testado</label>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border">
                        <input type="checkbox" id="hipo" checked={form.cosmetics?.hypoallergenic} onChange={e => setForm({...form, cosmetics: {...form.cosmetics, hypoallergenic: e.target.checked}})} className="w-5 h-5 text-blue-600 mb-1" />
                        <label htmlFor="hipo" className="text-[10px] font-bold uppercase text-slate-400">Hipoalergênico</label>
                    </div>
                </div>
              </div>
            )}

            {/* 6. IMAGENS */}
            {activeTab === 'images' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <div className="flex justify-between items-center border-b pb-2">
                   <h3 className="text-lg font-bold">Galeria de Imagens</h3>
                   <div className="text-xs text-slate-400 font-bold uppercase">Mínimo 1 imagem recomendada</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {form.images.map((img, i) => (
                     <div key={i} className={cn("group relative aspect-square rounded-xl overflow-hidden border-2 transition-all", img.isMain ? "border-red-500 shadow-md" : "border-slate-700 hover:border-slate-600")}>
                        <img 
                          src={img.url || undefined} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                          }}
                        />
                        {img.isMain && <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">CAPA</div>}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 translate-y-full group-hover:translate-y-0 transition-transform flex p-2 gap-1 justify-center">
                           {!img.isMain && <button type="button" onClick={() => setMainImage(i)} className="p-1.5 bg-slate-900 text-white rounded-md hover:bg-red-50" title="Definir como principal"><Check size={14}/></button>}
                           <button type="button" onClick={() => removeImage(i)} className="p-1.5 bg-slate-900 text-red-600 rounded-md hover:bg-red-50" title="Remover"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}

                   {/* Add Image Button */}
                   <label className="aspect-square border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 hover:border-red-400 transition-all text-slate-400 hover:text-red-500">
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                      {uploading ? <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div> : <><Upload size={24} /> <span className="text-[10px] font-bold uppercase tracking-widest">Adicionar</span></>}
                   </label>
                </div>
              </div>
            )}

            {/* 8. SEO */}
            {activeTab === 'seo' && (
              <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-right-2">
                <h3 className="text-lg font-bold border-b pb-2">Otimização (SEO)</h3>
                <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-bold mb-1">Slug da URL (Link)</label>
                     <div className="flex gap-2">
                       <span className="h-10 bg-slate-800 border rounded-md px-3 flex items-center text-xs text-slate-400">loja.com/produto/</span>
                       <Input value={form.seo?.slug || ''} onChange={e => setForm({...form, seo: {...form.seo!, slug: e.target.value}})} />
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Título da Página (Meta Title)</label>
                     <Input value={form.seo?.metaTitle || ''} onChange={e => setForm({...form, seo: {...form.seo!, metaTitle: e.target.value}})} placeholder="Padrão: Nome do Produto" />
                   </div>
                   <div>
                     <label className="block text-sm font-bold mb-1">Meta Descrição</label>
                     <textarea className="w-full h-24 border p-3 rounded text-sm" value={form.seo?.metaDescription || ''} onChange={e => setForm({...form, seo: {...form.seo!, metaDescription: e.target.value}})} />
                   </div>
                </div>
              </div>
            )}

            {/* Default Case for other tabs */}
            {!['general', 'price', 'variants', 'fashion', 'cosmetics', 'images', 'seo'].includes(activeTab) && (
              <div className="h-full flex items-center justify-center opacity-40">
                <p>Seção {activeTab} em desenvolvimento...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

    const filteredProducts = products.filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        
        const nameMatch = p.name?.toLowerCase().includes(term);
        const skuMatch = p.sku?.toLowerCase().includes(term);
        const gtinMatch = p.gtin?.toLowerCase().includes(term);
        const variantMatch = p.searchTerms?.some(st => st.includes(term));

        return nameMatch || skuMatch || gtinMatch || variantMatch;
    });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // LIST VIEW
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Catálogo de Produtos</h1>
          <p className="text-slate-400">Gerencie seu inventário, variações e mídia em um só lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button onClick={handleNew} className="bg-slate-950 hover:bg-slate-800 shadow-xl shadow-slate-200">
               <Plus size={18} className="mr-2" /> Novo Produto
            </Button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="p-4 border-b bg-slate-800/50 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Buscar por nome, SKU ou Código..." 
                className="pl-10 h-10" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
           </div>
           <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1"><Check size={14} className="text-green-500" /> {filteredProducts.filter(p => p.active).length} Ativos</span>
              <span className="flex items-center gap-1"><X size={14} className="text-red-500" /> {filteredProducts.filter(p => !p.active).length} Inativos</span>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
             <thead className="bg-slate-800/80 text-slate-400 font-bold border-b text-[11px] uppercase tracking-widest">
                <tr>
                   <th className="px-6 py-4 w-12 text-center">#</th>
                   <th className="px-6 py-4">Produto</th>
                   <th className="px-6 py-4">Estoque</th>
                   <th className="px-6 py-4">Preço</th>
                   <th className="px-6 py-4">Variações</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={6} className="p-12 text-center text-slate-300">Carregando inventário...</td></tr>
                ) : currentProducts.length === 0 ? (
                  <tr><td colSpan={6} className="p-12 text-center text-slate-300">Nenhum produto encontrado.</td></tr>
                ) : currentProducts.map((prod, index) => (
                  <tr key={prod.id} className="hover:bg-slate-950 group transition-colors">
                     <td className="px-6 py-4 text-center font-bold text-slate-500">
                        {((currentPage - 1) * itemsPerPage) + index + 1}
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-slate-950 rounded-xl overflow-hidden shadow-sm shrink-0 border border-slate-700">
                              {prod.images?.[0]?.url ? (
                                <img 
                                  src={prod.images[0].url || undefined} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                                  }}
                                />
                              ) : (
                                <ImageIcon className="m-auto text-slate-300 mt-4" size={20} />
                              )}
                           </div>
                           <div className="flex flex-col min-w-0 max-w-[300px]">
                              <h4 className="font-bold text-white group-hover:text-red-600 transition-colors uppercase text-[12px] whitespace-normal break-words">{prod.name}</h4>
                              <span className="text-[10px] text-slate-400 font-black tracking-widest">{prod.sku || 'SEM SKU'}</span>
                              <div className="flex gap-2 mt-1">
                                 {prod.featured && <span className="bg-amber-100 text-amber-700 text-[8px] font-bold px-1 py-0.5 rounded leading-none">DESTAQUE</span>}
                                 {prod.active ? <span className="bg-green-100 text-green-700 text-[8px] font-bold px-1 py-0.5 rounded leading-none italic uppercase">Ativo</span> : <span className="bg-red-100 text-red-700 text-[8px] font-bold px-1 py-0.5 rounded leading-none italic uppercase">Inativo</span>}
                              </div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4 font-black text-slate-300">
                        {prod.stock || 0} <span className="text-[10px] font-normal uppercase opacity-40 ml-1">{prod.unit}</span>
                     </td>
                     <td className="px-6 py-4">
                        <div className="font-bold text-white">{formatCurrency(prod.price)}</div>
                        {prod.promoPrice && prod.promoPrice > 0 && <div className="text-[10px] text-red-600 font-black line-through opacity-40">{formatCurrency(prod.price)}</div>}
                     </td>
                     <td className="px-6 py-4">
                       {prod.hasVariants ? (
                         <div className="flex items-center gap-1.5 text-red-600 font-black text-[10px] uppercase">
                           <Layers size={14} /> Multi-Opções
                         </div>
                       ) : <span className="text-slate-300 text-[10px] uppercase font-bold italic">Item Único</span>}
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                           {canEdit && (
                             <button onClick={() => handleEdit(prod)} className="p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-600 hover:border-red-600 transition-all shadow-sm">
                               <Edit2 size={16} />
                             </button>
                           )}
                           {canDelete && (
                             <button onClick={() => handleDelete(prod.id!, prod.name)} className="p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-600 hover:border-red-600 transition-all">
                               <Trash2 size={16} />
                             </button>
                           )}
                           {!canEdit && !canDelete && <span className="text-[10px] text-zinc-400 font-black italic tracking-widest uppercase opacity-50">Bloqueado</span>}
                        </div>
                     </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="text-xs text-slate-400 font-bold">
               Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produtos
             </div>
             <div className="flex items-center gap-1">
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                 disabled={currentPage === 1}
                 className="bg-slate-900"
               >
                 Anterior
               </Button>
               
               <div className="flex items-center mx-2 gap-1">
                 {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                   // Show few pages around current page to avoid huge pagination
                   if (totalPages > 7) {
                     if (page !== 1 && page !== totalPages && Math.abs(currentPage - page) > 2) {
                       if (page === 2 || page === totalPages - 1) return <span key={page} className="text-slate-500">...</span>;
                       return null;
                     }
                   }
                   return (
                     <button
                       key={page}
                       onClick={() => setCurrentPage(page)}
                       className={cn(
                         "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors",
                         currentPage === page 
                           ? "bg-red-600 text-white" 
                           : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                       )}
                     >
                       {page}
                     </button>
                   );
                 })}
               </div>

               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                 disabled={currentPage === totalPages}
                 className="bg-slate-900"
               >
                 Próximo
               </Button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
