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

export interface Promotion {
  id?: string;
  name: string;
  active: boolean;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number; // For percentage or fixed cash discount
  scope: 'all' | 'categories' | 'products';
  targetIds?: string[]; // IDs of categories or products
  startDate?: string;
  endDate?: string;
  minPurchaseAmount?: number;
  priority: number; // To handle conflicting promotions
  createdAt?: any;
  updatedAt?: any;
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
    return docRef.id;
  },

  async update(id: string, data: Partial<Promotion>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
