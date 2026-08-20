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
    
    // SYNC INTELIGENTE COM O CAIXA
    // Se o status for 'paid', registramos/atualizamos no caixa se houver um turno aberto
    // REGRA: Somente lança no caixa se for lançamento manual ou estorno
    const isEstorno = payload.description?.toLowerCase().includes('estorno');
    const shouldSyncToCash = payload.isManual === true || isEstorno;

    if (isNew) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);

      let createdCashTxId: string | null = null;
      let sessionTotalUpdated = false;
      let sessionRefToRollback: any = null;
      let amountToRollback = 0;
      let typeToRollback = '';

      try {
        if (payload.status === 'paid' && shouldSyncToCash) {
          const session = await cashService.getCurrentSession();
          if (session && session.id) {
            // Preparar dados do caixa limpando rigorosamente valores undefined
            const cashData: any = {
              sessionId: session.id,
              type: payload.type === 'income' ? 'entrada' : 'saida',
              category: payload.category || 'FINANCEIRO',
              amount: Number(payload.amount) || 0,
              description: `[FIN] ${payload.description || ''}`,
              paymentMethod: payload.paymentMethod || 'Outro',
              userId: payload.userId || 'system',
              source: 'loja_fisica',
              financialId: docId
            };

            if (payload.orderId) {
              cashData.orderId = payload.orderId;
            }

            // Usar ID determinístico no caixa para o lançamento manual (idempotência perfeita)
            const cashTxId = `CXTX_FIN_${docId}`;
            const cashTxRef = doc(db, 'cashTransactions', cashTxId);
            const existingCashSnap = await getDoc(cashTxRef);

            if (!existingCashSnap.exists()) {
              await setDoc(cashTxRef, {
                ...cashData,
                createdAt: serverTimestamp()
              });
              createdCashTxId = cashTxId;

              // Atualizar totais da sessão do caixa de forma controlada
              const sessionRef = doc(db, 'cashSessions', session.id);
              const sessionSnap = await getDoc(sessionRef);
              if (sessionSnap.exists()) {
                const sessionData = sessionSnap.data() as any;
                if (cashData.type === 'entrada') {
                  await updateDoc(sessionRef, { totalInputs: (sessionData.totalInputs || 0) + cashData.amount });
                } else {
                  await updateDoc(sessionRef, { totalOutputs: (sessionData.totalOutputs || 0) + cashData.amount });
                }
                sessionTotalUpdated = true;
                sessionRefToRollback = sessionRef;
                amountToRollback = cashData.amount;
                typeToRollback = cashData.type;
              }

              await auditLogService.logAction('Lancamento Caixa', 'caixa', cashTxId, { tipo: cashData.type, valor: cashData.amount });
            } else {
              // Já existia o cash transaction com este ID, atualiza sem duplicar totais indevidamente
              await updateDoc(cashTxRef, cashData);
            }
          }
        }
      } catch (cashSyncError) {
        // Se a sincronização com o caixa falhar em qualquer etapa do create, reverter tudo para evitar inconsistências
        console.error('[Financial Save - Cash Sync Failure, rolling back financial record and cash mutations]:', cashSyncError);
        try {
          if (sessionTotalUpdated && sessionRefToRollback) {
            const currentSessionSnap = await getDoc(sessionRefToRollback);
            if (currentSessionSnap.exists()) {
              const currentData = currentSessionSnap.data() as any;
              if (typeToRollback === 'entrada') {
                await updateDoc(sessionRefToRollback, { totalInputs: Math.max(0, (currentData.totalInputs || 0) - amountToRollback) });
              } else {
                await updateDoc(sessionRefToRollback, { totalOutputs: Math.max(0, (currentData.totalOutputs || 0) - amountToRollback) });
              }
            }
          }
        } catch (rollbackSessionErr) {
          console.error('[Financial Save - Rollback Session Totals Failed]:', rollbackSessionErr);
        }

        try {
          if (createdCashTxId) {
            await deleteDoc(doc(db, 'cashTransactions', createdCashTxId));
          }
        } catch (rollbackCashErr) {
          console.error('[Financial Save - Rollback Cash Transaction Failed]:', rollbackCashErr);
        }

        try {
          await deleteDoc(ref);
        } catch (rollbackError) {
          console.error('[Financial Save - Rollback Failed]:', rollbackError);
        }
        throw cashSyncError;
      }

      await auditLogService.logAction('Criar', 'financeiro', docId, { desc: data.description, type: data.type, amount: data.amount });
    } else {
      // Edição de transação existente
      await updateDoc(ref, payload);

      if (payload.status === 'paid' && shouldSyncToCash) {
        const session = await cashService.getCurrentSession();
        if (session && session.id) {
          const cashTxId = `CXTX_FIN_${docId}`;
          const cashTxRef = doc(db, 'cashTransactions', cashTxId);
          const existingCashSnap = await getDoc(cashTxRef);

          // Verificar também se havia algum registro legado criado sem o id padronizado
          let targetCashDocId = cashTxId;
          let oldCashData: any = null;

          if (existingCashSnap.exists()) {
            oldCashData = existingCashSnap.data();
          } else {
            const legacyQ = query(collection(db, 'cashTransactions'), where('financialId', '==', docId));
            const legacySnap = await getDocs(legacyQ);
            if (!legacySnap.empty) {
              targetCashDocId = legacySnap.docs[0].id;
              oldCashData = legacySnap.docs[0].data();
            }
          }

          const cashData: any = {
            sessionId: session.id,
            type: payload.type === 'income' ? 'entrada' : 'saida',
            category: payload.category || 'FINANCEIRO',
            amount: Number(payload.amount) || 0,
            description: `[FIN] ${payload.description || ''}`,
            paymentMethod: payload.paymentMethod || 'Outro',
            userId: payload.userId || 'system',
            source: 'loja_fisica',
            financialId: docId
          };

          if (payload.orderId) {
            cashData.orderId = payload.orderId;
          }

          if (oldCashData) {
            await cashService.updateTransaction(targetCashDocId, cashData);
          } else {
            // Inserir com o id padronizado
            await setDoc(cashTxRef, {
              ...cashData,
              createdAt: serverTimestamp()
            });

            const sessionRef = doc(db, 'cashSessions', session.id);
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
              const sessionData = sessionSnap.data() as any;
              if (cashData.type === 'entrada') {
                await updateDoc(sessionRef, { totalInputs: (sessionData.totalInputs || 0) + cashData.amount });
              } else {
                await updateDoc(sessionRef, { totalOutputs: (sessionData.totalOutputs || 0) + cashData.amount });
              }
            }
          }
        }
      } else if (payload.status === 'pending' || !shouldSyncToCash) {
        // Se mudou para pendente (ou não deve sincronizar), apagamos do caixa se existir
        const cashTxId = `CXTX_FIN_${docId}`;
        const cashTxRef = doc(db, 'cashTransactions', cashTxId);
        const existingCashSnap = await getDoc(cashTxRef);
        if (existingCashSnap.exists()) {
          await cashService.deleteTransaction(cashTxId);
        }

        const q = query(collection(db, 'cashTransactions'), where('financialId', '==', docId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await cashService.deleteTransaction(d.id);
          }
        }
      }

      await auditLogService.logAction('Editar', 'financeiro', docId, { desc: data.description, type: data.type, amount: data.amount });
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
