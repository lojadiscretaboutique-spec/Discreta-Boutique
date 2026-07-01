import { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { productService } from '../../services/productService.js';
import { candidateService } from '../../services/candidateService.js';
import { z } from 'zod';
import { db } from '../../lib/firebase.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, updateDoc, increment, orderBy } from 'firebase/firestore';

const GenerateProductInput = z.object({
  nome: z.string().min(3).max(100),
  categoria: z.union([z.string().min(3).max(100), z.array(z.string())]),
  descricao: z.string().optional()
});

const GenerateCategoryInput = z.object({
  nome: z.string().min(3).max(100),
  slug: z.string().optional(),
  existingDesc: z.string().optional()
});

export const generateProduct = async (req: Request, res: Response) => {
  try {
    const { nome, categoria, descricao } = GenerateProductInput.parse(req.body);
    const result = await aiService.generateProductContent(nome, categoria, descricao);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateCategory = async (req: Request, res: Response) => {
  try {
    const { nome, slug, existingDesc } = GenerateCategoryInput.parse(req.body);
    const result = await aiService.generateCategoryContent(nome, slug, existingDesc);
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
    const normalizedBusca = normalizeQuery(busca);
    const cacheId = "ai_meta_" + normalizedBusca.replace(/\s+/g, '_').substring(0, 50);

    // 1. Tentar Buscar no Cache de Interpretação
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      const cacheRef = doc(db, 'ai_query_cache', cacheId);
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const cachedData = cacheSnap.data();
        if (cachedData.timestamp && (Date.now() - cachedData.timestamp.toMillis()) < 1000 * 60 * 60 * 24 * 7) {
           console.log(`[SEARCH][CACHE_HIT] ${busca}`);
           return res.json({
             searchId: cachedData.id || cacheId,
             interpretacao: cachedData.interpretacao
           });
        }
      }
    } catch(e) {
      console.warn('[SEARCH][CACHE_READ_ERROR]', e);
    }

    // 2. Chamar IA para interpretar a intenção (Sem pedir produtos)
    let interpretacao: any = {
      termo_busca: busca,
      categoria: 'Outros',
      intencao: '',
      caracteristicas: [],
      sinonimos: [],
      termos_relacionados: [],
      mensagem_personalizada: ''
    };

    try {
       interpretacao = await Promise.race([
          aiService.interpretSearch(busca),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), 10000))
       ]) as any;
    } catch (e) {
       console.warn('[SEARCH][AI_TIMEOUT/ERROR]', e);
    }

    // 3. Registrar a busca para analytics (Opcional)
    try {
      await addDoc(collection(db, 'intelligent_searches'), {
        id: cacheId,
        termo: busca,
        interpretacao: interpretacao,
        timestamp: serverTimestamp(),
        cliques: 0,
        conversoes: 0
      });
    } catch (e) {
      console.warn('[SEARCH][SAVE_ERROR]', e);
    }

    const payload = {
      searchId: cacheId,
      interpretacao
    };

    // 4. Salvar no Cache
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'ai_query_cache', cacheId), {
        ...payload,
        timestamp: serverTimestamp()
      });
    } catch(e) {
      console.warn('[SEARCH][CACHE_SAVE_ERROR]', e);
    }

    res.json(payload);
  } catch (error: any) {
    console.error(`[SEARCH][FATAL_ERROR]`, error.message);
    res.status(500).json({ error: "Falha na interpretação da busca" });
  }
};

export const trackClick = async (req: Request, res: Response) => {
  try {
    const { searchId, productId } = TrackClickInput.parse(req.body);
    
    // Buscar o documento da busca pelo ID customizado
    const qSearch = query(collection(db, 'intelligent_searches'), where('id', '==', searchId), limit(1));
    const snap = await getDocs(qSearch);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { cliques: increment(1) });
    }

    // Atualizar o produto
    await productService.trackInteraction(productId, 'click', searchId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[TRACK_CLICK_ERROR]', error);
    res.status(400).json({ error: 'Erro ao registrar clique' });
  }
};

export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').toLowerCase().trim();
    if (!q) return res.json({ suggestions: [], products: [] });

    const searchRef = collection(db, 'intelligent_searches');
    const productsRef = collection(db, 'products');
    const categoriesRef = collection(db, 'categories');
    
    // 1. Fetch from previous successful searches, products, and categories
    const qSearches = query(
      searchRef, 
      orderBy('cliques', 'desc'),
      limit(100) 
    );

    const qProducts = query(
      productsRef,
      where('active', '==', true),
      limit(200)
    );

    const [snapSearches, snapProducts, snapCategories] = await Promise.all([
      getDocs(qSearches),
      getDocs(qProducts),
      getDocs(categoriesRef)
    ]);

    const suggestionsSet = new Set<string>();
    const searchSuggestionsList: {term: string, cliques: number}[] = [];

    // Add previous searches that match the prefix
    snapSearches.docs.forEach(d => {
      const data = d.data();
      const term = (data.termo || '').toLowerCase();
      if (term.includes(q)) {
        searchSuggestionsList.push({ term, cliques: data.cliques || 0 });
      }
    });

    // Add categories that match the query
    snapCategories.docs.forEach(d => {
      const catData = d.data();
      const catName = (catData.name || '').toLowerCase();
      if (catName.includes(q)) {
        suggestionsSet.add(catName);
      }
    });

    // Sort by cliques and add to set
    searchSuggestionsList
      .sort((a, b) => b.cliques - a.cliques)
      .forEach(s => suggestionsSet.add(s.term));

    const matchingProducts: any[] = [];
    
    // Build a category map for product preview filtering
    const categoryMap = new Map();
    snapCategories.docs.forEach(d => categoryMap.set(d.id, { id: d.id, ...d.data() }));

    // Extract relevant words from products and identify matching products for the preview
    snapProducts.docs.forEach(d => {
      const pData = d.data();
      const name = (pData.name || '').toLowerCase();
      const pTags = (pData.seo?.keywords || []).map((t: any) => String(t).toLowerCase());
      const aiKeywords = (pData.ai_keywords || []).map((k: any) => String(k).toLowerCase());
      const aiSynonyms = (pData.ai_synonyms || []).map((s: any) => String(s).toLowerCase());
      const allTags = [...pTags, ...aiKeywords, ...aiSynonyms];
      
      // Also match based on category name
      const catObj = pData.categoryId ? categoryMap.get(pData.categoryId) : null;
      const catName = (catObj?.name || '').toLowerCase();
      
      const isMatch = name.includes(q) || allTags.some(t => t.includes(q)) || catName.includes(q);

      if (isMatch && matchingProducts.length < 4) {
        matchingProducts.push({
          id: d.id,
          name: pData.name,
          price: pData.price,
          promoPrice: pData.promoPrice,
          imageUrl: pData.images?.find((img: any) => img.isMain)?.url || pData.images?.[0]?.url || '',
          slug: pData.seo?.slug
        });
      }

      if (suggestionsSet.size < 12) {
        if (name.includes(q)) {
          const parts = name.split(/\s+/);
          parts.forEach((p: string) => {
            if (p.startsWith(q) && p.length > 2) suggestionsSet.add(p);
          });
          if (name.length < 30) suggestionsSet.add(name);
        }

        allTags.forEach((t: string) => {
          if (t.startsWith(q) || (q.length > 3 && t.includes(q))) {
            suggestionsSet.add(t);
          }
        });
      }
    });

    const finalSuggestions = Array.from(suggestionsSet).slice(0, 6);
    res.json({
      suggestions: finalSuggestions,
      products: matchingProducts
    });
  } catch (error) {
    console.error('[GET_SUGGEST_ERROR]', error);
    res.status(500).json({ error: 'Erro ao buscar sugestões' });
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

    // Remover produtos que já estão no carrinho e aplicar filtros rigorosos (imagens, catálogo e estoque)
    const cartIds = items.map(i => i.id);
    let candidateProducts = allProducts.filter(p => {
      const isNotIdInCart = !cartIds.includes(p.id);
      const hasImage = p.images && p.images.length > 0;
      const showsInCatalog = p.extras?.showInCatalog !== false;
      const hasStock = p.allowBackorder || !p.controlStock || (Number(p.stock) > 0);
      return isNotIdInCart && p.active === true && hasImage && showsInCatalog && hasStock;
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
    const allProducts = catalogSnap.docs
      .map(d => ({ id: d.id, ...d.data() }) as any)
      .filter(p => {
        const hasImage = p.images && p.images.length > 0;
        const showsInCatalog = p.extras?.showInCatalog !== false;
        const hasStock = p.allowBackorder || !p.controlStock || (Number(p.stock) > 0);
        return p.active === true && hasImage && showsInCatalog && hasStock;
      });

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
          promoPrice: (p as any).promoPrice,
          imageUrl: mainImage,
          category: (p as any).categoryId || (p as any).category || '',
          categoryId: (p as any).categoryId || '',
          seo: (p as any).seo || null
        };
      })
    });
  } catch (error: any) {
    console.error('[SUGGEST_RELATED][ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const generateHomeCuratory = async (req: Request, res: Response) => {
  try {
    const productsRef = collection(db, 'products');
    const snap = await getDocs(query(productsRef, where('active', '==', true), limit(300))); // get enough to curate
    const all = snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as any)
      .filter(p => (p.images && p.images.length > 0) && (p.extras?.showInCatalog !== false));
    
    // Call AI to generate curation
    const result = await aiService.homeCuratory(all);

    res.json({ success: true, result });
  } catch (error: any) {
    console.error("Erro no generateHomeCuratory:", error);
    res.status(500).json({ error: error.message });
  }
};

export const analyzeCatalog = async (req: Request, res: Response) => {
  try {
    const { products, categories } = req.body;
    const result = await aiService.analyzeCatalog(products, categories);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateStrategicReport = async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Dados para análise não fornecidos' });
    }

    // Call AI Service with the data sent from the client
    const result = await aiService.generateStrategicReport(data);
    
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("Erro fatal no generateStrategicReport:", error);
    res.status(500).json({ error: error.message });
  }
};

export const rankOffers = async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Lista de produtos não informada' });
    }
    const rankedIds = await aiService.rankOffers(products);
    res.json(rankedIds);
  } catch (error: any) {
    console.error('[AI][RANK_OFFERS_CONTROLLER_ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
};

const GeneratePostsCalendarInput = z.object({
  brandRules: z.string(),
  objectives: z.string(),
  days: z.array(z.string()),
  postsPerDay: z.number().min(1).max(5)
});

export const generatePostsCalendar = async (req: Request, res: Response) => {
  try {
    const { brandRules, objectives, days, postsPerDay } = GeneratePostsCalendarInput.parse(req.body);
    const result = await aiService.generateMarketingCalendarPosts(brandRules, objectives, days, postsPerDay);
    res.json({ success: true, ideas: result.ideas || [] });
  } catch (error: any) {
    console.error('Erro ao gerar posts de marketing por IA:', error);
    res.status(500).json({ error: error.message });
  }
};

export const generateMarketingCopywriting = async (req: Request, res: Response) => {
  try {
    const { topic, tone, ctaGoal, format } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'O tópico/ideia é obrigatório para gerar copywriting' });
    }
    const result = await aiService.generateMarketingCopywriting(topic, tone, ctaGoal, format);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao gerar copywriting de marketing por IA:', error);
    res.status(500).json({ error: error.message });
  }
};

export const generateMarketingImage = async (req: Request, res: Response) => {
  try {
    const { prompt, referenceUrl } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'O prompt visual da imagem é obrigatório' });
    }
    const result = await aiService.generateMarketingImage(prompt, referenceUrl);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao gerar imagem de marketing por IA:', error);
    res.status(500).json({ error: error.message });
  }
};

export const marketingRewrite = async (req: Request, res: Response) => {
  try {
    const { originalCopy, instruction } = req.body;
    if (!originalCopy || !instruction) {
      return res.status(400).json({ error: 'Texto original e instruções são necessários para reescrever' });
    }
    const result = await aiService.marketingRewrite(originalCopy, instruction);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao reescrever copywriting por IA:', error);
    res.status(500).json({ error: error.message });
  }
};

export const analyzeCandidate = async (req: Request, res: Response) => {
  try {
    const { candidateData, customPrompt } = req.body;
    if (!candidateData) {
      return res.status(400).json({ error: 'candidateData é obrigatório' });
    }
    // Backend busca o prompt administrativo salvo em recruitmentSettings/main
    const settings = await candidateService.getSettings();
    const promptToUse = settings?.promptAnalise || customPrompt;

    const result = await aiService.analyzeCandidate(candidateData, promptToUse);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao analisar candidato por IA:', error);
    res.status(500).json({ error: error.message });
  }
};

export const recruitmentChat = async (req: Request, res: Response) => {
  try {
    const { messages, interviewId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Lista de mensagens inválida.' });
    }
    const settings = await candidateService.getSettings();
    if (!settings.isActive) {
      return res.status(400).json({ error: 'O formulário de candidaturas está temporariamente desativado pela gerência.' });
    }

    // Generate/retrieve a session ID for tracking this specific interview state
    const sessionKey = interviewId || req.ip || 'anonymous_interview';

    // Last user message
    const lastUserMsg = messages[messages.length - 1]?.text || '';

    // Import Interview Engine dynamically or require it
    const { interviewEngine } = await import('../services/interviewEngine.js');

    const result = await interviewEngine.processChatMessage(
      sessionKey,
      messages,
      lastUserMsg,
      settings
    );

    res.json({ responseText: result.responseText });
  } catch (error: any) {
    console.error('Erro no recruitmentChat:', error);
    res.status(500).json({ error: error.message });
  }
};

export const recruitmentExtract = async (req: Request, res: Response) => {
  try {
    const { messages, interviewId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Lista de mensagens inválida.' });
    }

    let structuredData: any = {};

    // 1. Try to retrieve incrementally extracted state
    if (interviewId) {
      try {
        const { interviewEngine } = await import('../services/interviewEngine.js');
        const state = await interviewEngine.getInterviewState(interviewId);
        if (state && state.structuredData && Object.keys(state.structuredData).length > 0) {
          structuredData = { ...state.structuredData };
        }
      } catch (err) {
        console.warn('[RECRUITMENT_EXTRACT] Failed to fetch pre-extracted state:', err);
      }
    }

    // 2. Perform a final extraction pass using the complete conversation to ensure all 26 fields are populated correctly and any blanks are filled
    const finalExtracted = await aiService.recruitmentExtract(messages);
    
    // Merge them together, prioritizing newly extracted values if they are more complete
    const mergedData = {
      ...finalExtracted,
      ...structuredData
    };

    // Ensure all fields have a value (fall back to "Não informado" instead of empty/null)
    const allFields = [
      'nomeCompleto', 'idade', 'cidade', 'bairro', 'whatsapp', 'email',
      'disponibilidadeHorario', 'disponibilidadeSabados', 'disponibilidadeEventos', 'quandoComecar', 'tipoInteresse',
      'experienciaProfissional', 'experienciaAtendimento', 'experienciaVendas', 'experienciaLoja', 'experienciaWhatsComercial', 'ultimaExperiencia', 'motivoSaida',
      'confortoProdutosIntimos', 'entendimentoDiscricao', 'comoLidariaClienteIndeciso', 'comoLidariaPerguntasIntimas', 'facilidadeInstagram',
      'pontoForte', 'pontoMelhorar', 'expectativaSalarial', 'mensagemFinal'
    ];

    for (const key of allFields) {
      if (!mergedData[key] || mergedData[key].toString().trim() === '') {
        mergedData[key] = finalExtracted[key] || 'Não informado';
      }
    }

    res.json(mergedData);
  } catch (error: any) {
    console.error('Erro no recruitmentExtract:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getRecruitmentSettings = async (req: Request, res: Response) => {
  try {
    const settings = await candidateService.getSettings();
    res.json({
      isActive: settings.isActive,
      recruiterName: settings.recruiterName,
      initialMessage: settings.initialMessage,
      finalMessage: settings.finalMessage,
      lgpdText: settings.lgpdText
    });
  } catch (error: any) {
    console.error('Erro no getRecruitmentSettings:', error);
    res.status(500).json({ error: error.message });
  }
};

export const aiController = {
  generateProduct,
  generateCategory,
  interpretSearch,
  trackClick,
  generateHomeCuratory,
  generateStrategicReport,
  analyzeCatalog,
  botConsult,
  suggestCartComplements,
  suggestRelatedProducts,
  enrichProduct,
  generateEmbedding,
  rankOffers,
  getSearchSuggestions,
  generatePostsCalendar,
  generateMarketingCopywriting,
  generateMarketingImage,
  marketingRewrite,
  analyzeCandidate,
  recruitmentChat,
  recruitmentExtract,
  getRecruitmentSettings
};
