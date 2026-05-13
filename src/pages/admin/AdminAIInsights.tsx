import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Brain, AlertTriangle, Lightbulb, Target, ArrowRight, ShieldCheck, 
  Activity, TrendingUp, Zap, Clock, ChevronRight, RefreshCw, BarChart, Search
} from 'lucide-react';
import { useFeedback } from '../../contexts/FeedbackContext';

export default function AdminAIInsights() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => {
    async function loadReport() {
      try {
        const docRef = doc(db, 'ai_curation', 'strategic_report');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setReport(snap.data());
        }
      } catch (err) {
        console.error("Erro ao carregar relatório:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      
      const { collection, getDocs, limit, query, orderBy } = await import('firebase/firestore');

      // 1. Fetch Data for AI analysis
      toast("Coletando dados do sistema...", "info");
      
      // Products
      const productsSnap = await getDocs(query(collection(db, 'products'), limit(300)));
      const products = productsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          category: data.categoryId || data.category || 'Outros',
          price: data.price,
          stock: data.stock || 0,
          cliques: data.cliques || 0,
          conversoes: data.conversoes || 0,
          visualizacoes: data.visualizacoes || 0,
          recentViews: data.recentViews || 0
        };
      });

      // Orders
      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100)));
      const ecommerceOrders = ordersSnap.docs.map(d => ({
        total: d.data().total,
        status: d.data().status,
        itemsCount: d.data().items?.length || 0,
        createdAt: d.data().createdAt
      }));

      // Cash Transactions
      const cashSnap = await getDocs(query(collection(db, 'cashTransactions'), orderBy('createdAt', 'desc'), limit(100)));
      const cashTransactions = cashSnap.docs.map(d => {
        const data = d.data();
        return {
          amount: data.amount,
          type: data.type,
          source: data.source,
          category: data.category
        };
      });

      // Search Logs
      const searchSnap = await getDocs(query(collection(db, 'search_logs'), orderBy('timestamp', 'desc'), limit(50)));
      const searchLogs = searchSnap.docs.map(d => {
        const data = d.data();
        return {
          query: data.busca,
          intention: data.interpretacao?.intencao,
          level: data.interpretacao?.nivel_usuario
        };
      });

      const totalRevenue = ecommerceOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      const avgTicket = ecommerceOrders.length > 0 ? totalRevenue / ecommerceOrders.length : 0;
      const physicalSales = cashTransactions.filter(t => t.source === 'loja_fisica' && t.type === 'entrada');
      const totalPhysicalRevenue = physicalSales.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      const payload = {
        products,
        ecommerceOrders,
        physicalSales,
        totalRevenue,
        totalPhysicalRevenue,
        avgTicket,
        searchLogs,
        stats: {
          totalOrders: ecommerceOrders.length,
          activeProducts: products.length,
        }
      };

      toast("Analisando padrões estratégicos...", "info");
      
      const res = await fetch('/api/ia/strategic-report', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao gerar relatório');
      }
      
      const resData = await res.json();
      
      const docRef = doc(db, 'ai_curation', 'strategic_report');
      const reportData = { ...resData.result, updatedAt: serverTimestamp() };
      await setDoc(docRef, reportData);
      
      setReport(reportData);
      toast("Relatório Estratégico gerado com sucesso!", "success");
    } catch (err: any) {
      console.error(err);
      toast(`Erro ao gerar diagnóstico: ${err.message}`, "error");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-zinc-500 font-bold">Carregando cérebro estratégico...</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Brain className="text-red-500" size={32} />
            Central de Inteligência Estratégica
          </h1>
          <p className="text-zinc-400 font-medium mt-1">
            Análises profundas, financeiras e operacionais para tomada de decisão da diretoria.
          </p>
        </div>
        <button 
          onClick={handleGenerateReport} 
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 border border-red-500/30"
        >
          {generating ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
          {generating ? "Processando Inteligência..." : "Gerar Novo Diagnóstico"}
        </button>
      </div>

      {!report && !generating && (
        <div className="flex flex-col items-center justify-center p-16 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
          <Activity size={48} className="text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-bold text-lg">Nenhum relatório gerado ainda.</p>
          <button onClick={handleGenerateReport} className="mt-4 text-red-500 font-bold hover:text-red-400">
            Gerar primeira análise →
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-6 motion-safe:animate-in fade-in slide-in-from-bottom-4">
          
          {/* Timeline / Timestamp */}
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900/40 w-max px-3 py-1.5 rounded-full border border-zinc-800">
            <Clock size={12} />
            Última atualização: {report.updatedAt ? new Date(report.updatedAt?.toMillis ? report.updatedAt.toMillis() : report.updatedAt).toLocaleString() : 'Agora'}
          </div>

          {/* Diagnóstico Executivo */}
          <div className="bg-zinc-900/80 border border-zinc-700 p-8 rounded-2xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <BarChart size={120} />
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 mb-4 uppercase tracking-wider">
              <ShieldCheck className="text-blue-500" /> Diagnóstico Executivo
            </h2>
            <p className="text-zinc-300 text-lg leading-relaxed max-w-4xl relative z-10">
              {report.diagnostico_executivo}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Oportunidades Ocultas */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl flex flex-col">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Lightbulb className="text-yellow-500" /> Oportunidades Detectadas
              </h2>
              <div className="space-y-4 flex-1">
                {report.oportunidades?.map((op: any, i: number) => (
                  <div key={i} className="group p-4 bg-zinc-950/80 rounded-xl border border-zinc-800 hover:border-yellow-500/50 transition-all">
                    <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                       {op.titulo}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{op.descricao}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Problemas Críticos */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl flex flex-col">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <AlertTriangle className="text-red-500" /> Problemas Críticos
              </h2>
              <div className="space-y-4 flex-1">
                {report.problemas_criticos?.map((prob: any, i: number) => (
                  <div key={i} className="p-4 bg-red-950/10 rounded-xl border border-red-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-red-400 font-bold text-base">{prob.problema}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${prob.gravidade.toLowerCase() === 'alta' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>
                        {prob.gravidade}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-2"><strong className="text-zinc-300">Impacto:</strong> {prob.impacto}</p>
                    <div className="bg-red-950/30 p-2 rounded block text-xs font-mono text-red-300 border border-red-900/50">
                      &gt; Ação Imediata: {prob.acao}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Comportamento do Cliente & Comparação */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900/20 to-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
               <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                 <Activity className="text-indigo-400" /> Comportamento do Cliente
               </h2>
               <p className="text-zinc-300 mb-6 leading-relaxed">
                 {report.comportamento_cliente?.padrao_identificado}
               </p>
               <div className="flex flex-wrap gap-2">
                 {report.comportamento_cliente?.perfis_dominantes?.map((p: string, i: number) => (
                   <span key={i} className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
                     {p}
                   </span>
                 ))}
               </div>
             </div>
             <div className="bg-gradient-to-br from-emerald-900/20 to-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
               <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                 <TrendingUp className="text-emerald-400" /> Comparativo Estratégico
               </h2>
               <p className="text-zinc-300 text-sm leading-relaxed">
                 {report.comparacao_estrategica}
               </p>
             </div>
          </div>

          {/* Ações Recomendadas */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Target className="text-emerald-500" /> Plano de Ação Priorizado
            </h2>
            <div className="space-y-3">
              {report.acoes_recomendadas?.map((acao: any, i: number) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-emerald-500/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">
                        {i + 1}
                      </span>
                      <h3 className="text-white font-bold text-lg">{acao.acao}</h3>
                    </div>
                    <p className="text-zinc-400 text-sm ml-9">{acao.motivo}</p>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end gap-4 md:gap-1 ml-9 md:ml-0 border-t md:border-t-0 border-zinc-800 pt-3 md:pt-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${acao.prioridade.toLowerCase() === 'alta' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      Prioridade {acao.prioridade}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">Expectativa: {acao.impacto_esperado}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Principais Descobertas */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Search className="text-indigo-500" /> Principais Descobertas
              </h2>
              <ul className="space-y-3">
                {report.principais_descobertas?.map((desc: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-zinc-300 text-sm">
                    <ChevronRight size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Previsões */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <TrendingUp className="text-fuchsia-500" /> Cenários e Previsões
              </h2>
              <ul className="space-y-3">
                {report.previsoes?.map((prev: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-zinc-300 text-sm">
                    <ArrowRight size={16} className="text-fuchsia-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{prev}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Resumo Final */}
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-2xl text-center">
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-4">Veredito Final</h2>
            <p className="text-white text-lg md:text-xl font-medium leading-relaxed max-w-3xl mx-auto">
              "{report.resumo_final}"
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

