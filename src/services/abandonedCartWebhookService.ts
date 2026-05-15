import axios from 'axios';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export interface RecoveryLog {
  id?: string;
  customerName: string;
  customerPhone: string;
  status: 'success' | 'failure';
  responseStatus?: number;
  errorMessage?: string;
  attempts: number;
  sentAt: any;
  webhookUrl: string;
}

export const abandonedCartWebhookService = {
  /**
   * Standardizes phone to DDI (55) + digits only.
   * If start with 0, removes it. 
   * If doesn't have 55, adds it.
   */
  standardizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, ''); // Digits only
    
    // Remove leading zeros
    while (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (cleaned.length === 0) return '';

    // Add 55 (Brazil) if it seems to be a domestic number without DDI
    // BR numbers are usually 10-11 digits (DDD + number)
    if (cleaned.length >= 10 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  },

  async sendRecoveryWebhook(name: string, phone: string): Promise<boolean> {
    try {
      // 1. Get Settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;

      if (!settings || !settings.webhookUrl || !settings.active) {
        console.warn('⚠️ Abandoned Cart Webhook not configured or inactive.');
        return false;
      }

      const standardizedPhone = this.standardizePhone(phone);
      if (!standardizedPhone) {
        throw new Error('Telefone inválido após padronização.');
      }

      // 2. Prepare Payload (MINIMAL & DISCREET)
      // Including multiple variants of names to increase compatibility with Bot Conversa
      const payload = {
        nome: name,
        name: name,
        telefone: standardizedPhone,
        phone: standardizedPhone,
        whatsapp: standardizedPhone,
        customer_name: name,
        customer_phone: standardizedPhone,
        source: 'DiscretaBoutique_Recovery'
      };

      // 3. Send Webhook
      let success = false;
      let errorMsg = '';
      let resStatus = 0;

      try {
        const response = await axios.post(settings.webhookUrl, payload, {
          timeout: 15000, // 15s timeout
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'DiscretaBoutique-Recovery/1.0'
          }
        });
        success = response.status >= 200 && response.status < 300;
        resStatus = response.status;
      } catch (e: any) {
        success = false;
        errorMsg = e.message || 'Erro desconhecido no webhook';
        resStatus = e.response?.status || 0;
      }

      // 4. Log the result
      await addDoc(collection(db, 'recovery_logs'), {
        customerName: name,
        customerPhone: standardizedPhone,
        status: success ? 'success' : 'failure',
        responseStatus: resStatus,
        errorMessage: errorMsg,
        attempts: 1,
        sentAt: serverTimestamp(),
        webhookUrl: settings.webhookUrl || ''
      });

      return success;
    } catch (error: any) {
      console.error('❌ Error sending recovery webhook:', error);
      return false;
    }
  }
};
