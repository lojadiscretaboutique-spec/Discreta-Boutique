import { create } from 'zustand';

interface UIState {
  isHomeReady: boolean;
  setHomeReady: (ready: boolean) => void;
  floatingLiveUrl: string | null;
  floatingLiveTitle: string | null;
  floatingLiveIsMuted: boolean;
  floatingLiveIsMinimized: boolean;
  setFloatingLiveUrl: (url: string | null) => void;
  setFloatingLiveTitle: (title: string | null) => void;
  setFloatingLiveIsMuted: (isMuted: boolean) => void;
  setFloatingLiveIsMinimized: (isMinimized: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isHomeReady: false,
  setHomeReady: (ready: boolean) => set({ isHomeReady: ready }),
  floatingLiveUrl: null,
  floatingLiveTitle: null,
  floatingLiveIsMuted: true,
  floatingLiveIsMinimized: false,
  setFloatingLiveUrl: (url: string | null) => set({ floatingLiveUrl: url }),
  setFloatingLiveTitle: (title: string | null) => set({ floatingLiveTitle: title }),
  setFloatingLiveIsMuted: (isMuted: boolean) => set({ floatingLiveIsMuted: isMuted }),
  setFloatingLiveIsMinimized: (isMinimized: boolean) => set({ floatingLiveIsMinimized: isMinimized }),
}));
