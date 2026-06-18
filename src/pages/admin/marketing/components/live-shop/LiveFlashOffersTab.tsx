import React, { useState } from 'react';
import { Zap, Plus, Trash2, ShoppingBag, Percent } from 'lucide-react';
import { LiveFlashOffer, LiveProduct } from '../../../../../types/liveShop';
import { Product } from '../../../../../services/productService';
import { Input } from '../../../../../components/ui/input';
import { Button } from '../../../../../components/ui/button';
import { useFeedback } from '../../../../../contexts/FeedbackContext';

interface Props {
  storeProducts: Product[];
  linkedProducts: LiveProduct[];
  flashOffers: LiveFlashOffer[];
  setFlashOffers: (offers: LiveFlashOffer[]) => void;
}

export function LiveShopFlashOffersTab({ 
  storeProducts, linkedProducts, flashOffers, setFlashOffers 
}: Props) {
  const { toast } = useFeedback();

  // Create state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [stockLimit, setStockLimit] = useState<number>(10);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleAddFlashOffer = () => {
    if (!selectedProductId) {
      toast('Selecione um dos produtos vinculados da live para ofertar!', 'warning');
      return;
    }

    if (flashOffers.some(o => o.productId === selectedProductId)) {
      toast('Este item já possui uma oferta relâmpago cadastrada!', 'warning');
      return;
    }

    const newOffer: LiveFlashOffer = {
      productId: selectedProductId,
      discount: discountPercent,
      promoStock: stockLimit,
      startTime: startTime || new Date().toISOString(),
      endTime: endTime || new Date(Date.now() + 30 * 60000).toISOString(), // 30 minutes from now
      active: true
    };

    setFlashOffers([...flashOffers, newOffer]);
    setSelectedProductId('');
    toast('Oferta relâmpago agendada para ativação em tempo real!', 'success');
  };

  const handleRemoveOffer = (pId: string) => {
    setFlashOffers(flashOffers.filter(o => o.productId !== pId));
    toast('Oferta relâmpago removida.', 'success');
  };

  const handleToggleActive = (pId: string) => {
    setFlashOffers(flashOffers.map(o => {
      if (o.productId === pId) {
        return { ...o, active: !o.active };
      }
      return o;
    }));
  };

  return (
    <div className="space-y-6" id="liveshop-flashoffers-tab">
      {/* Flash Creator form */}
      <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" /> Cadastrar Nova Oferta Relâmpago Flash
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Target Product */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Escolher Produto da Live *</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none focus:border-red-650 h-10"
            >
              <option value="">-- Selecione um produto vinculado --</option>
              {linkedProducts.map((lp) => {
                const original = storeProducts.find(p => p.id === lp.productId);
                return (
                  <option key={lp.productId} value={lp.productId}>
                    {original?.name || 'Item sem nome'} (R$ {original?.price?.toFixed(2)})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Discount Percentage */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Desconto (%)</label>
            <div className="relative">
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <Input
                type="number"
                min="1"
                max="99"
                value={discountPercent}
                onChange={e => setDiscountPercent(parseInt(e.target.value) || 15)}
                className="bg-zinc-900 border-zinc-800 h-10 pr-8"
              />
            </div>
          </div>

          {/* Stock threshold */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Estoque da Oferta</label>
            <Input
              type="number"
              min="1"
              value={stockLimit}
              onChange={e => setStockLimit(parseInt(e.target.value) || 10)}
              className="bg-zinc-900 border-zinc-800 h-10"
            />
          </div>

          {/* Date Range Start (Standard HTML datetimes) */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Início da Oferta</label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-10"
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Fim da Oferta</label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-10"
            />
          </div>

          <div>
            <Button
              type="button"
              onClick={handleAddFlashOffer}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 text-xs text-center"
            >
              Criar Oferta Flash
            </Button>
          </div>
        </div>
      </div>

      {/* Active flash offers list */}
      <div>
        <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Ofertas Relâmpago Gravadas</h3>

        {flashOffers.length === 0 ? (
          <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm">
            Nenhuma oferta relâmpago cadastrada de momento. Configure acima para impulsionar picos de vendas!
          </div>
        ) : (
          <div className="space-y-3">
            {flashOffers.map((fo) => {
              const original = storeProducts.find(p => p.id === fo.productId);
              return (
                <div key={fo.productId} className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-500">
                      <Zap className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {original?.name || 'Item do catálogo'}
                      </h4>
                      <p className="text-xs text-zinc-500 font-mono">
                        Desconto: {fo.discount}% OFF | Estoque reservado: {fo.promoStock} un
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(fo.productId)}
                      className={`px-3 py-1.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                        fo.active 
                          ? 'bg-gradient-to-r from-red-650 to-red-500 text-white' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {fo.active ? 'Ativa' : 'Pausada'}
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveOffer(fo.productId)}
                      className="bg-transparent hover:bg-red-950/45 text-zinc-500 hover:text-red-500 p-2 rounded"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default LiveShopFlashOffersTab;
