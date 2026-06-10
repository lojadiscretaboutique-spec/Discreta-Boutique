import { useMemo } from 'react';
import { Truck, CheckCircle, Navigation, AlertTriangle } from 'lucide-react';

interface DeliveryCalculatorProps {
  distanceKm: number;
  durationMinutes: number;
  cartSubtotal: number;
  config: {
    fixedFee: number;
    pricePerKm: number;
    minimumDeliveryFee: number;
    maxRadiusKm: number;
    freeShippingAbove: number;
    freeShippingRadiusKm: number;
  };
  accentColor?: string;
  cardBg?: string;
  cardText?: string;
  borderHex?: string;
}

export interface CalculationResult {
  rawFee: number;
  finalFee: number;
  isFree: boolean;
  freeReason: string;
  isBlocked: boolean;
  blockReason: string;
}

export function calculateShippingFee({
  distanceKm,
  cartSubtotal,
  config,
}: {
  distanceKm: number;
  cartSubtotal: number;
  config: {
    fixedFee: number;
    pricePerKm: number;
    minimumDeliveryFee: number;
    maxRadiusKm: number;
    freeShippingAbove: number;
    freeShippingRadiusKm: number;
  };
}): CalculationResult {
  const {
    fixedFee,
    pricePerKm,
    minimumDeliveryFee,
    maxRadiusKm,
    freeShippingAbove,
    freeShippingRadiusKm,
  } = config;

  const isBlocked = distanceKm > maxRadiusKm;
  const blockReason = isBlocked ? `Desculpe, ainda não entregamos nessa região (Distância máxima permitida: ${maxRadiusKm} km).` : '';

  // Free shipping rules
  const valFree = freeShippingAbove > 0 && cartSubtotal >= freeShippingAbove;
  const distFree = freeShippingRadiusKm > 0 && distanceKm <= freeShippingRadiusKm;
  const isFree = valFree || distFree;
  
  let freeReason = '';
  if (isFree) {
    if (valFree && distFree) {
      freeReason = 'Frete Grátis (Valor atingido e distância próxima)';
    } else if (valFree) {
      freeReason = `Frete Grátis (Pedido acima de R$ ${freeShippingAbove.toFixed(2)})`;
    } else {
      freeReason = `Frete Grátis (Distância inferior a ${freeShippingRadiusKm} km)`;
    }
  }

  // Base shipping formula: fixedFee + distanceKm * pricePerKm
  const baseCost = fixedFee + distanceKm * pricePerKm;
  const finalFee = isBlocked
    ? 0
    : isFree
    ? 0
    : Math.max(baseCost, minimumDeliveryFee);

  return {
    rawFee: baseCost,
    finalFee,
    isFree,
    freeReason,
    isBlocked,
    blockReason,
  };
}

export function DeliveryCalculator({
  distanceKm,
  durationMinutes,
  cartSubtotal,
  config,
  accentColor = '#DC2626',
  cardBg = 'rgba(0,0,0,0.15)',
  cardText = '#ffffff',
  borderHex = 'rgba(255,255,255,0.08)'
}: DeliveryCalculatorProps) {
  const result = useMemo(() => {
    return calculateShippingFee({ distanceKm, cartSubtotal, config });
  }, [distanceKm, cartSubtotal, config]);

  const { finalFee, isFree, freeReason, isBlocked, blockReason } = result;

  return (
    <div 
      className="space-y-4 p-5 rounded-2xl border transition-colors"
      style={{ backgroundColor: cardBg, borderColor: borderHex, color: cardText }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: cardText }}>
          <Truck className="w-4 h-4" style={{ color: accentColor }} />
          Cálculo do Resumo de Entrega
        </h4>
      </div>

      {isBlocked ? (
        <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-red-600 dark:text-red-400">Entrega Inviável</h5>
            <p className="text-xs text-red-500">{blockReason}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Calculated Freight */}
          <div 
            className="p-4 rounded-xl flex flex-col justify-between items-center text-center border bg-zinc-900/30"
            style={{ borderColor: borderHex }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1" style={{ color: cardText }}>Valor do Frete</span>
            {isFree ? (
              <span className="text-2xl font-black text-emerald-500 uppercase tracking-tight flex items-center gap-1.5 justify-center">
                Grátis <CheckCircle className="w-5 h-5 fill-emerald-500" style={{ color: cardText }} />
              </span>
            ) : (
              <span className="text-2xl font-mono font-black" style={{ color: accentColor }}>
                R$ {finalFee.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {isFree && !isBlocked && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl text-center">
          ⚡ {freeReason}
        </div>
      )}
    </div>
  );
}
