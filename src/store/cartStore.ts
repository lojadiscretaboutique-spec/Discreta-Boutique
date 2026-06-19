import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // Cart unique string (productId + variantId or comboId)
  productId: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  gtin?: string;
  imageUrl?: string;
  variantId?: string;
  variantName?: string;
  searchId?: string;
  costPrice?: number;
  isCombo?: boolean;
  comboId?: string;
  isFreeShipping?: boolean;
  categoryId?: string;
  originalPrice?: number;
  promoPrice?: number;
  promoAllowedPaymentMethods?: string[];
  promotionId?: string;
  
  // Gift With Purchase Specific Fields
  isGift?: boolean;
  giftPromotionId?: string;
  giftTierId?: string;
  lockedPrice?: boolean;
  cannotEditPrice?: boolean;
  cannotApplyCoupon?: boolean;
  removeIfNotEligible?: boolean;
}

export interface AppliedCoupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  allowedPaymentMethods?: string[];
}

import { giftCartService } from '../services/giftCartService';

interface CartStore {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  loadOrder: (order: any) => void;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  syncGifts: () => Promise<void>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      appliedCoupon: null,
      addItem: (item) => {
        const items = get().items;
        // Don't manually add gifts here usually, but if added manually, treat as regular item
        const existing = items.find((i) => i.id === item.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
        get().syncGifts();
      },
      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
        get().syncGifts();
      },
      updateQuantity: (id, quantity) => {
        const item = get().items.find(i => i.id === id);
        if (item?.isGift) return; // Prevent manual qty update for gifts
        
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        });
        get().syncGifts();
      },
      clearCart: () => set({ items: [], appliedCoupon: null }),
      total: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
      loadOrder: (order: any) => {
        const cartItems: CartItem[] = order.items.map((item: any) => ({
          id: item.variantId ? `${item.productId}-${item.variantId}` : item.productId,
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku,
          imageUrl: item.imageUrl,
          variantName: item.variantName,
          costPrice: item.costPrice,
          isGift: item.isGift,
          giftPromotionId: item.giftPromotionId,
          giftTierId: item.giftTierId
        }));
        set({ items: cartItems, appliedCoupon: null });
        get().syncGifts();
      },
      applyCoupon: (coupon) => {
        set({ appliedCoupon: coupon });
        get().syncGifts();
      },
      removeCoupon: () => {
        set({ appliedCoupon: null });
        get().syncGifts();
      },
      syncGifts: async () => {
        const currentItems = get().items;
        const subtotal = currentItems
          .filter(i => !i.isGift)
          .reduce((acc, i) => acc + i.price * i.quantity, 0);

        if (subtotal === 0) {
          const itemsWithoutGifts = currentItems.filter(i => !i.isGift);
          if (itemsWithoutGifts.length !== currentItems.length) {
            set({ items: itemsWithoutGifts });
          }
          return;
        }

        const eligibleGifts = await giftCartService.calculateEligibleGifts(currentItems);
        
        // Remove old gifts that are no longer eligible or match new ones
        const nonGifts = currentItems.filter(i => !i.isGift);
        
        // Merge them - for simplicity, we replace gifts area
        const newItems = [...nonGifts, ...eligibleGifts];
        
        // Only update state if items actually changed to avoid infinite loops or unnecessary renders
        const currentIds = currentItems.map(i => `${i.id}-${i.quantity}`).sort().join('|');
        const newIds = newItems.map(i => `${i.id}-${i.quantity}`).sort().join('|');
        
        if (currentIds !== newIds) {
          set({ items: newItems });
        }
      }
    }),
    {
      name: 'discreta-cart',
    }
  )
);
