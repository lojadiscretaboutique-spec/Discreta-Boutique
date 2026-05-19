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

  async sendImmediateCartWebhook(name: string, phone: string, cartItems: any[]): Promise<boolean> {
    try {
      if (!cartItems || cartItems.length === 0) return false;

      // Check settings/webhooks first
      let webhookUrl = '';
      const hooksSnap = await getDoc(doc(db, 'settings', 'webhooks'));
      if (hooksSnap.exists()) {
        webhookUrl = hooksSnap.data().recoveryWebhookUrl;
      }
      if (!webhookUrl) {
         // Fallback to settings/recovery
         const recSnap = await getDoc(doc(db, 'settings', 'recovery'));
         if (recSnap.exists()) {
            webhookUrl = recSnap.data().webhookUrl;
         }
      }

      if (!webhookUrl) {
         console.warn('Webhook de recuperação não configurado.');
         return false;
      }

      const standardizedPhone = this.standardizePhone(phone);
      if (!standardizedPhone) return false;

      // Generate a short ID
      const shortId = 'CART-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const payload = {
        nome: name,
        whatsapp: standardizedPhone,
        pedido_id_curto: shortId,
        items_count: cartItems.length,
        source: 'DiscretaBoutique_ImmediateCart'
      };

      let success = false;
      let resStatus = 0;
      let errorMsg = '';

      try {
        const response = await axios.post(webhookUrl, payload, { timeout: 10000 });
        success = response.status >= 200 && response.status < 300;
        resStatus = response.status;
      } catch (e: any) {
        success = false;
        resStatus = e.response?.status || 0;
        errorMsg = e.message || 'Erro no webhook';
      }

      await addDoc(collection(db, 'webhook_logs'), {
        customerName: name,
        customerWhatsapp: standardizedPhone,
        status: 'RECUPERAÇÃO_IMEDIATA',
        payload: payload,
        response: resStatus ? { status: resStatus } : null,
        error: errorMsg,
        attempts: 1,
        success: success,
        timestamp: serverTimestamp(),
        type: 'recovery',
        orderId: shortId
      });

      return success;
    } catch (err) {
      console.error('sendImmediateCartWebhook error:', err);
      return false;
    }
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
