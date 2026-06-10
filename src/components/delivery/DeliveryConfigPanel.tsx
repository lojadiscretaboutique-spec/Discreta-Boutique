import { useState, useEffect } from 'react';
import { StoreLocationPicker } from './StoreLocationPicker';
import { Landmark, Compass, DollarSign, Ban, ShieldCheck, Heart, Settings } from 'lucide-react';

interface DeliveryConfig {
  storeLatitude: number;
  storeLongitude: number;
  fixedFee: number;
  pricePerKm: number;
  minimumDeliveryFee: number;
  maxRadiusKm: number;
  freeShippingAbove: number;
  freeShippingRadiusKm: number;
}

interface DeliveryConfigPanelProps {
  initialConfig: DeliveryConfig;
  onSaveConfig: (config: DeliveryConfig) => Promise<void>;
  saving: boolean;
  canEdit: boolean;
  accentColor?: string;
  theme?: 'dark' | 'light';
}

export function DeliveryConfigPanel({
  initialConfig,
  onSaveConfig,
  saving,
  canEdit,
  accentColor = '#DC2626',
  theme = 'dark',
}: DeliveryConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<DeliveryConfig>(initialConfig);

  useEffect(() => {
    setLocalConfig(initialConfig);
  }, [initialConfig]);

  const handleChange = (field: keyof DeliveryConfig, value: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStoreLocationChange = (coords: { latitude: number; longitude: number }) => {
    setLocalConfig((prev) => ({
      ...prev,
      storeLatitude: coords.latitude,
      storeLongitude: coords.longitude,
    }));
    // We can also trigger automatic trigger or let user save everything together using save button
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(localConfig);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors space-y-8">
      <div>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Settings className="w-5 h-5 text-red-650" style={{ color: accentColor }} />
          Parâmetros de Entrega Georreferenciada (iFood-Style)
        </h2>
        <p className="text-xs text-slate-500">
          Ajuste as taxas baseadas em distância, valores mínimos e raios operacionais limites.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Taxa Fixa Base */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Taxa Fixa Inicial (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                disabled={!canEdit}
                value={localConfig.fixedFee}
                onChange={(e) => handleChange('fixedFee', parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex R$ 3.00"
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Taxa de saída / acionamento de entregador
            </p>
          </div>

          {/* Adicional por Quilômetro */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Valor por Quilômetro (R$/Km)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                disabled={!canEdit}
                value={localConfig.pricePerKm}
                onChange={(e) => handleChange('pricePerKm', parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex R$ 1.50"
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Adicional cobrado por Km de rota calculado
            </p>
          </div>

          {/* Taxa de Entrega Mínima */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Taxa de Entrega Mínima (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                disabled={!canEdit}
                value={localConfig.minimumDeliveryFee}
                onChange={(e) => handleChange('minimumDeliveryFee', parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex R$ 5.00"
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              O frete nunca será menor que esse valor
            </p>
          </div>

          {/* Raio Limite Máximo */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Raio de Entrega Máximo (Km)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                disabled={!canEdit}
                value={localConfig.maxRadiusKm}
                onChange={(e) => handleChange('maxRadiusKm', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex: 8.0"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase tracking-wide">
                Km
              </span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Pedidos acima desta distância serão bloqueados
            </p>
          </div>

          {/* Frete Grátis Acima de R$ */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Frete Grátis acima de (Pedido R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                R$
              </span>
              <input
                type="number"
                step="5"
                disabled={!canEdit}
                value={localConfig.freeShippingAbove}
                onChange={(e) => handleChange('freeShippingAbove', parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex: 150.00"
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Isenta taxa de entrega caso atinja o subtotal (0 para desligar)
            </p>
          </div>

          {/* Frete Grátis Próximo de Km */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">
              Frete Grátis por Proximidade (Km)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                disabled={!canEdit}
                value={localConfig.freeShippingRadiusKm}
                onChange={(e) => handleChange('freeShippingRadiusKm', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Ex: 3.0"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase tracking-wide">
                Km
              </span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Isenta se cliente estiver em raio menor (0 para desligar)
            </p>
          </div>
        </div>

        {/* Store Location Map block */}
        <div className="pt-6 border-t border-slate-150 dark:border-slate-800/60">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Compass className="w-4 h-4 text-slate-400" />
            Configuração da Origem Geográfica da Loja
          </h3>
          <StoreLocationPicker
            latitude={localConfig.storeLatitude}
            longitude={localConfig.storeLongitude}
            onLocationSave={handleStoreLocationChange}
            accentColor={accentColor}
          />
        </div>

        {/* Global form actions */}
        <div className="pt-6 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
          {canEdit ? (
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: accentColor }}
              className="px-6 py-3 text-white rounded-xl font-bold uppercase tracking-widest text-xs h-11 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg shadow-red-900/10 disabled:opacity-50"
            >
              {saving ? 'Gravando Alterações...' : 'Salvar Total das Configurações'}
            </button>
          ) : (
            <div className="text-xs uppercase tracking-widest font-black text-slate-500 py-3 px-5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Você não tem permissão para editar estas configurações
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
export default DeliveryConfigPanel;
