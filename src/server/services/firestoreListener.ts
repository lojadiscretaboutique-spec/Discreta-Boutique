import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendOrderEvent } from './botConversaService';

export function setupOrderListener() {
    console.log("[FirestoreListener] Iniciando listener de pedidos...");
    const q = query(collection(db, 'orders'));
    
    onSnapshot(q, (snapshot) => {
        console.log(`[FirestoreListener] Snapshot recebido com ${snapshot.size} documentos.`);
        snapshot.docChanges().forEach(async (change) => {
            const orderData = change.doc.data();
            const order = { 
                id: change.doc.id, 
                telefone: orderData.customerWhatsapp, 
                nome: orderData.customerName, 
                ...orderData 
            } as any;
            
            console.log(`📍 EVENTO DETECTADO: ${change.type}`, order.id);

            // Prevenir envio duplicado
            if (orderData.last_status_sent === orderData.status) {
                console.log(`[FirestoreListener] Pedido já processado com este status: ${order.id}`);
                return;
            }

            // Apenas pedidos online
            if (orderData.type !== 'online') {
              console.log(`[FirestoreListener] Ignorando pedido por tipo: ${orderData.type}`);
              return;
            }

            if (change.type === 'added' || change.type === 'modified') {
                console.log(`[FirestoreListener] Processando evento de pedido: ${order.id}`);
                await sendOrderEvent(order);
            }
        });
    });
}
