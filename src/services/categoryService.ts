import { 
  serverTimestamp, 
  collection, 
  doc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  addDoc,
  deleteDoc,
  where,
  FieldValue
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface Category {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  parentId: string | null; // null for root categories
  level: number; // 0 for root, 1 for subcat, etc.
  image?: { url: string; path: string };
  icon?: string;
  color?: string;
  banner?: { url: string; path: string };
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  showInMenu: boolean;
  showInHome: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  defaultCommission?: number;
  extraFee?: number;
  internalNotes?: string;
  productCount: number;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

export const categoryService = {
  async listCategories() {
    try {
      // 1. Fetch categories
      const q = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
      const catSnap = await getDocs(q);
      const categories = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      
      // 2. Fetch all products to count them (efficient for small/medium databases)
      // This avoids N queries for N categories
      const prodSnap = await getDocs(collection(db, 'products'));
      const products = prodSnap.docs.map(doc => doc.data());
      
      // 3. Map counts
      const counts: Record<string, number> = {};
      products.forEach(p => {
        if (p.categoryId) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      });

      const categoriesWithCount = categories.map(cat => ({
        ...cat,
        productCount: counts[cat.id] || 0
      }));

      // 4. Return sorted
      return categoriesWithCount.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
    } catch (error: unknown) {
      console.error("Error listing categories:", error);
      return [];
    }
  },

  async getCategory(id: string) {
    try {
      const docRef = doc(db, 'categories', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Category;
      }
      return null;
    } catch (error: unknown) {
      console.error("Error getting category:", error);
      const err = error as { code?: string };
      if (err?.code === 'permission-denied') {
        throw new Error("Permissão negada ao acessar categoria.");
      }
      throw error;
    }
  },

  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'productCount'>) {
    try {
      const data: any = {
        productCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const allowedFields = [
        'name', 'slug', 'shortDescription', 'description', 'parentId', 
        'level', 'image', 'icon', 'color', 'banner', 'sortOrder', 
        'isActive', 'isFeatured', 'showInMenu', 'showInHome', 
        'seoTitle', 'seoDescription', 'seoKeywords', 
        'defaultCommission', 'extraFee', 'internalNotes'
      ];

      allowedFields.forEach(field => {
        const val = (category as any)[field];
        if (val !== undefined) {
          data[field] = val;
        }
      });

      const docRef = await addDoc(collection(db, 'categories'), data);
      return docRef.id;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  async updateCategory(id: string, category: Partial<Category>) {
    try {
      const docRef = doc(db, 'categories', id);
      
      // Criar payload limpo com apenas campos permitidos
      const updateData: any = {};
      const allowedFields = [
        'name', 'slug', 'shortDescription', 'description', 'parentId', 
        'level', 'image', 'icon', 'color', 'banner', 'sortOrder', 
        'isActive', 'isFeatured', 'showInMenu', 'showInHome', 
        'seoTitle', 'seoDescription', 'seoKeywords', 
        'defaultCommission', 'extraFee', 'internalNotes'
      ];

      allowedFields.forEach(field => {
        const val = (category as any)[field];
        if (val !== undefined) {
          updateData[field] = val;
        }
      });

      updateData.updatedAt = serverTimestamp();

      await updateDoc(docRef, updateData);
      return id;
    } catch (error: any) {
      console.error("Error updating category:", error);
      throw error;
    }
  },

  async deleteCategory(id: string) {
    try {
      // Check for subcategories
      const qSub = query(collection(db, 'categories'), where('parentId', '==', id));
      const subSnap = await getDocs(qSub);
      if (!subSnap.empty) {
        throw new Error("Esta categoria possui subcategorias. Remova-as ou mova-as antes de excluir.");
      }

      // Check for products
      const qProd = query(collection(db, 'products'), where('categoryId', '==', id));
      const prodSnap = await getDocs(qProd);
      if (!prodSnap.empty) {
        throw new Error("Esta categoria possui produtos vinculados. Remova os vínculos antes de excluir.");
      }

      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },

  async duplicateCategory(id: string) {
    try {
      const original = await this.getCategory(id);
      if (!original) throw new Error("Categoria não encontrada.");

      const data: any = {
        name: `${original.name} (Cópia)`,
        slug: `${original.slug}-${Date.now()}`,
        productCount: 0,
        isActive: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const fieldsToCopy = [
        'shortDescription', 'description', 'parentId', 'level', 
        'image', 'icon', 'color', 'banner', 'sortOrder', 
        'isFeatured', 'showInMenu', 'showInHome', 
        'seoTitle', 'seoDescription', 'seoKeywords', 
        'defaultCommission', 'extraFee', 'internalNotes'
      ];

      fieldsToCopy.forEach(field => {
        const val = (original as any)[field];
        if (val !== undefined) {
          data[field] = val;
        }
      });

      const docRef = await addDoc(collection(db, 'categories'), data);
      return docRef.id;
    } catch (error) {
      console.error("Error duplicating category:", error);
      throw error;
    }
  },

  async uploadImage(file: File): Promise<{ url: string; path: string }> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `categories/${Date.now()}_${sanitizedName}`;
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
      console.error("Error deleting category image:", error);
    }
  }
};
