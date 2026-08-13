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
  if (!queryText || !queryText.trim()) return true;

  const extP = p as ExtendedProduct;
  const normalizedQuery = normalizeSearchText(queryText);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);

  const term = normalizedQuery.trim();
  if (!term) return false;

  // 1. Nome do Produto (ou todas as palavras dele se for busca multi-termo)
  const name = normalizeSearchText(p.name || "");
  if (name.includes(term)) return true;
  if (queryWords.length > 0 && queryWords.every(word => name.includes(word))) return true;

  // 2. SKU, Código Interno / GTIN
  const sku = normalizeSearchText(p.sku || "");
  const iCode = normalizeSearchText(p.internalCode || "");
  const gtin = normalizeSearchText(p.gtin || "");
  if (sku.includes(term) || iCode.includes(term) || gtin.includes(term)) return true;

  // 3. Subcategoria
  const subcat = normalizeSearchText(p.subcategory || "");
  if (subcat.includes(term)) return true;

  // 4. Tags / Palavras-chave / Sinônimos / Buscas
  const tags = [
    ...(p.tags || []),
    ...(p.seo?.keywords || []),
    ...(p.ai_keywords || []),
    ...(p.ai_synonyms || []),
    ...(p.searchTerms || []),
    ...(extP.palavras_chave || [])
  ].map(t => normalizeSearchText(String(t)));

  if (tags.some(tag => tag.includes(term) || term.includes(tag))) return true;
  if (queryWords.length > 0 && queryWords.some(word => tags.some(tag => tag.includes(word)))) return true;

  // 5. Categoria
  if (p.categoryId) {
    const catNameDirect = normalizeSearchText(extP.categoryName || "");
    if (catNameDirect.includes(term)) return true;

    if (Array.isArray(categories)) {
      const cat = categories.find(c => c && c.id === p.categoryId);
      if (cat) {
        const catName = normalizeSearchText(cat.name || "");
        if (catName.includes(term)) return true;
      }
    }
  }

  // 6. Descrição (Se as palavras da busca constam na descrição)
  const desc = normalizeSearchText(`${p.shortDescription || ""} ${p.fullDescription || ""} ${p.subtitle || ""}`);
  if (desc.includes(term)) return true;
  if (queryWords.length > 0 && queryWords.every(word => desc.includes(word))) return true;

  return false;
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
  if (!queryText || !queryText.trim()) return products;

  const normalizedQuery = normalizeSearchText(queryText);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);
  const queryVariations = queryWords.flatMap(w => getWordVariations(w));
  const allSearchTerms = Array.from(new Set([...queryWords, ...queryVariations, normalizedQuery]));

  console.log(`[SEARCH][RANKING] Query: "${queryText}" | Terms:`, allSearchTerms);

  const startTime = Date.now();

  const exactMatchedProducts = products.filter(p => hasDirectTextMatch(p, queryText, categories));

  const categoryMap = new Map<string, CategorySimple>();
  if (Array.isArray(categories)) {
    categories.forEach(c => {
      if (c && c.id) categoryMap.set(c.id, c);
    });
  }

  const getAncestors = (catId: string): CategorySimple[] => {
    const ancestors: CategorySimple[] = [];
    let currentId = catId;
    const visited = new Set<string>();

    while (currentId && categoryMap.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const cat = categoryMap.get(currentId);
      if (cat) {
        ancestors.push(cat);
        currentId = cat.parentId || "";
      } else {
        break;
      }
    }
    return ancestors;
  };

  const ranked = exactMatchedProducts.map(p => {
    const extP = p as ExtendedProduct;
    let score = 0;
    const name = normalizeSearchText(p.name || "");
    const desc = normalizeSearchText(`${p.shortDescription || ""} ${p.fullDescription || ""} ${p.subtitle || ""}`);
    const subcat = normalizeSearchText(p.subcategory || "");

    const ancestors = p.categoryId ? getAncestors(p.categoryId) : [];
    const catNames = ancestors.map(a => normalizeSearchText(a.name || ""));

    const tags = [
      ...(p.tags || []),
      ...(p.seo?.keywords || []),
      ...(p.ai_keywords || []),
      ...(p.ai_synonyms || []),
      ...(p.searchTerms || []),
      ...(extP.palavras_chave || [])
    ].map(t => normalizeSearchText(String(t)));

    const allWordsInName = queryWords.length > 0 && queryWords.every(word => name.includes(word));
    const exactPhraseMatch = name.includes(normalizedQuery);
    const startsWithPhrase = name.startsWith(normalizedQuery);

    if (name === normalizedQuery) {
      score += 5000;
    } else if (startsWithPhrase) {
      score += 2000;
    } else if (exactPhraseMatch) {
      score += 1500;

      const queryLength = normalizedQuery.split(' ').length;
      const nameLength = name.split(' ').length;
      if (nameLength <= queryLength + 2) score += 500;
    } else if (allWordsInName) {
      score += 1000;

      let lastIndex = -1;
      let sequential = true;
      for (const word of queryWords) {
        const currentIndex = name.indexOf(word);
        if (currentIndex < lastIndex) {
          sequential = false;
          break;
        }
        lastIndex = currentIndex;
      }
      if (sequential) score += 300;
    }

    let wordsMatched = 0;
    queryWords.forEach(word => {
      if (name === word) {
        score += 300;
        wordsMatched++;
      } else if (name.includes(word)) {
        score += 100;
        wordsMatched++;
      }
    });

    if (queryWords.length >= 3 && wordsMatched < Math.ceil(queryWords.length / 2)) {
      score -= 500;
    }

    if (exactPhraseMatch && name.length > normalizedQuery.length + 30) {
      score -= 150;
    }

    if (subcat && (subcat === normalizedQuery || allSearchTerms.some(t => subcat.includes(t) || t.includes(subcat)))) {
      score += 120;
    }

    tags.forEach(tag => {
      if (tag === normalizedQuery) score += 400;
      if (allSearchTerms.some(t => tag.includes(t) || t.includes(tag))) {
        score += 150;
      }
    });

    catNames.forEach(cName => {
      if (cName === normalizedQuery) score += 400;
      else if (allSearchTerms.some(t => cName.includes(t) || t.includes(cName))) {
        score += 100;
      }
    });

    const allWordsInDesc = queryWords.length > 0 && queryWords.every(word => desc.includes(word));
    if (allWordsInDesc) {
      score += 100;
    } else if (queryWords.some(word => desc.includes(word))) {
      score += 30;
    }

    const sku = normalizeSearchText(p.sku || "");
    const iCode = normalizeSearchText(p.internalCode || "");
    if (normalizedQuery === sku || normalizedQuery === iCode) score += 500;
    else if (sku.includes(normalizedQuery) || (iCode && iCode.includes(normalizedQuery))) score += 200;

    const base = getBaseScore(p) * 0.1;

    const safeFinalScore = isFinite(score + base) ? score + base : 0;

    const rankedExtProduct: ExtendedProduct = {
      ...p,
      _searchScore: safeFinalScore
    };
    return rankedExtProduct;
  });

  const results = ranked
    .sort((a, b) => (b._searchScore ?? 0) - (a._searchScore ?? 0))
    .map(p => {
      const { _searchScore, ...clean } = p;
      return clean as Product;
    });

  console.log(`[SEARCH][RANKING] Found ${results.length} results in ${Date.now() - startTime}ms`);
  return results;
};
