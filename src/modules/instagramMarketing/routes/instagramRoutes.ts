import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  generateContent,
  generateDetails,
  generateImages,
  schedulePost,
  publishPostImmediately,
  getPosts,
  getLogs,
  saveIntegration,
  getIntegration,
  testConnection,
  getBrandKit,
  saveBrandKit
} from '../controllers/instagramController.js';

const router = Router();

// Rate limiting for AI content creations
const instagramAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100,
  message: { error: 'Limite de geração de conteúdo para o Instagram atingido nesta hora.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});

router.post('/generate-content', instagramAiLimiter, generateContent);
router.post('/generate-details', instagramAiLimiter, generateDetails);
router.post('/generate-images', instagramAiLimiter, generateImages);
router.post('/schedule', schedulePost);
router.post('/publish', publishPostImmediately);
router.get('/posts', getPosts);
router.get('/logs', getLogs);
router.post('/integracao', saveIntegration);
router.get('/integracao', getIntegration);
router.post('/integracao/testar', testConnection);
router.get('/brand-kit', getBrandKit);
router.post('/brand-kit', saveBrandKit);

export default router;
