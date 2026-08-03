import { collection, doc, serverTimestamp, getDocs, getDoc, updateDoc, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { stockMovementService } from './stockMovementService';
import { financialService } from './financialService';
import { auditLogService } from './auditLogService';
import { resolveVariantDoc } from './variantResolver';

export interface PurchaseItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  quantity: number;
  costPrice: number;
  subtotal: number;
  stockProcessed?: boolean;
  stockProcessedAt?: string;
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
      if (item.stockProcessed !== undefined) cleanItem.stockProcessed = item.stockProcessed;
      if (item.stockProcessedAt !== undefined) cleanItem.stockProcessedAt = item.stockProcessedAt;
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
    
    const hasProcessedStock = (purchase.items || []).some(i => i.stockProcessed);
    if (purchase.status === 'received' || purchase.paymentStatus === 'paid' || hasProcessedStock) {
      throw new Error("Não é possível excluir uma compra que já possui lançamentos no estoque ou pagamento efetuado. Cancele a compra para estornar os lançamentos.");
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

    // 1. Revert Stock if it was received or if any individual item was processed
    const itemsToRevert = (purchase.items || []).filter(item => purchase.status === 'received' || item.stockProcessed);

    if (itemsToRevert.length > 0) {
      for (const item of itemsToRevert) {
        let resolvedVariant = null;
        if (item.variantId || item.variantName || item.sku) {
          resolvedVariant = await resolveVariantDoc(item.productId, item.variantId, item.variantName, item.sku);
        }
        const effectiveVariantId = resolvedVariant ? resolvedVariant.variantId : item.variantId;

        await stockMovementService.registerMovement({
          productId: item.productId,
          productName: item.productName,
          variantId: effectiveVariantId,
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

    // Reset stockProcessed flags on items
    const updatedItems = (purchase.items || []).map(i => ({
      ...i,
      stockProcessed: false,
      stockProcessedAt: null
    }));

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
      items: updatedItems,
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });

    await auditLogService.logAction('Cancelar', 'compras', id, { supplier: purchase.supplier });
  },

  async finalizePurchase(id: string): Promise<void> {
    const ref = doc(db, 'purchases', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Compra não encontrada no sistema.");
    
    const purchase = { id: snap.id, ...snap.data() } as Purchase;
    if (purchase.status === 'received') throw new Error("Esta compra já foi totalmente recebida e o estoque atualizado.");

    if (!purchase.items || purchase.items.length === 0) {
      throw new Error("Esta compra não possui itens lançados para dar entrada no estoque.");
    }

    const shipping = purchase.shipping || 0;
    const itemsSubtotalSum = purchase.items.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);

    // Deep copy items array to update stockProcessed flags per item atomically
    const currentItems: PurchaseItem[] = purchase.items.map(i => ({ ...i }));

    // 1. Update Stock for each unprocessed item and Update Product Cost Price (Weighted Average)
    for (let index = 0; index < currentItems.length; index++) {
      const item = currentItems[index];
      const itemDesc = `${item.productName || 'Produto'}${item.variantName ? ' - ' + item.variantName : ''}${item.sku ? ' (SKU: ' + item.sku + ')' : ''}`;

      // IDEMPOTENCY CHECK: If this item was ALREADY processed into stock in a previous run, NEVER process it again!
      if (item.stockProcessed) {
        console.log(`[finalizePurchase] Item "${itemDesc}" já foi processado no estoque anteriormente. Ignorando re-processamento.`);
        continue;
      }

      try {
        if (!item.productId) {
          throw new Error("ID do produto não informado no item da compra.");
        }

        // Check if main product exists
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Produto não encontrado na base de dados (ID: ${item.productId}).`);
        }

        // Check if variant exists if variant details are provided or product has variants
        let resolvedVariant = null;
        if (item.variantId || item.variantName || item.sku) {
          resolvedVariant = await resolveVariantDoc(item.productId, item.variantId, item.variantName, item.sku);
          if (!resolvedVariant && item.variantId) {
            throw new Error(`Variação "${item.variantName || item.variantId}" não encontrada no produto (ID: ${item.productId}).`);
          }
        }

        const effectiveVariantId = resolvedVariant ? resolvedVariant.variantId : item.variantId;

        // Calculate item cost price with shipping diluted
        let purchaseCostWithShipping = item.costPrice;
        if (shipping > 0 && itemsSubtotalSum > 0) {
          const shippingPortion = (item.costPrice / itemsSubtotalSum) * shipping;
          purchaseCostWithShipping = item.costPrice + shippingPortion;
        }

        // Get current product data BEFORE movement for correct average calculation
        const productInfo = productSnap.data();
        const currentStock = productInfo.stock || 0;
        const currentCost = productInfo.costPrice || 0;
        const purchaseQty = item.quantity;
        const purchaseCost = purchaseCostWithShipping;

        let nextCostPrice = purchaseCostWithShipping;

        // If we have stock, calculate average. If zero or negative, use purchase price.
        if (currentStock > 0) {
          nextCostPrice = ((currentStock * currentCost) + (purchaseQty * purchaseCost)) / (currentStock + purchaseQty);
        }

        await stockMovementService.registerMovement({
          productId: item.productId,
          productName: item.productName,
          variantId: effectiveVariantId,
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

        // Also update variant cost price if it exists
        if (effectiveVariantId || resolvedVariant) {
          const variantRef = resolvedVariant ? resolvedVariant.ref : doc(db, `products/${item.productId}/variants`, effectiveVariantId!);
          const variantSnap = resolvedVariant ? resolvedVariant.snap : await getDoc(variantRef);
          
          let nextVariantCostPrice = purchaseCostWithShipping;
          
          if (variantSnap.exists()) {
            const variantInfo = variantSnap.data();
            const currentVariantStock = variantInfo.stock || 0;
            const currentVariantCost = variantInfo.costPrice || 0;
            
            if (currentVariantStock > 0) {
              nextVariantCostPrice = ((currentVariantStock * currentVariantCost) + (item.quantity * purchaseCostWithShipping)) / (currentVariantStock + item.quantity);
            }
          }

          await updateDoc(variantRef, {
            costPrice: Number(nextVariantCostPrice.toFixed(2)),
            updatedAt: serverTimestamp()
          });
        }

        // ATOMIC ITEM PERSISTENCE: Mark item as stockProcessed immediately and save to Firestore
        currentItems[index].stockProcessed = true;
        currentItems[index].stockProcessedAt = new Date().toISOString();

        await updateDoc(ref, {
          items: currentItems,
          updatedAt: serverTimestamp()
        });

      } catch (err: any) {
        const errorText = err?.message || String(err);
        throw new Error(`Erro ao dar entrada no produto "${itemDesc}": ${errorText}`);
      }
    }

    // 2. Finalize Purchase Status once all items are processed successfully
    await updateDoc(ref, {
      items: currentItems,
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
