import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';

export interface AppRole {
  id?: string;
  name: string;
  description: string;
  active: boolean;
  permissions: Record<string, Record<string, boolean>>; // { module: { action: true/false } }
  createdAt?: any;
  updatedAt?: any;
}

export const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'stock', label: 'Movimentação de Estoque' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'users', label: 'Usuários' },
  { id: 'roles', label: 'Perfis de Acesso' },
  { id: 'settings', label: 'Configurações' },
  { id: 'areasEntrega', label: 'Áreas de Entrega' },
  { id: 'caixa', label: 'Controle de Caixa' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'pdv', label: 'PDV' },
  { id: 'banners', label: 'Integrações/Banners' },
  { id: 'logs', label: 'Logs de Acesso/Auditoria' }
];

export const ACTIONS = [
  'visualizar',
  'criar',
  'editar',
  'excluir',
  'exportar',
  'aprovar',
  'cancelar',
  'imprimir',
  'reabrir'
];

export const roleService = {
  async listRoles(): Promise<AppRole[]> {
    const q = query(collection(db, 'roles'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppRole));
  },

  async getRole(id: string): Promise<AppRole | null> {
    const snap = await getDoc(doc(db, 'roles', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AppRole;
  },

  async saveRole(roleData: AppRole): Promise<string> {
    const isNew = !roleData.id;
    const ref = isNew ? doc(collection(db, 'roles')) : doc(db, 'roles', roleData.id!);
    
    // Auto populate missing modules
    const cleanPerms: Record<string, Record<string, boolean>> = {};
    for (const mod of MODULES) {
       cleanPerms[mod.id] = {};
       for (const action of ACTIONS) {
           cleanPerms[mod.id][action] = roleData.permissions?.[mod.id]?.[action] || false;
       }
    }

    const payload = {
       ...roleData,
       permissions: cleanPerms,
       updatedAt: serverTimestamp()
    } as any;
    
    // Remover o ID do payload para evitar erros de field value undefined no setDoc() do Firestore
    delete payload.id;

    if (isNew) payload.createdAt = serverTimestamp();

    await setDoc(ref, payload, { merge: true });
    
    await auditLogService.logAction(isNew ? 'Criar' : 'Editar', 'roles', ref.id, { name: roleData.name });
    
    return ref.id;
  },

  async deleteRole(id: string) {
    await deleteDoc(doc(db, 'roles', id));
    await auditLogService.logAction('Excluir', 'roles', id, {});
  }
};
