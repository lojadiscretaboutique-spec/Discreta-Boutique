import { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { z } from 'zod';
import { db, auth } from '../../lib/firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    }
  };
  console.error('[FIREBASE_ERROR]', JSON.stringify(errInfo));
  // We don't necessarily want to throw and break the request if logging fails, 
  // but for the sake of the guideline we will at least log it well.
}

const GenerateProductInput = z.object({
  nome: z.string().min(3).max(100),
  categoria: z.string().min(3).max(50)
});

const InterpretSearchInput = z.object({
  busca: z.string().min(2).max(200)
});

export const generateProduct = async (req: Request, res: Response) => {
  try {
    const { nome, categoria } = GenerateProductInput.parse(req.body);

    const startTime = Date.now();
    const result = await aiService.generateProductContent(nome, categoria);
    const duration = Date.now() - startTime;

    console.log(`[AI][SUCCESS] Geração de produto: "${nome}" (${duration}ms)`);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados de entrada inválidos.', details: error.errors });
    }
    console.error(`[AI][ERROR] Geração de produto falhou:`, error.message);
    res.status(500).json({ error: error.message || 'Erro ao processar requisição de IA.' });
  }
};

export const interpretSearch = async (req: Request, res: Response) => {
  try {
    const { busca } = InterpretSearchInput.parse(req.body);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 10000)
    );

    const startTime = Date.now();
    
    // Race between AI service and 2s timeout
    const result: any = await Promise.race([
      aiService.interpretSearch(busca),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    console.log(`[AI][SUCCESS] Interpretação de busca: "${busca}" (${duration}ms)`);

    // LOG DE INTENÇÕES (Salvando no banco de dados para análise posterior)
    try {
      await addDoc(collection(db, 'search_logs'), {
        busca,
        interpretacao: result,
        duration,
        timestamp: serverTimestamp(),
        fallback: false,
        source: 'catalogo'
      });
    } catch (logError) {
      handleFirestoreError(logError, OperationType.WRITE, 'search_logs');
    }

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Termo de busca inválido.' });
    }

    // Registrar o log mesmo em caso de falha/timeout (se possível identificar a busca)
    try {
      const buscaTerm = req.body?.busca || 'unknown';
      await addDoc(collection(db, 'search_logs'), {
        busca: buscaTerm,
        error: error.message,
        timestamp: serverTimestamp(),
        fallback: true,
        source: 'catalogo'
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'search_logs');
    }

    if (error.message === 'AI_TIMEOUT') {
      console.warn(`[AI][TIMEOUT] Busca lenta atingida: "${req.body.busca}"`);
    } else {
      console.error(`[AI][ERROR] Interpretação de busca falhou:`, error.message);
    }
    
    // Fallback response
    res.json({ 
      fallback: true, 
      error: error.message === 'AI_TIMEOUT' ? 'Tempo esgotado' : 'Erro interno' 
    });
  }
};

export const botConsult = async (req: Request, res: Response) => {
  try {
    const { busca } = req.body;
    if (!busca) return res.status(400).json({ error: 'Busca necessária' });

    const result = await aiService.interpretSearch(busca);
    
    // Log intent as well
    try {
      await addDoc(collection(db, 'search_logs'), {
        busca,
        interpretacao: result,
        timestamp: serverTimestamp(),
        source: 'whatsapp'
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'search_logs');
    }

    // Return a simplified plain-text based object for easy bot consumption
    res.json({
      original: busca,
      intencao: result.intencao,
      categoria: result.categoria,
      link: `https://${req.get('host')}/catalogo?cat=${encodeURIComponent(result.categoria || 'all')}`,
      sugestao: result.mensagem_personalizada || '',
      texto_whatsapp: `🌸 *Discreta Boutique* 🌸\n\nEntendi sua busca: "${busca}"\n\n*Sugestão:* ${result.mensagem_personalizada}\n\nConfira nossa curadoria completa aqui: https://${req.get('host')}/catalogo?cat=${encodeURIComponent(result.categoria || 'all')}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const aiController = {
  generateProduct,
  interpretSearch,
  botConsult
};
