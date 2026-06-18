import React, { useState, useMemo } from 'react';
import { Plus, Sparkles, Trash2, CheckSquare, Square, Gift } from 'lucide-react';
import { LiveKit, LiveProduct } from '../../../../../types/liveShop';
import { Product } from '../../../../../services/productService';
import { Input } from '../../../../../components/ui/input';
import { Button } from '../../../../../components/ui/button';
import { useFeedback } from '../../../../../contexts/FeedbackContext';

interface Props {
  storeProducts: Product[];
  linkedProducts: LiveProduct[];
  kits: LiveKit[];
  setKits: (kits: LiveKit[]) => void;
}

export function LiveShopCombosTab({ storeProducts, linkedProducts, kits, setKits }: Props) {
  const { toast } = useFeedback();

  // Kit fields state
  const [kitName, setKitName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [kitComboPrice, setKitComboPrice] = useState<number>(0);

  // Filter out which products to list (only show products currently attached to this live)
  const availableProducts = useMemo(() => {
    return linkedProducts.map(lp => {
      const original = storeProducts.find(p => p.id === lp.productId);
      return {
        id: lp.productId,
        name: original?.name || 'Item do catálogo',
        price: lp.livePrice !== undefined ? lp.livePrice : (original?.price || 0)
      };
    });
  }, [storeProducts, linkedProducts]);

  // Sum up prices for selected products in the combo editor
  const estimatedOriginalTotal = useMemo(() => {
    return selectedProductIds.reduce((sum, pId) => {
      const p = availableProducts.find(item => item.id === pId);
      return sum + (p?.price || 0);
    }, 0);
  }, [selectedProductIds, availableProducts]);

  // Action listeners
  const handleToggleProduct = (pId: string) => {
    if (selectedProductIds.includes(pId)) {
      setSelectedProductIds(selectedProductIds.filter(id => id !== pId));
    } else {
      setSelectedProductIds([...selectedProductIds, pId]);
    }
  };

  const handleAddCombo = () => {
    if (!kitName.trim()) {
      toast('Defina um nome descritivo para seu combo!', 'warning');
      return;
    }

    if (selectedProductIds.length < 2) {
      toast('Selecione pelo menos 2 produtos para compor este combo!', 'warning');
      return;
    }

    if (kitComboPrice <= 0) {
      toast('Determine um preço de venda válido para o combo!', 'warning');
      return;
    }

    const savings = estimatedOriginalTotal - kitComboPrice;
    const newKit: LiveKit = {
      id: `kit_${Date.now()}`,
      name: kitName.trim(),
      productIds: selectedProductIds,
      price: kitComboPrice,
      originalPrice: estimatedOriginalTotal,
      savings: savings > 0 ? parseFloat(savings.toFixed(2)) : 0
    };

    setKits([...kits, newKit]);
    
    // Reset state
    setKitName('');
    setSelectedProductIds([]);
    setKitComboPrice(0);
    toast(`Combo "${newKit.name}" criado com sucesso! Economia de R$ ${newKit.savings.toFixed(2)}`, 'success');
  };

  const handleRemoveKit = (kitId: string) => {
    setKits(kits.filter(k => k.id !== kitId));
    toast('Combo promocional excluído.', 'success');
  };

  return (
    <div className="space-y-6" id="liveshop-combos-tab">
      {/* Kit Combo Form */}
      <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-red-500" /> Montar Combo / Compre Junto
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            {/* Kit Name */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-semibold">Nome do Kit / Combo *</label>
              <Input
                placeholder="Ex: Kit Especial Noite das Bruxas"
                value={kitName}
                onChange={e => setKitName(e.target.value)}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>

            {/* Price Calculations info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-semibold">Preço Estimado Separado</label>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 font-mono text-zinc-300 text-sm font-bold">
                  R$ {estimatedOriginalTotal.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-semibold">Preço Promocional do Kit (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 149.90"
                  value={kitComboPrice || ''}
                  onChange={e => setKitComboPrice(parseFloat(e.target.value) || 0)}
                  className="bg-zinc-900 border-zinc-800 font-mono"
                />
              </div>
            </div>

            {estimatedOriginalTotal > kitComboPrice && (
              <div className="bg-red-950/10 border border-red-900/30 p-3 rounded-lg text-xs flex items-center justify-between text-zinc-400">
                <span>Economia calculada para o cliente:</span>
                <span className="font-bold text-red-500 font-mono text-sm">
                  R$ {(estimatedOriginalTotal - kitComboPrice).toFixed(2)}
                </span>
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddCombo}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 text-xs text-center"
            >
              Criar Combo de Produtos
            </Button>
          </div>

          {/* Products selector checklist */}
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col max-h-[240px]">
            <label className="block text-xs text-zinc-400 mb-2 font-bold uppercase tracking-wider">
              Selecionar Produtos para o Combo ({selectedProductIds.length})
            </label>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin">
              {availableProducts.length === 0 ? (
                <p className="text-xs text-zinc-600 italic p-3 text-center">
                  Vincule produtos na Aba anterior para habilitar a criação de combos!
                </p>
              ) : (
                availableProducts.map(p => {
                  const active = selectedProductIds.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleToggleProduct(p.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition ${
                        active 
                          ? 'bg-zinc-900 border-red-900/40 text-white font-semibold' 
                          : 'bg-transparent border-zinc-900 text-zinc-400 hover:bg-zinc-900/30'
                      }`}
                    >
                      <span className="text-xs truncate max-w-[200px]">{p.name}</span>
                      <span className="text-xs font-mono text-zinc-500 font-medium whitespace-nowrap">
                        R$ {p.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active combos list */}
      <div>
        <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Combos Ativos</h3>

        {kits.length === 0 ? (
          <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm">
            Nenhum combo compre junto cadastrado ainda. Configure um grupo promocional acima!
          </div>
        ) : (
          <div className="space-y-3">
            {kits.map(kit => (
              <div key={kit.id} className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 shrink-0">
                    <Gift size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {kit.name}
                    </h4>
                    <p className="text-xs text-zinc-500 font-mono">
                      Preço do combo: R$ {kit.price.toFixed(2)} | Economia: R$ {kit.savings.toFixed(2)} | Contém {kit.productIds?.length || 0} produtos
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemoveKit(kit.id)}
                    className="bg-transparent hover:bg-red-950/45 text-zinc-500 hover:text-red-500 p-2 rounded"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default LiveShopCombosTab;
