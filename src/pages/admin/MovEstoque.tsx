import { useEffect, useState, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { stockMovementService, NewStockMovement } from '../../services/stockMovementService';
import { productService, Product, ProductVariant } from '../../services/productService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, ArrowDownRight, ArrowUpRight, X, Filter, Trash2, Package, Minus, Check, AlertCircle } from 'lucide-react';
import { InventoryTab } from './InventoryTab';
import { getDateFromTimestamp, formatVariantName } from '../../lib/utils';
import { cn } from '../../lib/utils';

const REASONS = [
    // Entradas
    { id: 'compra_fornecedor', label: 'Compra do Fornecedor', type: 'in' },
    { id: 'ajuste_positivo', label: 'Ajuste Positivo', type: 'in' },
    { id: 'devolucao_cliente', label: 'Devolução do Cliente', type: 'in' },
    { id: 'transferencia_recebida', label: 'Transferência Recebida', type: 'in' },
    { id: 'inventario_positivo', label: 'Sobras de Inventário', type: 'in' },
    // Saídas
    { id: 'venda_loja', label: 'Venda (Loja Física)', type: 'out' },
    { id: 'venda_online', label: 'Venda (Loja Online/Site)', type: 'out' },
    { id: 'ajuste_negativo', label: 'Ajuste Negativo', type: 'out' },
    { id: 'perda_avaria', label: 'Perda, Roubo ou Avaria', type: 'out' },
    { id: 'uso_interno', label: 'Uso Interno / Consumo', type: 'out' },
    { id: 'transferencia_enviada', label: 'Transferência Enviada', type: 'out' },
] as const;

const CHANNELS = ['N/A', 'Loja Física', 'Site Ecommerce', 'WhatsApp', 'Mercado Livre', 'Shopee', 'Delivery / App', 'Outro'];

interface MovementItemDraft {
    tempId: string;
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    sku: string;
    currentStock: number;
    quantity: number;
    allowBackorder?: boolean;
}

export function MovEstoque() {
    const { toast } = useFeedback();
    const { hasPermission } = useAuthStore();
    
    const canCreate = hasPermission('stock', 'criar');
    const canView = hasPermission('stock', 'visualizar');

    // Data lists
    const [movements, setMovements] = useState<NewStockMovement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters UI
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState<'all'|'today'|'7days'|'30days'|'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterType, setFilterType] = useState<'all'|'in'|'out'>('all');
    const [filterChannel, setFilterChannel] = useState<'all' | string>('all');

    // Modal states: Multiple Products Movement
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fReasonId, setFReasonId] = useState(REASONS[0].id);
    const [fChannel, setFChannel] = useState(CHANNELS[0]);
    const [fNotes, setFNotes] = useState('');
    
    // Multi-items list for the current movement
    const [movementItems, setMovementItems] = useState<MovementItemDraft[]>([]);
    
    // Item adder field states
    const [fProdSearch, setFProdSearch] = useState('');
    const searchAtSelection = useRef('');
    const [fProductId, setFProductId] = useState('');
    const [fQty, setFQty] = useState('1');
    const [fVariantId, setFVariantId] = useState('');
    const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
    const [isLoadingVariants, setIsLoadingVariants] = useState(false);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<'movimentacoes' | 'inventario'>('movimentacoes');

    const loadData = async () => {
        setLoading(true);
        try {
            const [prodData, movData] = await Promise.all([
                productService.listProducts(),
                stockMovementService.listMovements(500).catch((e) => {
                    console.warn("History empty or error reading: ", e);
                    return [];
                })
            ]);
            setProducts(prodData);
            setMovements(movData);
        } catch (err: any) {
            toast("Erro ao carregar dados do estoque: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (fProductId) {
            setFVariantId('');
            const prod = products.find(p => p.id === fProductId);
            if (prod?.hasVariants) {
                setIsLoadingVariants(true);
                productService.getProduct(fProductId).then(res => {
                    const vars = res?.variants || [];
                    setProductVariants(vars);
                    
                    // Auto-select variation if barcode matched
                    if (searchAtSelection.current && vars.length > 0) {
                        const term = searchAtSelection.current.trim().toLowerCase();
                        const cleanT = term.replace(/[\s\-\.\/]/g, '');
                        const match = vars.find((v: any) => {
                            const vSkuClean = (v.sku || '').replace(/[\s\-\.\/]/g, '').toLowerCase();
                            const vBarcodeClean = (v.barcode || v.gtin || '').replace(/[\s\-\.\/]/g, '').toLowerCase();
                            return (
                                v.sku?.toLowerCase() === term || 
                                v.barcode?.toLowerCase() === term ||
                                (vSkuClean && vSkuClean === cleanT) ||
                                (vBarcodeClean && vBarcodeClean === cleanT)
                            );
                        });
                        if (match) {
                            const matchedKey = match.id || match.sku || match.barcode || 'var_0';
                            setFVariantId(matchedKey);
                        }
                    }
                    searchAtSelection.current = ''; // Reset
                }).catch(() => {
                    toast("Erro ao carregar variações do produto.", "error");
                }).finally(() => {
                    setIsLoadingVariants(false);
                });
            } else {
                setProductVariants([]);
            }
        } else {
            setProductVariants([]);
            setFVariantId('');
        }
    }, [fProductId, products, toast]);

    // Auto-selection on exact match (Barcode & Variation Support)
    useEffect(() => {
        const term = fProdSearch.trim();
        if (!term || term.length < 3 || fProductId) return;
        
        const cleanT = term.replace(/[\s\-\.\/]/g, '').toLowerCase();

        // Exact match by SKU or GTIN or Internal Code or Variant Barcode
        const exactMatch = products.find(p => {
            const pSkuClean = (p.sku || '').replace(/[\s\-\.\/]/g, '').toLowerCase();
            const pGtinClean = (p.gtin || '').replace(/[\s\-\.\/]/g, '').toLowerCase();
            const pInternalClean = (p.internalCode || '').replace(/[\s\-\.\/]/g, '').toLowerCase();

            if (
                p.sku?.toLowerCase() === term.toLowerCase() || 
                p.gtin?.toLowerCase() === term.toLowerCase() ||
                p.internalCode?.toLowerCase() === term.toLowerCase() ||
                (pSkuClean && pSkuClean === cleanT) ||
                (pGtinClean && pGtinClean === cleanT) ||
                (pInternalClean && pInternalClean === cleanT)
            ) return true;

            // Check variant barcodes inside product
            if (Array.isArray(p.variants) && p.variants.length > 0) {
                return p.variants.some((v: any) => {
                    const vSku = (v.sku || '').toLowerCase();
                    const vBarcode = (v.barcode || v.gtin || '').toLowerCase();
                    const vSkuClean = vSku.replace(/[\s\-\.\/]/g, '');
                    const vBarcodeClean = vBarcode.replace(/[\s\-\.\/]/g, '');
                    return vSku === term.toLowerCase() || vBarcode === term.toLowerCase() || (vSkuClean && vSkuClean === cleanT) || (vBarcodeClean && vBarcodeClean === cleanT);
                });
            }

            if (p.variantIdentifiers?.some(vi => vi.toLowerCase() === term.toLowerCase() || vi.replace(/[\s\-\.\/]/g, '').toLowerCase() === cleanT)) {
                return true;
            }

            return false;
        });

        if (exactMatch) {
            searchAtSelection.current = term;
            setFProductId(exactMatch.id!);
            setFProdSearch('');
        }
    }, [fProdSearch, products, fProductId]);

    // Filter processing
    const filteredMovements = movements.filter(m => {
        // Text Match (gtin, sku, descrição, etc.)
        if (searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            const reasonLabel = REASONS.find(r => r.id === m.reason)?.label.toLowerCase() || '';
            const variantStr = m.variantName?.toLowerCase() || '';
            const mNotes = m.notes?.toLowerCase() || '';
            const mSku = m.sku?.toLowerCase() || '';
            const mProdName = m.productName?.toLowerCase() || '';

            // Get original product info for extra matching
            const p = products.find(prod => prod.id === m.productId);
            const pGtin = p?.gtin?.toLowerCase() || '';
            const pShortDesc = p?.shortDescription?.toLowerCase() || '';
            const pFullDesc = p?.fullDescription?.toLowerCase() || '';
            const pInternalCode = p?.internalCode?.toLowerCase() || '';

            // Find variant barcode if applies
            let vBarcode = '';
            if (p) {
                // Check if the sku/barcode matches inside variants
                if (p.variants) {
                    const v = p.variants.find((v: any) => v.id === m.variantId || v.sku === m.sku);
                    if (v && v.barcode) {
                        vBarcode = v.barcode.toLowerCase();
                    }
                }
                // Check variantIdentifiers array
                if (p.variantIdentifiers) {
                    const hasMatch = p.variantIdentifiers.some(vi => vi.toLowerCase().includes(term));
                    if (hasMatch) {
                        vBarcode = term; // force match
                    }
                }
            }

            const matchesText = 
                mProdName.includes(term) ||
                mSku.includes(term) ||
                variantStr.includes(term) ||
                reasonLabel.includes(term) ||
                mNotes.includes(term) ||
                pGtin.includes(term) ||
                pShortDesc.includes(term) ||
                pFullDesc.includes(term) ||
                pInternalCode.includes(term) ||
                vBarcode.includes(term);

            if (!matchesText) {
                return false;
            }
        }
        
        // Date Match
        if (filterDate !== 'all') {
            const mDate = getDateFromTimestamp(m.createdAt);
            if (filterDate === 'today' && !isAfter(mDate, startOfDay(new Date()))) return false;
            if (filterDate === '7days' && !isAfter(mDate, subDays(new Date(), 7))) return false;
            if (filterDate === '30days' && !isAfter(mDate, subDays(new Date(), 30))) return false;
            if (filterDate === 'custom') {
                if (startDate) {
                    const startLimit = startOfDay(new Date(startDate + 'T00:00:00'));
                    if (mDate < startLimit) return false;
                }
                if (endDate) {
                    const endLimit = new Date(endDate + 'T23:59:59');
                    if (mDate > endLimit) return false;
                }
            }
        }

        // Type Match
        if (filterType !== 'all' && m.type !== filterType) return false;

        // Channel Match
        if (filterChannel !== 'all' && m.channel !== filterChannel) return false;

        return true;
    });

    const formProductsObj = products.filter(p => {
        const term = fProdSearch?.trim().toLowerCase();
        if (!term) return false;
        
        return (
            p.name.toLowerCase().includes(term) || 
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            (p.gtin && p.gtin.toLowerCase().includes(term)) ||
            (p.internalCode && p.internalCode.toLowerCase().includes(term)) ||
            (p.searchTerms?.some(st => st.toLowerCase().includes(term))) ||
            (p.variantIdentifiers?.some(vi => vi.toLowerCase().includes(term)))
        );
    });

    // Add selected product item to movementItems list
    const handleAddItemToList = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!fProductId) {
            toast("Selecione um produto para adicionar.", 'warning');
            return;
        }

        const prod = products.find(p => p.id === fProductId);
        if (!prod) {
            toast("Produto não encontrado.", 'error');
            return;
        }

        const qtyNum = parseInt(fQty);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast("Informe uma quantidade válida (maior que zero).", 'warning');
            return;
        }

        let variantNameStr: string | undefined = undefined;
        let finalSku = prod.sku || 'N/A';
        let currentStock = prod.stock || 0;
        let selectedVariantId = fVariantId || undefined;

        if (prod.hasVariants) {
            if (!fVariantId) {
                toast("Este produto possui variações. Selecione uma variação antes de adicionar.", 'warning');
                return;
            }
            const v = productVariants.find(v => v.id === fVariantId);
            if (!v) {
                toast("Variação selecionada não encontrada.", 'error');
                return;
            }
            variantNameStr = v.name;
            if (v.sku) finalSku = v.sku;
            currentStock = v.stock ?? 0;
            selectedVariantId = v.id;
        }

        // Check if item already exists in movementItems
        const existingIndex = movementItems.findIndex(
            item => item.productId === prod.id && (item.variantId || '') === (selectedVariantId || '')
        );

        if (existingIndex >= 0) {
            // Update quantity of existing row
            const updated = [...movementItems];
            updated[existingIndex].quantity += qtyNum;
            setMovementItems(updated);
            toast(`Quantidade de "${prod.name}" somada na lista (+${qtyNum}).`);
        } else {
            // Add new row
            const newItem: MovementItemDraft = {
                tempId: `${prod.id}_${selectedVariantId || 'default'}_${Date.now()}`,
                productId: prod.id!,
                productName: prod.name,
                variantId: selectedVariantId,
                variantName: variantNameStr,
                sku: finalSku,
                currentStock: currentStock,
                quantity: qtyNum,
                allowBackorder: prod.allowBackorder
            };
            setMovementItems(prev => [...prev, newItem]);
            toast(`"${prod.name}" adicionado à lista.`);
        }

        // Reset adder state for next product
        setFProductId('');
        setFProdSearch('');
        setFVariantId('');
        setFQty('1');
        setProductVariants([]);
    };

    const handleRemoveItem = (tempId: string) => {
        setMovementItems(prev => prev.filter(item => item.tempId !== tempId));
    };

    const handleUpdateItemQty = (tempId: string, newQty: number) => {
        if (newQty <= 0) {
            handleRemoveItem(tempId);
            return;
        }
        setMovementItems(prev => prev.map(item => item.tempId === tempId ? { ...item, quantity: newQty } : item));
    };

    const handleOpenForm = () => {
        setMovementItems([]);
        setFProductId('');
        setFProdSearch('');
        setFVariantId('');
        setFQty('1');
        setProductVariants([]);
        setFNotes('');
        setFReasonId(REASONS[0].id);
        setFChannel(CHANNELS[0]);
        setIsFormOpen(true);
    };

    const handleSaveBatch = async (e: React.FormEvent) => {
        e.preventDefault();

        // If user has a selected product not yet added to list, add it automatically
        let currentItems = [...movementItems];
        if (fProductId) {
            const prod = products.find(p => p.id === fProductId);
            if (prod) {
                const qtyNum = parseInt(fQty);
                if (qtyNum > 0) {
                    let variantNameStr: string | undefined = undefined;
                    let finalSku = prod.sku || 'N/A';
                    let currentStock = prod.stock || 0;
                    let selectedVariantId = fVariantId || undefined;

                    if (prod.hasVariants) {
                        if (!fVariantId) {
                            toast("Selecione a variação do produto selecionado ou remova a seleção.", 'warning');
                            return;
                        }
                        const v = productVariants.find(v => v.id === fVariantId);
                        if (v) {
                            variantNameStr = v.name;
                            if (v.sku) finalSku = v.sku;
                            currentStock = v.stock ?? 0;
                            selectedVariantId = v.id;
                        }
                    }

                    const existingIndex = currentItems.findIndex(
                        item => item.productId === prod.id && (item.variantId || '') === (selectedVariantId || '')
                    );

                    if (existingIndex >= 0) {
                        currentItems[existingIndex].quantity += qtyNum;
                    } else {
                        currentItems.push({
                            tempId: `${prod.id}_${selectedVariantId || 'default'}_${Date.now()}`,
                            productId: prod.id!,
                            productName: prod.name,
                            variantId: selectedVariantId,
                            variantName: variantNameStr,
                            sku: finalSku,
                            currentStock: currentStock,
                            quantity: qtyNum,
                            allowBackorder: prod.allowBackorder
                        });
                    }
                }
            }
        }

        if (currentItems.length === 0) {
            toast("Adicione pelo menos um produto à lista de movimentação.", 'warning');
            return;
        }

        const reasonObj = REASONS.find(r => r.id === fReasonId);
        if (!reasonObj) {
            toast("Selecione um motivo válido.", 'error');
            return;
        }

        // Validate stock availability for outputs (saídas)
        if (reasonObj.type === 'out') {
            for (const item of currentItems) {
                if (item.currentStock < item.quantity && !item.allowBackorder) {
                    toast(`Estoque insuficiente para "${item.productName}${item.variantName ? ` (${item.variantName})` : ''}". Saldo disponível: ${item.currentStock}, Solicitado: ${item.quantity}.`, 'error');
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            const movementPayloads = currentItems.map(item => ({
                productId: item.productId,
                productName: item.productName,
                variantId: item.variantId || undefined,
                variantName: item.variantName || undefined,
                sku: item.sku,
                type: reasonObj.type,
                quantity: item.quantity,
                reason: reasonObj.id,
                channel: fChannel,
                notes: fNotes,
            }));

            // Execute all movements atomically
            await stockMovementService.registerMultipleMovements(movementPayloads);

            const totalUnits = currentItems.reduce((acc, it) => acc + it.quantity, 0);
            toast(`✅ Sucesso! ${currentItems.length} produto(s) (${totalUnits} unidades) movimentados e estoque atualizado.`);

            // Reset modal
            setIsFormOpen(false);
            setMovementItems([]);
            setFProductId('');
            setFProdSearch('');
            setFQty('1');
            setFNotes('');
            setFChannel(CHANNELS[0]);
            setFVariantId('');
            setProductVariants([]);
            
            // Refresh history and products table
            await loadData();
        } catch(e: any) {
            toast(e.message || "Erro ao salvar movimentações de estoque.", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedReasonObj = REASONS.find(r => r.id === fReasonId) || REASONS[0];
    const totalItemsCount = movementItems.reduce((acc, it) => acc + it.quantity, 0);

    return (
        <div className="p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-800/50 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Movimentações de Estoque</h1>
                    <p className="text-slate-400 text-sm mt-1">Gerencie e acesse o histórico completo de entradas e saídas físicas.</p>
                </div>
                {activeTab === 'movimentacoes' && canCreate && (
                    <Button onClick={handleOpenForm} className="gap-2 shadow-sm whitespace-nowrap px-6 py-5 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-700">
                        <Plus size={18} /> Nova Movimentação
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex flex-col sm:flex-row gap-1 bg-slate-800/50 p-1 rounded-xl w-full sm:w-max">
                <button 
                  onClick={() => setActiveTab('movimentacoes')}
                  className={cn("px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all text-center", activeTab === 'movimentacoes' ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}
                >
                  Histórico e Movimentação Manual
                </button>
                <button 
                  onClick={() => setActiveTab('inventario')}
                  className={cn("px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all text-center", activeTab === 'inventario' ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}
                >
                  Inventariar Estoque (CSV)
                </button>
            </div>

            {activeTab === 'movimentacoes' && (
                <>
                    {/* Filters Bar */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700/60 shadow-sm flex flex-col gap-4 transition-all w-full">
                        <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center w-full">
                            <div className="flex-1 w-full relative">
                                <Search className="absolute left-3 top-[50%] -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Buscar por produto, gtin, sku, descrição ou motivo..." 
                                    value={searchTerm || ''}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-slate-800 border-slate-700 h-11 text-slate-100 placeholder:text-slate-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full xl:w-auto shrink-0 flex-wrap">
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período</label>
                                    <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full text-slate-100" 
                                        value={filterDate} onChange={e => setFilterDate(e.target.value as any)}>
                                        <option value="all">Todo Histórico</option>
                                        <option value="today">Hoje</option>
                                        <option value="7days">Últimos 7 dias</option>
                                        <option value="30days">Últimos 30 dias</option>
                                        <option value="custom">Data Personalizada</option>
                                    </select>
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</label>
                                    <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full text-slate-100" 
                                        value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                                        <option value="all">Entradas e Saídas</option>
                                        <option value="in">Somente Entradas (+)</option>
                                        <option value="out">Somente Saídas (-)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canal</label>
                                    <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full text-slate-100" 
                                        value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
                                        <option value="all">Todos os Canais</option>
                                        {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Custom Date Inputs (renders only when filterDate === 'custom') */}
                        {filterDate === 'custom' && (
                            <div className="flex flex-col sm:flex-row gap-4 items-end border-t border-slate-800/80 pt-4 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex-1 w-full sm:w-auto grid grid-cols-2 gap-4 max-w-xl">
                                    <div className="flex flex-col space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Inicial</label>
                                        <input 
                                            type="date" 
                                            value={startDate} 
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="border border-slate-700 p-2 rounded-lg bg-slate-800 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-slate-900 h-11 w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Final</label>
                                        <input 
                                            type="date" 
                                            value={endDate} 
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="border border-slate-700 p-2 rounded-lg bg-slate-800 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-slate-900 h-11 w-full"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 h-11 px-4 text-xs font-bold shrink-0"
                                >
                                    Limpar Datas
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Main Table */}
                    <div className="bg-slate-900 border border-slate-700/60 rounded-xl shadow-sm overflow-hidden flex flex-col h-[60vh] sm:h-[65vh] relative w-full">
                        <div className="overflow-auto flex-1 w-full">
                            <table className="w-full text-sm min-w-[1000px]">
                                <thead className="bg-slate-800 sticky top-0 border-b border-slate-700 shadow-sm z-10">
                                    <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-4 font-semibold w-40">Data / Hora</th>
                                        <th className="px-6 py-4 font-semibold min-w-[200px]">Produto / SKU</th>
                                        <th className="px-6 py-4 font-semibold">Tipo & Motivo</th>
                                        <th className="px-6 py-4 font-semibold">Canal</th>
                                        <th className="px-6 py-4 text-right font-semibold">Qtd.</th>
                                        <th className="px-6 py-4 text-right font-semibold w-32">Balanço (Ant → Novo)</th>
                                        <th className="px-6 py-4 font-semibold">Usuário Responsável</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={7} className="p-12 text-center text-slate-400 animate-pulse">Carregando movimentações com segurança...</td></tr>
                                    ) : filteredMovements.length === 0 ? (
                                        <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-medium">Nenhuma movimentação de estoque encontrada para os filtros atuais.</td></tr>
                                    ) : (
                                        filteredMovements.map(m => {
                                             const rLabel = REASONS.find(r => r.id === m.reason)?.label || m.reason;
                                            const isUp = m.type === 'in';
                                            return (
                                            <tr key={m.id} className="hover:bg-slate-800/80 transition-colors group">
                                                <td className="px-6 py-4 text-slate-300 font-medium">
                                                    {format(getDateFromTimestamp(m.createdAt), "dd/MM/yyyy • HH:mm", {locale: ptBR})}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-white group-hover:text-slate-200 whitespace-normal break-words max-w-[300px]">
                                                        {m.productName}
                                                        {m.variantName && <span className="text-emerald-400 ml-1.5 opacity-90 text-[13px] tracking-tight">/ {formatVariantName(m.variantName)}</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {m.sku}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full shadow-sm ${isUp ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
                                                            {isUp ? <ArrowUpRight size={14} strokeWidth={3}/> : <ArrowDownRight size={14} strokeWidth={3}/>}
                                                        </span>
                                                        <span className="font-medium text-slate-200">{rLabel}</span>
                                                    </div>
                                                    {m.notes && <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px]" title={m.notes}>Obs: {m.notes}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {m.channel !== 'N/A' ? m.channel : <span className="opacity-40">-</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-bold inline-block px-2 text-[15px] ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {isUp ? '+' : '-'}{m.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex items-center gap-2 font-mono text-[13px]">
                                                            <span className="text-slate-400">{m.previousStock ?? '?'}</span>
                                                            <span className="text-slate-500">→</span>
                                                            <span className="font-bold text-slate-100">{m.newStock ?? '?'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    <p className="truncate max-w-[150px] font-medium text-slate-300" title={m.createdByName}>{m.createdByName}</p>
                                                    <p className="opacity-50 mt-0.5 truncate max-w-[150px]" title={m.createdBy}>{m.createdBy}</p>
                                                </td>
                                            </tr>
                                        )})
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'inventario' && (
                <InventoryTab />
            )}

            {/* Modal: Nova Movimentação com Multi-Produtos */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm transition-opacity">
                    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
                        {/* Header Modal */}
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/80">
                            <div>
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <Package className="h-5 w-5 text-indigo-400" />
                                    Registrar Movimentação de Estoque
                                </h3>
                                <p className="text-xs text-slate-400">Adicione um ou múltiplos produtos e confirme para atualizar os saldos e o histórico.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Bloco 1: Informações Gerais da Movimentação */}
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-4">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Dados da Movimentação</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Origem / Motivação <span className="text-red-400">*</span></label>
                                        <select 
                                            className="w-full border border-slate-700 p-2.5 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100" 
                                            value={fReasonId || ''}
                                            onChange={e => setFReasonId(e.target.value)}
                                            required
                                        >
                                            <optgroup label="Entradas (Somam Estoque)">
                                                {REASONS.filter(r => r.type === 'in').map(r => <option key={r.id} value={r.id}>🟢 {r.label}</option>)}
                                            </optgroup>
                                            <optgroup label="Saídas (Subtraem Estoque)">
                                                {REASONS.filter(r => r.type === 'out').map(r => <option key={r.id} value={r.id}>🔴 {r.label}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Canal de Movimentação</label>
                                        <select 
                                            className="w-full border border-slate-700 p-2.5 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100" 
                                            value={fChannel || ''}
                                            onChange={e => setFChannel(e.target.value)}
                                        >
                                            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                                        <label className="text-xs font-semibold text-slate-300">Referência / NF / Obs</label>
                                        <Input 
                                            placeholder="Ex: NF 45892, Fornecedor X..." 
                                            className="bg-slate-900 border-slate-700 h-10 text-slate-100 text-sm"
                                            value={fNotes || ''} 
                                            onChange={e => setFNotes(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bloco 2: Seleção e Adição de Produtos */}
                            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Adicionar Produto à Lista</h4>
                                    <span className="text-[11px] text-indigo-300">Tipo: <strong>{selectedReasonObj.type === 'in' ? 'Entrada (+)' : 'Saída (-)'}</strong></span>
                                </div>

                                <div className="space-y-3">
                                    {/* Busca do Produto */}
                                    {!fProductId ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-[11px] h-4 w-4 text-slate-400" />
                                            <Input 
                                                placeholder="Digite nome, SKU, código de barras ou GTIN para buscar produto..." 
                                                value={fProdSearch || ''}
                                                onChange={(e) => setFProdSearch(e.target.value)}
                                                className="pl-9 h-11 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                                autoFocus
                                            />
                                            {fProdSearch && (
                                                <div className="absolute top-12 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-auto py-1 divide-y divide-slate-800">
                                                    {formProductsObj.map(p => (
                                                        <div 
                                                            key={p.id} 
                                                            onClick={() => { 
                                                                searchAtSelection.current = fProdSearch;
                                                                setFProductId(p.id!); 
                                                                setFProdSearch(''); 
                                                            }} 
                                                            className="px-4 py-2.5 hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors"
                                                        >
                                                            <div className="min-w-0 pr-4">
                                                                <p className="font-medium text-sm text-slate-100 truncate">
                                                                    {p.name} {!p.active && <span className="text-rose-400 font-bold ml-1 text-[10px] uppercase">(Inativo)</span>}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                                    SKU: {p.sku || 'N/A'} {p.gtin && `• GTIN: ${p.gtin}`}
                                                                </p>
                                                            </div>
                                                            <div className="shrink-0 flex items-center gap-2">
                                                                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Estoque</span>
                                                                <span className="bg-slate-950 border border-slate-700 text-slate-200 font-bold px-2 py-1 rounded text-sm min-w-8 text-center">{p.stock ?? 0}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formProductsObj.length === 0 && (
                                                        <div className="p-4 text-sm text-slate-400 text-center">Nenhum produto encontrado com "{fProdSearch}".</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Produto Selecionado: Configuração de Variação e Quantidade */
                                        <div className="p-3.5 border border-indigo-900/60 bg-indigo-950/30 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0 pr-3">
                                                    <p className="font-semibold text-slate-100 truncate">{products.find(p => p.id === fProductId)?.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                        {products.find(p => p.id === fProductId)?.hasVariants 
                                                            ? 'Possui variações cadastradas' 
                                                            : `Saldo atual: ${products.find(p => p.id === fProductId)?.stock ?? 0} unidades • SKU: ${products.find(p => p.id === fProductId)?.sku || 'N/A'}`}
                                                    </p>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setFProductId(''); setFVariantId(''); setProductVariants([]); }} 
                                                    className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800 border border-slate-700 shrink-0"
                                                >
                                                    Trocar Produto
                                                </button>
                                            </div>

                                            {/* Seletor de Variação (se houver) */}
                                            {products.find(p => p.id === fProductId)?.hasVariants && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-300">Variação Específica <span className="text-red-400">*</span></label>
                                                    <select 
                                                        className="w-full border border-slate-700 p-2 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100 disabled:opacity-50" 
                                                        value={fVariantId || ''}
                                                        onChange={e => setFVariantId(e.target.value)}
                                                        disabled={isLoadingVariants}
                                                    >
                                                        <option value="" disabled>{isLoadingVariants ? 'Carregando variações...' : 'Selecione a variação para movimentar...'}</option>
                                                        {productVariants.map(v => (
                                                            <option key={v.id} value={v.id}>
                                                                {formatVariantName(v.name)} — Saldo Atual: {v.stock ?? 0} un • SKU: {v.sku || 'N/A'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Quantidade e Botão Adicionar */}
                                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    <label className="text-xs font-semibold text-slate-300 shrink-0">Quantidade:</label>
                                                    <div className="flex items-center">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setFQty(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))} 
                                                            className="h-10 w-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-l-lg flex items-center justify-center text-slate-300"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <Input 
                                                            type="number" 
                                                            min="1" 
                                                            value={fQty || ''} 
                                                            onChange={e => setFQty(e.target.value)} 
                                                            className="h-10 w-20 text-center bg-slate-900 border-y border-slate-700 border-x-0 rounded-none font-bold text-slate-100" 
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setFQty(prev => String((parseInt(prev) || 1) + 1))} 
                                                            className="h-10 w-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-r-lg flex items-center justify-center text-slate-300"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    onClick={() => handleAddItemToList()} 
                                                    className="w-full sm:w-auto sm:ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 px-5 gap-1.5 rounded-lg shadow-sm"
                                                >
                                                    <Plus size={16} /> Adicionar à Lista
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bloco 3: Lista de Produtos a Movimentar */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                        3. Produtos na Movimentação ({movementItems.length})
                                        {totalItemsCount > 0 && (
                                            <span className="text-[11px] font-normal text-indigo-400 font-mono">
                                                (Total: {totalItemsCount} {totalItemsCount === 1 ? 'unidade' : 'unidades'})
                                            </span>
                                        )}
                                    </h4>
                                    {movementItems.length > 0 && (
                                        <button 
                                            type="button" 
                                            onClick={() => setMovementItems([])} 
                                            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                                        >
                                            Limpar lista
                                        </button>
                                    )}
                                </div>

                                {movementItems.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-700/80 rounded-xl text-center bg-slate-800/20">
                                        <Package className="h-8 w-8 text-slate-500 mx-auto mb-2 opacity-60" />
                                        <p className="text-sm font-medium text-slate-300">Nenhum produto adicionado à lista ainda.</p>
                                        <p className="text-xs text-slate-500 mt-1">Busque e selecione os produtos acima para adicioná-los a este lote de movimentação.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-900 divide-y divide-slate-800">
                                        {movementItems.map((item, idx) => {
                                            const isUp = selectedReasonObj.type === 'in';
                                            const expectedStock = isUp ? item.currentStock + item.quantity : item.currentStock - item.quantity;
                                            const isInsufficient = !isUp && item.currentStock < item.quantity && !item.allowBackorder;

                                            return (
                                                <div key={item.tempId} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono font-bold text-slate-500 w-5">{idx + 1}.</span>
                                                            <p className="font-semibold text-sm text-slate-100 truncate">
                                                                {item.productName}
                                                                {item.variantName && (
                                                                    <span className="text-emerald-400 ml-1.5 text-xs font-normal">
                                                                        / {formatVariantName(item.variantName)}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 pl-7">
                                                            <span className="font-mono">SKU: {item.sku}</span>
                                                            <span>•</span>
                                                            <span>Saldo Atual: <strong className="text-slate-200">{item.currentStock}</strong></span>
                                                            <span>•</span>
                                                            <span className="font-mono">
                                                                Previsão: <strong className={isUp ? 'text-emerald-400' : isInsufficient ? 'text-rose-400' : 'text-slate-200'}>{expectedStock}</strong>
                                                            </span>
                                                        </div>
                                                        {isInsufficient && (
                                                            <p className="text-[11px] text-rose-400 font-semibold pl-7 mt-1 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Estoque insuficiente para saída!
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 self-end sm:self-center pl-7 sm:pl-0">
                                                        <div className="flex items-center">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleUpdateItemQty(item.tempId, item.quantity - 1)} 
                                                                className="h-8 w-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-l-lg flex items-center justify-center text-slate-300"
                                                            >
                                                                <Minus size={12} />
                                                            </button>
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                value={item.quantity} 
                                                                onChange={e => handleUpdateItemQty(item.tempId, parseInt(e.target.value) || 0)} 
                                                                className="h-8 w-14 text-center bg-slate-950 border-y border-slate-700 border-x-0 rounded-none font-bold text-slate-100 text-xs" 
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleUpdateItemQty(item.tempId, item.quantity + 1)} 
                                                                className="h-8 w-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-r-lg flex items-center justify-center text-slate-300"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${isUp ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                                                            {isUp ? '+' : '-'}{item.quantity}
                                                        </span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveItem(item.tempId)} 
                                                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                                                            title="Remover produto da lista"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-400 text-center sm:text-left">
                                {movementItems.length > 0 ? (
                                    <span>Lote com <strong>{movementItems.length}</strong> produto(s) e <strong>{totalItemsCount}</strong> item(ns) a movimentar.</span>
                                ) : (
                                    <span>Adicione produtos à lista para habilitar o lançamento.</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setIsFormOpen(false)} 
                                    className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-10 px-4"
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={handleSaveBatch} 
                                    disabled={submitting || (movementItems.length === 0 && !fProductId)} 
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 px-6 gap-2 rounded-lg shadow-sm disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>Salvando Movimentações...</>
                                    ) : (
                                        <>
                                            <Check size={16} /> 
                                            Confirmar Lançamento {movementItems.length > 0 && `(${movementItems.length})`}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
