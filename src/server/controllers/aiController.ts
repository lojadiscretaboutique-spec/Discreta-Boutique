import { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { z } from 'zod';
import { db, auth } from '../../lib/firebase.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc, increment } from 'firebase/firestore';

const GenerateProductInput = z.object({
  nome: z.string().min(3).max(100),
  categoria: z.string().min(3).max(50)
});

const GenerateCategoryInput = z.object({
  nome: z.string().min(3).max(100)
});

export const generateProduct = async (req: Request, res: Response) => {
  try {
    const { nome, categoria } = GenerateProductInput.parse(req.body);
    const result = await aiService.generateProductContent(nome, categoria);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateCategory = async (req: Request, res: Response) => {
  try {
    const { nome } = GenerateCategoryInput.parse(req.body);
    const result = await aiService.generateCategoryContent(nome);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const InterpretSearchInput = z.object({
  busca: z.string().min(2).max(500)
});

const TrackClickInput = z.object({
  searchId: z.string(),
  productId: z.string()
});

/**
 * Normalização robusta de busca
 */
const normalizeQuery = (text: string) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[?!.;,]/g, '')
    .replace(/qual o melhor|quero algo para|você tem|onde encontro|preciso de/g, '')
    .trim();
};

export const interpretSearch = async (req: Request, res: Response) => {
  try {
    const { busca } = InterpretSearchInput.parse(req.body);
    const processada = normalizeQuery(busca);

    let interpretacao: any = null;
    let searchId: string | null = null;

    // 1. Verificar histórico (Cache de Inteligência)
    const historyRef = collection(db, 'intelligent_searches');
    const qHistory = query(historyRef, where('busca_processada', '==', processada), limit(1));
    const historySnap = await getDocs(qHistory);

    if (!historySnap.empty) {
      const docData = historySnap.docs[0].data();
      interpretacao = docData.interpretacao;
      searchId = historySnap.docs[0].id;
    } else {
      // 2. Chamar IA para interpretação inicial
      interpretacao = await aiService.interpretSearch(busca);
      
      const newSearch = await addDoc(collection(db, 'intelligent_searches'), {
        busca_original: busca,
        busca_processada: processada,
        interpretacao: interpretacao,
        cliques: 0,
        conversoes: 0,
        timestamp: serverTimestamp()
      });
      searchId = newSearch.id;
    }

    // 3. Busca no Banco e Ranking
    const productsRef = collection(db, 'products');
    
    // Corrigido: O campo no banco é 'active' (boolean), não 'status' (string)
    // Além disso, adicionamos um log para depuração caso falhe
    let productsSnap;
    try {
      productsSnap = await getDocs(query(productsRef, where('active', '==', true), limit(200)));
    } catch (dbError: any) {
      console.error("[SEARCH][DB_ERROR]", dbError.message);
      // Se a query falhar (ex: falta de índice), tentamos buscar todos os ativos sem filtro de limite ou apenas o que der
      productsSnap = await getDocs(query(productsRef, limit(100)));
    }
    
    let products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    const rankedProducts = products.map(p => {
      let matchScore = 0;
      const nameInfo = (p.name + " " + (p.description || "")).toLowerCase();

      if (interpretacao.categoria && (p.categoryId === interpretacao.categoria || p.category === interpretacao.categoria)) matchScore += 5;
      interpretacao.caracteristicas?.forEach((f: string) => { if (nameInfo.includes(f.toLowerCase())) matchScore += 3; });
      interpretacao.sinonimos?.forEach((s: string) => { if (nameInfo.includes(s.toLowerCase())) matchScore += 2; });

      const cliques = p.stats?.clicks || 0;
      const compras = p.stats?.purchases || 0;
      const finalScore = (cliques * 2) + (compras * 5) + (matchScore * 3);

      return { ...p, relevance: finalScore };
    });

    rankedProducts.sort((a, b) => b.relevance - a.relevance);

    res.json({
      searchId,
      interpretacao,
      produtos: rankedProducts.slice(0, 40).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.imageUrl || p.image || '',
        category: p.categoryId || p.category || '',
        relevance: p.relevance
      }))
    });
  } catch (error: any) {
    console.error(`[SEARCH][FATAL_ERROR]`, error.message);
    res.json({
      searchId: null,
      interpretacao: { 
        termo_busca: req.body.busca || '', 
        mensagem_personalizada: 'Estamos preparando o melhor para você...' 
      },
      produtos: []
    });
  }
};

export const trackClick = async (req: Request, res: Response) => {
  try {
    const { searchId, productId } = TrackClickInput.parse(req.body);
    await updateDoc(doc(db, 'intelligent_searches', searchId), { cliques: increment(1) });
    await updateDoc(doc(db, 'products', productId), { 'stats.clicks': increment(1) });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao registrar clique' });
  }
};

export const botConsult = async (req: Request, res: Response) => {
  try {
    const { busca } = req.body;
    const result = await aiService.interpretSearch(busca);
    res.json({
      original: busca,
      intencao: result.intencao,
      categoria: result.categoria,
      link: `https://${req.get('host')}/catalogo?cat=${encodeURIComponent(result.categoria || 'all')}`,
      sugestao: result.mensagem_personalizada || '',
      texto_whatsapp: `🌸 *Discreta Boutique* 🌸\n\nEntendi sua busca: "${busca}"\n\n*Sugestão:* ${result.mensagem_personalizada}\n\nConfira nossa seleção completa aqui: https://${req.get('host')}/catalogo?cat=${encodeURIComponent(result.categoria || 'all')}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const aiController = {
  generateProduct,
  generateCategory,
  interpretSearch,
  trackClick,
  botConsult
};
