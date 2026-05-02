import express from 'express';
import { handleOrderStatusUpdate } from '../controllers/notificationController.js';

const router = express.Router();

router.post('/order-status', handleOrderStatusUpdate);

export default router;
