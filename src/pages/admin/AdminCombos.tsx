import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Save, ArrowLeft, 
  Search, Package, AlertCircle, Loader2,
  Info, DollarSign,
  ChevronDown, ChevronUp, Power, PowerOff,
  ShoppingCart, Upload, Star, X, Image as ImageIcon,
  Tag, Layout, Share2, Filter, Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { formatCurrency, cn, PLACEHOLDER_IMAGE } from '../../lib/utils';
import { productService, Product, ProductVariant } from '../../services/productService';
import { comboService, Combo, ComboItem } from '../../services/comboService';
import { categoryService } from '../../services/categoryService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp, orderBy, collectionGroup, onSnapshot } from 'firebase/firestore';

function generateEan13() {
  let ean = "789"; 
  for (let i = 0; i < 9; i++) ean += Math.floor(Math.random() * 10).toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(ean[i]) * (i % 2 === 0 ? 1 : 3);
  return ean + ((10 - (sum % 10)) % 10).toString();
}

function generateSku() {
  const prefix = 'CBO';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
}

export function AdminCombos() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast, confirm } = useFeedback();

  // Performance Filters
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [perfComboId, setPerfComboId] = useState<'all' | string>('all');
  const [performanceData, setPerformanceData] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    orders: [] as any[]
  });
  const [calculatingPerf, setCalculatingPerf] = useState(false);

  const canCreate = hasPermission('produtos', 'criar');
  const canEdit = hasPermission('produtos', 'editar');
  const canDelete = hasPermission('produtos', 'excluir');

  const initialCombo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt' | 'soldCount' | 'profit'> = {
    name: '',
    description: '',
    price: 0,
    active: true,
    showInCatalog: true,
    isFeatured: false,
    categories: ['Ofertas Combo'],
    sku: '',
    gtin: '',
    seoTitle: '',
    seoDescription: '',
    items: [],
    images: [],
  };

  const [form, setForm] = useState(initialCombo);
  const [activeTab, setActiveTab] = useState('geral');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setUploading(true);
    try {
      const files = Array.from(e.target.files);
      const newImages = [...(form.images || [])];
      
      for (const file of files) {
        const path = `combos/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newImages.push({ url, path, isMain: newImages.length === 0 });
      }

      setForm(prev => ({ ...prev, images: newImages }));
      toast(`${files.length} imagens enviadas`, "success");
    } catch (error) {
      console.error(error);
      toast("Erro ao enviar imagens", "error");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index: number) => {
    const img = form.images?.[index];
    if (!img) return;

    if (img.path) {
      try {
        await deleteObject(ref(storage, img.path));
      } catch (e) {
        console.warn("Erro ao deletar do storage", e);
      }
    }

    setForm(prev => {
      const newImgs = (prev.images || []).filter((_, i) => i !== index);
      if (img.isMain && newImgs.length > 0) {
        newImgs[0].isMain = true;
      }
      return { ...prev, images: newImgs };
    });
  };

  const setMainImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: (prev.images || []).map((img, i) => ({ ...img, isMain: i === index }))
    }));
  };

  const calculatePerformance = useCallback(async () => {
    setCalculatingPerf(true);
    try {
      const start = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      const end = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

      const ordersRef = collection(db, "orders");
      const q = query(
        ordersRef,
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let totalSales = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      orders.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          if (item.isCombo) {
            if (perfComboId === 'all' || item.comboId === perfComboId) {
              totalSales += item.quantity;
              totalRevenue += item.subtotal;
              // If we have profit stored in items or order, we use it. 
              // Otherwise, we estimate based on (price - costPrice) * qty
              const cost = item.costPrice || 0;
              totalProfit += (item.price - cost) * item.quantity;
            }
          }
        });
      });

      setPerformanceData({ totalSales, totalRevenue, totalProfit, orders });
    } catch (error) {
      console.error("Error calculating performance:", error);
      toast("Erro ao calcular desempenho", "error");
    } finally {
      setCalculatingPerf(false);
    }
  }, [startDate, endDate, perfComboId, toast]);

  const loadData = useCallback(() => {
    // No-op because we listen to Firestore onSnapshot live!
  }, []);

  useEffect(() => {
    setLoading(true);
    let rawCombos: Combo[] = [];
    let rawProducts: Product[] = [];
    let rawCategories: Category[] = [];
    let rawVariantsList: { id: string; productId: string; data: any }[] = [];

    const updateAll = () => {
      const allVariants: { [productId: string]: ProductVariant[] } = {};
      rawVariantsList.forEach(v => {
        if (!v.productId) return;
        if (!allVariants[v.productId]) allVariants[v.productId] = [];
        allVariants[v.productId].push({ id: v.id, ...v.data } as ProductVariant);
      });

      const hydratedProducts = rawProducts.map(p => {
        const pClone = { ...p };
        if (pClone.hasVariants && allVariants[pClone.id!]) {
          pClone.variants = allVariants[pClone.id!];
        }
        return pClone;
      });

      setCombos(rawCombos);
      setProducts(hydratedProducts);
      setCategories(rawCategories);
    };

    const qCombos = query(collection(db, 'combos'), orderBy('updatedAt', 'desc'));
    const unsubscribeCombos = onSnapshot(qCombos, (snapshot) => {
      rawCombos = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Combo));
      updateAll();
      setLoading(false);
    }, (error) => {
      console.error("Error listening to combos:", error);
      setLoading(false);
    });

    const qProducts = collection(db, 'products');
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      rawProducts = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.images && Array.isArray(data.images)) {
          data.images.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
        }
        return { id: doc.id, ...data } as Product;
      });
      updateAll();
    }, (error) => {
      console.error("Error listening to products:", error);
    });

    const qCategories = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      rawCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      updateAll();
    }, (error) => {
      console.error("Error listening to categories:", error);
    });

    const qVariants = collectionGroup(db, 'variants');
    const unsubscribeVariants = onSnapshot(qVariants, (snapshot) => {
      rawVariantsList = snapshot.docs.map(docSnap => {
        const productId = docSnap.ref.parent.parent?.id || '';
        return {
          id: docSnap.id,
          productId,
          data: docSnap.data(),
        };
      });
      updateAll();
    }, (error) => {
      console.error("Error listening to variants:", error);
    });

    return () => {
      unsubscribeCombos();
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeVariants();
    };
  }, []);

  useEffect(() => {
    if (view === 'list') {
      calculatePerformance();
    }
  }, [calculatePerformance, view]);

  // Search products for combo
  useEffect(() => {
    if (productSearch.length > 1) {
      const term = productSearch.toLowerCase();
      const filtered = products.filter(p => 
        String(p.name || '').toLowerCase().includes(term) || 
        String(p.sku || '').toLowerCase().includes(term) ||
        String(p.gtin || '').toLowerCase().includes(term) ||
        p.variants?.some(v => 
          String(v.name || '').toLowerCase().includes(term) || 
          String(v.sku || '').toLowerCase().includes(term) || 
          String(v.barcode || '').toLowerCase().includes(term)
        )
      ).slice(0, 10);
      setFoundProducts(filtered);
    } else {
      setFoundProducts([]);
    }
  }, [productSearch, products]);

  const handleAddItem = (product: Product, variant?: ProductVariant) => {
    const exists = form.items.find(i => i.productId === product.id && i.variantId === variant?.id);
    if (exists) {
      toast("Este item já está no combo", "info");
      return;
    }

    const newItem: ComboItem = {
      productId: product.id!,
      variantId: variant?.id,
      name: product.name,
      variantName: variant?.name,
      quantity: 1,
      price: variant?.price || product.price
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setProductSearch('');
    setFoundProducts([]);
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    if (qty < 1) return;
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], quantity: qty };
      return { ...prev, items: newItems };
    });
  };

  const calculateTotalIndividualPrice = () => {
    return form.items.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);
  };

  const handleSave = async () => {
    if (!form.name || form.items.length === 0 || form.price <= 0) {
      toast("Preencha todos os campos obrigatórios", "error");
      return;
    }

    setSubmitting(true);
    try {
      const finalForm = { ...form };
      if (!finalForm.sku) finalForm.sku = generateSku();
      if (!finalForm.gtin) finalForm.gtin = generateEan13();

      await comboService.saveCombo({
        ...finalForm,
        id: editingId || undefined,
      });
      toast(`Combo ${editingId ? 'atualizado' : 'criado'} com sucesso!`, "success");
      setView('list');
      setEditingId(null);
      setForm(initialCombo);
      loadData();
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar combo", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (combo: Combo) => {
    setEditingId(combo.id!);
    setForm({
      name: combo.name,
      description: combo.description,
      price: combo.price,
      active: combo.active,
      showInCatalog: combo.showInCatalog ?? true,
      isFeatured: combo.isFeatured ?? false,
      categories: combo.categories || ['Ofertas Combo'],
      sku: combo.sku || '',
      gtin: combo.gtin || '',
      seoTitle: combo.seoTitle || '',
      seoDescription: combo.seoDescription || '',
      items: combo.items,
      imageUrl: combo.imageUrl || '',
      images: combo.images || []
    });
    setActiveTab('geral');
    setView('form');
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Excluir Combo", "Tem certeza que deseja excluir este combo? Esta ação não pode ser desfeita.");
    if (!isConfirmed) return;

    try {
      await comboService.deleteCombo(id);
      toast("Combo excluído", "success");
      loadData();
    } catch (_error) {
      toast("Erro ao excluir combo", "error");
    }
  };

  const toggleActive = async (combo: Combo) => {
    try {
      await comboService.saveCombo({ ...combo, active: !combo.active });
      loadData();
    } catch (_error) {
      toast("Erro ao alterar status", "error");
    }
  };

  const filteredCombos = combos.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.name || '').toLowerCase().includes(term) ||
      (c.sku || '').toLowerCase().includes(term) ||
      (c.gtin || '').toLowerCase().includes(term) ||
      (c.description || '').toLowerCase().includes(term);
  });

  // Global stats calculation
  const totalSales = combos.reduce((acc, c) => acc + (c.soldCount || 0), 0);
  const totalProfit = combos.reduce((acc, c) => acc + (c.totalProfit || 0), 0);
  
  // Calculate most used products
  const productUsageMap = new Map<string, {name: string, count: number}>();
  combos.forEach(combo => {
    combo.items.forEach(item => {
      const existing = productUsageMap.get(item.productId);
      if (existing) {
        existing.count += 1;
      } else {
        productUsageMap.set(item.productId, { name: item.name || 'Produto', count: 1 });
      }
    });
  });

  const mostUsedProducts = Array.from(productUsageMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-red-600" size={40} />
        <p className="text-slate-400 animate-pulse">Carregando combos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">COMBOS</h1>
          <p className="text-slate-400">Gerencie conjuntos de produtos com preços especiais</p>
        </div>
        {view === 'list' && canCreate && (
          <Button onClick={() => {
            setForm({ ...initialCombo, sku: generateSku(), gtin: generateEan13() });
            setView('form');
          }} className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-red-900/20">
            <Plus size={20} className="mr-2" />
            NOVO COMBO
          </Button>
        )}
      </div>

      {view === 'list' ? (
        <div className="space-y-6">
          {/* Performance Filters & Stats */}
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-900/20 text-amber-500 rounded-xl flex items-center justify-center">
                  <Filter size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Desempenho de Vendas</h2>
                  <p className="text-xs text-slate-500 font-medium">Filtre por data e por combo específico</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400">
                  <Calendar size={14} className="text-slate-500" />
                  <input 
                    type="date" 
                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-[10px]"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span>até</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-[10px]"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <select 
                  className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-4 py-2 focus:ring-red-500 focus:border-red-500"
                  value={perfComboId}
                  onChange={(e) => setPerfComboId(e.target.value)}
                >
                  <option value="all">Todos os Combos</option>
                  {combos.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <Button 
                  size="sm" 
                  onClick={calculatePerformance} 
                  disabled={calculatingPerf}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold h-9 px-4 rounded-xl text-[10px] grayscale-0"
                >
                  {calculatingPerf ? <Loader2 size={14} className="animate-spin" /> : "FILTRAR"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 text-slate-900 group-hover:text-slate-800/50 transition-colors">
                  <ShoppingCart size={80} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 relative z-10">Combos Vendidos</p>
                <h3 className="text-3xl font-black text-white relative z-10">{performanceData.totalSales}</h3>
              </div>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 text-slate-900 group-hover:text-slate-800/50 transition-colors">
                  <DollarSign size={80} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 relative z-10">Receita Bruta</p>
                <h3 className="text-3xl font-black text-amber-500 relative z-10">{formatCurrency(performanceData.totalRevenue)}</h3>
              </div>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 text-slate-900 group-hover:text-slate-800/50 transition-colors">
                  <DollarSign size={80} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 relative z-10">Lucro Líquido Est.</p>
                <h3 className="text-3xl font-black text-green-500 relative z-10">{formatCurrency(performanceData.totalProfit)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
            <Search className="text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome do combo..."
              className="bg-transparent border-none text-white w-full focus:ring-0 placeholder:text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCombos.map(combo => (
              <motion.div 
                key={combo.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 hover:border-red-500/50 transition-all group flex flex-col h-full shadow-xl",
                  !combo.active && "opacity-60 grayscale"
                )}
              >
                <div className="aspect-video relative overflow-hidden bg-slate-800">
                  <img 
                    src={combo.images?.find(img => img.isMain)?.url || combo.imageUrl || PLACEHOLDER_IMAGE} 
                    alt={combo.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {!combo.active && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Inativo</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => toggleActive(combo)}
                      className="p-2 bg-slate-900/80 backdrop-blur rounded-full text-white hover:bg-white hover:text-slate-900 transition-colors"
                      title={combo.active ? "Desativar" : "Ativar"}
                    >
                      {combo.active ? <Power size={18} /> : <PowerOff size={18} />}
                    </button>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors line-clamp-1">{combo.name}</h3>
                    <p className="text-2xl font-black text-white">{formatCurrency(combo.price)}</p>
                  </div>
                  
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2 h-10">{combo.description}</p>
                  
                  <div className="space-y-2 mb-6 flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Itens Inclusos</p>
                    <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                      {combo.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300">
                          <span className="line-clamp-1">{item.name} {item.variantName && `(${item.variantName})`}</span>
                          <span className="font-bold text-white whitespace-nowrap ml-2">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-800/50 gap-2">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-black">Vendas</p>
                        <p className="text-white font-bold">{combo.soldCount || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-black">Lucro</p>
                        <p className="text-green-500 font-bold">{formatCurrency(combo.profit || 0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <Button 
                        size="icon" 
                        variant="ghost" 
                        className="hover:bg-green-900/20 text-slate-400 hover:text-green-500"
                        onClick={() => navigate(`/admin/pdv?addCombo=${combo.id}`)}
                        title="Venda Rápida"
                      >
                        <ShoppingCart size={18} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="hover:bg-slate-800 text-slate-400 hover:text-white"
                        onClick={() => handleEdit(combo)}
                      >
                        <Edit2 size={18} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                        onClick={() => handleDelete(combo.id!)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredCombos.length === 0 && (
            <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
              <Package className="mx-auto text-slate-700 mb-4" size={60} />
              <h2 className="text-xl font-bold text-slate-500">Nenhum combo encontrado</h2>
              <p className="text-slate-600">Comece criando seu primeiro combo de produtos!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <Button 
            variant="ghost" 
            onClick={() => {
              setView('list');
              setEditingId(null);
              setForm(initialCombo);
            }} 
            className="text-slate-400 hover:text-white mb-2"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar para lista
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Info */}
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-2xl w-full justify-start overflow-x-auto scrollbar-hide">
                  <TabsTrigger value="geral" className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-xl px-6 py-2 font-bold text-xs uppercase tracking-widest transition-all">
                    Principal
                  </TabsTrigger>
                  <TabsTrigger value="items" className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-xl px-6 py-2 font-bold text-xs uppercase tracking-widest transition-all">
                    Itens Inclusos
                  </TabsTrigger>
                  <TabsTrigger value="images" className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-xl px-6 py-2 font-bold text-xs uppercase tracking-widest transition-all">
                    Imagens
                  </TabsTrigger>
                  <TabsTrigger value="seo" className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-xl px-6 py-2 font-bold text-xs uppercase tracking-widest transition-all">
                    SEO & Catálogo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-6">
                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-6 mb-6">
                      <div className="w-12 h-12 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center">
                        <Info size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Informações Básicas</h2>
                        <p className="text-sm text-slate-400">Defina o nome e descrição do combo</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do Combo *</label>
                        <Input 
                          placeholder="Ex: Kit Especial Dia dos Namorados" 
                          className="bg-slate-950 border-slate-800 h-14 rounded-xl text-lg font-medium"
                          value={form.name}
                          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                        <textarea 
                          placeholder="Descreva o que vem no combo e as vantagens..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[120px] text-white focus:ring-red-500 focus:border-red-500 transition-all resize-none font-sans"
                          value={form.description}
                          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Preço do Combo *</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <Input 
                              type="number"
                              placeholder="0,00"
                              className="bg-slate-950 border-slate-800 h-14 rounded-xl pl-12 text-lg font-bold text-red-500"
                              value={form.price || ''}
                              onChange={(e) => setForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 ml-1">
                            Individual: {formatCurrency(calculateTotalIndividualPrice())}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Categorias</label>
                          <div className="flex flex-wrap gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl min-h-[56px]">
                            {form.categories?.map((cat, idx) => (
                              <span key={idx} className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-2">
                                {cat}
                                <button onClick={() => setForm(prev => ({ ...prev, categories: prev.categories.filter((_, i) => i !== idx) }))} className="hover:text-red-500">
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                            <select 
                              className="bg-transparent border-none text-[10px] font-bold text-slate-500 focus:ring-0 cursor-pointer min-w-[100px]"
                              onChange={(e) => {
                                if (e.target.value && !form.categories.includes(e.target.value)) {
                                  setForm(prev => ({ ...prev, categories: [...prev.categories, e.target.value] }));
                                }
                              }}
                              value=""
                            >
                              <option value="">+ Categoria</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Código de Barras (GTIN/EAN13)</label>
                          <div className="relative">
                            <Input 
                              placeholder="Ex: 7891234567890" 
                              className="bg-slate-950 border-slate-800 h-14 rounded-xl font-mono text-white pr-16"
                              value={form.gtin || ''}
                              onChange={(e) => setForm(prev => ({ ...prev, gtin: e.target.value }))}
                            />
                            <button 
                              type="button" 
                              onClick={() => setForm(prev => ({ ...prev, gtin: generateEan13() }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-600 bg-red-600/10 hover:bg-red-600/20 px-2 py-1 rounded"
                            >
                              GERAR
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">SKU (Código Interno)</label>
                          <div className="relative">
                            <Input 
                              placeholder="Ex: CBO-DIA-NAM" 
                              className="bg-slate-950 border-slate-800 h-14 rounded-xl font-mono text-white uppercase pr-16"
                              value={form.sku || ''}
                              onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                            />
                            <button 
                              type="button" 
                              onClick={() => setForm(prev => ({ ...prev, sku: generateSku() }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-600 bg-red-600/10 hover:bg-red-600/20 px-2 py-1 rounded"
                            >
                              GERAR
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="items" className="space-y-6">
                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-6 mb-6">
                      <div className="w-12 h-12 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center">
                        <Package size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Produtos Inclusos</h2>
                        <p className="text-sm text-slate-400">Selecione os produtos que fazem parte deste combo</p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
                        <Search className="text-slate-500" size={20} />
                        <input 
                          type="text" 
                          placeholder="Pesquisar produto pelo nome, SKU ou GTIN..."
                          className="bg-transparent border-none text-white w-full focus:ring-0"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const term = productSearch.toLowerCase().trim();
                              if (!term) return;
                              
                              let matchedProduct: Product | undefined;
                              let matchedVariant: ProductVariant | undefined;
                              
                              // Exact barcode/gtin match
                              for (const p of products) {
                                if (p.variants && p.variants.length > 0) {
                                  const matchingVar = p.variants.find(v => 
                                    String(v.barcode || '').toLowerCase() === term ||
                                    String(v.sku || '').toLowerCase() === term ||
                                    String((v as any).gtin || '').toLowerCase() === term
                                  );
                                  if (matchingVar) {
                                    matchedProduct = p;
                                    matchedVariant = matchingVar;
                                    break;
                                  }
                                }
                                
                                if (!matchedProduct && (
                                  String(p.gtin || '').toLowerCase() === term ||
                                  String(p.sku || '').toLowerCase() === term
                                )) {
                                  matchedProduct = p;
                                  break;
                                }
                              }
                              
                              if (matchedProduct) {
                                handleAddItem(matchedProduct, matchedVariant);
                              } else {
                                toast("Nenhum produto encontrado com este código exato.", "error");
                              }
                            }
                          }}
                        />
                      </div>

                      <AnimatePresence>
                        {foundProducts.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute z-10 top-full left-0 w-full bg-slate-950 border border-slate-800 rounded-2xl mt-2 overflow-hidden shadow-2xl"
                          >
                            {foundProducts.map(p => (
                              <div key={p.id} className="border-b border-slate-900 last:border-none p-2">
                                {p.hasVariants ? (
                                  <div className="space-y-2 p-2">
                                    <p className="text-sm font-bold text-white px-2 py-1">{p.name}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {p.variants?.filter(v => {
                                        const term = productSearch.toLowerCase();
                                        if (String(p.name || '').toLowerCase().includes(term) || String(p.sku || '').toLowerCase().includes(term) || String(p.gtin || '').toLowerCase().includes(term)) return true;
                                        return String(v.name || '').toLowerCase().includes(term) || 
                                               String(v.sku || '').toLowerCase().includes(term) || 
                                               String(v.barcode || '').toLowerCase().includes(term);
                                      }).map(v => (
                                        <button
                                          key={v.id}
                                          onClick={() => handleAddItem(p, v)}
                                          className="flex items-center gap-3 p-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-left transition-colors"
                                        >
                                          <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                                            <img src={v.imageUrl || p.images?.[0]?.url || PLACEHOLDER_IMAGE} className="w-full h-full object-cover" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{v.name}</p>
                                            <p className="text-[10px] text-slate-500">{formatCurrency(v.price || p.price)} • {v.stock} em estoque</p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleAddItem(p)}
                                    className="flex items-center gap-4 w-full p-3 hover:bg-slate-900 transition-colors text-left"
                                  >
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden shrink-0">
                                      <img src={p.images?.[0]?.url || PLACEHOLDER_IMAGE} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-white truncate">{p.name}</p>
                                      <p className="text-xs text-slate-500">{formatCurrency(p.price)} • {p.stock} em estoque</p>
                                    </div>
                                    <Plus size={20} className="text-red-500" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-3">
                      {form.items.map((item, idx) => (
                        <motion.div 
                          key={`${item.productId}-${item.variantId || 'base'}`}
                          layout
                          className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">
                              <Package className="text-slate-700" size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-white leading-tight">{item.name}</p>
                              {item.variantName && (
                                <p className="text-xs text-red-500 font-medium">{item.variantName}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">{formatCurrency(item.price || 0)} cada</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
                              <button 
                                onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                              >
                                <ChevronDown size={16} />
                              </button>
                              <span className="w-10 text-center font-black text-white text-lg">{item.quantity}</span>
                              <button 
                                onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                              >
                                <ChevronUp size={16} />
                              </button>
                            </div>
                            <button 
                              onClick={() => handleRemoveItem(idx)}
                              className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-900/10 rounded-xl transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </motion.div>
                      ))}

                      {form.items.length === 0 && (
                        <div className="py-12 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center opacity-50">
                          <Package size={40} className="mb-2" />
                          <p className="text-sm font-medium">Nenhum item adicionado ainda</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="images" className="space-y-6">
                  {/* Photos Management */}
                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-6 mb-6">
                      <div className="w-12 h-12 bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center">
                        <Upload size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Fotos do Combo</h2>
                        <p className="text-sm text-slate-400">Faça upload de fotos reais do combo</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {(form.images || []).map((img, idx) => (
                        <motion.div 
                          key={idx}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-950"
                        >
                          <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setMainImage(idx)}
                              className={cn(
                                "p-2 rounded-full transition-colors",
                                img.isMain ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                              )}
                              title="Definir como principal"
                            >
                              <Star size={16} fill={img.isMain ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => removeImage(idx)}
                              className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors"
                              title="Remover foto"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {img.isMain && (
                            <div className="absolute top-2 left-2 bg-amber-500 text-[10px] font-black px-2 py-0.5 rounded-full text-white shadow-lg">PRINCIPAL</div>
                          )}
                        </motion.div>
                      ))}

                      <label className={cn(
                        "aspect-square rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950 flex flex-col items-center justify-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-all group",
                        uploading && "opacity-50 cursor-not-allowed pointer-events-none"
                      )}>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        {uploading ? (
                          <Loader2 className="animate-spin text-red-500" size={32} />
                        ) : (
                          <>
                            <Upload className="text-slate-600 group-hover:text-red-500 transition-colors mb-2" size={32} />
                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-red-500 uppercase tracking-widest text-center px-2">Adicionar</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="seo" className="space-y-6">
                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-6 mb-6">
                      <div className="w-12 h-12 bg-indigo-900/20 text-indigo-500 rounded-2xl flex items-center justify-center">
                        <Share2 size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">SEO & Social</h2>
                        <p className="text-sm text-slate-400">Como o combo aparece no Google e Redes Sociais</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Meta Título (SEO)</label>
                        <Input 
                          placeholder="Título para o Google..."
                          className="bg-slate-950 border-slate-800 h-14 rounded-xl"
                          value={form.seoTitle}
                          onChange={(e) => setForm(prev => ({ ...prev, seoTitle: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Meta Descrição (SEO)</label>
                        <textarea 
                          placeholder="Descrição para o Google e redes sociais..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[100px] text-white focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none font-sans"
                          value={form.seoDescription}
                          onChange={(e) => setForm(prev => ({ ...prev, seoDescription: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-6 mb-6">
                      <div className="w-12 h-12 bg-emerald-900/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                        <Layout size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Opções do Catálogo</h2>
                        <p className="text-sm text-slate-400">Visibilidade e destaque na loja</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => setForm(prev => ({ ...prev, showInCatalog: !prev.showInCatalog }))}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          form.showInCatalog ? "bg-emerald-500/10 border-emerald-500/30 text-white" : "bg-slate-950 border-slate-800 text-slate-500"
                        )}
                      >
                        <div>
                          <p className="font-bold">Exibir no Catálogo</p>
                          <p className="text-[10px] opacity-70">Disponível para clientes comprarem</p>
                        </div>
                        <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", form.showInCatalog ? "border-emerald-500 bg-emerald-500" : "border-slate-700")}>
                          {form.showInCatalog && <Star size={12} className="text-white" />}
                        </div>
                      </button>

                      <button 
                        onClick={() => setForm(prev => ({ ...prev, isFeatured: !prev.isFeatured }))}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          form.isFeatured ? "bg-amber-500/10 border-amber-500/30 text-white" : "bg-slate-950 border-slate-800 text-slate-500"
                        )}
                      >
                        <div>
                          <p className="font-bold">Destaque na Home</p>
                          <p className="text-[10px] opacity-70">Aparece na seção de destaques</p>
                        </div>
                        <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", form.isFeatured ? "border-amber-500 bg-amber-500" : "border-slate-700")}>
                          {form.isFeatured && <Star size={12} className="text-white" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar / Preview / Save */}
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden sticky top-6">
                <div className="p-8 border-b border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-6">Resumo e Ações</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Itens Inclusos</span>
                      <span className="text-white font-bold">{form.items.length}</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Subtotal Itens</span>
                      <span className="text-slate-400 line-through">{formatCurrency(calculateTotalIndividualPrice())}</span>
                    </div>
                    <div className="bg-red-900/10 p-6 rounded-2xl border border-red-500/20 text-center space-y-1">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">PREÇO FINAL COMBO</span>
                      <p className="text-4xl font-black text-white">{formatCurrency(form.price)}</p>
                      {form.price > 0 && calculateTotalIndividualPrice() > form.price && (
                        <p className="text-xs font-bold text-green-500">Desconto de {((1 - form.price / calculateTotalIndividualPrice()) * 100).toFixed(0)}%!</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-3">
                  <Button 
                    variant={form.active ? 'default' : 'outline'}
                    onClick={() => setForm(prev => ({ ...prev, active: !prev.active }))}
                    className={cn(
                      "w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]",
                      form.active ? "bg-green-600 hover:bg-green-700" : "border-slate-800 text-slate-500"
                    )}
                  >
                    {form.active ? "Combo Ativado" : "Combo Inativo"}
                  </Button>

                  <Button 
                    onClick={handleSave}
                    disabled={submitting}
                    className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg shadow-red-900/30 transition-all active:scale-95"
                  >
                    {submitting ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <>
                        <Save size={24} className="mr-3" />
                        SALVAR COMBO
                      </>
                    )}
                  </Button>

                  <div className="flex items-start gap-3 p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      Ao salvar, o combo estará disponível para venda no PDV. O estoque dos itens será baixado automaticamente a cada venda.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
