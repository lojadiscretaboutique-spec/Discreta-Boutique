import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { abandonedCartWebhookService } from './abandonedCartWebhookService';

export interface AbandonedCartSession {
  id?: string;
  name: string;
  phone: string;
  cartId: string;
  status: 'pending' | 'recovered' | 'webhook_sent' | 'cancelled';
  expiresAt: any;
  createdAt: any;
  updatedAt: any;
}

export const abandonedCartService = {
  /**
   * Registers a potential abandoned cart. 
   * Usually called when the user fills name/phone in checkout/cart.
   */
  async monitorCartActivity(name: string, phone: string, cartId: string) {
    if (!name || !phone) return;
    
    // Standardize phone for ID uniqueness
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return;

    const sessionId = `RECOVERY_${cleanPhone}`;
    const ref = doc(db, 'abandoned_carts', sessionId);

    // 1. Check if already exists and is pending or recovered
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as AbandonedCartSession;
      
      // If already sent or recovered recently, implement cooldown (e.g., 24h)
      if (data.status === 'webhook_sent' || data.status === 'recovered') {
        const lastUpdate = data.updatedAt?.toDate();
        if (lastUpdate) {
          const hoursSinceLast = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLast < 24) {
            // Anti-spam: Do not recreate if handled in the last 24h
            return;
          }
        }
      }
      
      // If order was already generated for this cart, don't restart
      if (data.status === 'recovered') return;
    }

    // 2. Get settings for expiry time
    const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : { decayMinutes: 30 };
    const decayMinutes = settings.decayMinutes || 30;

    // 3. Create/Reset record
    const now = new Date();
    const expiresAt = new Date(now.getTime() + decayMinutes * 60 * 1000);

    const session: AbandonedCartSession = {
      name,
      phone,
      cartId,
      status: 'pending',
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, session, { merge: true });
  },

  /**
   * Called when an order is SUCCESSFUL.
   * Cancels any pending recovery for this user/phone.
   */
  async markAsRecovered(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const sessionId = `RECOVERY_${cleanPhone}`;
    const ref = doc(db, 'abandoned_carts', sessionId);

    try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await updateDoc(ref, {
                status: 'recovered',
                updatedAt: serverTimestamp()
            });
        }
    } catch (e) {
        console.error('Error marking as recovered:', e);
    }
  },

  /**
   * Main logic to run on the server.
   * Scans for expired pending carts.
   */
  async processAbandonedCarts() {
    const now = Timestamp.now();
    
    // 1. Check if system is active
    const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : null;
    if (!settings || !settings.active) return;

    // 2. Fetch carts that should have been sent by now
    const q = query(
      collection(db, 'abandoned_carts'),
      where('status', '==', 'pending'),
      where('expiresAt', '<=', now),
      limit(20) // Batch process
    );

    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      const session = { id: d.id, ...d.data() } as AbandonedCartSession;
      
      // Eligibility check: double check if an order was created recently by this phone
      // to avoid race conditions if markAsRecovered failed or hasn't run yet.
      const alreadyOrdered = await this.checkIfAlreadyOrdered(session.phone);
      
      if (alreadyOrdered) {
        await updateDoc(d.ref, { status: 'recovered', updatedAt: serverTimestamp() });
        continue;
      }

      // Send the webhook
      const success = await abandonedCartWebhookService.sendRecoveryWebhook(session.name, session.phone);
      
      if (success) {
        await updateDoc(d.ref, { 
          status: 'webhook_sent', 
          updatedAt: serverTimestamp() 
        });
      } else {
        // Retry logic is simple: it stays 'pending' and will be caught again
        // but we should avoid infinite loops if it constantly fails.
        // For simplicity here, we add a field "attempts" if we want, 
        // but for now let's just update updatedAt to avoid immediate re-run if it failed.
        await updateDoc(d.ref, { updatedAt: serverTimestamp() });
      }
    }
  },

  async checkIfAlreadyOrdered(phone: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    // Search orders in the last hour for this phone or parts of it
    // Note: This is an extra safety layer.
    const ordersQ = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(5)
    );
    const snap = await getDocs(ordersQ);
    return snap.docs.some(doc => {
        const data = doc.data();
        if (!data.customer) return false;
        const oPhone = (data.customer.whatsapp || '').replace(/\D/g, '');
        return oPhone.includes(cleanPhone) || cleanPhone.includes(oPhone);
    });
  }
};
