import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, orderBy, where, serverTimestamp, limit, addDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';

export interface CashSession {
    id?: string;
    openedById: string;
    openedByName: string;
    openedAt: Timestamp | any;
    closedAt?: Timestamp | any;
    initialBalance: number;
    finalBalance?: number;
    totalInputs: number;
    totalOutputs: number;
    status: 'aberto' | 'fechado';
    notes?: string;
}

export interface CashTransaction {
    id?: string;
    sessionId?: string;
    type: 'entrada' | 'saida';
    category: string;
    amount: number;
    description: string;
    paymentMethod: string;
    createdAt: Timestamp | any;
    userId: string;
    source: 'loja_fisica' | 'loja_virtual' | 'ajuste';
    orderId?: string;
    financialId?: string;
}

export const cashService = {
  // SESSIONS
  async getCurrentSession(): Promise<CashSession | null> {
    const q = query(
      collection(db, 'cashSessions'), 
      where('status', '==', 'aberto'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as CashSession;
  },

  async openSession(data: { userId: string, userName: string, initialBalance: number }): Promise<string> {
    const active = await this.getCurrentSession();
    if (active) throw new Error("Já existe um caixa aberto.");

    const docId = `CX_${Date.now()}`;
    const ref = doc(db, 'cashSessions', docId);
    const payload: Omit<CashSession, 'id'> = {
        openedById: data.userId,
        openedByName: data.userName,
        openedAt: serverTimestamp(),
        initialBalance: data.initialBalance,
        totalInputs: 0,
        totalOutputs: 0,
        status: 'aberto'
    };

    await setDoc(ref, payload);
    await auditLogService.logAction('Abrir Caixa', 'caixa', docId, { saldoInicial: data.initialBalance });
    return docId;
  },

  async closeSession(sessionId: string, finalBalance: number, notes?: string): Promise<void> {
    const ref = doc(db, 'cashSessions', sessionId);
    await updateDoc(ref, {
        status: 'fechado',
        closedAt: serverTimestamp(),
        finalBalance,
        notes: notes || ''
    });
    await auditLogService.logAction('Fechar Caixa', 'caixa', sessionId, { saldoFinal: finalBalance });
  },

  async reopenSession(sessionId: string): Promise<void> {
    const active = await this.getCurrentSession();
    if (active) throw new Error("Já existe um caixa aberto. Feche-o primeiro antes de reabrir outro.");

    const ref = doc(db, 'cashSessions', sessionId);
    await updateDoc(ref, {
        status: 'aberto',
        closedAt: null,
        finalBalance: null
    });
    await auditLogService.logAction('Reabrir Caixa', 'caixa', sessionId, {});
  },

  async deleteSession(sessionId: string): Promise<void> {
    // Also delete transactions
    const transactionsQ = query(collection(db, 'cashTransactions'), where('sessionId', '==', sessionId));
    const transSnap = await getDocs(transactionsQ);
    
    // Using simple loop for deletion to keep it basic and reliable
    for (const d of transSnap.docs) {
      await deleteDoc(d.ref);
    }
    
    await deleteDoc(doc(db, 'cashSessions', sessionId));
    await auditLogService.logAction('Excluir Caixa', 'caixa', sessionId, {});
  },

  async listRecentSessions(): Promise<CashSession[]> {
    const q = query(collection(db, 'cashSessions'), orderBy('openedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashSession));
  },

  // TRANSACTIONS
  async addTransaction(data: Omit<CashTransaction, 'id' | 'createdAt'>): Promise<string> {
      const ref = collection(db, 'cashTransactions');
      const payload: Omit<CashTransaction, 'id'> = {
          ...data,
          createdAt: serverTimestamp()
      };
      const docRef = await addDoc(ref, payload);

      // Update session totals if tied to session
      if (data.sessionId) {
          const sessionRef = doc(db, 'cashSessions', data.sessionId);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
              const session = sessionSnap.data() as CashSession;
              if (data.type === 'entrada') {
                  await updateDoc(sessionRef, { totalInputs: (session.totalInputs || 0) + data.amount });
              } else {
                  await updateDoc(sessionRef, { totalOutputs: (session.totalOutputs || 0) + data.amount });
              }
          }
      }

      await auditLogService.logAction('Lancamento Caixa', 'caixa', docRef.id, { tipo: data.type, valor: data.amount });
      return docRef.id;
  },

  async updateTransaction(id: string, data: Partial<CashTransaction>): Promise<void> {
    const ref = doc(db, 'cashTransactions', id);
    const oldSnap = await getDoc(ref);
    if (!oldSnap.exists()) throw new Error("Lançamento não encontrado.");
    const oldData = oldSnap.data() as CashTransaction;

    await updateDoc(ref, data);

    // Update session totals if amount or type changed and session is tracked
    if (oldData.sessionId && (data.amount !== undefined || data.type !== undefined)) {
        const sessionRef = doc(db, 'cashSessions', oldData.sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
            const session = sessionSnap.data() as CashSession;
            let netInput = 0;
            let netOutput = 0;

            // Subtract old
            if (oldData.type === 'entrada') netInput -= oldData.amount;
            else netOutput -= oldData.amount;

            // Add new
            const newType = data.type || oldData.type;
            const newAmount = data.amount !== undefined ? data.amount : oldData.amount;
            if (newType === 'entrada') netInput += newAmount;
            else netOutput += newAmount;

            await updateDoc(sessionRef, { 
                totalInputs: (session.totalInputs || 0) + netInput,
                totalOutputs: (session.totalOutputs || 0) + netOutput
            });
        }
    }
    await auditLogService.logAction('Editar Lancamento Caixa', 'caixa', id, { ...data });
  },

  async deleteTransaction(id: string): Promise<void> {
    const ref = doc(db, 'cashTransactions', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as CashTransaction;

    // Update session totals
    if (data.sessionId) {
        const sessionRef = doc(db, 'cashSessions', data.sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
            const session = sessionSnap.data() as CashSession;
            if (data.type === 'entrada') {
                await updateDoc(sessionRef, { totalInputs: Math.max(0, (session.totalInputs || 0) - data.amount) });
            } else {
                await updateDoc(sessionRef, { totalOutputs: Math.max(0, (session.totalOutputs || 0) - data.amount) });
            }
        }
    }

    await deleteDoc(ref);
    await auditLogService.logAction('Excluir Lancamento Caixa', 'caixa', id, {});
  },

  async listTransactions(sessionId?: string): Promise<CashTransaction[]> {
      let q;
      if (sessionId) {
          // Removendo orderBy da query para evitar erro de índice ausente. 
          // A ordenação será feita em memória abaixo.
          q = query(collection(db, 'cashTransactions'), where('sessionId', '==', sessionId));
      } else {
          q = query(collection(db, 'cashTransactions'), orderBy('createdAt', 'desc'), limit(100));
      }
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashTransaction));
      
      // Ordenação manual em memória para o caso de busca por sessão
      if (sessionId) {
          return docs.sort((a, b) => {
              const dateA = a.createdAt?.toDate?.() || new Date(0);
              const dateB = b.createdAt?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
          });
      }

      return docs;
  },

  async deleteTransactionsByOrderId(orderId: string): Promise<void> {
    const q = query(collection(db, 'cashTransactions'), where('orderId', '==', orderId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await this.deleteTransaction(d.id!);
    }
  }
};
