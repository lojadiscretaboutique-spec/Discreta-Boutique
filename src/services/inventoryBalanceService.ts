import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  runTransaction, 
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';
import { 
  InventoryBalance, 
  InventoryBalanceItem, 
  InventoryBalanceCountEvent,
  ItemCountStatus,
  InventoryBalanceScope 
} from '../types/inventoryBalance';
import { productService } from './productService';
import { stockSyncService } from './stockSyncService';
import { auditLogService } from './auditLogService';

const REMOVE_UNDEFINED = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
};

export const inventoryBalanceService = {
  /**
   * Generates the next balance code, e.g. "BAL-2026-0001"
   */
  async generateBalanceCode(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const q = query(
        collection(db, 'inventoryBalances'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      
      let nextNum = 1;
      if (!snap.empty) {
        const lastCode = snap.docs[0].data().code || '';
        const match = lastCode.match(/BAL-\d{4}-(\d+)/);
        if (match && match[1]) {
          nextNum = parseInt(match[1], 10) + 1;
        } else {
          nextNum = snap.docs.length + 1;
        }
      }
      return `BAL-${year}-${String(nextNum).padStart(4, '0')}`;
    } catch (e) {
      const year = new Date().getFullYear();
      return `BAL-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  },

  /**
   * List all inventory balances
   */
  async listBalances(): Promise<InventoryBalance[]> {
    try {
      const q = query(collection(db, 'inventoryBalances'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalance));
    } catch (e) {
      console.error('Error listing inventory balances:', e);
      return [];
    }
  },

  /**
   * Get single balance header by ID
   */
  async getBalance(id: string): Promise<InventoryBalance | null> {
    try {
      const docRef = doc(db, 'inventoryBalances', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as InventoryBalance;
    } catch (e) {
      console.error('Error getting balance:', e);
      return null;
    }
  },

  /**
   * List items of a balance
   */
  async listBalanceItems(balanceId: string): Promise<InventoryBalanceItem[]> {
    try {
      const itemsRef = collection(db, `inventoryBalances/${balanceId}/items`);
      const snap = await getDocs(itemsRef);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalanceItem));
    } catch (e) {
      console.error('Error listing balance items:', e);
      return [];
    }
  },

  /**
   * Create a new inventory balance (in RASCUNHO or ready to start)
   */
  async createBalance(data: {
    name: string;
    description?: string;
    scope: InventoryBalanceScope;
    scopeValue?: string;
    scopeOptions?: {
      onlyActive?: boolean;
      includeZeroStock?: boolean;
      includeInactive?: boolean;
    };
    blindCount?: boolean;
    notes?: string;
    startImmediately?: boolean;
  }): Promise<string> {
    const code = await this.generateBalanceCode();
    const balanceRef = doc(collection(db, 'inventoryBalances'));
    
    const balanceData: InventoryBalance = REMOVE_UNDEFINED({
      code,
      name: data.name,
      description: data.description || '',
      status: data.startImmediately ? 'EM_CONTAGEM' : 'RASCUNHO',
      scope: data.scope,
      scopeValue: data.scopeValue || '',
      scopeOptions: data.scopeOptions || {
        onlyActive: true,
        includeZeroStock: true,
        includeInactive: false
      },
      blindCount: data.blindCount !== undefined ? data.blindCount : true,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'system',
      createdByName: auth.currentUser?.email || 'Admin',
      startedAt: data.startImmediately ? serverTimestamp() : null,
      startedBy: data.startImmediately ? (auth.currentUser?.uid || 'system') : null,
      expectedItems: 0,
      countedItems: 0,
      totalExpectedUnits: 0,
      totalCountedUnits: 0,
      shortageItems: 0,
      surplusItems: 0,
      matchItems: 0,
      shortageCostValue: 0,
      surplusCostValue: 0,
      notes: data.notes || '',
      companyId: 'discreta'
    });

    await setDoc(balanceRef, balanceData);

    if (data.startImmediately) {
      await this.startBalanceSnapshot(balanceRef.id);
    }

    await auditLogService.logAction('Criar', 'inventory_balance', balanceRef.id, { code, name: data.name });
    return balanceRef.id;
  },

  /**
   * Start balance and freeze snapshot of expected stock for products & variants in scope
   */
  async startBalanceSnapshot(balanceId: string): Promise<boolean> {
    try {
      const balance = await this.getBalance(balanceId);
      if (!balance) throw new Error("Balanço não encontrado");

      // 1. Fetch all products from store
      const allProducts = await productService.listProducts();
      
      const itemsToSnapshot: Array<{
        id: string;
        productId: string;
        variantId?: string;
        productName: string;
        variantName?: string;
        sku: string;
        barcode?: string;
        categoryName?: string;
        brand?: string;
        imageUrl?: string;
        expectedSnapshot: number;
        unitCost: number;
        salePrice: number;
      }> = [];

      let totalExpectedUnits = 0;

      for (const p of allProducts) {
        // Filter by scope
        if (balance.scopeOptions?.onlyActive && !p.active) continue;
        if (balance.scope === 'CATEGORY' && balance.scopeValue && p.categoryId !== balance.scopeValue) continue;
        if (balance.scope === 'BRAND' && balance.scopeValue && (p.brand || '').toLowerCase() !== balance.scopeValue.toLowerCase()) continue;
        if (balance.scope === 'SELECTED_PRODUCTS' && balance.scopeValue) {
          const selectedIds = balance.scopeValue.split(',').map(s => s.trim());
          if (!selectedIds.includes(p.id!)) continue;
        }

        const mainImage = p.images?.find(i => i.isMain)?.url || p.images?.[0]?.url || '';

        if (p.hasVariants) {
          // Fetch variants for this product
          const pFull = await productService.getProduct(p.id!);
          const variants = pFull?.variants || [];

          for (const v of variants) {
            if (balance.scopeOptions?.onlyActive && !v.active) continue;
            const currentStock = Math.max(0, Number(v.stock) || 0);
            if (!balance.scopeOptions?.includeZeroStock && currentStock === 0) continue;

            const itemId = `${p.id}_${v.id}`;
            const cost = v.costPrice && v.costPrice > 0 ? v.costPrice : (p.costPrice || 0);
            const price = v.price && v.price > 0 ? v.price : p.price;

            itemsToSnapshot.push({
              id: itemId,
              productId: p.id!,
              variantId: v.id,
              productName: p.name,
              variantName: v.name,
              sku: v.sku || p.sku || '',
              barcode: v.barcode || p.gtin || '',
              categoryName: p.subcategory || p.categoryId || '',
              brand: p.brand || '',
              imageUrl: v.imageUrl || mainImage,
              expectedSnapshot: currentStock,
              unitCost: cost,
              salePrice: price
            });
            totalExpectedUnits += currentStock;
          }
        } else {
          const currentStock = Math.max(0, Number(p.stock) || 0);
          if (!balance.scopeOptions?.includeZeroStock && currentStock === 0) continue;

          const itemId = `${p.id}_main`;
          itemsToSnapshot.push({
            id: itemId,
            productId: p.id!,
            productName: p.name,
            sku: p.sku || '',
            barcode: p.gtin || '',
            categoryName: p.subcategory || p.categoryId || '',
            brand: p.brand || '',
            imageUrl: mainImage,
            expectedSnapshot: currentStock,
            unitCost: p.costPrice || 0,
            salePrice: p.price || 0
          });
          totalExpectedUnits += currentStock;
        }
      }

      // Batch write snapshot items (chunked in groups of 400 for safety)
      const chunkSize = 400;
      for (let i = 0; i < itemsToSnapshot.length; i += chunkSize) {
        const chunk = itemsToSnapshot.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const itemRef = doc(db, `inventoryBalances/${balanceId}/items/${item.id}`);
          const itemData: InventoryBalanceItem = REMOVE_UNDEFINED({
            id: item.id,
            balanceId,
            productId: item.productId,
            variantId: item.variantId || null,
            productName: item.productName,
            variantName: item.variantName || null,
            sku: item.sku,
            barcode: item.barcode || null,
            categoryName: item.categoryName || '',
            brand: item.brand || '',
            imageUrl: item.imageUrl || '',
            expectedSnapshot: item.expectedSnapshot,
            movementsDuringBalance: 0,
            theoreticalBalance: item.expectedSnapshot,
            countedQuantity: 0,
            difference: 0 - item.expectedSnapshot,
            status: 'NAO_CONTADO',
            unitCost: item.unitCost,
            salePrice: item.salePrice,
            counted: false
          });
          batch.set(itemRef, itemData);
        }
        await batch.commit();
      }

      // Update header info
      const balanceRef = doc(db, 'inventoryBalances', balanceId);
      await updateDoc(balanceRef, {
        status: 'EM_CONTAGEM',
        startedAt: serverTimestamp(),
        startedBy: auth.currentUser?.uid || 'system',
        expectedItems: itemsToSnapshot.length,
        totalExpectedUnits,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (e) {
      console.error("Error starting balance snapshot:", e);
      throw e;
    }
  },

  /**
   * Search matching item in balance by code (GTIN/Barcode, SKU, Name)
   */
  async findMatchingItems(balanceId: string, searchTerm: string): Promise<InventoryBalanceItem[]> {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    const items = await this.listBalanceItems(balanceId);
    
    // 1. Exact barcode/gtin match
    const barcodeMatches = items.filter(i => (i.barcode || '').toLowerCase() === term);
    if (barcodeMatches.length > 0) return barcodeMatches;

    // 2. Exact SKU match
    const skuMatches = items.filter(i => (i.sku || '').toLowerCase() === term);
    if (skuMatches.length > 0) return skuMatches;

    // 3. Partial match (name, variant name, sku, barcode)
    return items.filter(i => 
      i.productName.toLowerCase().includes(term) ||
      (i.variantName || '').toLowerCase().includes(term) ||
      (i.sku || '').toLowerCase().includes(term) ||
      (i.barcode || '').toLowerCase().includes(term)
    );
  },

  /**
   * Record a scan event (atomically increment count by delta)
   */
  async recordScan(
    balanceId: string,
    itemId: string,
    delta: number = 1,
    method: 'SCAN' | 'MANUAL' | 'BULK' = 'SCAN'
  ): Promise<{ success: boolean; item?: InventoryBalanceItem; newQty?: number }> {
    try {
      const itemRef = doc(db, `inventoryBalances/${balanceId}/items/${itemId}`);
      const balanceRef = doc(db, 'inventoryBalances', balanceId);

      let updatedItem: InventoryBalanceItem | undefined;
      let newCounted = 0;

      await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error("Item não encontrado no balanço.");

        const item = itemSnap.data() as InventoryBalanceItem;
        const prevQty = item.countedQuantity || 0;
        newCounted = Math.max(0, prevQty + delta);
        const theoretical = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
        const diff = newCounted - theoretical;

        let status: ItemCountStatus = 'CONTADO_SEM_DIVERGENCIA';
        if (diff > 0) status = 'SOBRA';
        else if (diff < 0) status = 'FALTA';

        const updatePayload: Partial<InventoryBalanceItem> = {
          countedQuantity: newCounted,
          difference: diff,
          status,
          counted: true,
          lastCountedAt: new Date().toISOString(),
          lastCountedBy: auth.currentUser?.uid || 'system',
          lastCountedByName: auth.currentUser?.email || 'Operador'
        };

        transaction.update(itemRef, updatePayload);
        updatedItem = { ...item, ...updatePayload };

        // Record event in log
        const eventRef = doc(collection(db, `inventoryBalances/${balanceId}/countEvents`));
        const eventData: InventoryBalanceCountEvent = REMOVE_UNDEFINED({
          balanceId,
          itemId,
          productId: item.productId,
          variantId: item.variantId || null,
          quantityDelta: delta,
          previousQuantity: prevQty,
          newQuantity: newCounted,
          method,
          userId: auth.currentUser?.uid || 'system',
          userName: auth.currentUser?.email || 'Operador',
          createdAt: new Date().toISOString()
        });
        transaction.set(eventRef, eventData);
      });

      // Recalculate summary metrics for balance header
      this.recalculateBalanceHeader(balanceId).catch(err => console.warn("Error updating header stats:", err));

      return { success: true, item: updatedItem, newQty: newCounted };
    } catch (e) {
      console.error("Error recording scan:", e);
      throw e;
    }
  },

  /**
   * Override item quantity manually with audit reason
   */
  async updateItemCountManual(
    balanceId: string,
    itemId: string,
    newQuantity: number,
    reason?: string
  ): Promise<boolean> {
    try {
      const itemRef = doc(db, `inventoryBalances/${balanceId}/items/${itemId}`);
      const itemSnap = await getDoc(itemRef);
      if (!itemSnap.exists()) return false;

      const item = itemSnap.data() as InventoryBalanceItem;
      const prevQty = item.countedQuantity || 0;
      const safeQty = Math.max(0, newQuantity);
      const theoretical = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
      const diff = safeQty - theoretical;

      let status: ItemCountStatus = 'CONTADO_SEM_DIVERGENCIA';
      if (diff > 0) status = 'SOBRA';
      else if (diff < 0) status = 'FALTA';

      const adjustments = item.manualAdjustments || [];
      adjustments.push({
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'system',
        userName: auth.currentUser?.email || 'Admin',
        prevQty,
        newQty: safeQty,
        reason: reason || 'Ajuste manual pelo operador'
      });

      await updateDoc(itemRef, {
        countedQuantity: safeQty,
        difference: diff,
        status,
        counted: true,
        lastCountedAt: serverTimestamp(),
        lastCountedBy: auth.currentUser?.uid || 'system',
        lastCountedByName: auth.currentUser?.email || 'Admin',
        manualAdjustments: REMOVE_UNDEFINED(adjustments)
      });

      // Record event
      const eventRef = doc(collection(db, `inventoryBalances/${balanceId}/countEvents`));
      await setDoc(eventRef, REMOVE_UNDEFINED({
        balanceId,
        itemId,
        productId: item.productId,
        variantId: item.variantId || null,
        quantityDelta: safeQty - prevQty,
        previousQuantity: prevQty,
        newQuantity: safeQty,
        method: 'MANUAL',
        userId: auth.currentUser?.uid || 'system',
        userName: auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp()
      }));

      await this.recalculateBalanceHeader(balanceId);
      return true;
    } catch (e) {
      console.error("Error updating item count manually:", e);
      throw e;
    }
  },

  /**
   * Recalculates balance header totals (counted items, shortages, surpluses, financial impacts)
   */
  async recalculateBalanceHeader(balanceId: string): Promise<void> {
    try {
      const items = await this.listBalanceItems(balanceId);
      let countedItems = 0;
      let totalCountedUnits = 0;
      let shortageItems = 0;
      let surplusItems = 0;
      let matchItems = 0;
      let shortageCostValue = 0;
      let surplusCostValue = 0;

      for (const item of items) {
        const qty = item.countedQuantity || 0;
        totalCountedUnits += qty;
        if (item.counted || qty > 0) {
          countedItems++;
        }

        const diff = item.difference || 0;
        const unitCost = item.unitCost || 0;

        if (diff < 0) {
          shortageItems++;
          shortageCostValue += Math.abs(diff) * unitCost;
        } else if (diff > 0) {
          surplusItems++;
          surplusCostValue += diff * unitCost;
        } else {
          matchItems++;
        }
      }

      const balanceRef = doc(db, 'inventoryBalances', balanceId);
      await updateDoc(balanceRef, {
        countedItems,
        totalCountedUnits,
        shortageItems,
        surplusItems,
        matchItems,
        shortageCostValue,
        surplusCostValue,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Error recalculating balance header:", e);
    }
  },

  /**
   * Pause balance
   */
  async pauseBalance(balanceId: string): Promise<boolean> {
    const balanceRef = doc(db, 'inventoryBalances', balanceId);
    await updateDoc(balanceRef, {
      status: 'PAUSADO',
      pausedAt: serverTimestamp(),
      pausedBy: auth.currentUser?.uid || 'system',
      updatedAt: serverTimestamp()
    });
    return true;
  },

  /**
   * Resume balance
   */
  async resumeBalance(balanceId: string): Promise<boolean> {
    const balanceRef = doc(db, 'inventoryBalances', balanceId);
    await updateDoc(balanceRef, {
      status: 'EM_CONTAGEM',
      updatedAt: serverTimestamp()
    });
    return true;
  },

  /**
   * Cancel balance
   */
  async cancelBalance(balanceId: string): Promise<boolean> {
    const balanceRef = doc(db, 'inventoryBalances', balanceId);
    await updateDoc(balanceRef, {
      status: 'CANCELADO',
      cancelledAt: serverTimestamp(),
      cancelledBy: auth.currentUser?.uid || 'system',
      updatedAt: serverTimestamp()
    });
    return true;
  },

  /**
   * Finalize Balance Definitively (IDEMPOTENT & ATOMIC)
   * Updates real stock levels, creates stockMovement entries, sets last balance metadata on products/variants
   */
  async finalizeBalance(
    balanceId: string,
    options: { uncountedResolution: 'KEEP_CURRENT' | 'SET_ZERO' }
  ): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      const balance = await this.getBalance(balanceId);
      if (!balance) throw new Error("Balanço não encontrado");

      // IDEMPOTENCY SAFETY CHECK
      if (balance.status === 'FINALIZADO') {
        return { success: true, message: "Este balanço já foi finalizado anteriormente.", code: balance.code };
      }

      const items = await this.listBalanceItems(balanceId);
      if (items.length === 0) {
        throw new Error("Não há itens neste balanço para finalizar.");
      }

      const finalizationToken = `FINALIZED_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const userEmail = auth.currentUser?.email || 'Admin';
      const userId = auth.currentUser?.uid || 'system';

      // Group product IDs to sync parent stocks afterwards
      const parentProductIdsToSync = new Set<string>();

      // Update items in batches
      const batchSize = 350;
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          let targetStock = item.countedQuantity || 0;
          if (!item.counted && item.countedQuantity === 0) {
            if (options.uncountedResolution === 'KEEP_CURRENT') {
              targetStock = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
            } else {
              targetStock = 0;
            }
          }

          const previousStock = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
          const diff = targetStock - previousStock;

          // Target ref: Variant or Product
          let itemRef;
          if (item.variantId) {
            itemRef = doc(db, `products/${item.productId}/variants/${item.variantId}`);
            parentProductIdsToSync.add(item.productId);
          } else {
            itemRef = doc(db, 'products', item.productId);
          }

          // 1. Update product/variant document with new stock and balance metadata
          batch.update(itemRef, {
            stock: targetStock,
            lastBalanceDate: serverTimestamp(),
            lastBalanceCode: balance.code,
            lastBalanceCounted: targetStock,
            lastBalanceUser: userEmail,
            updatedAt: serverTimestamp()
          });

          // 2. Update item document in balance subcollection
          const balanceItemRef = doc(db, `inventoryBalances/${balanceId}/items/${item.id}`);
          batch.update(balanceItemRef, {
            countedQuantity: targetStock,
            difference: diff,
            status: diff === 0 ? 'CONTADO_SEM_DIVERGENCIA' : (diff > 0 ? 'SOBRA' : 'FALTA'),
            finalized: true
          });

          // 3. Register stock movement if there is a divergence
          if (diff !== 0) {
            const movRef = doc(collection(db, 'stockMovements'));
            const movData = REMOVE_UNDEFINED({
              productId: item.productId,
              productName: item.productName,
              variantId: item.variantId || null,
              variantName: item.variantName || null,
              sku: item.sku || '',
              type: diff > 0 ? 'in' : 'out',
              quantity: Math.abs(diff),
              previousStock,
              newStock: targetStock,
              costPrice: item.unitCost || 0,
              reason: `Balanço ${balance.code}: saldo ajustado de ${previousStock} para ${targetStock}. ${diff < 0 ? 'Falta' : 'Sobra'} identificada: ${Math.abs(diff)} un.`,
              notes: `Ajuste automático de inventário (${balance.name})`,
              status: 'realizada',
              createdBy: userId,
              createdByName: userEmail,
              createdAt: serverTimestamp()
            });
            batch.set(movRef, movData);
          }
        }

        await batch.commit();
      }

      // Sync all affected parent products
      for (const parentId of parentProductIdsToSync) {
        try {
          await stockSyncService.syncParentStock(parentId);
        } catch (syncErr) {
          console.warn(`Error syncing parent stock for ${parentId}:`, syncErr);
        }
      }

      // Update balance header as FINALIZADO
      const balanceRef = doc(db, 'inventoryBalances', balanceId);
      await updateDoc(balanceRef, {
        status: 'FINALIZADO',
        finishedAt: serverTimestamp(),
        finishedBy: userId,
        finishedByName: userEmail,
        uncountedResolution: options.uncountedResolution,
        finalizationId: finalizationToken,
        updatedAt: serverTimestamp()
      });

      await this.recalculateBalanceHeader(balanceId);
      await auditLogService.logAction('Finalizar', 'inventory_balance', balanceId, { code: balance.code });

      return {
        success: true,
        message: `Balanço ${balance.code} finalizado com sucesso! O estoque foi atualizado.`,
        code: balance.code
      };
    } catch (e: any) {
      console.error("Error finalizing balance:", e);
      throw e;
    }
  }
};
