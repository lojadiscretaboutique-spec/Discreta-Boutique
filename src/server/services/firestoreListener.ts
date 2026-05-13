import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendWebhook } from './botConversaService';

export function setupOrderListener() {
    console.log("[FirestoreListener] Iniciando listener de pedidos...");
    const q = query(collection(db, 'orders'));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const orderData = change.doc.data();
            const order = { 
                id: change.doc.id, 
                telefone: orderData.customerWhatsapp, 
                nome: orderData.customerName, 
                ...orderData 
            } as any;
            
            if (change.type === 'added' || change.type === 'modified') {
                // Notificar sobre todos os pedidos (mantendo funcionamento para loja online e PDV caso tenham whatsapp)
                // Se não houver telefone no payload do webhook lá na frente ele rejeita suavemente

                // Prevent duplicate submission by verifying last sent
                if (orderData.last_status_sent === orderData.status) {
                    return;
                }

                // If added, ignore old orders to avoid flooding when the server restarts
                if (change.type === 'added') {
                    const createdAtString = orderData.createdAt;
                    if (createdAtString) {
                        const createdAt = new Date(createdAtString).getTime();
                        const now = new Date().getTime();
                        if (now - createdAt > 1000 * 60 * 5) { // Older than 5 minutes
                            // Mark as sent silently without triggering webhook
                            await updateDoc(doc(db, 'orders', order.id), {
                                last_status_sent: orderData.status
                            });
                            return;
                        }
                    }
                }

                console.log(`[FirestoreListener] Processando evento de pedido para botconversa: ${order.id} - Status: ${order.status}`);
                try {
                   // Adicionando um pequeno delay para garantir que os dados do pedido estejam estáveis
                   await new Promise(resolve => setTimeout(resolve, 2000));
                   
                   const success = await sendWebhook(order);
                   
                   if (success) {
                       // Marca no firestore que o status atual foi enviado
                       await updateDoc(doc(db, 'orders', order.id), {
                           last_status_sent: order.status,
                           webhook_last_sent: new Date().toISOString()
                       });
                   }
                } catch(e) {
                   console.error(`[FirestoreListener] Erro ao notificar pedido ${order.id}:`, e);
                }
            }
        });
    });
}
