import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  userData: null,
  isAdmin: false,
  isLoading: true,
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
    if (state.userData.computedPermissions) {
        return !!state.userData.computedPermissions[module]?.[action];
    }
    
    // Fallback if missing new structure (legacy simple boolean check via .permissions)
    const legacyPerms = (state.userData as any).permissions;
    if (legacyPerms && legacyPerms[module]) return true;

    return false;
  }
}));
