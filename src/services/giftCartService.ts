import { CartItem } from '../store/cartStore';
import { promotionCacheService } from './promotionCacheService';
import { Promotion, GiftProduct } from './promotionService';

export const giftCartService = {
  /**
   * Calculates which gifts should be in the cart based on the current items and subtotal.
   * Returns a list of CartItem representing the gifts.
   */
  async calculateEligibleGifts(items: CartItem[]): Promise<CartItem[]> {
    try {
      // 1. Get items that are NOT gifts to calculate subtotal
      const regularItems = items.filter(item => !item.isGift);
      const subtotal = regularItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      if (subtotal <= 0) return [];

      // 2. Get active gift promotions from public cache
      const activeGifts = await promotionCacheService.getActiveGifts();
      if (!activeGifts || activeGifts.length === 0) return [];

      const eligibleGifts: CartItem[] = [];

      // 3. For each promotion, find the best tier
      for (const promo of activeGifts) {
        if (!promo.tiers || promo.tiers.length === 0) continue;

        // Sort tiers by subtotal descending to find the highest applicable tier
        const sortedTiers = [...promo.tiers].sort((a, b) => b.minSubtotal - a.minSubtotal);
        const applicableTier = sortedTiers.find(tier => subtotal >= tier.minSubtotal);

        if (applicableTier) {
          // If automatic, add all products from the tier
          if (promo.applyMode === 'automatic' || !promo.applyMode) {
            for (const giftProd of applicableTier.giftProducts) {
              eligibleGifts.push(this.mapGiftToCartItem(giftProd, promo, applicableTier.id));
            }
          }
          // If manual_choice, for now we don't auto-add (the UI should handle choice)
          // But as per requirements: "Se carrinho atingir minSubtotal, adicionar mimo automaticamente."
          // So I will auto-add for now, and UI can allow changing if needed.
        }
      }

      return eligibleGifts;
    } catch (error) {
      console.error("[GiftCartService] Error calculating gifts:", error);
      return [];
    }
  },

  /**
   * Helper to map a GiftProduct to a CartItem
   */
  mapGiftToCartItem(gift: GiftProduct, promo: Promotion, tierId: string): CartItem {
    const id = gift.variantId ? `${gift.productId}-${gift.variantId}-gift` : `${gift.productId}-gift`;
    
    let resolvedImageUrl = '';
    if (typeof gift.productImage === 'string') {
      resolvedImageUrl = gift.productImage;
    } else if (gift.productImage && typeof gift.productImage === 'object') {
      resolvedImageUrl = (gift.productImage as any).url || '';
    }

    return {
      id,
      productId: gift.productId,
      name: gift.productName,
      price: gift.giftPrice,
      quantity: gift.quantity,
      imageUrl: resolvedImageUrl,
      sku: gift.productSku || gift.variantSku,
      variantId: gift.variantId,
      variantName: gift.variantName,
      originalPrice: gift.originalPrice,
      isGift: true,
      giftPromotionId: promo.id,
      giftTierId: tierId,
      lockedPrice: true,
      cannotEditPrice: true,
      cannotApplyCoupon: true,
      removeIfNotEligible: true
    };
  }
};
