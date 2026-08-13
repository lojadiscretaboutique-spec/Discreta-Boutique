import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, ShoppingCart, Truck, CheckCircle2, 
  Clock, DollarSign, Search, Loader2, ArrowLeft, Save, Edit2, XCircle, Eye, Tag
} from 'lucide-react';
import { purchaseService, Purchase, PurchaseItem } from '../../services/purchaseService';
import { productService, Product, ProductVariant } from '../../services/productService';
import { cashService } from '../../services/cashService';
import { formatCurrency, cn, formatVariantName } from '../../lib/utils';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

/**
 * Robustly checks if an item in the purchase list matches the exact same stock entity.
 * Simple products match on productId (when neither item nor target has variant).
 * Variant products match on productId AND variantId (or variantName fallback).
 */
export function isSameStockItem(
  item: PurchaseItem, 
  productId: string, 
  variantId?: string, 
  variantName?: string
): boolean {
  if (!item || !productId) return false;
  if (item.productId !== productId) return false;

  const targetVId = variantId ? String(variantId).trim() : undefined;
  const targetVName = variantName ? String(variantName).trim().toLowerCase() : undefined;
  
  const itemVId = item.variantId ? String(item.variantId).trim() : undefined;
  const itemVName = item.variantName ? String(item.variantName).trim().toLowerCase() : undefined;

  // Case A: Target is a simple product (no variant specified)
  if (!targetVId && !targetVName) {
    return !itemVId && !itemVName;
  }

  // Case B: Target is a variant, but existing item has no variant
  if (!itemVId && !itemVName) {
    return false;
  }

  // Check matching variant ID
  if (targetVId && itemVId && targetVId === itemVId) {
    return true;
  }

  // Check matching variant Name as fallback
  if (targetVName && itemVName && targetVName === itemVName) {
    return true;
  }

  return false;
}

/**
 * Pre-save safeguard that consolidates any duplicate stock items in the payload.
 */
export function consolidatePurchaseItems(items: PurchaseItem[]): PurchaseItem[] {
  const consolidated: PurchaseItem[] = [];

  for (const item of items) {
    if (!item || !item.productId) continue;

    const qty = isNaN(Number(item.quantity)) || Number(item.quantity) <= 0 ? 1 : Number(item.quantity);
    const cost = isNaN(Number(item.costPrice)) || Number(item.costPrice) < 0 ? 0 : Number(item.costPrice);

    const existingIndex = consolidated.findIndex(c => 
      isSameStockItem(c, item.productId, item.variantId, item.variantName)
    );

    if (existingIndex > -1) {
      const existing = consolidated[existingIndex];
      const newQty = existing.quantity + qty;
      const finalCost = existing.costPrice > 0 ? existing.costPrice : cost;

      consolidated[existingIndex] = {
        ...existing,
        quantity: newQty,
        costPrice: finalCost,
        subtotal: newQty * finalCost,
        stockProcessed: existing.stockProcessed || item.stockProcessed,
        stockProcessedAt: existing.stockProcessedAt || item.stockProcessedAt
      };
    } else {
      consolidated.push({
        ...item,
        quantity: qty,
        costPrice: cost,
        subtotal: qty * cost
      });
    }
  }

  return consolidated;
}

export function AdminPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  
  // Products and Categories
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [pendingAddQty, setPendingAddQty] = useState<number>(1);
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([]);
  
  // Form State
  const initialPurchase: Omit<Purchase, 'id'> = {
    supplier: '',
    total: 0,
    shipping: 0,
    status: 'draft',
    paymentStatus: 'pending',
    category: 'Mercadorias para Revenda',
    items: [],
  };
  
  const [form, setForm] = useState<Omit<Purchase, 'id'>>(initialPurchase);
  const [submitting, setSubmitting] = useState(false);

  // Overlay state for feedback during operations
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [overlaySteps, setOverlaySteps] = useState<{ message: string; status: 'pending' | 'running' | 'success' | 'error' }[]>([]);

  const startOverlay = (title: string, steps: string[]) => {
    setOverlayTitle(title);
    setOverlaySteps(steps.map(message => ({ message, status: 'pending' })));
    setOverlayActive(true);
  };

  const updateStep = async (index: number, status: 'success' | 'running' | 'error', delay = 600) => {
    setOverlaySteps(prev => {
      const list = [...prev];
      if (list[index]) {
        list[index].status = status;
      }
      return list;
    });
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };

  const finishOverlay = (delay = 1000) => {
    setTimeout(() => {
      setOverlayActive(false);
    }, delay);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await purchaseService.listPurchases();
      setPurchases(data);
      
      const pData = await productService.listProducts();
      setProductsList(pData);
      
      // Potential categories for purchases
      setCategories(['Mercadorias para Revenda', 'Embalagens', 'Limpeza', 'Escritório', 'Outros']);
    } catch (e) {
      console.error(e);
      toast("Erro ao carregar compras", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!form.supplier || form.items.length === 0) {
      toast("Fornecedor e itens são obrigatórios", "warning");
      return;
    }

    // Pre-save consolidation safeguard against duplicate items in payload
    const consolidatedItems = consolidatePurchaseItems(form.items);
    if (consolidatedItems.length === 0) {
      toast("A compra deve ter pelo menos 1 item com quantidade maior que zero", "warning");
      return;
    }

    const consolidatedItemsSubtotal = consolidatedItems.reduce((acc, i) => acc + i.subtotal, 0);
    const finalForm = {
      ...form,
      items: consolidatedItems,
      total: consolidatedItemsSubtotal + (form.shipping || 0)
    };

    setForm(finalForm);

    startOverlay("Salvando Compra", [
      "Verificando status do caixa...",
      "Consolidando itens e validando compra...",
      "Salvando informações de itens e fornecedor...",
      "Processo finalizado!"
    ]);
    
    setSubmitting(true);
    try {
      await updateStep(0, 'running', 400);
      const session = await cashService.getCurrentSession();
      if (!session) {
        await updateStep(0, 'error', 0);
        toast("Não é possível salvar compras com o caixa fechado.", "error");
        setOverlayActive(false);
        setSubmitting(false);
        return;
      }
      await updateStep(0, 'success', 200);

      await updateStep(1, 'running', 400);
      await updateStep(1, 'success', 200);

      await updateStep(2, 'running', 400);
      await purchaseService.savePurchase({ ...finalForm, id: editingId || undefined });
      await updateStep(2, 'success', 200);

      await updateStep(3, 'success', 600);
      toast("Compra salva com sucesso!");
      setView('list');
      setEditingId(null);
      loadData();
    } catch (e) {
      console.error(e);
      setOverlaySteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
      toast("Erro ao salvar", "error");
    } finally {
      setSubmitting(false);
      finishOverlay();
    }
  };

  const handleEdit = (p: Purchase) => {
    setEditingId(p.id!);
    setForm({
      supplier: p.supplier,
      total: p.total,
      shipping: p.shipping || 0,
      status: p.status,
      paymentStatus: p.paymentStatus,
      category: p.category,
      items: p.items,
      notes: p.notes
    });
    setView('form');
  };

  const handleDelete = async (id: string, supplier: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível excluir registros com o caixa fechado.", "error");
      return;
    }

    if (await confirm({ 
      title: 'Excluir Compra', 
      message: `Deseja realmente excluir a compra de ${supplier}?`, 
      variant: 'danger' 
    })) {
      try {
        await purchaseService.deletePurchase(id);
        toast("Compra excluída com sucesso!");
        loadData();
      } catch (e: any) {
        toast(e?.message || "Erro ao excluir", "error");
      }
    }
  };

  const handleFinalize = async (id: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível finalizar recebimentos com o caixa fechado.", "error");
      return;
    }

    if (await confirm({ 
      title: 'Finalizar Recebimento', 
      message: 'Ao finalizar, o estoque dos itens será atualizado automaticamente. Continuar?'
    })) {
      startOverlay("Recebendo Compra", [
        "Iniciando recebimento de mercadorias...",
        "Buscando itens no banco de dados...",
        "Atualizando estoque de produtos & variações...",
        "Finalizado com sucesso!"
      ]);

      try {
        await updateStep(0, 'running', 400);
        await updateStep(0, 'success', 200);

        await updateStep(1, 'running', 400);
        await updateStep(1, 'success', 200);

        await updateStep(2, 'running', 500);
        await purchaseService.finalizePurchase(id);
        await updateStep(2, 'success', 200);

        await updateStep(3, 'success', 600);
        toast("Estoque atualizado!");
        loadData();
      } catch (e: any) {
        const errorMsg = e?.message || "Erro ao finalizar recebimento";
        setOverlaySteps(prev => prev.map(s => s.status === 'running' ? { ...s, message: errorMsg, status: 'error' } : s));
        toast(errorMsg, "error");
      } finally {
        finishOverlay(3500);
      }
    }
  };

  const handlePay = async (id: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível registrar pagamentos com o caixa fechado.", "error");
      return;
    }

    if (await confirm({ 
      title: 'Confirmar Pagamento', 
      message: 'Esta ação registrará uma saída no financeiro. Continuar?'
    })) {
      startOverlay("Pagando Compra", [
        "Iniciando transação financeira...",
        "Registrando saída para fornecedor no fluxo de caixa...",
        "Vinculando movimentação ao caixa atual...",
        "Status atualizado!"
      ]);

      try {
        await updateStep(0, 'running', 400);
        await updateStep(0, 'success', 200);

        await updateStep(1, 'running', 500);
        await purchaseService.markAsPaid(id, 'Boleto/Transferência');
        await updateStep(1, 'success', 200);

        await updateStep(2, 'running', 400);
        await updateStep(2, 'success', 200);

        await updateStep(3, 'success', 600);
        toast("Pagamento registrado!");
        loadData();
      } catch (e: any) {
        setOverlaySteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
        toast(e.message || "Erro ao pagar", "error");
      } finally {
        finishOverlay();
      }
    }
  };

  const handleCancel = async (id: string, supplier: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível cancelar compras com o caixa fechado.", "error");
      return;
    }

    if (await confirm({ 
      title: 'Cancelar Compra', 
      message: `Deseja realmente CANCELAR a compra de ${supplier}? O estoque e o financeiro (se pago) serão estornados automaticamente.`,
      variant: 'danger'
    })) {
      startOverlay("Cancelando Compra", [
        "Iniciando cancelamento da compra...",
        "Estornando estoque dos produtos no sistema...",
        "Devolvendo valores se pago anteriormente...",
        "Compra de fornecedor desfeita!"
      ]);

      try {
        await updateStep(0, 'running', 400);
        await updateStep(0, 'success', 200);

        await updateStep(1, 'running', 500);
        await purchaseService.cancelPurchase(id);
        await updateStep(1, 'success', 200);

        await updateStep(2, 'running', 400);
        await updateStep(2, 'success', 200);

        await updateStep(3, 'success', 600);
        toast("Compra cancelada e valores estornados!");
        loadData();
      } catch (e: any) {
        setOverlaySteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
        toast(e.message || "Erro ao cancelar", "error");
      } finally {
        finishOverlay();
      }
    }
  };

  const handleProductSelect = async (p: Product, qtyOverride?: number) => {
    const qty = qtyOverride || addQuantity || 1;
    if (p.hasVariants) {
      setSearchTerm('');
      setPendingAddQty(qty);
      const pData = await productService.getProduct(p.id!);
      setSelectedProduct(p);
      setVariantsList(pData ? pData.variants : []);
      setVariantModalOpen(true);
    } else {
      addItem(p, undefined, qty);
    }
  };

  const handleBarcodeOrEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      let term = searchTerm.toLowerCase().trim();
      let qtyFromSearch = addQuantity > 0 ? addQuantity : 1;

      // Check multiplier format e.g. "5*78912345" or "3x78912345"
      const multiplierMatch = term.match(/^(\d+)\s*[*xX]\s*(.+)$/);
      if (multiplierMatch) {
        qtyFromSearch = parseInt(multiplierMatch[1], 10) || 1;
        term = multiplierMatch[2].trim().toLowerCase();
      }

      // Look for exact match in main product
      const match = productsList.find(p => 
        p.gtin?.toLowerCase() === term || 
        p.sku?.toLowerCase() === term
      );

      if (match) {
        handleProductSelect(match, qtyFromSearch);
        return;
      } 

      // Look for exact match in variants
      const variantMatchProduct = productsList.find(p => p.variantIdentifiers?.map(vi => vi.toLowerCase()).includes(term));
      if (variantMatchProduct) {
        try {
          const pData = await productService.getProduct(variantMatchProduct.id!);
          if (pData) {
            const variant = pData.variants.find(v => v.barcode?.toLowerCase() === term || v.sku?.toLowerCase() === term);
            if (variant) {
              addItem(variantMatchProduct, variant, qtyFromSearch);
              setSearchTerm('');
              return;
            }
          }
        } catch(err) {
          console.error(err);
        }
      }

      const partialMatches = productsList.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.gtin?.toLowerCase().includes(term) ||
        p.shortDescription?.toLowerCase().includes(term) ||
        p.variantIdentifiers?.map(vi => vi.toLowerCase()).includes(term) ||
        p.searchTerms?.some(st => st.includes(term))
      );

      if (partialMatches.length === 1) {
        handleProductSelect(partialMatches[0], qtyFromSearch);
      } else {
        toast("Produto não encontrado unicamente por este código.", "warning");
      }
    }
  };

  const handleSendToLabels = async (purchase: Purchase) => {
    try {
      setLoading(true);
      const itemsToLabel: { id: string; product: Product; quantity: number }[] = [];
      
      for (const item of purchase.items) {
        const product = productsList.find(p => p.id === item.productId);
        
        if (product) {
          if (!item.variantId) {
            itemsToLabel.push({
              id: Math.random().toString(36).substring(7),
              product: {
                ...product,
                price: product.price || 0
              },
              quantity: item.quantity
            });
          } else {
            const pData = await productService.getProduct(item.productId);
            if (pData) {
              const v = pData.variants.find(v => v.id === item.variantId);
              if (v) {
                const adaptedProduct = {
                    id: v.id,
                    name: v.name,
                    sku: v.sku,
                    gtin: v.barcode || '',
                    price: v.price || v.promoPrice || product.price || 0,
                    active: v.active,
                    images: v.imageUrl ? [{url: v.imageUrl, path: '', isMain: true}] : (product.images || []),
                    categoryId: 'variant',
                    slug: 'variant',
                    isVariant: true,
                    parentName: product.name,
                  } as any;
                  itemsToLabel.push({
                    id: Math.random().toString(36).substring(7),
                    product: adaptedProduct,
                    quantity: item.quantity
                  });
              }
            }
          }
        }
      }
      
      if (itemsToLabel.length > 0) {
        localStorage.setItem('pending_labels', JSON.stringify(itemsToLabel));
        toast(`${itemsToLabel.length} tipos de itens enviados para impressão de etiquetas`, 'success');
        navigate('/admin/etiquetas');
      } else {
        toast("Nenhum item válido para etiquetas encontrado", "warning");
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao processar etiquetas", "error");
    } finally {
      setLoading(false);
    }
  };

  const addItem = (p: Product, variant?: ProductVariant, quantityToAdd: number = 1) => {
    const safeQty = isNaN(Number(quantityToAdd)) || Number(quantityToAdd) <= 0 ? 1 : Number(quantityToAdd);

    setForm(prev => {
      const existingItemIndex = prev.items.findIndex(item => 
        isSameStockItem(item, p.id!, variant?.id, variant?.name)
      );

      let newItems = [...prev.items];
      let targetIdx = -1;
      let isQuantityUpdated = false;

      if (existingItemIndex > -1) {
        const existingItem = newItems[existingItemIndex];
        const newQuantity = (Number(existingItem.quantity) || 0) + safeQty;
        const currentCost = existingItem.costPrice > 0 
          ? existingItem.costPrice 
          : ((variant?.costPrice && variant.costPrice > 0) ? variant.costPrice : (p.costPrice || 0));

        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          costPrice: currentCost,
          subtotal: newQuantity * currentCost
        };
        targetIdx = existingItemIndex;
        isQuantityUpdated = true;
      } else {
        const initialCost = (variant?.costPrice && variant.costPrice > 0) ? variant.costPrice : (p.costPrice || 0);
        const newItem: PurchaseItem = {
          productId: p.id!,
          productName: p.name,
          variantId: variant?.id,
          variantName: variant?.name,
          sku: variant?.sku || p.sku || '',
          quantity: safeQty,
          costPrice: initialCost,
          subtotal: safeQty * initialCost
        };
        newItems = [...newItems, newItem];
        targetIdx = newItems.length - 1;
      }

      const itemsTotal = newItems.reduce((acc, i) => acc + (i.subtotal || 0), 0);

      // Trigger highlight animation & toast notification
      setTimeout(() => {
        setHighlightedIdx(targetIdx);
        if (isQuantityUpdated) {
          toast(`Quantidade somada no item existente (+${safeQty})`, "info");
        } else {
          toast(`Item adicionado à compra (${safeQty}x)`, "success");
        }
        setTimeout(() => setHighlightedIdx(null), 1800);
      }, 20);

      return { 
        ...prev, 
        items: newItems,
        total: itemsTotal + (prev.shipping || 0)
      };
    });

    setSearchTerm('');
    setAddQuantity(1);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setForm(prev => {
      let items = [...prev.items];
      if (!items[index]) return prev;

      if (field === 'quantity') {
        let numVal = Number(value);
        if (isNaN(numVal) || numVal < 0) {
          numVal = 1;
        }
        if (numVal === 0) {
          // Remove item when quantity set to 0
          items = items.filter((_, i) => i !== index);
        } else {
          const cost = items[index].costPrice || 0;
          items[index] = {
            ...items[index],
            quantity: numVal,
            subtotal: numVal * cost
          };
        }
      } else if (field === 'costPrice') {
        let numVal = Number(value);
        if (isNaN(numVal) || numVal < 0) {
          numVal = 0;
        }
        const qty = items[index].quantity || 0;
        items[index] = {
          ...items[index],
          costPrice: numVal,
          subtotal: qty * numVal
        };
      } else {
        items[index] = {
          ...items[index],
          [field]: value
        };
      }

      const itemsTotal = items.reduce((acc, i) => acc + (i.subtotal || 0), 0);

      return { 
        ...prev, 
        items,
        total: itemsTotal + (prev.shipping || 0)
      };
    });
  };

  const removeItem = (index: number) => {
    setForm(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const itemsTotal = newItems.reduce((acc, i) => acc + i.subtotal, 0);
      return {
        ...prev,
        items: newItems,
        total: itemsTotal + (prev.shipping || 0)
      };
    });
  };

  const itemsSubtotal = form.items.reduce((acc, i) => acc + i.subtotal, 0);

  const isReadOnly = form.status === 'received' || form.status === 'cancelled' || form.paymentStatus === 'paid';

  if (view === 'form') {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
        <header className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => { setView('list'); setEditingId(null); }}>
             <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white uppercase">
              {isReadOnly ? 'Detalhes da Compra' : (editingId ? 'Editar Compra' : 'Nova Compra')}
            </h1>
            <p className="text-sm text-slate-400">
              {isReadOnly ? 'Visualização de registro finalizado.' : 'Registre entradas de mercadorias no estoque.'}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-700">
               <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Informações Gerais</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Fornecedor *</label>
                    <Input 
                      value={form.supplier} 
                      onChange={e => !isReadOnly && setForm({...form, supplier: e.target.value})} 
                      placeholder="Nome do fornecedor"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Categoria Financeira</label>
                    <select 
                      value={form.category} 
                      onChange={e => !isReadOnly && setForm({...form, category: e.target.value})}
                      disabled={isReadOnly}
                      className="w-full h-10 px-3 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-red-600 outline-none text-sm disabled:bg-slate-800 disabled:text-slate-400"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-700">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                 <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Itens da Compra</h3>
                 {!isReadOnly && (
                   <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700 shrink-0">
                         <span className="text-[10px] font-black uppercase text-slate-400">Qtd:</span>
                         <input 
                           type="number" 
                           min={1} 
                           value={addQuantity} 
                           onChange={e => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                           className="w-12 h-7 bg-slate-900 border border-slate-600 rounded text-center text-xs font-bold text-white focus:ring-1 focus:ring-red-500 outline-none" 
                           title="Quantidade a adicionar ao incluir o produto"
                         />
                      </div>
                      <div className="relative flex-1 sm:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <Input 
                           ref={searchInputRef}
                           placeholder="Buscar cód/nome (ou bipe)" 
                           className="pl-10 h-10 text-sm"
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                           onKeyDown={handleBarcodeOrEnter}
                         />
                         {searchTerm.length > 1 && (
                           <div className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                             {productsList.filter(p => {
                               const term = searchTerm.toLowerCase();
                               return p.name.toLowerCase().includes(term) ||
                                      p.sku?.toLowerCase().includes(term) ||
                                      p.gtin?.toLowerCase().includes(term) ||
                                      p.shortDescription?.toLowerCase().includes(term) ||
                                      p.variantIdentifiers?.map(vi => vi.toLowerCase()).includes(term) ||
                                      p.searchTerms?.some(st => st.includes(term));
                             }).map(p => (
                               <div key={p.id} className="p-2 border-b border-slate-800 last:border-0 hover:bg-slate-800 cursor-pointer" onClick={() => handleProductSelect(p)}>
                                  <div className="flex items-center justify-between">
                                     <div className="flex flex-col">
                                        <div className="text-xs font-bold text-slate-200">{p.name}</div>
                                        <div className="text-[10px] text-slate-400">
                                           {p.sku && `SKU: ${p.sku}`} {p.gtin && ` | Cód: ${p.gtin}`}
                                        </div>
                                     </div>
                                     <Button size="sm" onClick={(e) => { e.stopPropagation(); handleProductSelect(p); }} className="h-6 text-[10px]">Add</Button>
                                  </div>
                               </div>
                             ))}
                           </div>
                         )}
                      </div>
                   </div>
                 )}
               </div>

               <div className="space-y-3">
                 {form.items.length === 0 && <div className="p-12 text-center text-slate-400 text-sm italic">Nenhum produto adicionado.</div>}
                 {form.items.map((item, idx) => ({ item, idx })).reverse().map(({ item, idx }) => (
                   <div 
                     key={idx} 
                     className={cn(
                       "flex flex-col md:flex-row md:items-center gap-4 bg-slate-800 p-4 rounded-2xl border transition-all duration-300",
                       highlightedIdx === idx ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/40" : "border-slate-700"
                     )}
                   >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{item.productName}</span>
                          {item.variantName && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-medium">
                              {item.variantName}
                            </span>
                          )}
                          {item.stockProcessed && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              <CheckCircle2 size={12} /> Estoque Lançado
                            </span>
                          )}
                          {highlightedIdx === idx && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black animate-pulse">
                              ✓ Qtd Somada!
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">{item.sku}</div>
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Qtd</label>
                        <Input 
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => !isReadOnly && updateItem(idx, 'quantity', Number(e.target.value))}
                          className="h-8 text-xs font-bold"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Preço Custo</label>
                        <Input 
                          type="number"
                          value={item.costPrice}
                          onChange={e => !isReadOnly && updateItem(idx, 'costPrice', Number(e.target.value))}
                          className="h-8 text-xs"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="w-32 text-right">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Subtotal</label>
                        <div className="text-sm font-black text-white">{formatCurrency(item.subtotal)}</div>
                      </div>
                      {!isReadOnly && (
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-red-500">
                          <Trash2 size={16} />
                        </Button>
                      )}
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Totals & Status */}
          <div className="space-y-6">
             <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <ShoppingCart size={80} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-6 tracking-[3px]">Total Compra</h3>
                  <div className="text-5xl font-black italic tracking-tighter mb-8 bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                    {formatCurrency(form.total)}
                  </div>
                  
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/50 uppercase font-black">Status Receb.</span>
                      <span className={cn("px-2 py-0.5 rounded font-black uppercase text-[10px]", form.status === 'received' ? "bg-green-500 text-white" : "bg-zinc-700 text-white")}>
                         {form.status === 'draft' ? 'Em Aberto' : 'Recebido'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/50 uppercase font-black">Status Pagto.</span>
                      <span className={cn("px-2 py-0.5 rounded font-black uppercase text-[10px]", form.paymentStatus === 'paid' ? "bg-blue-500 text-white" : "bg-red-500 text-white")}>
                         {form.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>
             </div>

              <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-700">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Resumo Financeiro</h3>
                <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Valor do Frete</label>
                      <Input 
                        type="number"
                        value={form.shipping}
                        onChange={e => !isReadOnly && setForm(prev => {
                          const val = Number(e.target.value);
                          return { ...prev, shipping: val, total: itemsSubtotal + val };
                        })}
                        disabled={isReadOnly}
                        placeholder="0.00"
                        className="h-10 text-sm"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-red-400">Total Geral (Ajustável)</label>
                      <Input 
                        type="number"
                        value={form.total}
                        onChange={e => !isReadOnly && setForm({...form, total: Number(e.target.value)})}
                        disabled={isReadOnly}
                        className="h-10 text-sm font-bold border-red-100 focus:border-red-500"
                      />
                   </div>
                   <div className="p-3 bg-slate-800 rounded-xl flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Soma dos Itens:</span>
                      <span className="text-sm font-bold text-slate-300">{formatCurrency(itemsSubtotal)}</span>
                   </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-700">
                <h3 className="text-xs font-black uppercase text-zinc-400 mb-4 tracking-widest">Observações</h3>
                <textarea 
                  className="w-full h-32 p-4 rounded-2xl border border-slate-700 focus:ring-2 focus:ring-red-600 outline-none text-sm resize-none disabled:bg-slate-800 disabled:text-slate-400"
                  placeholder="Informações adicionais da compra..."
                  value={form.notes || ''}
                  onChange={e => !isReadOnly && setForm({...form, notes: e.target.value})}
                  disabled={isReadOnly}
                />
              </div>

             {!isReadOnly && (
               <Button 
                 onClick={handleSave} 
                 disabled={submitting}
                 className="w-full h-16 rounded-3xl bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-widest text-lg shadow-xl shadow-red-600/20"
               >
                 {submitting ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" /> Salvar Compra</>}
               </Button>
             )}
          </div>
        </div>

        {/* Variant Selection Modal */}
        {variantModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
             <div className="bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-6 border-b">
                   <h3 className="text-lg font-black uppercase italic tracking-tighter">Selecione a Variação</h3>
                   <p className="text-sm text-slate-400">{selectedProduct.name}</p>
                </div>
                <div className="max-h-96 overflow-y-auto p-4 space-y-2">
                   {variantsList.map(v => (
                     <div key={v.id} className="flex justify-between items-center p-3 border rounded-xl hover:bg-slate-800">
                       <div className="flex flex-col">
                          <span className="font-bold text-sm">{formatVariantName(v.name || "")}</span>
                          <span className="text-[10px] text-slate-400">
                             {v.sku && `SKU: ${v.sku}`} {v.barcode && `| Barras: ${v.barcode}`} | Est: {v.stock}
                          </span>
                       </div>
                       <Button 
                         size="sm" 
                         onClick={() => {
                           addItem(selectedProduct, v, pendingAddQty);
                           setVariantModalOpen(false);
                           setSearchTerm('');
                         }}
                         className="text-xs uppercase font-bold"
                       >
                         Adicionar {pendingAddQty > 1 ? `(${pendingAddQty}x)` : ''}
                       </Button>
                     </div>
                   ))}
                   {variantsList.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-sm">Nenhuma variação encontrada.</div>
                   )}
                </div>
                <div className="p-4 bg-slate-800 border-t flex justify-end">
                   <Button variant="ghost" onClick={() => setVariantModalOpen(false)}>Cancelar</Button>
                </div>
             </div>
          </div>
        )}

        {/* Dynamic Translucent Overlay System */}
        {overlayActive && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/60 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
              
              <div className="text-center mb-6">
                <Loader2 className="animate-spin text-red-600 mx-auto mb-4" size={40} />
                <h3 className="text-lg font-black uppercase italic tracking-wider text-white">
                  {overlayTitle}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">
                  Por favor, aguarde...
                </p>
              </div>

              <div className="space-y-3.5 border-t border-slate-800 pt-5">
                {overlaySteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    {step.status === 'success' ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-black">✓</span>
                    ) : step.status === 'running' ? (
                      <Loader2 size={12} className="animate-spin text-red-500 shrink-0" />
                    ) : step.status === 'error' ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500 text-[10px] font-black">✗</span>
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500 text-[10px] font-black">○</span>
                    )}
                    <span className={cn(
                      "font-bold uppercase text-[10px]",
                      step.status === 'success' ? "text-slate-300" :
                      step.status === 'running' ? "text-red-400 animate-pulse font-black" :
                      step.status === 'error' ? "text-red-500 font-black" : "text-slate-500"
                    )}>
                      {step.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">Compras / Entrada</h1>
          <p className="text-sm text-slate-400">Gestão de pedidos a fornecedores e entrada de estoque.</p>
        </div>
        <Button 
          onClick={() => { setView('form'); setForm(initialPurchase); setEditingId(null); }}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 font-bold"
        >
          <Plus className="mr-2" /> Nova Compra
        </Button>
      </header>

      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
           <table className="w-full text-left uppercase text-[10px] min-w-[800px]">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest">Criação</th>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest">Fornecedor</th>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest">Valor</th>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest">Status</th>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest">Pagto</th>
                  <th className="px-6 py-4 font-black text-slate-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Carregando compras...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Nenhuma compra registrada.</td></tr>
                ) : purchases.map(p => {
                  const itemIsReadOnly = p.status === 'received' || p.status === 'cancelled' || p.paymentStatus === 'paid';
                  
                  return (
                    <tr 
                      key={p.id} 
                      className="hover:bg-slate-800 group cursor-pointer"
                      onClick={() => handleEdit(p)}
                    >
                      <td className="px-6 py-4 text-slate-400 font-mono">
                        {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('pt-BR') : '...'}
                      </td>
                      <td className="px-6 py-4 text-white whitespace-normal break-words max-w-[200px]">{p.supplier}</td>
                      <td className="px-6 py-4 text-white">{formatCurrency(p.total)}</td>
                      <td className="px-6 py-4">
                         <div className={cn(
                            "px-2 py-1 rounded inline-flex items-center gap-1",
                            p.status === 'received' ? "bg-green-100 text-green-700" : 
                            p.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-slate-950 text-slate-200"
                         )}>
                            {p.status === 'received' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {p.status === 'draft' ? 'Aberto' : p.status === 'received' ? 'Recebido' : 'Cancelado'}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className={cn(
                            "px-2 py-1 rounded inline-flex items-center gap-1",
                            p.paymentStatus === 'paid' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                         )}>
                            <DollarSign size={12} />
                            {p.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                         {p.status === 'draft' && (
                           <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-600 hover:bg-green-50" onClick={() => handleFinalize(p.id!)}>
                             <Truck className="mr-1" size={14} /> Receber
                           </Button>
                         )}
                         {p.paymentStatus === 'pending' && p.status !== 'cancelled' && (
                           <Button size="sm" variant="outline" className="h-8 border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => handlePay(p.id!)}>
                             <DollarSign className="mr-1" size={14} /> Pagar
                           </Button>
                         )}
                         
                         {(p.status === 'received' || p.paymentStatus === 'paid') && p.status !== 'cancelled' && (
                           <Button size="sm" variant="outline" className="h-8 border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleCancel(p.id!, p.supplier)}>
                             <XCircle className="mr-1" size={14} /> Cancelar
                           </Button>
                         )}
  
                         <Button size="sm" variant="ghost" onClick={() => handleSendToLabels(p)} title="Enviar itens para impressão de etiquetas">
                           <Tag size={14} className="text-slate-400 group-hover:text-indigo-500" />
                         </Button>

                         <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>
                           {itemIsReadOnly ? <Eye size={14} className="text-slate-400 group-hover:text-slate-300" /> : <Edit2 size={14} className="text-slate-400 group-hover:text-slate-300" />}
                         </Button>
  
                         {p.status !== 'received' && p.paymentStatus !== 'paid' && (
                           <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id!, p.supplier)}>
                             <Trash2 size={14} className="text-slate-400 group-hover:text-red-500" />
                           </Button>
                         )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
           </table>
        </div>
      </div>

        {/* Dynamic Translucent Overlay System */}
        {overlayActive && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/60 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
              
              <div className="text-center mb-6">
                <Loader2 className="animate-spin text-red-600 mx-auto mb-4" size={40} />
                <h3 className="text-lg font-black uppercase italic tracking-wider text-white">
                  {overlayTitle}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">
                  Por favor, aguarde...
                </p>
              </div>

              <div className="space-y-3.5 border-t border-slate-800 pt-5">
                {overlaySteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    {step.status === 'success' ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-black">✓</span>
                    ) : step.status === 'running' ? (
                      <Loader2 size={12} className="animate-spin text-red-500 shrink-0" />
                    ) : step.status === 'error' ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500 text-[10px] font-black">✗</span>
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500 text-[10px] font-black">○</span>
                    )}
                    <span className={cn(
                      "font-bold uppercase text-[10px]",
                      step.status === 'success' ? "text-slate-300" :
                      step.status === 'running' ? "text-red-400 animate-pulse font-black" :
                      step.status === 'error' ? "text-red-500 font-black" : "text-slate-500"
                    )}>
                      {step.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
