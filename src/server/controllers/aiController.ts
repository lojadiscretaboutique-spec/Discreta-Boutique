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
    
    let productsSnap;
    try {
      // Aumentado o limite para 500 para cobrir mais do catálogo
      productsSnap = await getDocs(query(productsRef, where('active', '==', true), limit(500)));
    } catch (dbError: any) {
      console.error("[SEARCH][DB_ERROR]", dbError.message);
      productsSnap = await getDocs(query(productsRef, limit(200)));
    }
    
    let products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // FILTRO RIGOROSO: Somente Ativos, Com Imagem e Com Estoque (ou sem controle)
    let availableProducts = products.filter(p => {
      const hasImage = (p.images && p.images.length > 0 && p.images.some((img: any) => img.url)) || p.imageUrl || p.image;
      const hasStock = p.manageStock === false || (p.stock && p.stock > 0);
      return p.active === true && hasImage && hasStock;
    });

    // Se o filtro rigoroso remover TUDO, relaxamos para mostrar produtos Ativos (mesmo sem estoque/imagem)
    // para evitar que a busca pareça "quebrada" em catálogos incompletos.
    if (availableProducts.length === 0 && products.length > 0) {
      availableProducts = products.filter(p => p.active === true);
    }

    const rankedProducts = availableProducts.map(p => {
      let matchScore = 0;
      const name = (p.name || "").toLowerCase();
      const description = (p.description || "").toLowerCase();
      const nameInfo = (name + " " + description).toLowerCase();
      const catInfo = (p.category || p.categoryId || "").toLowerCase();

      // 1. Busca Direta (Palavra-chave do usuário) - Bônus Elevado
      if (processada) {
        if (name.includes(processada) || description.includes(processada)) {
          matchScore += 40;
        } else {
          // Match por palavras individuais
          const words = processada.split(/\s+/).filter(w => w.length > 2);
          words.forEach(word => {
            if (name.includes(word)) matchScore += 10;
            if (description.includes(word)) matchScore += 5;
          });
        }
      }

      // 2. Pontuação por Categoria
      if (interpretacao.categoria && (catInfo.includes(interpretacao.categoria.toLowerCase()) || interpretacao.categoria.toLowerCase().includes(catInfo))) {
        matchScore += 20;
      }

      // 3. Pontuação por Atributos/Características
      interpretacao.caracteristicas?.forEach((f: string) => { 
        if (nameInfo.includes(f.toLowerCase())) matchScore += 15; 
      });

      // 4. Pontuação por Sinônimos/Termos Relacionados
      interpretacao.sinonimos?.forEach((s: string) => { 
        if (nameInfo.includes(s.toLowerCase())) matchScore += 10; 
      });

      // 5. Busca literal no nome (Bônus de 25 se bater exatamente o termo técnico da IA)
      if (interpretacao.termo_busca && nameInfo.includes(interpretacao.termo_busca.toLowerCase())) {
        matchScore += 25;
      }

      const cliques = p.stats?.clicks || 0;
      const compras = p.stats?.purchases || 0;
      
      const finalScore = (cliques * 0.5) + (compras * 2) + (matchScore * 50);

      return { ...p, relevance: finalScore };
    });

    // Filtra apenas produtos que tiveram algum match mínimo se a busca não for vazia
    let finalResults = rankedProducts.filter(p => p.relevance > 0);
    
    // Fallback: Se nenhum produto bateu os critérios da IA, tenta busca tradicional por palavras individuais
    if (finalResults.length === 0 && processada.length > 0) {
      const words = processada.split(/\s+/).filter(w => w.length > 2);
      finalResults = products.filter(p => {
        const name = (p.name || "").toLowerCase();
        const desc = (p.description || "").toLowerCase();
        // Match se pelo menos uma palavra da busca estiver no nome ou descrição
        return words.some(word => name.includes(word) || desc.includes(word)) || name.includes(processada);
      }).map(p => ({ ...p, relevance: 0.1 }));
      
      // Se ainda assim vazio, e a busca tem palavras, tenta match parcial
      if (finalResults.length === 0) {
         finalResults = products.filter(p => {
           const name = (p.name || "").toLowerCase();
           return words.some(word => name.startsWith(word.substring(0, 3)));
         }).map(p => ({ ...p, relevance: 0.01 }));
      }
    }

    finalResults.sort((a, b) => b.relevance - a.relevance);

    res.json({
      searchId,
      interpretacao,
      produtos: finalResults.slice(0, 40).map(p => ({
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
      fallback: true,
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

export const suggestCartComplements = async (req: Request, res: Response) => {
  try {
    const { items } = req.body; // Array de { name: string, id: string }
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Itens do carrinho não informados' });

    const productNames = items.map(i => i.name);
    const suggestion = await aiService.suggestComplements(productNames);

    // Buscar no catálogo para encontrar o melhor "foco_complemento"
    const productsRef = collection(db, 'products');
    const productsSnap = await getDocs(query(productsRef, where('active', '==', true), limit(200)));
    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // Remover produtos que já estão no carrinho e aplicar filtros rigorosos
    const cartIds = items.map(i => i.id);
    let candidateProducts = allProducts.filter(p => {
      const isNotIdInCart = !cartIds.includes(p.id);
      const hasImage = (p.images && p.images.length > 0 && p.images.some((img: any) => img.url)) || p.imageUrl || p.image;
      const hasStock = p.manageStock === false || (p.stock && p.stock > 0);
      return isNotIdInCart && p.active === true && hasImage && hasStock;
    });

    // Fallback: se o filtro rigoroso remover TUDO, relaxamos para mostrar produtos Ativos (mesmo sem estoque/imagem)
    if (candidateProducts.length === 0 && allProducts.length > 0) {
      candidateProducts = allProducts.filter(p => !cartIds.includes(p.id) && p.active === true);
    }

    const ranked = candidateProducts.map(p => {
      let score = 0;
      const nameInfo = (p.name + " " + (p.description || "")).toLowerCase();
      
      if (nameInfo.includes(suggestion.foco_complemento.toLowerCase())) score += 50;
      suggestion.caracteristicas.forEach(f => {
        if (nameInfo.includes(f.toLowerCase())) score += 10;
      });

      return { ...p, score };
    });

    ranked.sort((a, b) => b.score - a.score);

    res.json({
      motivo: suggestion.motivo,
      produtos: ranked.slice(0, 2).map(p => {
        const mainImage = p.images?.find((img: any) => img.isMain)?.url || p.images?.[0]?.url || p.imageUrl || p.image || '';
        return {
          id: p.id,
          name: p.name,
          shortDescription: p.shortDescription || p.subtitle || '',
          price: p.price,
          imageUrl: mainImage,
          category: p.categoryId || p.category || '',
          sku: p.sku || ''
        };
      })
    });
  } catch (error: any) {
    console.error('[CART_SUGGEST][ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const aiController = {
  generateProduct,
  generateCategory,
  interpretSearch,
  trackClick,
  botConsult,
  suggestCartComplements
};
