import { useState, useEffect } from 'react';
import { promotionService, Promotion } from '../services/promotionService';
import { visualHomeService } from '../services/visualHomeService';

export function usePromotions() {
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitedPromoPrices, setLimitedPromoPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadPromotions() {
      try {
        const all = await promotionService.getAll();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const filtered = all.filter(p => {
          if (!p.active) return false;
          
          if (p.startDate) {
            const start = new Date(p.startDate);
            start.setHours(0, 0, 0, 0);
            if (now < start) return false;
          }

          if (p.endDate) {
            const end = new Date(p.endDate);
            end.setHours(23, 59, 59, 999);
            if (now > end) return false;
          }

          return true;
        });

        setActivePromotions(filtered);

        // Fetch visual schedule settings to resolve active 'limited_promo' prices
        try {
          const visualData = await visualHomeService.getFullHomeStructure();
          const pricesMap: Record<string, number> = {};
          if (visualData && visualData.settings) {
            Object.values(visualData.settings).forEach((s: any) => {
              if (s.active && s.source === 'limited_promo') {
                const sched = visualData.schedules?.[s.id];
                let isSchedActive = true;
                if (sched?.hasSchedule) {
                  const currentDate = new Date();
                  if (sched.startDate) {
                    const startStr = `${sched.startDate}T${sched.startTime || '00:00'}:00`;
                    if (currentDate < new Date(startStr)) {
                      isSchedActive = false;
                    }
                  }
                  if (sched.endDate) {
                    const endStr = `${sched.endDate}T${sched.endTime || '23:59'}:59`;
                    if (currentDate > new Date(endStr)) {
                      isSchedActive = false;
                    }
                  }
                }
                if (isSchedActive && s.promoPrices) {
                  Object.entries(s.promoPrices).forEach(([prodId, pVal]) => {
                    const numVal = Number(pVal);
                    if (numVal > 0) {
                      if (!pricesMap[prodId] || numVal < pricesMap[prodId]) {
                        pricesMap[prodId] = numVal;
                      }
                    }
                  });
                }
              }
            });
          }
          setLimitedPromoPrices(pricesMap);
        } catch (vErr) {
          console.warn("Could not load limited_promo structure prices:", vErr);
        }
      } catch (e) {
        console.error("Error loading promotions:", e);
      } finally {
        setLoading(false);
      }
    }

    loadPromotions();
  }, []);

  const calculateProductPrice = (product: { id: string; categoryId: string; price: number; promoPrice?: number }) => {
    const tablePrice = product.price;

    // Check if there is an active custom limited promo price for this product ID
    const customPrice = limitedPromoPrices[product.id];
    const basePromoPrice = (customPrice !== undefined && customPrice > 0) ? customPrice : product.promoPrice;

    const catalogDiscount = (basePromoPrice && basePromoPrice < product.price) ? (product.price - basePromoPrice) : 0;
    
    let bestDiscount = catalogDiscount;
    let finalPrice = (basePromoPrice && basePromoPrice < product.price) ? basePromoPrice : product.price;
    let appliedPromo: Promotion | null = null;
    let isFreeShipping = false;

    // 2. Sort by priority
    const sorted = [...activePromotions].sort((a, b) => b.priority - a.priority);

    for (const promo of sorted) {
      // Check scope
      let inScope = false;
      if (promo.scope === 'all') inScope = true;
      if (promo.scope === 'categories' && promo.targetIds?.includes(product.categoryId)) inScope = true;
      if (promo.scope === 'products' && promo.targetIds?.includes(product.id)) inScope = true;

      if (!inScope) continue;

      if (promo.type === 'free_shipping') {
        isFreeShipping = true;
        // Continue to see if there's also a discount
        continue;
      }

      // Calculate discount in relation to table price (product.price)
      let promoDiscount = 0;
      if (promo.type === 'percentage') {
        promoDiscount = tablePrice * (promo.value / 100);
      } else if (promo.type === 'fixed') {
        promoDiscount = promo.value;
      }

      // If the marketing promo discount is strictly greater than the catalog/previous discount, prioritize it
      if (promoDiscount > bestDiscount) {
        bestDiscount = promoDiscount;
        finalPrice = tablePrice - promoDiscount;
        appliedPromo = promo;
      }
    }

    return {
      price: Math.max(0, finalPrice),
      originalPrice: tablePrice,
      promotion: appliedPromo,
      isFreeShipping
    };
  };

  return { activePromotions, calculateProductPrice, loading };
}
