import React, { useMemo, useState } from 'react';
import { ProductVariant } from '../../services/productService';
import { cn, formatCurrency } from '../../lib/utils';
import { Minus, Plus, AlertCircle } from 'lucide-react';

interface ProductVariationSelectorProps {
  variants: ProductVariant[];
  selectedQuantities: Record<string, number>;
  onQuantityChange: (variantId: string, quantity: number) => void;
  accentColor: string;
  textColor: string;
  cardColor: string;
  borderColor: string;
}

export const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  variants,
  selectedQuantities,
  onQuantityChange,
  accentColor,
  textColor,
  cardColor,
  borderColor,
}) => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const triggerAlert = (msg: string) => {
    setAlertMessage(msg);
    setTimeout(() => setAlertMessage(null), 3000);
  };

  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => (b.stock - a.stock) || a.name.localeCompare(b.name));
  }, [variants]);

  if (variants.length === 0) return null;

  return (
    <div className="space-y-4">
      {alertMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-bold text-white shadow-lg animate-in fade-in" style={{ backgroundColor: accentColor }}>
          <AlertCircle size={16} />
          {alertMessage}
        </div>
      )}
      
      <div className="space-y-3">
        {sortedVariants.map(v => {
          if (!v.active) return null;
          
          const qty = selectedQuantities[v.id!] || 0;
          const isOutOfStk = v.stock <= 0;

          return (
            <div 
              key={v.id} 
              className={cn(
                "flex items-center gap-4 p-3 rounded-xl border transition-all",
                isOutOfStk ? "opacity-50 grayscale" : ""
              )}
              style={{
                backgroundColor: cardColor,
                borderColor: qty > 0 ? accentColor : borderColor
              }}
            >
              {v.imageUrl && (
                <img src={v.imageUrl} alt={v.name} className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <p className="text-xs font-bold uppercase" style={{ color: textColor }}>{v.name}</p>
                <p className="text-[10px]" style={{ color: `${textColor}80` }}>
                  {isOutOfStk ? 'Esgotado' : `Estoque: ${v.stock}`}
                </p>
                {v.price && (
                  <p className="text-xs font-bold mt-1" style={{ color: accentColor }}>{formatCurrency(v.price)}</p>
                )}
              </div>
              
              <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor }}>
                <button 
                  onClick={() => onQuantityChange(v.id!, Math.max(0, qty - 1))}
                  disabled={isOutOfStk || qty === 0}
                  className="p-2 hover:bg-black/5"
                  style={{ color: textColor }}
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-xs font-black" style={{ color: textColor }}>{qty}</span>
                <button 
                  onClick={() => {
                    if (qty >= v.stock) {
                      triggerAlert(`Limite de estoque atingido para ${v.name}`);
                    } else {
                      onQuantityChange(v.id!, Math.min(v.stock, qty + 1));
                    }
                  }}
                  disabled={isOutOfStk}
                  className="p-2 hover:bg-black/5"
                  style={{ color: textColor }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
