import React, { useState } from 'react';
import { Plus, Tag, Trash2, CheckCircle2 } from 'lucide-react';
import { LiveCoupon } from '../../../../../types/liveShop';
import { Input } from '../../../../../components/ui/input';
import { Button } from '../../../../../components/ui/button';
import { useFeedback } from '../../../../../contexts/FeedbackContext';

interface Props {
  coupons: LiveCoupon[];
  setCoupons: (c: LiveCoupon[]) => void;
}

export function LiveShopCouponsTab({ coupons, setCoupons }: Props) {
  const { toast } = useFeedback();

  // Coupon state
  const [code, setCode] = useState('');
  const [discountVal, setDiscountVal] = useState<number>(10);
  const [maxRedemptions, setMaxRedemptions] = useState<number>(50);
  const [expiry, setExpiry] = useState('');
  const [highlight, setHighlight] = useState(true);

  const handleAddCoupon = () => {
    const formattedCode = code.trim().toUpperCase();
    if (!formattedCode) {
      toast('Defina um código cupom válido!', 'warning');
      return;
    }

    if (coupons.some(c => c.code === formattedCode)) {
      toast('Este código de cupom já existe nesta live!', 'warning');
      return;
    }

    const newCoupon: LiveCoupon = {
      code: formattedCode,
      discount: discountVal,
      validUntil: expiry || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days expiry default
      maxUses: maxRedemptions,
      usedCount: 0,
      highlighted: highlight
    };

    setCoupons([...coupons, newCoupon]);
    setCode('');
    toast(`Cupom ${newCoupon.code} criado!`, 'success');
  };

  const handleRemoveCoupon = (couponCode: string) => {
    setCoupons(coupons.filter(c => c.code !== couponCode));
    toast('Cupom removido do painel.', 'success');
  };

  return (
    <div className="space-y-6" id="liveshop-coupons-tab">
      {/* Coupon form */}
      <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Tag className="w-4 h-4 text-red-500" /> Gerar Cupom de Desconto Exclusivo
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Alphanumeric Code */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Código do Cupom *</label>
            <Input
              placeholder="Ex: LIVESTART"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="bg-zinc-900 border-zinc-800 uppercase font-mono font-bold"
            />
          </div>

          {/* Discount amount */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Desconto (%) *</label>
            <Input
              type="number"
              min="1"
              max="100"
              value={discountVal}
              onChange={e => setDiscountVal(parseInt(e.target.value) || 10)}
              className="bg-zinc-900 border-zinc-800 h-10 font-bold"
            />
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Limite Máximo de Usos</label>
            <Input
              type="number"
              min="1"
              value={maxRedemptions}
              onChange={e => setMaxRedemptions(parseInt(e.target.value) || 50)}
              className="bg-zinc-900 border-zinc-800 h-10"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Válido até</label>
            <Input
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-10"
            />
          </div>

          {/* Highlight toggle */}
          <div className="flex flex-col gap-2">
            <label className="block text-xs text-zinc-400">Exibição de Destaque</label>
            <select
              value={highlight ? 'sim' : 'nao'}
              onChange={e => setHighlight(e.target.value === 'sim')}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none h-10"
            >
              <option value="sim">Sim (Badge Brilhante)</option>
              <option value="nao">Não (Normal)</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
            <Button
              type="button"
              onClick={handleAddCoupon}
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 text-xs px-6"
            >
              Adicionar Cupom
            </Button>
          </div>
        </div>
      </div>

      {/* Coupon List view */}
      <div>
        <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Cupons Vinculados</h3>

        {coupons.length === 0 ? (
          <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm">
            Nenhum cupom exclusivo adicionado para este evento de momento.
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map(c => (
              <div key={c.code} className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-500 shrink-0">
                    <Tag size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2 font-mono">
                      {c.code}
                      {c.highlighted && (
                        <span className="text-[8px] bg-green-950 text-green-500 px-1.5 py-0.5 rounded font-sans uppercase font-extrabold tracking-wider border border-green-905/30 animate-pulse">
                          Destaque
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Desconto de {c.discount}% | Usado {c.usedCount} de {c.maxUses} vezes | Expira em: {c.validUntil}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemoveCoupon(c.code)}
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
export default LiveShopCouponsTab;
