import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import { 
  Brain, Search, TrendingUp, Sparkles, AlertCircle, 
  Clock, Filter, ShieldCheck, Zap
} from 'lucide-react';
import { Card } from '../../components/ui/card';

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AdminAIInsights() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, 'search_logs'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        }));
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  // Process data for charts
  const categoryData = logs.reduce((acc: any, log) => {
    if (log.interpretacao?.categoria) {
      const cat = log.interpretacao.categoria;
      acc[cat] = (acc[cat] || 0) + 1;
    }
    return acc;
  }, {});

  const pieData = Object.keys(categoryData).map(key => ({
    name: key,
    value: categoryData[key]
  }));

  const intentData = logs.slice(0, 10).map(log => ({
    name: log.busca.substring(0, 15) + '...',
    tokens: log.duration, // use duration as a proxy for complexity
    full: log.busca
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <Brain className="text-red-500" />
            Insights de IA
          </h1>
          <p className="text-zinc-500 font-medium">Entenda o comportamento e desejos ocultos dos seus clientes.</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold uppercase transition-all">Últimos 100 Logs</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-500/10 p-2 rounded-lg"><Search className="text-red-500" size={20} /></div>
            <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">LIVE</span>
          </div>
          <p className="text-zinc-400 text-xs font-bold uppercase">Buscas Interpretadas</p>
          <p className="text-4xl font-black text-white">{logs.length}</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500/10 p-2 rounded-lg"><Zap className="text-blue-500" size={20} /></div>
            <span className="text-[10px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold">MÉDIA</span>
          </div>
          <p className="text-zinc-400 text-xs font-bold uppercase">Latência da IA</p>
          <p className="text-4xl font-black text-white">
            {logs.length > 0 ? (logs.reduce((a, b: any) => a + (b.duration || 0), 0) / logs.length).toFixed(0) : 0}ms
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500/10 p-2 rounded-lg"><ShieldCheck className="text-green-500" size={20} /></div>
            <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">100%</span>
          </div>
          <p className="text-zinc-400 text-xs font-bold uppercase">Taxa de Sucesso</p>
          <p className="text-4xl font-black text-white">
            {logs.filter(l => !l.fallback).length} / {logs.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Pie Chart */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Filter size={18} className="text-red-500" /> Categorias Mais Desejadas
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {pieData.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-zinc-400 font-medium truncate">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Intentions Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-red-500" /> Últimas Intenções Detectadas
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {logs.slice(0, 10).map((log, i) => (
              <div key={i} className="group p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-red-500/50 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                    {log.interpretacao?.nivel_usuario || 'Iniciante'}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1 font-mono">
                    <Clock size={10} /> {log.timestamp?.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-white font-bold mb-1">"{log.busca}"</p>
                <p className="text-xs text-zinc-500 italic">IA: {log.interpretacao?.intencao}</p>
                {log.interpretacao?.sugestao_curadoria && (
                  <div className="mt-2 flex items-center gap-1.5 text-blue-400">
                    <Sparkles size={10} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Sugeriu: {log.interpretacao.sugestao_curadoria}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!loading && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
          <AlertCircle size={48} className="text-zinc-700 mb-4" />
          <p className="text-zinc-500 font-bold">Nenhum log de IA encontrado ainda.</p>
        </div>
      )}
    </div>
  );
}
