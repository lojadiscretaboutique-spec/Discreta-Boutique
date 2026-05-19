import React, { createContext, useContext, ReactNode } from 'react';
import { usePromotions } from '../hooks/usePromotions';
import { Promotion } from '../services/promotionService';

interface PromotionContextType {
  activePromotions: Promotion[];
  calculateProductPrice: (product: { id: string; categoryId: string; price: number; promoPrice?: number }) => {
    price: number;
    originalPrice: number;
    promotion: Promotion | null;
    isFreeShipping: boolean;
  };
  loading: boolean;
}

const PromotionContext = createContext<PromotionContextType | undefined>(undefined);

export function PromotionProvider({ children }: { children: ReactNode }) {
  const promoData = usePromotions();

  return (
    <PromotionContext.Provider value={promoData}>
      {children}
    </PromotionContext.Provider>
  );
}

export function usePromotion() {
  const context = useContext(PromotionContext);
  if (context === undefined) {
    throw new Error('usePromotion must be used within a PromotionProvider');
  }
  return context;
}
