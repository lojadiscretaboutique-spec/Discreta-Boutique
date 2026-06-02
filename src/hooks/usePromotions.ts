import { useState, useEffect } from 'react';
import { promotionService, Promotion } from '../services/promotionService';

export function usePromotions() {
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch (e) {
        console.error("Error loading promotions:", e);
      } finally {
        setLoading(false);
      }
    }

    loadPromotions();
  }, []);

  const calculateProductPrice = (product: { id: string; categoryId: string; price: number; promoPrice?: number }) => {
    // 1. Get table price and catalog discount
    const tablePrice = product.price;
    const catalogDiscount = (product.promoPrice && product.promoPrice < product.price) ? (product.price - product.promoPrice) : 0;
    
    let bestDiscount = catalogDiscount;
    let finalPrice = (product.promoPrice && product.promoPrice < product.price) ? product.promoPrice : product.price;
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
