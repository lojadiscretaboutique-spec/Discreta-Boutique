import { useState, useEffect } from 'react';
import { promotionService, Promotion } from '../../../services/promotionService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { MegaMenu, Tag, Trash2, Edit2, Plus, Percent, Truck, DollarSign, Calendar, Eye, Search } from 'lucide-react';
import { formatCurrency, cn } from '../../../lib/utils';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';
import { settingsService } from '../../../services/settingsService';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

const DEFAULT_PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'credit_card', label: 'Cartão de Crédito' },
  { id: 'debit_card', label: 'Cartão de Débito' },
  { id: 'cash', label: 'Dinheiro' }
];

export function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useFeedback();
  const { theme } = useSettings();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; label: string }[]>(DEFAULT_PAYMENT_METHODS);
  
  const [editPromotion, setEditPromotion] = useState<Partial<Promotion>>({
    name: '',
    active: true,
    type: 'percentage',
    value: 0,
    scope: 'all',
    targetIds: [],
    priority: 0,
    allowedPaymentMethods: []
  });

  useEffect(() => {
    loadPaymentMethods();

    setLoading(true);
    const unsubscribePromotions = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion));
      setPromotions(data);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to promotions:", error);
      setLoading(false);
    });

    const unsubscribeCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    }, (error) => {
      console.error("Error listening to promotion categories:", error);
    });

    const unsubscribeProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    }, (error) => {
      console.error("Error listening to promotion products:", error);
    });

    return () => {
      unsubscribePromotions();
      unsubscribeCategories();
      unsubscribeProducts();
    };
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const settings = await settingsService.getPaymentSettings();
      if (settings && settings.methods && settings.methods.length > 0) {
        setPaymentMethods(settings.methods);
      }
    } catch (err) {
      console.error("Erro ao carregar formas de pagamento", err);
    }
  };

  const loadData = async () => {
    // No-op because we listen to Firestore onSnapshot live!
  };

  const loadScopeOptions = async () => {
    // No-op because we listen to Firestore onSnapshot live!
  };

  const handleSave = async () => {
    if (!editPromotion.name || editPromotion.value === undefined) {
      toast("Preencha os campos obrigatórios", "warning");
      return;
    }

    try {
      if (editPromotion.id) {
        await promotionService.update(editPromotion.id, editPromotion);
        toast("Promoção atualizada com sucesso", "success");
      } else {
        await promotionService.create(editPromotion as Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>);
        toast("Promoção criada com sucesso", "success");
      }
      setIsModalOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast("Erro ao salvar promoção", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta promoção?")) return;
    try {
      await promotionService.delete(id);
      toast("Promoção excluída", "success");
      loadData();
    } catch (e) {
      console.error(e);
      toast("Erro ao excluir", "error");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const toggleTarget = (id: string) => {
    const targets = [...(editPromotion.targetIds || [])];
    if (targets.includes(id)) {
      setEditPromotion({ ...editPromotion, targetIds: targets.filter(t => t !== id) });
    } else {
      setEditPromotion({ ...editPromotion, targetIds: [...targets, id] });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Tag className="text-red-500" />
            Promoções da Loja
          </h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-[10px]">Administre ofertas automáticas e frete grátis</p>
        </div>
        <Button onClick={() => {
          setEditPromotion({ 
            name: '', 
            active: true, 
            type: 'percentage', 
            value: 0, 
            scope: 'all', 
            targetIds: [], 
            priority: 0,
            allowedPaymentMethods: []
          });
          setIsModalOpen(true);
        }} className="bg-red-600 hover:bg-red-700 text-white font-black italic rounded-xl px-6">
          <Plus size={18} className="mr-2" /> NOVA PROMOÇÃO
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map(promo => (
            <div key={promo.id} className={`group relative p-6 rounded-3xl border transition-all duration-300 overflow-hidden ${
              promo.active 
                ? (theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                : (theme === 'dark' ? 'bg-slate-950 border-slate-900 opacity-60' : 'bg-slate-50 border-slate-200 opacity-60')
            }`}>
              {/* Responsive actions: always visible on mobile, hover-based on desktop devices */}
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-1.5 z-10">
                <button 
                  onClick={() => { setEditPromotion({ ...promo, allowedPaymentMethods: promo.allowedPaymentMethods || [] }); setIsModalOpen(true); }} 
                  className="p-2 sm:p-2.5 bg-slate-800 rounded-xl text-white hover:bg-slate-700 shadow-md transition-colors"
                  title="Editar"
                >
                  <Edit2 size={13} />
                </button>
                <button 
                  onClick={() => handleDelete(promo.id!)} 
                  className="p-2 sm:p-2.5 bg-red-600 rounded-xl text-white hover:bg-red-700 shadow-md transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-start gap-4 mb-4 pr-16 md:pr-0">
                <div className={`p-3 rounded-2xl shrink-0 ${
                  promo.type === 'percentage' ? 'bg-blue-500/10 text-blue-500' :
                  promo.type === 'fixed' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                }`}>
                  {promo.type === 'percentage' && <Percent size={24} />}
                  {promo.type === 'fixed' && <DollarSign size={24} />}
                  {promo.type === 'free_shipping' && <Truck size={24} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-lg uppercase tracking-tighter leading-tight mb-1.5 truncate">{promo.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-widest uppercase py-0.5 px-2 bg-slate-800 text-slate-400 rounded-md">
                      Prioridade: {promo.priority}
                    </span>
                    {!promo.active && (
                      <span className="text-[9px] font-black tracking-widest uppercase py-0.5 px-2 bg-red-900/20 text-red-500 rounded-md">Inativo</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm gap-2">
                  <span className="text-slate-500 font-bold uppercase text-[10px] shrink-0">Benefício:</span>
                  <span className="font-black text-white text-right">
                    {promo.type === 'percentage' && `${promo.value}% de desconto`}
                    {promo.type === 'fixed' && `${formatCurrency(promo.value)} de desconto`}
                    {promo.type === 'free_shipping' && `FRETE GRÁTIS`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm gap-2">
                  <span className="text-slate-500 font-bold uppercase text-[10px] shrink-0">Aplicado em:</span>
                  <span className="font-bold text-slate-300 uppercase text-[10px] text-right truncate">
                    {promo.scope === 'all' && 'Todo o Site'}
                    {promo.scope === 'categories' && `${promo.targetIds?.length || 0} Categorias`}
                    {promo.scope === 'products' && `${promo.targetIds?.length || 0} Produtos`}
                  </span>
                </div>
                {promo.allowedPaymentMethods && promo.allowedPaymentMethods.length > 0 && (
                  <div className="flex justify-between items-start gap-4 text-sm border-t border-white/5 pt-2">
                    <span className="text-slate-500 font-bold uppercase text-[10px] shrink-0 mt-0.5">Pagamento:</span>
                    <span className="font-bold text-red-500 uppercase text-[9px] tracking-wide text-right flex flex-wrap gap-1 justify-end">
                      {promo.allowedPaymentMethods.map(id => paymentMethods.find(pm => pm.id === id)?.label || id).join(', ')}
                    </span>
                  </div>
                )}
                {promo.endDate && (
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-slate-500 font-bold uppercase text-[10px] shrink-0">Expira em:</span>
                    <span className="font-bold text-red-500 text-[10px] text-right">{new Date(promo.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Professional Ecommerce Style - Fully responsive viewport heights */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl rounded-3xl md:rounded-[2.5rem] overflow-hidden border max-h-[92vh] flex flex-col ${
            theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-2xl" : "bg-white border-slate-100 shadow-2xl"
          }`}>
            
            {/* Sticky Header */}
            <div className="p-5 sm:p-7 border-b border-zinc-800/20 dark:border-white/5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tighter italic">Configurar Promoção</h3>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Defina as regras da oferta online</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-500 hover:text-white transition-colors text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-slate-800/40"
              >
                Fechar
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6 text-left custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Nome da Promoção (Interno)</label>
                  <Input 
                    value={editPromotion.name} 
                    onChange={e => setEditPromotion({...editPromotion, name: e.target.value})} 
                    placeholder="Ex: Black Friday 2024"
                    className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Tipo de Benefício</label>
                  <select 
                    value={editPromotion.type} 
                    onChange={e => setEditPromotion({...editPromotion, type: e.target.value as any})}
                    className="w-full h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border border-white/10 bg-black/20 px-4 focus:ring-2 ring-red-600 outline-none"
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                    <option value="free_shipping">Frete Grátis</option>
                  </select>
                </div>

                {editPromotion.type !== 'free_shipping' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Valor do Desconto</label>
                    <Input 
                      type="number" 
                      value={editPromotion.value || ''} 
                      onChange={e => setEditPromotion({...editPromotion, value: parseFloat(e.target.value)})} 
                      placeholder={editPromotion.type === 'percentage' ? "Ex: 15" : "Ex: 50.00"}
                      className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Abrangência (Escopo)</label>
                  <select 
                    value={editPromotion.scope} 
                    onChange={e => setEditPromotion({...editPromotion, scope: e.target.value as any, targetIds: []})}
                    className="w-full h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border border-white/10 bg-black/20 px-4 focus:ring-2 ring-red-600 outline-none"
                  >
                    <option value="all">Todo o Site (Geral)</option>
                    <option value="categories">Por Categorias</option>
                    <option value="products">Por Produtos Específicos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Prioridade (0-99)</label>
                  <Input 
                    type="number" 
                    value={editPromotion.priority || 0} 
                    onChange={e => setEditPromotion({...editPromotion, priority: parseInt(e.target.value)})} 
                    placeholder="0"
                    className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                  />
                </div>
              </div>

              {/* Scope Selection Area */}
              {editPromotion.scope === 'categories' && (
                <div className="p-4 sm:p-6 bg-black/40 rounded-3xl border border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-4">Selecionar Categorias</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {categories.map(cat => (
                      <button 
                        type="button"
                        key={cat.id}
                        onClick={() => toggleTarget(cat.id)}
                        className={`p-3 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border transition-all ${
                          editPromotion.targetIds?.includes(cat.id)
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope Products Selection Area */}
              {editPromotion.scope === 'products' && (
                <div className="p-4 sm:p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Selecionar Produtos</h4>
                    <span className="text-[10px] font-bold text-red-500 shrink-0">{editPromotion.targetIds?.length || 0} SELECIONADOS</span>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <Input 
                      value={searchProduct}
                      onChange={e => setSearchProduct(e.target.value)}
                      placeholder="Buscar produto..."
                      className="pl-12 h-10 rounded-xl bg-slate-800/50 border-white/5 text-xs font-bold uppercase"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredProducts.map(prod => (
                      <button 
                        type="button"
                        key={prod.id}
                        onClick={() => toggleTarget(prod.id)}
                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                          editPromotion.targetIds?.includes(prod.id)
                            ? 'bg-red-600/10 border-red-500/50 text-red-500'
                            : 'bg-slate-800/20 border-white/5 text-slate-400 hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase truncate pr-4 text-left">{prod.name}</span>
                        {editPromotion.targetIds?.includes(prod.id) && <Tag size={12} className="shrink-0 text-red-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Início da Validade</label>
                  <Input 
                    type="date" 
                    value={editPromotion.startDate || ''} 
                    onChange={e => setEditPromotion({...editPromotion, startDate: e.target.value})} 
                    className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Término da Validade</label>
                  <Input 
                    type="date" 
                    value={editPromotion.endDate || ''} 
                    onChange={e => setEditPromotion({...editPromotion, endDate: e.target.value})} 
                    className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Valor Mínimo para Ativar (R$)</label>
                  <Input 
                    type="number" step="0.01"
                    value={editPromotion.minPurchaseAmount || ''} 
                    onChange={e => setEditPromotion({...editPromotion, minPurchaseAmount: parseFloat(e.target.value)})} 
                    placeholder="Ex: 100.00"
                    className="h-11 sm:h-12 rounded-xl font-bold uppercase text-xs sm:text-sm border-white/10 bg-black/20"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Formas de Pagamento Válidas</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 py-1">
                    {paymentMethods.map(m => {
                      const isChecked = editPromotion.allowedPaymentMethods?.includes(m.id) ?? false;
                      return (
                        <label 
                          key={m.id} 
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors",
                            isChecked 
                              ? "bg-red-500/10 border-red-500/40 text-red-500" 
                              : "bg-black/20 border-white/5 hover:bg-slate-800/40 text-slate-300"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const current = editPromotion.allowedPaymentMethods || [];
                              const updated = e.target.checked
                                ? [...current, m.id]
                                : current.filter(id => id !== m.id);
                              setEditPromotion({ ...editPromotion, allowedPaymentMethods: updated });
                            }}
                            className="w-4 h-4 rounded border-white/10 text-red-600 focus:ring-red-600"
                          />
                          <span>{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                    * Se nenhuma for selecionada, a promoção será válida em todas as formas de pagamento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-black/20 rounded-2xl">
                <input 
                  type="checkbox" 
                  id="active-toggle"
                  checked={editPromotion.active} 
                  onChange={e => setEditPromotion({...editPromotion, active: e.target.checked})}
                  className="w-5 h-5 rounded bg-slate-800 border-white/10 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="active-toggle" className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 cursor-pointer">Promoção Ativa</label>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-7 bg-black/40 border-t border-zinc-805/10 dark:border-white/5 flex gap-3 shrink-0">
              <Button 
                onClick={() => setIsModalOpen(false)} 
                variant="outline" 
                className="flex-1 h-12 sm:h-14 rounded-2xl font-black uppercase text-[10px] sm:text-xs border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                CANCELAR
              </Button>
              <Button 
                onClick={handleSave} 
                className="flex-[2] h-12 sm:h-14 rounded-2xl font-black italic uppercase text-[10px] sm:text-xs bg-red-600 hover:bg-red-700 text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)] animate-pulse"
              >
                SALVAR PROMOÇÃO
              </Button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
