import { collection, doc, serverTimestamp, getDocs, getDoc, updateDoc, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { stockMovementService } from './stockMovementService';
import { financialService } from './financialService';
import { auditLogService } from './auditLogService';

export interface PurchaseItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  quantity: number;
  costPrice: number;
  subtotal: number;
}

export interface Purchase {
  id?: string;
  supplier: string;
  total: number;
  shipping?: number;
  status: 'draft' | 'received' | 'cancelled';
  paymentStatus: 'pending' | 'paid';
  category: string;
  items: PurchaseItem[];
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const purchaseService = {
  async listPurchases(maxItems = 100): Promise<Purchase[]> {
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
  },

  async savePurchase(data: Partial<Purchase>): Promise<string> {
    const isNew = !data.id;
    const items = data.items || [];
    const total = items.reduce((acc, item) => acc + item.subtotal, 0);
    
    // Cleanup items to avoid undefined values which Firestore doesn't like
    const cleanedItems = items.map(item => {
      const cleanItem: any = {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        quantity: item.quantity,
        costPrice: item.costPrice,
        subtotal: item.subtotal
      };
      if (item.variantId) cleanItem.variantId = item.variantId;
      if (item.variantName) cleanItem.variantName = item.variantName;
      return cleanItem;
    });

    const payload = {
      ...data,
      items: cleanedItems,
      total,
      updatedAt: serverTimestamp()
    } as any;
    
    // Remove undefined fields from payload
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    let docId = data.id;

    if (isNew) {
      payload.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, 'purchases'), payload);
      docId = docRef.id;
      await auditLogService.logAction('Criar', 'compras', docId, { supplier: data.supplier, total });
    } else {
      const docRef = doc(db, 'purchases', docId!);
      delete payload.id;
      await updateDoc(docRef, payload);
      await auditLogService.logAction('Editar', 'compras', docId!, { supplier: data.supplier, total });
    }

    return docId!;
  },

  async deletePurchase(id: string): Promise<void> {
    const ref = doc(db, 'purchases', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Compra não encontrada");
    const purchase = snap.data() as Purchase;
    
    if (purchase.status === 'received' || purchase.paymentStatus === 'paid') {
      throw new Error("Não é possível excluir uma compra que já foi paga ou recebida. Utilize o cancelamento.");
    }

    await deleteDoc(ref);
    await auditLogService.logAction('Excluir', 'compras', id, {});
  },

  async cancelPurchase(id: string): Promise<void> {
    const ref = doc(db, 'purchases', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Compra não encontrada");
    
    const purchase = { id: snap.id, ...snap.data() } as Purchase;
    if (purchase.status === 'cancelled') throw new Error("Esta compra já está cancelada.");

    // 1. Revert Stock if it was received
    if (purchase.status === 'received') {
      for (const item of purchase.items) {
        await stockMovementService.registerMovement({
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          sku: item.sku,
          type: 'out',
          quantity: item.quantity,
          reason: 'Estorno de Compra (Cancelamento)',
          channel: 'Admin/Compras',
          notes: `Cancelamento Compra #${id.slice(-6).toUpperCase()}`
        });
      }
    }

    // 2. Revert Financial if it was paid
    if (purchase.paymentStatus === 'paid') {
      await financialService.saveTransaction({
        type: 'revenue',
        description: `Estorno Compra Cancelada: ${purchase.supplier}`,
        amount: purchase.total,
        dueDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        status: 'paid',
        category: 'Reembolsos',
        paymentMethod: 'Não informado',
        notes: `Estorno Compra #${id.slice(-6).toUpperCase()}`
      });
    }

    // 3. Update Status
    await updateDoc(ref, {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });

    await auditLogService.logAction('Cancelar', 'compras', id, { supplier: purchase.supplier });
  },

  async finalizePurchase(id: string): Promise<void> {
    const ref = doc(db, 'purchases', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Compra não encontrada");
    
    const purchase = { id: snap.id, ...snap.data() } as Purchase;
    if (purchase.status === 'received') throw new Error("Esta compra já foi recebida e o estoque já foi atualizado.");

    const shipping = purchase.shipping || 0;
    const itemsSubtotalSum = purchase.items.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);

    // 1. Update Stock for each item and Update Product Cost Price (Weighted Average)
    for (const item of purchase.items) {
      // Calculate item cost price with shipping diluted
      let purchaseCostWithShipping = item.costPrice;
      if (shipping > 0 && itemsSubtotalSum > 0) {
        const shippingPortion = (item.costPrice / itemsSubtotalSum) * shipping;
        purchaseCostWithShipping = item.costPrice + shippingPortion;
      }

      // Get current product data BEFORE movement for correct average calculation
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      
      let nextCostPrice = purchaseCostWithShipping;

      if (productSnap.exists()) {
        const productInfo = productSnap.data();
        const currentStock = productInfo.stock || 0;
        const currentCost = productInfo.costPrice || 0;
        const purchaseQty = item.quantity;
        const purchaseCost = purchaseCostWithShipping;

        // If we have stock, calculate average. If zero or negative, use purchase price.
        if (currentStock > 0) {
          nextCostPrice = ((currentStock * currentCost) + (purchaseQty * purchaseCost)) / (currentStock + purchaseQty);
        }
      }

      await stockMovementService.registerMovement({
        productId: item.productId,
        productName: item.productName,
        variantId: item.variantId,
        variantName: item.variantName,
        sku: item.sku,
        type: 'in',
        quantity: item.quantity,
        reason: 'Entrada por Compra',
        channel: 'Admin/Compras',
        notes: `Ref: Compra #${id.slice(-6).toUpperCase()}`
      });

      // Update parent product cost price with calculated weighted average
      await updateDoc(productRef, {
        costPrice: Number(nextCostPrice.toFixed(2)),
        updatedAt: serverTimestamp()
      });
    }

    // 2. Update Purchase Status
    await updateDoc(ref, {
      status: 'received',
      updatedAt: serverTimestamp()
    });

    await auditLogService.logAction('Receber', 'compras', id, { supplier: purchase.supplier });
  },

  async markAsPaid(id: string, paymentMethod?: string): Promise<void> {
    const ref = doc(db, 'purchases', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Compra não encontrada");
    
    const purchase = { id: snap.id, ...snap.data() } as Purchase;
    
    // 1. Create Financial Transaction (Expense)
    await financialService.saveTransaction({
      type: 'expense',
      description: `Pagamento Compra: ${purchase.supplier}`,
      amount: purchase.total,
      dueDate: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      status: 'paid',
      category: purchase.category || 'Fornecedores',
      paymentMethod: paymentMethod || 'Não informado',
      notes: `Ref: Compra #${id.slice(-6).toUpperCase()}`
    });

    // 2. Update Purchase Payment Status
    await updateDoc(ref, {
      paymentStatus: 'paid',
      updatedAt: serverTimestamp()
    });

    await auditLogService.logAction('Pagar', 'compras', id, { supplier: purchase.supplier });
  }
};
