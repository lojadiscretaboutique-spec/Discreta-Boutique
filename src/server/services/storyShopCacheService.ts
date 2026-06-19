import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StoryShop, PublicStoryShopCache } from '../../types/storyShop';

let regenerationTimeout: ReturnType<typeof setTimeout> | null = null;
let isRegenerating = false;

export const storyShopCacheService = {
  async scheduleStoryShopRegeneration(reason: string): Promise<void> {
    if (regenerationTimeout) {
      clearTimeout(regenerationTimeout);
    }

    regenerationTimeout = setTimeout(async () => {
      if (isRegenerating) {
        this.scheduleStoryShopRegeneration('retry_after_busy');
        return;
      }

      isRegenerating = true;
      try {
        await this.regenerateStoryShopCache();
      } catch (err) {
        console.error('[STORY_SHOP_CACHE] Failed scheduled regeneration', err);
      } finally {
        isRegenerating = false;
      }
    }, 5000); // 5s debounce
  },

  async regenerateStoryShopCache(): Promise<void> {
    try {
      console.log('⚡ Starting Story Shop Cache regeneration...');

      // Fetch ALL stories
      const q = query(collection(db, 'story_shop'));
      const snapshot = await getDocs(q);

      // In-memory filter and map
      const stories: StoryShop[] = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as StoryShop))
        .filter(s => s.active && s.title && s.thumbnailUrl && s.videoUrl && s.productId);

      // Sort in memory
      stories.sort((a, b) => (a.order || 0) - (b.order || 0));

      const cachedItems = stories.map(s => ({
        id: s.id,
        title: s.title,
        thumbnailUrl: s.thumbnailUrl,
        videoUrl: s.videoUrl,
        productId: s.productId,
        productName: s.productName || null,
        productSlug: s.productSlug || null,
        productImageThumb: s.productImageThumb || null,
        price: s.price || null,
        promotionalPrice: s.promotionalPrice || null,
        hasVariants: s.hasVariants || false,
        inStock: s.inStock ?? true,
        order: s.order || 0
      }));

      await setDoc(doc(db, 'public_story_shop_cache', 'items'), {
        items: cachedItems,
        updatedAt: serverTimestamp(),
        totalItems: cachedItems.length
      });

      console.log('✅ Story Shop Cache successfully regenerated!');
    } catch (error) {
      console.error('❌ Error regenerating Story Shop Cache:', error);
      throw error;
    }
  }
};
