import { useState, useEffect } from 'react';
import { settingsService, MercadoPagoSettings } from '../../../services/settingsService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ShieldCheck, ExternalLink, Info } from 'lucide-react';

export function AdminIntegracao() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MercadoPagoSettings>({
    accessToken: '',
    publicKey: '',
    active: false,
    testMode: true
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await settingsService.getMercadoPagoSettings();
        setSettings(data);
      } catch (err) {
        console.error(err);
        toast("Erro ao carregar configurações", 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.saveMercadoPagoSettings(settings);
      toast("Configurações salvas com sucesso!", 'success');
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar configurações", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">Integração Mercado Pago</h1>
          <p className="text-sm text-slate-400">Configure suas credenciais para receber pagamentos via PIX e Cartão.</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold border border-blue-100">
          <ShieldCheck size={16} /> Conexão Segura
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-slate-900 rounded-[2rem] border border-slate-700 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-black text-xs">MP</div>
            <h2 className="text-lg font-bold">Credenciais do Aplicativo</h2>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Access Token</label>
              <Input 
                type="password"
                value={settings.accessToken}
                onChange={e => setSettings({...settings, accessToken: e.target.value})}
                placeholder="APP_USR-..."
                className="bg-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <Info size={12} /> Nunca compartilhe seu Access Token com ninguém.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">Public Key</label>
              <Input 
                value={settings.publicKey}
                onChange={e => setSettings({...settings, publicKey: e.target.value})}
                placeholder="APP_USR-..."
                className="bg-slate-800"
              />
            </div>
          </div>

          <div className="mt-8 p-4 bg-slate-800 rounded-2xl border border-slate-100 flex items-start gap-4">
             <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center shrink-0 border border-slate-700">
                <ExternalLink size={20} className="text-blue-600" />
             </div>
             <div>
                <p className="text-sm font-bold text-slate-100 italic tracking-tight">Onde encontro minhas credenciais?</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Acesse o painel do desenvolvedor do Mercado Pago, crie uma aplicação e vá em "Credenciais de Produção".
                </p>
                <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-xs mt-2 inline-block hover:underline">
                  Abrir Painel do Desenvolvedor &rarr;
                </a>
             </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] border border-slate-700 p-8 shadow-sm">
          <h2 className="text-lg font-bold mb-6">Status e Modo</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold">Ativar Integração</p>
                <p className="text-xs text-slate-400">Habilita ou desabilita o Mercado Pago como checkout principal.</p>
              </div>
              <button 
                type="button"
                onClick={() => setSettings({...settings, active: !settings.active})}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  settings.active ? "bg-red-600" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-slate-900 rounded-full shadow-md transition-all",
                  settings.active ? "ml-6" : "ml-0"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold">Modo Sandbox (Teste)</p>
                <p className="text-xs text-slate-400">Use credenciais de teste para simular pagamentos sem cobrança real.</p>
              </div>
              <button 
                type="button"
                onClick={() => setSettings({...settings, testMode: !settings.testMode})}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  settings.testMode ? "bg-blue-600" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-slate-900 rounded-full shadow-md transition-all",
                  settings.testMode ? "ml-6" : "ml-0"
                )} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
           <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 h-14 px-10 rounded-full font-black uppercase tracking-widest text-xs">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
           </Button>
        </div>
      </form>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
