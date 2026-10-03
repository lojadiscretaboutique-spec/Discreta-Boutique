import { 
  collection, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { RaffleCampaign, RaffleTicket } from '../types/raffle';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Raffle Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CAMPAIGNS_COLLECTION = 'raffleCampaigns';
const TICKETS_COLLECTION = 'raffleTickets';

export const raffleService = {
  // Listen to all campaigns in real time
  subscribeCampaigns(callback: (campaigns: RaffleCampaign[]) => void, onError?: (err: Error) => void) {
    const q = query(collection(db, CAMPAIGNS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const list: RaffleCampaign[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || '',
          prize: data.prize || '',
          rules: data.rules || '',
          type: data.type || 'EVERY_X_AMOUNT',
          amountPerTicket: typeof data.amountPerTicket === 'number' ? data.amountPerTicket : 50,
          minPurchaseValue: typeof data.minPurchaseValue === 'number' ? data.minPurchaseValue : 0,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          drawDate: data.drawDate || '',
          active: data.active ?? true,
          autoPrint: data.autoPrint ?? true,
          ticketsIssuedCount: data.ticketsIssuedCount || 0,
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        });
      });

      // Sort by creation or start date descending
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(list);
    }, (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, CAMPAIGNS_COLLECTION);
    });
  },

  // Fetch all campaigns once
  async getCampaigns(): Promise<RaffleCampaign[]> {
    try {
      const q = query(collection(db, CAMPAIGNS_COLLECTION));
      const snap = await getDocs(q);
      const list: RaffleCampaign[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || '',
          prize: data.prize || '',
          rules: data.rules || '',
          type: data.type || 'EVERY_X_AMOUNT',
          amountPerTicket: typeof data.amountPerTicket === 'number' ? data.amountPerTicket : 50,
          minPurchaseValue: typeof data.minPurchaseValue === 'number' ? data.minPurchaseValue : 0,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          drawDate: data.drawDate || '',
          active: data.active ?? true,
          autoPrint: data.autoPrint ?? true,
          ticketsIssuedCount: data.ticketsIssuedCount || 0,
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, CAMPAIGNS_COLLECTION);
    }
  },

  // Create a new raffle campaign
  async createCampaign(campaign: Omit<RaffleCampaign, 'id' | 'createdAt' | 'updatedAt' | 'ticketsIssuedCount'>): Promise<string> {
    try {
      const colRef = collection(db, CAMPAIGNS_COLLECTION);
      const docRef = await addDoc(colRef, {
        ...campaign,
        ticketsIssuedCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, CAMPAIGNS_COLLECTION);
    }
  },

  // Update campaign
  async updateCampaign(id: string, updates: Partial<RaffleCampaign>): Promise<void> {
    try {
      const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${CAMPAIGNS_COLLECTION}/${id}`);
    }
  },

  // Delete campaign
  async deleteCampaign(id: string): Promise<void> {
    try {
      const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${CAMPAIGNS_COLLECTION}/${id}`);
    }
  },

  // Get active campaigns valid for the given date (default today)
  async getActiveCampaigns(checkDate: Date = new Date()): Promise<RaffleCampaign[]> {
    const campaigns = await this.getCampaigns();
    const todayStr = checkDate.toISOString().split('T')[0];

    return campaigns.filter(c => {
      if (!c.active) return false;
      if (c.startDate && c.startDate > todayStr) return false;
      if (c.endDate && c.endDate < todayStr) return false;
      return true;
    });
  },

  // Generate raffle tickets for an order
  async processSaleRaffle(sale: {
    orderId: string;
    total: number;
    customerName?: string;
    customerWhatsapp?: string;
    createdAt?: Date | string;
  }): Promise<{
    tickets: RaffleTicket[];
    campaigns: RaffleCampaign[];
    shouldAutoPrint: boolean;
  }> {
    const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
    const activeCampaigns = await this.getActiveCampaigns(saleDate);

    if (activeCampaigns.length === 0) {
      return { tickets: [], campaigns: [], shouldAutoPrint: false };
    }

    const allGeneratedTickets: RaffleTicket[] = [];
    let shouldAutoPrint = false;

    const formattedOrderDate = saleDate.toLocaleDateString('pt-BR') + ' ' + 
      saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    for (const campaign of activeCampaigns) {
      let count = 0;

      if (campaign.type === 'EVERY_X_AMOUNT') {
        const threshold = campaign.amountPerTicket && campaign.amountPerTicket > 0 ? campaign.amountPerTicket : 50;
        count = Math.floor(sale.total / threshold);
      } else if (campaign.type === 'ANY_PURCHASE') {
        const minVal = campaign.minPurchaseValue || 0;
        count = sale.total >= minVal ? 1 : 0;
      }

      if (count <= 0) continue;

      if (campaign.autoPrint) {
        shouldAutoPrint = true;
      }

      const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaign.id);
      
      // Obtain latest ticket sequence using transaction or increment
      let startNumber = (campaign.ticketsIssuedCount || 0) + 1;
      try {
        await updateDoc(campaignDocRef, {
          ticketsIssuedCount: increment(count),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not increment ticketsIssuedCount atomically:', err);
      }

      for (let i = 1; i <= count; i++) {
        const ticketSeq = startNumber + (i - 1);
        const ticketCode = `SRT-${String(ticketSeq).padStart(6, '0')}`;

        const ticketData: Omit<RaffleTicket, 'id'> = {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          prize: campaign.prize,
          rules: campaign.rules,
          ticketNumber: ticketSeq,
          ticketCode,
          orderId: sale.orderId,
          orderTotal: sale.total,
          orderDate: formattedOrderDate,
          ticketIndexInSale: i,
          ticketsTotalInSale: count,
          customerName: sale.customerName || '',
          customerWhatsapp: sale.customerWhatsapp || '',
          drawDate: campaign.drawDate || campaign.endDate || '',
          createdAt: new Date().toISOString(),
        };

        try {
          const tDoc = await addDoc(collection(db, TICKETS_COLLECTION), ticketData);
          allGeneratedTickets.push({
            id: tDoc.id,
            ...ticketData,
          });
        } catch (ticketErr) {
          console.error('Error saving ticket to Firestore:', ticketErr);
          // Still add to in-memory tickets so printing succeeds even on connection hitch
          allGeneratedTickets.push({
            id: `temp-${Date.now()}-${i}`,
            ...ticketData,
          });
        }
      }
    }

    return {
      tickets: allGeneratedTickets,
      campaigns: activeCampaigns,
      shouldAutoPrint,
    };
  },

  // Query tickets (with optional campaign filter)
  async getTickets(campaignId?: string): Promise<RaffleTicket[]> {
    try {
      let q = query(collection(db, TICKETS_COLLECTION));
      if (campaignId) {
        q = query(collection(db, TICKETS_COLLECTION), where('campaignId', '==', campaignId));
      }
      const snap = await getDocs(q);
      const list: RaffleTicket[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          campaignId: data.campaignId || '',
          campaignTitle: data.campaignTitle || '',
          prize: data.prize || '',
          rules: data.rules || '',
          ticketNumber: data.ticketNumber || 0,
          ticketCode: data.ticketCode || '',
          orderId: data.orderId || '',
          orderTotal: data.orderTotal || 0,
          orderDate: data.orderDate || '',
          ticketIndexInSale: data.ticketIndexInSale || 1,
          ticketsTotalInSale: data.ticketsTotalInSale || 1,
          customerName: data.customerName || '',
          customerWhatsapp: data.customerWhatsapp || '',
          drawDate: data.drawDate || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
        });
      });
      list.sort((a, b) => (b.ticketNumber || 0) - (a.ticketNumber || 0));
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, TICKETS_COLLECTION);
    }
  }
};
