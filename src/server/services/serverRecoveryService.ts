import { getAdminDb } from '../lib/firebaseAdmin';
import axios from 'axios';
import admin from 'firebase-admin';

export const serverRecoveryService = {
    /**
     * Main logic to run on the server.
     * Scans for expired pending carts using admin privileges.
     */
    async processAbandonedCarts() {
        const adminDb = getAdminDb();
        if (!adminDb) return;

        const now = admin.firestore.Timestamp.now();
        
        // 1. Check if system is active
        const settingsSnap = await adminDb.doc('settings/recovery').get();
        const settings = settingsSnap.exists ? settingsSnap.data() : null;
        if (!settings || !settings.active || !settings.webhookUrl) {
            return;
        }

        // 2. Fetch carts that should have been sent by now
        const cartsSnap = await adminDb.collection('abandoned_carts')
            .where('status', '==', 'pending')
            .where('expiresAt', '<=', now)
            .limit(20)
            .get();

        if (cartsSnap.empty) return;

        console.log(`[Recovery Job] Found ${cartsSnap.size} carts to process.`);

        for (const doc of cartsSnap.docs) {
            const session = doc.data();
            
            // Check if already ordered recently
            const alreadyOrdered = await this.checkIfAlreadyOrdered(session.phone);
            
            if (alreadyOrdered) {
                await doc.ref.update({ status: 'recovered', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                continue;
            }

            // Send webhook
            const success = await this.sendWebhook(settings.webhookUrl, session.name, session.phone);
            
            if (success) {
                await doc.ref.update({ 
                    status: 'webhook_sent', 
                    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
                });
            } else {
                // Update timestamp to avoid immediate retry loop
                await doc.ref.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        }
    },

    async markAsRecovered(phone: string) {
        const adminDb = getAdminDb();
        if (!adminDb) return;

        const cleanPhone = phone.replace(/\D/g, '');
        const sessionId = `RECOVERY_${cleanPhone}`;
        const ref = adminDb.collection('abandoned_carts').doc(sessionId);

        try {
            const snap = await ref.get();
            if (snap.exists) {
                await ref.update({
                    status: 'recovered',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (e) {
            console.error('Error marking as recovered on server:', e);
        }
    },

    async checkIfAlreadyOrdered(phone: string): Promise<boolean> {
        const adminDb = getAdminDb();
        if (!adminDb) return false;

        const cleanPhone = phone.replace(/\D/g, '');
        // Search orders (simple scan of last 10)
        const ordersSnap = await adminDb.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        return ordersSnap.docs.some(doc => {
            const data = doc.data();
            const oPhone = (data.customerWhatsapp || '').replace(/\D/g, '');
            return oPhone.includes(cleanPhone) || cleanPhone.includes(oPhone);
        });
    },

    async sendWebhook(webhookUrl: string, name: string, phone: string): Promise<boolean> {
        const adminDb = getAdminDb();
        if (!adminDb) return false;

        // Padronização simples no servidor
        let cleanPhone = phone.replace(/\D/g, '');
        while (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const payload = {
            nome: name,
            name: name,
            telefone: cleanPhone,
            phone: cleanPhone,
            whatsapp: cleanPhone,
            customer_name: name,
            customer_phone: cleanPhone,
            source: 'DiscretaBoutique_Recovery_Server'
        };

        try {
            const response = await axios.post(webhookUrl, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'DiscretaBoutique-Recovery-Server/1.0'
                }
            });

            const success = response.status >= 200 && response.status < 300;

            // Log recovery log
            await adminDb.collection('recovery_logs').add({
                customerName: name,
                customerPhone: cleanPhone,
                status: success ? 'success' : 'failure',
                responseStatus: response.status,
                attempts: 1,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookUrl: webhookUrl
            });

            return success;
        } catch (e: any) {
            console.error(`[Recovery Webhook Error]:`, e.message);
            // Log failure
            await adminDb.collection('recovery_logs').add({
                customerName: name,
                customerPhone: cleanPhone,
                status: 'failure',
                errorMessage: e.message,
                responseStatus: e.response?.status || 0,
                attempts: 1,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookUrl: webhookUrl
            });
            return false;
        }
    }
};
