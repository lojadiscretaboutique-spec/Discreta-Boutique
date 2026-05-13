import { db } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export const financialRollbackService = {
  async reverseFinancialEntries(orderId: string) {
    const batch = writeBatch(db);
    try {
      // 1. Rollback Financial Transactions
      const finQuery = query(collection(db, 'financial_transactions'), where('orderId', '==', orderId));
      const finDocs = await getDocs(finQuery);
      finDocs.forEach(d => batch.delete(d.ref));

      // 2. Rollback Cash Session Transactions
      const cashQuery = query(collection(db, 'cashTransactions'), where('orderId', '==', orderId));
      const cashDocs = await getDocs(cashQuery);
      cashDocs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      return true;
    } catch (error) {
      console.error('[FINANCIAL_ROLLBACK_ERROR]', error);
      throw new Error('Falha ao estornar lançamentos financeiros e de caixa.');
    }
  }
};
