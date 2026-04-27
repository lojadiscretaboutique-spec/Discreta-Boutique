import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatCurrency } from '../../../lib/utils';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { DollarSign, Calculator } from 'lucide-react';
import { financialService } from '../../../services/financialService';

interface SellerData {
  id: string;
  name: string;
  email: string;
  commissionPercent: number;
  onlineDelivered: number;
  onlineCanceled: number;
  pdvDelivered: number;
  pdvCanceled: number;
}

export function AdminCommissions() {
  const [startDate, setStartDate] = useState(format(startOfDay(new Date()), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState<SellerData[]>([]);
  
  const { toast, confirm } = useFeedback();

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users w/ commission > 0
      const usersSnap = await getDocs(collection(db, 'users'));
      const sellerUsers: Array<{ id: string; commission?: number; roles?: string[]; name?: string; email?: string; [key: string]: unknown }> = [];
      usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.commission > 0 || (u.roles && u.roles.includes('vendedor'))) {
          sellerUsers.push({ id: doc.id, ...u });
        }
      });

      // 2. Fetch Orders in period
      let q = query(
        collection(db, 'orders'),
        where('createdAt', '>=', startOfDay(parseISO(startDate))),
        where('createdAt', '<=', endOfDay(parseISO(endDate)))
      );
      const ordersSnap = await getDocs(q);

      // 3. Aggregate
      const aggregated: Record<string, SellerData> = {};
      
      sellerUsers.forEach(u => {
        aggregated[u.id] = {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          commissionPercent: u.commission || 0,
          onlineDelivered: 0,
          onlineCanceled: 0,
          pdvDelivered: 0,
          pdvCanceled: 0
        };
      });

      ordersSnap.forEach(doc => {
        const o = doc.data();
        if (!o.sellerId || !aggregated[o.sellerId]) return;

        const total = o.total || 0;
        const sStatus = o.status || '';
        const type = o.type === 'online' ? 'online' : 'pdv';

        if (sStatus === 'ENTREGUE' || sStatus === 'entregue') {
          if (type === 'online') aggregated[o.sellerId].onlineDelivered += total;
          else aggregated[o.sellerId].pdvDelivered += total;
        } else if (sStatus === 'CANCELADO' || sStatus === 'cancelado') {
          if (type === 'online') aggregated[o.sellerId].onlineCanceled += total;
          else aggregated[o.sellerId].pdvCanceled += total;
        }
      });

      setSellers(Object.values(aggregated));
    } catch (err: unknown) {
      console.error(err);
      toast("Erro ao calcular comissões: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGeneratePayable = async (seller: SellerData, commissionValue: number, netTotal: number) => {
    if (commissionValue <= 0) {
      toast("Valor da comissão é zero ou negativo. Não é possível gerar contas a pagar.", "warning");
      return;
    }

    const ok = await confirm({
      title: 'Gerar Contas a Pagar',
      message: `Deseja gerar um lançamento financeiro (Saída) no valor de ${formatCurrency(commissionValue)} para o vendedor ${seller.name}?`,
      confirmText: 'Gerar Lançamento'
    });

    if (!ok) return;

    try {
      const todayISO = new Date().toISOString().split('T')[0];
      
      await financialService.saveTransaction({
        type: 'expense',
        description: `Comissão de Vendas - ${seller.name}`,
        amount: commissionValue,
        dueDate: todayISO,
        status: 'pending',
        category: 'Comissões',
        contact: seller.name,
        notes: `Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}. Base: ${formatCurrency(netTotal)} (${seller.commissionPercent}%).`
      });

      toast(`Conta a pagar gerada para ${seller.name} com sucesso!`, "success");
    } catch (err: unknown) {
      toast("Erro ao gerar lançamento: " + (err instanceof Error ? err.message : String(err)), "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-700 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-red-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">Comissões</h1>
          <p className="text-sm font-medium text-slate-400 max-w-sm">Apuração e cálculo inteligente de comissionamento de vendas.</p>
        </div>
      </header>

      {/* FILTROS */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-auto">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Data Inicial</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl w-full" />
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Data Final</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl w-full" />
          </div>
          <Button onClick={loadData} disabled={loading} className="w-full md:w-auto rounded-xl bg-slate-900 hover:bg-slate-800 h-10 px-6">
            {loading ? 'Calculando...' : <><Calculator size={18} className="mr-2"/> Calcular Comissões</>}
          </Button>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs uppercase font-bold min-w-[1000px]">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs">Vendedor</th>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs">Vendas Online<br/><span className="text-[9px] font-medium">(Entregue - Cancelado)</span></th>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs">Vendas PDV<br/><span className="text-[9px] font-medium">(Entregue - Cancelado)</span></th>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs">Total Geral Base</th>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs">Valor Comissão</th>
                <th className="px-6 py-4 text-slate-400 tracking-widest text-xs text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.length === 0 && (
                <tr className="bg-slate-900">
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-bold uppercase tracking-widest">
                    Nenhum vendedor encontrado ou dados insuficientes no período.
                  </td>
                </tr>
              )}
              {sellers.map(s => {
                const onlineNet = s.onlineDelivered - s.onlineCanceled;
                const pdvNet = s.pdvDelivered - s.pdvCanceled;
                const netTotal = onlineNet + pdvNet;
                const commissionValue = (netTotal > 0 ? netTotal : 0) * (s.commissionPercent / 100);

                return (
                  <tr key={s.id} className="hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-white text-sm">{s.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{s.email}</div>
                      <div className="inline-block px-2 py-1 bg-red-50 text-red-600 rounded-md text-[10px] font-black mt-2">
                        {s.commissionPercent}% COMISSÃO
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-bold">{formatCurrency(onlineNet)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-bold">{formatCurrency(pdvNet)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-black text-sm">{formatCurrency(netTotal)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-base font-black text-green-600">
                        {formatCurrency(commissionValue)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        onClick={() => handleGeneratePayable(s, commissionValue, netTotal)}
                        variant="outline"
                        size="sm"
                        disabled={commissionValue <= 0}
                        className="rounded-full text-[10px] uppercase tracking-widest border-slate-700 hover:border-green-300 hover:bg-green-50 text-slate-200 hover:text-green-700 transition-colors"
                      >
                        <DollarSign size={14} className="mr-1"/>
                        Gerar a Pagar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
