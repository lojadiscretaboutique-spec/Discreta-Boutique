import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Coupon {
  id: string; // The code itself (e.g. BORA10). We can use code as document ID for easy lookup.
  code: string;
  type: 'percentage' | 'fixed';
  value: number; // percentage value (e.g. 10 for 10%) or fixed value in cents (but let's use standard decimals like other prices)
  minPurchaseAmount?: number;
  maxUses?: number;
  usageLimitPerCustomer?: number;
  uses: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
  allowedPaymentMethods?: string[];
}

export const couponService = {
  async getCoupons(): Promise<Coupon[]> {
    const q = query(collection(db, 'coupons'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
  },

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const formattedCode = code.toUpperCase().trim();
    if (!formattedCode) return null;
    
    const docRef = doc(db, 'coupons', formattedCode);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Coupon;
    }
    return null;
  },

  async saveCoupon(coupon: Omit<Coupon, 'id'> & { id?: string }): Promise<void> {
    const code = coupon.code.toUpperCase().trim();
    const docRef = doc(db, 'coupons', code);
    
    await setDoc(docRef, {
      ...coupon,
      code,
      id: code, // keep it inside the document too
      uses: coupon.uses || 0
    }, { merge: true });
  },

  async deleteCoupon(id: string): Promise<void> {
    await deleteDoc(doc(db, 'coupons', id));
  },
  
  async recordCouponUse(code: string): Promise<void> {
     const docRef = doc(db, 'coupons', code.toUpperCase().trim());
     const snap = await getDoc(docRef);
     if (snap.exists()) {
        const data = snap.data();
        await updateDoc(docRef, {
           uses: (data.uses || 0) + 1
        });
     }
  }
};
