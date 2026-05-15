import { Category } from './categoryService';
import { Product } from './productService';

/**
 * Service to handle intelligent categorization matching.
 * Uses lightweight semantic analysis (keyword matching + relevance scoring).
 */

export const productCategorizationService = {
  /**
   * Suggests categories for a product based on its title and description.
   * Only matches against existing categories.
   */
  suggestCategories(
    productName: string, 
    description: string, 
    brand: string,
    tags: string[],
    allCategories: Category[]
  ): { categoryId: string; confidence: number }[] {
    const text = `${productName} ${description}`.toLowerCase();
    const brandText = brand?.toLowerCase() || '';
    const tagText = tags?.join(' ').toLowerCase() || '';
    
    // Scoring weights
    const WEIGHTS = { NAME: 0.5, TAG: 0.3, BRAND: 0.1, DESC: 0.1 };
    
    const suggestions: { categoryId: string; confidence: number }[] = [];

    allCategories.forEach(cat => {
      const keywords = cat.name.toLowerCase().split(' ');
      let score = 0;
      
      keywords.forEach(kw => {
        if (kw.length <= 2) return;
        
        let kwMatches = 0;
        if (productName.toLowerCase().includes(kw)) kwMatches += 1;
        if (tagText.includes(kw)) kwMatches += 1;
        if (brandText.includes(kw)) kwMatches += 0.5;
        if (description.toLowerCase().includes(kw)) kwMatches += 0.2;
        
        if (kwMatches > 0) score += Math.min(1, kwMatches);
      });
      
      if (score > 0) {
        const confidence = Math.min(100, (score / keywords.length) * 100);
        if (confidence > 25) { 
            suggestions.push({ categoryId: cat.id, confidence });
        }
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
};
