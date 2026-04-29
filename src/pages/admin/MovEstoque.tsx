import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { stockMovementService, NewStockMovement } from '../../services/stockMovementService';
import { productService, Product, ProductVariant } from '../../services/productService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, ArrowDownRight, ArrowUpRight, X, Filter } from 'lucide-react';
import { InventoryTab } from './InventoryTab';
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

const getDateFromTimestamp = (ts: any) => {
    try {
        if (!ts) return new Date();
        
        // Firestore official Timestamp
        if (typeof ts.toDate === 'function') {
            const d = ts.toDate();
            if (!isNaN(d.valueOf())) return d;
        }
        
        // Firestore cached Timestamp
        if (ts && typeof ts === 'object' && 'seconds' in ts) {
            const d = new Date(ts.seconds * 1000);
            if (!isNaN(d.valueOf())) return d;
        }
        
        // Native Date or String/Number Fallback
        const d = new Date(ts);
        if (!isNaN(d.valueOf())) return d;
        
        // Ultimate fallback
        return new Date();
    } catch (e) {
        return new Date();
    }
};

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
    const [filterDate, setFilterDate] = useState<'all'|'today'|'7days'|'30days'>('all');
    const [filterType, setFilterType] = useState<'all'|'in'|'out'>('all');
    const [filterChannel, setFilterChannel] = useState<'all' | string>('all');

    // Drawer / Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fProdSearch, setFProdSearch] = useState('');
    const [fProductId, setFProductId] = useState('');
    const [fReasonId, setFReasonId] = useState(REASONS[0].id);
    const [fQty, setFQty] = useState('');
    const [fChannel, setFChannel] = useState(CHANNELS[0]);
    const [fNotes, setFNotes] = useState('');
    
    // Variant fields
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
            setProducts(prodData.filter(p => p.active));
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
            const prod = products.find(p => p.id === fProductId);
            if (prod?.hasVariants) {
                setIsLoadingVariants(true);
                productService.getProduct(fProductId).then(res => {
                    setProductVariants(res?.variants || []);
                }).catch(e => {
                    toast("Erro ao carregar variações do produto.", "error");
                }).finally(() => {
                    setIsLoadingVariants(false);
                });
            } else {
                setProductVariants([]);
            }
        } else {
            setProductVariants([]);
        }
        setFVariantId('');
    }, [fProductId, products, toast]);

    // Filter processing
    const filteredMovements = movements.filter(m => {
        // Text Match
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const reasonLabel = REASONS.find(r => r.id === m.reason)?.label.toLowerCase() || '';
            const variantStr = m.variantName?.toLowerCase() || '';
            if (!m.productName.toLowerCase().includes(term) && !m.sku.toLowerCase().includes(term) && !reasonLabel.includes(term) && !variantStr.includes(term)) {
                return false;
            }
        }
        
        // Date Match
        if (filterDate !== 'all') {
            const mDate = getDateFromTimestamp(m.createdAt);
            if (filterDate === 'today' && !isAfter(mDate, startOfDay(new Date()))) return false;
            if (filterDate === '7days' && !isAfter(mDate, subDays(new Date(), 7))) return false;
            if (filterDate === '30days' && !isAfter(mDate, subDays(new Date(), 30))) return false;
        }

        // Type Match
        if (filterType !== 'all' && m.type !== filterType) return false;

        // Channel Match
        if (filterChannel !== 'all' && m.channel !== filterChannel) return false;

        return true;
    });

    const formProductsObj = products.filter(p => {
        const term = fProdSearch.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) || 
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            (p.gtin && p.gtin.toLowerCase().includes(term)) ||
            (p.searchTerms && p.searchTerms.some(st => st.includes(term))) ||
            (p.variantIdentifiers && p.variantIdentifiers.some(vi => vi.toLowerCase().includes(term)))
        );
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fProductId) return toast("Você deve selecionar um produto da lista.", 'error');
        if (!fQty || parseInt(fQty) <= 0) return toast("Quantidade inválida.", 'error');

        const reasonObj = REASONS.find(r => r.id === fReasonId);
        if (!reasonObj) return toast("Selecione um motivo válido.", 'error');

        setSubmitting(true);
        try {
            const prod = products.find(p => p.id === fProductId);
            if (!prod) throw new Error("Produto não encontrado");
            
            let variantNameStr = undefined;
            let finalSku = prod.sku || 'N/A';
            
            if (prod.hasVariants) {
                if (!fVariantId) return toast("Este produto possui variações. Você precisa selecionar uma variação primeiro.", 'error');
                const v = productVariants.find(v => v.id === fVariantId);
                if (!v) throw new Error("Variação selecionada não encontrada.");
                variantNameStr = v.name;
                if (v.sku) finalSku = v.sku;
            }
            
            await stockMovementService.registerMovement({
                productId: prod.id!,
                productName: prod.name,
                variantId: fVariantId || undefined,
                variantName: variantNameStr || undefined,
                sku: finalSku,
                type: reasonObj.type,
                quantity: parseInt(fQty),
                reason: reasonObj.id,
                channel: fChannel,
                notes: fNotes,
            });

            toast("Movimentação de estoque salva com sucesso!");
            
            // Clean modal
            setIsFormOpen(false);
            setFProductId('');
            setFProdSearch('');
            setFQty('');
            setFNotes('');
            setFChannel(CHANNELS[0]);
            setFVariantId('');
            setProductVariants([]);
            
            loadData(); // refresh history
        } catch(e: any) {
            toast(e.message || "Erro ao salvar movimentação.", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-800/50 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Movimentações de Estoque</h1>
                    <p className="text-slate-400 text-sm mt-1">Gerencie e acesse o histórico completo de entradas e saídas físicas.</p>
                </div>
                {activeTab === 'movimentacoes' && canCreate && (
                    <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-sm whitespace-nowrap px-6 py-5 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800">
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
                    <div className="bg-slate-900 p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row gap-4 items-end xl:items-center transition-all w-full">
                        <div className="flex-1 w-full relative">
                            <Search className="absolute left-3 top-[50%] -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Buscar por produto, SKU ou motivo..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-slate-800 border-slate-700 h-11"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full xl:w-auto shrink-0">
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período</label>
                                <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full" 
                                    value={filterDate} onChange={e => setFilterDate(e.target.value as any)}>
                                    <option value="all">Todo Histórico</option>
                                    <option value="today">Hoje</option>
                                    <option value="7days">Últimos 7 dias</option>
                                    <option value="30days">Últimos 30 dias</option>
                                </select>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</label>
                                <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full" 
                                    value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                                    <option value="all">Entradas e Saídas</option>
                                    <option value="in">Somente Entradas (+)</option>
                                    <option value="out">Somente Saídas (-)</option>
                                </select>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canal</label>
                                <select className="border border-slate-700 p-2.5 rounded-lg bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-full" 
                                    value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
                                    <option value="all">Todos os Canais</option>
                                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="bg-slate-900 border rounded-xl shadow-sm overflow-hidden flex flex-col h-[60vh] sm:h-[65vh] relative w-full">
                        <div className="overflow-auto flex-1 w-full">
                            <table className="w-full text-sm min-w-[1000px]">
                                <thead className="bg-slate-800 sticky top-0 border-b shadow-sm z-10">
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
                                <tbody className="divide-y divide-slate-100">
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
                                                        {m.variantName && <span className="text-emerald-700 ml-1.5 opacity-90 text-[13px] tracking-tight">/ {m.variantName}</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {m.sku}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full shadow-sm ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
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
                                                    <span className={`font-bold inline-block px-2 text-[15px] ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {isUp ? '+' : '-'}{m.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex items-center gap-2 font-mono text-[13px]">
                                                            <span className="text-slate-400">{m.previousStock ?? '?'}</span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="font-bold text-slate-100">{m.newStock ?? '?'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    <p className="truncate max-w-[150px] font-medium" title={m.createdByName}>{m.createdByName}</p>
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

            {/* Modal: Nova Movimentação */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm transition-opacity">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-[550px] shadow-2xl flex flex-col overflow-hidden max-h-full">
                        {/* Header Modal */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-lg text-white">Registrar Movimentação</h3>
                                <p className="text-sm text-slate-400">Alteração permanente de estoque.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto">
                            <form id="stockForm" onSubmit={handleSave} className="space-y-5">
                                {/* Busca e Seleção de Produto */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-200">Identificação do Produto <span className="text-red-500">*</span></label>
                                    {!fProductId ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-[10px] h-4 w-4 text-slate-400" />
                                            <Input 
                                                placeholder="Digite nome ou SKU para buscar..." 
                                                value={fProdSearch}
                                                onChange={(e) => setFProdSearch(e.target.value)}
                                                className="pl-9 h-10 border-slate-600"
                                                autoFocus
                                            />
                                            {fProdSearch && (
                                                <div className="absolute top-12 left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-auto py-1">
                                                    {formProductsObj.map(p => (
                                                        <div key={p.id} onClick={() => { setFProductId(p.id!); setFProdSearch(''); }} className="px-4 py-2.5 hover:bg-slate-800 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0">
                                                            <div className="min-w-0 pr-4">
                                                                <p className="font-medium text-sm text-slate-100 truncate">{p.name}</p>
                                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                                                            </div>
                                                            <div className="shrink-0 flex items-center gap-2">
                                                                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Estoque</span>
                                                                <span className="bg-slate-950 text-slate-200 font-bold px-2 py-1 rounded text-sm min-w-8 text-center">{p.stock}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formProductsObj.length === 0 && <div className="p-4 text-sm text-slate-400 text-center">Produto não encontrado.</div>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                                            <div className="min-w-0 pr-4">
                                                <p className="font-semibold text-emerald-900 truncate">{products.find(p=>p.id === fProductId)?.name}</p>
                                                <p className="text-xs text-emerald-700/80 font-mono mt-0.5">{products.find(p=>p.id === fProductId)?.hasVariants ? 'Este produto armazena estoque por Variações' : `Estoque Atual: ${products.find(p=>p.id === fProductId)?.stock} und`}</p>
                                            </div>
                                            <button type="button" onClick={() => {setFProductId(''); setFVariantId(''); setProductVariants([]);}} className="text-emerald-700 hover:text-emerald-900 text-sm font-semibold underline underline-offset-2 shrink-0">Trocar</button>
                                        </div>
                                    )}
                                </div>

                                {fProductId && products.find(p=>p.id === fProductId)?.hasVariants && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-200">Variação Específica (Obrigatório) <span className="text-red-500">*</span></label>
                                        <select 
                                            className="w-full border border-slate-600 p-2 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 outline-none h-10 shadow-sm disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed" 
                                            value={fVariantId}
                                            onChange={e => setFVariantId(e.target.value)}
                                            required
                                            disabled={isLoadingVariants}
                                        >
                                            <option value="" disabled>{isLoadingVariants ? 'Carregando opções...' : 'Selecione a variação para movimentar o saldo...'}</option>
                                            {productVariants.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name} &nbsp;&nbsp;(Saldo Constante: {v.stock} • SKU: {v.sku || 'N/A'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Motivo e Quantidade lado a lado */}
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                                    <div className="sm:col-span-3 space-y-2">
                                        <label className="text-sm font-semibold text-slate-200">Origem / Motivação <span className="text-red-500">*</span></label>
                                        <select 
                                            className="w-full border border-slate-600 p-2 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 outline-none h-10 shadow-sm" 
                                            value={fReasonId}
                                            onChange={e => setFReasonId(e.target.value)}
                                            required
                                        >
                                            <optgroup label="Entradas (Somam Estoque)">
                                                {REASONS.filter(r => r.type === 'in').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                            </optgroup>
                                            <optgroup label="Saídas (Subtraem Estoque)">
                                                {REASONS.filter(r => r.type === 'out').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2 space-y-2">
                                        <label className="text-sm font-semibold text-slate-200">Quantidade <span className="text-red-500">*</span></label>
                                        <Input type="number" min="1" placeholder="Ex: 5" value={fQty} onChange={e => setFQty(e.target.value)} required className="h-10 border-slate-600 font-bold" />
                                    </div>
                                </div>

                                {/* Canal */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-200">Canal de Movimentação (Opcional)</label>
                                    <select 
                                        className="w-full border border-slate-600 p-2 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 outline-none h-10 shadow-sm" 
                                        value={fChannel}
                                        onChange={e => setFChannel(e.target.value)}
                                    >
                                        {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Obsevacoes */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-200">Referência Interna / Obs (Opcional)</label>
                                    <textarea 
                                        placeholder="NF, Fornecedor, Link do Pedido..." 
                                        className="w-full border border-slate-600 p-3 rounded-lg bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 outline-none min-h-[80px] shadow-sm resize-none"
                                        value={fNotes} 
                                        onChange={e => setFNotes(e.target.value)} 
                                    />
                                </div>
                            </form>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-800 flex justify-end gap-3 shrink-0">
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="hover:bg-slate-200 border-slate-600 text-slate-200">
                                Cancelar
                            </Button>
                            <Button type="submit" form="stockForm" disabled={submitting || !fProductId} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[200px] h-10">
                                {submitting ? 'Salvando Definitivo...' : 'Confirmar Lançamento'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
