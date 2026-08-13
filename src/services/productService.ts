import { serverTimestamp, collection, doc, updateDoc, getDoc, getDocs, query, orderBy, writeBatch, where, increment, setDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '../lib/firebase';
import { storage } from '../lib/storage';
import { stockSyncService } from './stockSyncService';
import { cacheService } from './cacheService';
import { auditLogService } from './auditLogService';

import { Product, ProductVariant } from '../types/product';

export type { Product, ProductVariant };

export const productService = {
  async checkGtinExists(gtin: string, excludeProductId?: string): Promise<{ exists: boolean; foundIn?: string }> {
    if (!gtin || !gtin.trim()) return { exists: false };
    const clean = gtin.trim();
    
    // Check main products (gtin field)
    const qProd = query(collection(db, 'products'), where('gtin', '==', clean));
    const snapProd = await getDocs(qProd);
    const docMatch = snapProd.docs.find(d => d.id !== excludeProductId);
    if (docMatch) {
      const pName = docMatch.data().name || docMatch.id;
      return { exists: true, foundIn: `Produto "${pName}"` };
    }

    // Check products (variantIdentifiers array)
    const qVar = query(collection(db, 'products'), where('variantIdentifiers', 'array-contains', clean));
    const snapVar = await getDocs(qVar);
    const varMatch = snapVar.docs.find(d => d.id !== excludeProductId);
    if (varMatch) {
      const pName = varMatch.data().name || varMatch.id;
      return { exists: true, foundIn: `Variação de "${pName}"` };
    }

    return { exists: false };
  },

  async checkSkuExists(sku: string, excludeProductId?: string): Promise<{ exists: boolean; foundIn?: string }> {
    if (!sku || !sku.trim()) return { exists: false };
    const clean = sku.trim();
    
    // Check main products (sku field)
    const qProd = query(collection(db, 'products'), where('sku', '==', clean));
    const snapProd = await getDocs(qProd);
    const docMatch = snapProd.docs.find(d => d.id !== excludeProductId);
    if (docMatch) {
      const pName = docMatch.data().name || docMatch.id;
      return { exists: true, foundIn: `Produto "${pName}"` };
    }

    // Check products (variantIdentifiers array)
    const qVar = query(collection(db, 'products'), where('variantIdentifiers', 'array-contains', clean));
    const snapVar = await getDocs(qVar);
    const varMatch = snapVar.docs.find(d => d.id !== excludeProductId);
    if (varMatch) {
      const pName = varMatch.data().name || varMatch.id;
      return { exists: true, foundIn: `Variação de "${pName}"` };
    }

    return { exists: false };
  },

  async listProducts() {
    try {
      const cached = cacheService.get('products_list');
      if (cached) return cached as Product[];

      const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const products = snap.docs.map(doc => {
        const data = doc.data();
        if (data.images && Array.isArray(data.images)) {
          data.images.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
        }
        return { id: doc.id, ...data } as Product;
      });

      cacheService.set('products_list', products);
      return products;
    } catch (error: unknown) {
      console.error("Error listing products:", error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        throw new Error("Permissão negada ao listar produtos. Verifique se você é um administrador.");
      }
      return [];
    }
  },

  async getProducts() {
    return this.listProducts();
  },

  async getProduct(id: string) {
    try {
      const docRef = doc(db, 'products', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.images && Array.isArray(data.images)) {
          data.images.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
        }
        const product = { id: snap.id, ...data } as Product;
        // Load variants
        try {
          const vSnap = await getDocs(collection(db, `products/${id}/variants`));
          const variants = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
          return { product, variants };
        } catch (vError: unknown) {
          console.error("Error loading variants for product", id, vError);
          // Return product even without variants if variants fetch fails
          return { product, variants: [] };
        }
      }
      return null;
    } catch (error: unknown) {
      console.error("Error getting product:", error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        throw new Error("Permissão negada ao acessar produto.");
      }
      throw error;
    }
  },

  async trackInteraction(productId: string, type: 'click' | 'conversion' | 'view', searchId?: string) {
    try {
      const productRef = doc(db, 'products', productId);
      const updateData: any = {};
      
      if (type === 'click') {
        updateData.cliques = increment(1);
        updateData.score = increment(2);
        updateData.homeClicks = increment(1);
        updateData.homeScore = increment(5);
      } else if (type === 'conversion') {
        updateData.conversoes = increment(1);
        updateData.score = increment(5);
        updateData.homeScore = increment(15);
      } else if (type === 'view') {
        updateData.visualizacoes = increment(1);
        updateData.score = increment(1);
        updateData.homeScore = increment(1);
      }
      
      await updateDoc(productRef, updateData);

      // Se houver searchId, registrar relação busca-produto
      if (searchId) {
        const engagementRef = doc(db, `intelligent_searches/${searchId}/engagements`, productId);
        const engSnap = await getDoc(engagementRef);
        
        if (engSnap.exists()) {
            const engUpdate: any = {};
            if (type === 'click') engUpdate.clicks = increment(1);
            if (type === 'conversion') engUpdate.conversions = increment(1);
            await updateDoc(engagementRef, engUpdate);
        } else {
            await setDoc(engagementRef, {
                clicks: type === 'click' ? 1 : 0,
                conversions: type === 'conversion' ? 1 : 0,
                productId
            });
        }
      }

    } catch (e: any) {
      if (e.code === 'not-found' || e.message?.includes('No document to update')) {
        return;
      }
      console.error("Error tracking interaction:", e);
    }
  },

  async checkProductInUse(productId: string, variantId?: string): Promise<{ inUse: boolean; reason?: string; currentStock: number }> {
    try {
      let currentStock = 0;
      const pSnap = await getDoc(doc(db, 'products', productId));
      if (pSnap.exists()) {
        const pData = pSnap.data();
        if (!variantId) {
          currentStock = Number(pData.stock) || 0;
        } else {
          const vSnap = await getDoc(doc(db, `products/${productId}/variants`, variantId));
          if (vSnap.exists()) {
            currentStock = Number(vSnap.data().stock) || 0;
          }
        }
      }

      // Check stockMovements
      let qMov;
      if (variantId) {
        qMov = query(collection(db, 'stockMovements'), where('productId', '==', productId), where('variantId', '==', variantId), limit(1));
      } else {
        qMov = query(collection(db, 'stockMovements'), where('productId', '==', productId), limit(1));
      }
      const movSnap = await getDocs(qMov);
      if (!movSnap.empty) {
        return { inUse: true, reason: 'Possui movimentações de estoque / vendas registradas', currentStock };
      }

      // Check purchases (purchases collection)
      const qPurchases = query(collection(db, 'purchases'), limit(25));
      const purchasesSnap = await getDocs(qPurchases);
      let foundInPurchase = false;
      purchasesSnap.docs.forEach(d => {
        const pData = d.data();
        if (Array.isArray(pData.items)) {
          pData.items.forEach((item: { productId?: string; variantId?: string }) => {
            if (item.productId === productId && (!variantId || item.variantId === variantId)) {
              foundInPurchase = true;
            }
          });
        }
      });

      if (foundInPurchase) {
        return { inUse: true, reason: 'Está presente em ordens de compra históricas ou ativas', currentStock };
      }

      if (currentStock > 0) {
        return { inUse: true, reason: `Possui saldo de estoque atual (${currentStock} un.)`, currentStock };
      }

      return { inUse: false, currentStock: 0 };
    } catch (error) {
      console.error("Error checking product usage:", error);
      return { inUse: true, reason: 'Não foi possível verificar o histórico com segurança', currentStock: 0 };
    }
  },

  async createProduct(product: Omit<Product, 'id'>, variants: ProductVariant[]) {
    try {
      const batch = writeBatch(db);
      const productRef = doc(collection(db, 'products'));
      
      const pData = {
        ...product,
        cliques: 0,
        conversoes: 0,
        visualizacoes: 0,
        score: 10, // Initial boost for new products
        homeClicks: 0,
        homeScore: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (product.hasVariants) {
        let totalVariantStock = 0;
        variants.forEach(v => {
          if (v.active !== false) {
            totalVariantStock += (Number(v.stock) || 0);
          }
        });
        pData.stock = totalVariantStock;
      }

      if (Array.isArray(pData.ai_keywords)) pData.ai_keywords = pData.ai_keywords.flat(Infinity);
      if (Array.isArray(pData.ai_synonyms)) pData.ai_synonyms = pData.ai_synonyms.flat(Infinity);
      if (Array.isArray(pData.searchTerms)) pData.searchTerms = pData.searchTerms.flat(Infinity);
      if (Array.isArray(pData.variantIdentifiers)) pData.variantIdentifiers = pData.variantIdentifiers.flat(Infinity);
      if (Array.isArray(pData.categoryIds)) pData.categoryIds = pData.categoryIds.flat(Infinity);
      if (pData.seo && Array.isArray(pData.seo.keywords)) pData.seo.keywords = pData.seo.keywords.flat(Infinity);

      batch.set(productRef, pData);

      // Create variants in subcollection
      if (product.hasVariants) {
        variants.forEach(v => {
          const vRef = doc(collection(db, `products/${productRef.id}/variants`));
          batch.set(vRef, v);
        });
      }

      await batch.commit();

      if (product.hasVariants) {
        await stockSyncService.syncParentStock(productRef.id);
      }

      await auditLogService.logAction('PRODUCT_CREATE', 'products', productRef.id, {
        name: product.name,
        active: product.active,
        hasVariants: product.hasVariants,
        variantsCount: variants.length
      });

      await cacheService.notifyChange();
      import('./catalogCacheService').then(({ catalogCacheService }) => {
        catalogCacheService.scheduleCatalogCacheRegeneration('product_created_or_edited').catch(err => console.error("Error scheduling cache regeneration:", err));
      });
      return productRef.id;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  },

  async updateProduct(id: string, product: Partial<Product>, variants?: ProductVariant[]) {
    try {
      const productRef = doc(db, 'products', id);
      const currentSnap = await getDoc(productRef);
      const currentData = currentSnap.exists() ? currentSnap.data() : {};
      
      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        'name', 'subtitle', 'active', 'featured', 'newRelease', 
        'categoryId', 'categoryIds', 'brand', 'shortDescription', 'fullDescription',
        'price', 'costPrice', 'promoPrice', 'sku', 'gtin', 'unit',
        'stock', 'minStock', 'controlStock', 'allowBackorder',
        'hasVariants', 'images', 'fashion', 'cosmetics', 'delivery',
        'seo', 'extras', 'searchTerms', 'variantIdentifiers',
        'ai_keywords', 'ai_synonyms', 'embedding'
      ];

      allowedFields.forEach(field => {
        let val = (product as Record<string, unknown>)[field];
        if (val !== undefined) {
          if (Array.isArray(val) && field !== 'images' && field !== 'embedding') {
            val = val.flat(Infinity);
          }
          if (field === 'seo' && val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).keywords)) {
            (val as Record<string, unknown>).keywords = ((val as Record<string, unknown>).keywords as unknown[]).flat(Infinity);
          }
          updateData[field] = val;
        }
      });

      // PRESERVE OPERATIONAL & HISTORICAL FIELDS
      if (currentData.lastBalanceDate !== undefined) updateData.lastBalanceDate = currentData.lastBalanceDate;
      if (currentData.lastBalanceCode !== undefined) updateData.lastBalanceCode = currentData.lastBalanceCode;
      if (currentData.lastBalanceCounted !== undefined) updateData.lastBalanceCounted = currentData.lastBalanceCounted;
      if (currentData.lastBalanceUser !== undefined) updateData.lastBalanceUser = currentData.lastBalanceUser;

      // Preserve costPrice if not explicitly passed/modified
      if (product.costPrice === undefined && currentData.costPrice !== undefined) {
        updateData.costPrice = currentData.costPrice;
      }

      // Preserve engagement metrics from currentData
      if (currentData.cliques !== undefined) updateData.cliques = currentData.cliques;
      if (currentData.conversoes !== undefined) updateData.conversoes = currentData.conversoes;
      if (currentData.visualizacoes !== undefined) updateData.visualizacoes = currentData.visualizacoes;
      if (currentData.score !== undefined) updateData.score = currentData.score;
      if (currentData.homeClicks !== undefined) updateData.homeClicks = currentData.homeClicks;
      if (currentData.homeScore !== undefined) updateData.homeScore = currentData.homeScore;

      const hasVarToggle = updateData.hasVariants !== undefined ? Boolean(updateData.hasVariants) : Boolean(currentData.hasVariants);

      if (hasVarToggle && variants) {
        let totalVariantStock = 0;
        variants.forEach(v => {
          if (v.active !== false) {
            totalVariantStock += (Number(v.stock) || 0);
          }
        });
        updateData.stock = totalVariantStock;
      }
      
      updateData.updatedAt = serverTimestamp();

      await updateDoc(productRef, updateData);

      // Sync variants preserving existing document IDs whenever possible
      if (hasVarToggle && variants) {
        const vCols = collection(db, `products/${id}/variants`);
        const vSnap = await getDocs(vCols);
        const existingDocs = vSnap.docs;
        const usedDocIds = new Set<string>();
        const batch = writeBatch(db);

        variants.forEach(v => {
          let targetDocId = v.id;

          if (targetDocId && existingDocs.some(d => d.id === targetDocId)) {
            usedDocIds.add(targetDocId);
          } else {
            const matchDoc = existingDocs.find(d => {
              if (usedDocIds.has(d.id)) return false;
              const data = d.data();
              if (v.sku && data.sku && String(v.sku).trim().toLowerCase() === String(data.sku).trim().toLowerCase()) return true;
              if (v.name && data.name && String(v.name).trim().toLowerCase() === String(data.name).trim().toLowerCase()) return true;
              return false;
            });

            if (matchDoc) {
              targetDocId = matchDoc.id;
              usedDocIds.add(targetDocId);
            } else {
              const newRef = doc(vCols);
              targetDocId = newRef.id;
              usedDocIds.add(targetDocId);
            }
          }

          const vRef = doc(vCols, targetDocId);
          const vData = { ...v, id: targetDocId };
          batch.set(vRef, vData);
        });

        // Soft-deactivate or delete existing docs that are no longer present in the updated variants list
        for (const d of existingDocs) {
          if (!usedDocIds.has(d.id)) {
            const usage = await this.checkProductInUse(id, d.id);
            if (usage.inUse || usage.currentStock > 0) {
              batch.update(d.ref, { active: false, updatedAt: serverTimestamp() });
              await auditLogService.logAction('VARIANT_DEACTIVATE', 'products', id, {
                variantId: d.id,
                reason: usage.reason,
                note: 'Variação desativada para preservar histórico/estoque.'
              });
            } else {
              batch.delete(d.ref);
              await auditLogService.logAction('VARIANT_DELETE', 'products', id, {
                variantId: d.id,
                note: 'Exclusão física de variação sem histórico.'
              });
            }
          }
        }

        await batch.commit();
        await stockSyncService.syncParentStock(id);
      }

      await auditLogService.logAction('PRODUCT_UPDATE', 'products', id, {
        name: product.name || currentData.name,
        active: product.active !== undefined ? product.active : currentData.active,
        hasVariants: hasVarToggle
      });

      await cacheService.notifyChange();
      import('./catalogCacheService').then(({ catalogCacheService }) => {
        catalogCacheService.scheduleCatalogCacheRegeneration('product_updated').catch(err => console.error("Error scheduling cache regeneration:", err));
      });
      return id;
    } catch (error: unknown) {
      console.error("Error updating product:", error);
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<{ status: 'deleted' | 'deactivated'; message: string }> {
    try {
      const productRef = doc(db, 'products', id);
      const pSnap = await getDoc(productRef);
      if (!pSnap.exists()) {
        return { status: 'deleted', message: 'Produto não foi encontrado no sistema.' };
      }
      const pData = pSnap.data();
      const productName = pData.name || id;

      const usage = await this.checkProductInUse(id);
      if (usage.inUse) {
        // Soft-deactivate to protect sales, balance, stock movements and purchases history
        await updateDoc(productRef, {
          active: false,
          updatedAt: serverTimestamp()
        });

        await auditLogService.logAction('PRODUCT_DEACTIVATE', 'products', id, {
          name: productName,
          reason: usage.reason,
          note: 'Produto desativado para proteger o histórico comercial e operacional.'
        });

        await cacheService.notifyChange();
        import('./catalogCacheService').then(({ catalogCacheService }) => {
          catalogCacheService.scheduleCatalogCacheRegeneration('product_deactivated').catch(err => console.error(err));
        });

        return {
          status: 'deactivated',
          message: `O produto "${productName}" possui histórico ou saldo em estoque (${usage.reason}) e foi desativado em vez de ser excluído.`
        };
      }

      // Safe physical deletion when product has never been used and stock is 0
      const variantsCol = collection(db, `products/${id}/variants`);
      const vSnap = await getDocs(variantsCol);
      const batch = writeBatch(db);

      vSnap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      batch.delete(productRef);

      await batch.commit();

      await auditLogService.logAction('PRODUCT_DELETE', 'products', id, {
        name: productName,
        note: 'Exclusão física de produto sem histórico ou estoque.'
      });

      await cacheService.notifyChange();
      import('./catalogCacheService').then(({ catalogCacheService }) => {
        catalogCacheService.scheduleCatalogCacheRegeneration('product_deleted').catch(err => console.error(err));
      });

      return {
        status: 'deleted',
        message: `Produto "${productName}" excluído permanentemente com sucesso.`
      };
    } catch (error: unknown) {
      console.error("Fatal error in deleteProduct:", error);
      throw error;
    }
  },

  async duplicateProduct(id: string): Promise<string> {
    const detail = await this.getProduct(id);
    if (!detail) throw new Error("Produto original não encontrado para duplicação.");

    const { product, variants } = detail;

    // Build new product payload with clean identity
    const newProductPayload: Omit<Product, 'id'> = {
      ...product,
      name: `${product.name} (Cópia)`,
      active: false, // Inactive draft copy
      sku: '', // Clear SKU to prevent uniqueness conflict
      gtin: '', // Clear GTIN to prevent uniqueness conflict
      barcode: '',
      stock: 0,
      lastBalanceDate: null,
      lastBalanceCode: undefined,
      lastBalanceCounted: undefined,
      lastBalanceUser: undefined,
      cliques: 0,
      conversoes: 0,
      visualizacoes: 0,
      score: 10,
      homeClicks: 0,
      homeScore: 0,
      seo: {
        ...(product.seo || { condition: 'new' }),
        slug: `${product.seo?.slug || 'produto'}-copia-${Date.now().toString(36)}`,
        metaTitle: product.seo?.metaTitle ? `${product.seo.metaTitle} (Cópia)` : ''
      }
    };

    // Clean variants payload
    const newVariantsPayload: ProductVariant[] = variants.map(v => ({
      ...v,
      id: undefined, // Fresh subcollection ID
      sku: '',
      barcode: '',
      gtin: '',
      stock: 0,
      lastBalanceDate: null,
      lastBalanceCode: undefined,
      lastBalanceCounted: undefined,
      lastBalanceUser: undefined
    }));

    const newId = await this.createProduct(newProductPayload, newVariantsPayload);

    await auditLogService.logAction('PRODUCT_DUPLICATE', 'products', newId, {
      sourceId: id,
      sourceName: product.name,
      newName: newProductPayload.name
    });

    return newId;
  },

  async uploadImage(file: File): Promise<{ url: string; path: string }> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `products/${Date.now()}_${sanitizedName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { url, path };
  },

  async deleteImage(path: string) {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    } catch (error) {
      console.error("Error deleting image from storage:", error);
    }
  }
};
