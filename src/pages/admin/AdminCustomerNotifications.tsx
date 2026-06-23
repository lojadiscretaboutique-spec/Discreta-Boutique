import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import { 
  CheckCircle2, XCircle, RefreshCw, 
  Settings, Bell, Save, Check, Info, FileText
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';
import { cn } from '../../lib/utils';

interface NotificationLog {
  id: string;
  type: 'customer_welcome' | 'customer_activation' | 'customer_activation_otp';
  channel: 'whatsapp' | 'email';
  uid: string;
  email: string;
  whatsapp: string;
  webhookUrl?: string; // made optional
  status: 'success' | 'error';
  responseStatus?: number;
  errorMessage?: string;
  createdAt: any;
}

export function AdminCustomerNotifications() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  
  const [config, setConfig] = useState({
    welcomeWebhookUrl: '',
    activationWebhookUrl: '',
    enableWelcomeWhatsapp: false,
    enableActivationWhatsapp: false,
    activationOtpWebhookUrl: '',
    enableActivationOtpWhatsapp: false,
    enableActivationOtpEmail: true,
    otpValidityMinutes: 10,
    otpMaxAttempts: 5,
    otpResendSeconds: 60
  });
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'customerNotifications'));
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            welcomeWebhookUrl: data.welcomeWebhookUrl || '',
            activationWebhookUrl: data.activationWebhookUrl || '',
            enableWelcomeWhatsapp: !!data.enableWelcomeWhatsapp,
            enableActivationWhatsapp: !!data.enableActivationWhatsapp,
            activationOtpWebhookUrl: data.activationOtpWebhookUrl || '',
            enableActivationOtpWhatsapp: !!data.enableActivationOtpWhatsapp,
            enableActivationOtpEmail: data.enableActivationOtpEmail !== false,
            otpValidityMinutes: Number(data.otpValidityMinutes) || 10,
            otpMaxAttempts: Number(data.otpMaxAttempts) || 5,
            otpResendSeconds: Number(data.otpResendSeconds) || 60
          });
        }
      } catch (e) {
        console.error("Erro ao carregar configurações de notificações:", e);
        toast("Erro ao carregar configurações.", "error");
      }
    }
    loadConfig();

    const q = query(
      collection(db, 'notificationLogs'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationLog)));
      setLoadingLogs(false);
    }, (error) => {
      console.error("Erro ao carregar logs de notificações:", error);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'customerNotifications'), {
        ...config,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaved(true);
      toast("Configurações salvas com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error(e);
      toast("Erro ao salvar configurações: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const formatLogDate = (ts: any) => {
    if (!ts) return '...';
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return format(date, "dd/MM/yyyy HH:mm:ss");
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl pb-20 text-slate-100 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-red-500 animate-pulse" /> Ativação e Boas-Vindas
          </h1>
          <p className="text-sm text-slate-400">Configure os webhooks para novos clientes de forma simples e segura.</p>
        </div>
        
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-full md:w-auto">
          <button 
            type="button"
            onClick={() => setActiveTab('config')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'config' 
                ? "bg-red-600 shadow-lg text-white font-black" 
                : "text-zinc-400 hover:text-white"
            )}
          >
            Configurações
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'logs' 
                ? "bg-red-600 shadow-lg text-white font-black" 
                : "text-zinc-400 hover:text-white"
            )}
          >
            Logs de Disparos
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'config' ? (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-6"
          >
            <div className="bg-zinc-950 border border-zinc-900 p-6 md:p-8 rounded-2xl flex flex-col gap-6 shadow-xl">
              <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
                <Settings className="text-red-500 h-5 w-5" />
                <h3 className="font-bold text-lg text-white">Configuração de WhatsApp Webhook</h3>
              </div>

              {/* Seção 1: Boas vindas */}
              <div className="space-y-4 bg-zinc-900/40 p-4 md:p-6 rounded-xl border border-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-md">Mensagem de Boas-Vindas</h4>
                    <p className="text-xs text-slate-400">Disparar webhook assim que o usuário concluir o cadastro.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={config.enableWelcomeWhatsapp}
                      onChange={(e) => setConfig({ ...config, enableWelcomeWhatsapp: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white border-zinc-700"></div>
                  </label>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Webhook URL (Boas-Vindas)</label>
                  <Input 
                    placeholder="https://suapi.com/webhook/welcome"
                    value={config.welcomeWebhookUrl}
                    onChange={(e) => setConfig({ ...config, welcomeWebhookUrl: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                  />
                  <div className="flex items-start gap-1.5 text-[10px] text-zinc-400">
                    <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>Payload enviado: event, name, email, whatsapp, cpf, uid, createdAt</span>
                  </div>
                </div>
              </div>

              {/* Seção 2: Ativação */}
              <div className="space-y-4 bg-zinc-900/40 p-4 md:p-6 rounded-xl border border-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-md">Mensagem de Ativação</h4>
                    <p className="text-xs text-slate-400">Disparar webhook assim que o e-mail do usuário for confirmado.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={config.enableActivationWhatsapp}
                      onChange={(e) => setConfig({ ...config, enableActivationWhatsapp: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white border-zinc-700"></div>
                  </label>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Webhook URL (Ativação de Conta)</label>
                  <Input 
                    placeholder="https://suapi.com/webhook/activation"
                    value={config.activationWebhookUrl}
                    onChange={(e) => setConfig({ ...config, activationWebhookUrl: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                  />
                  <div className="flex items-start gap-1.5 text-[10px] text-zinc-400">
                    <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>Payload enviado: event, name, email, whatsapp, uid, activatedAt</span>
                  </div>
                </div>
              </div>

              {/* Seção 3: Ativação por Código OTP */}
              <div className="space-y-6 bg-zinc-900/40 p-4 md:p-6 rounded-xl border border-zinc-900">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <div>
                    <h4 className="font-bold text-white text-md">Ativação por Código OTP (Segurança)</h4>
                    <p className="text-xs text-slate-400">Gerar código numérico de 6 dígitos para novos cadastros.</p>
                  </div>
                </div>

                {/* Sub-seções de ativação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-white text-sm">Disparar código por E-mail</h5>
                      <p className="text-[10px] text-slate-400">Enviar OTP ao e-mail usando SMTP.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.enableActivationOtpEmail}
                        onChange={(e) => setConfig({ ...config, enableActivationOtpEmail: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white border-zinc-700"></div>
                    </label>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-white text-sm">Disparar código por WhatsApp</h5>
                      <p className="text-[10px] text-slate-400">Enviar OTP por webhook do WhatsApp.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.enableActivationOtpWhatsapp}
                        onChange={(e) => setConfig({ ...config, enableActivationOtpWhatsapp: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white border-zinc-700"></div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Webhook URL (Ativação por OTP)</label>
                  <Input 
                    placeholder="https://suapi.com/webhook/activation-otp"
                    value={config.activationOtpWebhookUrl}
                    onChange={(e) => setConfig({ ...config, activationOtpWebhookUrl: e.target.value })}
                    className="bg-zinc-905 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                  />
                  <div className="flex items-start gap-1.5 text-[10px] text-zinc-400">
                    <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>Payload enviado: event: "customer_activation_otp", name, email, whatsapp, uid, code, expiresInMinutes</span>
                  </div>
                </div>

                {/* Parâmetros numéricos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Validade do Código (Minutos)</label>
                    <Input 
                      type="number" 
                      min="1"
                      max="120"
                      value={config.otpValidityMinutes}
                      onChange={(e) => setConfig({ ...config, otpValidityMinutes: parseInt(e.target.value) || 10 })}
                      className="bg-zinc-900 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Limite de Tentativas</label>
                    <Input 
                      type="number" 
                      min="1"
                      max="20"
                      value={config.otpMaxAttempts}
                      onChange={(e) => setConfig({ ...config, otpMaxAttempts: parseInt(e.target.value) || 5 })}
                      className="bg-zinc-900 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Tempo de Reenvio (Segundos)</label>
                    <Input 
                      type="number" 
                      min="10"
                      max="600"
                      value={config.otpResendSeconds}
                      onChange={(e) => setConfig({ ...config, otpResendSeconds: parseInt(e.target.value) || 60 })}
                      className="bg-zinc-900 border-zinc-800 text-white focus:border-red-500 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-zinc-900">
                <Button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-2.5 rounded-xl transition shadow-lg transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : saved ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-6 border-b border-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">Relatório de Envio (Notificações)</h3>
                <p className="text-xs text-slate-400">Acompanhe as respostas e o status dos webhooks em tempo real.</p>
              </div>
            </div>

            {loadingLogs ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
                <span>Carregando logs de disparo...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                Não há logs de notificações registrados até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-900/30 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="p-4">Data / Hora</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Canal</th>
                      <th className="p-4">Destinatário</th>
                      <th className="p-4">WhatsApp</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="p-4 whitespace-nowrap font-mono text-xs">{formatLogDate(log.createdAt)}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-bold",
                            log.type === 'customer_welcome' 
                              ? "bg-blue-950 text-blue-300 border border-blue-900/60" 
                              : log.type === 'customer_activation_otp'
                                ? "bg-amber-955 text-amber-300 border border-amber-900/60"
                                : "bg-purple-950 text-purple-300 border border-purple-900/60"
                          )}>
                            {log.type === 'customer_welcome' 
                              ? 'Boas-Vindas' 
                              : log.type === 'customer_activation_otp' 
                                ? 'Código OTP' 
                                : 'Ativação'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                            log.channel === 'email' 
                              ? "bg-neutral-800 text-zinc-300 border border-zinc-700" 
                              : "bg-emerald-950 text-emerald-400 border border-emerald-900"
                          )}>
                            {log.channel}
                          </span>
                        </td>
                        <td className="p-4 max-w-[150px] truncate">{log.email}</td>
                        <td className="p-4 font-mono text-xs">{log.whatsapp}</td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                            log.status === 'success' 
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-900/40" 
                              : "bg-red-950/80 text-red-300 border border-red-900/40"
                          )}>
                            {log.status === 'success' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Sucesso
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5" />
                                Erro {log.responseStatus ? `(${log.responseStatus})` : ''}
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="text-red-500 hover:text-red-400 font-bold transition text-xs"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detalhes do Log Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-900 text-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[85vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                <h3 className="font-bold text-lg text-white font-sans flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-500" /> Detalhes do Evento
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition text-sm font-bold"
                >
                  Fechar
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
                <div className="grid grid-cols-2 gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-900">
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Data Envio</span>
                    <span className="font-mono text-zinc-300">{formatLogDate(selectedLog.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Tipo</span>
                    <span className="text-zinc-300">{selectedLog.type === 'customer_welcome' ? 'Boas-Vindas' : 'Ativação'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Canal</span>
                    <span className="text-zinc-300">WhatsApp Webhook</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Status Código</span>
                    <span className="text-zinc-300 font-mono">{selectedLog.responseStatus || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Cliente UID</span>
                  <span className="text-zinc-300 font-mono select-all bg-zinc-900/30 px-2 py-1 rounded block border border-zinc-900">{selectedLog.uid}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Parâmetros</span>
                  <div className="grid grid-cols-2 gap-2 text-zinc-400 bg-zinc-900/10 p-2.5 rounded border border-zinc-900">
                    <div>Email: <strong className="text-zinc-200">{selectedLog.email}</strong></div>
                    <div>WhatsApp: <strong className="text-zinc-200 font-mono">{selectedLog.whatsapp}</strong></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-zinc-500 uppercase tracking-wider font-bold block text-[10px]">Webhook URL</span>
                  <span className="text-zinc-300 font-mono break-all bg-zinc-900/30 px-2 py-1 rounded block border border-zinc-900">{selectedLog.webhookUrl}</span>
                </div>

                {selectedLog.errorMessage && (
                  <div className="space-y-1">
                    <span className="text-red-400 uppercase tracking-wider font-bold block text-[10px]">Messagem de Erro</span>
                    <pre className="text-red-300 bg-red-950/20 border border-red-900/50 p-3 rounded-xl font-mono text-left whitespace-pre-wrap break-all">
                      {selectedLog.errorMessage}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
