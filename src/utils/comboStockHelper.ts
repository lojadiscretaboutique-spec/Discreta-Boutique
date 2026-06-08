import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Combo } from '../services/comboService';
import { Product, ProductVariant } from '../services/productService';

export interface ReservedStockMap {
  products: Record<string, number>; // productId -> quantity
  variants: Record<string, number>; // `${productId}_${variantId}` -> quantity
}

export async function getComboReservedStocks(): Promise<ReservedStockMap> {
  const result: ReservedStockMap = {
    products: {},
    variants: {}
  };
  
  try {
    const q = query(collection(db, 'combos'), where('active', '==', true));
    const snap = await getDocs(q);
    const activeCombos = snap.docs.map(d => ({ id: d.id, ...d.data() } as Combo));
    
    for (const combo of activeCombos) {
      if (!combo.items || !Array.isArray(combo.items)) continue;
      for (const item of combo.items) {
        if (!item.productId) continue;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        
        if (item.variantId) {
          const key = `${item.productId}_${item.variantId}`;
          result.variants[key] = (result.variants[key] || 0) + qty;
        } else {
          result.products[item.productId] = (result.products[item.productId] || 0) + qty;
        }
      }
    }
  } catch (err) {
    console.warn("Error fetching combo reserved stocks:", err);
  }
  
  return result;
}

/**
 * Adjusts the stock of a list of products using a given reservation map.
 */
export function adjustProductsWithReservations(products: Product[], reserved: ReservedStockMap): Product[] {
  return products.map(p => {
    if ((p as any).isCombo) return p; // Combos don't have individual physical stock subtracts directly here
    const reservedQty = reserved.products[p.id!] || 0;
    const adjustedStock = p.controlStock ? Math.max(0, (p.stock || 0) - reservedQty) : p.stock;
    return {
      ...p,
      stock: adjustedStock
    };
  });
}

/**
 * Adjusts the stock of a single product and/or its variants.
 */
export function adjustProductAndVariantsWithReservations(
  product: Product, 
  variants: ProductVariant[], 
  reserved: ReservedStockMap
): { product: Product; variants: ProductVariant[] } {
  if (!product) return { product, variants };
  if ((product as any).isCombo) return { product, variants };

  // Adjust main product stock
  const reservedProdQty = reserved.products[product.id!] || 0;
  const adjustedStock = product.controlStock ? Math.max(0, (product.stock || 0) - reservedProdQty) : product.stock;
  
  const adjustedProduct = {
    ...product,
    stock: adjustedStock
  };

  // Adjust variant stocks
  const adjustedVariants = variants.map(v => {
    const key = `${product.id!}_${v.id}`;
    const reservedVarQty = reserved.variants[key] || 0;
    const adjustedVarStock = product.controlStock ? Math.max(0, (v.stock || 0) - reservedVarQty) : v.stock;
    return {
      ...v,
      stock: adjustedVarStock
    };
  });

  return { product: adjustedProduct, variants: adjustedVariants };
}
