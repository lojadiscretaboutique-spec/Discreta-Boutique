import { stockMovementService } from './stockMovementService';

export const inventoryRollbackService = {
  async restoreInventory(orderId: string) {
    try {
      // We use the robust deleteMovementsByOrderId which reverts balance and deletes movement logs
      return await stockMovementService.deleteMovementsByOrderId(orderId);
    } catch (error) {
      console.error('[INVENTORY_ROLLBACK_ERROR]', error);
      throw new Error('Falha ao restaurar estoque do pedido.');
    }
  }
};
