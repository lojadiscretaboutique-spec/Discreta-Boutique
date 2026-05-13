import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { stockSyncService } from '../../services/stockSyncService';
import { 
  CheckCircle2, RefreshCw, Layers, 
  Info, ArrowRight
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { motion } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';

interface ProductInconsistency {
  id: string;
  name: string;
  currentStock: number;
  calculatedStock: number;
  variantCount: number;
  status: 'error' | 'ok';
}

export default function AdminSmartStock() {
  const [inconsistencies, setInconsistencies] = useState<ProductInconsistency[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const { toast } = useFeedback();

  const checkInconsistencies = useCallback(async () => {
    setLoading(true);
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      const found: ProductInconsistency[] = [];

      for (const productDoc of productsSnap.docs) {
        const product = productDoc.data();
        if (product.hasVariants) {
          const calculated = await stockSyncService.calculateParentStock(productDoc.id);
          const current = Number(product.stock || 0);

          if (calculated !== null && current !== calculated) {
            // Count active variants for display
            const vSnap = await getDocs(query(
              collection(db, `products/${productDoc.id}/variants`),
              where('active', '==', true)
            ));

            found.push({
              id: productDoc.id,
              name: product.name,
              currentStock: current,
              calculatedStock: calculated,
              variantCount: vSnap.size,
              status: 'error'
            });
          }
        }
      }
      setInconsistencies(found);
    } catch (error) {
      console.error("Erro ao verificar estoque:", error);
      toast("Falha ao analisar banco de dados", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    checkInconsistencies();
  }, [checkInconsistencies]);

  async function syncAll() {
    if (inconsistencies.length === 0) return;
    setSyncing(true);
    let success = 0;
    
    try {
      for (let i = 0; i < inconsistencies.length; i++) {
        const item = inconsistencies[i];
        await stockSyncService.syncParentStock(item.id);
        success++;
        setSyncProgress(Math.round(((i + 1) / inconsistencies.length) * 100));
      }
      toast(`${success} produtos sincronizados com sucesso!`, "success");
      await checkInconsistencies();
    } catch (error) {
      toast("Ocorreu um erro durante a sincronização em lote", "error");
    } finally {
      setSyncing(false);
      setSyncProgress(0);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black p-8 rounded-3xl border border-red-900/30">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-red-600 rounded-lg">
                <Layers className="text-white" size={24} />
             </div>
             <h1 className="text-2xl font-bold text-white">Estoque Inteligente</h1>
          </div>
          <p className="text-gray-400 max-w-xl">
            Sincronização automática entre variações e produtos principais. Garante que seu catálogo nunca oculte produtos com estoque real disponível.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="bg-zinc-900 border-zinc-800"
            onClick={checkInconsistencies}
            disabled={loading || syncing}
          >
            <RefreshCw className={cn("mr-2", loading && "animate-spin")} size={18} />
            Recarregar
          </Button>
          <Button 
            className="bg-red-600 hover:bg-red-700 font-bold"
            onClick={syncAll}
            disabled={loading || syncing || inconsistencies.length === 0}
          >
            {syncing ? (
              <>{syncProgress}% Sincronizando...</>
            ) : (
              <>Corrigir {inconsistencies.length} Divergências</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Status Panels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">Saúde do Estoque</h3>
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                 <div className="text-3xl font-black text-white">{inconsistencies.length}</div>
                 <div className="text-red-500 text-xs font-bold bg-red-500/10 px-2 py-1 rounded">Inconsistentes</div>
               </div>
               <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                 <div 
                   className="bg-red-600 h-full transition-all duration-1000" 
                   style={{ width: `${inconsistencies.length > 0 ? (inconsistencies.length / 100) * 100 : 0}%` }}
                 />
               </div>
            </div>
          </div>

          <div className="bg-black border border-red-900/10 p-6 rounded-2xl">
             <div className="flex items-center gap-2 text-amber-500 mb-3">
                <Info size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Dica Profissional</span>
             </div>
             <p className="text-xs text-gray-400 leading-relaxed italic">
               "Mantenha o estoque sincronizado para garantir que os motores de busca e filtros de catálogo identifiquem corretamente a disponibilidade dos seus itens premium."
             </p>
          </div>
        </div>

        {/* Inconsistency List */}
        <div className="lg:col-span-3 bg-black rounded-3xl border border-red-900/20 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <RefreshCw className="animate-spin text-red-600" size={48} />
              <p className="text-gray-500 font-medium">Analisando integridade dos estoques...</p>
            </div>
          ) : inconsistencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="p-6 bg-green-600/10 rounded-full mb-6">
                <CheckCircle2 className="text-green-500" size={64} />
              </div>
              <h3 className="text-white text-xl font-bold mb-2">Tudo em Ordem!</h3>
              <p className="text-gray-500 max-w-sm">
                Não foram encontradas divergências entre o estoque das variações e os produtos principais.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-900/50 border-b border-red-900/20">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estoque Atual</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estoque Real</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Variações</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {inconsistencies.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white group-hover:text-red-500 transition-colors uppercase text-sm">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-500 font-bold">{item.currentStock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <ArrowRight size={14} className="text-red-500" />
                           <span className="text-red-500 font-black text-lg">{item.calculatedStock}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {item.variantCount} ativas
                      </td>
                      <td className="px-6 py-4">
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white"
                          onClick={() => stockSyncService.syncParentStock(item.id).then(() => checkInconsistencies())}
                        >
                          Corrigir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
