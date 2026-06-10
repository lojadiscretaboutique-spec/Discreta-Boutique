import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Moon, Sun, LayoutDashboard, Check, Upload, Image as ImageIcon, Trash2, Settings, RefreshCcw, Truck } from 'lucide-react';
import { useFeedback } from '../../contexts/FeedbackContext';
import { cn } from '../../lib/utils';
import { cacheService } from '../../services/cacheService';
import { DeliveryConfigPanel } from '../../components/delivery/DeliveryConfigPanel';

interface StoreConfig {
  storeName: string;
  whatsapp: string;
  deliveryFee: string | number;
  address: string;
  instagram: string;
  logoUrl?: string;
  botConversaWebhook?: string;
  orderMessageTemplate?: string;
}

export function AdminConfig() {
  const { hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [systemVersion, setSystemVersion] = useState('1.1.0');
  const [updatingVersion, setUpdatingVersion] = useState(false);
  const [activeTab, setActiveTab ] = useState<'geral' | 'entrega'>('geral');

  const canEdit = hasPermission('settings', 'editar');
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
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

  const [deliveryConfig, setDeliveryConfig] = useState({
    storeLatitude: -23.55052,
    storeLongitude: -46.633308,
    fixedFee: 3.00,
    pricePerKm: 1.50,
    minimumDeliveryFee: 5.00,
    maxRadiusKm: 8.0,
    freeShippingAbove: 150.00,
    freeShippingRadiusKm: 3.0
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const docRef = doc(db, 'settings', 'store');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setConfig(prev => ({ ...prev, ...snap.data() }));
        }

        // Pull deliverySettings from Firestore
        const deliveryRef = doc(db, 'deliverySettings', 'config');
        const deliverySnap = await getDoc(deliveryRef);
        if (deliverySnap.exists()) {
          setDeliveryConfig(deliverySnap.data() as any);
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
        deliveryFee: Number(config.deliveryFee)
      });
      setSaved(true);
      toast("Configurações salvas com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast("Erro ao salvar configurações", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDeliveryConfig = async (updatedConfig: typeof deliveryConfig) => {
    setSavingDelivery(true);
    try {
      await setDoc(doc(db, 'deliverySettings', 'config'), updatedConfig);
      setDeliveryConfig(updatedConfig);
      toast("Configurações de Entrega salvas com sucesso no Firestore!");
    } catch (e) {
      console.error(e);
      toast("Erro ao salvar configurações de entrega", "error");
    } finally {
      setSavingDelivery(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="flex flex-col gap-8 max-w-4xl pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Configurações do Sistema</h1>
        <p className="text-sm text-slate-500">Gerencie a identidade e o comportamento do seu painel administrativo.</p>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 mb-2">
        <button
          onClick={() => setActiveTab('geral')}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 transition-all px-1 cursor-pointer",
            activeTab === 'geral'
              ? "border-red-600 text-slate-800 dark:text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Geral do Sistema
        </button>
        <button
          onClick={() => setActiveTab('entrega')}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 transition-all px-1 flex items-center gap-2 cursor-pointer",
            activeTab === 'entrega'
              ? "border-red-600 text-slate-800 dark:text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Truck className="w-4 h-4" />
          Configurações de Entrega
        </button>
      </div>

      {activeTab === 'entrega' ? (
        <DeliveryConfigPanel
          initialConfig={deliveryConfig}
          onSaveConfig={handleSaveDeliveryConfig}
          saving={savingDelivery}
          canEdit={canEdit}
          accentColor="#DC2626"
        />
      ) : (
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
      )}
    </div>
  );
}
