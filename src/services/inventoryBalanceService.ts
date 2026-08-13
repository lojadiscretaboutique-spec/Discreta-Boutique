import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy, 
  limit, 
  serverTimestamp, 
  runTransaction, 
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getProductMainImageUrl } from '../utils/productUtils';
import { auth } from '../lib/auth';
import { DEFAULT_COMPANY_ID } from '../constants/company';
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
      companyId: DEFAULT_COMPANY_ID
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

      if (balance.status !== 'RASCUNHO' && balance.status !== 'EM_CONTAGEM') {
        throw new Error(`O snapshot só pode ser gerado em balanços em RASCUNHO. Status atual: ${balance.status}`);
      }

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

      // Filter product scope
      const productsInScope = allProducts.filter(p => {
        if (balance.scopeOptions?.onlyActive && !p.active) return false;
        if (balance.scope === 'CATEGORY' && balance.scopeValue) {
          if (p.categoryId !== balance.scopeValue && p.subcategory !== balance.scopeValue) return false;
        }
        if (balance.scope === 'BRAND' && balance.scopeValue) {
          if ((p.brand || '').toLowerCase() !== balance.scopeValue.toLowerCase()) return false;
        }
        if (balance.scope === 'SELECTED_PRODUCTS' && balance.scopeValue) {
          const selectedIds = balance.scopeValue.split(',').map(s => s.trim());
          if (!selectedIds.includes(p.id!)) return false;
        }
        return true;
      });

      // Pre-fetch details/variants in parallel for variant products to avoid N+1 slow queries
      const variantProductIds = productsInScope.filter(p => p.hasVariants).map(p => p.id!);
      const variantDetailsMap = new Map<string, any>();

      if (variantProductIds.length > 0) {
        const variantDetails = await Promise.all(
          variantProductIds.map(id => productService.getProduct(id))
        );
        variantDetails.forEach((res, idx) => {
          if (res) {
            variantDetailsMap.set(variantProductIds[idx], res);
          }
        });
      }

      for (const p of productsInScope) {
        const mainImage = getProductMainImageUrl(p.images);

        if (p.hasVariants) {
          const pFull = variantDetailsMap.get(p.id!);
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
    method: 'SCAN' | 'MANUAL' | 'BULK' = 'SCAN',
    clientActionId?: string
  ): Promise<{ success: boolean; item?: InventoryBalanceItem; newQty?: number; deduplicated?: boolean }> {
    try {
      const itemRef = doc(db, `inventoryBalances/${balanceId}/items/${itemId}`);
      const balanceRef = doc(db, 'inventoryBalances', balanceId);

      let updatedItem: InventoryBalanceItem | undefined;
      let newCounted = 0;
      let isDeduplicated = false;

      await runTransaction(db, async (transaction) => {
        // 1. Verify balance status atomically
        const balanceSnap = await transaction.get(balanceRef);
        if (!balanceSnap.exists()) throw new Error("Balanço não encontrado.");
        const balanceData = balanceSnap.data() as InventoryBalance;
        if (balanceData.status !== 'EM_CONTAGEM') {
          throw new Error(`Contagem bloqueada: o balanço está com status "${balanceData.status}".`);
        }

        // 2. Check clientActionId idempotency if provided
        const eventId = clientActionId || doc(collection(db, `inventoryBalances/${balanceId}/countEvents`)).id;
        const eventRef = doc(db, `inventoryBalances/${balanceId}/countEvents`, eventId);
        const eventSnap = await transaction.get(eventRef);

        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error("Item não encontrado no balanço.");
        const item = itemSnap.data() as InventoryBalanceItem;

        if (eventSnap.exists()) {
          // Event was already processed on server side
          isDeduplicated = true;
          updatedItem = item;
          newCounted = item.countedQuantity || 0;
          return;
        }

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

        // Record event in log with clientActionId
        const eventData: InventoryBalanceCountEvent = REMOVE_UNDEFINED({
          id: eventId,
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
          clientActionId: clientActionId || eventId,
          createdAt: new Date().toISOString()
        });
        transaction.set(eventRef, eventData);
      });

      // Recalculate summary metrics for balance header asynchronously
      this.recalculateBalanceHeader(balanceId).catch(err => console.warn("Error updating header stats:", err));

      return { success: true, item: updatedItem, newQty: newCounted, deduplicated: isDeduplicated };
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
      const balanceRef = doc(db, 'inventoryBalances', balanceId);
      const balanceSnap = await getDoc(balanceRef);
      if (!balanceSnap.exists()) throw new Error("Balanço não encontrado.");
      const balanceData = balanceSnap.data() as InventoryBalance;

      if (balanceData.status !== 'EM_CONTAGEM') {
        throw new Error(`Ajuste manual não permitido: o balanço está com status "${balanceData.status}".`);
      }

      const itemRef = doc(db, `inventoryBalances/${balanceId}/items/${itemId}`);
      const itemSnap = await getDoc(itemRef);
      if (!itemSnap.exists()) return false;

      const item = itemSnap.data() as InventoryBalanceItem;
      const prevQty = item.countedQuantity || 0;
      const safeQty = Math.floor(Math.max(0, Number(newQuantity) || 0));
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
        reason: (reason || 'Ajuste manual pelo operador').trim()
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

      // Record count event
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
        if (item.counted) {
          countedItems++;
          const qty = item.countedQuantity || 0;
          totalCountedUnits += qty;

          const theoretical = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
          const diff = item.difference ?? (qty - theoretical);
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
   * Computes stock movements that occurred between the start of the balance and the cutoff time,
   * excluding movements created by the balance itself.
   */
  async computeMovementsDuringBalanceMap(balance: InventoryBalance, cutoffDate?: Date): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
      let startDate: Date | null = null;
      if (balance.startedAt) {
        if (typeof balance.startedAt === 'object' && 'toDate' in balance.startedAt && typeof (balance.startedAt as any).toDate === 'function') {
          startDate = (balance.startedAt as any).toDate();
        } else if (typeof balance.startedAt === 'string' || typeof balance.startedAt === 'number') {
          startDate = new Date(balance.startedAt);
        }
      }
      if (!startDate && balance.createdAt) {
        if (typeof balance.createdAt === 'object' && 'toDate' in balance.createdAt && typeof (balance.createdAt as any).toDate === 'function') {
          startDate = (balance.createdAt as any).toDate();
        } else if (typeof balance.createdAt === 'string' || typeof balance.createdAt === 'number') {
          startDate = new Date(balance.createdAt);
        }
      }

      if (!startDate) return map;

      const movementsRef = collection(db, 'stockMovements');
      const q = query(movementsRef, where('createdAt', '>=', startDate));
      const snap = await getDocs(q);

      const cutoffTime = cutoffDate ? cutoffDate.getTime() : Date.now();

      snap.forEach(d => {
        const m = d.data();
        if (m.balanceId === balance.id) return;
        if (m.origin === 'INVENTORY_BALANCE' && m.balanceId === balance.id) return;
        if (balance.code && m.reason && typeof m.reason === 'string' && m.reason.includes(balance.code)) return;

        let mDate: Date | null = null;
        if (m.createdAt) {
          if (typeof m.createdAt === 'object' && 'toDate' in m.createdAt && typeof m.createdAt.toDate === 'function') {
            mDate = m.createdAt.toDate();
          } else if (typeof m.createdAt === 'string' || typeof m.createdAt === 'number') {
            mDate = new Date(m.createdAt);
          }
        }
        if (mDate && mDate.getTime() > cutoffTime) return;

        const key = `${m.productId}_${m.variantId || 'main'}`;
        const qty = Number(m.quantity) || 0;
        const net = m.type === 'in' ? qty : -qty;
        map.set(key, (map.get(key) || 0) + net);
        if (m.itemId) {
          map.set(m.itemId, (map.get(m.itemId) || 0) + net);
        }
      });
    } catch (err) {
      console.warn("Could not query movements during balance:", err);
    }
    return map;
  },

  /**
   * Finalize Balance Definitively (IDEMPOTENT, ATOMIC, RELATIVE & DETERMINISTIC)
   * Updates real stock levels inside transactions using relative deltas against current real stock,
   * creating deterministic stockMovement entries and setting last balance metadata on products/variants.
   */
  async finalizeBalance(
    balanceId: string,
    options: { uncountedResolution: 'KEEP_CURRENT' | 'SET_ZERO' }
  ): Promise<{ success: boolean; message: string; code?: string }> {
    const balanceRef = doc(db, 'inventoryBalances', balanceId);
    let finalizationId = '';
    let balanceData: InventoryBalance;
    const cutoffDate = new Date();

    // 1. Transactional check and lock
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(balanceRef);
      if (!snap.exists()) throw new Error("Balanço não encontrado");
      balanceData = { id: snap.id, ...snap.data() } as InventoryBalance;

      if (balanceData.status === 'FINALIZADO') {
        return; // Already finalized
      }

      if (balanceData.finalizationState === 'PROCESSING') {
        const startedAt = balanceData.finalizationStartedAt;
        let startedTime = 0;
        if (startedAt && typeof startedAt === 'object' && 'toDate' in startedAt && typeof (startedAt as any).toDate === 'function') {
          startedTime = (startedAt as any).toDate().getTime();
        } else if (typeof startedAt === 'number') {
          startedTime = startedAt;
        } else if (typeof startedAt === 'string') {
          startedTime = new Date(startedAt).getTime();
        }

        // Lock timeout: 3 minutes
        if (startedTime > 0 && (Date.now() - startedTime) < 3 * 60 * 1000) {
          throw new Error("Uma finalização já está em andamento para este balanço. Aguarde o término.");
        }
      }

      // Reuse existing finalizationId on retry, or create a deterministic new one
      finalizationId = balanceData.finalizationId || `FIN_BAL_${balanceId}`;

      tx.update(balanceRef, {
        finalizationId,
        finalizationState: 'PROCESSING',
        finalizationStartedAt: serverTimestamp(),
        reconciliationCutoffAt: serverTimestamp(),
        finalizationError: null,
        uncountedResolution: options.uncountedResolution,
        updatedAt: serverTimestamp()
      });
    });

    if (balanceData!.status === 'FINALIZADO') {
      return {
        success: true,
        message: "Este balanço já foi finalizado anteriormente.",
        code: balanceData!.code
      };
    }

    try {
      const userEmail = auth.currentUser?.email || 'Admin';
      const userId = auth.currentUser?.uid || 'system';

      // 2. Fetch all items
      const items = await this.listBalanceItems(balanceId);
      if (items.length === 0) {
        await updateDoc(balanceRef, {
          finalizationState: 'FAILED',
          finalizationError: "Não há itens neste balanço para finalizar."
        });
        throw new Error("Não há itens neste balanço para finalizar.");
      }

      // 3. Compute movements during balance up to cutoffDate
      const movementsMap = await this.computeMovementsDuringBalanceMap(balanceData!, cutoffDate);

      const parentProductIdsToSync = new Set<string>();
      let processedCount = 0;

      // 4. Process each item atomically inside a transaction to read real current stock and apply relative delta
      for (const item of items) {
        // Fast-path client check if already processed
        if (item.adjustmentProcessed && item.adjustmentFinalizationId === finalizationId) {
          processedCount++;
          if (item.variantId) parentProductIdsToSync.add(item.productId);
          continue;
        }

        const itemKeyStr = `${item.productId}_${item.variantId || 'main'}`;
        const movDuring = movementsMap.get(item.id) || movementsMap.get(itemKeyStr) || 0;
        const theoreticalBalance = (item.expectedSnapshot ?? 0) + movDuring;

        let targetStock = item.countedQuantity || 0;
        let isCounted = item.counted;

        if (!item.counted) {
          if (options.uncountedResolution === 'KEEP_CURRENT') {
            targetStock = theoreticalBalance;
            isCounted = false;
          } else {
            targetStock = 0;
            isCounted = true; // treated as zero count
          }
        }

        const diff = targetStock - theoreticalBalance;
        const movementId = `SM_BAL_${balanceId}_${item.id}_${finalizationId}`;

        // TRANSACTION PER ITEM: Guarantees atomic read of real stock and relative delta application
        await runTransaction(db, async (tx) => {
          const balanceItemRef = doc(db, `inventoryBalances/${balanceId}/items/${item.id}`);
          const balanceItemSnap = await tx.get(balanceItemRef);
          
          if (balanceItemSnap.exists()) {
            const bData = balanceItemSnap.data();
            if (bData?.adjustmentProcessed && bData?.adjustmentFinalizationId === finalizationId) {
              return; // Already processed
            }
          }

          const movRef = doc(db, 'stockMovements', movementId);
          const movSnap = await tx.get(movRef);

          if (movSnap.exists()) {
            // Movement already exists in DB, mark item doc as processed
            tx.update(balanceItemRef, {
              movementsDuringBalance: movDuring,
              theoreticalBalance,
              countedQuantity: targetStock,
              difference: diff,
              status: diff === 0 ? 'CONTADO_SEM_DIVERGENCIA' : (diff > 0 ? 'SOBRA' : 'FALTA'),
              counted: isCounted,
              finalized: true,
              adjustmentProcessed: true,
              adjustmentProcessedAt: serverTimestamp(),
              adjustmentFinalizationId: finalizationId,
              adjustmentMovementId: diff !== 0 ? movementId : null
            });
            return;
          }

          let itemRef;
          if (item.variantId) {
            itemRef = doc(db, `products/${item.productId}/variants/${item.variantId}`);
          } else {
            itemRef = doc(db, 'products', item.productId);
          }

          const targetSnap = await tx.get(itemRef);
          if (!targetSnap.exists()) {
            // Document missing, just mark item as processed
            tx.update(balanceItemRef, {
              movementsDuringBalance: movDuring,
              theoreticalBalance,
              countedQuantity: targetStock,
              difference: diff,
              status: diff === 0 ? 'CONTADO_SEM_DIVERGENCIA' : (diff > 0 ? 'SOBRA' : 'FALTA'),
              counted: isCounted,
              finalized: true,
              adjustmentProcessed: true,
              adjustmentProcessedAt: serverTimestamp(),
              adjustmentFinalizationId: finalizationId
            });
            return;
          }

          // Read real stock currently in Firestore
          const currentRealStock = Number(targetSnap.data()?.stock) || 0;

          if (diff !== 0) {
            // Relative adjustment: add delta to current real stock (preserving concurrent sales/purchases)
            const newRealStock = currentRealStock + diff;

            // 1. Update real stock in product/variant document
            tx.update(itemRef, {
              stock: newRealStock,
              lastBalanceDate: serverTimestamp(),
              lastBalanceCode: balanceData!.code,
              lastBalanceCounted: targetStock,
              lastBalanceUser: userEmail,
              updatedAt: serverTimestamp()
            });

            // 2. Create deterministic stock movement
            const movData = REMOVE_UNDEFINED({
              id: movementId,
              balanceId,
              finalizationId,
              itemId: item.id,
              productId: item.productId,
              productName: item.productName,
              variantId: item.variantId || null,
              variantName: item.variantName || null,
              sku: item.sku || '',
              type: diff > 0 ? 'in' : 'out',
              quantity: Math.abs(diff),
              previousStock: currentRealStock,
              newStock: newRealStock,
              quantityDelta: diff,
              costPrice: item.unitCost || 0,
              reason: `Balanço ${balanceData!.code}: saldo ajustado de ${theoreticalBalance} para ${targetStock} (ajuste: ${diff > 0 ? '+' : ''}${diff}). ${diff < 0 ? 'Falta' : 'Sobra'} de ${Math.abs(diff)} un.`,
              notes: `Ajuste automático de inventário (${balanceData!.name})`,
              origin: 'INVENTORY_BALANCE',
              status: 'realizada',
              createdBy: userId,
              createdByName: userEmail,
              createdAt: serverTimestamp()
            });
            tx.set(movRef, movData);
          } else {
            // Diff === 0: Update last balance metadata on product/variant without changing stock quantity
            tx.update(itemRef, {
              lastBalanceDate: serverTimestamp(),
              lastBalanceCode: balanceData!.code,
              lastBalanceCounted: targetStock,
              lastBalanceUser: userEmail,
              updatedAt: serverTimestamp()
            });
          }

          // 3. Mark balance item document as processed
          tx.update(balanceItemRef, {
            movementsDuringBalance: movDuring,
            theoreticalBalance,
            countedQuantity: targetStock,
            difference: diff,
            status: diff === 0 ? 'CONTADO_SEM_DIVERGENCIA' : (diff > 0 ? 'SOBRA' : 'FALTA'),
            counted: isCounted,
            finalized: true,
            adjustmentProcessed: true,
            adjustmentProcessedAt: serverTimestamp(),
            adjustmentFinalizationId: finalizationId,
            adjustmentMovementId: diff !== 0 ? movementId : null
          });
        });

        if (item.variantId) {
          parentProductIdsToSync.add(item.productId);
        }

        processedCount++;

        // Periodically update progress header
        if (processedCount % 10 === 0 || processedCount === items.length) {
          await updateDoc(balanceRef, {
            finalizationTotalItems: items.length,
            finalizationProcessedItems: processedCount,
            updatedAt: serverTimestamp()
          }).catch(() => {});
        }
      }

      // 5. Sync parent products for variants
      for (const parentId of parentProductIdsToSync) {
        try {
          await stockSyncService.syncParentStock(parentId);
        } catch (syncErr) {
          console.warn(`Error syncing parent stock for ${parentId}:`, syncErr);
        }
      }

      // 6. Update main balance status to FINALIZADO
      await updateDoc(balanceRef, {
        status: 'FINALIZADO',
        finalizationState: 'COMPLETED',
        finalizationCompletedAt: serverTimestamp(),
        finishedAt: serverTimestamp(),
        finishedBy: userId,
        finishedByName: userEmail,
        uncountedResolution: options.uncountedResolution,
        finalizationTotalItems: items.length,
        finalizationProcessedItems: items.length,
        finalizationFailedItems: 0,
        updatedAt: serverTimestamp()
      });

      await this.recalculateBalanceHeader(balanceId);
      await auditLogService.logAction('Finalizar', 'inventory_balance', balanceId, {
        code: balanceData!.code,
        finalizationId,
        totalItems: items.length
      });

      return {
        success: true,
        message: `Balanço ${balanceData!.code} finalizado com sucesso! O estoque foi atualizado.`,
        code: balanceData!.code
      };
    } catch (e: any) {
      console.error("Error finalizing balance:", e);
      await updateDoc(balanceRef, {
        finalizationState: 'FAILED',
        finalizationError: e.message || "Erro durante finalização do balanço.",
        updatedAt: serverTimestamp()
      }).catch(() => {});
      throw e;
    }
  },

  /**
   * Permanently delete an inventory balance document and its subcollections (items, countEvents)
   * Enforces strict safety rules: FINALIZADO or PROCESSING balances, or balances with stockMovements CANNOT be deleted.
   */
  async deleteBalance(balanceId: string): Promise<void> {
    try {
      const balanceRef = doc(db, 'inventoryBalances', balanceId);
      const balanceSnap = await getDoc(balanceRef);
      if (!balanceSnap.exists()) return;

      const balance = { id: balanceSnap.id, ...balanceSnap.data() } as InventoryBalance;

      // 1. Strict status checks
      if (balance.status === 'FINALIZADO') {
        throw new Error("Balanço finalizado não pode ser excluído por questões de auditoria e controle de estoque.");
      }

      if (balance.finalizationState === 'PROCESSING') {
        throw new Error("Não é possível excluir um balanço em processo de finalização.");
      }

      // 2. Check for recorded stock movements associated with this balance
      const movQ = query(
        collection(db, 'stockMovements'),
        where('balanceId', '==', balanceId)
      );
      const movSnap = await getDocs(movQ);
      if (!movSnap.empty) {
        throw new Error("Este balanço possui movimentações de estoque registradas e não pode ser excluído.");
      }

      // Also check by origin === 'INVENTORY_BALANCE' and reason code
      if (balance.code) {
        const movCodeQ = query(
          collection(db, 'stockMovements'),
          where('origin', '==', 'INVENTORY_BALANCE'),
          where('reason', '>=', `Balanço ${balance.code}`),
          where('reason', '<=', `Balanço ${balance.code}\uf8ff`)
        );
        const movCodeSnap = await getDocs(movCodeQ);
        if (!movCodeSnap.empty) {
          throw new Error("Este balanço possui movimentações de estoque registradas e não pode ser excluído.");
        }
      }

      // 3. Delete items subcollection
      const itemsRef = collection(db, `inventoryBalances/${balanceId}/items`);
      const itemsSnap = await getDocs(itemsRef);
      if (!itemsSnap.empty) {
        const batchSize = 350;
        let batch = writeBatch(db);
        let count = 0;
        for (const d of itemsSnap.docs) {
          batch.delete(d.ref);
          count++;
          if (count >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }

      // 4. Delete countEvents subcollection
      const eventsRef = collection(db, `inventoryBalances/${balanceId}/countEvents`);
      const eventsSnap = await getDocs(eventsRef);
      if (!eventsSnap.empty) {
        const batchSize = 350;
        let batch = writeBatch(db);
        let count = 0;
        for (const d of eventsSnap.docs) {
          batch.delete(d.ref);
          count++;
          if (count >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }

      // 5. Delete main balance document
      await deleteDoc(balanceRef);

      await auditLogService.logAction('Excluir', 'inventory_balance', balanceId, { code: balance.code, name: balance.name });
    } catch (e: any) {
      console.error('Error deleting inventory balance:', e);
      throw e;
    }
  }
};
