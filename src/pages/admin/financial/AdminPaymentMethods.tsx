import { useState, useEffect } from 'react';
import { settingsService, PaymentSettings, MethodConfig } from '../../../services/settingsService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { CreditCard, Wallet, Smartphone, Banknote, Truck, Store, Zap, Check, LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

export function AdminPaymentMethods() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    methods: []
  });

  const methodIcons: Record<string, LucideIcon> = {
    pix: Smartphone,
    credit_card: CreditCard,
    debit_card: Wallet,
    cash: Banknote,
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await settingsService.getPaymentSettings();
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

  const updateMethod = (methodId: string, updates: Partial<MethodConfig>) => {
    setSettings({
      ...settings,
      methods: settings.methods.map(m => m.id === methodId ? { ...m, ...updates } : m)
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await settingsService.savePaymentSettings(settings);
      toast("Configurações atualizadas!", 'success');
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-[10px] font-black uppercase tracking-[5px] text-zinc-500">Sincronizando</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-40 px-4 sm:px-6">
      <header className="mb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="text-[10px] font-black uppercase tracking-[8px] text-red-600 mb-4 block">Tesouraria</span>
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase text-white leading-none">
            Checkout <br/>
            <span className="text-red-600">Config</span>
          </h1>
        </motion.div>
      </header>

      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {settings.methods.map((method, idx) => {
            const Icon = methodIcons[method.id] || Smartphone;
            return (
              <motion.div
                key={method.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-8 group"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center text-red-600 border border-zinc-800 shadow-xl group-hover:border-red-600 transition-all">
                    <Icon size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">{method.label}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1">ID: {method.id}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                  {/* Toggle Delivery */}
                  <ToggleButton 
                    active={method.enabledDelivery} 
                    onClick={() => updateMethod(method.id, { enabledDelivery: !method.enabledDelivery })}
                    icon={Truck}
                    label="Entrega"
                  />
                  
                  {/* Toggle Pickup */}
                  <ToggleButton 
                    active={method.enabledPickup} 
                    onClick={() => updateMethod(method.id, { enabledPickup: !method.enabledPickup })}
                    icon={Store}
                    label="Retirada"
                  />

                  {/* Toggle Integration */}
                  {(['pix', 'credit_card', 'debit_card'].includes(method.id)) && (
                    <div className="h-10 w-[1px] bg-zinc-800 mx-2 hidden lg:block"></div>
                  )}
                  
                  {(['pix', 'credit_card', 'debit_card'].includes(method.id)) && (
                    <ToggleButton 
                      active={method.useIntegration} 
                      onClick={() => updateMethod(method.id, { useIntegration: !method.useIntegration })}
                      icon={Zap}
                      label="Integração (Online)"
                      color="red"
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent z-50 flex justify-center pointer-events-none">
        <Button 
          onClick={handleSubmit} 
          disabled={saving}
          className="pointer-events-auto h-20 px-16 bg-slate-900 hover:bg-zinc-200 text-white rounded-full font-black uppercase tracking-[4px] text-xs shadow-2xl border-b-8 border-zinc-400 active:border-b-0 active:translate-y-2 mb-4"
        >
          {saving ? 'Aplicando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, icon: Icon, label, color = "zinc" }: { active: boolean, onClick: () => void, icon: LucideIcon, label: string, color?: "zinc" | "red" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all group/btn",
        active 
          ? (color === "red" ? "bg-red-600/10 border-red-600 text-red-600" : "bg-slate-900 border-white text-white")
          : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700"
      )}
    >
      <Icon size={18} className={cn("transition-transform group-hover/btn:scale-110", active && "animate-pulse")} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && <Check size={14} strokeWidth={4} />}
    </button>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
