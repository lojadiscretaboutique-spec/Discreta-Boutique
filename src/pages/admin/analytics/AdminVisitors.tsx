import { useEffect, useState, useMemo } from 'react';
import { 
  getDocs, 
  collection, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Users, 
  Tv, 
  Share2, 
  MapPin, 
  Layers, 
  Calendar, 
  BarChart2, 
  Clock, 
  RefreshCw, 
  Eye, 
  UserCheck, 
  Smartphone, 
  Laptop, 
  Tablet,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  isWithinInterval, 
  format, 
  parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';
import { analyticsService, VisitorSession, PageView } from '../../../services/analyticsService';

type FilterPeriod = 'hoje' | 'ontem' | '7dias' | '30dias' | 'mes' | 'ano' | 'tudo' | 'custom';
type ChartViewMode = 'dia' | 'semana' | 'mes';

export function AdminVisitors() {
  const [period, setPeriod] = useState<FilterPeriod>('7dias');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState<ChartViewMode>('dia');

  // Page view and session raw buffers
  const [allSessions, setAllSessions] = useState<VisitorSession[]>([]);
  const [allPageViews, setAllPageViews] = useState<PageView[]>([]);

  // Real-time online counters (updates automatically every 30s)
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlineAnon, setOnlineAnon] = useState(0);
  const [onlineAuth, setOnlineAuth] = useState(0);

  // Pagination states for visual lists
  const [pageViewsCurrentPage, setPageViewsCurrentPage] = useState(1);
  const [locationsCurrentPage, setLocationsCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Load and refresh logs
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // 5-minute active window for live visitors counter
      const snapshot = await analyticsService.getAggregatedStats();
      setAllSessions(snapshot.sessions);
      setAllPageViews(snapshot.pageViews);
      setOnlineTotal(snapshot.activeOnline);
      setOnlineAnon(snapshot.activeOnlineAnon);
      setOnlineAuth(snapshot.activeOnlineAuth);
    } catch (e) {
      console.error("Error retrieving visitor statistics:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-update online list every 30 seconds
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filter sessions and pageviews based on selected period
  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (period) {
      case 'hoje':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'ontem': {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
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
      case 'custom':
        if (customStart && customEnd) {
          start = startOfDay(parseISO(customStart));
          end = endOfDay(parseISO(customEnd));
        }
        break;
      case 'tudo':
      default:
        start = null;
        end = null;
        break;
    }

    const testInterval = (date: Date) => {
      if (!start || !end) return true;
      return isWithinInterval(date, { start, end });
    };

    const sessions = allSessions.filter(s => testInterval(new Date(s.createdAt)));
    const pageViews = allPageViews.filter(pv => testInterval(new Date(pv.timestamp)));

    return { sessions, pageViews };
  }, [period, customStart, customEnd, allSessions, allPageViews]);

  // Overall statistics cards calculations (all-time, today, etc.)
  const summaryCounters = useMemo(() => {
    const now = new Date();
    
    const countSessionsForInterval = (start: Date, end: Date) => {
      return allSessions.filter(s => isWithinInterval(new Date(s.createdAt), { start, end })).length;
    };

    const hojeStart = startOfDay(now);
    const hojeEnd = endOfDay(now);
    const ontemStart = startOfDay(subDays(now, 1));
    const ontemEnd = endOfDay(subDays(now, 1));

    return {
      hoje: countSessionsForInterval(hojeStart, hojeEnd),
      ontem: countSessionsForInterval(ontemStart, ontemEnd),
      ultimos7dias: countSessionsForInterval(subDays(now, 7), now),
      esteMes: countSessionsForInterval(startOfMonth(now), endOfMonth(now)),
      esteAno: countSessionsForInterval(startOfYear(now), endOfYear(now)),
      totalHistorico: allSessions.length
    };
  }, [allSessions]);

  // Chart data building: visits by day, week, month
  const chartData = useMemo(() => {
    const { sessions } = filteredData;
    const groups: { [key: string]: number } = {};

    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      let groupKey = '';

      if (chartMode === 'dia') {
        groupKey = format(date, 'yyyy-MM-dd');
      } else if (chartMode === 'semana') {
        // Simple week identifier
        const weekNum = format(date, 'I', { locale: ptBR });
        groupKey = `Semana ${weekNum} (${format(date, 'MMM', { locale: ptBR })})`;
      } else {
        groupKey = format(date, 'yyyy-MM');
      }

      groups[groupKey] = (groups[groupKey] || 0) + 1;
    });

    // Convert to sorted array
    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map(key => {
      let displayName = key;
      if (chartMode === 'dia') {
        displayName = format(parseISO(key), 'dd/MM');
      } else if (chartMode === 'semana') {
        displayName = key;
      } else {
        displayName = format(parseISO(key + '-01'), 'MMMM/yy', { locale: ptBR });
      }

      return {
        name: displayName,
        Visitas: groups[key]
      };
    });
  }, [filteredData, chartMode]);

  // Traffic / Referral source splits
  const referralSources = useMemo(() => {
    const { sessions } = filteredData;
    const sources: { [key: string]: number } = {};
    let total = 0;

    sessions.forEach(s => {
      const src = s.source || 'Direto';
      sources[src] = (sources[src] || 0) + 1;
      total++;
    });

    const list = Object.keys(sources).map(key => ({
      name: key,
      count: sources[key],
      percentage: total > 0 ? Math.round((sources[key] / total) * 100) : 0
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Page view counts
  const pageViewRanking = useMemo(() => {
    const { pageViews } = filteredData;
    const views: { [key: string]: { title: string; count: number } } = {};

    pageViews.forEach(pv => {
      const pathClean = pv.path.split('?')[0]; // aggregate same pages together
      if (!views[pathClean]) {
        views[pathClean] = { title: pv.title, count: 0 };
      }
      views[pathClean].count++;
    });

    const list = Object.keys(views).map(path => ({
      url: path,
      title: views[path].title,
      count: views[path].count
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Paginated elements for pages and locations list
  const paginatedPageViews = useMemo(() => {
    const offset = (pageViewsCurrentPage - 1) * itemsPerPage;
    return pageViewRanking.slice(offset, offset + itemsPerPage);
  }, [pageViewRanking, pageViewsCurrentPage]);

  // Device categories mapping list
  const deviceDistribution = useMemo(() => {
    const { sessions } = filteredData;
    let desktop = 0;
    let mobile = 0;
    let tablet = 0;
    let total = 0;

    sessions.forEach(s => {
      if (s.device === 'Mobile') mobile++;
      else if (s.device === 'Tablet') tablet++;
      else desktop++;
      total++;
    });

    return [
      { name: 'Desktop', count: desktop, percentage: total > 0 ? Math.round((desktop / total) * 100) : 0, icon: Laptop, color: '#f43f5e' },
      { name: 'Celular', count: mobile, percentage: total > 0 ? Math.round((mobile / total) * 100) : 0, icon: Smartphone, color: '#ec4899' },
      { name: 'Tablet', count: tablet, percentage: total > 0 ? Math.round((tablet / total) * 100) : 0, icon: Tablet, color: '#a855f7' }
    ].sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Geolocation locations aggregated (restricted IP representation)
  const locationStats = useMemo(() => {
    const { sessions } = filteredData;
    const cities: { [key: string]: { count: number; region: string; country: string } } = {};

    sessions.forEach(s => {
      const city = s.city || 'Desconhecido';
      const region = s.regionName || 'Desconhecido';
      const country = s.country || 'Brasil';
      const key = `${city} - ${region}`;

      if (!cities[key]) {
        cities[key] = { count: 0, region, country };
      }
      cities[key].count++;
    });

    const list = Object.keys(cities).map(key => {
      const parts = key.split(' - ');
      return {
        city: parts[0],
        state: cities[key].region,
        country: cities[key].country,
        count: cities[key].count
      };
    });

    return list.sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const paginatedLocations = useMemo(() => {
    const offset = (locationsCurrentPage - 1) * itemsPerPage;
    return locationStats.slice(offset, offset + itemsPerPage);
  }, [locationStats, locationsCurrentPage]);

  // Total pages count
  const pageViewsTotalPages = Math.ceil(pageViewRanking.length / itemsPerPage);
  const locationsTotalPages = Math.ceil(locationStats.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-rose-500 tracking-tight flex items-center gap-2">
            <BarChart2 className="w-8 h-8 text-rose-600 animate-pulse" />
            Analytics de Visitantes
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Monitoramento em tempo real de acessos, canais e engajamento da Discreta Boutique.
          </p>
        </div>

        <button 
          onClick={() => loadData()}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/20 text-rose-400 border border-rose-900/30 font-bold text-sm rounded-xl hover:bg-rose-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* Online Now Indicator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Online Active */}
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/30 to-black/40 border border-rose-900/20 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Ao Vivo</span>
          </div>
          <div>
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Total Online Agora</span>
            <span className="text-5xl font-black text-white block mt-2 font-mono">{onlineTotal}</span>
            <span className="text-xs text-zinc-500 block mt-1">Interação nos últimos 5 minutos</span>
          </div>
          <div className="p-4 bg-rose-500/10 rounded-full border border-rose-500/25">
            <Users className="w-8 h-8 text-rose-500" />
          </div>
        </div>

        {/* Client Logged-in count */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block font-sans">Clientes Autenticados</span>
            <span className="text-4xl font-black text-white block mt-2 font-mono">{onlineAuth}</span>
            <span className="text-xs text-emerald-500 flex items-center gap-1 mt-1 font-medium">
              <UserCheck className="w-3.5 h-3.5 inline" /> Logados na Área do Cliente
            </span>
          </div>
          <div className="p-3 bg-zinc-800/80 rounded-xl">
            <UserCheck className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Guest visitors counter */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Visitantes Anônimos</span>
            <span className="text-4xl font-black text-white block mt-2 font-mono">{onlineAnon}</span>
            <span className="text-xs text-zinc-500 block mt-1">Navegando no catálogo público</span>
          </div>
          <div className="p-3 bg-zinc-800/80 rounded-xl">
            <Eye className="w-6 h-6 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Main Access Stats (Historical context) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
        <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-rose-500" />
          Volume de Visitas (Histórico Completo)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Hoje', value: summaryCounters.hoje, ringColor: 'border-rose-900/30' },
            { label: 'Ontem', value: summaryCounters.ontem, ringColor: 'border-zinc-800' },
            { label: 'Últimos 7 dias', value: summaryCounters.ultimos7dias, ringColor: 'border-zinc-800' },
            { label: 'Este Mês', value: summaryCounters.esteMes, ringColor: 'border-zinc-800' },
            { label: 'Este Ano', value: summaryCounters.esteAno, ringColor: 'border-zinc-800' },
            { label: 'Total Geral', value: summaryCounters.totalHistorico, ringColor: 'border-emerald-900/20 text-emerald-400' }
          ].map((card, idx) => (
            <div key={idx} className={`p-4 border ${card.ringColor} bg-zinc-900/20 rounded-xl text-center`}>
              <span className="text-[10px] text-zinc-500 font-bold uppercase block tracking-wider">{card.label}</span>
              <span className="text-2xl font-black text-white block mt-1 font-mono">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and chart block */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
        {/* Filters bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-900 pb-5 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'hoje', name: 'Hoje' },
              { id: 'ontem', name: 'Ontem' },
              { id: '7dias', name: '7 dias' },
              { id: '30dias', name: '30 dias' },
              { id: 'mes', name: 'Este Mês' },
              { id: 'ano', name: 'Este Ano' },
              { id: 'tudo', name: 'Histórico' },
              { id: 'custom', name: 'Especial' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setPeriod(btn.id as FilterPeriod)}
                className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-all ${
                  period === btn.id 
                    ? 'bg-rose-600 text-white' 
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {btn.name}
              </button>
            ))}
          </div>

          {/* Custom Date Form */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 self-start lg:self-auto">
              <input 
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-white focus:ring-0 p-1 cursor-pointer"
              />
              <span className="text-zinc-600 text-[10px] font-bold">ATÉ</span>
              <input 
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-white focus:ring-0 p-1 cursor-pointer"
              />
            </div>
          )}

          {/* Chart granularity switch */}
          <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800 self-start lg:self-auto">
            {[
              { id: 'dia', name: 'Diário' },
              { id: 'semana', name: 'Semanal' },
              { id: 'mes', name: 'Mensal' }
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setChartMode(v.id as ChartViewMode)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartMode === v.id 
                    ? 'bg-zinc-800 text-white border border-zinc-700/50' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chart View */}
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-rose-500" />
          Gráfico de Audiência ({chartMode === 'dia' ? 'Visitas por Dia' : chartMode === 'semana' ? 'Visitas por Semana' : 'Visitas por Mês'})
        </h4>
        <div className="h-72 w-full mt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    borderColor: '#27272a', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Visitas" 
                  stroke="#f43f5e" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorVisits)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs">
              Nenhuma visita registrada no período selecionado.
            </div>
          )}
        </div>
      </div>

      {/* Referrals & Devices Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origin / Referrals */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Share2 className="w-4 h-4 text-rose-500" />
            Origem de Tráfego (Canais)
          </h3>
          <div className="space-y-4">
            {referralSources.length > 0 ? (
              referralSources.map((source, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-400">{source.name}</span>
                    <span className="font-bold text-white font-mono">
                      {source.count} visitas <span className="text-zinc-500">({source.percentage}%)</span>
                    </span>
                  </div>
                  {/* Progress bar container */}
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 text-xs text-center py-6">Nenhum dado de origem encontrado.</p>
            )}
          </div>
        </div>

        {/* Device Splits */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Tv className="w-4 h-4 text-rose-500" />
            Dispositivos de Acesso
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full items-center">
            {deviceDistribution.some(d => d.count > 0) ? (
              deviceDistribution.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={idx} className="p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl text-center space-y-2 flex flex-col items-center justify-center">
                    <div className="p-2.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                      <IconComponent className="w-5 h-5 text-rose-400" />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 block">{item.name}</span>
                    <span className="text-xl font-black text-white font-mono block leading-none">{item.percentage}%</span>
                    <span className="text-[10px] text-zinc-500 block">{item.count} acessos</span>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-zinc-600 text-xs text-center py-6">Nenhum dispositivo mapeado.</div>
            )}
          </div>
        </div>
      </div>

      {/* Pages table and mapping locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Visited Pages */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex flex-col">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-rose-500" />
            Páginas Mais Visitadas
          </h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 uppercase font-black text-[10px] tracking-wider">
                  <th className="py-2.5 px-2">Página (URL)</th>
                  <th className="py-2.5 px-2">Título</th>
                  <th className="py-2.5 px-2 text-right">Visualizações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPageViews.length > 0 ? (
                  paginatedPageViews.map((page, idx) => (
                    <tr key={idx} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/20">
                      <td className="py-3 px-2 font-mono text-[11px] text-zinc-400 font-medium truncate max-w-[180px]" title={page.url}>
                        {page.url}
                      </td>
                      <td className="py-3 px-2 text-zinc-300 font-semibold truncate max-w-[150px]" title={page.title}>
                        {page.title}
                      </td>
                      <td className="py-3 px-2 text-right font-black text-white font-mono">
                        {page.count}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-600">
                      Nenhuma visualização regisrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pages Pagination */}
          {pageViewsTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-auto">
              <span className="text-[10px] text-zinc-500">
                Pág {pageViewsCurrentPage} de {pageViewsTotalPages}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={pageViewsCurrentPage === 1}
                  onClick={() => setPageViewsCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={pageViewsCurrentPage === pageViewsTotalPages}
                  onClick={() => setPageViewsCurrentPage(p => Math.min(pageViewsTotalPages, p + 1))}
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Locations */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex flex-col">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-rose-500" />
            Localização dos Visitantes
          </h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 uppercase font-black text-[10px] tracking-wider">
                  <th className="py-2.5 px-2">Cidade</th>
                  <th className="py-2.5 px-2">Estado</th>
                  <th className="py-2.5 px-2">País</th>
                  <th className="py-2.5 px-2 text-right">Acessos</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLocations.length > 0 ? (
                  paginatedLocations.map((loc, idx) => (
                    <tr key={idx} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/20">
                      <td className="py-3 px-2 text-zinc-300 font-bold">{loc.city}</td>
                      <td className="py-3 px-2 text-zinc-400 font-semibold">{loc.state}</td>
                      <td className="py-3 px-2 text-zinc-500">{loc.country}</td>
                      <td className="py-3 px-2 text-right font-black text-white font-mono">{loc.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-600">
                      Nenhuma localização mapeada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Locations Pagination */}
          {locationsTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-auto">
              <span className="text-[10px] text-zinc-500">
                Pág {locationsCurrentPage} de {locationsTotalPages}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={locationsCurrentPage === 1}
                  onClick={() => setLocationsCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={locationsCurrentPage === locationsTotalPages}
                  onClick={() => setLocationsCurrentPage(p => Math.min(locationsTotalPages, p + 1))}
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
