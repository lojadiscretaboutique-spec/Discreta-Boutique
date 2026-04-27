import { collection, doc, serverTimestamp, runTransaction, getDocs, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product } from './productService';
import { auditLogService } from './auditLogService';

export interface StockMovement {
  id?: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  barcode?: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  updatedAt: any;
}

// Sanitizer function to recursively remove undefined
const removeUndefined = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
};

export const stockService = {
  async registerMovement(data: Omit<StockMovement, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName'>) {
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', data.productId);
        const variantRef = data.variantId ? doc(db, `products/${data.productId}/variants/${data.variantId}`) : null;
        
        // 1. Get current stock
        let currentStock = 0;
        let itemRef = productRef;
        
        if (variantRef) {
          const vSnap = await transaction.get(variantRef);
          if (!vSnap.exists()) throw new Error("Variação não encontrada");
          currentStock = vSnap.data().stock || 0;
          itemRef = variantRef;
        } else {
          const pSnap = await transaction.get(productRef);
          if (!pSnap.exists()) throw new Error("Produto não encontrado");
          currentStock = pSnap.data().stock || 0;
        }

        // 2. Calculate new stock
        let newStock = currentStock;
        if (data.type === 'in') newStock += data.quantity;
        else if (data.type === 'out') newStock -= data.quantity;
        else if (data.type === 'adjustment') newStock = data.quantity;
        
        if (newStock < 0) throw new Error("Estoque insuficiente");

        // 3. Create movement doc
        const movRef = doc(collection(db, 'stockMovements'));
        const movementData = removeUndefined({
          ...data,
          previousStock: currentStock,
          newStock,
          createdBy: auth.currentUser?.uid || 'system',
          createdByName: auth.currentUser?.email || 'System',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        transaction.set(movRef, movementData);

        // 4. Update item stock
        transaction.update(itemRef, {
          stock: newStock,
          updatedAt: serverTimestamp()
        });
      });
      await auditLogService.logAction('Registrar', 'stock', data.productId, { qty: data.quantity, type: data.type });
      console.log('Movimentação registrada com sucesso');
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
      throw error;
    }
  },

  async listMovements(maxItems = 50) {
    const q = query(collection(db, 'stockMovements'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
  }
};
