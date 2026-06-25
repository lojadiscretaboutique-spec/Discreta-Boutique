import { useState, useEffect } from 'react';
import { mercadoPagoIntegrationService, MercadoPagoAdminConfig } from '../../../services/mercadoPagoIntegrationService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { 
  ShieldCheck, 
  ExternalLink, 
  Info, 
  Activity, 
  Copy, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  CreditCard, 
  Smartphone, 
  Lock,
  Compass,
  AlertCircle
} from 'lucide-react';

export function AdminIntegracao() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);

  // Core administrative configurations
  const [config, setConfig] = useState<MercadoPagoAdminConfig>({
    enabled: false,
    environment: 'sandbox',
    publicKey: '',
    accessToken: '',
    pixEnabled: true,
    creditCardEnabled: true,
    debitEnabled: false,
    webhookUrl: '',
    webhookConfigured: false,
    lastValidationAt: null,
    lastValidationStatus: null,
    accountName: null,
    accountId: null
  });

  // Load backend configurations
  async function loadConfig() {
    try {
      const data = await mercadoPagoIntegrationService.getConfig();
      setConfig(data);
      setIsEditingToken(false);
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar conexões do Mercado Pago.", 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: MercadoPagoAdminConfig = {
        ...config,
        // Auto-generate webhook url if empty
        webhookUrl: config.webhookUrl || `${window.location.origin}/api/webhooks/mercadopago`
      };
      await mercadoPagoIntegrationService.saveConfig(payload);
      toast("Configurações do Mercado Pago salvas com sucesso!", 'success');
      // Re-load to ensure we display the masked token correctly
      await loadConfig();
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Erro ao salvar as configurações.", 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Connection Test
  const handleTestConnection = async () => {
    if (!config.publicKey) {
      toast("Insira a Public Key antes de testar.", 'warning');
      return;
    }

    setTesting(true);
    try {
      const response = await mercadoPagoIntegrationService.testConnection(
        config.publicKey,
        config.environment
      );
      
      setConfig(prev => ({
        ...prev,
        accountName: response.accountName,
        accountId: response.accountId,
        lastValidationAt: response.lastValidationAt,
        lastValidationStatus: response.lastValidationStatus
      }));
      
      toast(`Conexão bem sucedida com a conta: ${response.accountName}!`, 'success');
    } catch (err: any) {
      console.error(err);
      setConfig(prev => ({
        ...prev,
        lastValidationStatus: 'failed',
        lastValidationAt: new Date().toISOString()
      }));
      toast(err.message || "Falha na validação das credenciais.", 'error');
    } finally {
      setTesting(false);
    }
  };

  // Copy Webhook URL to Clipboard
  const copyWebhookUrl = () => {
    const url = config.webhookUrl || `${window.location.origin}/api/webhooks/mercadopago`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast("URL do Webhook copiada!", 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <RefreshCw className="animate-spin inline-block mb-3" size={28} />
        <p className="text-sm font-sans tracking-wide">Carregando integração Mercado Pago...</p>
      </div>
    );
  }

  const generatedWebhookUrl = config.webhookUrl || `${window.location.origin}/api/webhooks/mercadopago`;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-4 font-sans text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
            Integração Mercado Pago
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure de forma segura seus recebimentos de Pix e Cartão na loja virtual Discreta Boutique.
          </p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold border border-emerald-500/20 self-start md:self-center">
          <ShieldCheck size={14} /> Canal de Transações Protegido
        </div>
      </div>

      {/* Connection summary bar if verified */}
      {config.lastValidationStatus === 'success' && config.accountName && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
              <Check size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Integração Ativa e Conectada</p>
              <p className="text-xs text-slate-450 mt-0.5">
                Conta: <span className="text-slate-350 font-mono font-bold">{config.accountName}</span> ({config.accountId})
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400 text-right shrink-0">
            Última validação: {config.lastValidationAt ? new Date(config.lastValidationAt).toLocaleString('pt-BR') : 'N/A'}
          </div>
        </div>
      )}

      {config.lastValidationStatus === 'failed' && (
        <div className="mb-6 p-4 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-400">Falha na Verificação das Credenciais</p>
            <p className="text-xs text-slate-350 mt-1">
              O token de acesso ou chaves configuradas estão inválidos ou expirados. Por favor revise seus dados.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* APP CREDENTIALS CARD */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-black text-xs">MP</div>
            <h2 className="text-lg font-bold tracking-tight text-white">Chaves de API (Segurança do Servidor)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1"><Lock size={10} /> Access Token Privado</span>
                {!isEditingToken && config.accessToken && (
                  <button 
                    type="button" 
                    onClick={() => { setIsEditingToken(true); setConfig({...config, accessToken: ''}); }}
                    className="text-white hover:text-blue-400 text-[10px] lowercase transition-colors"
                  >
                    substituir
                  </button>
                )}
              </label>
              {!isEditingToken && config.accessToken ? (
                <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-slate-400 font-mono text-sm items-center justify-between">
                  <span>{config.accessToken}</span>
                </div>
              ) : (
                <Input 
                  type="password"
                  value={config.accessToken}
                  onChange={e => setConfig({...config, accessToken: e.target.value})}
                  placeholder="APP_USR-..."
                  className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-600 font-mono"
                  autoComplete="off"
                />
              )}
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5 leading-relaxed">
                <Info size={12} className="text-blue-500 shrink-0" />
                Dica: O token é criptografado e mascarado após salvar. Nunca exposto a clientes públicos.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Public Key Pública</label>
              <Input 
                value={config.publicKey}
                onChange={e => setConfig({...config, publicKey: e.target.value})}
                placeholder="APP_USR-..."
                className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-600 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-2">
                Usado para carregar com segurança o SDK oficial do Checkout Transparente.
              </p>
            </div>
          </div>

          {/* HELP COMPONENT */}
          <div className="mt-8 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center shrink-0 border border-blue-500/20">
              <ExternalLink size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Como obter credenciais oficiais do Mercado Pago?</p>
              <p className="text-xs text-slate-450 mt-1 leading-relaxed">
                Acesse o painel oficial de desenvolvedores do Mercado Pago, crie sua aplicação em produção e copie a <b>Chave Pública</b> e o <b>Access Token</b>.
              </p>
              <a 
                href="https://www.mercadopago.com.br/developers/panel" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 font-bold text-xs mt-2.5 inline-flex items-center gap-1 hover:underline hover:text-blue-300"
              >
                Abrir Painel de Credenciais &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* STATUS AND ENVIROMENT CARD */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold mb-6 tracking-tight text-white flex items-center gap-2">
            <Activity size={18} className="text-red-500" /> Status da Operação e Ambiente
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ENABLE/DISABLE INSTEAD */}
            <div className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-200">Status do Provedor</p>
                <p className="text-[11px] text-slate-450 mt-1">Ativa o Mercado Pago como motor de pagamento na loja.</p>
              </div>
              <button 
                type="button"
                onClick={() => setConfig({...config, enabled: !config.enabled})}
                className={cn(
                  "w-12 h-7 rounded-full transition-all relative p-0.5 shrink-0 focus:outline-none",
                  config.enabled ? "bg-emerald-500" : "bg-slate-700"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-slate-950 rounded-full shadow-lg transition-all transform",
                  config.enabled ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            </div>

            {/* ENVIRONMENT STATUS */}
            <div className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-200">Ambiente de Transação</p>
                <p className="text-[11px] text-slate-450 mt-1">Defina para produção ou sandbox para testes virtuais.</p>
              </div>
              <div className="flex border border-slate-700 rounded-lg p-0.5 bg-slate-950 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfig({...config, environment: 'sandbox'})}
                  className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase rounded transition-all",
                    config.environment === 'sandbox' ? "bg-blue-600 text-white" : "text-slate-450 hover:text-slate-100"
                  )}
                >
                  Testes (Sandbox)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({...config, environment: 'production'})}
                  className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase rounded transition-all",
                    config.environment === 'production' ? "bg-amber-600 text-white" : "text-slate-450 hover:text-slate-100"
                  )}
                >
                  Produção
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* WEBHOOK NOTIFICATIONS CARD */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Compass size={18} className="text-blue-500" /> Endpoint de Webhook Oficial
            </h2>
            <div className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
              config.webhookConfigured 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              {config.webhookConfigured ? 'Verificado & Ativos' : 'Aguardando Sincronía'}
            </div>
          </div>
          <p className="text-xs text-slate-450 leading-relaxed mb-4">
            Cadastre esta URL de notificações no Mercado Pago para atualizar instantaneamente o status de pagamentos, estoques e gerar faturamento de recebíveis quando as transações Pix ou cartões forem confirmadas.
          </p>

          <div className="flex gap-2 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input 
              type="text" 
              readOnly 
              value={generatedWebhookUrl}
              className="bg-transparent text-slate-300 font-mono text-xs flex-1 border-none focus:outline-none focus:ring-0 leading-relaxed overflow-x-auto select-all" 
            />
            <button 
              type="button" 
              onClick={copyWebhookUrl}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold font-sans"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-3 italic flex items-center gap-1 leading-relaxed">
            <Info size={12} className="shrink-0" />
            Vá em Aplicações &rarr; Suas Aplicações &rarr; Webhooks e configure os eventos "payment.created" e "payment.updated" direcionados para a URL acima.
          </p>
        </div>

        {/* PAYMENT METHODS INCLUDED */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold mb-5 tracking-tight text-white flex items-center gap-2">
            <CreditCard size={18} className="text-purple-500" /> Métodos de Checkout Disponíveis
          </h2>
          <p className="text-xs text-slate-450 leading-relaxed mb-6">
            Selecione quais serviços de faturamento online deseja delegar à inteligência de processamento integrado do Mercado Pago.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* PIX */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                  <Smartphone size={16} />
                </div>
                <button 
                  type="button"
                  onClick={() => setConfig({...config, pixEnabled: !config.pixEnabled})}
                  className={cn(
                    "w-9 h-5 rounded-full transition-all relative p-0.5 focus:outline-none",
                    config.pixEnabled ? "bg-cyan-500" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-slate-950 rounded-full transition-all transform",
                    config.pixEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Pix Instantâneo</p>
                <p className="text-[10px] text-slate-500 mt-1">QRCode copia e cola automático (Venda Segura)</p>
              </div>
            </div>

            {/* CRED CARD */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <CreditCard size={16} />
                </div>
                <button 
                  type="button"
                  onClick={() => setConfig({...config, creditCardEnabled: !config.creditCardEnabled})}
                  className={cn(
                    "w-9 h-5 rounded-full transition-all relative p-0.5 focus:outline-none",
                    config.creditCardEnabled ? "bg-indigo-500" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-slate-950 rounded-full transition-all transform",
                    config.creditCardEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Cartão de Crédito</p>
                <p className="text-[10px] text-slate-500 mt-1">Checkout transparente com antifraude nativo</p>
              </div>
            </div>

            {/* DEBIT CARD */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                  <span className="text-[11px] font-black tracking-tighter">D</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setConfig({...config, debitEnabled: !config.debitEnabled})}
                  className={cn(
                    "w-9 h-5 rounded-full transition-all relative p-0.5 focus:outline-none",
                    config.debitEnabled ? "bg-amber-500" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-slate-950 rounded-full transition-all transform",
                    config.debitEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Débito Virtual Caixa</p>
                <p className="text-[10px] text-slate-500 mt-1">Faturamento via débito seguro integrado</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mt-8 pt-4">
          <Button 
            type="button" 
            onClick={handleTestConnection} 
            disabled={testing || saving}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 px-8 rounded-full font-black uppercase tracking-wider text-xs border border-slate-700 flex items-center justify-center gap-2"
          >
            <RefreshCw className={cn("shrink-0", testing && "animate-spin")} size={14} />
            {testing ? 'Verificando...' : 'Testar Conexão'}
          </Button>

          <Button 
            type="submit" 
            disabled={saving || testing} 
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 h-12 px-10 rounded-full font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="animate-spin shrink-0" size={14} />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar Alterações</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
