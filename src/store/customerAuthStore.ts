import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedCustomer {
  id: string;
  nome: string;
  email?: string;
  whatsapp: string;
  dataNascimento?: string;
  enderecoObj?: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    complemento: string;
    referencia: string;
  };
  favorites?: string[];
}

interface CustomerCustomerStore {
  currentCustomer: SavedCustomer | null;
  setCustomer: (customer: SavedCustomer) => void;
  clearCustomer: () => void;
  toggleFavorite: (productId: string) => void;
}

export const useCustomerAuthStore = create<CustomerCustomerStore>()(
  persist(
    (set) => ({
      currentCustomer: null,
      setCustomer: (customer) => set({ currentCustomer: customer }),
      clearCustomer: () => set({ currentCustomer: null }),
      toggleFavorite: (productId) => set((state) => {
        if (!state.currentCustomer) return state;
        const favorites = state.currentCustomer.favorites || [];
        const isFavorited = favorites.includes(productId);
        return {
          currentCustomer: {
            ...state.currentCustomer,
            favorites: isFavorited
              ? favorites.filter((id) => id !== productId)
              : [...favorites, productId],
          },
        };
      }),
    }),
    {
      name: 'discreta_customer_session',
    }
  )
);
