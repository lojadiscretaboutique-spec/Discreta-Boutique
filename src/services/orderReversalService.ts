import { db } from '../lib/firebase';
import { 
  doc, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { inventoryRollbackService } from './inventoryRollbackService';
import { financialRollbackService } from './financialRollbackService';
import { pdvRecoveryService } from './pdvRecoveryService';
import { auditLogService } from './auditLogService';
import { canReverseOrder } from '../utils/orderReversalValidation';

export const orderReversalService = {
  /**
   * Validates if an order can be reversed
   */
  async validateOrderReversal(order: any, currentSession: any) {
    if (!currentSession || String(currentSession.status).toUpperCase() !== 'ABERTO') {
      throw new Error('O caixa precisa estar aberto para realizar estornos.');
    }

    if (!canReverseOrder(order, currentSession)) {
      throw new Error('Este pedido não pode ser estornado porque não atende as regras (cancelado/estornado ou de dias anteriores).');
    }

    return true;
  },

  /**
   * Main orchestration for order reversal
   */
  async reverseOrder(order: any, userId: string, userEmail: string, navigate: (path: string) => void) {
    try {
      // 1. Rollback Stock
      await inventoryRollbackService.restoreInventory(order.id);

      // 2. Remove Financial and Cash Entries
      await financialRollbackService.reverseFinancialEntries(order.id);

      // 3. Mark order as ESTORNADO to preserve historical trace but effectively remove from sales
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'ESTORNADO',
        reversedAt: Timestamp.now(),
        reversedBy: userId,
        notes: (order.notes || '') + ` | ESTORNADO em ${new Date().toLocaleString()} por ${userEmail}`
      });

      // 4. Audit Log
      await auditLogService.logAction(
        'ORDER_REVERSAL',
        'ORDERS',
        order.id,
        {
          userId,
          userEmail,
          description: `Estorno total do pedido ${order.id}. Financeiro, Caixa e Estoque revertidos.`,
          metadata: { orderId: order.id, total: order.total }
        }
      );

      // 5. Reopen in PDV
      await pdvRecoveryService.reopenOrderInPDV(order, navigate);

      return true;
    } catch (error: any) {
      console.error('[ORDER_REVERSAL_ORCHESTRATION_ERROR]', error);
      throw error;
    }
  }
};
