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

export interface Receivable {
  id: string;
  saleId: string;
  paymentMethodId: string;
  paymentMethodNameSnapshot: string;
  cardBrandId?: string;
  cardBrandNameSnapshot?: string;
  cardMachineId?: string;
  cardMachineNameSnapshot?: string;
  feeRuleId?: string;
  originalAmount: number; // Gross amount
  netAmount: number; // Net amount after fees
  fee: number; // Total deduction (percentageFee + fixedFee in value)
  percentageFee?: number;
  fixedFee?: number;
  payoutDate: string; // Predicted compensation date
  compensationDaysType?: 'corridos' | 'uteis';
  status: 'pending' | 'cleared';
  notes?: string;
  method?: string; // Legacy fallback
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

export interface MethodConfig {
  id: string;
  name: string;
  label?: string; // Legacy fallback
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

  async listActivePaymentMethods(): Promise<MethodConfig[]> {
    const list = await this.getPaymentMethods();
    return list.filter(m => m.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },

  // Context listing helper
  async listPaymentMethodsByContext(context: 'site' | 'pdv' | 'caixa' | 'pedidos' | 'financeiro' | 'recebiveis' | 'checkout_entrega' | 'checkout_retirada' | 'delivery' | 'pickup' | 'cupons' | 'promocoes'): Promise<MethodConfig[]> {
    const methods = await this.getPaymentMethods();
    return methods
      .filter(m => m.active)
      .filter(m => {
        if (context === 'site') return m.showOnSite;
        if (context === 'pdv' || context === 'caixa') return m.showOnPDV;
        if (context === 'checkout_entrega' || context === 'delivery') return m.showOnSite && (m.availableForDelivery ?? m.enabledDelivery);
        if (context === 'checkout_retirada' || context === 'pickup') return m.showOnSite && (m.availableForPickup ?? m.enabledPickup);
        // orders, financial launches, coupons, promotions just need to be active (already filtered above)
        return true;
      })
      .sort((a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10) || (a.name || '').localeCompare(b.name || ''));
  },

  // Compatibility wrappers for older/newer context calls
  async getPaymentMethodsForSiteDelivery(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('checkout_entrega');
  },

  async getPaymentMethodsForSitePickup(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('checkout_retirada');
  },

  async getPaymentMethodsForPDV(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('pdv');
  },

  async getPaymentMethodsForCashier(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('caixa');
  },

  async getPaymentMethodsForSite(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('site');
  },

  async getPaymentMethodsForDelivery(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('delivery');
  },

  async getPaymentMethodsForPickup(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('pickup');
  },

  async getPaymentMethodsForFinancialLaunch(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('financeiro');
  },

  async getPaymentMethodsForFinancialLaunches(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('financeiro');
  },

  async getPaymentMethodsForOrders(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('pedidos');
  },

  async getPaymentMethodsForCoupons(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('cupons');
  },

  async getPaymentMethodsForPromotions(): Promise<MethodConfig[]> {
    return this.listPaymentMethodsByContext('promocoes');
  },

  async getPaymentMethodById(id: string): Promise<MethodConfig | undefined> {
    const list = await this.getPaymentMethods();
    return list.find(m => m.id === id);
  },

  // Receivables
  async getReceivables(): Promise<Receivable[]> {
    const list: Receivable[] = [];
    try {
      const snap = await getDocs(query(collection(db, 'financial_receivables'), orderBy('updatedAt', 'desc')));
      snap.docs.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Receivable);
      });
    } catch (e) {
      console.warn("Could not fetch elements from financial_receivables:", e);
    }

    try {
      const snapOld = await getDocs(query(collection(db, 'financialReceivables'), orderBy('updatedAt', 'desc')));
      snapOld.docs.forEach(doc => {
        const d = doc.data();
        // Avoid duplicate entry if same ID
        if (list.some(item => item.id === doc.id)) return;
        list.push({
          id: doc.id,
          saleId: d.saleId || '',
          paymentMethodId: d.paymentMethodId || '',
          paymentMethodNameSnapshot: d.paymentMethodNameSnapshot || d.method || '',
          originalAmount: d.originalAmount !== undefined ? d.originalAmount : (d.value || 0),
          netAmount: d.netAmount !== undefined ? d.netAmount : (d.value || 0),
          fee: d.fee || 0,
          payoutDate: d.payoutDate || '',
          status: d.status || 'pending',
          method: d.method || '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        } as Receivable);
      });
    } catch (e) {
      console.warn("Could not fetch elements from legacy financialReceivables:", e);
    }

    return list;
  },
};
