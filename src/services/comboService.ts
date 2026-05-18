import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  where, 
  serverTimestamp, 
  addDoc, 
  deleteDoc, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, ProductVariant } from './productService';
import { cacheService } from './cacheService';

export interface ComboItem {
  productId: string;
  variantId?: string;
  name?: string;
  variantName?: string;
  quantity: number;
  price?: number; // Original price for reference
}

export interface ComboImage {
  url: string;
  isMain: boolean;
  path?: string;
}

export interface Combo {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string; // Legacy field for compatibility
  images?: ComboImage[];
  active: boolean;
  showInCatalog: boolean;
  isFeatured: boolean;
  categories: string[];
  seoTitle?: string;
  seoDescription?: string;
  items: ComboItem[];
  soldCount: number;
  profit: number;
  createdAt: any;
  updatedAt: any;
}

export const comboService = {
  async listCombos() {
    const q = query(collection(db, 'combos'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Combo));
  },

  async getCombo(id: string) {
    const ref = doc(db, 'combos', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Combo;
  },

  async saveCombo(data: Partial<Combo>) {
    const isUpdate = !!data.id;
    const ref = isUpdate ? doc(db, 'combos', data.id!) : doc(collection(db, 'combos'));
    
    // Ensure we have a main image defined if images exist
    if (data.images && data.images.length > 0) {
      const hasMain = data.images.some(img => img.isMain);
      if (!hasMain) data.images[0].isMain = true;
    }

    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt || serverTimestamp(),
      soldCount: data.soldCount || 0,
      profit: data.profit || 0,
      active: data.active ?? true,
      showInCatalog: data.showInCatalog ?? true,
      isFeatured: data.isFeatured ?? false,
      categories: data.categories || [],
    };

    if (isUpdate) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
    
    await cacheService.notifyChange();
    return ref.id;
  },

  async deleteCombo(id: string) {
    const combo = await this.getCombo(id);
    if (combo?.images) {
      const { deleteObject, ref: storageRef } = await import('firebase/storage');
      const { storage } = await import('../lib/firebase');
      
      for (const img of combo.images) {
        if (img.path) {
          try {
            await deleteObject(storageRef(storage, img.path));
          } catch (e) {
            console.warn("Failed to delete image from storage", e);
          }
        }
      }
    }
    await deleteDoc(doc(db, 'combos', id));
    await cacheService.notifyChange();
  },

  /**
   * Calcula o estoque virtual do combo baseado nos produtos que o compõem.
   */
  async getComboStock(combo: Combo): Promise<number> {
    const stocks: number[] = [];
    
    for (const item of combo.items) {
      const pRef = doc(db, 'products', item.productId);
      const pSnap = await getDoc(pRef);
      
      if (!pSnap.exists()) {
        stocks.push(0);
        continue;
      }
      
      const pData = pSnap.data() as Product;
      
      if (!pData.controlStock) {
        // If one item doesn't control stock, it doesn't limit the combo
        stocks.push(9999); 
        continue;
      }

      if (item.variantId) {
        const vRef = doc(db, `products/${item.productId}/variants/${item.variantId}`);
        const vSnap = await getDoc(vRef);
        if (vSnap.exists()) {
          const vData = vSnap.data() as ProductVariant;
          stocks.push(Math.floor(vData.stock / item.quantity));
        } else {
          stocks.push(0);
        }
      } else {
        stocks.push(Math.floor(pData.stock / item.quantity));
      }
    }

    return Math.min(...stocks);
  },

  async incrementSoldCount(id: string, amount: number = 1, profit: number = 0) {
    const ref = doc(db, 'combos', id);
    await updateDoc(ref, {
      soldCount: increment(amount),
      profit: increment(profit),
      updatedAt: serverTimestamp()
    });
  }
};
