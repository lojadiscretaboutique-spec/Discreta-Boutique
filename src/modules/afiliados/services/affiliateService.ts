import { db } from '../../../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  increment, 
  serverTimestamp, 
  orderBy,
  Timestamp
} from 'firebase/firestore';

export interface Affiliate {
  id: string; // The affiliate's chosen slug (unique, e.g., 'larissa')
  uid: string; // Firebase Auth UID
  name: string;
  email: string;
  whatsapp: string;
  pixKey: string;
  pixType: string;
  status: 'pending' | 'approved' | 'rejected';
  commissionRate?: number; // Custom rate (e.g., 15 for 15%). If empty, global rate is used.
  clicks: number;
  createdAt: any;
  updatedAt: any;
}

export interface Commission {
  orderId: string;
  orderShortId: string;
  customerName: string;
  orderTotal: number;
  orderDate: Date;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  commissionValue: number;
  commissionRate: number;
  orderStatus: string;
}

export interface AffiliateSettings {
  defaultCommissionRate: number; // e.g. 10 for 10%
  minimumPayoutAmount: number;   // e.g. 50 BRL
  termsText: string;
  active: boolean;
}

const DEFAULT_SETTINGS: AffiliateSettings = {
  defaultCommissionRate: 10,
  minimumPayoutAmount: 50,
  termsText: 'Divulgue nossos lingeries e produtos eróticos e receba comissão sobre cada venda efetuada através do seu link exclusivo!',
  active: true
};

export const affiliateService = {
  // --- SETTINGS ---
  async getSettings(): Promise<AffiliateSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'affiliates'));
      if (snap.exists()) {
        return { ...DEFAULT_SETTINGS, ...snap.data() } as AffiliateSettings;
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Erro ao carregar configurações de afiliados:", e);
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(settings: Partial<AffiliateSettings>): Promise<void> {
    await setDoc(doc(db, 'settings', 'affiliates'), settings, { merge: true });
  },

  // --- REGISTRATION & GETTERS ---
  async isSlugAvailable(slug: string): Promise<boolean> {
    const formattedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!formattedSlug) return false;
    const snap = await getDoc(doc(db, 'affiliates', formattedSlug));
    return !snap.exists();
  },

  async registerAffiliate(data: {
    id: string;
    uid: string;
    name: string;
    email: string;
    whatsapp: string;
    pixKey: string;
    pixType: string;
  }): Promise<void> {
    const slug = data.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const isAvail = await this.isSlugAvailable(slug);
    if (!isAvail) {
      throw new Error('Este código de afiliado já está em uso por outro membro.');
    }

    const payload: Affiliate = {
      id: slug,
      uid: data.uid,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      whatsapp: data.whatsapp.replace(/\D/g, ''),
      pixKey: data.pixKey.trim(),
      pixType: data.pixType,
      status: 'pending',
      clicks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'affiliates', slug), payload);
  },

  async getAffiliateByUid(uid: string): Promise<Affiliate | null> {
    const q = query(collection(db, 'affiliates'), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Affiliate;
  },

  async getAffiliateById(id: string): Promise<Affiliate | null> {
    const cleaned = id.trim().toLowerCase();
    const snap = await getDoc(doc(db, 'affiliates', cleaned));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Affiliate;
  },

  // --- TRAFFIC ---
  async trackClick(affiliateId: string): Promise<void> {
    try {
      const slug = affiliateId.trim().toLowerCase();
      // Check in sessionStorage if click was already tracked for this affiliate in this session
      const sessionKey = `discreta_click_${slug}`;
      if (sessionStorage.getItem(sessionKey)) {
        return; // Already tracked on this session
      }

      const affDoc = await getDoc(doc(db, 'affiliates', slug));
      if (affDoc.exists()) {
        await updateDoc(doc(db, 'affiliates', slug), {
          clicks: increment(1)
        });
        sessionStorage.setItem(sessionKey, 'true');
        console.log(`📈 Click tracked for affiliate: ${slug}`);
      }
    } catch (e) {
      console.error("Erro ao registrar clique de afiliado:", e);
    }
  },

  // --- COMMISSIONS & HISTORY FOR A SPECIFIC AFFILIATE ---
  async getCommissionsAndOrders(affiliate: Affiliate, globalRate: number): Promise<Commission[]> {
    const q = query(
      collection(db, 'orders'),
      where('refAffiliate', '==', affiliate.id)
    );
    const snap = await getDocs(q);
    
    const results = snap.docs.map(docSnap => {
      const data = docSnap.data();
      const orderShortId = docSnap.id.slice(-6).toUpperCase();
      const orderTotal = data.total || 0;
      
      const rate = affiliate.commissionRate !== undefined && affiliate.commissionRate !== null 
        ? affiliate.commissionRate 
        : globalRate;
        
      const commissionValue = parseFloat(((orderTotal * rate) / 100).toFixed(2));
      
      // Determine commission status based on order status and payment flag
      let commissionStatus: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' = 'PENDING';
      
      const orderStatusUpper = (data.status || 'NOVO').toUpperCase();
      
      if (orderStatusUpper === 'CANCELADO') {
        commissionStatus = 'CANCELLED';
      } else if (orderStatusUpper === 'ENTREGUE') {
        if (data.affiliateCommissionPaid === true) {
          commissionStatus = 'PAID';
        } else {
          commissionStatus = 'APPROVED';
        }
      } else {
        commissionStatus = 'PENDING';
      }

      // Convert Timestamp to Date
      let orderDate = new Date();
      if (data.createdAt) {
        orderDate = (data.createdAt as Timestamp).toDate();
      }

      return {
        orderId: docSnap.id,
        orderShortId,
        customerName: data.customerName || 'Cliente',
        orderTotal,
        orderDate,
        status: commissionStatus,
        commissionValue,
        commissionRate: rate,
        orderStatus: orderStatusUpper
      };
    });

    // Sort by orderDate descending
    return results.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
  },

  // --- ADMIN FUNCTIONS ---
  async getAllAffiliates(): Promise<Affiliate[]> {
    const snap = await getDocs(query(collection(db, 'affiliates'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Affiliate));
  },

  async updateAffiliateStatus(id: string, status: 'approved' | 'rejected' | 'pending'): Promise<void> {
    await updateDoc(doc(db, 'affiliates', id), {
      status,
      updatedAt: serverTimestamp()
    });
  },

  async updateAffiliateRate(id: string, rate: number | null): Promise<void> {
    await updateDoc(doc(db, 'affiliates', id), {
      commissionRate: rate === null ? null : rate,
      updatedAt: serverTimestamp()
    });
  },

  async getAdminCommissionsReport(globalRate: number): Promise<Commission & { affiliateId: string, affiliateName: string }[]> {
    // We get all orders that have refAffiliate
    const q = query(
      collection(db, 'orders'),
      where('refAffiliate', '!=', null)
    );
    const [ordersSnap, affiliatesSnap] = await Promise.all([
      getDocs(q),
      getDocs(collection(db, 'affiliates'))
    ]);

    const affiliatesMap = new Map<string, Affiliate>();
    affiliatesSnap.docs.forEach(docSnap => {
      affiliatesMap.set(docSnap.id, docSnap.data() as Affiliate);
    });

    const list: any[] = [];
    
    ordersSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const refAff = (data.refAffiliate || '').trim().toLowerCase();
      if (!refAff || !affiliatesMap.has(refAff)) return;

      const aff = affiliatesMap.get(refAff)!;
      const rate = aff.commissionRate !== undefined && aff.commissionRate !== null 
        ? aff.commissionRate 
        : globalRate;
        
      const orderTotal = data.total || 0;
      const commissionValue = parseFloat(((orderTotal * rate) / 100).toFixed(2));
      
      let commissionStatus: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' = 'PENDING';
      const orderStatusUpper = (data.status || 'NOVO').toUpperCase();
      
      if (orderStatusUpper === 'CANCELADO') {
        commissionStatus = 'CANCELLED';
      } else if (orderStatusUpper === 'ENTREGUE') {
        if (data.affiliateCommissionPaid === true) {
          commissionStatus = 'PAID';
        } else {
          commissionStatus = 'APPROVED';
        }
      } else {
        commissionStatus = 'PENDING';
      }

      let orderDate = new Date();
      if (data.createdAt) {
        orderDate = (data.createdAt as Timestamp).toDate();
      }

      list.push({
        orderId: docSnap.id,
        orderShortId: docSnap.id.slice(-6).toUpperCase(),
        customerName: data.customerName || 'Cliente',
        orderTotal,
        orderDate,
        status: commissionStatus,
        commissionValue,
        commissionRate: rate,
        orderStatus: orderStatusUpper,
        affiliateId: refAff,
        affiliateName: aff.name,
        affiliatePix: `${aff.pixType}: ${aff.pixKey}`,
        affiliateWhatsapp: aff.whatsapp
      });
    });

    // Sort by date descending
    return list.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
  },

  async markCommissionsAsPaid(orderIds: string[]): Promise<void> {
    const promises = orderIds.map(orderId => 
      updateDoc(doc(db, 'orders', orderId), {
        affiliateCommissionPaid: true,
        updatedAt: serverTimestamp()
      })
    );
    await Promise.all(promises);
  }
};
