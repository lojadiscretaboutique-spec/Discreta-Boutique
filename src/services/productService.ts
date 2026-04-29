import { serverTimestamp, collection, doc, updateDoc, getDoc, getDocs, query, orderBy, writeBatch, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface ProductVariant {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  price?: number;
  promoPrice?: number;
  stock: number;
  imageUrl?: string;
  active: boolean;
  attributes: Record<string, string>; // e.g. { "Cor": "Preto", "Tamanho": "P" }
}

export interface Product {
  id?: string;
  
  // 1. Informações Gerais
  name: string;
  subtitle?: string;
  shortDescription?: string;
  fullDescription?: string;
  categoryId: string;
  subcategory?: string;
  brand?: string;
  collection?: string;
  tags?: string[];
  internalCode?: string;
  sku: string;
  gtin?: string;
  ncm?: string;
  origin?: string;
  active: boolean;
  featured: boolean;
  newRelease: boolean;

  // 2. Preço e Estoque
  costPrice?: number;
  price: number;
  promoPrice?: number;
  promoStart?: Date | string | null;
  promoEnd?: Date | string | null;
  stock: number;
  minStock?: number;
  controlStock: boolean;
  allowBackorder: boolean;
  maxQtyPerOrder?: number;
  unit: 'un' | 'kit' | 'cx' | 'ml' | 'g' | 'kg' | 'par' | 'peça';

  // 3. Variações
  hasVariants: boolean;

  // 4. Moda
  fashion?: {
    gender?: 'Masculino' | 'Feminino' | 'Unissex' | 'Infantil';
    ageGroup?: string;
    pieceType?: string;
    material?: string;
    composition?: string;
    hasPadding?: boolean;
    hasUnderwire?: boolean;
    transparency?: string;
    elasticity?: string;
    fit?: string;
    occasion?: string;
    season?: string;
    sizeTable?: string;
    washingInstructions?: string;
    countryOfOrigin?: string;
    mainColor?: string;
    print?: string;
    sleeve?: string;
    waist?: string;
    length?: string;
    closure?: string;
  };

  // 5. Cosméticos
  cosmetics?: {
    type?: string;
    usageArea?: string;
    volume?: string;
    fragrance?: string;
    skinType?: string;
    hairType?: string;
    benefits?: string;
    usageMode?: string;
    precautions?: string;
    ingredients?: string;
    vegan?: boolean;
    crueltyFree?: boolean;
    dermatologicallyTested?: boolean;
    hypoallergenic?: boolean;
    anvisaRegister?: string;
    batch?: string;
    manufacturingDate?: Date | string | null;
    expiryDate?: Date | string | null;
    pao?: string;
  };

  // 6. Imagens
  images: { url: string; path: string; isMain: boolean; variantId?: string }[];

  // 7. Entrega
  delivery?: {
    weight?: number;
    height?: number;
    width?: number;
    length?: number;
    cubicVolume?: number;
    additionalProcessingTime?: number;
    fragile?: boolean;
    specialPackaging?: boolean;
  };

  // 8. SEO
  seo?: {
    slug: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    googleCategory?: string;
    condition: 'new' | 'used';
  };

  // 9. Extras
  extras?: {
    showInVitrine?: boolean;
    showInApp?: boolean;
    showInCatalog?: boolean;
    exclusiveOnline?: boolean;
    acceptsCoupon?: boolean;
    salesCommission?: number;
    displayOrder?: number;
    internalNotes?: string;
  };

  searchTerms?: string[];
  variantIdentifiers?: string[];
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export const productService = {
  async checkGtinExists(gtin: string, excludeProductId?: string): Promise<boolean> {
    if (!gtin) return false;
    
    // Check main products (gtin field)
    const qProd = query(collection(db, 'products'), where('gtin', '==', gtin));
    const snapProd = await getDocs(qProd);
    if (snapProd.docs.some(d => d.id !== excludeProductId)) return true;

    // Check products (variantIdentifiers array)
    const qVar = query(collection(db, 'products'), where('variantIdentifiers', 'array-contains', gtin));
    const snapVar = await getDocs(qVar);
    if (snapVar.docs.some(d => d.id !== excludeProductId)) return true;

    return false;
  },

  async listProducts() {
    try {
      const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error: unknown) {
      console.error("Error listing products:", error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        throw new Error("Permissão negada ao listar produtos. Verifique se você é um administrador.");
      }
      return [];
    }
  },

  async getProduct(id: string) {
    try {
      const docRef = doc(db, 'products', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const product = { id: snap.id, ...snap.data() } as Product;
        // Load variants
        try {
          const vSnap = await getDocs(collection(db, `products/${id}/variants`));
          const variants = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
          return { product, variants };
        } catch (vError: unknown) {
          console.error("Error loading variants for product", id, vError);
          // Return product even without variants if variants fetch fails
          return { product, variants: [] };
        }
      }
      return null;
    } catch (error: unknown) {
      console.error("Error getting product:", error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        throw new Error("Permissão negada ao acessar produto.");
      }
      throw error;
    }
  },

  async createProduct(product: Omit<Product, 'id'>, variants: ProductVariant[]) {
    try {
      const batch = writeBatch(db);
      const productRef = doc(collection(db, 'products'));
      
      const pData = {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(productRef, pData);

      // Create variants in subcollection
      if (product.hasVariants) {
        variants.forEach(v => {
          const vRef = doc(collection(db, `products/${productRef.id}/variants`));
          batch.set(vRef, v);
        });
      }

      await batch.commit();
      return productRef.id;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  },

  async updateProduct(id: string, product: Partial<Product>, variants: ProductVariant[]) {
    try {
      const productRef = doc(db, 'products', id);
      
      const updateData: any = {};
      const allowedFields = [
        'name', 'subtitle', 'active', 'featured', 'newRelease', 
        'categoryId', 'brand', 'shortDescription', 'fullDescription',
        'price', 'costPrice', 'promoPrice', 'sku', 'gtin', 'unit',
        'stock', 'minStock', 'controlStock', 'allowBackorder',
        'hasVariants', 'images', 'fashion', 'cosmetics', 'delivery',
        'seo', 'extras', 'searchTerms', 'variantIdentifiers'
      ];

      allowedFields.forEach(field => {
        const val = (product as any)[field];
        if (val !== undefined) {
          updateData[field] = val;
        }
      });

      updateData.updatedAt = serverTimestamp();

      await updateDoc(productRef, updateData);

      // Simple sync for variants: delete all and recreate
      if (product.hasVariants) {
        const vCols = collection(db, `products/${id}/variants`);
        const vSnap = await getDocs(vCols);
        const batch = writeBatch(db);
        
        // Delete current
        vSnap.docs.forEach(d => batch.delete(d.ref));
        
        // Add new
        variants.forEach(v => {
          const vRef = doc(vCols);
          const vData = { ...v };
          delete vData.id;
          batch.set(vRef, vData);
        });
        
        await batch.commit();
      }

      return id;
    } catch (error: any) {
      console.error("Error updating product:", error);
      throw error;
    }
  },

  async deleteProduct(id: string) {
    console.log(`[Diagnostic] Starting delete transition for product ID: ${id}`);
    try {
      const productRef = doc(db, 'products', id);
      const variantsCol = collection(db, `products/${id}/variants`);
      
      console.log(`[Diagnostic] Path 1: products/${id}`);
      console.log(`[Diagnostic] Path 2: products/${id}/variants`);

      // Step 1: List variants
      console.log(`[Diagnostic] Step 1: Attempting to list variants...`);
      let vSnap;
      try {
        vSnap = await getDocs(variantsCol);
        console.log(`[Diagnostic] Step 1 Success: Found ${vSnap.size} variants.`);
      } catch (e: any) {
        console.error(`[Diagnostic] Step 1 FAILED (List Variants): ${e.message}`, e);
        throw e;
      }

      const batch = writeBatch(db);
      
      // Step 2: Queue variant deletions
      console.log(`[Diagnostic] Step 2: Queuing deletion for ${vSnap.size} variants...`);
      vSnap.docs.forEach(d => {
        console.log(`[Diagnostic] Queuing delete for: products/${id}/variants/${d.id}`);
        batch.delete(d.ref);
      });

      // Step 3: Queue product deletion
      console.log(`[Diagnostic] Step 3: Queuing deletion for product: products/${id}`);
      batch.delete(productRef);
      
      // Step 4: Commit
      console.log(`[Diagnostic] Step 4: Committing batch...`);
      try {
        await batch.commit();
        console.log(`[Diagnostic] Step 4 Success: Batch committed.`);
      } catch (e: any) {
        console.error(`[Diagnostic] Step 4 FAILED (Batch Commit): ${e.message}`, e);
        throw e;
      }
    } catch (error: any) {
      console.error("[Diagnostic] Fatal error in deleteProduct:", error.message, error);
      throw error;
    }
  },

  async uploadImage(file: File): Promise<{ url: string; path: string }> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `products/${Date.now()}_${sanitizedName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { url, path };
  },

  async deleteImage(path: string) {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    } catch (error) {
      console.error("Error deleting image from storage:", error);
    }
  }
};
