import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  TrendingDown, 
  Package, 
  CheckCircle, 
  Search, 
  RefreshCcw,
  ArrowRight,
  Calculator
} from 'lucide-react';
import { motion } from 'motion/react';
import { smartStockService, SmartStockReport, StockRisk } from '../../services/smartStockService';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Link } from 'react-router-dom';

export default function AdminSmartStock() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SmartStockReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'alert' | 'healthy'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smartStockService.generateStockRiskReport();
      setReport(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        message: "Não foi possível carregar o relatório de estoque inteligente.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getFilteredItems = () => {
    if (!report) return [];
    let items: StockRisk[] = [];
    
    if (filter === 'all') {
      items = [...report.criticalItems, ...report.alertItems, ...report.healthyItems];
    } else if (filter === 'critical') {
      items = report.criticalItems;
    } else if (filter === 'alert') {
      items = report.alertItems;
    } else if (filter === 'healthy') {
      items = report.healthyItems;
    }

    if (searchTerm) {
      items = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Sort: Critical -> Alert -> Healthy
    return items.sort((a, b) => {
      const priority = { critical: 0, alert: 1, healthy: 2 };
      return priority[a.status] - priority[b.status];
    });
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Calculator className="text-blue-500" />
            Estoque Inteligente
          </h1>
          <p className="text-zinc-500 text-sm font-medium">Análise automática baseada em giro e vendas reais</p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadData} 
          disabled={loading}
          className="gap-2"
        >
          <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
          Atualizar Análise
        </Button>
      </div>

      {report && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Analisado" 
            value={report.totalAnalysis} 
            icon={<Package size={24} />} 
            color="blue"
          />
          <StatCard 
            label="Crítico (Sem Estoque)" 
            value={report.criticalItems.length} 
            icon={<TrendingDown size={24} />} 
            color="red"
            active={filter === 'critical'}
            onClick={() => setFilter('critical')}
          />
          <StatCard 
            label="Alerta (Reposição Necessária)" 
            value={report.alertItems.length} 
            icon={<AlertTriangle size={24} />} 
            color="orange"
            active={filter === 'alert'}
            onClick={() => setFilter('alert')}
          />
          <StatCard 
            label="Saudável" 
            value={report.healthyItems.length} 
            icon={<CheckCircle size={24} />} 
            color="emerald"
            active={filter === 'healthy'}
            onClick={() => setFilter('healthy')}
          />
        </div>
      )}

      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              className="w-full bg-black border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 md:pb-0">
            <Button 
              size="sm" 
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button 
              size="sm" 
              variant={filter === 'critical' ? 'destructive' : 'outline'}
              onClick={() => setFilter('critical')}
            >
              Crítico
            </Button>
            <Button 
              size="sm" 
              variant={filter === 'alert' ? 'secondary' : 'outline'}
              className={cn(filter === 'alert' && "bg-orange-500 text-white")}
              onClick={() => setFilter('alert')}
            >
              Alerta
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-800">
                <th className="pb-4">Produto</th>
                <th className="pb-4 text-center">Giro Diário</th>
                <th className="pb-4 text-center">Estoque Atual</th>
                <th className="pb-4 text-center">Mín. Sugerido</th>
                <th className="pb-4 text-center">Status</th>
                <th className="pb-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="py-8 bg-zinc-800/20 rounded-xl mb-2" />
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 italic">
                    Nenhum produto encontrado nesta categoria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.productId} className="group hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4">
                      <div className="font-bold text-sm">{item.name}</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="text-xs font-mono">{item.averageDailySales.toFixed(2)} un/dia</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className={cn(
                        "text-sm font-bold",
                        item.currentStock <= 0 ? "text-red-500" : "text-white"
                      )}>
                        {item.currentStock}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="text-sm font-bold text-blue-400">
                        {item.calculatedMinStock}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-4 text-right">
                      <Link to={`/admin/products?id=${item.productId}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          Ver <ArrowRight size={14} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, active, onClick }: { 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  color: 'blue' | 'red' | 'orange' | 'emerald';
  active?: boolean;
  onClick?: () => void;
}) {
  const colors = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  };

  return (
    <motion.div 
      whileHover={{ scale: onClick ? 1.02 : 1 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      onClick={onClick}
      className={cn(
        "p-5 rounded-2xl border transition-all cursor-pointer",
        colors[color],
        active && "ring-2 ring-offset-2 ring-offset-black ring-current"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-white/5">{icon}</div>
        <div className="text-2xl font-black">{value}</div>
      </div>
      <div className="mt-3 text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: 'critical' | 'alert' | 'healthy' }) {
  const configs = {
    critical: { label: "Crítico", class: "bg-red-500/10 text-red-500 border-red-500/20" },
    alert: { label: "Alerta", class: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
    healthy: { label: "Saudável", class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" }
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border",
      configs[status].class
    )}>
      {configs[status].label}
    </span>
  );
}
