import { collection, doc, serverTimestamp, getDocs, getDoc, updateDoc, query, orderBy, limit, addDoc, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { auditLogService } from './auditLogService';

export interface NewStockMovement {
  id?: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  status?: 'reservado' | 'realizada';
  channel?: string;
  notes?: string;
  orderId?: string;
  previousStock?: number;
  newStock?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt?: any;
}

export const stockMovementService = {
  async registerMovement(data: Omit<NewStockMovement, 'id' | 'createdAt' | 'previousStock' | 'newStock' | 'createdBy' | 'createdByName'>) {
    try {
      let targetRef;
      if (data.variantId) {
        targetRef = doc(db, `products/${data.productId}/variants/${data.variantId}`);
      } else {
        targetRef = doc(db, 'products', data.productId);
      }
      
      // 1. Get current item to retrieve stock securely
      const pSnap = await getDoc(targetRef);
      if (!pSnap.exists()) throw new Error("Item não encontrado na base de dados (Produto ou Variação)");
      
      const currentStock = pSnap.data().stock || 0;

      // 2. Calculate new stock mathematically
      let newStock = currentStock;
      if (data.type === 'in') newStock += data.quantity;
      else if (data.type === 'out') newStock -= data.quantity;
      
      // Allow negative stock only if specifically allowed, but generally we prevent it
      // if (newStock < 0) throw new Error(`Operação Negada: O estoque atual é de ${currentStock} unid. Você solicitou subtrair ${data.quantity}.`);

      // 3. Create movement doc explicitly safely
      const movementData: any = {
        ...data,
        status: data.status || 'realizada',
        previousStock: currentStock,
        newStock: newStock,
        createdBy: auth.currentUser?.uid || 'system',
        createdByName: auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp(),
      };

      // Clean undefined fields to avoid FirebaseError: Function addDoc() called with invalid data
      Object.keys(movementData).forEach(key => {
        if (movementData[key] === undefined) {
          delete movementData[key];
        }
      });

      await addDoc(collection(db, 'stockMovements'), movementData);

      // 4. Update the related product's/variant's stock directly
      await updateDoc(targetRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });

      // 5. Audit Log
      await auditLogService.logAction('Registrar', 'stock_movement', data.productId, { 
        qty: data.quantity, 
        type: data.type, 
        reason: data.reason, 
        variantId: data.variantId || null, 
        orderId: data.orderId || null 
      });

      return true;
    } catch (error: any) {
      console.error("Erro ao registrar movimentação de estoque:", error);
      throw error;
    }
  },

  async deleteMovementsByOrderId(orderId: string) {
    try {
      const q = query(collection(db, 'stockMovements'), where('orderId', '==', orderId));
      const snap = await getDocs(q);
      
      for (const movementDoc of snap.docs) {
        const m = movementDoc.data() as NewStockMovement;
        let targetRef;
        if (m.variantId) {
          targetRef = doc(db, `products/${m.productId}/variants/${m.variantId}`);
        } else {
          targetRef = doc(db, 'products', m.productId);
        }

        // Revert balance
        const pSnap = await getDoc(targetRef);
        if (pSnap.exists()) {
          const currentStock = pSnap.data().stock || 0;
          const revertedStock = m.type === 'in' ? currentStock - m.quantity : currentStock + m.quantity;
          
          await updateDoc(targetRef, {
            stock: revertedStock,
            updatedAt: serverTimestamp()
          });
        }

        await deleteDoc(movementDoc.ref);
      }
      return true;
    } catch (error) {
      console.error("Error deleting movements by orderId:", error);
      throw error;
    }
  },

  async listMovements(maxItems = 500) {
    try {
      const q = query(
        collection(db, 'stockMovements'),
        orderBy('createdAt', 'desc'),
        limit(maxItems)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewStockMovement));
    } catch (error: any) {
      console.error("Error listing stock movements:", error);
      if (error?.code === 'permission-denied') {
          throw new Error("Permissão negada ao listar histórico de estoque.");
      }
      return [];
    }
  },

  async realizeMovementsByOrderId(orderId: string, newReason?: string) {
    try {
      const q = query(collection(db, 'stockMovements'), where('orderId', '==', orderId), where('status', '==', 'reservado'));
      const snap = await getDocs(q);
      
      const batch = [];
      for (const movementDoc of snap.docs) {
        const updateData: any = { 
          status: 'realizada',
          updatedAt: serverTimestamp()
        };
        if (newReason) {
            updateData.reason = newReason;
        }
        batch.push(updateDoc(movementDoc.ref, updateData));
      }
      await Promise.all(batch);
      return true;
    } catch (error) {
      console.error("Error realizing movements:", error);
      throw error;
    }
  }
};
