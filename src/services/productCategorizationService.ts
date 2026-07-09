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
    const safeName = productName || '';
    const safeDesc = description || '';
    const safeBrand = brand || '';
    const safeTags = Array.isArray(tags) ? tags : [];

    const text = `${safeName} ${safeDesc}`.toLowerCase();
    const brandText = safeBrand.toLowerCase();
    const tagText = safeTags.join(' ').toLowerCase();
    
    // Scoring weights
    const WEIGHTS = { NAME: 0.5, TAG: 0.3, BRAND: 0.1, DESC: 0.1 };
    
    const suggestions: { categoryId: string; confidence: number }[] = [];

    if (!Array.isArray(allCategories)) return [];

    allCategories.forEach(cat => {
      if (!cat || !cat.name) return;
      
      const keywords = cat.name.toLowerCase().split(' ');
      let score = 0;
      
      keywords.forEach(kw => {
        if (!kw || kw.length <= 2) return;
        
        let kwMatches = 0;
        if (safeName.toLowerCase().includes(kw)) kwMatches += 1;
        if (tagText.includes(kw)) kwMatches += 1;
        if (brandText.includes(kw)) kwMatches += 0.5;
        if (safeDesc.toLowerCase().includes(kw)) kwMatches += 0.2;
        
        if (kwMatches > 0) score += Math.min(1, kwMatches);
      });
      
      if (score > 0 && keywords.length > 0) {
        const confidence = Math.min(100, (score / keywords.length) * 100);
        if (confidence > 25) { 
            suggestions.push({ categoryId: cat.id, confidence });
        }
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
};
