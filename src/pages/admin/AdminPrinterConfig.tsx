import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Button } from '../../components/ui/button';
import { 
  Printer, 
  Settings as SettingsIcon, 
  Plus, 
  Copy, 
  Trash, 
  Laptop, 
  RefreshCw, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Play, 
  RotateCcw,
  Eye,
  Settings,
  HelpCircle,
  Clock,
  Volume2,
  ListOrdered
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { printerTokenService, PrinterToken } from '../../services/printerTokenService';
import { printerDeviceService, PrinterDevice } from '../../services/printerDeviceService';
import { printerJobService, PrinterJob } from '../../services/printerJobService';
import { printerSettingsService, PrinterSettings } from '../../services/printerSettingsService';
import { printerLogService, PrinterLog } from '../../services/printerLogService';

type ActiveTabId = 'dashboard' | 'tokens' | 'devices' | 'queue' | 'logs' | 'settings';

export function AdminPrinterConfig() {
  const { hasPermission, user } = useAuthStore();
  const { toast } = useFeedback();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTabId>('dashboard');

  // Load States
  const [tokens, setTokens] = useState<PrinterToken[]>([]);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [jobs, setJobs] = useState<PrinterJob[]>([]);
  const [logs, setLogs] = useState<PrinterLog[]>([]);
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal / Action States
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrinterJob | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [devicePrinterChangeId, setDevicePrinterChangeId] = useState<string | null>(null);

  const canEdit = hasPermission('settings', 'editar');

  // Load All System Data
  const loadData = useCallback(async (showLoadingToast = false) => {
    if (showLoadingToast) setLoading(true);
    try {
      const [allTokens, allDevices, allJobs, allLogs, curSettings] = await Promise.all([
        printerTokenService.listTokens(),
        printerDeviceService.listDevices(),
        printerJobService.listJobs(),
        printerLogService.listLogs(80),
        printerSettingsService.getSettings()
      ]);

      setTokens(allTokens);
      setDevices(allDevices);
      setJobs(allJobs);
      setLogs(allLogs);
      setSettings(curSettings);
    } catch (e) {
      console.error("Erro ao carregar dados do painel de impressão:", e);
      toast("Erro ao carregar dados do painel de impressão automátca.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initial Sync
  useEffect(() => {
    loadData(true);
    // Auto-update feed every 15 seconds to simulate real-time printer jobs
    const timer = setInterval(() => loadData(false), 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Copy helper
  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copiado!`, "success");
    } catch (err) {
      toast("Erro ao copiar para a área de transferência", "error");
    }
  };

  // Generate Integration Token
  const handleGenerateToken = async () => {
    if (!canEdit) return;
    setActionLoading(true);
    try {
      const result = await printerTokenService.generateToken(user?.email || 'admin@discreta.com');
      setNewlyCreatedToken(result.token);
      setShowTokenModal(true);
      toast("Token de integração gerado!", "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao gerar token", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Integration Token
  const handleRevokeToken = async (tokenId: string, preview: string) => {
    if (!canEdit) return;
    if (!confirm(`Tem certeza que deseja revogar o token ${preview}? Sistemas usando este token perderão a conexão.`)) return;
    try {
      await printerTokenService.revokeToken(tokenId, preview);
      toast(`Token ${preview} revogado com sucesso!`, "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao revogar token", "error");
    }
  };

  // Change Preferred Printer on Device
  const handleSelectPrinter = async (deviceId: string, deviceName: string, printerName: string) => {
    if (!canEdit) return;
    try {
      setDevicePrinterChangeId(deviceId);
      await printerDeviceService.setDefaultPrinter(deviceId, deviceName, printerName);
      toast(`Impressora padrão do dispositivo atualizada para ${printerName}!`, "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao alterar impressora padrão", "error");
    } finally {
      setDevicePrinterChangeId(null);
    }
  };

  // Block/Toggle device authentication state
  const handleToggleBlockDevice = async (device: PrinterDevice) => {
    if (!canEdit) return;
    const actionText = device.blocked ? "desbloquear" : "bloquear";
    if (!confirm(`Deseja ${actionText} o computador '${device.deviceName || device.deviceId}'?`)) return;
    try {
      await printerDeviceService.toggleDeviceBlock(device.deviceId, device.deviceName, device.blocked);
      toast(`Dispositivo ${actionText}ado com sucesso!`, "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao alterar bloqueio de computador", "error");
    }
  };

  // Set Global Preferences
  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit || !settings) return;
    setActionLoading(true);
    try {
      await printerSettingsService.updateSettings(settings);
      toast("Configurações de impressão salvas!", "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao salvar configurações", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Create Artificial Test Job
  const handleCreateTestJob = async (isPrintTest = false) => {
    if (!canEdit) return;
    setActionLoading(true);
    try {
      await printerJobService.createTestJob(isPrintTest);
      toast("Job de teste inserido com sucesso na fila de impressão!", "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao gerar job de teste", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Retry Print Job
  const handleRetryJob = async (job: PrinterJob) => {
    try {
      await printerJobService.retryJob(job.id!, job.orderNumber);
      toast(`Pedido #${job.orderNumber} reenviado para a fila de impressão!`, "success");
      await loadData(false);
    } catch (e) {
      toast("Erro ao reenviar job", "error");
    }
  };

  // Cancel Print Job
  const handleCancelJob = async (job: PrinterJob) => {
    if (!confirm(`Deseja cancelar a impressão do pedido #${job.orderNumber}?`)) return;
    try {
      await printerJobService.cancelJob(job.id!, job.orderNumber);
      toast(`Impressão do pedido #${job.orderNumber} cancelada.`, "warning");
      await loadData(false);
    } catch (e) {
      toast("Erro ao cancelar job", "error");
    }
  };

  // Helper metrics
  const stats = {
    totalDevices: devices.length,
    onlineDevices: devices.filter(d => {
      if (!d.online) return false;
      const lastSeen = d.lastSeenAt?.toMillis ? d.lastSeenAt.toMillis() : new Date(d.lastSeenAt).getTime();
      return Date.now() - lastSeen < 3 * 60 * 1000; // Heartbeat in the last 3 minutes
    }).length,
    pendingJobs: jobs.filter(j => j.status === 'pending').length,
    printingJobs: jobs.filter(j => j.status === 'printing').length,
    printedJobsCount: jobs.filter(j => j.status === 'printed').length,
    failedJobsCount: jobs.filter(j => j.status === 'failed').length,
    errorLogs: logs.filter(l => l.level === 'error').length
  };

  const menuItems = [
    { id: 'dashboard' as ActiveTabId, label: 'Painel Geral', icon: Printer },
    { id: 'tokens' as ActiveTabId, label: 'Tokens de Acesso', icon: ListOrdered },
    { id: 'devices' as ActiveTabId, label: 'Computadores Autores', icon: Laptop },
    { id: 'queue' as ActiveTabId, label: 'Fila de Impressão', icon: Clock },
    { id: 'logs' as ActiveTabId, label: 'Histórico & Logs', icon: FileText },
    { id: 'settings' as ActiveTabId, label: 'Ajustes Gerais', icon: SettingsIcon },
  ];

  if (loading && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[500px] gap-4 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-650 border-t-transparent"></div>
        <p className="text-xs uppercase font-bold tracking-widest">Sincronizando Módulos de Impressora...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen text-slate-100 bg-zinc-950">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-920 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-500">
              <Printer className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                AC-Printer Service
              </h1>
              <p className="text-sm text-zinc-400 font-sans mt-0.5">
                Central de administração para software local e fila de impressão automática de tickets de venda.
              </p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateTestJob(false)}
              disabled={actionLoading}
              className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs py-2 font-mono h-9"
            >
              Criar Job de Teste
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateTestJob(true)}
              disabled={actionLoading}
              className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs py-2 font-mono h-9"
            >
              Testar Impressão
            </Button>
            <button
              onClick={() => {
                loadData(true);
                toast("Fila e conexões sincronizadas!", "success");
              }}
              className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-white rounded-lg transition-colors h-9"
              title="Recarregar dados"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-zinc-900/50 border border-zinc-800/80 rounded-xl max-w-fit font-sans">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                isActive 
                  ? "bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/80" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-850"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-emerald-400" : "text-zinc-500")} />
              {item.label}
              {item.id === 'queue' && stats.pendingJobs > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUBPAGE CONTENTS */}

      {/* 1. DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Bento-style Status Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Online Status */}
            <div className="p-5 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">Status Geral</span>
                <span className={cn(
                  "p-1.5 rounded-lg text-emerald-400 bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold flex items-center gap-1.5"
                )}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ATIVO
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white font-mono">{stats.onlineDevices} / {stats.totalDevices}</h3>
                <p className="text-xs text-zinc-400 mt-1">Dispositivos AC-Printer Online</p>
              </div>
            </div>

            {/* Print Queue */}
            <div className="p-5 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">Pendentes</span>
                <Clock className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-amber-500 font-mono">
                  {stats.pendingJobs}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Recibos aguardando envio local</p>
              </div>
            </div>

            {/* Connected Systems */}
            <div className="p-5 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">Sucessos</span>
                <CheckCircle2 className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-100 font-mono">
                  {stats.printedJobsCount}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Cupons impressos com sucesso</p>
              </div>
            </div>

            {/* Error Indicators */}
            <div className="p-5 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">Falhas</span>
                <AlertCircle className={cn("h-5 w-5", stats.failedJobsCount > 0 ? "text-red-500" : "text-zinc-500")} />
              </div>
              <div>
                <h3 className={cn("text-2xl font-black font-mono", stats.failedJobsCount > 0 ? "text-red-400" : "text-zinc-100")}>
                  {stats.failedJobsCount}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Jobs falhados na sessão corrente</p>
              </div>
            </div>

          </div>

          {/* Quick Setup Checkups */}
          {stats.totalDevices === 0 && (
            <div className="p-6 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="space-y-1.5 max-w-xl text-center sm:text-left">
                <h4 className="font-bold text-white font-sans text-sm flex items-center justify-center sm:justify-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Nenhum dispositivo AC-Printer configurado ainda
                </h4>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Para iniciar as impressões automáticas de pedidos físicos e de delivery, você precisa conectar o aplicativo local AC-Printer utilizando um token de acesso de 24 horas gerado nesta central.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('tokens')}
                className="bg-zinc-805 hover:bg-zinc-800 border-zinc-750 font-sans text-xs shrink-0"
              >
                Gerar Token de Autenticação
              </Button>
            </div>
          )}

          {/* Recent Queued Activity Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Realtime printers Queue Preview */}
            <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-4 font-sans">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-white text-sm">Fila Monitorada Recente</h4>
                  <p className="text-xxs text-zinc-500 uppercase tracking-widest font-mono font-bold">Ultimos 5 cupons inseridos</p>
                </div>
                <Button 
                  variant="link" 
                  onClick={() => setActiveTab('queue')}
                  className="text-xs text-zinc-400 hover:text-emerald-400 p-0"
                >
                  Ver fila inteira
                </Button>
              </div>

              {jobs.slice(0, 5).length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                  <Clock className="h-8 w-8 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs font-mono">Nenhum ticket pendente ou na fila.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-850/60">
                  {jobs.slice(0, 5).map(job => (
                    <div key={job.id} className="py-3 flex items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-zinc-200">
                            Pedido #{job.orderNumber}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight uppercase",
                            job.status === 'pending' && "bg-amber-950/80 border border-amber-800/80 text-amber-400",
                            job.status === 'printing' && "bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 animate-pulse",
                            job.status === 'printed' && "bg-zinc-950 border border-zinc-800 text-zinc-500",
                            job.status === 'failed' && "bg-red-950/80 border border-red-800/80 text-red-400",
                            job.status === 'cancelled' && "bg-zinc-950 border border-zinc-800 text-zinc-500 line-through"
                          )}>
                            {job.status === 'pending' ? 'Pendente' : job.status === 'printing' ? 'Imprimindo' : job.status === 'printed' ? 'Impresso' : job.status === 'failed' ? 'Falhado' : 'Cancelado'}
                          </span>
                        </div>
                        <div className="text-xxs text-zinc-500 font-mono">
                          Tentativas: {job.attempts} / {job.maxAttempts} • {new Date(job.updatedAt?.toMillis ? job.updatedAt.toMillis() : job.updatedAt).toLocaleTimeString()}
                        </div>
                      </div>

                      {/* Control context quick action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canEdit && (job.status === 'failed' || job.status === 'printed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => handleRetryJob(job)}
                            className="p-1.5 bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all"
                            title="Reenviar para a fila"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canEdit && (job.status === 'pending' || job.status === 'printing') && (
                          <button
                            onClick={() => handleCancelJob(job)}
                            className="p-1.5 bg-zinc-850 border border-zinc-800 text-red-400/85 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-all"
                            title="Cancelar Impressão"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Logs activity Feed preview */}
            <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-4 font-sans">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-white text-sm">Monitor de Eventos Recentes</h4>
                  <p className="text-xxs text-zinc-500 uppercase tracking-widest font-mono font-bold">Diagnóstico em tempo real</p>
                </div>
                <Button 
                  variant="link" 
                  onClick={() => setActiveTab('logs')}
                  className="text-xs text-zinc-400 hover:text-emerald-400 p-0"
                >
                  Ver logs completos
                </Button>
              </div>

              {logs.slice(0, 5).length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                  <FileText className="h-8 w-8 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs font-mono">Nenhum evento registrado ainda.</p>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  {logs.slice(0, 5).map(log => (
                    <div key={log.id} className="flex gap-2 text-xxs leading-relaxed items-start">
                      <span className={cn(
                        "font-extrabold uppercase shrink-0 text-[9px]",
                        log.level === 'info' && "text-emerald-500",
                        log.level === 'warning' && "text-amber-500",
                        log.level === 'error' && "text-red-500"
                      )}>
                        [{log.level}]
                      </span>
                      <div className="flex-1 text-zinc-300">
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* 2. TOKENS TAB */}
      {activeTab === 'tokens' && (
        <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
            <div>
              <h4 className="text-white font-bold font-sans text-sm">Tokens de Integração</h4>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Utilizados para autorizar novas estações locais de impressão AC-Printer de uso único por 24 horas.
              </p>
            </div>
            {canEdit && (
              <Button
                onClick={handleGenerateToken}
                disabled={actionLoading}
                className="bg-emerald-650 hover:bg-emerald-600 hover:shadow-emerald shadow-sm border border-emerald-500 font-sans text-xs flex items-center gap-1.5 h-9"
              >
                <Plus className="h-4 w-4" />
                Gerar Token
              </Button>
            )}
          </div>

          {/* Tokens Data table list */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left font-mono text-xs h-[1px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-sans font-semibold">
                  <th className="py-3 px-4">Token Preview</th>
                  <th className="py-3 px-4">Gerado Por</th>
                  <th className="py-3 px-4">Data Criação</th>
                  <th className="py-3 px-4">Expiração (24h)</th>
                  <th className="py-3 px-4">Status</th>
                  {canEdit && <th className="py-3 px-4 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500 font-sans">
                      Nenhum token gerado até o momento. Clique em "Gerar Token" para começar.
                    </td>
                  </tr>
                ) : (
                  tokens.map(tk => {
                    const isExpired = tk.expiresAt?.toMillis 
                      ? Date.now() > tk.expiresAt.toMillis() 
                      : Date.now() > new Date(tk.expiresAt).getTime();
                    
                    const statusText = tk.revoked 
                      ? 'REVOGADO' 
                      : tk.used 
                        ? 'USADO' 
                        : isExpired 
                          ? 'EXPIRADO' 
                          : 'ATIVO';

                    return (
                      <tr key={tk.id} className="hover:bg-zinc-850/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-zinc-300">
                          {tk.tokenPreview}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-sans">
                          {tk.createdBy}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {tk.createdAt?.toMillis 
                            ? new Date(tk.createdAt.toMillis()).toLocaleString() 
                            : new Date(tk.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {tk.expiresAt?.toMillis 
                            ? new Date(tk.expiresAt.toMillis()).toLocaleString() 
                            : new Date(tk.expiresAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold tracking-tight",
                            statusText === 'ATIVO' && "bg-emerald-950/80 border border-emerald-800 text-emerald-400",
                            statusText === 'USADO' && "bg-zinc-950 border border-zinc-800 text-zinc-500",
                            statusText === 'EXPIRADO' && "bg-amber-950/85 border border-amber-800 text-amber-400",
                            statusText === 'REVOGADO' && "bg-red-950/80 border border-red-800 text-red-400"
                          )}>
                            {statusText}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="py-3.5 px-4 text-right">
                            {statusText === 'ATIVO' && (
                              <button
                                onClick={() => handleRevokeToken(tk.id!, tk.tokenPreview)}
                                className="text-zinc-400 hover:text-red-400 p-1 bg-zinc-850 hover:bg-zinc-800 rounded border border-zinc-800 transition-all font-sans text-xs"
                                title="Revogar Token"
                              >
                                Revogar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DEVICES TAB */}
      {activeTab === 'devices' && (
        <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-6">
          <div>
            <h4 className="text-white font-bold font-sans text-sm">Dispositivos AC-Printer</h4>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Computadores autorizados a rodar o AC-Printer Service e a buscar da fila de impressão.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {devices.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-zinc-500 font-sans border border-dashed border-zinc-850 rounded-xl">
                Nenhum sistema local conectado ainda. Conecte pelo terminal de impressão.
              </div>
            ) : (
              devices.map(device => {
                const lastSeenMillis = device.lastSeenAt?.toMillis ? device.lastSeenAt.toMillis() : new Date(device.lastSeenAt).getTime();
                const isOnline = Date.now() - lastSeenMillis < 3 * 60 * 1000;
                
                return (
                  <div key={device.id} className="p-5 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-4 font-sans relative">
                    {/* Block banner indicator */}
                    {device.blocked && (
                      <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] rounded-2xl flex items-center justify-center border border-red-900 pointer-events-none">
                        <span className="bg-red-650 text-white font-sans text-xs font-bold px-3 py-1 rounded-full shadow border border-red-550">
                          BLOQUEADO PELO ADMINISTRADOR
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg">
                          <Laptop className="h-5 w-5" />
                        </div>
                        <div>
                          <h5 className="font-bold text-white text-sm">{device.deviceName || device.deviceId}</h5>
                          <span className="text-xxs font-mono text-zinc-500 font-bold block mt-0.5">ID: {device.deviceId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight uppercase flex items-center gap-1",
                          isOnline ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600")}></span>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xxs font-mono bg-zinc-900/40 p-3 rounded-lg border border-zinc-850">
                      <div>
                        <span className="text-zinc-500">Sistema Operacional:</span>
                        <p className="text-zinc-300 font-bold mt-0.5">{device.os || 'Windows/Linux'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Versão AC-Printer:</span>
                        <p className="text-zinc-300 font-bold mt-0.5">v{device.appVersion || '1.0.0'}</p>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-zinc-850/60 mt-1">
                        <span className="text-zinc-500">Sincronizado em:</span>
                        <p className="text-zinc-350 font-sans mt-0.5">
                          {new Date(lastSeenMillis).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Detected Printers Section on this Device */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xxs font-extrabold text-zinc-500 uppercase tracking-widest">
                        <span>Impressoras Detectadas</span>
                        <span>Pref. Térmica</span>
                      </div>

                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {device.printers?.map(printer => {
                          const isDefaultPrnt = printer.name === device.defaultPrinter;
                          return (
                            <button
                              key={printer.name}
                              disabled={device.blocked || !canEdit || devicePrinterChangeId === device.deviceId}
                              onClick={() => handleSelectPrinter(device.deviceId, device.deviceName, printer.name)}
                              className={cn(
                                "w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between font-sans transition-all",
                                isDefaultPrnt 
                                  ? "bg-zinc-900/90 border-emerald-800 text-zinc-100" 
                                  : "bg-zinc-900/30 border-zinc-850/60 text-zinc-400 hover:border-zinc-800"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Printer className={cn("h-3.5 w-3.5", isDefaultPrnt ? "text-emerald-400" : "text-zinc-600")} />
                                <span className={cn("truncate max-w-[160px]", isDefaultPrnt && "font-bold text-emerald-400")}>
                                  {printer.name}
                                </span>
                                {printer.isDefault && <span className="text-[8px] bg-zinc-800 border border-zinc-700/80 px-1 py-0.5 rounded text-zinc-400 font-mono">Sist.</span>}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {printer.isThermalCandidate && (
                                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-tight">80mm</span>
                                )}
                                <div className={cn(
                                  "h-3 w-3 rounded-full border flex items-center justify-center transition-all",
                                  isDefaultPrnt ? "border-emerald-500 bg-emerald-500" : "border-zinc-700 bg-transparent"
                                )}>
                                  {isDefaultPrnt && <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick authorized operations */}
                    {canEdit && (
                      <div className="pt-2 border-t border-zinc-850 flex justify-end">
                        <button
                          onClick={() => handleToggleBlockDevice(device)}
                          className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded border transition-all",
                            device.blocked 
                              ? "bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900" 
                              : "bg-zinc-850 text-red-400/85 hover:text-red-400 border-zinc-800 hover:bg-zinc-800"
                          )}
                        >
                          {device.blocked ? "Desbloquear Computador" : "Bloquear Computador"}
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. QUEUE TAB */}
      {activeTab === 'queue' && (
        <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
            <div>
              <h4 className="text-white font-bold font-sans text-sm">Fila Monitorada</h4>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Pedidos aguardando ou disparados para as impressoras térmicas locais de cupons.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-sans font-semibold">
                  <th className="py-3 px-4">Código Pedido</th>
                  <th className="py-3 px-4">Estação Autorizada</th>
                  <th className="py-3 px-4">Impressora Destino</th>
                  <th className="py-3 px-4">Tentativas</th>
                  <th className="py-3 px-4">Data Envio</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Erro / Erro Logs</th>
                  {canEdit && <th className="py-3 px-4 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                      Nenhum job de impressão na fila encontrada.
                    </td>
                  </tr>
                ) : (
                  jobs.map(job => (
                    <tr key={job.id} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-zinc-200">
                        Pedido #{job.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-sans">
                        {job.assignedDeviceId || 'Qualquer computador'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {job.printerName || 'Padrão térmica'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {job.attempts} / {job.maxAttempts}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {new Date(job.updatedAt?.toMillis ? job.updatedAt.toMillis() : job.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase",
                          job.status === 'pending' && "bg-amber-950/80 border border-amber-800/80 text-amber-400",
                          job.status === 'printing' && "bg-emerald-950/80 border border-emerald-850/80 text-emerald-400",
                          job.status === 'printed' && "bg-zinc-950 border border-zinc-800 text-zinc-500",
                          job.status === 'failed' && "bg-red-950/80 border border-red-800/80 text-red-500",
                          job.status === 'cancelled' && "bg-zinc-100/10 border border-zinc-800 text-zinc-500 line-through"
                        )}>
                          {job.status === 'pending' ? 'Pendente' : job.status === 'printing' ? 'Imprimindo' : job.status === 'printed' ? 'Impresso' : job.status === 'failed' ? 'Falhado' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-red-400 font-sans text-xxs max-w-[150px] truncate" title={job.errorMessage}>
                        {job.errorMessage || '-'}
                      </td>
                      {canEdit && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Retry Action */}
                            {(job.status === 'failed' || job.status === 'printed' || job.status === 'cancelled') && (
                              <button
                                onClick={() => handleRetryJob(job)}
                                className="p-1 px-2 text-xxs font-sans font-bold bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded text-zinc-300 hover:text-white transition-all"
                                title="Reenviar"
                              >
                                Reenviar
                              </button>
                            )}

                            {/* Cancel Action */}
                            {(job.status === 'pending' || job.status === 'printing') && (
                              <button
                                onClick={() => handleCancelJob(job)}
                                className="p-1 px-2 text-xxs font-sans font-bold bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded text-red-400 hover:text-red-300 transition-all"
                                title="Cancelar"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-6">
          <div>
            <h4 className="text-white font-bold font-sans text-sm">Logs do Sistema AC-Printer</h4>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Auditoria de conexões, impressões, erros e ações administrativas relacionadas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-sans font-semibold">
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Tipo de Log</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Mensagem / Informação</th>
                  <th className="py-3 px-4">ID Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 leading-relaxed text-xxs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 font-sans">
                      Nenhum evento registrado.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="py-3 px-4 font-bold">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px]",
                          log.level === 'info' && "bg-emerald-950 text-emerald-400 border border-emerald-900/40",
                          log.level === 'warning' && "bg-amber-950 text-amber-400 border border-amber-900/40",
                          log.level === 'error' && "bg-red-950 text-red-400 border border-red-900/40"
                        )}>
                          {log.level.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-semibold truncate max-w-[120px]">
                        {log.type}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-sans">
                        {log.createdAt?.toMillis 
                          ? new Date(log.createdAt.toMillis()).toLocaleString() 
                          : new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-zinc-350 max-w-[400px] break-words">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {log.deviceId || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SETTINGS TAB */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-6 max-w-2xl font-sans">
          <div className="border-b border-zinc-850 pb-4">
            <h4 className="text-white font-bold text-sm">Configurações Gerais de Impressão</h4>
            <p className="text-xs text-zinc-405">
              Defina como e quando os cupons térmicos serão gerados e impressos.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Auto Print Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
              <div className="space-y-1 pr-4">
                <span className="text-xs font-bold text-white block">Envio p/ Impressão Automática</span>
                <p className="text-xxs text-zinc-400 leading-relaxed">
                  Permite que o software local AC-Printer dispare impressões automáticas no instante em que o pedido cai no status Novo.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={settings.autoPrint}
                onChange={e => setSettings({ ...settings, autoPrint: e.target.checked })}
                className="h-4 w-4 rounded bg-zinc-900 border-zinc-800 accent-emerald-500 cursor-pointer text-emerald-500"
              />
            </div>

            {/* Create Job on New Order */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
              <div className="space-y-1 pr-4">
                <span className="text-xs font-bold text-white block">Auto Criar Fila em Pedido Novo</span>
                <p className="text-xxs text-zinc-400 leading-relaxed">
                  Cria um printerJob pendente na fila para todo novo pedido que for criado na loja virtual ou no PDV físico.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={settings.createJobOnNewOrder}
                onChange={e => setSettings({ ...settings, createJobOnNewOrder: e.target.checked })}
                className="h-4 w-4 rounded bg-zinc-900 border-zinc-800 accent-emerald-500 cursor-pointer text-emerald-500"
              />
            </div>

            {/* Print Copies and Max Retries Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                <span className="text-xs font-bold text-white block">Cópias de Recibo</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  disabled={!canEdit}
                  value={settings.copies}
                  onChange={e => setSettings({ ...settings, copies: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white uppercase font-mono mt-1"
                />
              </div>

              <div className="space-y-1.5 p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                <span className="text-xs font-bold text-white block">Tentativas Máximas</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={!canEdit}
                  value={settings.maxRetries}
                  onChange={e => setSettings({ ...settings, maxRetries: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white uppercase font-mono mt-1"
                />
              </div>
            </div>

            {/* Paper Width Thermal Selection */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
              <span className="text-xs font-bold text-white block">Largura da Bobina Térmica</span>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                {['58mm', '80mm'].map(sz => {
                  const isSel = settings.paperWidth === sz;
                  return (
                    <button
                      type="button"
                      key={sz}
                      disabled={!canEdit}
                      onClick={() => setSettings({ ...settings, paperWidth: sz as '58mm' | '80mm' })}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs font-bold font-mono text-center flex items-center justify-center gap-2 transition-all",
                        isSel 
                          ? "bg-zinc-900 border-emerald-500 text-emerald-400" 
                          : "bg-zinc-900/30 border-zinc-850 text-zinc-500 hover:border-zinc-800"
                      )}
                    >
                      {sz} bobina
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sound Tones Notification */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
              <div className="space-y-1 pr-4">
                <span className="text-xs font-bold text-white block">Notificação Sonora</span>
                <p className="text-xxs text-zinc-400 leading-relaxed">
                  Toca um sinal sonoro no computador local autorizado sempre que um novo cupom for impresso.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={settings.soundNotification}
                onChange={e => setSettings({ ...settings, soundNotification: e.target.checked })}
                className="h-4 w-4 rounded bg-zinc-900 border-zinc-800 accent-emerald-500 cursor-pointer text-emerald-500"
              />
            </div>

            {/* Default Device Assigning and Printer Name Inputs */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
              <span className="text-xs font-bold text-white block">Designação de Dispositivo Padrão</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase font-sans">ID Computador Atendente</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: PC_CAIXA_PRINCIPAL"
                    value={settings.defaultDeviceId}
                    onChange={e => setSettings({ ...settings, defaultDeviceId: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase font-sans">Nome da Impressora Padrão</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: POS-80-Thermal"
                    value={settings.defaultPrinterName}
                    onChange={e => setSettings({ ...settings, defaultPrinterName: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono"
                  />
                </div>
              </div>
            </div>

          </div>

          {canEdit && (
            <div className="pt-4 border-t border-zinc-850 flex justify-end">
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-emerald-650 hover:bg-emerald-600 border border-emerald-500 font-sans text-xs h-9"
              >
                Salvar Configurações
              </Button>
            </div>
          )}

        </form>
      )}

      {/* SUB-MODAL FOR NEW GERATED TOKEN (ONCE VIEW) */}
      {showTokenModal && newlyCreatedToken && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 space-y-4 shadow-2xl relative font-sans">
            <button
              onClick={() => {
                setShowTokenModal(false);
                setNewlyCreatedToken(null);
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-amber-950/40 border border-amber-900 text-amber-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
              </div>
              <h4 className="text-white font-bold text-sm">COPIE O SEU TOKEN DE INTEGRAÇÃO</h4>
              <p className="text-xxs text-zinc-450 leading-relaxed px-2">
                Por motivos de extrema segurança de ponta-a-ponta, este token é criptografado e não será exibido novamente após fechar esta janela.
              </p>
            </div>

            {/* Token box display */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between font-mono text-xs">
              <span className="text-emerald-400 font-black tracking-wider break-all leading-normal select-all">
                {newlyCreatedToken}
              </span>
              <button
                onClick={() => handleCopyText(newlyCreatedToken, "Token")}
                className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-md transition-all shrink-0 ml-2"
                title="Copiar Token"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              onClick={() => {
                setShowTokenModal(false);
                setNewlyCreatedToken(null);
              }}
              className="w-full bg-zinc-800 hover:bg-zinc-750 text-white font-semibold text-xs py-2.5 rounded-lg border border-zinc-700/80 mt-2 h-9"
            >
              Copiado e Salvo
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
