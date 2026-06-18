
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from "firebase/firestore";

export interface Subscriber {
  id?: string;
  name: string;
  email: string;
  status: 'active' | 'pending' | 'cancelled';
  createdAt: string;
  tags: string[];
}

export const newsletterService = {
  async subscribe(subscriber: Omit<Subscriber, 'id'>) {
    return await addDoc(collection(db, "newsletter_subscribers"), {
      ...subscriber,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  },
  
  async listSubscribers() {
    const snapshot = await getDocs(collection(db, "newsletter_subscribers"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber));
  }
};
