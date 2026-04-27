import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Check } from 'lucide-react';
import { useFeedback } from '../../contexts/FeedbackContext';

interface StoreConfig {
  storeName: string;
  whatsapp: string;
  deliveryFee: string | number;
  address: string;
  instagram: string;
}

export function AdminConfig() {
  const { hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useFeedback();

  const canEdit = hasPermission('settings', 'editar');
  
  const [config, setConfig] = useState<StoreConfig>({
    storeName: 'Discreta Boutique',
    whatsapp: '5511999999999',
    deliveryFee: '15.00',
    address: '',
    instagram: '',
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
            <Button type="submit" disabled={saving} className="w-full">
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
