import { doc, getDoc, setDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getComboReservedStocks, adjustProductsWithReservations } from '../utils/comboStockHelper';
import { Product } from './productService';
import { Category } from './categoryService';
import { Combo } from './comboService';
import { isVisibleInCustomerCatalog } from '../lib/customerCatalogSearch';

export interface CachedCatalog {
  products: any[];
  categories: any[];
  metadata: {
    updatedAt: string;
    formatVersion?: number;
    chunks?: string[];
    totalProducts: number;
    totalCategories: number;
    status?: string;
    lastReason?: string;
    lastRegenAt?: any;
    lastRegenDurationMs?: number;
    lastError?: string;
  };
}

let regenerationTimeout: ReturnType<typeof setTimeout> | null = null;
const pendingRegenerationReasons: Set<string> = new Set();
let isRegenerating = false;

export const catalogCacheService = {
  /**
   * Schedule regeneration of public catalog cache with a debounce to prevent 
   * overwhelming the DB on rapid consecutive changes.
   */
  async scheduleCatalogCacheRegeneration(reason: string): Promise<void> {
    pendingRegenerationReasons.add(reason);
    
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.log(`[CATALOG_CACHE] Scheduled regeneration queued. Reason: ${reason}`);
    }

    if (regenerationTimeout) {
      clearTimeout(regenerationTimeout);
    }

    try {
      // Opt-in UI update: set status to regenerating
      const reasonsArray = Array.from(pendingRegenerationReasons);
      await setDoc(doc(db, 'public_catalog_cache', 'metadata'), {
        status: 'regenerating',
        pendingReasons: reasonsArray,
        lastQueuedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      // non-fatal if this fails
    }

    regenerationTimeout = setTimeout(async () => {
      if (isRegenerating) {
        // Delay if currently regenerating to avoid overlap
        this.scheduleCatalogCacheRegeneration('retry_after_busy');
        return;
      }

      isRegenerating = true;
      const reasonsToClear = Array.from(pendingRegenerationReasons);
      
      try {
        const start = performance.now();
        await this.regenerateCatalogCache();
        const duration = performance.now() - start;
        
        await setDoc(doc(db, 'public_catalog_cache', 'metadata'), {
           status: 'updated',
           lastReason: reasonsToClear.join(', '),
           lastRegenDurationMs: duration,
           pendingReasons: [],
           lastRegenAt: serverTimestamp()
        }, { merge: true });
        
        reasonsToClear.forEach(r => pendingRegenerationReasons.delete(r));
      } catch (err) {
        console.error('[CATALOG_CACHE] Failed scheduled regeneration', err);
        await setDoc(doc(db, 'public_catalog_cache', 'metadata'), {
           status: 'error',
           lastError: String(err)
        }, { merge: true });
      } finally {
        isRegenerating = false;
      }
    }, 5000); // 5s debounce
  },

  /**
   * Fetches products and categories from the public cache collections/documents.

   * Returns null if any document is missing or invalid.
   */
  async getCachedCatalog(): Promise<CachedCatalog | null> {
    try {
      const start = performance.now();
      
      // The manifest is always read first; version 2 references immutable small chunks.
      const metadataSnap = await getDoc(doc(db, 'public_catalog_cache', 'metadata'));
      if (!metadataSnap.exists()) return null;
      const metadataDoc = metadataSnap.data();
      const categoriesSnap = await getDoc(doc(db, 'public_catalog_cache', 'categories'));
      if (!categoriesSnap.exists()) return null;
      let products: any[];
      if (metadataDoc?.formatVersion === 2 && Array.isArray(metadataDoc?.chunks)) {
        const chunkSnaps = await Promise.all(metadataDoc.chunks.map((id: string) =>
          getDoc(doc(db, 'public_catalog_cache_chunks', id))
        ));
        if (chunkSnaps.some(s => !s.exists())) return null;
        products = chunkSnaps.flatMap(s => s.data()?.products || []);
        if (products.length !== Number(metadataDoc.totalProducts)) return null;
      } else {
        const legacySnap = await getDoc(doc(db, 'public_catalog_cache', 'products'));
        if (!legacySnap.exists()) return null;
        products = legacySnap.data()?.products || [];
      }

      const result: CachedCatalog = {
        products,
        categories: categoriesSnap.data()?.categories || [],
        metadata: {
          updatedAt: metadataDoc?.updatedAt || '',
          formatVersion: metadataDoc?.formatVersion,
          chunks: metadataDoc?.chunks,
          totalProducts: Number(metadataDoc?.totalProducts) || 0,
          totalCategories: Number(metadataDoc?.totalCategories) || 0
        }
      };

      if (import.meta.env.DEV) {
        const duration = performance.now() - start;
        const payloadSizeApprox = JSON.stringify(result).length;
        console.log(`%c[CATALOG_CACHE_LOADED] Loaded from Firestore in ${duration.toFixed(2)}ms`, 'color: #10B981; font-weight: bold;');
        console.log(`[CATALOG_CACHE_LOADED] Products: ${result.products.length} | Categories: ${result.categories.length}`);
        console.log(`[CATALOG_CACHE_LOADED] Payload Size (approx): ${(payloadSizeApprox / 1024).toFixed(2)} KB`);
      }

      return result;
    } catch (err) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[PDV CATALOG_CACHE] Exception loading catalog cache:', err);
      }
      return null;
    }
  },

  /**
   * Regenerates and saves the compiled public catalog cache.
   */
  async regenerateCatalogCache(): Promise<void> {
    try {
      console.log('⚡ Starting Public Catalog Cache regeneration...');

      // 1. Fetch categories
      const catSnap = await getDocs(collection(db, 'categories'));
      const allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));

      // 2. Fetch products & combos
      const [prodSnap, comboSnap, reservedStocks] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'combos'), where('active', '==', true), where('showInCatalog', '==', true))),
        getComboReservedStocks()
      ]);

      const rawProductsList = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const adjustedProducts = adjustProductsWithReservations(rawProductsList, reservedStocks);

      // Map combos to catalog product shape
      const combosList = comboSnap.docs.map(d => {
        const combo = d.data() as Combo;
        return {
          id: d.id,
          name: combo.name || '',
          description: combo.description || '',
          price: combo.price || 0,
          images: combo.images?.length ? combo.images : (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
          categoryId: 'combos',
          active: combo.active,
          isCombo: true,
          showInCatalog: combo.showInCatalog,
          featured: combo.isFeatured,
          newRelease: false,
          seo: {
            title: combo.seoTitle || '',
            description: combo.seoDescription || '',
            keywords: ''
          }
        } as any;
      });

      // Merge regular products with combos
      const mergedProducts = [...adjustedProducts, ...combosList];

      // Build category map helper for category name lookups
      const categoryMap = allCategories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
      }, {} as Record<string, string>);

      // 3. Keep strictly active items with photos that are meant for catalog
      const visibleProductsRaw = mergedProducts.filter(isVisibleInCustomerCatalog);

      // Build lightweight products (excl: long description, absolute bulk specs, heavy images, raw admin, costs, purchase history, logs)
      const summarizedProducts = visibleProductsRaw.map(p => {
        const valid = (url?: string) => typeof url === 'string' && /^https?:\/\//i.test(url);
        const imageThumb = (p.images || []).find(i => i?.isMain && valid(i?.url))?.url ||
          (p.images || []).find(i => valid(i?.url))?.url ||
          [p.imageThumb, p.imageUrl].find(valid) || '';
        const inStock = p.isCombo || (Number(p.stock) || 0) > 0;
        
        return {
          id: p.id || '',
          name: p.name || '',
          slug: p.slug || (p.name ? p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') : ''),
          price: Number(p.price) || 0,
          promotionalPrice: p.promoPrice !== undefined ? Number(p.promoPrice) : null,
          promoPrice: p.promoPrice !== undefined ? Number(p.promoPrice) : null, // keep both for storefront compatibility
          imageThumb: imageThumb,
          images: [{ url: imageThumb, isMain: true }], // first small image WebP
          categoryId: p.categoryId || '',
          categoryName: categoryMap[p.categoryId] || (p.categoryId === 'combos' ? 'Combos' : ''),
          active: p.active !== false,
          inStock: inStock,
          stock: p.stock ?? 1,
          tags: p.tags || [],
          searchTerms: p.searchTerms || [],
          createdAt: p.createdAt ? (typeof p.createdAt.toDate === 'function' ? p.createdAt.toDate().toISOString() : (p.createdAt.seconds ? new Date(p.createdAt.seconds * 1000).toISOString() : String(p.createdAt))) : new Date().toISOString(),
          updatedAt: p.updatedAt ? (typeof p.updatedAt.toDate === 'function' ? p.updatedAt.toDate().toISOString() : (p.updatedAt.seconds ? new Date(p.updatedAt.seconds * 1000).toISOString() : String(p.updatedAt))) : new Date().toISOString(),
          isFeatured: !!p.featured || !!(p as any).isFeatured,
          featured: !!p.featured || !!(p as any).isFeatured,
          isNew: !!p.newRelease,
          newRelease: !!p.newRelease,
          salesCount: (p as any).conversoes || 0,
          conversoes: (p as any).conversoes || 0,

          // Storefront compatibility fields (lightweight)
          sku: p.sku || '',
          controlStock: p.controlStock ?? true,
          allowBackorder: p.allowBackorder ?? false,
          extras: p.extras || {},
          seo: { slug: p.seo?.slug || p.slug || '', title: p.seo?.title || p.seo?.metaTitle || '', keywords: p.seo?.keywords || [] },
          shortDescription: p.shortDescription || (p as any).description || '',
          // Full HTML descriptions belong to the product detail, not the public search index.
          fullDescription: '',
          description: (p as any).description || p.shortDescription || '',
          subtitle: p.subtitle || '',
          brand: p.brand || '',
          subcategory: p.subcategory || (p as any).subcategoria || '',
          internalCode: p.internalCode || '',
          gtin: p.gtin || (p as any).barcode || (p as any).ean || '',
          palavras_chave: (p as any).palavras_chave || [],
          ai_keywords: p.ai_keywords || [],
          ai_synonyms: p.ai_synonyms || [],
          hasVariants: !!p.hasVariants,
          isCombo: !!p.isCombo,
          variantIdentifiers: p.variantIdentifiers || [],
          cosmetics: p.cosmetics?.type ? { type: p.cosmetics.type } : undefined,
          cliques: (p as any).cliques || 0,
          score: (p as any).score || 0
        };
      });

      // Filter and map categories
      // We only include categories that have products inside our summarized list, or is level 0
      const activeCategoryIds = new Set(summarizedProducts.map(p => p.categoryId));
      
      const summarizedCategories = allCategories.map(c => {
        // Calculate product count for this category
        const directProductCount = summarizedProducts.filter(p => p.categoryId === c.id).length;
        
        return {
          id: c.id,
          name: c.name || '',
          slug: c.slug || '',
          image: c.image || null,
          productCount: directProductCount || c.productCount || 0,
          active: c.isActive !== false,
          order: c.sortOrder ?? 0,
          parentId: c.parentId || null,
          level: c.level ?? 0,
          accessCount: c.accessCount || 0
        };
      });

      const timestampISO = new Date().toISOString();

      // Publish immutable chunks, then swap a small manifest LAST. Firestore documents
      // have a 1 MiB hard limit; the old single `products` document silently hit that limit.
      const version = `v2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const chunks: any[][] = [];
      let current: any[] = [];
      let currentSize = 0;
      for (const p of summarizedProducts) {
        const size = JSON.stringify(p).length;
        if (current.length > 0 && currentSize + size > 180_000) {
          chunks.push(current);
          current = [];
          currentSize = 0;
        }
        current.push(p);
        currentSize += size;
      }
      if (current.length) chunks.push(current);
      const chunkIds = chunks.map((_, i) => `${version}_${i}`);
      // Save first so customers never receive a manifest pointing to missing chunks.
      for (let i = 0; i < chunks.length; i++) {
        await setDoc(doc(db, 'public_catalog_cache_chunks', chunkIds[i]), {
          products: chunks[i], version, updatedAt: timestampISO
        });
      }
      await setDoc(doc(db, 'public_catalog_cache', 'categories'), {
        categories: summarizedCategories,
        updatedAt: timestampISO,
        lastRegeneration: serverTimestamp()
      });
      await setDoc(doc(db, 'public_catalog_cache', 'metadata'), {
        formatVersion: 2,
        chunks: chunkIds,
        updatedAt: timestampISO,
        totalProducts: summarizedProducts.length,
        totalCategories: summarizedCategories.length,
        status: 'updated',
        lastRegeneration: serverTimestamp()
      }, { merge: true });

      console.log('✅ Public Catalog Cache successfully regenerated!');
    } catch (error) {
      console.error('❌ Error regenerating Public Catalog Cache:', error);
      throw error;
    }
  }
};
