import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendOrderEvent } from './botConversaService';

export function setupOrderListener() {
    console.log("[FirestoreListener] Iniciando listener de pedidos...");
    const q = query(collection(db, 'orders'));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const orderData = change.doc.data();
            const order = { id: change.doc.id, ...orderData } as any;
            
            console.log(`[FirestoreListener] Evento recebido: ${change.type}`, {
                id: order.id,
                type: order.type,
                status: order.status
            });

            // Apenas pedidos online
            if (orderData.type !== 'online') {
              console.log(`[FirestoreListener] Ignorando pedido por tipo: ${orderData.type}`);
              return;
            }

            if (change.type === 'added') {
                console.log(`[FirestoreListener] Pedido adicionado: ${order.id}`);
                await sendOrderEvent(order, 'checkout');
            }
            if (change.type === 'modified') {
                console.log(`[FirestoreListener] Pedido modificado: ${order.id}`);
                await sendOrderEvent(order, 'admin');
            }
        });
    });
}
