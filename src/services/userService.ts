import { doc, getDoc, getDocs, collection, updateDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';
import { roleService, MODULES, ACTIONS } from './roleService';

export interface User {
  id?: string;
  name: string;
  email: string;
  password?: string; // Only used during creation
  phone?: string;
  cpf?: string;
  avatarUrl?: string;
  notes?: string;
  status: 'ativo' | 'bloqueado' | 'inativo';
  role?: string; // Legacy
  roles: string[]; // List of roleIds
  active?: boolean; // Legacy
  individualPermissions: Record<string, Record<string, boolean>>; 
  computedPermissions: Record<string, Record<string, boolean>>; 
  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
  lastIp?: string;
  commission?: number;
}

export const userService = {
  async listUsers(): Promise<User[]> {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },

  async getUser(id: string): Promise<User | null> {
      const snap = await getDoc(doc(db, 'users', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as User;
  },

  // Private method to create auth user without signing out current admin
  async createAuthUser(email: string, password: string): Promise<string> {
    const tempAppName = `ManagementApp_${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    
    try {
      const credential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const uid = credential.user.uid;
      await signOut(tempAuth);
      return uid;
    } finally {
      await deleteApp(tempApp);
    }
  },

  // Core function to compile final permissions
  async calculateComputedPermissions(roleIds: string[], individualPerms: Record<string, Record<string, boolean>>): Promise<Record<string, Record<string, boolean>>> {
      const allRoles = await roleService.listRoles();
      const activeUserRoles = allRoles.filter(r => roleIds.includes(r.id!) && r.active);
      
      const finalPerms: Record<string, Record<string, boolean>> = {};
      
      // Initialize full matrix with false
      MODULES.forEach(mod => {
          finalPerms[mod.id] = {};
          ACTIONS.forEach(act => {
              finalPerms[mod.id][act] = false;
          });
      });

      // Pass 1: Add from Roles
      for (const r of activeUserRoles) {
          if (!r.permissions) continue;
          for (const modId of Object.keys(r.permissions)) {
              if (!finalPerms[modId]) finalPerms[modId] = {};
              for (const act of Object.keys(r.permissions[modId])) {
                  if (r.permissions[modId][act]) {
                      finalPerms[modId][act] = true;
                  }
              }
          }
      }

      // Pass 2: Add from Individual Permits
      if (individualPerms) {
          for (const modId of Object.keys(individualPerms)) {
              if (!finalPerms[modId]) finalPerms[modId] = {};
              for (const act of Object.keys(individualPerms[modId])) {
                  if (individualPerms[modId][act]) {
                      finalPerms[modId][act] = true;
                  }
              }
          }
      }

      return finalPerms;
  },

  async saveUser(userId: string, data: Partial<User>) {
    let finalUserId = userId;
    let isCreatingProfile = userId.startsWith('temp_');

    // 1. If creating and has password, create Auth account first
    if (isCreatingProfile && data.email && data.password) {
        try {
            finalUserId = await this.createAuthUser(data.email, data.password);
            isCreatingProfile = true; // Still marked as creation but now we have real UID
        } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-progress' || authError.code === 'auth/email-already-use') {
                throw new Error("Este e-mail já possui uma conta no sistema. Use o e-mail existente.");
            }
            throw authError;
        }
    }

    const userRef = doc(db, 'users', finalUserId);
    const snap = await getDoc(userRef);
    const alreadyExists = snap.exists();
    
    let computed = data.computedPermissions;
    
    // Auto-calculate permissions if roles or individualPerms changed
    if (data.roles || data.individualPermissions) {
        const existingData = alreadyExists ? snap.data() : {};
        const mergedRoles = data.roles || existingData.roles || [];
        const mergedIndv = data.individualPermissions || existingData.individualPermissions || {};
        computed = await this.calculateComputedPermissions(mergedRoles, mergedIndv);
    }

    const payload = {
      ...data,
      ...(computed ? { computedPermissions: computed } : {}),
      updatedAt: serverTimestamp()
    } as any;
    
    delete payload.id;
    delete payload.password; // Never store password in Firestore

    if (!alreadyExists) {
        payload.createdAt = serverTimestamp();
        payload.email = data.email;
        await setDoc(userRef, payload);
        await auditLogService.logAction('Criar', 'users', finalUserId, { email: data.email });
    } else {
        await updateDoc(userRef, payload);
        await auditLogService.logAction('Editar', 'users', finalUserId, { roles: data.roles });
    }
  },

  async deleteUser(id: string) {
      await deleteDoc(doc(db, 'users', id));
      await auditLogService.logAction('Excluir', 'users', id, {});
  }
};
