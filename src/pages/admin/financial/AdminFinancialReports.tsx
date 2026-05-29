import { useEffect, useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { financialService, FinancialTransaction } from '../../../services/financialService';
import { formatCurrency, cn } from '../../../lib/utils';
import { useFeedback } from '../../../contexts/FeedbackContext';

export function AdminFinancialReports() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [orderMetrics, setOrderMetrics] = useState({ 
    totalCost: 0, 
    totalSalesFromOrders: 0,
    productPerformance: [] as { name: string; sku: string; qty: number; revenue: number; cost: number; profit: number }[]
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useFeedback();

  // Date range filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of current month
    return d.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Financial Transactions
      const data = await financialService.listTransactions({ startDate, endDate });
      setTransactions(data);

      // 2. Load Orders using date range query
      const { collection, getDocs, query, orderBy, where, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase');
      
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

      // Try date range query. If it fails (index missing), fallback to simple query
      let orderSnap;
      try {
        const qRange = query(
          collection(db, 'orders'), 
          where('createdAt', '>=', Timestamp.fromDate(start)),
          where('createdAt', '<=', Timestamp.fromDate(end)),
          orderBy('createdAt', 'desc')
        );
        orderSnap = await getDocs(qRange);
      } catch (err) {
        console.warn("Index missing for date range, falling back to 1000 last orders", err);
        const qSimple = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), (await import('firebase/firestore')).limit(1000));
        orderSnap = await getDocs(qSimple);
      }

      // FALLBACK COGS: If some items don't have costPrice (old orders), 
      // we try to use the CURRENT cost price from product collection.
      const productSnap = await getDocs(collection(db, 'products'));
      const currentProductCosts: Record<string, number> = {};
      const currentVariantCosts: Record<string, number> = {};

      productSnap.docs.forEach(pDoc => {
        const pData = pDoc.data();
        if (typeof pData.costPrice === 'number') currentProductCosts[pDoc.id] = pData.costPrice;
      });

      // Special fetch for all variants might be too much, but let's at least get main products
      
      let totalCost = 0;
      let totalSalesFromOrders = 0;
      const productMap: Record<string, { name: string; sku: string; qty: number; revenue: number; cost: number }> = {};

      orderSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (!d.createdAt) return;

        const date = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        
        // Only if date matches and not cancelled
        if (date >= start && date <= end && d.status !== 'CANCELADO') {
            totalSalesFromOrders += d.total || 0;
            const items = d.items || [];
            items.forEach((item: any) => {
               const qty = item.quantity || 0;
               const price = item.price || 0;
               
               // Try order snapshot first, then global product fallback
               let cost = 0;
               if (typeof item.costPrice === 'number') {
                 cost = item.costPrice;
               } else if (item.productId && typeof currentProductCosts[item.productId] === 'number') {
                 cost = currentProductCosts[item.productId];
               }
               
               const itemTotalCost = (cost * qty);
               const itemTotalRevenue = (price * qty);
               
               totalCost += itemTotalCost;

               const key = `${item.productId || 'unknown'}_${item.variantId || 'base'}`;
               if (!productMap[key]) {
                  productMap[key] = {
                    name: item.name,
                    sku: item.sku || 'N/A',
                    qty: 0,
                    revenue: 0,
                    cost: 0
                  };
               }
               productMap[key].qty += qty;
               productMap[key].revenue += itemTotalRevenue;
               productMap[key].cost += itemTotalCost;
            });
        }
      });

      const productPerformance = Object.values(productMap).map(p => ({
        ...p,
        profit: p.revenue - p.cost
      })).sort((a, b) => b.profit - a.profit);

      setOrderMetrics({ totalCost, totalSalesFromOrders, productPerformance });

    } catch (e) {
      console.error(e);
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

    // INTELLIGENT PROFIT CALCULATION
    // Gross Profit = Sales Income - Cost of Goods Sold
    const grossProfit = rawIncome - orderMetrics.totalCost;
    
    // Net Profit logic:
    // To avoid double counting, a truly "intelligent" report for performance 
    // should use Revenue - (CMV + Operating Expenses).
    // Operating Expenses = Expenses that are NOT inventory purchases.
    const inventoryPurchaseCategories = ['Mercadorias para Revenda', 'Fornecedores', 'Compra de Estoque'];
    const operatingExpenses = transactions
      .filter(t => t.type === 'expense' && !inventoryPurchaseCategories.includes(t.category))
      .reduce((acc, t) => acc + t.amount, 0);

    const netProfitAccounting = rawIncome - (orderMetrics.totalCost + operatingExpenses);
    const netProfitCashFlow = rawIncome - rawExpense;

    return { 
      rawIncome, 
      rawExpense, 
      paidIncome, 
      paidExpense, 
      incomeArr, 
      expenseArr, 
      balancePreview: rawIncome - rawExpense, 
      balanceReal: paidIncome - paidExpense,
      totalCost: orderMetrics.totalCost,
      grossProfit,
      netProfit: netProfitAccounting,
      netProfitCashFlow,
      grossMargin: rawIncome > 0 ? (grossProfit / rawIncome) * 100 : 0
    };
  }, [transactions, orderMetrics]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-400">Visão panorâmica de rentabilidade, custos e fluxo de caixa.</p>
        </div>
      </div>

       {/* Date Filter */}
       <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-700 flex flex-col sm:flex-row items-center gap-4 transition-all">
          <div className="flex items-center gap-2 text-red-500 font-black uppercase text-[10px] tracking-widest bg-red-950/20 px-3 py-2 rounded-lg border border-red-900/30">
             <Calendar size={14} /> Filtrar Período
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 px-4 bg-slate-950 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-sm text-white flex-1 transition-all" />
             <span className="text-slate-500 font-bold text-xs">ATÉ</span>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 px-4 bg-slate-950 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-sm text-white flex-1 transition-all" />
          </div>
       </div>

       {loading ? (
         <div className="p-12 text-center text-slate-400 animate-pulse flex flex-col items-center gap-4">
           <div className="w-12 h-12 rounded-full border-2 border-red-600 border-t-transparent animate-spin"></div>
           <span className="font-bold text-xs uppercase tracking-tighter">Processando inteligência financeira...</span>
         </div>
       ) : (
         <>
           {/* PROFIT MARGINS - NEW SECTION */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingDown size={120} />
                 </div>
                 <div className="flex justify-between items-center text-slate-500 mb-2 relative z-10">
                    <span className="font-black text-[10px] uppercase tracking-widest">Custo de Mercadoria (CMV)</span>
                    <div className="bg-red-900/40 text-red-400 p-1.5 rounded-lg"><TrendingDown size={14}/></div>
                 </div>
                 <h2 className="text-3xl font-black text-white relative z-10">{formatCurrency(stats.totalCost)}</h2>
                 <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">Total investido em produtos vendidos</p>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp size={120} />
                 </div>
                 <div className="flex justify-between items-center text-slate-500 mb-2 relative z-10">
                    <span className="font-black text-[10px] uppercase tracking-widest">Lucro Bruto</span>
                    <div className="bg-green-900/40 text-green-400 p-1.5 rounded-lg"><TrendingUp size={14}/></div>
                 </div>
                 <h2 className="text-3xl font-black text-white relative z-10">{formatCurrency(stats.grossProfit)}</h2>
                 <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-black">{stats.grossMargin.toFixed(1)}% Margem</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Lucro sem despesas fixas</p>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-red-600/10 to-transparent p-6 rounded-3xl shadow-xl border border-red-500/20 relative overflow-hidden group ring-1 ring-red-500/10">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DollarSign size={120} />
                 </div>
                 <div className="flex justify-between items-center text-red-500 mb-2 relative z-10">
                    <span className="font-black text-[10px] uppercase tracking-widest">Lucro Líquido Real</span>
                    <div className="bg-red-500 text-white p-1.5 rounded-lg shadow-lg shadow-red-500/20"><DollarSign size={14}/></div>
                 </div>
                 <h2 className={cn("text-3xl font-black relative z-10", stats.netProfit >= 0 ? "text-green-400" : "text-red-400")}>
                    {formatCurrency(stats.netProfit)}
                 </h2>
                 <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">Resultado final (Receita - Custos - Despesas)</p>
              </div>
           </div>

           {/* BIG NUMBERS */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                 <div className="flex justify-between items-center text-slate-500 mb-2">
                     <span className="font-black text-[9px] uppercase tracking-widest">Faturamento Total</span>
                     <TrendingUp size={16} className="text-green-500 opacity-50" />
                 </div>
                 <h2 className="text-xl font-black text-white">{formatCurrency(stats.rawIncome)}</h2>
                 <div className="mt-2 text-[9px] font-black text-green-600 uppercase">Realizado: {formatCurrency(stats.paidIncome)}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                 <div className="flex justify-between items-center text-slate-500 mb-2">
                     <span className="font-black text-[9px] uppercase tracking-widest">Total Despesas</span>
                     <TrendingDown size={16} className="text-red-500 opacity-50" />
                 </div>
                 <h2 className="text-xl font-black text-white">{formatCurrency(stats.rawExpense)}</h2>
                 <div className="mt-2 text-[9px] font-black text-red-600 uppercase">Pago: {formatCurrency(stats.paidExpense)}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                 <div className="flex justify-between items-center text-slate-500 mb-2">
                     <span className="font-black text-[9px] uppercase tracking-widest">Fluxo Mensal</span>
                     <DollarSign size={16} className="text-slate-500 opacity-30" />
                 </div>
                 <h2 className={cn("text-xl font-black", stats.balancePreview >= 0 ? "text-green-400" : "text-red-400")}>
                   {formatCurrency(stats.balancePreview)}
                 </h2>
                 <div className="mt-2 text-[9px] font-black text-slate-500 uppercase tracking-tighter">Previsto no período</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                 <div className="flex justify-between items-center text-slate-500 mb-2">
                     <span className="font-black text-[9px] uppercase tracking-widest">Saldo Disponível</span>
                     <DollarSign size={16} className="text-blue-400 opacity-40" />
                 </div>
                 <h2 className={cn("text-xl font-black", stats.balanceReal >= 0 ? "text-green-400" : "text-red-400")}>
                   {formatCurrency(stats.balanceReal)}
                 </h2>
                 <div className="mt-2 text-[9px] font-black text-blue-500 uppercase tracking-tighter tracking-widest">Lançado no Caixa</div>
              </div>
           </div>

           {/* Product Performance Table */}
           <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden mb-6">
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-md font-black uppercase text-white flex items-center gap-2"> 
                  <TrendingUp size={18} className="text-red-600"/> Desempenho de Produtos e CMV
                </h3>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold">Baseado em {orderMetrics.productPerformance.length} produtos vendidos no período</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Produto</th>
                      <th className="px-6 py-4 text-center">Qtd</th>
                      <th className="px-6 py-4 text-right">Receita</th>
                      <th className="px-6 py-4 text-right">Custo (CMV)</th>
                      <th className="px-6 py-4 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orderMetrics.productPerformance.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200">{p.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-400">{p.qty}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-200">{formatCurrency(p.revenue)}</td>
                        <td className="px-6 py-4 text-right font-bold text-red-500 bg-red-950/10">{formatCurrency(p.cost)}</td>
                        <td className="px-6 py-4 text-right font-black text-green-500">{formatCurrency(p.profit)}</td>
                      </tr>
                    ))}
                    {orderMetrics.productPerformance.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                          Nenhum produto vendido no período selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
