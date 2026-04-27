import { collection, doc, getDocs, getDoc, setDoc, updateDoc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';

export interface CustomerAddress {
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  referencia: string;
  complemento?: string;
}

export interface Customer {
  id?: string;
  nome: string;
  whatsapp: string;
  email?: string;
  dataNascimento?: string;
  endereco: CustomerAddress;
  status: 'ativo' | 'inativo';
  notes?: string;
  
  // Computed na runtime
  totalOrders?: number;
  totalSpent?: number;
  lastOrderAt?: any;
  
  createdAt?: any;
  updatedAt?: any;
}

export const customerService = {
  async listCustomers(): Promise<Customer[]> {
    const qC = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const snapC = await getDocs(qC);
    const customers = snapC.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    
    // Fetch all orders to compute stats
    // Note: for a massive scale app, this would require Cloud Functions,
    // but for an MVP/local business, this is perfectly fine and avoids NoSQL redundancy sync issues.
    const qO = query(collection(db, 'orders'));
    const snapO = await getDocs(qO);
    
    const statsMap: Record<string, { totalOrders: number, totalSpent: number, lastOrderAt: any }> = {};
    
    snapO.docs.forEach(doc => {
       const o = doc.data();
       if (!o.customerId) return;
       
       if (!statsMap[o.customerId]) {
          statsMap[o.customerId] = { totalOrders: 0, totalSpent: 0, lastOrderAt: o.createdAt };
       }
       
       statsMap[o.customerId].totalOrders += 1;
       statsMap[o.customerId].totalSpent += (o.total || 0);
       
       // Compare dates safely depending if literal or timestamp
       const currentLast = statsMap[o.customerId].lastOrderAt?.toDate ? statsMap[o.customerId].lastOrderAt.toDate() : new Date(0);
       const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(0);
       
       if (orderDate > currentLast) {
          statsMap[o.customerId].lastOrderAt = o.createdAt;
       }
    });

    return customers.map(c => ({
       ...c,
       totalOrders: statsMap[c.id!]?.totalOrders || 0,
       totalSpent: statsMap[c.id!]?.totalSpent || 0,
       lastOrderAt: statsMap[c.id!]?.lastOrderAt || null
    }));
  },

  async saveCustomer(data: Partial<Customer>): Promise<string> {
    // Standardize: WhatsApp is the ID
    const cleanPhone = (data.whatsapp || '').replace(/\D/g, '');
    if (!cleanPhone && !data.id) {
       throw new Error("WhatsApp é obrigatório para identificar o cliente.");
    }
    
    // If it's a new customer being created, or an edit where we want to ensure phone-as-id
    const cId = cleanPhone || data.id || `CUST_${Date.now()}`;
    const ref = doc(db, 'customers', cId);
    
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;

    // Use setDoc with merge: true to avoid overwriting if doc exists (upsert behavior)
    // or just setDoc if we want to overwrite. The user said "use as primary key".
    if (!data.id) {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
    } else {
        // If ID passed is different from new phone-based ID, we might have a collision or change.
        // For now, prioritize the phone number as the source of truth for the ID.
        await setDoc(ref, payload, { merge: true });
    }

    return cId;
  },

  async registerFromCheckout(data: Partial<Customer>): Promise<string> {
    const cleanPhone = (data.whatsapp || '').replace(/\D/g, '');
    if (!cleanPhone) throw new Error("WhatsApp obrigatório.");
    
    const cId = cleanPhone;
    const ref = doc(db, 'customers', cId);
    
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;
    
    await setDoc(ref, payload, { merge: true });
    return cId;
  },

  async getCustomerByWhatsapp(whatsapp: string): Promise<Customer | null> {
    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) return null;
    
    const cId = cleanPhone;
    const snap = await getDoc(doc(db, 'customers', cId));
    
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Customer;
    }
    return null;
  },

  async deleteOrDeactivateCustomer(id: string, hasOrders: boolean) {
    if (hasOrders) {
        await updateDoc(doc(db, 'customers', id), { status: 'inativo', updatedAt: serverTimestamp() });
        await auditLogService.logAction('Inativar', 'clientes', id, {});
    } else {
        await deleteDoc(doc(db, 'customers', id));
        await auditLogService.logAction('Excluir', 'clientes', id, {});
    }
  }
};
