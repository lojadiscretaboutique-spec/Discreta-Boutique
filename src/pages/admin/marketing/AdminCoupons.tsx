import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { couponService, Coupon } from '../../../services/couponService';
import { settingsService } from '../../../services/settingsService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Tag, Trash2, Edit2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { cn } from '../../../lib/utils';

const DEFAULT_PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'credit_card', label: 'Cartão de Crédito' },
  { id: 'debit_card', label: 'Cartão de Débito' },
  { id: 'cash', label: 'Dinheiro' }
];

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useFeedback();
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; label: string }[]>(DEFAULT_PAYMENT_METHODS);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Partial<Coupon>>({
    type: 'percentage',
    value: 10,
    active: true,
    allowedPaymentMethods: []
  });

  useEffect(() => {
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
    loadPaymentMethods();
  }, []);

  const loadCoupons = async () => {
    // No-op because we listen to Firestore onSnapshot live!
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(data);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to coupons:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCoupon.code || !editCoupon.value) {
      toast("Código e valor são obrigatórios", "warning");
      return;
    }

    try {
      await couponService.saveCoupon(editCoupon as Omit<Coupon, 'id'>);
      toast("Cupom salvo com sucesso!", "success");
      setIsModalOpen(false);
      loadCoupons();
    } catch (e) {
      toast("Erro ao salvar cupom", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cupom?")) {
      try {
        await couponService.deleteCoupon(id);
        toast("Cupom excluído!", "success");
        setCoupons(prev => prev.filter(c => c.id !== id));
      } catch (e) {
        toast("Erro ao excluir", "error");
      }
    }
  };
  
  const theme = localStorage.getItem('admin-theme') || 'dark';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Tag className="text-red-500" />
            Cupons de Desconto
          </h2>
          <p className="text-sm font-bold text-slate-500">Gerencie ofertas da loja online</p>
        </div>
        <Button onClick={() => {
          setEditCoupon({ type: 'percentage', value: 10, active: true, allowedPaymentMethods: [] });
          setIsModalOpen(true);
        }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cupom
        </Button>
      </div>

      <div className={cn("rounded-3xl border p-2 sm:p-4 shadow-sm", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : coupons.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 font-bold uppercase tracking-wide">Nenhum cupom cadastrado</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn("text-[10px] uppercase tracking-wider font-bold border-b", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-500 border-slate-100")}>
                    <th className="p-3">Código</th>
                    <th className="p-3">Desconto</th>
                    <th className="p-3">Uso/Limite</th>
                    <th className="p-3">Mínimo R$</th>
                    <th className="p-3">Pagtos. Válidos</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className={cn("border-b last:border-0", theme === 'dark' ? "border-slate-800/50" : "border-slate-100")}>
                      <td className="p-3 font-mono font-bold">{c.code}</td>
                      <td className="p-3 font-bold text-red-500">
                        {c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value)}
                      </td>
                      <td className="p-3 text-sm">
                        {c.uses} / {c.maxUses || '∞'}
                      </td>
                      <td className="p-3 text-sm">
                        {c.minPurchaseAmount ? formatCurrency(c.minPurchaseAmount) : 'Nenhum'}
                      </td>
                      <td className="p-3 text-xs font-semibold text-slate-400">
                        {c.allowedPaymentMethods && c.allowedPaymentMethods.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.allowedPaymentMethods.map(id => {
                              const label = paymentMethods.find(m => m.id === id)?.label || id;
                              return (
                                <span key={id} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] uppercase tracking-wide font-black border border-zinc-700 text-zinc-300">
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-bold italic">Todos</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded-full", c.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditCoupon({
                              ...c,
                              allowedPaymentMethods: c.allowedPaymentMethods || []
                            });
                            setIsModalOpen(true);
                          }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-4 p-1">
              {coupons.map((c) => (
                <div 
                  key={c.id} 
                  className={cn(
                    "p-5 rounded-2xl border flex flex-col gap-4 shadow-sm", 
                    theme === 'dark' ? "bg-slate-950 border-slate-800 text-zinc-100" : "bg-slate-50 border-slate-200 text-zinc-900"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-black text-sm tracking-widest px-3 py-1 bg-red-600/10 border border-red-500/20 text-red-500 rounded-lg">
                      {c.code}
                    </span>
                    <span className={cn("px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wide", c.active ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20")}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-y py-3 border-zinc-800/10 dark:border-zinc-800/50">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-0.5">Desconto</span>
                      <span className="font-black text-red-500 text-sm">
                        {c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-0.5">Uso / Limite</span>
                      <span className="font-bold text-slate-300">
                        {c.uses} / {c.maxUses || '∞'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-0.5">Mínimo R$</span>
                      <span className="font-black text-slate-400">
                        {c.minPurchaseAmount ? formatCurrency(c.minPurchaseAmount) : 'Nenhum'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 mt-1 sm:mt-0">
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-1">Pagtos. Válidos</span>
                      <div className="flex flex-wrap gap-1">
                        {c.allowedPaymentMethods && c.allowedPaymentMethods.length > 0 ? (
                          c.allowedPaymentMethods.map(id => {
                            const label = paymentMethods.find(m => m.id === id)?.label || id;
                            return (
                              <span key={id} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] uppercase tracking-wide font-black border border-zinc-700 text-zinc-300">
                                {label}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-zinc-500 font-bold italic text-[11px]">Todos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-zinc-805/10 dark:border-zinc-800/20">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditCoupon({
                        ...c,
                        allowedPaymentMethods: c.allowedPaymentMethods || []
                      });
                      setIsModalOpen(true);
                    }} className="h-9 px-3 gap-1">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-600 h-9 px-3 gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleSave} 
            className={cn(
              "w-full max-w-lg rounded-3xl p-6 relative overflow-hidden max-h-[90vh] flex flex-col shadow-2xl border", 
              theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {/* Modal Header */}
            <div className="pb-4 border-b border-zinc-800/10 dark:border-white/5 shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter italic">
                  {editCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Configure as regras de ativação</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-500 hover:text-zinc-400 transition-colors text-xs font-black uppercase tracking-widest px-2 py-1"
              >
                Fechar
              </button>
            </div>
            
            {/* Scrollable Body */}
            <div className="space-y-5 overflow-y-auto flex-1 py-4 pr-1 snap-y custom-scrollbar text-left">
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Código do Cupom</label>
                <Input 
                  required 
                  value={editCoupon.code || ''} 
                  onChange={e => setEditCoupon({...editCoupon, code: e.target.value.toUpperCase()})} 
                  placeholder="EX: BORA10"
                  className={cn("uppercase h-11 rounded-xl font-bold text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")} 
                  disabled={!!editCoupon.id} // cannot edit code once created
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Tipo de Desconto</label>
                  <select 
                    value={editCoupon.type} 
                    onChange={e => setEditCoupon({...editCoupon, type: e.target.value as 'percentage' | 'fixed'})}
                    className={cn("w-full h-11 px-3 rounded-xl border text-sm font-medium focus:ring-2 ring-red-600 outline-none", theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900")}
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Valor</label>
                  <Input 
                    type="number" step="0.01" required 
                    value={editCoupon.value || ''} 
                    onChange={e => setEditCoupon({...editCoupon, value: parseFloat(e.target.value)})} 
                    className={cn("h-11 rounded-xl font-bold text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Lim. de Usos (Geral)</label>
                  <Input 
                    type="number" 
                    value={editCoupon.maxUses || ''} 
                    onChange={e => setEditCoupon({...editCoupon, maxUses: e.target.value ? parseInt(e.target.value) : undefined})} 
                    placeholder="Ex: 100"
                    className={cn("h-11 rounded-xl font-medium text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Lim. por Cliente</label>
                  <Input 
                    type="number" 
                    value={editCoupon.usageLimitPerCustomer || ''} 
                    onChange={e => setEditCoupon({...editCoupon, usageLimitPerCustomer: e.target.value ? parseInt(e.target.value) : undefined})} 
                    placeholder="Ex: 1"
                    className={cn("h-11 rounded-xl font-medium text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Válido A partir de</label>
                  <Input 
                    type="date" 
                    value={editCoupon.startDate || ''} 
                    onChange={e => setEditCoupon({...editCoupon, startDate: e.target.value})} 
                    className={cn("h-11 rounded-xl font-medium text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Válido Até</label>
                  <Input 
                    type="date" 
                    value={editCoupon.endDate || ''} 
                    onChange={e => setEditCoupon({...editCoupon, endDate: e.target.value})} 
                    className={cn("h-11 rounded-xl font-medium text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Compra Mín. R$ (Opcional)</label>
                <Input 
                  type="number" step="0.01"
                  value={editCoupon.minPurchaseAmount || ''} 
                  onChange={e => setEditCoupon({...editCoupon, minPurchaseAmount: e.target.value ? parseFloat(e.target.value) : undefined})} 
                  placeholder="Ex: 200.00"
                  className={cn("h-11 rounded-xl font-medium text-sm", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1.5 text-slate-400">Formas de Pagamento Válidas</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 py-1">
                  {paymentMethods.map(m => {
                    const isChecked = editCoupon.allowedPaymentMethods?.includes(m.id) ?? false;
                    return (
                      <label 
                        key={m.id} 
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors",
                          isChecked 
                            ? (theme === 'dark' ? "bg-red-500/10 border-red-500/40 text-red-400" : "bg-red-50 border-red-200 text-red-700") 
                            : (theme === 'dark' ? "bg-slate-950 border-slate-800 hover:bg-slate-800/40 text-slate-300" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700")
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const current = editCoupon.allowedPaymentMethods || [];
                            const updated = e.target.checked
                              ? [...current, m.id]
                              : current.filter(id => id !== m.id);
                            setEditCoupon({ ...editCoupon, allowedPaymentMethods: updated });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                        />
                        <span>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                  * Se nenhuma for selecionada, o cupom será aceito em todas as formas de pagamento.
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input 
                  type="checkbox" 
                  checked={editCoupon.active} 
                  onChange={e => setEditCoupon({...editCoupon, active: e.target.checked})}
                  id="activeCoupon"
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="activeCoupon" className="text-sm font-bold uppercase tracking-wider text-slate-300 cursor-pointer">Cupom Ativo</label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/10 dark:border-white/5 shrink-0">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="h-12 rounded-xl px-5">Cancelar</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl px-6 italic font-black">Salvar Cupom</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
