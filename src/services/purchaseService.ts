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
    
    // Consolidate identical items by productId and variantId
    const consolidatedMap = new Map<string, PurchaseItem>();
    for (const item of items) {
      const key = `${item.productId}_${item.variantId || 'no_variant'}`;
      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key)!;
        const newQty = existing.quantity + item.quantity;
        const newCost = item.costPrice || existing.costPrice;
        consolidatedMap.set(key, {
          ...existing,
          quantity: newQty,
          costPrice: newCost,
          subtotal: Number((newQty * newCost).toFixed(2))
        });
      } else {
        consolidatedMap.set(key, { ...item });
      }
    }
    const consolidatedItems = Array.from(consolidatedMap.values());
    const itemsSubtotal = consolidatedItems.reduce((acc, item) => acc + item.subtotal, 0);
    const total = Number((itemsSubtotal + (data.shipping || 0)).toFixed(2));
    
    // Cleanup items to avoid undefined values which Firestore doesn't like
    const cleanedItems = consolidatedItems.map(item => {
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
    if (purchase.status === 'received' || purchase.status === 'cancelled' || purchase.paymentStatus === 'paid' || hasProcessedStock) {
      throw new Error("Não é possível excluir uma compra que já foi recebida, paga, cancelada ou possui lançamentos de estoque. Cancele a compra para manter o histórico comercial e auditoria.");
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

    // Deep copy items to track reversal status per item atomically
    const currentItems: (PurchaseItem & { stockReverted?: boolean; stockRevertedAt?: string })[] = 
      (purchase.items || []).map(i => ({ ...i }));

    // 1. Identify items that require stock reversal
    // An item requires reversal if it was processed into stock AND has not been reverted yet
    const itemsToRevertIndices: number[] = [];
    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      const wasProcessed = item.stockProcessed || purchase.status === 'received';
      const alreadyReverted = item.stockReverted === true;
      if (wasProcessed && !alreadyReverted) {
        itemsToRevertIndices.push(i);
      }
    }

    // 2. Pre-check stock levels for all items to be reverted to prevent negative stock
    for (const index of itemsToRevertIndices) {
      const item = currentItems[index];
      const itemDesc = `${item.productName || 'Produto'}${item.variantName ? ' - ' + item.variantName : ''}${item.sku ? ' (SKU: ' + item.sku + ')' : ''}`;

      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        throw new Error(`Produto não encontrado para estorno (ID: ${item.productId}).`);
      }

      let resolvedVariant = null;
      if (item.variantId || item.variantName || item.sku) {
        resolvedVariant = await resolveVariantDoc(item.productId, item.variantId, item.variantName, item.sku);
      }

      let currentStock = 0;
      if (resolvedVariant) {
        currentStock = resolvedVariant.snap.data()?.stock || 0;
      } else {
        currentStock = productSnap.data()?.stock || 0;
      }

      if (currentStock < item.quantity) {
        throw new Error(
          `Não é possível cancelar a compra: o estoque atual do item "${itemDesc}" (${currentStock} un.) é menor que a quantidade comprada (${item.quantity} un.) a ser estornada. O estoque foi parcialmente vendido ou movimentado.`
        );
      }
    }

    // 3. Perform stock reversal for items needing reversal
    const purchaseRefCode = `Cancelamento Compra #${id.slice(-6).toUpperCase()}`;

    for (const index of itemsToRevertIndices) {
      const item = currentItems[index];

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
        notes: purchaseRefCode
      });

      // Update flags on item
      currentItems[index].stockProcessed = false;
      currentItems[index].stockReverted = true;
      currentItems[index].stockRevertedAt = new Date().toISOString();

      // Save progress incrementally for partial failure safety
      await updateDoc(ref, {
        items: currentItems,
        updatedAt: serverTimestamp()
      });
    }

    // 4. Financial Reversal or Pending Transaction Cleanup
    if (purchase.paymentStatus === 'paid') {
      // Check if refund transaction already exists to guarantee idempotency
      const existingRefund = await financialService.findPurchaseTransaction(id, 'purchase_cancellation');

      if (!existingRefund) {
        const deterministicCancelTxId = `FIN_PUR_CANCEL_${id}`;
        const idempotencyKey = `purchase:${id}:cancellation`;

        await financialService.saveTransaction({
          id: deterministicCancelTxId,
          purchaseId: id,
          idempotencyKey,
          transactionType: 'purchase_cancellation',
          origin: 'compras',
          type: 'income',
          description: `Estorno Compra Cancelada: ${purchase.supplier}`,
          amount: purchase.total,
          dueDate: new Date().toISOString().split('T')[0],
          paymentDate: new Date().toISOString().split('T')[0],
          status: 'paid',
          category: 'Reembolsos',
          paymentMethod: 'Não informado',
          notes: purchaseRefCode
        });
      }
    } else {
      // If purchase was not paid, clean up any pending expense transaction associated with this purchase
      const pendingTx = await financialService.findPurchaseTransaction(id, 'purchase_payment');
      if (pendingTx && pendingTx.id && pendingTx.status === 'pending') {
        await financialService.deleteTransaction(pendingTx.id, pendingTx.description);
      }
    }

    // 5. Finalize Purchase Status as Cancelled
    await updateDoc(ref, {
      items: currentItems,
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });

    await auditLogService.logAction('Cancelar', 'compras', id, { supplier: purchase.supplier, total: purchase.total });
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

    // Idempotency check 1: if already paid on purchase doc, skip
    if (purchase.paymentStatus === 'paid') {
      console.log(`[markAsPaid] Compra ${id} já está registrada como paga. Operação ignorada.`);
      return;
    }

    // Idempotency check 2: check if payment transaction already exists via purchaseId or fallback search
    const existingTx = await financialService.findPurchaseTransaction(id, 'purchase_payment');
    if (existingTx) {
      console.log(`[markAsPaid] Transação financeira de pagamento já existe para a compra ${id} (ID: ${existingTx.id}). Atualizando apenas status da compra.`);
      await updateDoc(ref, {
        paymentStatus: 'paid',
        updatedAt: serverTimestamp()
      });
      return;
    }

    const deterministicTxId = `FIN_PUR_PAY_${id}`;
    const idempotencyKey = `purchase:${id}:payment`;

    // 1. Create Financial Transaction (Expense) with structured binding and deterministic ID
    await financialService.saveTransaction({
      id: deterministicTxId,
      purchaseId: id,
      idempotencyKey,
      transactionType: 'purchase_payment',
      origin: 'compras',
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
