import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { promotionCacheService } from './promotionCacheService';

export interface Promotion {
  id?: string;
  name: string;
  active: boolean;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'gift_with_purchase';
  value: number; // For percentage or fixed cash discount
  scope: 'all' | 'categories' | 'products';
  targetIds?: string[]; // IDs of categories or products
  startDate?: string;
  endDate?: string;
  minPurchaseAmount?: number;
  priority: number; // To handle conflicting promotions
  createdAt?: any;
  updatedAt?: any;
  allowedPaymentMethods?: string[];
  allowedPaymentMethodIds?: string[];
  allowedPaymentMethodSnapshots?: { id: string; name: string; type: string }[];
  
  // Gift With Purchase Specific Fields
  stackable?: boolean;
  applyMode?: 'automatic' | 'manual_choice';
  maxUses?: number;
  customerLimit?: number;
  allowWithCoupons?: boolean;
  allowWithOtherPromotions?: boolean;
  tiers?: GiftTier[];
}

export interface GiftTier {
  id: string;
  minSubtotal: number;
  giftProducts: GiftProduct[];
}

export interface GiftProduct {
  productId: string;
  productName: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
  giftPrice: number;
  originalPrice: number;
  stockRequired: boolean;
  variantId?: string;
  variantName?: string;
  variantSku?: string;
}

const COLLECTION_NAME = 'promotions';

export const promotionService = {
  async getAll(): Promise<Promotion[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('priority', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Promotion[];
  },

  async create(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Regenerate cache if it's a gift promotion
    if (data.type === 'gift_with_purchase') {
      await promotionCacheService.regenerateGiftCache();
    }
    
    return docRef.id;
  },

  async update(id: string, data: Partial<Promotion>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    
    // Regenerate cache as it might have changed active status or type
    await promotionCacheService.regenerateGiftCache();
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    
    // Always regenerate cache on delete to be safe
    await promotionCacheService.regenerateGiftCache();
  }
};
