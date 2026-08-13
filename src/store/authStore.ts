import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';
import { UserProfile } from '../types/user';

interface AuthStore {
  user: FirebaseUser | null;
  userData: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  checkAuth: () => void;
  hasPermission: (module: string, action?: string) => boolean;
  setUserData: (userData: UserProfile | null) => void;
  reloadUserData: () => Promise<void>;
}

let authListenerInitialized = false;

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
        const uData = userDoc.data() as UserProfile;
        set({ userData: uData });
      }
    } catch (e) {
      console.error("Error reloading user data:", e);
    }
  },
  checkAuth: () => {
    if (authListenerInitialized) return;
    authListenerInitialized = true;

    console.log("[Discreta Boot] Auth resolvida - Inicializando ouvidor de autenticação");

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.exists() ? (userDoc.data() as UserProfile) : null;
          
          if (userData && userData.status === 'bloqueado') {
             // Blocked user
             set({ user: null, userData: null, isAdmin: false, isLoading: false });
             return;
          }

          if (userData && userData.status !== 'bloqueado' && userDoc.exists()) {
              // Update last login
              updateDoc(userDoc.ref, { lastLoginAt: serverTimestamp() }).catch(()=>{});
          }

          const hasAdminRole = userData?.role === 'admin' 
            || userData?.role === 'owner' 
            || (Array.isArray(userData?.roles) && (userData.roles.includes('admin') || userData.roles.includes('owner')));

          // Safe fallback for owner email/uid if user profile in firestore isn't set to admin role yet
          const isOwnerFallback = user.email === 'lojadiscretaboutique@gmail.com' || user.uid === 'VpnA7EDoSoUMF0VGOHyiCjyrOSf2';

          const isAdmin = !!(hasAdminRole || isOwnerFallback);
          
          set({ 
            user, 
            userData,
            isAdmin,
            isLoading: false 
          });
          console.log("[Discreta Boot] Perfil carregado:", user.email, "isAdmin:", isAdmin);
        } catch (error: any) {
          const isOffline = error?.code === 'unavailable' || (error?.message || '').toLowerCase().includes('offline');
          if (isOffline) {
            console.warn("[Discreta Boot Auth] Offline ao carregar perfil do Firestore. Mantendo sessão do Auth:", user.email);
            const isOwnerFallback = user.email === 'lojadiscretaboutique@gmail.com' || user.uid === 'VpnA7EDoSoUMF0VGOHyiCjyrOSf2';
            set({ 
              user, 
              userData: null, 
              isAdmin: isOwnerFallback, 
              isLoading: false 
            });
          } else {
            console.error("[Discreta Boot Error] Auth check error:", error);
            set({ user, userData: null, isAdmin: false, isLoading: false });
          }
        }
      } else {
        set({ user: null, userData: null, isAdmin: false, isLoading: false });
        console.log("[Discreta Boot] Auth resolvida - Nenhum usuário autenticado");
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
