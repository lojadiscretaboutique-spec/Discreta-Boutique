import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PaymentIntent } from '../types';

const COLLECTION = 'payment_intents';

export const paymentIntentService = {
  async create(intent: Omit<PaymentIntent, 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION));
    const data = {
      ...intent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, data);
    return docRef.id;
  },

  async getById(id: string): Promise<PaymentIntent | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PaymentIntent;
  },

  async update(id: string, updates: Partial<PaymentIntent>): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
};
