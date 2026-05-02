import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as aiController from '../controllers/aiController.js';

const router = Router();

// Rate limit para Administração (geração de conteúdo)
const adminAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100,
  message: { error: 'Limite de geração de conteúdo atingido para esta hora.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'anonymous-admin',
  validate: { trustProxy: false }
});

// Rate limit para Loja (Busca Inteligente) - Mais restrito para evitar abusos
const storeAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { 
    error: 'Limite de busca inteligente atingido.',
    fallback: true 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'anonymous-store',
  validate: { trustProxy: false }
});

router.post('/gerar-produto', adminAiLimiter, aiController.generateProduct);
router.post('/gerar-categoria', adminAiLimiter, aiController.generateCategory);
router.post('/interpretar-busca', storeAiLimiter, aiController.interpretSearch);
router.post('/bot-consulta', storeAiLimiter, aiController.botConsult);

export default router;
