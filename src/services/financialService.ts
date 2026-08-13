import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';
import { cashService } from './cashService';

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'paid';

export interface FinancialTransaction {
  id?: string;
  type: TransactionType;
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD
  status: TransactionStatus;
  category: string;
  contact?: string;
  paymentMethod?: string;
  paymentMethodId?: string;
  paymentMethodNameSnapshot?: string;
  paymentMethodType?: string;
  gatewayProvider?: string;
  paymentContext?: string;
  notes?: string;
  orderId?: string;
  purchaseId?: string;
  idempotencyKey?: string;
  transactionType?: 'purchase_payment' | 'purchase_cancellation' | 'sale' | 'sale_refund' | 'manual' | string;
  origin?: string;
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
  isManual?: boolean;
  originalSaleAmount?: number;
  additionalAmount?: number;
}

export const financialService = {
  async listTransactions(filters?: { type?: TransactionType, status?: TransactionStatus, startDate?: string, endDate?: string }): Promise<FinancialTransaction[]> {
    let q = query(collection(db, 'financial_transactions'), orderBy('dueDate', 'desc'));
    
    const snap = await getDocs(q);
    let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));
    
    if (filters) {
      if (filters.type) {
        results = results.filter(t => t.type === filters.type);
      }
      if (filters.status) {
        results = results.filter(t => t.status === filters.status);
      }
      if (filters.startDate) {
        results = results.filter(t => t.dueDate >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter(t => t.dueDate <= filters.endDate!);
      }
    }
    
    return results;
  },

  async findPurchaseTransaction(purchaseId: string, transactionType?: 'purchase_payment' | 'purchase_cancellation'): Promise<FinancialTransaction | null> {
    try {
      // 1. Primary structured query by purchaseId
      const q = query(collection(db, 'financial_transactions'), where('purchaseId', '==', purchaseId));
      const snap = await getDocs(q);
      let matches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));

      if (transactionType) {
        matches = matches.filter(t => t.transactionType === transactionType);
      }

      if (matches.length > 0) {
        return matches[0];
      }

      // 2. Backward-compatible Legacy Fallback query
      const code = `#${purchaseId.slice(-6).toUpperCase()}`;
      const allTx = await this.listTransactions();
      const legacyMatch = allTx.find(t => {
        const text = `${t.notes || ''} ${t.description || ''}`;
        if (!text.toUpperCase().includes(code.toUpperCase())) return false;
        if (transactionType === 'purchase_payment') {
          return t.type === 'expense';
        } else if (transactionType === 'purchase_cancellation') {
          return t.type === 'income';
        }
        return true;
      });

      return legacyMatch || null;
    } catch (err) {
      console.error('[findPurchaseTransaction] Erro ao buscar transação por purchaseId:', err);
      return null;
    }
  },

  async saveTransaction(data: Partial<FinancialTransaction>): Promise<string> {
    const docId = data.id || `FIN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ref = doc(db, 'financial_transactions', docId);
    
    const snap = await getDoc(ref);
    const isNew = !snap.exists();
    
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;
    
    if (isNew) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);
      await auditLogService.logAction('Criar', 'financeiro', docId, { desc: data.description, type: data.type, amount: data.amount });
    } else {
      await updateDoc(ref, payload);
      await auditLogService.logAction('Editar', 'financeiro', docId, { desc: data.description, type: data.type, amount: data.amount });
    }

    // SYNC INTELIGENTE COM O CAIXA
    // Se o status for 'paid', registramos/atualizamos no caixa se houver um turno aberto
    // REGRA: Somente lança no caixa se for lançamento manual ou estorno
    const isEstorno = payload.description?.toLowerCase().includes('estorno');
    const shouldSyncToCash = payload.isManual === true || isEstorno;

    if (payload.status === 'paid' && shouldSyncToCash) {
        const session = await cashService.getCurrentSession();
        if (session) {
            // Procurar se já existe um lançamento de caixa para este financeiro
            const q = query(collection(db, 'cashTransactions'), where('financialId', '==', docId));
            const snap = await getDocs(q);
            
            const finSnap = await getDoc(doc(db, 'financial_transactions', docId));
            const fullData = { ...finSnap.data(), ...data } as FinancialTransaction;

            const cashData = {
                sessionId: session.id!,
                type: fullData.type === 'income' ? 'entrada' : 'saida' as any,
                category: fullData.category || 'FINANCEIRO',
                amount: fullData.amount || 0,
                description: `[FIN] ${fullData.description}`,
                paymentMethod: fullData.paymentMethod || 'Outro',
                userId: fullData.userId || 'system',
                source: 'loja_fisica' as any,
                financialId: docId,
                orderId: fullData.orderId || undefined
            };

            if (snap.empty) {
                await cashService.addTransaction(cashData);
            } else {
                await cashService.updateTransaction(snap.docs[0].id, cashData);
            }
        }
    } else if (payload.status === 'pending' || !shouldSyncToCash) {
        // Se mudou para pendente (ou não deve sincronizar), apagamos do caixa se existir
        const q = query(collection(db, 'cashTransactions'), where('financialId', '==', docId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            for (const d of snap.docs) {
                await cashService.deleteTransaction(d.id);
            }
        }
    }
    
    return docId;
  },

  async deleteTransaction(id: string, description: string): Promise<boolean> {
    // Apagar do caixa primeiro
    const q = query(collection(db, 'cashTransactions'), where('financialId', '==', id));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
        await cashService.deleteTransaction(d.id);
    }

    await deleteDoc(doc(db, 'financial_transactions', id));
    await auditLogService.logAction('Excluir', 'financeiro', id, { desc: description });
    return true;
  },

  async deleteTransactionsByOrderId(orderId: string) {
    try {
      const q = query(collection(db, 'financial_transactions'), where('orderId', '==', orderId));
      const snap = await getDocs(q);
      for (const tDoc of snap.docs) {
        await deleteDoc(tDoc.ref);
      }
      return true;
    } catch (error) {
      console.error("Error deleting financial transactions by orderId:", error);
      throw error;
    }
  },
  
  async getCategories(type: TransactionType): Promise<string[]> {
    // In a real ERP, these are often dynamic and mapped to a chart of accounts.
    // For simplicity, we'll provide standard ones or fetch distinct from DB.
    if (type === 'income') {
      return ['Vendas', 'Serviços', 'Rendimentos', 'Acréscimos/Gorjetas', 'Outras Receitas'];
    } else {
      return ['Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Água/Luz/Internet', 'Marketing', 'Despesas Operacionais', 'Outras Despesas'];
    }
  }
};
