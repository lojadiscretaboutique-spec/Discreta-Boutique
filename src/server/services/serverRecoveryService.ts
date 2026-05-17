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
            let webhookUrl = null;
            
            // Try new settings first
            const webhookSnap = await getDoc(doc(db, 'settings', 'webhooks'));
            if (webhookSnap.exists()) {
                const data = webhookSnap.data();
                if (data.recoveryActive && data.recoveryWebhookUrl) {
                    webhookUrl = data.recoveryWebhookUrl;
                }
            }

            // Fallback to legacy settings
            if (!webhookUrl) {
                const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
                const settings = settingsSnap.exists() ? settingsSnap.data() : null;
                if (settings && settings.active && settings.webhookUrl) {
                    webhookUrl = settings.webhookUrl;
                }
            }

            if (!webhookUrl) return;

            // 2. Fetch carts that should have been sent by now
            const q = query(
                collection(db, 'abandoned_carts'),
                where('status', '==', 'pending'),
                limit(100)
            );
            const snapshots = await getDocs(q);

            if (snapshots.empty) return;

            // Manual filter for expiresAt
            const cartsSnap = snapshots.docs
                .filter(doc => {
                    const data = doc.data();
                    if (!data.expiresAt) return false;
                    return (data.expiresAt as Timestamp).toMillis() <= now.toMillis();
                })
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
                const success = await this.sendWebhook(webhookUrl, session.name, session.phone, cartDoc.id);
                
                if (success) {
                    await updateDoc(cartDoc.ref, { 
                        status: 'webhook_sent', 
                        updatedAt: serverTimestamp() 
                    });
                } else {
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

    async sendWebhook(webhookUrl: string, name: string, phone: string, recoveryId?: string): Promise<boolean> {
        // Padronização simples no servidor
        let cleanPhone = phone.replace(/\D/g, '');
        while (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const payload = {
            Nome: name,
            Whatsapp: cleanPhone,
            pedido_id: recoveryId || 'N/A',
            source: 'DiscretaBoutique_Recovery_Notification'
        };

        try {
            const response = await axios.post(webhookUrl, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const success = response.status >= 200 && response.status < 300;

            // Log recovery log to unified collection
            await addDoc(collection(db, 'webhook_logs'), {
                orderId: recoveryId || 'recovery',
                customerName: name,
                customerWhatsapp: cleanPhone,
                status: 'RECUPERAÇÃO',
                payload: payload,
                response: {
                    status: response.status,
                    data: response.data
                },
                success: success,
                attempts: 1,
                timestamp: serverTimestamp(),
                type: 'recovery'
            });

            return success;
        } catch (e: any) {
            console.error(`[Recovery Webhook Error]:`, e.message);
            // Log failure
            try {
                await addDoc(collection(db, 'webhook_logs'), {
                    orderId: recoveryId || 'recovery',
                    customerName: name,
                    customerWhatsapp: cleanPhone,
                    status: 'RECUPERAÇÃO',
                    payload: payload,
                    error: e.message,
                    success: false,
                    attempts: 1,
                    timestamp: serverTimestamp(),
                    type: 'recovery'
                });
            } catch (logErr) {
                console.error("Failed to log recovery failure:", logErr);
            }
            return false;
        }
    }
}
