import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Interfaces for Financial Module
export interface BankConfig {
  id: string;
  name: string;
  agency: string;
  account: string;
  accountType: 'corrente' | 'poupanca';
  titular: string;
  pixKey: string;
  isDefault: boolean;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Acquirer {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface CardBrand {
  id: string;
  name: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface MachineConfig {
  id: string;
  name: string;
  acquirerId: string;
  serial: string;
  bankAccountId: string;
  monthlyFee: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface PaymentFee {
  id: string;
  paymentMethodId: string;
  paymentMethodNameSnapshot: string;
  cardBrandId?: string;
  cardBrandNameSnapshot?: string;
  cardMachineId?: string;
  cardMachineNameSnapshot?: string;
  installments: number;
  percentageFee: number;
  fixedFee: number;
  compensationDays: number;
  compensationDaysType: 'corridos' | 'uteis';
  active: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MethodConfig {
  id: string;
  name: string;
  type: 'pix' | 'dinheiro' | 'debito' | 'credito' | 'transferencia' | 'link_pagamento' | 'gateway_online' | 'outro';
  icon: string;
  active: boolean;
  showOnSite: boolean;
  showOnPDV: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  requiresProof: boolean;
  requiresChange: boolean;
  gatewayProvider: 'manual' | 'mercado_pago' | 'maquininha' | 'outro';
  sortOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export const paymentFinanceService = {
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
    // We don't actually delete, we set active to false
    const ref = doc(db, colName, id);
    await updateDoc(ref, {
      active: false,
      updatedAt: serverTimestamp()
    });
  },

  // Acquirers
  async getAcquirers(): Promise<Acquirer[]> { return this.getCollection<Acquirer>('financial_acquirers'); },
  async addAcquirer(data: Acquirer): Promise<void> { return this.addDocument('financial_acquirers', data); },
  async updateAcquirer(data: Acquirer): Promise<void> { return this.updateDocument('financial_acquirers', data); },
  async deleteAcquirer(id: string): Promise<void> { return this.deleteDocument('financial_acquirers', id); },

  // Card Brands
  async getCardBrands(): Promise<CardBrand[]> { return this.getCollection<CardBrand>('financial_card_brands'); },
  async addCardBrand(data: CardBrand): Promise<void> { return this.addDocument('financial_card_brands', data); },
  async updateCardBrand(data: CardBrand): Promise<void> { return this.updateDocument('financial_card_brands', data); },
  async deleteCardBrand(id: string): Promise<void> { return this.deleteDocument('financial_card_brands', id); },

  // Payment Fees
  async getPaymentFees(): Promise<PaymentFee[]> { return this.getCollection<PaymentFee>('financial_payment_fees'); },
  async addPaymentFee(data: PaymentFee): Promise<void> { return this.addDocument('financial_payment_fees', data); },
  async updatePaymentFee(data: PaymentFee): Promise<void> { return this.updateDocument('financial_payment_fees', data); },
  async deletePaymentFee(id: string): Promise<void> { return this.deleteDocument('financial_payment_fees', id); },

  // Banks
  async getBankAccounts(): Promise<BankConfig[]> { return this.getCollection<BankConfig>('financial_bank_accounts'); },

  // Machines
  async getMachines(): Promise<MachineConfig[]> { return this.getCollection<MachineConfig>('financial_card_machines'); },


  // Payment Methods
  async getPaymentMethods(): Promise<MethodConfig[]> {
    return this.getCollection<MethodConfig>('financial_payment_methods');
  },

  async listPaymentMethodsByContext(context: 'site' | 'pdv' | 'delivery' | 'pickup'): Promise<MethodConfig[]> {
      const methods = await this.getPaymentMethods();
      return methods
        .filter(m => m.active)
        .filter(m => {
            if (context === 'site') return m.showOnSite;
            if (context === 'pdv') return m.showOnPDV;
            if (context === 'delivery') return m.availableForDelivery;
            if (context === 'pickup') return m.availableForPickup;
            return true;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
};
