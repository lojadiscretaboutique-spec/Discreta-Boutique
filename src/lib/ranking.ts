import { Product } from '../services/productService';
import { normalizeSearchText, getWordVariations } from './utils';

const getCreationDate = (createdAt?: Date | string | null | any) => {
    if (!createdAt) return new Date();
    if (createdAt instanceof Date) return createdAt;
    if (typeof createdAt === 'string') return new Date(createdAt);
    if (typeof createdAt === 'object' && 'seconds' in (createdAt as any)) {
        return new Date((createdAt as any).seconds * 1000);
    }
    return new Date();
}

export const getBaseScore = (p: Product) => {
  let score = p.score || 0;
  const creationDate = getCreationDate(p.createdAt);
  const ageInDays = (Date.now() - creationDate.getTime()) / (24 * 60 * 60 * 1000);
  const decay = Math.pow(0.95, Math.floor(ageInDays / 7));
  
  let boost = 0;
  if ((Date.now() - creationDate.getTime()) < (30 * 24 * 60 * 60 * 1000)) boost += 10;
  const convRate = p.cliques && p.cliques > 5 ? (p.conversoes || 0) / p.cliques : 0;
  if (convRate > 0.1) boost += 15;
  if (p.onSale || (p.oldPrice && p.price < p.oldPrice)) boost += 5;
  
  return (score * decay) + boost;
};

export const getMatchScore = (p: Product, aiSuggestion: any) => {
    let score = 0;
    const name = p.name.toLowerCase();
    const desc = `${(p.shortDescription || "").toLowerCase()} ${(p.fullDescription || "").toLowerCase()}`;
    const pTags = (p.seo?.keywords || []).map(t => t.toLowerCase());
    
    if (!aiSuggestion) {
      return 0;
    }

    const mainTerm = aiSuggestion.curadoria?.toLowerCase() || "";
    const sugestaoCat = aiSuggestion.categoria?.toLowerCase() || "";
    const caracteristicas = (aiSuggestion.caracteristicas || []).map((c: string) => c.toLowerCase());
    const sinonimosSugeridos = (aiSuggestion.sinonimos || []).map((s: string) => s.toLowerCase());
    const subcats = (aiSuggestion.subcategorias_sugeridas || []).map((s: string) => s.toLowerCase());

    // 1. Categoria e Subcategoria sugeridas pela IA (Boost máximo)
    if (sugestaoCat && sugestaoCat !== 'outros') {
       if (pTags.includes(sugestaoCat)) score += 15;
    }
    
    // Boost específico para subcategorias encontradas no nome ou tags
    subcats.forEach((sub: string) => {
      if (name.includes(sub)) score += 20; // Prioridade máxima: Subcategoria
      if (pTags.includes(sub)) score += 18;
    });

    // 2. Tags e Keywords (Boost alto)
    pTags.forEach(tag => {
       const t = tag.toLowerCase();
       if (mainTerm.includes(t) || t.includes(mainTerm)) score += 25;
       caracteristicas.forEach(c => {
         if (t.includes(c.toLowerCase())) score += 15;
       });
       sinonimosSugeridos.forEach(s => {
         if (t.includes(s.toLowerCase())) score += 10;
       });
    });

    // 3. Core term matching no Nome (Boost médio-alto)
    if (name.includes(mainTerm)) score += 15;
    
    // 4. Features e Sinônimos no Nome e Atributos (Boost médio)
    caracteristicas.forEach((ct: string) => {
      const feature = ct.toLowerCase();
      if (name.includes(feature)) score += 12;
      if (pTags.some(t => t.toLowerCase().includes(feature))) score += 8;
      if (desc.includes(feature)) score += 5;
    });

    // 5. Descrição (Boost baixo)
    if (desc.includes(mainTerm)) score += 5;
    sinonimosSugeridos.forEach((st: string) => {
      const syn = st.toLowerCase();
      if (name.includes(syn)) score += 10;
      if (desc.includes(syn)) score += 4;
    });
    
    return score;
};

/**
 * Calculates cosine similarity between two vectors.
 */
const calculateCosineSimilarity = (vecA: number[], vecB: number[]) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(similarity) ? 0 : similarity;
};

export const getRankingHybrid = (products: Product[], aiSuggestion: any, queryEmbedding?: number[]): Product[] => {
    return [...products].map(p => {
        const base = getBaseScore(p);
        const match = getMatchScore(p, aiSuggestion);
        
        let semanticBoost = 0;
        if (queryEmbedding && p.embedding && p.embedding.length > 0) {
            const similarity = calculateCosineSimilarity(queryEmbedding, p.embedding);
            // Boost semantic similarity (range 0 to 1, multiplied to give it weight)
            semanticBoost = similarity * 20; 
        }

        return {
            ...p,
            _tempScore: base + match + semanticBoost
        };
    })
    .sort((a: any, b: any) => b._tempScore - a._tempScore)
    .map((p: any) => {
        const { _tempScore, ...pWithoutScore } = p;
        return pWithoutScore as Product;
    });
};

// Ranking Sections
const pick = (list: Product[], count: number, usedIds: Set<string>): Product[] => {
    const available = list.filter(p => !usedIds.has(p.id!));
    const selected = available.slice(0, count);
    selected.forEach(p => usedIds.add(p.id!));
    return selected;
};

export const getLancamentos = (all: Product[], used: Set<string>) => pick(all.sort((a, b) => getCreationDate(b.createdAt).getTime() - getCreationDate(a.createdAt).getTime()), 10, used);
export const getDestaques = (all: Product[], used: Set<string>) => pick(all.filter(p => p.featured).sort((a, b) => getBaseScore(b) - getBaseScore(a)), 10, used);
export const getMaisVendidos = (all: Product[], used: Set<string>) => pick(all.sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0) || getBaseScore(b) - getBaseScore(a)), 10, used);
export const getEmAlta = (all: Product[], used: Set<string>) => pick(all.sort((a, b) => {
    const ageA = (Date.now() - getCreationDate(a.createdAt).getTime()) / (24*60*60*1000) + 1;
    const ageB = (Date.now() - getCreationDate(b.createdAt).getTime()) / (24*60*60*1000) + 1;
    return ((b.score||0)/ageB) - ((a.score||0)/ageA);
}), 10, used);
export const getRecomendados = (all: Product[], used: Set<string>) => pick(all.sort((a, b) => getBaseScore(b) - getBaseScore(a)), 10, used);
export const fillFallback = (all: Product[], used: Set<string>, count: number) => pick(all.sort((a, b) => getBaseScore(b) - getBaseScore(a)), count, used);

export const getRankingBusca = (products: Product[], aiSuggestion: any): Product[] => {
    return getRankingHybrid(products, aiSuggestion);
};

export const getRankingProfissional = (products: Product[], queryText: string, categories: any[] = []): Product[] => {
    if (!queryText.trim()) return products;

    const normalizedQuery = normalizeSearchText(queryText);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);
    const queryVariations = queryWords.flatMap(w => getWordVariations(w));
    const allSearchTerms = Array.from(new Set([...queryWords, ...queryVariations, normalizedQuery]));

    console.log(`[SEARCH][RANKING] Query: "${queryText}" | Terms:`, allSearchTerms);

    const startTime = Date.now();

    const ranked = products.map(p => {
        let score = 0;
        const name = normalizeSearchText(p.name);
        const desc = normalizeSearchText(`${p.shortDescription || ""} ${p.fullDescription || ""} ${p.subtitle || ""}`);
        const subcat = normalizeSearchText(p.subcategory || "");
        const catObj = categories.find(c => c.id === p.categoryId);
        const catName = normalizeSearchText(catObj?.name || "");
        
        const tags = [
            ...(p.tags || []),
            ...(p.seo?.keywords || []),
            ...(p.ai_keywords || []),
            ...(p.searchTerms || []),
            ...(p.palavras_chave || [])
        ].map(t => normalizeSearchText(String(t)));

        // 1. Nome exato ou parcial (Prioridade Máxima)
        if (name === normalizedQuery) score += 500; // Match exato total
        if (name.includes(normalizedQuery)) score += 100;
        
        queryWords.forEach(word => {
            if (name.includes(word)) score += 20;
        });

        // 2. Subcategoria (+60)
        if (subcat && allSearchTerms.some(t => subcat.includes(t) || t.includes(subcat))) {
            score += 60;
        }

        // 3. Tags (+40)
        tags.forEach(tag => {
            if (allSearchTerms.some(t => tag.includes(t) || t.includes(tag))) {
                score += 40;
            }
        });

        // 4. Categoria (+20)
        if (catName && allSearchTerms.some(t => catName.includes(t) || t.includes(catName))) {
            score += 20;
        }

        // 5. Keywords/SEO (+20) - Já estamos olhando nas tags acima, mas podemos reforçar
        // p.seo?.keywords.forEach(...)

        // 6. Descrição (+10)
        if (allSearchTerms.some(t => desc.includes(t))) {
            score += 10;
        }

        // 7. Sku / Código Interno (Boost importante para busca técnica)
        const sku = normalizeSearchText(p.sku || "");
        const iCode = normalizeSearchText(p.internalCode || "");
        if (normalizedQuery === sku || normalizedQuery === iCode) score += 200;

        // Base score decay (recência e performance)
        const base = getBaseScore(p) * 0.1; // Reduced weight for search context

        return { ...p, _searchScore: score + base };
    });

    // Filtrar apenas os que possuem algum match (score > 0)
    // Se a busca for vazia ou não houver match, retornamos o que foi passado (ou tratamos no CatalogPage)
    const results = ranked
        .filter(p => (p as any)._searchScore > 0.5) // 0.5 to allow tiny base scores if needed, but usually we want a match
        .sort((a, b) => (b as any)._searchScore - (a as any)._searchScore)
        .map(p => {
            const { _searchScore, ...clean } = p as any;
            return clean as Product;
        });

    console.log(`[SEARCH][RANKING] Found ${results.length} results in ${Date.now() - startTime}ms`);
    return results;
};
