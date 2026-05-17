import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // Cart unique string (productId + variantId)
  productId: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  imageUrl?: string;
  variantId?: string;
  variantName?: string;
  searchId?: string;
  costPrice?: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  loadOrder: (order: any) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const items = get().items;
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
      },
      removeItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),
      updateQuantity: (id, quantity) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        }),
      clearCart: () => set({ items: [] }),
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
          costPrice: item.costPrice
        }));
        set({ items: cartItems });
      }
    }),
    {
      name: 'discreta-cart',
    }
  )
);
