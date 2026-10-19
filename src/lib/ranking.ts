import { Product } from '../services/productService';
import { normalizeSearchText, getWordVariations } from './utils';

export interface AISuggestion {
  termo_busca?: string;
  curadoria?: string;
  categoria?: string;
  caracteristicas?: string[];
  sinonimos?: string[];
  subcategorias_sugeridas?: string[];
}

export interface CategorySimple {
  id: string;
  name?: string;
  parentId?: string | null;
}

export type ExtendedProduct = Product & {
  oldPrice?: number;
  palavras_chave?: string[];
  categoryName?: string;
  _tempScore?: number;
  _searchScore?: number;
};

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
}

const getCreationDate = (createdAt?: Date | string | number | FirestoreTimestamp | null): Date => {
  if (!createdAt) return new Date();
  if (createdAt instanceof Date) {
    return isNaN(createdAt.getTime()) ? new Date() : createdAt;
  }
  if (typeof createdAt === 'number') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof createdAt === 'string') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt && typeof createdAt.seconds === 'number') {
    return new Date(createdAt.seconds * 1000);
  }
  return new Date();
};

export const getBaseScore = (p: Product): number => {
  if (!p) return 0;
  const extP = p as ExtendedProduct;
  const rawScore = typeof p.score === 'number' && !isNaN(p.score) ? p.score : 0;
  const creationDate = getCreationDate(p.createdAt);
  const now = Date.now();
  const timeDiff = Math.max(0, now - creationDate.getTime());
  const ageInDays = timeDiff / (24 * 60 * 60 * 1000);
  const decay = Math.pow(0.95, Math.floor(ageInDays / 7));

  let boost = 0;
  if (timeDiff < (30 * 24 * 60 * 60 * 1000)) boost += 10;

  const cliques = typeof p.cliques === 'number' && !isNaN(p.cliques) ? p.cliques : 0;
  const conversoes = typeof p.conversoes === 'number' && !isNaN(p.conversoes) ? p.conversoes : 0;
  const convRate = cliques > 5 ? conversoes / cliques : 0;
  if (convRate > 0.1) boost += 15;

  const oldPrice = typeof extP.oldPrice === 'number' && !isNaN(extP.oldPrice) ? extP.oldPrice : undefined;
  const promoPrice = typeof p.promoPrice === 'number' && !isNaN(p.promoPrice) ? p.promoPrice : undefined;
  const currentPrice = typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0;

  if (p.onSale || (oldPrice !== undefined && currentPrice < oldPrice) || (promoPrice !== undefined && promoPrice < currentPrice)) {
    boost += 5;
  }

  const result = (rawScore * decay) + boost;
  return isFinite(result) ? result : 0;
};

export const getHomeScore = (p: Product): number => {
  if (!p) return 0;
  const homeClicks = typeof p.homeClicks === 'number' && !isNaN(p.homeClicks) ? p.homeClicks : 0;
  const homeScore = typeof p.homeScore === 'number' && !isNaN(p.homeScore) ? p.homeScore : 0;
  const rawScore = typeof p.score === 'number' && !isNaN(p.score) ? p.score : 0;
  const rawCliques = typeof p.cliques === 'number' && !isNaN(p.cliques) ? p.cliques : 0;
  const conversoesVal = typeof p.conversoes === 'number' && !isNaN(p.conversoes) ? p.conversoes : 0;

  const scoreVal = homeScore > 0 ? homeScore : rawScore;
  const clicksVal = homeClicks > 0 ? homeClicks : rawCliques;

  const creationDate = getCreationDate(p.createdAt);
  const now = Date.now();
  const timeDiff = Math.max(0, now - creationDate.getTime());
  const ageInDays = timeDiff / (24 * 60 * 60 * 1000);

  const decay = Math.pow(0.97, Math.floor(ageInDays / 7));

  let recencyBoost = 0;
  if (ageInDays < 15) {
    recencyBoost += 40;
  } else if (ageInDays < 30) {
    recencyBoost += 15;
  }

  const result = (scoreVal * 3 * decay) + (clicksVal * 5 * decay) + (conversoesVal * 15 * decay) + recencyBoost;
  return isFinite(result) ? result : 0;
};

export const getMatchScore = (p: Product, aiSuggestion?: AISuggestion | null): number => {
  if (!p || !aiSuggestion) {
    return 0;
  }

  let score = 0;
  const name = (p.name || "").toLowerCase();
  const desc = `${(p.shortDescription || "").toLowerCase()} ${(p.fullDescription || "").toLowerCase()}`;
  const pTags = (p.seo?.keywords || []).map(t => String(t).toLowerCase());
  const aiKeywords = (p.ai_keywords || []).map(k => String(k).toLowerCase());
  const aiSynonyms = (p.ai_synonyms || []).map(s => String(s).toLowerCase());

  const mainTerm = (aiSuggestion.termo_busca || aiSuggestion.curadoria || "").toLowerCase();
  const sugestaoCat = aiSuggestion.categoria?.toLowerCase() || "";
  const caracteristicas = (aiSuggestion.caracteristicas || []).map((c: string) => String(c).toLowerCase());
  const sinonimosSugeridos = (aiSuggestion.sinonimos || []).map((s: string) => String(s).toLowerCase());
  const subcats = (aiSuggestion.subcategorias_sugeridas || []).map((s: string) => String(s).toLowerCase());

  // 1. Exact Match on name (Massive boost to keep it top)
  if (mainTerm) {
    if (name === mainTerm) score += 5000;
    else if (name.startsWith(mainTerm)) score += 2500;
    else if (name.includes(mainTerm)) score += 1500;

    const mainTermWords = mainTerm.split(/\s+/).filter((w: string) => w.length >= 2);
    if (mainTermWords.length > 1 && mainTermWords.every((w: string) => name.includes(w))) {
      score += 800;
    }
  }

  // 2. Categoria e Subcategoria sugeridas pela IA
  if (sugestaoCat && sugestaoCat !== 'outros') {
    if (pTags.includes(sugestaoCat)) score += 100;
  }

  subcats.forEach((sub: string) => {
    if (name.includes(sub)) score += 150;
    if (pTags.includes(sub)) score += 100;
  });

  // 3. Tags e Keywords
  const allProductKeywords = [...pTags, ...aiKeywords, ...aiSynonyms];
  allProductKeywords.forEach(tag => {
    const t = tag.toLowerCase();
    if (mainTerm && t === mainTerm) score += 300;
    else if (mainTerm && t.includes(mainTerm)) score += 100;

    caracteristicas.forEach((c: string) => {
      if (t.includes(c.toLowerCase())) score += 80;
    });
    sinonimosSugeridos.forEach((s: string) => {
      if (t === s.toLowerCase()) score += 150;
      else if (t.includes(s.toLowerCase())) score += 60;
    });
  });

  // 4. Features e Sinônimos no Nome
  caracteristicas.forEach((ct: string) => {
    const feature = ct.toLowerCase();
    if (name.includes(feature)) score += 120;
    if (desc.includes(feature)) score += 40;
  });

  sinonimosSugeridos.forEach((st: string) => {
    const syn = st.toLowerCase();
    if (name.includes(syn)) score += 100;
    if (desc.includes(syn)) score += 30;
  });

  return isFinite(score) ? score : 0;
};

/**
 * Calculates cosine similarity between two vectors.
 */
const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i] || 0;
    const valB = vecB[i] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;
  return isFinite(similarity) ? similarity : 0;
};

export const getRankingHybrid = (products: Product[], aiSuggestion?: AISuggestion | null, queryEmbedding?: number[]): Product[] => {
  if (!Array.isArray(products) || products.length === 0) return [];

  const scored = products.map(p => {
    const base = getBaseScore(p) * 0.01;
    const match = getMatchScore(p, aiSuggestion);

    let semanticBoost = 0;
    if (queryEmbedding && Array.isArray(queryEmbedding) && p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0) {
      const similarity = calculateCosineSimilarity(queryEmbedding, p.embedding);
      semanticBoost = similarity * 100;
    }

    const totalTempScore = base + match + semanticBoost;
    const safeScore = isFinite(totalTempScore) ? totalTempScore : 0;

    const extP: ExtendedProduct = {
      ...p,
      _tempScore: safeScore
    };
    return extP;
  });

  return scored
    .filter(p => (p._tempScore ?? 0) > 1)
    .sort((a, b) => (b._tempScore ?? 0) - (a._tempScore ?? 0))
    .map(p => {
      const { _tempScore, ...clean } = p;
      return clean as Product;
    });
};

export const hasDirectTextMatch = (p: Product, queryText: string, categories: CategorySimple[] = []): boolean => {
  if (!p) return false;

  // 1. Regra Estrita: Somente produtos ativos
  if (p.active === false || (p as any).status === 'inactive') {
    return false;
  }

  // 2. Regra Estrita: Somente produtos que contenham estoque
  const stockNum = typeof p.stock === 'number' ? p.stock : (Number(p.stock) || 0);
  const variantsStock = p.variants && Array.isArray(p.variants)
    ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || Number(v.variantStock) || 0), 0)
    : 0;
  const totalStock = Math.max(stockNum, variantsStock);

  if (!p.isCombo && totalStock <= 0) {
    return false;
  }

  if (!queryText || !queryText.trim()) return true;

  const extP = p as ExtendedProduct;
  const normalizedQuery = normalizeSearchText(queryText);
  if (!normalizedQuery) return true;

  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  const queryVariations = queryWords.flatMap(w => getWordVariations(w));
  const allSearchTerms = Array.from(new Set([normalizedQuery, ...queryWords, ...queryVariations]));

  // Nome e Subtítulo
  const name = normalizeSearchText(p.name || "");
  const subtitle = normalizeSearchText(p.subtitle || "");

  // Descrições
  const shortDesc = normalizeSearchText(p.shortDescription || "");
  const fullDesc = normalizeSearchText(p.fullDescription || "");
  const genericDesc = normalizeSearchText((p as any).description || "");
  const allDesc = `${shortDesc} ${fullDesc} ${genericDesc} ${subtitle}`;

  // Todos os campos do cadastro SEO
  const seoTitle = normalizeSearchText(p.seo?.title || p.seo?.metaTitle || "");
  const seoDesc = normalizeSearchText(p.seo?.description || p.seo?.metaDescription || "");
  const seoSlug = normalizeSearchText(p.seo?.slug || p.slug || "");
  const seoKeywordsRaw = Array.isArray(p.seo?.keywords) 
    ? p.seo.keywords.join(' ') 
    : String(p.seo?.keywords || '');
  const seoKeywords = normalizeSearchText(seoKeywordsRaw);
  const palavrasChave = Array.isArray(extP.palavras_chave)
    ? extP.palavras_chave.join(' ')
    : String(extP.palavras_chave || '');
  const aiKeywords = Array.isArray(p.ai_keywords) ? p.ai_keywords.join(' ') : '';
  const aiSynonyms = Array.isArray(p.ai_synonyms) ? p.ai_synonyms.join(' ') : '';
  const allSeo = `${seoTitle} ${seoDesc} ${seoSlug} ${seoKeywords} ${normalizeSearchText(palavrasChave)} ${normalizeSearchText(aiKeywords)} ${normalizeSearchText(aiSynonyms)}`;

  // Tags e Termos de Busca
  const tagsRaw = [
    ...(p.tags || []),
    ...(p.searchTerms || []),
  ].map(t => normalizeSearchText(String(t))).join(' ');

  // Categoria, Subcategoria e Marca
  let catName = normalizeSearchText(extP.categoryName || "");
  if (!catName && p.categoryId && Array.isArray(categories)) {
    const cat = categories.find(c => c && c.id === p.categoryId);
    if (cat) catName = normalizeSearchText(cat.name || "");
  }
  const subcat = normalizeSearchText(p.subcategory || (p as any).subcategoria || "");
  const brand = normalizeSearchText(p.brand || "");
  const allCat = `${catName} ${subcat} ${brand}`;

  // Códigos, SKU, GTIN, Barcode
  const sku = normalizeSearchText(p.sku || "");
  const iCode = normalizeSearchText(p.internalCode || "");
  const gtin = normalizeSearchText(p.gtin || (p as any).barcode || (p as any).ean || (p as any).codigoBarras || "");
  const variantTokens = p.variants && Array.isArray(p.variants)
    ? p.variants.map(v => `${v.name || ''} ${v.sku || ''} ${v.barcode || ''}`).join(' ')
    : '';
  const allCodes = `${sku} ${iCode} ${gtin} ${normalizeSearchText(variantTokens)}`;

  // Corpus unificado de pesquisa
  const fullCorpus = `${name} ${allDesc} ${allSeo} ${tagsRaw} ${allCat} ${allCodes}`;

  // Match direto na frase ou em qualquer palavra digitada ou variação
  if (fullCorpus.includes(normalizedQuery)) return true;
  return allSearchTerms.some(term => fullCorpus.includes(term));
};

// Ranking Sections
const pick = (list: Product[], count: number, usedIds: Set<string>): Product[] => {
  if (!Array.isArray(list) || list.length === 0 || count <= 0) return [];
  const available = list.filter(p => p && p.id && !usedIds.has(p.id));
  const selected = available.slice(0, count);
  selected.forEach(p => {
    if (p.id) usedIds.add(p.id);
  });
  return selected;
};

export const getLancamentos = (all: Product[], used: Set<string>): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].sort((a, b) => {
    const scoreB = getHomeScore(b);
    const scoreA = getHomeScore(a);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getCreationDate(b.createdAt).getTime() - getCreationDate(a.createdAt).getTime();
  }), 10, used);
};

export const getDestaques = (all: Product[], used: Set<string>): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].filter(p => p && p.featured).sort((a, b) => getHomeScore(b) - getHomeScore(a)), 10, used);
};

export const getMaisVendidos = (all: Product[], used: Set<string>): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].sort((a, b) => getHomeScore(b) - getHomeScore(a)), 10, used);
};

export const getEmAlta = (all: Product[], used: Set<string>): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].sort((a, b) => getHomeScore(b) - getHomeScore(a)), 10, used);
};

export const getRecomendados = (all: Product[], used: Set<string>): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].sort((a, b) => getHomeScore(b) - getHomeScore(a)), 10, used);
};

export const fillFallback = (all: Product[], used: Set<string>, count: number): Product[] => {
  if (!Array.isArray(all)) return [];
  return pick([...all].sort((a, b) => getHomeScore(b) - getHomeScore(a)), count, used);
};

export const getRankingBusca = (products: Product[], aiSuggestion?: AISuggestion | null): Product[] => {
  return getRankingHybrid(products, aiSuggestion);
};

export const getRankingProfissional = (products: Product[], queryText: string, categories: CategorySimple[] = []): Product[] => {
  if (!Array.isArray(products) || products.length === 0) return [];

  // Se não houver texto de busca, retorna apenas produtos ativos e com estoque
  if (!queryText || !queryText.trim()) {
    return products.filter(p => {
      if (p.active === false || (p as any).status === 'inactive') return false;
      const stockNum = typeof p.stock === 'number' ? p.stock : (Number(p.stock) || 0);
      const variantsStock = p.variants && Array.isArray(p.variants)
        ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || Number(v.variantStock) || 0), 0)
        : 0;
      return p.isCombo || Math.max(stockNum, variantsStock) > 0;
    });
  }

  const normalizedQuery = normalizeSearchText(queryText);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

  // Filtra produtos que atendem os critérios: ativos, com estoque e que contêm o termo
  const matchedProducts = products.filter(p => hasDirectTextMatch(p, queryText, categories));

  const ranked = matchedProducts.map(p => {
    const extP = p as ExtendedProduct;
    let score = 0;

    const name = normalizeSearchText(p.name || "");
    const subtitle = normalizeSearchText(p.subtitle || "");

    const shortDesc = normalizeSearchText(p.shortDescription || "");
    const fullDesc = normalizeSearchText(p.fullDescription || "");
    const genericDesc = normalizeSearchText((p as any).description || "");
    const allDesc = `${shortDesc} ${fullDesc} ${genericDesc} ${subtitle}`;

    const seoTitle = normalizeSearchText(p.seo?.title || p.seo?.metaTitle || "");
    const seoDesc = normalizeSearchText(p.seo?.description || p.seo?.metaDescription || "");
    const seoSlug = normalizeSearchText(p.seo?.slug || p.slug || "");
    const seoKeywords = normalizeSearchText(
      Array.isArray(p.seo?.keywords) ? p.seo.keywords.join(' ') : String(p.seo?.keywords || '')
    );
    const palavrasChave = normalizeSearchText(
      Array.isArray(extP.palavras_chave) ? extP.palavras_chave.join(' ') : String(extP.palavras_chave || '')
    );
    const seoGoogleCategory = normalizeSearchText(p.seo?.googleCategory || "");
    const aiKeywords = Array.isArray(p.ai_keywords) ? p.ai_keywords.join(' ') : '';
    const aiSynonyms = Array.isArray(p.ai_synonyms) ? p.ai_synonyms.join(' ') : '';
    const allSeo = `${seoTitle} ${seoDesc} ${seoSlug} ${seoKeywords} ${seoGoogleCategory} ${palavrasChave} ${normalizeSearchText(aiKeywords)} ${normalizeSearchText(aiSynonyms)}`;

    const tags = [
      ...(p.tags || []),
      ...(p.searchTerms || []),
      ...(p.ai_keywords || []),
      ...(p.ai_synonyms || [])
    ].map(t => normalizeSearchText(String(t))).join(' ');

    let catName = normalizeSearchText(extP.categoryName || "");
    if (!catName && p.categoryId && Array.isArray(categories)) {
      const cat = categories.find(c => c && c.id === p.categoryId);
      if (cat) catName = normalizeSearchText(cat.name || "");
    }
    const subcat = normalizeSearchText(p.subcategory || (p as any).subcategoria || "");
    const brand = normalizeSearchText(p.brand || "");
    const allCat = `${catName} ${subcat} ${brand}`;

    const sku = normalizeSearchText(p.sku || "");
    const iCode = normalizeSearchText(p.internalCode || "");
    const gtin = normalizeSearchText(p.gtin || (p as any).barcode || (p as any).ean || (p as any).codigoBarras || "");
    const variantTokens = p.variants && Array.isArray(p.variants)
      ? p.variants.map(v => `${v.name || ''} ${v.sku || ''} ${v.barcode || ''}`).join(' ')
      : '';
    const allCodes = `${sku} ${iCode} ${gtin} ${normalizeSearchText(variantTokens)}`;

    // 1. MATCH NA FRASE COMPLETA DIGITADA
    if (name === normalizedQuery) {
      score += 10000; // Nome exato
    } else if (name.startsWith(normalizedQuery)) {
      score += 6000; // Começa com a frase
    } else if (name.includes(normalizedQuery)) {
      score += 4000; // Contém a frase no nome
      score += Math.max(0, 500 - (name.length - normalizedQuery.length) * 5);
    }

    if (seoTitle.includes(normalizedQuery)) {
      score += 2500;
    }
    if (allCodes.includes(normalizedQuery)) {
      score += 2000;
    }
    if (seoKeywords.includes(normalizedQuery) || tags.includes(normalizedQuery)) {
      score += 1800;
    }
    if (allCat.includes(normalizedQuery)) {
      score += 1400;
    }
    if (allDesc.includes(normalizedQuery) || seoDesc.includes(normalizedQuery)) {
      score += 1000;
    }

    // 2. TODAS AS PALAVRAS PRESENTES NO NOME
    const allWordsInName = queryWords.length > 1 && queryWords.every(word => {
      const vars = getWordVariations(word);
      return vars.some(v => name.includes(v));
    });
    if (allWordsInName) {
      score += 3000;
    }

    // 3. PONTUAÇÃO POR CADA PALAVRA INDIVIDUAL DIGITADA
    let matchedWordsCount = 0;
    queryWords.forEach(word => {
      const variations = getWordVariations(word);
      let wordFound = false;

      // Nome
      if (variations.some(v => name.includes(v))) {
        score += 400;
        wordFound = true;
        if (variations.some(v => name.startsWith(v))) score += 150;
      }

      // SEO Title
      if (variations.some(v => seoTitle.includes(v))) {
        score += 300;
        wordFound = true;
      }

      // SEO Keywords & Tags
      if (variations.some(v => seoKeywords.includes(v) || tags.includes(v))) {
        score += 200;
        wordFound = true;
      }

      // Códigos (SKU, GTIN)
      if (variations.some(v => allCodes.includes(v))) {
        score += 200;
        wordFound = true;
      }

      // Categoria / Subcategoria / Marca
      if (variations.some(v => allCat.includes(v))) {
        score += 150;
        wordFound = true;
      }

      // Descrição & SEO Description
      if (variations.some(v => allDesc.includes(v) || seoDesc.includes(v))) {
        score += 100;
        wordFound = true;
      }

      if (wordFound) {
        matchedWordsCount++;
      }
    });

    // 4. MULTIPLICADOR DE COBERTURA DE TERMOS
    if (queryWords.length > 1) {
      const coverage = matchedWordsCount / queryWords.length;
      if (coverage === 1) {
        score = Math.round(score * 1.8);
      } else if (coverage >= 0.5) {
        score = Math.round(score * 1.2);
      }
    }

    return {
      product: p,
      score: score
    };
  });

  // Ordena estritamente de acordo com o que o cliente digitou (maior pontuação primeiro)
  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.product.name || '').localeCompare(b.product.name || '');
  });

  return ranked.map(r => r.product);
};
