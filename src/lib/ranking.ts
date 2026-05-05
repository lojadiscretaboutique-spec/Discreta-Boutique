import { Product } from '../services/productService';

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
    const keywords = (p.ai_keywords || []).join(' ').toLowerCase();
    const synonyms = (p.ai_synonyms || []).join(' ').toLowerCase();
    
    if (!aiSuggestion) {
      return 0;
    }

    const mainTerm = aiSuggestion.curadoria?.toLowerCase() || "";
    const caracteristicas = aiSuggestion.caracteristicas || [];
    const sinonimosSugeridos = aiSuggestion.sinonimos || [];
    
    // Core term matching
    if (name.includes(mainTerm)) score += 5;
    if (keywords.includes(mainTerm)) score += 3;
    if (synonyms.includes(mainTerm)) score += 2;
    if (desc.includes(mainTerm)) score += 1;

    // Features matching
    caracteristicas.forEach((c: string) => {
      const ct = c.toLowerCase();
      if (name.includes(ct)) score += 3;
      if (keywords.includes(ct)) score += 2;
      if (desc.includes(ct)) score += 1;
    });

    // Synonyms suggestion matching
    sinonimosSugeridos.forEach((s: string) => {
      const st = s.toLowerCase();
      if (name.includes(st)) score += 2;
      if (keywords.includes(st)) score += 1;
      if (synonyms.includes(st)) score += 1;
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
        const { _tempScore: _score, ...pWithoutScore } = p;
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
