import { useState, useEffect } from 'react';
import { couponService, Coupon } from '../../../services/couponService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Tag, Trash2, Edit2 } from 'lucide-react';
import { formatCurrency, formatTimestamp } from '../../../lib/utils';
import { cn } from '../../../lib/utils';

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useFeedback();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Partial<Coupon>>({
    type: 'percentage',
    value: 10,
    active: true,
  });

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await couponService.getCoupons();
      setCoupons(data);
    } catch (e) {
      toast("Erro ao carregar cupons", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
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
          setEditCoupon({ type: 'percentage', value: 10, active: true });
          setIsModalOpen(true);
        }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cupom
        </Button>
      </div>

      <div className={cn("rounded-3xl border p-2 sm:p-4 shadow-sm", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn("text-[10px] uppercase tracking-wider font-bold border-b", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-500 border-slate-100")}>
                <th className="p-3">Código</th>
                <th className="p-3">Desconto</th>
                <th className="p-3">Uso/Limite</th>
                <th className="p-3">Mínimo R$</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-sm">Carregando...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-sm">Nenhum cupom cadastrado</td></tr>
              ) : (
                coupons.map((c) => (
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
                    <td className="p-3">
                      <span className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded-full", c.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditCoupon(c);
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleSave} className={cn("w-full max-w-md rounded-3xl p-6 relative overflow-hidden", theme === 'dark' ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border border-slate-200 text-slate-900")}>
            <h3 className="text-lg font-black mb-4">
              {editCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Código do Cupom</label>
                <Input 
                  required 
                  value={editCoupon.code || ''} 
                  onChange={e => setEditCoupon({...editCoupon, code: e.target.value.toUpperCase()})} 
                  placeholder="EX: BORA10"
                  className={cn("uppercase", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")} 
                  disabled={!!editCoupon.id} // cannot edit code once created
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Tipo</label>
                  <select 
                    value={editCoupon.type} 
                    onChange={e => setEditCoupon({...editCoupon, type: e.target.value as 'percentage' | 'fixed'})}
                    className={cn("w-full h-11 px-3 py-2 rounded-xl border text-sm font-medium", theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900")}
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Valor</label>
                  <Input 
                    type="number" step="0.01" required 
                    value={editCoupon.value || ''} 
                    onChange={e => setEditCoupon({...editCoupon, value: parseFloat(e.target.value)})} 
                    className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Lim. de Usos (Geral)</label>
                  <Input 
                    type="number" 
                    value={editCoupon.maxUses || ''} 
                    onChange={e => setEditCoupon({...editCoupon, maxUses: e.target.value ? parseInt(e.target.value) : undefined})} 
                    placeholder="Ex: 100"
                    className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Lim. por Cliente</label>
                  <Input 
                    type="number" 
                    value={editCoupon.usageLimitPerCustomer || ''} 
                    onChange={e => setEditCoupon({...editCoupon, usageLimitPerCustomer: e.target.value ? parseInt(e.target.value) : undefined})} 
                    placeholder="Ex: 1"
                    className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Válido A partir de</label>
                  <Input 
                    type="date" 
                    value={editCoupon.startDate || ''} 
                    onChange={e => setEditCoupon({...editCoupon, startDate: e.target.value})} 
                    className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Válido Até</label>
                  <Input 
                    type="date" 
                    value={editCoupon.endDate || ''} 
                    onChange={e => setEditCoupon({...editCoupon, endDate: e.target.value})} 
                    className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Compra Mín. R$ (Opcional)</label>
                <Input 
                  type="number" step="0.01"
                  value={editCoupon.minPurchaseAmount || ''} 
                  onChange={e => setEditCoupon({...editCoupon, minPurchaseAmount: e.target.value ? parseFloat(e.target.value) : undefined})} 
                  placeholder="Ex: 200.00"
                  className={theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  checked={editCoupon.active} 
                  onChange={e => setEditCoupon({...editCoupon, active: e.target.checked})}
                  id="activeCoupon"
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="activeCoupon" className="text-sm font-semibold">Cupom Ativo</label>
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">Salvar Cupom</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
