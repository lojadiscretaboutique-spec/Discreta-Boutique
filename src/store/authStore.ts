import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';

interface AuthStore {
  user: FirebaseUser | null;
  userData: {
    role: string;
    active: boolean;
    computedPermissions?: Record<string, Record<string, boolean>>;
  } | null;
  isAdmin: boolean;
  isLoading: boolean;
  checkAuth: () => void;
  hasPermission: (module: string, action?: string) => boolean;
  setUserData: (userData: any) => void;
  reloadUserData: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  userData: null,
  isAdmin: false,
  isLoading: true,
  setUserData: (userData) => {
    set({ userData });
  },
  reloadUserData: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        set({ userData: uData as any });
      }
    } catch (e) {
      console.error("Error reloading user data:", e);
    }
  },
  checkAuth: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          if (userData && userData.status === 'bloqueado') {
             // Blocked user
             set({ user: null, userData: null, isAdmin: false, isLoading: false });
             return;
          }

          if (userData && userData.status !== 'bloqueado') {
              // Update last login
              updateDoc(userDoc.ref, { lastLoginAt: serverTimestamp() }).catch(()=>{});
          }

          const isAdmin = userData?.role === 'admin' || user.email === 'lojadiscretaboutique@gmail.com' || user.uid === 'VpnA7EDoSoUMF0VGOHyiCjyrOSf2';
          
          set({ 
            user, 
            userData: userData ? userData as any : null,
            isAdmin,
            isLoading: false 
          });
        } catch (error) {
          console.error("Auth check error:", error);
          set({ user, userData: null, isAdmin: false, isLoading: false });
        }
      } else {
        set({ user: null, userData: null, isAdmin: false, isLoading: false });
      }
    });
  },
  hasPermission: (module, action = 'visualizar') => {
    const state = get();
    if (state.isAdmin) return true;
    if (!state.userData || (state.userData as any).status !== 'ativo') return false;
    
    // Legacy support or new computed permissions map
    const computed = state.userData.computedPermissions;
    if (computed) {
        // If the module exists in the map, use it
        if (computed[module]) {
            return !!computed[module][action];
        }
    }
    
    // Fallback: If module is missing in computed map (data might be stale after adding new modules),
    // we check legacy perms or allow visualizing if they have at least one valid submodule if it's a composite check
    // But for simplicity and security, if it's not in computed and computed exists, we return false
    // unless it's a very basic permission like 'dashboard' or if the user data is extremely old.
    
    const legacyPerms = (state.userData as any).permissions;
    if (legacyPerms && legacyPerms[module]) return true;

    return false;
  }
}));
