import { useEffect, useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { financialService, FinancialTransaction } from '../../../services/financialService';
import { formatCurrency, cn } from '../../../lib/utils';
import { useFeedback } from '../../../contexts/FeedbackContext';

export function AdminFinancialReports() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useFeedback();
  
  // Date range filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await financialService.listTransactions({ startDate, endDate });
      setTransactions(data);
    } catch (e) {
      toast('Erro ao carregar relatórios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const stats = useMemo(() => {
    let rawIncome = 0;
    let rawExpense = 0;
    let paidIncome = 0;
    let paidExpense = 0;

    const categoriesIncome: Record<string, number> = {};
    const categoriesExpense: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        rawIncome += t.amount;
        if (t.status === 'paid') paidIncome += t.amount;
        categoriesIncome[t.category] = (categoriesIncome[t.category] || 0) + t.amount;
      } else {
         rawExpense += t.amount;
         if (t.status === 'paid') paidExpense += t.amount;
         categoriesExpense[t.category] = (categoriesExpense[t.category] || 0) + t.amount;
      }
    });

    const incomeArr = Object.entries(categoriesIncome).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const expenseArr = Object.entries(categoriesExpense).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { rawIncome, rawExpense, paidIncome, paidExpense, incomeArr, expenseArr, balancePreview: rawIncome - rawExpense, balanceReal: paidIncome - paidExpense };
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-400">Resumo gerencial de Fluxo de Caixa e Categorias.</p>
        </div>
      </div>

       {/* Date Filter */}
       <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-700 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest bg-slate-950 px-3 py-2 rounded-lg">
             <Calendar size={16} /> Período
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 px-3 border border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-blue-600 text-sm flex-1" />
             <span className="text-slate-400">até</span>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 px-3 border border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-blue-600 text-sm flex-1" />
          </div>
       </div>

       {loading ? (
         <div className="p-12 text-center text-slate-400">Processando relatórios...</div>
       ) : (
         <>
           {/* BIG NUMBERS */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                    <span className="font-bold text-xs uppercase">Receitas Previstas</span>
                    <TrendingUp size={20} className="text-green-500 opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-white">{formatCurrency(stats.rawIncome)}</h2>
                <div className="mt-2 text-xs font-bold text-green-600">Realizado: {formatCurrency(stats.paidIncome)}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                    <span className="font-bold text-xs uppercase">Despesas Previstas</span>
                    <TrendingDown size={20} className="text-red-500 opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-white">{formatCurrency(stats.rawExpense)}</h2>
                <div className="mt-2 text-xs font-bold text-red-600">Realizado: {formatCurrency(stats.paidExpense)}</div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                    <span className="font-bold text-xs uppercase">Saldo Previsto</span>
                    <DollarSign size={20} />
                </div>
                <h2 className={cn("text-2xl font-black", stats.balancePreview >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatCurrency(stats.balancePreview)}
                </h2>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                    <span className="font-bold text-xs uppercase">Saldo Realizado (Caixa)</span>
                    <DollarSign size={20} className="text-blue-400" />
                </div>
                <h2 className={cn("text-2xl font-black", stats.balanceReal >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatCurrency(stats.balanceReal)}
                </h2>
              </div>
           </div>

           {/* CHARTS / TABLES */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Entradas por Categoria */}
              <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 p-6 flex flex-col">
                 <h3 className="text-md font-black uppercase text-white mb-4 flex items-center gap-2"> <TrendingUp size={18} className="text-green-600"/> Entradas por Categoria</h3>
                 <div className="space-y-4 flex-1">
                    {stats.incomeArr.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhum dado no período.</p>}
                    {stats.incomeArr.map(cat => (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-200">{cat.name}</span>
                          <span className="font-bold text-green-600">{formatCurrency(cat.value)}</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (cat.value / stats.rawIncome) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Saidas por Categoria */}
              <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 p-6 flex flex-col">
                 <h3 className="text-md font-black uppercase text-white mb-4 flex items-center gap-2"> <TrendingDown size={18} className="text-red-600"/> Saídas por Categoria</h3>
                 <div className="space-y-4 flex-1">
                    {stats.expenseArr.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhum dado no período.</p>}
                    {stats.expenseArr.map(cat => (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-200">{cat.name}</span>
                          <span className="font-bold text-red-600">{formatCurrency(cat.value)}</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, (cat.value / stats.rawExpense) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
         </>
       )}
    </div>
  );
}
