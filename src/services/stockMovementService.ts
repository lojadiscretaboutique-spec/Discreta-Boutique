import { collection, doc, serverTimestamp, getDocs, getDoc, updateDoc, query, orderBy, limit, addDoc, where, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';
import { auditLogService } from './auditLogService';
import { stockSyncService } from './stockSyncService';
import { smartStockService } from './smartStockService';
import { resolveVariantDoc } from './variantResolver';

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
  costPrice?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt?: any;
}

export const stockMovementService = {
  async registerMovement(data: Omit<NewStockMovement, 'id' | 'createdAt' | 'previousStock' | 'newStock' | 'createdBy' | 'createdByName'>) {
    try {
      // 0. Idempotency Check for Order Movements
      if (data.orderId && data.type === 'out') {
        const existingQ = query(
          collection(db, 'stockMovements'),
          where('orderId', '==', data.orderId),
          where('productId', '==', data.productId)
        );
        const existingSnap = await getDocs(existingQ);
        const duplicate = existingSnap.docs.find(d => {
          const m = d.data();
          if (data.variantId) {
            return m.variantId === data.variantId && m.type === 'out';
          }
          return !m.variantId && m.type === 'out';
        });

        if (duplicate) {
          console.log(`[stockMovementService] Movement already exists for order ${data.orderId}, product ${data.productId}. Skipping duplicate.`);
          return true;
        }
      }

      let targetRef;
      let effectiveVariantId = data.variantId;

      if (data.variantId || data.variantName || data.sku) {
        const resolved = await resolveVariantDoc(data.productId, data.variantId, data.variantName, data.sku);
        if (resolved) {
          targetRef = resolved.ref;
          effectiveVariantId = resolved.variantId;
        } else if (data.variantId) {
          targetRef = doc(db, `products/${data.productId}/variants/${data.variantId}`);
        } else {
          targetRef = doc(db, 'products', data.productId);
        }
      } else {
        targetRef = doc(db, 'products', data.productId);
      }

      // 1. Atomic Firestore Transaction for Stock Concurrency & Balance Integrity
      return await runTransaction(db, async (transaction) => {
        const pSnap = await transaction.get(targetRef);
        if (!pSnap.exists()) {
          throw new Error(`Item não encontrado na base de dados (${data.productName})`);
        }

        const pData = pSnap.data();
        const currentStock = Number(pData.stock) || 0;

        let newStock = currentStock;
        if (data.type === 'in') {
          newStock += data.quantity;
        } else if (data.type === 'out') {
          if (currentStock < data.quantity && !pData.allowBackorder) {
            throw new Error(`Estoque insuficiente para "${data.productName}". Disponível: ${currentStock}, solicitado: ${data.quantity}`);
          }
          newStock = currentStock - data.quantity;
        }

        let resolvedCostPrice = (data as any).costPrice;
        if (typeof resolvedCostPrice !== 'number' || resolvedCostPrice <= 0) {
          if (pData && typeof pData.costPrice === 'number' && pData.costPrice > 0) {
            resolvedCostPrice = pData.costPrice;
          }
        }

        const newMovementRef = doc(collection(db, 'stockMovements'));
        const movementData: any = {
          ...data,
          variantId: effectiveVariantId || null,
          costPrice: resolvedCostPrice || 0,
          status: data.status || 'realizada',
          previousStock: currentStock,
          newStock: newStock,
          createdBy: auth.currentUser?.uid || 'system',
          createdByName: auth.currentUser?.email || 'Admin',
          createdAt: serverTimestamp(),
        };

        Object.keys(movementData).forEach(key => {
          if (movementData[key] === undefined) {
            delete movementData[key];
          }
        });

        const updatePayload: any = {
          stock: newStock,
          updatedAt: serverTimestamp()
        };

        if (data.type === 'in' && newStock > 0) {
          updatePayload.active = true;
        }

        transaction.set(newMovementRef, movementData);
        transaction.update(targetRef, updatePayload);

        return { newStock, effectiveVariantId };
      }).then(async () => {
        // Post-transaction operations
        if (data.productId) {
          smartStockService.updateProductSmartMinStock(data.productId);
        }

        if (effectiveVariantId) {
          try {
            await stockSyncService.syncParentStock(data.productId);
          } catch (e) {
            console.warn("Não foi possível sincronizar o estoque total do produto pai:", e);
          }
        }

        await auditLogService.logAction('Registrar', 'stock_movement', data.productId, { 
          qty: data.quantity, 
          type: data.type, 
          reason: data.reason, 
          variantId: effectiveVariantId || null, 
          orderId: data.orderId || null 
        });

        return true;
      });
    } catch (error: any) {
      console.error("Erro ao registrar movimentação de estoque:", error);
      throw error;
    }
  },

  async registerMultipleMovements(movements: Array<Omit<NewStockMovement, 'id' | 'createdAt' | 'previousStock' | 'newStock' | 'createdBy' | 'createdByName'>>) {
    const results = [];
    for (const mov of movements) {
      const res = await this.registerMovement(mov);
      results.push(res);
    }
    return results;
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

          // Sincronizar o pai se houver variações envolvidas
          if (m.variantId) {
            try {
              await stockSyncService.syncParentStock(m.productId);
            } catch (e) {
              console.warn("Erro ao sincronizar pai após estorno:", e);
            }
          }
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
