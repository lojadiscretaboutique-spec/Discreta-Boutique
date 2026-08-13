import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../lib/firebase';
import { storage } from '../../lib/storage';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  Moon, 
  Sun, 
  LayoutDashboard, 
  Check, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Settings, 
  RefreshCcw,
  Percent,
  ShieldAlert,
  Clock,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  AlertTriangle,
  DollarSign,
  CheckSquare
} from 'lucide-react';
import { DiscountReasonsManager } from '../../components/admin/DiscountReasonsManager';
import { useFeedback } from '../../contexts/FeedbackContext';
import { cn } from '../../lib/utils';
import { cacheService } from '../../services/cacheService';
import { 
  PDVDiscountConfig, 
  DEFAULT_PDV_DISCOUNT_CONFIG, 
  DiscountAuthCondition 
} from '../../types/pdvDiscount';

interface StoreConfig {
  storeName: string;
  whatsapp: string;
  deliveryFee: string | number;
  address: string;
  instagram: string;
  logoUrl?: string;
  botConversaWebhook?: string;
  orderMessageTemplate?: string;
  pdvDiscountConfig?: PDVDiscountConfig;
}

export function AdminConfig() {
  const { hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [systemVersion, setSystemVersion] = useState('1.1.0');
  const [updatingVersion, setUpdatingVersion] = useState(false);

  const canEdit = hasPermission('settings', 'editar');
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('admin-theme') as 'dark' | 'light') || 'dark';
  });

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('admin-theme', newTheme);
    window.dispatchEvent(new Event('admin-theme-changed'));
  };
  
  const [config, setConfig] = useState<StoreConfig & { botConversaWebhook?: string }>({
    storeName: 'Discreta Boutique',
    whatsapp: '5511999999999',
    deliveryFee: '15.00',
    address: '',
    instagram: '',
    logoUrl: '',
    botConversaWebhook: '',
    orderMessageTemplate: '',
  });

  const [pdvDiscount, setPdvDiscount] = useState<PDVDiscountConfig>(DEFAULT_PDV_DISCOUNT_CONFIG);

  useEffect(() => {
    async function loadConfig() {
      try {
        const docRef = doc(db, 'settings', 'store');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setConfig(prev => ({ ...prev, ...data }));
          if (data.pdvDiscountConfig) {
            setPdvDiscount({
              ...DEFAULT_PDV_DISCOUNT_CONFIG,
              ...data.pdvDiscountConfig
            });
          }
        }

        // Pull current app code version from Firestore
        const statusRef = doc(db, 'settings', 'system_status');
        const statusSnap = await getDoc(statusRef);
        if (statusSnap.exists()) {
          setSystemVersion(statusSnap.data().app_code_version || '1.1.0');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `branding/logo_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setConfig(prev => ({ ...prev, logoUrl: url }));
      toast("Logo carregada com sucesso! Não esqueça de salvar as configurações.");
    } catch (error) {
      console.error(error);
      toast("Erro ao carregar logo", 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'store'), {
        ...config,
        deliveryFee: Number(config.deliveryFee),
        pdvDiscountConfig: pdvDiscount
      }, { merge: true });
      setSaved(true);
      toast("Configurações salvas com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast("Erro ao salvar configurações", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    console.log('Renderizando componente: AdminConfig (loading)');
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
        <div className="h-8 w-8 border-2 border-red-650 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.3)] mb-4" />
        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase animate-pulse">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Configurações do Sistema</h1>
        <p className="text-sm text-slate-500">Gerencie a identidade e o comportamento do seu painel administrativo.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-600" />
              Institucional
            </h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium">Logo da Loja (Ícone e Redes Sociais)</label>
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 transition-colors">
                  <div className="relative w-24 h-24 bg-white dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 shrink-0">
                    {config.logoUrl ? (
                      <img src={config.logoUrl || undefined} alt="Logo preview" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        disabled={!canEdit || uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {config.logoUrl ? 'Trocar' : 'Upload'}
                      </Button>
                      {config.logoUrl && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          disabled={!canEdit}
                          onClick={() => setConfig({...config, logoUrl: ''})}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Recomendado: 512x512px (PNG/JPG).</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleLogoUpload} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da Loja</label>
                  <Input value={config.storeName} onChange={e=>setConfig({...config, storeName: e.target.value})} className="dark:bg-slate-950 dark:border-slate-800" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Taxa de Entrega (R$)</label>
                  <Input type="number" step="0.01" value={config.deliveryFee} onChange={e=>setConfig({...config, deliveryFee: e.target.value})} className="dark:bg-slate-950 dark:border-slate-800" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp (DDI + DDD + Número)</label>
                <Input value={config.whatsapp} onChange={e=>setConfig({...config, whatsapp: e.target.value})} placeholder="5511999999999" className="dark:bg-slate-950 dark:border-slate-800" />
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Ex: 5511999998888</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Endereço da Loja (Opcional)</label>
                <Input value={config.address} onChange={e=>setConfig({...config, address: e.target.value})} placeholder="Rua exemplo, 123..." className="dark:bg-slate-950 dark:border-slate-800" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Link do Instagram</label>
                <Input value={config.instagram} onChange={e=>setConfig({...config, instagram: e.target.value})} placeholder="https://instagram.com/..." className="dark:bg-slate-950 dark:border-slate-800" />
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-black">Nota: As configurações de WebHook da Bot Conversa foram movidas para a aba dedicada no menu lateral.</p>
              </div>
              
              {canEdit ? (
                <Button type="submit" disabled={saving || uploading} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20">
                  {saved ? <><Check className="mr-2" /> Alterações Salvas</> : saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-slate-500 font-bold text-xs border-2 border-dashed border-slate-200 dark:border-slate-700">
                  Sem permissão para edição
                </div>
              )}
            </form>
          </div>

          {/* Controle de Descontos do PDV */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Controle de Descontos do PDV</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Defina os limites de autorização de desconto por perfil, regras e segurança do caixa.</p>
                </div>
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                pdvDiscount.enabled 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {pdvDiscount.enabled ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Ativar controle */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <label className="text-sm font-bold text-slate-900 dark:text-slate-100 block cursor-pointer" htmlFor="toggle-pdv-discount">
                    Ativar controle de autorização de descontos
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quando ativado, os caixas deverão solicitar autorização por PIN se ultrapassarem os limites configurados.
                  </p>
                </div>
                <input
                  id="toggle-pdv-discount"
                  type="checkbox"
                  checked={pdvDiscount.enabled}
                  onChange={e => setPdvDiscount(prev => ({ ...prev, enabled: e.target.checked }))}
                  disabled={!canEdit}
                  className="w-5 h-5 accent-red-600 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* Grid de Limites por Perfil */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-red-600" /> Limites de Desconto por Função
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Caixa */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Operador de Caixa
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pdvDiscount.caixaMaxPercent}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, caixaMaxPercent: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (R$)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pdvDiscount.caixaMaxAmount}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, caixaMaxAmount: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gerente */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Gerente
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pdvDiscount.gerenteMaxPercent}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, gerenteMaxPercent: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (R$)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pdvDiscount.gerenteMaxAmount}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, gerenteMaxAmount: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Administrador */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Administrador
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pdvDiscount.adminMaxPercent}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, adminMaxPercent: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (R$)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pdvDiscount.adminMaxAmount}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, adminMaxAmount: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Proprietário */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Proprietário
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pdvDiscount.proprietarioMaxPercent}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, proprietarioMaxPercent: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Limite (R$)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pdvDiscount.proprietarioMaxAmount}
                          onChange={e => setPdvDiscount(prev => ({ ...prev, proprietarioMaxAmount: Number(e.target.value) }))}
                          disabled={!canEdit}
                          className="dark:bg-slate-900 dark:border-slate-800 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limites Máximos Absolutos */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-500/5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Teto Máximo Absoluto do Sistema
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma autorização (mesmo de perfil elevado) poderá ultrapassar estes valores teto.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Percentual Máximo Absoluto (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={pdvDiscount.absoluteMaxPercent}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, absoluteMaxPercent: Number(e.target.value) }))}
                      disabled={!canEdit}
                      className="dark:bg-slate-900 dark:border-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Valor Máximo Absoluto (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pdvDiscount.absoluteMaxAmount}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, absoluteMaxAmount: Number(e.target.value) }))}
                      disabled={!canEdit}
                      className="dark:bg-slate-900 dark:border-slate-800 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Condição para Exigir Autorização */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Gatilho de Autorização
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Defina quando o sistema deve exigir autorização de perfil superior:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { id: 'EITHER', title: 'Qualquer um dos dois', desc: 'Exige PIN ao ultrapassar o percentual OU o valor em R$' },
                    { id: 'PERCENTAGE', title: 'Somente Percentual', desc: 'Exige PIN apenas ao ultrapassar o limite percentual (%)' },
                    { id: 'AMOUNT', title: 'Somente Valor (R$)', desc: 'Exige PIN apenas ao ultrapassar o limite em dinheiro (R$)' },
                    { id: 'BOTH', title: 'Ambos Simultaneamente', desc: 'Exige PIN somente se ultrapassar o percentual E o valor em R$' },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3",
                        pdvDiscount.requireAuthCondition === item.id
                          ? "border-red-600 bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <input
                        type="radio"
                        name="requireAuthCondition"
                        value={item.id}
                        checked={pdvDiscount.requireAuthCondition === item.id}
                        onChange={e => setPdvDiscount(prev => ({ ...prev, requireAuthCondition: e.target.value as DiscountAuthCondition }))}
                        disabled={!canEdit}
                        className="mt-0.5 accent-red-600"
                      />
                      <div>
                        <span className="text-xs font-bold block">{item.title}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">{item.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Exigências e Regras de Negócio */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-blue-500" /> Regras e Obrigatoriedades
                </h3>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pdvDiscount.requireReason}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, requireReason: e.target.checked }))}
                      disabled={!canEdit}
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Exigir motivo para desconto</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">O operador deverá selecionar um motivo pré-cadastrado ao conceder desconto.</span>
                    </div>
                  </label>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Exigir observação por escrito</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Tornar campo de observação obrigatório para descontos acima deste percentual:</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={pdvDiscount.requireNoteAbovePercent}
                        onChange={e => setPdvDiscount(prev => ({ ...prev, requireNoteAbovePercent: Number(e.target.value) }))}
                        disabled={!canEdit}
                        className="w-20 dark:bg-slate-900 dark:border-slate-800 text-sm font-bold text-center"
                      />
                      <span className="text-xs font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pdvDiscount.blockBelowCost}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, blockBelowCost: e.target.checked }))}
                      disabled={!canEdit}
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Bloquear venda abaixo do custo</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Impede que descontos reduzam o valor de venda para abaixo do custo do produto.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pdvDiscount.invalidateOnCartChange}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, invalidateOnCartChange: e.target.checked }))}
                      disabled={!canEdit}
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Invalidar autorização ao alterar o carrinho</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Cancela a liberação do supervisor se itens forem adicionados, alterados ou removidos do carrinho.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Validade e Segurança do PIN */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-purple-500" /> Segurança e Sessão do PIN
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Validade da Autorização (min)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={pdvDiscount.authValidityMinutes}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, authValidityMinutes: Number(e.target.value) }))}
                      disabled={!canEdit}
                      className="dark:bg-slate-950 dark:border-slate-800 text-sm font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tempo útil do PIN liberado</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Máx. Erros de PIN
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={pdvDiscount.maxPinAttempts}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, maxPinAttempts: Number(e.target.value) }))}
                      disabled={!canEdit}
                      className="dark:bg-slate-950 dark:border-slate-800 text-sm font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tentativas incorretas seguidas</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tempo de Bloqueio (min)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={pdvDiscount.pinLockoutMinutes}
                      onChange={e => setPdvDiscount(prev => ({ ...prev, pinLockoutMinutes: Number(e.target.value) }))}
                      disabled={!canEdit}
                      className="dark:bg-slate-950 dark:border-slate-800 text-sm font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Bloqueio após exceder limite</span>
                  </div>
                </div>
              </div>

              {canEdit ? (
                <Button type="submit" disabled={saving} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 mt-4">
                  {saved ? <><Check className="mr-2" /> Alterações Salvas</> : saving ? 'Salvando...' : 'Salvar Configurações de Desconto'}
                </Button>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-slate-500 font-bold text-xs border-2 border-dashed border-slate-200 dark:border-slate-700">
                  Sem permissão para edição
                </div>
              )}
            </form>

            {/* Subseção: Motivos de Desconto */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <DiscountReasonsManager canEdit={canEdit} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Appearance Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-red-600" />
              Aparência
            </h2>
            
            <div className="space-y-6">
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tema do Painel</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
                      theme === 'light' 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Sun size={16} />
                    Claro
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
                      theme === 'dark' 
                        ? "bg-slate-800 text-white shadow-sm" 
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <Moon size={16} />
                    Escuro
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Modo Escuro</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Alternar rapidamente</span>
                  </div>
                  <button
                    onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none",
                      theme === 'dark' ? "bg-red-600" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300",
                      theme === 'dark' ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Controle de Versão e Cache */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-red-650 animate-pulse" />
              Versão do Sistema & Cache
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Sempre que houver alteração crítica nas fontes, imagens ou dados do catálogo, você pode forçar a reinicialização limpa em todos os celulares, tablets ou PCs de seus clientes de forma instantânea.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sua versão atual ativa</span>
                  <span className="text-2xl font-black tracking-wider text-red-600 font-mono italic">
                    v{systemVersion}
                  </span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={updatingVersion}
                    onClick={async () => {
                      const match = systemVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
                      let nextV = '1.1.1';
                      if (match) {
                        const major = parseInt(match[1], 10);
                        const minor = parseInt(match[2], 10);
                        const patch = parseInt(match[3], 10);
                        nextV = `${major}.${minor}.${patch + 1}`;
                      } else {
                        nextV = systemVersion + '.1';
                      }
                      setUpdatingVersion(true);
                      try {
                        await cacheService.updateAppVersion(nextV);
                        setSystemVersion(nextV);
                        toast(`Versão incrementada e atualizada para ${nextV}! Todos os clientes reinstalarão na próxima abertura.`);
                      } catch {
                        toast("Falha ao incrementar versão", 'error');
                      } finally {
                        setUpdatingVersion(false);
                      }
                    }}
                    className="h-10 px-3.5 text-[10px] uppercase font-black tracking-wider rounded-xl border border-red-600/20 text-red-600 hover:bg-red-650 hover:text-white transition-all shadow-md active:scale-95"
                  >
                    🚀 Auto Incrementar
                  </button>
                )}
              </div>

              {canEdit ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Atualizar Versão Manualmente</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={systemVersion}
                        onChange={(e) => setSystemVersion(e.target.value)}
                        placeholder="Ex: 1.1.2"
                        className="bg-slate-50 dark:bg-slate-950 dark:border-slate-800 h-11 focus:border-red-600 font-mono text-center text-sm rounded-xl"
                      />
                      <Button
                        type="button"
                        onClick={async () => {
                          if (!systemVersion.trim()) return;
                          setUpdatingVersion(true);
                          try {
                            await cacheService.updateAppVersion(systemVersion);
                            toast(`Versão ativa configurada para ${systemVersion}! Todos os dispositivos farão bust de cache na próxima carga.`);
                          } catch {
                            toast("Falha ao atualizar versão externa", 'error');
                          } finally {
                            setUpdatingVersion(false);
                          }
                        }}
                        disabled={updatingVersion}
                        className="h-11 px-5 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/15 shrink-0"
                      >
                        {updatingVersion ? 'Gravando...' : 'Aplicar'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-450 italic mt-1 font-medium leading-relaxed">
                    * Os dispositivos dos clientes sincronizam em segundo plano ao abrir o site. Eventuais divergências redefinem o cache local na mesma fração de segundo de forma transparente!
                  </p>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 uppercase font-black text-center p-3 bg-slate-100 dark:bg-slate-950 rounded-xl">
                  Somente administradores de TI podem forçar bust de versão.
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 p-6">
             <h3 className="text-red-900 dark:text-red-400 font-bold text-sm mb-2">Suporte Técnico</h3>
             <p className="text-xs text-red-800 dark:text-red-300/70 leading-relaxed">
               Caso precise de ajuda com as configurações ou customizações, entre em contato com o suporte.
             </p>
             <Link to="/admin" className="text-red-600 dark:text-red-400 text-xs font-bold mt-4 inline-block hover:underline">
               Abrir Ticket de Suporte
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
