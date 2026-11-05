import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Product } from '../types/product';
import type { Category } from './categoryService';
import type { Combo } from './comboService';
import { catalogCacheService } from './catalogCacheService';
import { adjustProductsWithReservations, getComboReservedStocks } from '../utils/comboStockHelper';
import { isVisibleInCustomerCatalog } from '../lib/customerCatalogSearch';

export interface CustomerCatalogData { products: Product[]; categories: Category[] }
let inFlight: Promise<CustomerCatalogData> | null = null;
let memory: CustomerCatalogData | null = null;
let memorySavedAt = 0;
const MEMORY_TTL = 20_000;

const comboToProduct = (id: string, combo: Combo): Product => ({
  id, name: combo.name, categoryId: 'combos', sku: '', unit: 'kit',
  active: combo.active === true, featured: !!combo.isFeatured, newRelease: false,
  price: combo.price, stock: 0, controlStock: true, allowBackorder: false,
  hasVariants: false, isCombo: true,
  images: combo.images?.length ? combo.images : (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
  shortDescription: combo.description || '',
  seo: { title: combo.seoTitle, description: combo.seoDescription },
  ...(combo.showInCatalog === false ? { showInCatalog: false } : {})
} as Product);

async function fetchWholeCatalog(): Promise<CustomerCatalogData> {
  // Unlike the old `limit(300)` fallback, this reads every active product.
  const [productSnap, categorySnap, combosSnap, reservations] = await Promise.all([
    getDocs(query(collection(db, 'products'), where('active', '==', true))),
    getDocs(collection(db, 'categories')),
    getDocs(query(collection(db, 'combos'), where('active', '==', true), where('showInCatalog', '==', true))),
    getComboReservedStocks()
  ]);
  const regular = adjustProductsWithReservations(productSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)), reservations);
  const combos = combosSnap.docs.map(d => comboToProduct(d.id, d.data() as Combo));
  return {
    products: [...regular, ...combos].filter(isVisibleInCustomerCatalog),
    categories: categorySnap.docs.map(d => ({ id: d.id, ...d.data() } as Category))
  };
}

async function load(): Promise<CustomerCatalogData> {
  const cached = await catalogCacheService.getCachedCatalog();
  // Old caches could be incomplete. Version 2 means the full catalogue was published in chunks.
  if (!cached || cached.metadata.formatVersion !== 2) return fetchWholeCatalog();

  const products = new Map<string, Product>();
  (cached.products as Product[]).forEach(p => { if (p?.id) products.set(p.id, p); });
  const categories = cached.categories as Category[];
  const updatedAt = Date.parse(cached.metadata.updatedAt);
  if (!Number.isFinite(updatedAt)) return fetchWholeCatalog();

  try {
    // Incremental reconciliation: new products, activated products and stock changes
    // become visible without waiting for the admin's deferred cache rebuild.
    const since = Timestamp.fromMillis(Math.max(0, updatedAt - 2 * 60_000));
    const [changes, reservations] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('updatedAt', '>=', since))),
      getComboReservedStocks()
    ]);
    const changed = adjustProductsWithReservations(
      changes.docs.map(d => ({ id: d.id, ...d.data() } as Product)), reservations
    );
    changed.forEach(p => {
      if (!p.id) return;
      if (isVisibleInCustomerCatalog(p)) products.set(p.id, p);
      else products.delete(p.id);
    });
    return { products: [...products.values()].filter(isVisibleInCustomerCatalog), categories };
  } catch (err) {
    console.warn('[CATALOG] Incremental sync unavailable, requesting full live data:', err);
    return fetchWholeCatalog();
  }
}

export const customerCatalogDataService = {
  async load(): Promise<CustomerCatalogData> {
    if (memory && Date.now() - memorySavedAt < MEMORY_TTL) return memory;
    if (inFlight) return inFlight;
    inFlight = load().then(data => {
      memory = data;
      memorySavedAt = Date.now();
      return data;
    }).finally(() => { inFlight = null; });
    return inFlight;
  },
  invalidate() { memory = null; memorySavedAt = 0; }
};
