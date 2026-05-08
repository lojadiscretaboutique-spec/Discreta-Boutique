import { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { z } from 'zod';
import { db, auth } from '../../lib/firebase.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc, increment } from 'firebase/firestore';

const GenerateProductInput = z.object({
  nome: z.string().min(3).max(100),
  categoria: z.union([z.string().min(3).max(100), z.array(z.string())])
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

    let interpretacao: any = null;
    let searchId: string | null = null;

    // 1. Chamar IA para interpretação e HUNT (Busca Semântica Direta)
    const [interpretScore, aiSelection] = await Promise.all([
      aiService.interpretSearch(busca),
      (async () => {
        const productsRef = collection(db, 'products');
        const snap = await getDocs(query(productsRef, where('active', '==', true), limit(150)));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return aiService.huntProducts(busca, all);
      })()
    ]);

    interpretacao = interpretScore;
    searchId = "ai_" + Date.now(); 

    // 2. Mapear os produtos escolhidos pela IA
    const productsRef = collection(db, 'products');
    const productsSnap = await getDocs(query(productsRef, where('active', '==', true), limit(300)));
    let allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // 3. Cruzar resultados da IA com objetos reais
    let finalResults = aiSelection.rankedIds
      .map(id => allProducts.find(p => p.id === id))
      .filter(p => !!p) as any[];

    // 4. Se a IA falhou ou retornou poucos resultados, fallback inteligente
    if (finalResults.length < 3) {
      const fallbackResults = allProducts.map(p => {
        let matchScore = 0;
        const name = (p.name || "").toLowerCase();
        const description = (p.description || "").toLowerCase();
        const nameInfo = (name + " " + description).toLowerCase();

        // Match por características extraídas pela IA
        interpretacao.caracteristicas?.forEach((f: string) => { 
          if (nameInfo.includes(f.toLowerCase())) matchScore += 20; 
        });

        const cliques = p.stats?.clicks || 0;
        const compras = p.stats?.purchases || 0;
        const finalScore = (cliques * 0.5) + (compras * 2) + (matchScore * 50);

        return { ...p, relevance: finalScore };
      }).filter(p => p.relevance > 0);

      fallbackResults.sort((a, b) => b.relevance - a.relevance);
      
      // Adicionar fallbacks aos resultados sem duplicar
      fallbackResults.forEach(fp => {
        if (!finalResults.find(r => r.id === fp.id)) {
          finalResults.push(fp);
        }
      });
    }

    // Sobrescrever mensagem personalizada se a IA de Hunt retornou uma melhor
    if (aiSelection.mensagem) {
      interpretacao.mensagem_personalizada = aiSelection.mensagem;
    }
    if (aiSelection.curadoria) {
      interpretacao.termo_busca = aiSelection.curadoria;
    }

    res.json({
      searchId,
      interpretacao,
      produtos: finalResults.slice(0, 40).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: (p.images && p.images.length > 0) ? (p.images.find((i:any) => i.isMain)?.url || p.images[0].url) : (p.imageUrl || p.image || ''),
        category: p.categoryId || p.category || '',
        relevance: p.relevance || 100
      }))
    });
  } catch (error: any) {
    console.error(`[SEARCH][FATAL_ERROR]`, error.message);
    res.status(500).json({ error: "Falha na geração OpenAI (Busca)" });
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

export const enrichProduct = async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const result = await aiService.enrichProduct(title, description);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateEmbedding = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const result = await aiService.generateEmbedding(text);
    res.json(result);
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
      // Começamos com um pequeno fator aleatório para garantir variedade em produtos com relevância similar
      let score = Math.random() * 5; 
      const nameInfo = (p.name + " " + (p.description || "")).toLowerCase();
      const catInfo = (p.categoryId || p.category || "").toLowerCase();
      
      // Match principal (ex: "lubrificante")
      const foco = suggestion.foco_complemento.toLowerCase();
      if (nameInfo.includes(foco)) score += 50;
      if (catInfo.includes(foco)) score += 30; // Categoria bater com o foco é muito relevante

      // Match de características
      suggestion.caracteristicas.forEach(f => {
        const feature = f.toLowerCase();
        if (nameInfo.includes(feature)) score += 15;
      });

      // Bônus para produtos com maior taxa de conversão (se disponível)
      if (p.stats?.purchases) score += Math.min(p.stats.purchases * 2, 20);

      return { ...p, score };
    });

    // Ordenar por score decrecente
    ranked.sort((a, b) => b.score - a.score);

    // Pegamos os top 6 e desses escolhemos 2 aleatoriamente para sugerir,
    // ou apenas pegamos os top 2 se o score do primeiro for MUITO superior ao resto.
    const topPool = ranked.slice(0, 6);
    let selectedProducts = [];
    
    if (topPool.length > 0) {
      // Se o primeiro é um "Super Match" (> 20 pontos de diferença pro segundo), mantém ele
      if (topPool.length > 1 && (topPool[0].score - topPool[1].score) > 20) {
        selectedProducts.push(topPool[0]);
        // O segundo escolhemos aleatoriamente entre os outros 5
        const remaining = topPool.slice(1);
        if (remaining.length > 0) {
          selectedProducts.push(remaining[Math.floor(Math.random() * remaining.length)]);
        }
      } else {
        // Shuffle do pool de 6 e pega 2
        const shuffled = [...topPool].sort(() => Math.random() - 0.5);
        selectedProducts = shuffled.slice(0, 2);
      }
    }

    res.json({
      motivo: suggestion.motivo,
      produtos: selectedProducts.map(p => {
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

export const suggestRelatedProducts = async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'ID do produto não informado' });

    // 1. Buscar o produto alvo e o catálogo
    const productsRef = collection(db, 'products');
    const [targetSnap, catalogSnap] = await Promise.all([
      getDocs(query(productsRef, where('__name__', '==', productId))),
      getDocs(query(productsRef, where('active', '==', true), limit(200)))
    ]);

    if (targetSnap.empty) return res.status(404).json({ error: 'Produto não encontrado' });

    const targetProduct = { id: targetSnap.docs[0].id, ...targetSnap.docs[0].data() };
    const allProducts = catalogSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Chamar IA para seleção inteligente
    const aiRecommendation = await aiService.suggestRelatedProducts(targetProduct, allProducts);

    // 3. Cruzar IDs com objetos reais
    const suggestedProducts = aiRecommendation.rankedIds
      .map(id => allProducts.find(p => p.id === id))
      .filter(p => !!p);

    res.json({
      mensagem: aiRecommendation.mensagem,
      produtos: suggestedProducts.map(p => {
        const mainImage = (p as any).images?.find((img: any) => img.isMain)?.url || (p as any).images?.[0]?.url || (p as any).imageUrl || (p as any).image || '';
        return {
          id: (p as any).id,
          name: (p as any).name,
          price: (p as any).price,
          imageUrl: mainImage,
          category: (p as any).categoryId || (p as any).category || ''
        };
      })
    });
  } catch (error: any) {
    console.error('[SUGGEST_RELATED][ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const aiController = {
  generateProduct,
  generateCategory,
  interpretSearch,
  trackClick,
  botConsult,
  suggestCartComplements,
  suggestRelatedProducts,
  enrichProduct,
  generateEmbedding
};
