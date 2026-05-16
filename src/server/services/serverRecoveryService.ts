import { db } from '../../lib/firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    limit, 
    doc, 
    updateDoc, 
    getDoc, 
    addDoc, 
    serverTimestamp, 
    orderBy,
    Timestamp 
} from 'firebase/firestore';
import axios from 'axios';

export const serverRecoveryService = {
    /**
     * Main logic to run on the server.
     * Scans for expired pending carts using client SDK with public permissions.
     */
    async processAbandonedCarts() {
        const now = Timestamp.now();
        
        // 1. Check if system is active
        try {
            const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
            const settings = settingsSnap.exists() ? settingsSnap.data() : null;
            if (!settings || !settings.active || !settings.webhookUrl) {
                return;
            }

            // 2. Fetch carts that should have been sent by now
            const q = query(
                collection(db, 'abandoned_carts'),
                where('status', '==', 'pending'),
                limit(100)
            );
            const snapshots = await getDocs(q);

            if (snapshots.empty) return;

            // Manual filter for expiresAt to avoid composite index requirement
            const cartsSnap = snapshots.docs
                .filter(doc => (doc.data().expiresAt as Timestamp).toMillis() <= now.toMillis())
                .slice(0, 20);

            if (cartsSnap.length === 0) return;

            console.log(`[Recovery Job] Found ${cartsSnap.length} carts to process.`);

            for (const cartDoc of cartsSnap) {
                const session = cartDoc.data();
                
                // Check if already ordered recently
                const alreadyOrdered = await this.checkIfAlreadyOrdered(session.phone);
                
                if (alreadyOrdered) {
                    await updateDoc(cartDoc.ref, { status: 'recovered', updatedAt: serverTimestamp() });
                    continue;
                }

                // Send webhook
                const success = await this.sendWebhook(settings.webhookUrl, session.name, session.phone);
                
                if (success) {
                    await updateDoc(cartDoc.ref, { 
                        status: 'webhook_sent', 
                        updatedAt: serverTimestamp() 
                    });
                } else {
                    // Update timestamp to avoid immediate retry loop
                    await updateDoc(cartDoc.ref, { updatedAt: serverTimestamp() });
                }
            }
        } catch (error) {
            console.error("[Recovery Job Error]:", error);
        }
    },

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
            console.error('Error marking as recovered on server:', e);
        }
    },

    async checkIfAlreadyOrdered(phone: string): Promise<boolean> {
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            // Search orders (simple scan of last 10)
            const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
            const ordersSnap = await getDocs(q);

            return ordersSnap.docs.some(doc => {
                const data = doc.data();
                const oPhone = (data.customerWhatsapp || '').replace(/\D/g, '');
                return oPhone.includes(cleanPhone) || cleanPhone.includes(oPhone);
            });
        } catch (e) {
            console.error("Error checking orders:", e);
            return false;
        }
    },

    async sendWebhook(webhookUrl: string, name: string, phone: string): Promise<boolean> {
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
            await addDoc(collection(db, 'recovery_logs'), {
                customerName: name,
                customerPhone: cleanPhone,
                status: success ? 'success' : 'failure',
                responseStatus: response.status,
                attempts: 1,
                sentAt: serverTimestamp(),
                webhookUrl: webhookUrl
            });

            return success;
        } catch (e: any) {
            console.error(`[Recovery Webhook Error]:`, e.message);
            // Log failure
            try {
                await addDoc(collection(db, 'recovery_logs'), {
                    customerName: name,
                    customerPhone: cleanPhone,
                    status: 'failure',
                    errorMessage: e.message,
                    responseStatus: e.response?.status || 0,
                    attempts: 1,
                    sentAt: serverTimestamp(),
                    webhookUrl: webhookUrl
                });
            } catch (logErr) {
                console.error("Failed to log recovery failure:", logErr);
            }
            return false;
        }
    }
};
