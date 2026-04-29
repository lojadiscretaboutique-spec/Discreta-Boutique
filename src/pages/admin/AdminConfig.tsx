import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Check, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useFeedback } from '../../contexts/FeedbackContext';

interface StoreConfig {
  storeName: string;
  whatsapp: string;
  deliveryFee: string | number;
  address: string;
  instagram: string;
  logoUrl?: string;
}

export function AdminConfig() {
  const { hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = hasPermission('settings', 'editar');
  
  const [config, setConfig] = useState<StoreConfig>({
    storeName: 'Discreta Boutique',
    whatsapp: '5511999999999',
    deliveryFee: '15.00',
    address: '',
    instagram: '',
    logoUrl: '',
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const docRef = doc(db, 'settings', 'store');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setConfig(prev => ({ ...prev, ...snap.data() }));
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

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100">Configurações da Loja</h1>
      
      <div className="bg-slate-900 rounded-xl shadow-sm border p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium">Logo da Loja (Ícone e Redes Sociais)</label>
            <div className="flex items-center gap-6 p-4 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950">
              <div className="relative w-24 h-24 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 shrink-0">
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-700" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  disabled={!canEdit || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {config.logoUrl ? 'Trocar Logo' : 'Upload Logo'}
                </Button>
                {config.logoUrl && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    disabled={!canEdit}
                    onClick={() => setConfig({...config, logoUrl: ''})}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
                <p className="text-xs text-slate-500">Recomendado: Quadrado (512x512px) PNG ou JPG.</p>
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

          <div>
            <label className="block text-sm font-medium mb-1">Nome da Loja</label>
            <Input value={config.storeName} onChange={e=>setConfig({...config, storeName: e.target.value})} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp para Pedidos (Apenas números com DDI + DDD)</label>
            <Input value={config.whatsapp} onChange={e=>setConfig({...config, whatsapp: e.target.value})} placeholder="5511999999999" />
            <p className="text-xs text-slate-400 mt-1">Geralmente começa com 55 (Brasil).</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Taxa de Entrega Padrão (R$)</label>
            <Input type="number" step="0.01" value={config.deliveryFee} onChange={e=>setConfig({...config, deliveryFee: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link do Instagram</label>
            <Input value={config.instagram} onChange={e=>setConfig({...config, instagram: e.target.value})} placeholder="https://instagram.com/..." />
          </div>
          
          {canEdit ? (
            <Button type="submit" disabled={saving || uploading} className="w-full">
              {saved ? <><Check className="mr-2" /> Salvo com Sucesso</> : saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          ) : (
            <div className="p-4 bg-slate-800 rounded-xl text-center text-slate-400 font-bold text-sm border-2 border-dashed">
              Você não tem permissão para alterar as configurações
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
