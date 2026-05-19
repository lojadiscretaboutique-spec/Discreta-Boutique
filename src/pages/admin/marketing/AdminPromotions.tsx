import { useState, useEffect } from 'react';
import { promotionService, Promotion } from '../../../services/promotionService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { MegaMenu, Tag, Trash2, Edit2, Plus, Percent, Truck, DollarSign, Calendar, Eye, Search } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

export function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useFeedback();
  const { theme } = useSettings();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  
  const [editPromotion, setEditPromotion] = useState<Partial<Promotion>>({
    name: '',
    active: true,
    type: 'percentage',
    value: 0,
    scope: 'all',
    targetIds: [],
    priority: 0
  });

  useEffect(() => {
    loadData();
    loadScopeOptions();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await promotionService.getAll();
      setPromotions(data);
    } catch (e) {
      console.error(e);
      toast("Erro ao carregar promoções", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadScopeOptions = async () => {
    try {
      const catSnap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      
      const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (e) {
      console.error(e);
    }
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
            priority: 0 
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
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onClick={() => { setEditPromotion(promo); setIsModalOpen(true); }} className="p-2 bg-slate-800 rounded-xl text-white hover:bg-slate-700"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(promo.id!)} className="p-2 bg-red-600 rounded-xl text-white hover:bg-red-700"><Trash2 size={14} /></button>
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-2xl ${
                  promo.type === 'percentage' ? 'bg-blue-500/10 text-blue-500' :
                  promo.type === 'fixed' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                }`}>
                  {promo.type === 'percentage' && <Percent size={24} />}
                  {promo.type === 'fixed' && <DollarSign size={24} />}
                  {promo.type === 'free_shipping' && <Truck size={24} />}
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tighter leading-none mb-1">{promo.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest uppercase py-0.5 px-2 bg-slate-800 text-slate-400 rounded-md">
                      Prioridade: {promo.priority}
                    </span>
                    {!promo.active && (
                      <span className="text-[10px] font-black tracking-widest uppercase py-0.5 px-2 bg-red-900/20 text-red-500 rounded-md">Inativo</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Benefício:</span>
                  <span className="font-black text-white">
                    {promo.type === 'percentage' && `${promo.value}% de desconto`}
                    {promo.type === 'fixed' && `${formatCurrency(promo.value)} de desconto`}
                    {promo.type === 'free_shipping' && `FRETE GRÁTIS`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Aplicado em:</span>
                  <span className="font-bold text-slate-300 uppercase text-[10px]">
                    {promo.scope === 'all' && 'Todo o Site'}
                    {promo.scope === 'categories' && `${promo.targetIds?.length || 0} Categorias`}
                    {promo.scope === 'products' && `${promo.targetIds?.length || 0} Produtos`}
                  </span>
                </div>
                {promo.endDate && (
                   <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Expira em:</span>
                    <span className="font-bold text-red-500 text-[10px]">{new Date(promo.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Professional Ecommerce Style */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-[2.5rem] overflow-hidden border ${
            theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-2xl" : "bg-white border-slate-100 shadow-2xl"
          }`}>
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic">Configurar Promoção</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Defina as regras da oferta online</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">Fechar</button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nome da Promoção (Interno)</label>
                  <Input 
                    value={editPromotion.name} 
                    onChange={e => setEditPromotion({...editPromotion, name: e.target.value})} 
                    placeholder="Ex: Black Friday 2024"
                    className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Tipo de Benefício</label>
                  <select 
                    value={editPromotion.type} 
                    onChange={e => setEditPromotion({...editPromotion, type: e.target.value as any})}
                    className="w-full h-12 rounded-xl font-bold uppercase text-sm border border-white/10 bg-black/20 px-4 focus:ring-2 ring-red-600 outline-none"
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                    <option value="free_shipping">Frete Grátis</option>
                  </select>
                </div>

                {editPromotion.type !== 'free_shipping' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Valor do Desconto</label>
                    <Input 
                      type="number" 
                      value={editPromotion.value || ''} 
                      onChange={e => setEditPromotion({...editPromotion, value: parseFloat(e.target.value)})} 
                      placeholder={editPromotion.type === 'percentage' ? "Ex: 15" : "Ex: 50.00"}
                      className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Abrangência (Escopo)</label>
                  <select 
                    value={editPromotion.scope} 
                    onChange={e => setEditPromotion({...editPromotion, scope: e.target.value as any, targetIds: []})}
                    className="w-full h-12 rounded-xl font-bold uppercase text-sm border border-white/10 bg-black/20 px-4 focus:ring-2 ring-red-600 outline-none"
                  >
                    <option value="all">Todo o Site (Geral)</option>
                    <option value="categories">Por Categorias</option>
                    <option value="products">Por Produtos Específicos</option>
                  </select>
                </div>

                 <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Prioridade (0-99)</label>
                  <Input 
                    type="number" 
                    value={editPromotion.priority || 0} 
                    onChange={e => setEditPromotion({...editPromotion, priority: parseInt(e.target.value)})} 
                    placeholder="0"
                    className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                  />
                </div>
              </div>

              {/* Scope Selection Area */}
              {editPromotion.scope === 'categories' && (
                <div className="p-6 bg-black/40 rounded-3xl border border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-4">Selecionar Categorias</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => toggleTarget(cat.id)}
                        className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
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

              {editPromotion.scope === 'products' && (
                <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Selecionar Produtos</h4>
                    <span className="text-[10px] font-bold text-red-500">{editPromotion.targetIds?.length || 0} SELECIONADOS</span>
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
                        key={prod.id}
                        onClick={() => toggleTarget(prod.id)}
                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                          editPromotion.targetIds?.includes(prod.id)
                            ? 'bg-red-600/10 border-red-500/50 text-red-500'
                            : 'bg-slate-800/20 border-white/5 text-slate-400 hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase truncate pr-4">{prod.name}</span>
                        {editPromotion.targetIds?.includes(prod.id) && <Tag size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Início da Validade</label>
                  <Input 
                    type="date" 
                    value={editPromotion.startDate || ''} 
                    onChange={e => setEditPromotion({...editPromotion, startDate: e.target.value})} 
                    className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Término da Validade</label>
                  <Input 
                    type="date" 
                    value={editPromotion.endDate || ''} 
                    onChange={e => setEditPromotion({...editPromotion, endDate: e.target.value})} 
                    className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Valor Mínimo para Ativar (R$)</label>
                  <Input 
                    type="number" step="0.01"
                    value={editPromotion.minPurchaseAmount || ''} 
                    onChange={e => setEditPromotion({...editPromotion, minPurchaseAmount: parseFloat(e.target.value)})} 
                    placeholder="Ex: 100.00"
                    className="h-12 rounded-xl font-bold uppercase text-sm border-white/10 bg-black/20"
                  />
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
                <label htmlFor="active-toggle" className="text-sm font-bold uppercase tracking-widest cursor-pointer">Promoção Ativa</label>
              </div>
            </div>

            <div className="p-8 bg-black/40 border-t border-white/5 flex gap-4">
              <Button onClick={() => setIsModalOpen(false)} variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs border-slate-700 text-slate-400 hover:bg-slate-800">
                CANCELAR
              </Button>
              <Button onClick={handleSave} className="flex-[2] h-14 rounded-2xl font-black italic uppercase text-xs bg-red-600 hover:bg-red-700 text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)]">
                SALVAR PROMOÇÃO
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
