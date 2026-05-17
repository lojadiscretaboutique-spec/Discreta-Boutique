import { create } from 'zustand';

interface UIState {
  isHomeReady: boolean;
  setHomeReady: (ready: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isHomeReady: false,
  setHomeReady: (ready: boolean) => set({ isHomeReady: ready }),
}));
