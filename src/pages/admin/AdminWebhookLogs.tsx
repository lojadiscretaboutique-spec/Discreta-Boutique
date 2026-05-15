import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import { 
  CheckCircle2, XCircle, Info, RefreshCw, 
  ExternalLink, Smartphone, User, MessageSquare, AlertTriangle, Clock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';

interface WebhookLog {
  id: string;
  orderId: string;
  customerName: string;
  customerWhatsapp: string;
  status: string;
  payload: any;
  response?: any;
  error?: string;
  attempts: number;
  success: boolean;
  timestamp: any;
}

export default function AdminWebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const { toast } = useFeedback();

  useEffect(() => {
    const q = query(
      collection(db, 'webhook_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WebhookLog)));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar logs:", error);
      toast("Falha ao carregar logs dos webhooks", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const formatLogDate = (ts: any) => {
    if (!ts) return '...';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return format(date, "dd/MM/yyyy HH:mm:ss");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-black p-6 rounded-2xl border border-red-900/30">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs de Automação (WhatsApp)</h1>
          <p className="text-gray-400">Monitoramento em tempo real dos disparos para o BotConversa</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-red-950/20 px-4 py-2 rounded-lg border border-red-900/20 text-center">
             <div className="text-2xl font-bold text-red-500">{logs.filter(l => !l.success).length}</div>
             <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Falhas</div>
           </div>
           <div className="bg-green-950/20 px-4 py-2 rounded-lg border border-green-900/20 text-center">
             <div className="text-2xl font-bold text-green-500">{logs.filter(l => l.success).length}</div>
             <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Sucessos</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Logs */}
        <div className="lg:col-span-2 bg-black rounded-2xl border border-red-900/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-900/50 border-b border-red-900/20">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Pedido</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tentativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8 bg-zinc-900/20"></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                      <Info className="mx-auto h-12 w-12 mb-4 opacity-20" />
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className={cn(
                        "hover:bg-zinc-900 transition-colors cursor-pointer",
                        selectedLog?.id === log.id && "bg-zinc-900 border-l-4 border-red-600"
                      )}
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.success ? (
                          <div className="flex items-center text-green-500 gap-2">
                            <CheckCircle2 size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Enviado</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-500 gap-2">
                            <XCircle size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Falhou</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatLogDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono px-2 py-1 bg-zinc-800 text-white rounded">
                          #{log.orderId?.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm font-medium text-white">{log.customerName}</div>
                         <div className="text-xs text-gray-500">{log.customerWhatsapp}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                         <span className={cn(
                           "text-xs px-2 py-1 rounded-full",
                           log.attempts > 1 ? "bg-amber-900/30 text-amber-500" : "bg-zinc-800 text-gray-400"
                         )}>
                           {log.attempts}x
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalhes do Log Selecionado */}
        <div className="bg-black rounded-2xl border border-red-900/20 p-6 h-fit sticky top-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Info size={20} className="text-red-600" />
            Detalhes do Log
          </h2>

          <AnimatePresence mode="wait">
            {selectedLog ? (
              <motion.div 
                key={selectedLog.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 bg-zinc-900 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs text-gray-500 uppercase tracking-widest font-bold border-b border-zinc-800 pb-2">
                    <span>Evento de Status</span>
                    <span className="text-white">{selectedLog.status}</span>
                  </div>
                  <div className="space-y-4 pt-2">
                     <div className="flex items-center gap-3">
                        <Smartphone size={16} className="text-red-500" />
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Telefone Formatado</div>
                          <div className="text-sm text-white font-mono">{selectedLog.customerWhatsapp}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <MessageSquare size={16} className="text-red-500" />
                        <div className="w-full">
                          <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Mensagem Gerada</div>
                          <div className="text-xs text-gray-300 p-3 bg-black rounded-lg border border-zinc-800 whitespace-pre-wrap leading-relaxed">
                            {selectedLog.payload?.mensagem}
                          </div>
                        </div>
                     </div>
                  </div>
                </div>

                {!selectedLog.success && (
                  <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-2 uppercase tracking-wide">
                      <AlertTriangle size={16} />
                      Erro Retornado
                    </div>
                    <pre className="text-[10px] text-red-400/80 font-mono whitespace-pre-wrap break-words">
                      {selectedLog.error}
                    </pre>
                  </div>
                )}

                {selectedLog.success && selectedLog.response && (
                  <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-xl">
                    <div className="flex items-center gap-2 text-green-500 font-bold text-sm mb-2 uppercase tracking-wide">
                      <CheckCircle2 size={16} />
                      Resposta da API (BotConversa)
                    </div>
                    <div className="text-[10px] text-green-400/80 font-mono">
                      Status HTTP: {selectedLog.response.status}<br/>
                      Payload: {JSON.stringify(selectedLog.response.data)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="w-full bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                    onClick={() => window.open(`/admin/pedidos?id=${selectedLog.orderId}`, '_blank')}
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Ver Pedido
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                    onClick={async () => {
                      if (!selectedLog) return;
                      try {
                        const response = await fetch('/api/botconversa/retry', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: selectedLog.orderId }),
                        });
                        const data = await response.json();
                        if (data.success) {
                          toast("Webhook reenviado com sucesso!", "success");
                        } else {
                          throw new Error(data.error);
                        }
                      } catch (err: any) {
                        toast(`Erro ao reenviar: ${err.message}`, "error");
                      }
                    }}
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Reenviar
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 opacity-30">
                <Clock size={48} className="mb-4" />
                <p>Selecione um log para ver os detalhes completos do disparo.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
