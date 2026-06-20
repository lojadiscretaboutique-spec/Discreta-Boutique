import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Interfaces based on AdminPaymentMethods.tsx
export interface BankConfig {
  id: string;
  name: string;
  agency: string;
  account: string;
  pixKey: string;
  isDefault: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface MachineConfig {
  id: string;
  name: string;
  serial: string;
  operator: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface CardRate {
  id: string;
  machineId: string;
  type: string;
  brand: string;
  fee: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Receivable {
  id: string;
  saleId: string;
  originalAmount: number;
  netAmount: number;
  fee: number;
  payoutDate: string;
  status: 'pending' | 'cleared';
  method: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Reconciliation {
  id: string;
  date: string;
  systemTotal: number;
  expectedTotal: number;
  reconciled: boolean;
  operator: string;
  createdAt?: any;
  updatedAt?: any;
}

export const financialConfigService = {
  // Generic helper for collection
  async getCollection<T>(colName: string): Promise<T[]> {
    const q = query(collection(db, colName), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  },

  async addDocument<T extends { id: string }>(colName: string, data: T): Promise<void> {
    const ref = doc(db, colName, data.id);
    await setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  async updateDocument<T extends { id: string }>(colName: string, data: T): Promise<void> {
    const ref = doc(db, colName, data.id);
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async deleteDocument(colName: string, id: string): Promise<void> {
    await deleteDoc(doc(db, colName, id));
  },

  // Bank Accounts
  async getBankAccounts(): Promise<BankConfig[]> {
    return this.getCollection<BankConfig>('financialBankAccounts');
  },

  // Machines
  async getMachines(): Promise<MachineConfig[]> {
    return this.getCollection<MachineConfig>('financialCardMachines');
  },
  async migrateMachines(machines: MachineConfig[]): Promise<void> {
    const batch = writeBatch(db);
    machines.forEach(m => {
      const ref = doc(db, 'financialCardMachines', m.id);
      batch.set(ref, { ...m, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },

  // Card Rates
  async getCardRates(): Promise<CardRate[]> {
    return this.getCollection<CardRate>('financialCardFees');
  },
  async migrateCardRates(rates: CardRate[]): Promise<void> {
    const batch = writeBatch(db);
    rates.forEach(r => {
      const ref = doc(db, 'financialCardFees', r.id);
      batch.set(ref, { ...r, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },

  // Receivables
  async getReceivables(): Promise<Receivable[]> {
    return this.getCollection<Receivable>('financialReceivables');
  },
  async migrateReceivables(receivables: Receivable[]): Promise<void> {
    const batch = writeBatch(db);
    receivables.forEach(r => {
      const ref = doc(db, 'financialReceivables', r.id);
      batch.set(ref, { ...r, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },

  // Reconciliations
  async getReconciliations(): Promise<Reconciliation[]> {
    return this.getCollection<Reconciliation>('financialReconciliations');
  },
  async migrateReconciliations(reconciliations: Reconciliation[]): Promise<void> {
    const batch = writeBatch(db);
    reconciliations.forEach(r => {
      const ref = doc(db, 'financialReconciliations', r.id);
      batch.set(ref, { ...r, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },
};
