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
}

interface CustomerCustomerStore {
  currentCustomer: SavedCustomer | null;
  setCustomer: (customer: SavedCustomer) => void;
  clearCustomer: () => void;
}

export const useCustomerAuthStore = create<CustomerCustomerStore>()(
  persist(
    (set) => ({
      currentCustomer: null,
      setCustomer: (customer) => set({ currentCustomer: customer }),
      clearCustomer: () => set({ currentCustomer: null }),
    }),
    {
      name: 'discreta_customer_session',
    }
  )
);
