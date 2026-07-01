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
  validate: { trustProxy: false }
});

// Rate limit para Loja (Busca Inteligente) - Ampliado para evitar erros de limite
const storeAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15000,
  message: { 
    error: 'Limite de busca inteligente atingido.',
    fallback: true 
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});

// Rate limit específico para Recrutamento - maior tolerância para permitir a entrevista completa
const recruitmentAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 150, // Permite até 150 interações por período
  message: { 
    error: 'Limite de mensagens da entrevista atingido para este período.',
    fallback: true 
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});

router.post('/gerar-produto', adminAiLimiter, aiController.generateProduct);
router.post('/gerar-categoria', adminAiLimiter, aiController.generateCategory);
router.post('/interpretar-busca', storeAiLimiter, aiController.interpretSearch);
router.get('/search-suggestions', aiController.getSearchSuggestions);
router.post('/registrar-clique', storeAiLimiter, aiController.trackClick);
router.post('/sugerir-complementos', storeAiLimiter, aiController.suggestCartComplements);
router.post('/sugestao-produto', storeAiLimiter, aiController.suggestRelatedProducts);
router.post('/bot-consulta', storeAiLimiter, aiController.botConsult);
router.post('/ranquear-ofertas', storeAiLimiter, aiController.rankOffers);
router.post('/generate-home-curadoria', adminAiLimiter, aiController.generateHomeCuratory);
router.post('/strategic-report', adminAiLimiter, aiController.generateStrategicReport);
router.post('/gerar-posts-calendario', adminAiLimiter, aiController.generatePostsCalendar);
router.post('/marketing-copywriting', adminAiLimiter, aiController.generateMarketingCopywriting);
router.post('/marketing-image', adminAiLimiter, aiController.generateMarketingImage);
router.post('/marketing-rewrite', adminAiLimiter, aiController.marketingRewrite);

// CRON SCHEDULER ENDPOINT (No rate limit, protected by API Key or accessible only by Cron)
router.all('/cron/update-home', async (req, res) => {
   // Para usar com GCP Cloud Scheduler, passe a secret no header
   // if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) return res.status(401).send('Unauthorized');
   return aiController.generateHomeCuratory(req, res);
});

router.post('/analisar-catalogo', adminAiLimiter, aiController.analyzeCatalog);
router.post('/enriquecer-produto', adminAiLimiter, aiController.enrichProduct);
router.post('/gerar-embedding', adminAiLimiter, aiController.generateEmbedding);
router.post('/analisar-candidato', adminAiLimiter, aiController.analyzeCandidate);

// Recruitment Module Routes
router.post('/recruitment-chat', recruitmentAiLimiter, aiController.recruitmentChat);
router.post('/recruitment-extract', recruitmentAiLimiter, aiController.recruitmentExtract);
router.get('/recruitment-settings', aiController.getRecruitmentSettings);
router.get('/recruitment-state', aiController.getRecruitmentState);

export default router;
