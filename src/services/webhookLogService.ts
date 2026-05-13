import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface WebhookLog {
  id?: string;
  orderId: string;
  customerName: string;
  customerWhatsapp: string;
  status: string;
  payload: any;
  response?: any;
  error?: string;
  attempts: number;
  success: boolean;
  timestamp: any;
}

export const webhookLogService = {
  async log(data: Omit<WebhookLog, 'timestamp'>) {
    try {
      await addDoc(collection(db, 'webhook_logs'), {
        ...data,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao salvar log do webhook:", error);
    }
  },

  async getRecentLogs(count = 50) {
    const q = query(
      collection(db, 'webhook_logs'),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WebhookLog));
  }
};
