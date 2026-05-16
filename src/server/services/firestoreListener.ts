import { db } from '../../lib/firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    Timestamp 
} from 'firebase/firestore';
import { sendWebhook } from './botConversaService';

export function setupOrderListener() {
    console.log("[FirestoreListener] Iniciando listener de pedidos (Client SDK)...");
    
    onSnapshot(collection(db, 'orders'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const orderData = change.doc.data();
            const order = { 
                id: change.doc.id, 
                telefone: orderData.customerWhatsapp, 
                nome: orderData.customerName, 
                ...orderData 
            } as any;
            
            if (change.type === 'added' || change.type === 'modified') {
                // Prevent duplicate submission by verifying last sent
                if (orderData.last_status_sent === orderData.status) {
                    return;
                }

                // If added, ignore old orders to avoid flooding when the server restarts
                if (change.type === 'added') {
                    const createdAt = orderData.createdAt;
                    if (createdAt) {
                        const createdTime = (createdAt as Timestamp).toMillis();
                        const now = Date.now();
                        if (now - createdTime > 1000 * 60 * 5) { // Older than 5 minutes
                            // Mark as sent silently without triggering webhook
                            await updateDoc(change.doc.ref, {
                                last_status_sent: orderData.status
                            });
                            return;
                        }
                    }
                }

                console.log(`[FirestoreListener] Processando evento de pedido para botconversa (Client SDK): ${order.id} - Status: ${order.status}`);
                try {
                   await new Promise(resolve => setTimeout(resolve, 2000));
                   
                   const success = await sendWebhook(order);
                   
                   if (success) {
                       await updateDoc(change.doc.ref, {
                           last_status_sent: order.status,
                           webhook_last_sent: new Date().toISOString()
                       });
                   }
                } catch(e) {
                   console.error(`[FirestoreListener] Erro ao notificar pedido ${order.id}:`, e);
                }
            }
        });
    }, (error) => {
        console.error("[FirestoreListener] Erro no snapshot (Client SDK):", error);
    });
}
