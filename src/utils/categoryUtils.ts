import { Product, Category } from '../services/productService';

export const isProductInCategory = (product: Product, categoryId: string, listCats: Category[]): boolean => {
  if (product.categoryId === categoryId) return true;
  if (product.categoryIds && Array.isArray(product.categoryIds) && product.categoryIds.includes(categoryId)) {
    return true;
  }
  
  const checkParent = (catId: string | null | undefined): boolean => {
    if (!catId) return false;
    if (catId === categoryId) return true;
    const cat = listCats.find(c => c.id === catId);
    if (!cat) return false;
    if (cat.parentId === categoryId) return true;
    return checkParent(cat.parentId);
  };

  if (checkParent(product.categoryId)) return true;
  if (product.categoryIds && Array.isArray(product.categoryIds)) {
    if (product.categoryIds.some(cid => checkParent(cid))) return true;
  }

  return false;
};
