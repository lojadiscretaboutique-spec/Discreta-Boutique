import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Promotion } from './promotionService';

const CACHE_COLLECTION = 'public_promotions_cache';
const PROMOTIONS_COLLECTION = 'promotions';

export const promotionCacheService = {
  /**
   * Regenerates the public cache for Gift With Purchase promotions.
   * This cache is used by the frontend to efficiently apply gifts in the cart.
   */
  async regenerateGiftCache(): Promise<void> {
    try {
      console.log("[PromotionCache] Regenerating Gift With Purchase cache...");
      
      const q = query(
        collection(db, PROMOTIONS_COLLECTION),
        where('active', '==', true),
        where('type', '==', 'gift_with_purchase')
      );
      
      const snapshot = await getDocs(q);
      const allPromotions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Promotion[];

      // Filter by date if applicable
      const now = new Date();
      const activePromotions = allPromotions.filter(p => {
        if (p.startDate && new Date(p.startDate) > now) return false;
        if (p.endDate && new Date(p.endDate) < now) return false;
        return true;
      });

      // Sort by priority (higher priority first)
      activePromotions.sort((a, b) => b.priority - a.priority);

      // Save to public cache
      await setDoc(doc(db, CACHE_COLLECTION, 'gift_with_purchase'), {
        items: activePromotions,
        updatedAt: serverTimestamp()
      });

      console.log(`[PromotionCache] Cache regenerated with ${activePromotions.length} active gift promotions.`);
    } catch (error) {
      console.error("[PromotionCache] Error regenerating cache:", error);
      throw error;
    }
  },

  /**
   * Gets the active gift promotions from the public cache.
   */
  async getActiveGifts(): Promise<Promotion[]> {
    try {
      const snap = await getDocs(query(collection(db, CACHE_COLLECTION)));
      const giftDoc = snap.docs.find(d => d.id === 'gift_with_purchase');
      
      if (giftDoc && giftDoc.exists()) {
        return giftDoc.data().items as Promotion[];
      }
      
      return [];
    } catch (error) {
      console.error("[PromotionCache] Error getting active gifts:", error);
      return [];
    }
  }
};
