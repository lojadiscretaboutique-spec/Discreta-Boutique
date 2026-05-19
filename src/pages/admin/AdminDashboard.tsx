import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Package, Users, TrendingUp, AlertCircle, 
  Tag, Store, Activity,
  Flame, Shirt
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { 
  startOfDay, endOfDay, 
  startOfMonth, endOfMonth, subDays, startOfYear, endOfYear, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';

type Period = 'hoje' | 'ontem' | '7dias' | '30dias' | 'mes' | 'ano' | 'tudo';

export function AdminDashboard() {
  const [period, setPeriod] = useState<Period>('hoje');
  const [loading, setLoading] = useState(true);
  
  const theme = (localStorage.getItem('admin-theme') as 'dark' | 'light') || 'dark';
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        let qOrders = collection(db, 'orders');
        
        let start: Date | null = null;
        let end: Date | null = null;
        const now = new Date();

        switch (period) {
          case 'hoje':
            start = startOfDay(now);
            end = endOfDay(now);
            break;
          case 'ontem': {
            const ontem = subDays(now, 1);
            start = startOfDay(ontem);
            end = endOfDay(ontem);
            break;
          }
          case '7dias':
            start = subDays(now, 7);
            end = now;
            break;
          case '30dias':
            start = subDays(now, 30);
            end = now;
            break;
          case 'mes':
            start = startOfMonth(now);
            end = endOfMonth(now);
            break;
          case 'ano':
            start = startOfYear(now);
            end = endOfYear(now);
            break;
        }

        if (start && end) {
          qOrders = query(
            collection(db, 'orders'), 
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          ) as any;
        }

        const [orderSnap, prodSnap, custSnap] = await Promise.all([
          getDocs(qOrders),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'customers'))
        ]);

        const loadedOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filter out CANCELADO manually to avoid composite index requirements
        const validOrders = loadedOrders.filter(o => o.status !== 'CANCELADO');
        
        setOrders(validOrders);
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCustomersCount(custSnap.size);

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [period]);

  // Derived metrics
  const metrics = useMemo(() => {
    let revenue = 0;
    let pdvRevenue = 0;
    let onlineRevenue = 0;
    let pdvCount = 0;
    let onlineCount = 0;
    let totalItems = 0;
    
    const itemsSold: Record<string, { name: string, qty: number, revenue: number }> = {};
    const salesByDate: Record<string, { total: number, timestamp: number }> = {};

    orders.forEach(o => {
      const orderTotal = o.total || 0;
      revenue += orderTotal;
      
      const type = (o.type || 'pdv').toLowerCase();
      if (type === 'pdv') {
        pdvRevenue += orderTotal;
        pdvCount++;
      } else {
        onlineRevenue += orderTotal;
        onlineCount++;
      }
      
      // Items
      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          totalItems += (item.quantity || 1);
          if (!itemsSold[item.productId]) {
            itemsSold[item.productId] = { name: item.name, qty: 0, revenue: 0 };
          }
          itemsSold[item.productId].qty += (item.quantity || 1);
          itemsSold[item.productId].revenue += (item.price * (item.quantity || 1));
        });
      }
      
      // Chart data grouping
      if (o.createdAt?.toDate) {
        const dateObj = o.createdAt.toDate();
        let dateStr = '';
        if (['hoje', 'ontem'].includes(period)) {
          dateStr = format(dateObj, 'HH:00');
        } else {
          dateStr = format(dateObj, 'dd/MMM', { locale: ptBR });
        }
        if (!salesByDate[dateStr]) {
          salesByDate[dateStr] = { total: 0, timestamp: dateObj.getTime() };
        }
        salesByDate[dateStr].total += orderTotal;
      }
    });

    const topSelling = Object.values(itemsSold)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const chartData = Object.entries(salesByDate)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([date, data]) => ({ date, total: data.total }));
    
    // Low stock
    const lowStock = products.filter(p => (p.stock || 0) <= 5 && p.active !== false)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 5);

    return {
      revenue,
      orderCount: orders.length,
      ticketMedio: orders.length > 0 ? revenue / orders.length : 0,
      pdvRevenue,
      onlineRevenue,
      pdvCount,
      onlineCount,
      totalItems,
      topSelling,
      chartData,
      lowStock
    };
  }, [orders, products, period]);

  const pieData = [
    { name: 'Loja Física (PDV)', value: metrics.pdvRevenue },
    { name: 'Loja Online', value: metrics.onlineRevenue },
  ].filter(d => d.value > 0);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20 p-4 lg:p-0">
      <header className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200 shadow-xl shadow-slate-200/50")}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-red-50 dark:bg-red-900/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className={cn("text-2xl font-black uppercase italic tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>Dashboard Inteligente</h1>
          <p className={cn("text-sm font-medium max-w-sm", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>Métricas, análise de vendas e gestão estratégica para sua boutique.</p>
        </div>
        
        {/* Period Selector */}
        <div className={cn("flex p-1.5 rounded-full border shadow-inner overflow-x-auto w-full md:w-auto relative z-10 hide-scrollbar scroll-smooth transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")}>
          {(
            [
              ['hoje', 'Hoje'],
              ['ontem', 'Ontem'],
              ['7dias', '7 Dias'],
              ['30dias', '30 Dias'],
              ['mes', 'Mês'],
              ['ano', 'Ano'],
              ['tudo', 'Tudo']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key as Period)}
              className={cn(
                "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                period === key 
                  ? "bg-red-600 text-white shadow-md shadow-red-600/20" 
                  : (theme === 'dark' ? "text-slate-400 hover:text-slate-100 hover:bg-slate-700" : "text-slate-500 hover:text-slate-900 hover:bg-white")
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className={cn("flex flex-col items-center justify-center py-32 gap-4 rounded-3xl border shadow-sm transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
          <Activity className="animate-pulse text-red-600" size={40} />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Analisando Dados Estratégicos...</span>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 w-full">
          
          {/* Main KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <MetricCard 
               title="Faturamento Bruto" 
               value={formatCurrency(metrics.revenue)} 
               icon={TrendingUp} 
               subtitle={`${metrics.orderCount} vendas no período`}
               color="text-green-600" bg="bg-green-50"
               theme={theme}
             />
             <MetricCard 
               title="Ticket Médio" 
               value={formatCurrency(metrics.ticketMedio)} 
               icon={Tag} 
               subtitle={`Media geral por pedido`}
               color="text-blue-600" bg="bg-blue-50"
               theme={theme}
             />
             <MetricCard 
               title="Mix de Produtos" 
               value={metrics.totalItems.toString()} 
               icon={Package} 
               subtitle={`Unidades vendidas`}
               color="text-purple-600" bg="bg-purple-50"
               theme={theme}
             />
             <MetricCard 
               title="Base de Clientes" 
               value={customersCount.toString()} 
               icon={Users} 
               subtitle={`Cadastrados no sistema`}
               color="text-orange-600" bg="bg-orange-50"
               theme={theme}
             />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Area */}
            <div className={cn("lg:col-span-2 rounded-3xl p-6 border shadow-sm flex flex-col relative overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
               <div className="flex items-center justify-between mb-6 relative z-10">
                  <div>
                    <h3 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Evolução de Faturamento</h3>
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Desempenho financeiro no período</p>
                  </div>
               </div>
               <div className="flex-1 h-[300px] w-full relative z-10">
                  {metrics.chartData.length > 0 ? (
                    <ResponsiveContainer width="99%" height={300}>
                      <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val}`} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                        <RechartsTooltip 
                           formatter={(value: any) => [formatCurrency(value), 'Faturamento']}
                           contentStyle={{ 
                             borderRadius: '16px', 
                             border: 'none', 
                             boxShadow: '0 4px 20px rgba(0,0,0,0.1)', 
                             fontWeight: 'bold',
                             backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
                             color: theme === 'dark' ? '#fff' : '#000'
                           }}
                           cursor={{ stroke: theme === 'dark' ? '#334155' : '#f1f5f9', strokeWidth: 2 }}
                        />
                        <Area type="monotone" dataKey="total" stroke="#dc2626" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={cn("flex items-center justify-center h-full text-[10px] font-black uppercase tracking-widest rounded-2xl border", theme === 'dark' ? "text-slate-400 bg-slate-800 border-slate-700" : "text-slate-500 bg-slate-50 border-slate-100")}>
                       Sem dados suficientes para gerar gráfico neste período
                    </div>
                  )}
               </div>
            </div>

            {/* Sales Channel Pie Chart */}
            <div className={cn("rounded-3xl p-6 border shadow-sm flex flex-col relative overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
               <div className="relative z-10">
                  <h3 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Canais de Receita</h3>
                  <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Origem de vendas</p>
               </div>
               <div className="flex-1 h-[200px] w-full mt-6 relative flex items-center justify-center z-10">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="99%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? (theme === 'dark' ? '#ffffff' : '#0f172a') : '#dc2626'} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: any) => formatCurrency(value)} 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)', 
                            fontWeight: 'bold',
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#fff'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-12 block text-center">Sem dados</span>
                  )}
                  {pieData.length > 0 && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <Store size={24} className={cn("mb-1", theme === 'dark' ? "text-slate-300" : "text-slate-500")} />
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distribuição</span>
                     </div>
                  )}
               </div>
               {pieData.length > 0 && (
                 <div className={cn("flex flex-col gap-3 mt-4 relative z-10 p-4 rounded-2xl border transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                   {pieData.map((d, i) => (
                     <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: i === 0 ? (theme === 'dark' ? '#ffffff' : '#0f172a') : '#dc2626' }} />
                         <span className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-300" : "text-slate-600")}>{d.name}</span>
                       </div>
                       <span className={cn("text-xs font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>{formatCurrency(d.value)}</span>
                     </div>
                   ))}
                 </div>
               )}
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Top Selling Products */}
             <div className={cn("rounded-3xl p-6 border shadow-sm relative overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-50 dark:bg-red-900/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
                <div className="flex items-center gap-4 mb-6 relative z-10">
                   <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                      <Flame size={24} />
                   </div>
                   <div>
                     <h3 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Top Produtos</h3>
                     <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">As 5 estrelas de vendas</p>
                   </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                   {metrics.topSelling.length > 0 ? metrics.topSelling.map((item, i) => (
                     <div key={i} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-colors group", theme === 'dark' ? "bg-slate-800 border-slate-700 hover:bg-slate-950" : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md")}>
                        <div className="flex items-center gap-4 overflow-hidden">
                           <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border shrink-0 shadow-sm transition-colors", theme === 'dark' ? "bg-slate-900 text-slate-400 border-slate-700 group-hover:border-red-200 group-hover:text-red-600" : "bg-white text-slate-400 border-slate-200 group-hover:border-red-500 group-hover:text-red-600")}>
                              #{i+1}
                           </div>
                           <span className={cn("text-xs font-black truncate", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>{item.name}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 pl-4">
                           <span className={cn("text-xs font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>{item.qty} un</span>
                           <span className="text-[10px] font-bold text-slate-400">{formatCurrency(item.revenue)}</span>
                        </div>
                     </div>
                   )) : (
                     <div className={cn("text-center py-10 rounded-2xl border text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500")}>
                       Nenhuma venda no período
                     </div>
                   )}
                </div>
             </div>

             {/* Low Stock Alerts */}
             <div className={cn("rounded-3xl p-6 border shadow-sm relative overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-orange-50 dark:bg-orange-900/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
                <div className="flex items-center gap-4 mb-6 relative z-10">
                   <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                      <AlertCircle size={24} />
                   </div>
                   <div>
                     <h3 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Radar de Estoque</h3>
                     <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Itens esgotando ou esgotados</p>
                   </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                   {metrics.lowStock.length > 0 ? metrics.lowStock.map((prod, i) => (
                     <div key={i} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-colors", theme === 'dark' ? "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20" : "bg-orange-50 border-orange-100 hover:bg-orange-100/50")}>
                        <div className="flex items-center gap-4 overflow-hidden">
                           <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm", theme === 'dark' ? "bg-slate-900 border-orange-500/30" : "bg-white border-orange-200")}>
                              <Shirt size={14} className="text-orange-500" />
                           </div>
                           <div className="flex flex-col truncate">
                              <span className={cn("text-xs font-black truncate", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>{prod.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">{prod.sku}</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-center shrink-0 pl-4">
                           <span className={cn(
                             "px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-sm",
                             prod.stock === 0 ? "bg-red-500 text-white" : "bg-orange-100 text-orange-700"
                           )}>
                              {prod.stock === 0 ? 'ZeradO' : `${prod.stock} un`}
                           </span>
                        </div>
                     </div>
                   )) : (
                     <div className={cn("text-center py-10 rounded-2xl border text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500")}>
                       Estatuto de Estoque Excelente
                     </div>
                   )}
                </div>
             </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}

function MetricCard({ title, value, icon: Icon, subtitle, color, bg, theme }: any) {
  return (
    <div className={cn("p-6 rounded-3xl border shadow-sm flex flex-col justify-between group transition-all relative overflow-hidden", theme === 'dark' ? "bg-slate-900 border-slate-700 hover:border-slate-600" : "bg-white border-slate-200 hover:border-red-200 shadow-xl shadow-slate-200/30")}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm", bg, color)}>
          <Icon size={20} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
        <h3 className={cn("text-3xl font-black tracking-tighter tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>{value}</h3>
        {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}
