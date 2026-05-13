import { collection, doc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const stockSyncService = {
  /**
   * Calculates the total stock of a product based on its active variations.
   */
  async calculateParentStock(productId: string): Promise<number | null> {
    try {
      const variantsRef = collection(db, `products/${productId}/variants`);
      const vSnap = await getDocs(variantsRef);
      
      if (vSnap.empty) return null; // No variants, return null to stay on manual stock

      let totalStock = 0;
      vSnap.docs.forEach(d => {
        const v = d.data();
        if (v.active !== false) {
          totalStock += Math.max(0, Number(v.stock) || 0);
        }
      });

      return totalStock;
    } catch (error) {
      console.error(`Error calculating parent stock for ${productId}:`, error);
      return null;
    }
  },

  /**
   * Synchronizes the parent product's stock and status based on its variations.
   */
  async syncParentStock(productId: string): Promise<boolean> {
    try {
      const calculatedStock = await this.calculateParentStock(productId);
      
      // If null, it means there are no variants (or some error)
      if (calculatedStock === null) return false;

      const productRef = doc(db, 'products', productId);
      const isAvailable = calculatedStock > 0;

      await updateDoc(productRef, {
        stock: calculatedStock,
        available: isAvailable,
        inStock: isAvailable,
        inventory_status: isAvailable ? 'in_stock' : 'out_of_stock',
        updatedAt: serverTimestamp()
      });

      console.log(`[StockSync] Product ${productId} synced. Total stock: ${calculatedStock}`);
      return true;
    } catch (error) {
      console.error(`Error syncing parent stock for ${productId}:`, error);
      return false;
    }
  },

  /**
   * Identifies all products with variations and syncs their stock.
   * Useful for a complete system revalidation.
   */
  async syncAllProducts(): Promise<{ total: number; synced: number; errors: number }> {
    const productsRef = collection(db, 'products');
    const snap = await getDocs(productsRef);
    
    let total = 0;
    let synced = 0;
    let errors = 0;

    for (const d of snap.docs) {
      const p = d.data();
      if (p.hasVariants) {
        total++;
        const success = await this.syncParentStock(d.id);
        if (success) synced++;
        else errors++;
      }
    }

    return { total, synced, errors };
  }
};
