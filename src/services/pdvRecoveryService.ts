import { useCartStore } from '../store/cartStore';

export const pdvRecoveryService = {
  /**
   * Prepares and loads the order back into the PDV cart
   */
  async reopenOrderInPDV(order: any, navigate: (path: string) => void) {
    try {
      const cartStore = useCartStore.getState();
      
      // 1. Clear current cart
      cartStore.clearCart();
      
      // 2. Load order data
      cartStore.loadOrder(order);
      
      // 3. Redirect to PDV with the orderId for editing
      // We pass the orderId in URL so AdminPDV.tsx knows it's an update of an existing order
      navigate(`/admin/pdv?orderId=${order.id}`);
      
      return true;
    } catch (error) {
      console.error('[PDV_RECOVERY_ERROR]', error);
      throw new Error('Falha ao reabrir pedido no PDV.');
    }
  }
};
