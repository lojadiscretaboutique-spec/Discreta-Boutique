import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import { 
  CheckCircle2, XCircle, RefreshCw, 
  ExternalLink, Smartphone, ShieldAlert, Zap,
  Bell, Save, Check, Info
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';
import { cn } from '../../lib/utils';

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
  type?: 'status' | 'recovery';
}

export function AdminWebhooks() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  
  const [config, setConfig] = useState({
    statusWebhookUrl: '',
    statusTemplate: '',
    recoveryWebhookUrl: '',
    recoveryActive: false
  });
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'webhooks'));
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            statusWebhookUrl: data.statusWebhookUrl || '',
            statusTemplate: data.statusTemplate || '',
            recoveryWebhookUrl: data.recoveryWebhookUrl || '',
            recoveryActive: !!data.recoveryActive
          });
        } else {
          // Fallback check in store settings for legacy migration
          const storeSnap = await getDoc(doc(db, 'settings', 'store'));
          if (storeSnap.exists()) {
            const data = storeSnap.data();
            setConfig(prev => ({
              ...prev,
              statusWebhookUrl: data.botConversaWebhook || '',
              statusTemplate: data.orderMessageTemplate || ''
            }));
          }
          
          const recoverySnap = await getDoc(doc(db, 'settings', 'recovery'));
          if (recoverySnap.exists()) {
             const revData = recoverySnap.data();
             setConfig(prev => ({
               ...prev,
               recoveryWebhookUrl: revData.webhookUrl || '',
               recoveryActive: !!revData.active
             }));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar config:", e);
      }
    }
    loadConfig();

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

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'webhooks'), config, { merge: true });
      setSaved(true);
      toast("Configurações dos Webhooks salvas!");
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      toast("Erro ao salvar configurações", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatLogDate = (ts: any) => {
    if (!ts) return '...';
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return format(date, "dd/MM HH:mm");
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração Bot Conversa</h1>
          <p className="text-sm text-slate-500">Gerencie disparos automáticos e recupere leads abandonados.</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full md:w-auto">
           <button 
             onClick={() => setActiveTab('config')}
             className={cn(
               "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all",
               activeTab === 'config' ? "bg-white dark:bg-slate-800 shadow-sm text-red-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
             )}
           >
             Configurações
           </button>
           <button 
             onClick={() => setActiveTab('logs')}
             className={cn(
               "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all",
               activeTab === 'logs' ? "bg-white dark:bg-slate-800 shadow-sm text-red-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
             )}
           >
             Logs de Envio
           </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Notifications */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bell size={20} className="text-red-600" />
                Mudança de Status
              </h2>
              <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-black rounded uppercase">Ativo</div>
            </div>

            <p className="text-xs text-slate-500">Envia notificações automáticas para o cliente quando o status do pedido é alterado no painel.</p>

            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">URL do Webhook</label>
                  <Input 
                    value={config.statusWebhookUrl} 
                    onChange={e => setConfig({...config, statusWebhookUrl: e.target.value})} 
                    placeholder="https://webhook.botconversa.com.br/..."
                    className="h-11 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
               </div>

               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Template da Mensagem (Opcional)</label>
                  <Textarea 
                    value={config.statusTemplate}
                    onChange={e => setConfig({...config, statusTemplate: e.target.value})}
                    placeholder="Olá {nome}! Seu pedido #{pedido_id} mudou para {status}."
                    className="min-h-[120px] dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['{nome}', '{pedido_id}', '{status}', '{forma_pagamento}'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setConfig(prev => ({ ...prev, statusTemplate: (prev.statusTemplate || '') + tag }))}
                        className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded font-bold text-slate-600 dark:text-slate-400 hover:border-red-500 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Payload Enviado (v3)</h3>
               <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-1"><Check size={10} /> nome</div>
                  <div className="flex items-center gap-1"><Check size={10} /> whatsapp</div>
                  <div className="flex items-center gap-1"><Check size={10} /> status</div>
                  <div className="flex items-center gap-1"><Check size={10} /> pedido_id_curto</div>
                  <div className="flex items-center gap-1"><Check size={10} /> data_agendamento</div>
                  <div className="flex items-center gap-1"><Check size={10} /> hora_agendamento</div>
                  <div className="flex items-center gap-1 text-red-500 font-bold"><Check size={10} /> forma_pagamento</div>
               </div>
            </div>
          </div>

          {/* Recovery Notification */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap size={20} className="text-amber-500" />
                Recuperador de Carrinho
              </h2>
              <button 
                onClick={() => setConfig({...config, recoveryActive: !config.recoveryActive})}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all duration-300",
                  config.recoveryActive ? "bg-green-600" : "bg-slate-300 dark:bg-slate-800"
                )}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                  config.recoveryActive ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <p className="text-xs text-slate-500">Dispara um evento para o Bot Conversa após 15 minutos que o cliente iniciou um carrinho mas não finalizou.</p>

            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">URL do Webhook de Recuperação</label>
                  <Input 
                    value={config.recoveryWebhookUrl} 
                    onChange={e => setConfig({...config, recoveryWebhookUrl: e.target.value})} 
                    placeholder="https://webhook.botconversa.com.br/..."
                    className="h-11 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
               </div>

               <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                  <h3 className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 mb-2">Instruções de Fluxo</h3>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/60 leading-relaxed italic">
                    "Configure este Webhook no Bot Conversa para disparar um fluxo de boas-vindas com cupom de desconto. O payload inclui o nome do cliente e whatsapp formatado."
                  </p>
               </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Payload Enviado (v2)</h3>
               <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-1"><Check size={10} /> Nome</div>
                  <div className="flex items-center gap-1"><Check size={10} /> Whatsapp</div>
                  <div className="flex items-center gap-1"><Check size={10} /> pedido_id</div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Button 
                onClick={handleSaveConfig} 
                disabled={saving}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-red-900/20 transition-all active:scale-[0.98]"
              >
                {saved ? <><Check className="mr-2" /> Alterações Salvas</> : saving ? 'PROCESSANDO...' : <><Save className="mr-2" /> Salvar Todas as Configurações WebHook</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of logs */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
               <h2 className="text-sm font-bold opacity-60 flex items-center gap-2">
                 <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                 Últimos 100 Disparos
               </h2>
               <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded">
                    {logs.filter(l => l.success).length} SUCESSOS
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded">
                    {logs.filter(l => !l.success).length} FALHAS
                  </span>
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className={cn(
                        "group hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer transition-all",
                        selectedLog?.id === log.id && "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.success ? (
                          <div className="flex items-center text-green-500 gap-1.5">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-black uppercase tracking-tight">Sucesso</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-500 gap-1.5">
                            <XCircle size={14} />
                            <span className="text-[10px] font-black uppercase tracking-tight">Falha</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium tracking-tight">
                        {formatLogDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[150px]">{log.customerName}</div>
                         <div className="text-[10px] text-slate-500 font-mono">{log.customerWhatsapp}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                         <span className={cn(
                           "text-[9px] px-2 py-0.5 rounded font-black tracking-widest",
                           log.type === 'recovery' || log.status === 'RECUPERAÇÃO'
                             ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" 
                             : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                         )}>
                           {log.type === 'recovery' || log.status === 'RECUPERAÇÃO' ? 'CARRINHO' : 'PEDIDO'}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-fit sticky top-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
               <Info size={16} className="text-red-600" />
               Detalhes do Envio
            </h2>

            <AnimatePresence mode="wait">
              {selectedLog ? (
                <motion.div 
                  key={selectedLog.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 font-black text-red-600">{selectedLog.customerName.charAt(0)}</div>
                       <div>
                          <p className="text-xs font-black uppercase text-slate-900 dark:text-white leading-none">{selectedLog.customerName}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedLog.customerWhatsapp}</p>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Status Reportado</label>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedLog.status}</div>
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Payload JSON</label>
                          <pre className="text-[10px] p-2 bg-black rounded border border-slate-800 overflow-x-auto text-slate-400">
                             {JSON.stringify(selectedLog.payload, null, 2)}
                          </pre>
                       </div>
                    </div>
                  </div>

                  {!selectedLog.success && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-xs mb-2 uppercase">
                        <ShieldAlert size={14} />
                        Motivo da Falha
                      </div>
                      <p className="text-[10px] text-red-800 dark:text-red-400/80 font-mono italic">
                        {selectedLog.error || 'Tempo de resposta esgotado ou URL inválida.'}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    {selectedLog.type !== 'recovery' && selectedLog.status !== 'RECUPERAÇÃO' && (
                       <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full text-[11px] font-bold dark:border-slate-800"
                        onClick={() => window.open(`/admin/pedidos?id=${selectedLog.orderId}`, '_blank')}
                      >
                        <ExternalLink size={14} className="mr-2" />
                        Acessar Detalhes do Pedido
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline"
                      size="sm"
                      className="w-full text-[11px] font-bold dark:border-slate-800"
                      onClick={async () => {
                        try {
                          const route = (selectedLog.type === 'recovery' || selectedLog.status === 'RECUPERAÇÃO') 
                            ? '/api/admin/test-recovery-webhook' 
                            : '/api/botconversa/retry';
                          
                          const body = (selectedLog.type === 'recovery' || selectedLog.status === 'RECUPERAÇÃO')
                            ? { name: selectedLog.customerName, phone: selectedLog.customerWhatsapp }
                            : { orderId: selectedLog.orderId };

                          const response = await fetch(route, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          });
                          const data = await response.json();
                          if (data.success) {
                            toast("Webhook disparado com sucesso!", "success");
                          } else {
                            throw new Error(data.error);
                          }
                        } catch (err: any) {
                          toast(`Reenvio falhou: ${err.message}`, "error");
                        }
                      }}
                    >
                      <RefreshCw size={14} className="mr-2" />
                      Tentar Reenviar Agora
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                  <Smartphone size={32} className="mb-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nada Selecionado</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
