import { db } from '../../lib/firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    Timestamp,
    runTransaction
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
                   const now = Date.now();
                   
                   // Usar transaction para evitar que múltiplas instâncias enviem ao mesmo tempo
                   const docRef = doc(db, 'orders', order.id);
                   const shouldSend = await runTransaction(db, async (transaction) => {
                        const sfDoc = await transaction.get(docRef);
                        if (!sfDoc.exists()) {
                            return false;
                        }
                        
                        const data = sfDoc.data();
                        
                        if (data.last_status_sent === data.status) {
                             return false;
                        }
                        
                        const lastProcessingTime = data.webhook_processing_timestamp || 0;
                        // Se já houve processamento nos últimos 15 segundos para este pedido, aborta
                        if (now - lastProcessingTime < 15000) {
                            return false;
                        }
                        
                        // Marca como em processamento (lock de 15 segundos)
                        transaction.update(docRef, { webhook_processing_timestamp: now });
                        return true;
                   });
                   
                   if (!shouldSend) {
                       console.log(`[FirestoreListener] Pedido ${order.id} já sendo processado por outra instância ou cooldown ativo (15s). Ignorando.`);
                       return;
                   }
                   
                   // Dá um pequeno atraso para garantir que os dados relacionados foram salvos, e previne double triggers locais
                   await new Promise(resolve => setTimeout(resolve, 2000));
                   
                   const success = await sendWebhook(order);
                   
                   if (success) {
                       // Atualiza pós-sucesso (usamos updateDoc direto pois só uma instância deve estar aqui)
                       await updateDoc(docRef, {
                           last_status_sent: order.status,
                           webhook_last_sent: new Date().toISOString()
                       });
                   } else {
                       // Remove o lock pra poder tentar novamente
                       await updateDoc(docRef, {
                           webhook_processing_timestamp: 0
                       });
                   }
                } catch(e) {
                   console.error(`[FirestoreListener] Erro ao notificar pedido ${order.id}:`, e);
                   try {
                       await updateDoc(doc(db, 'orders', order.id), {
                           webhook_processing_timestamp: 0
                       });
                   } catch (err) {}
                }
            }
        });
    }, (error) => {
        console.error("[FirestoreListener] Erro no snapshot (Client SDK):", error);
    });
}
