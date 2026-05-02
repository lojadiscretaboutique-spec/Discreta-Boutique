import { Request, Response } from 'express';
import { sendOrderStatus } from '../services/botConversaService.js';

export const handleOrderStatusUpdate = async (req: Request, res: Response) => {
    try {
        const { contact_id, status, pedido } = req.body;
        await sendOrderStatus(contact_id, status, pedido);
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling order status update:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};
