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
    const pTags = (p.seo?.keywords || []).map(t => String(t).toLowerCase());
    const aiKeywords = (p.ai_keywords || []).map(k => String(k).toLowerCase());
    const aiSynonyms = (p.ai_synonyms || []).map(s => String(s).toLowerCase());
    
    if (!aiSuggestion) {
      return 0;
    }

    const mainTerm = (aiSuggestion.termo_busca || aiSuggestion.curadoria || "").toLowerCase();
    const sugestaoCat = aiSuggestion.categoria?.toLowerCase() || "";
    const caracteristicas = (aiSuggestion.caracteristicas || []).map((c: string) => c.toLowerCase());
    const sinonimosSugeridos = (aiSuggestion.sinonimos || []).map((s: string) => s.toLowerCase());
    const subcats = (aiSuggestion.subcategorias_sugeridas || []).map((s: string) => s.toLowerCase());

    // 1. Exact Match on name (Massive boost to keep it top)
    if (name === mainTerm) score += 5000;
    if (name.startsWith(mainTerm)) score += 2500;
    if (name.includes(mainTerm)) score += 1500;

    // Bonus for matching all words from the main term
    const mainTermWords = mainTerm.split(/\s+/).filter((w: string) => w.length >= 2);
    if (mainTermWords.length > 1 && mainTermWords.every((w: string) => name.includes(w))) {
      score += 800;
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
       if (mainTerm && (t === mainTerm)) score += 300;
       if (mainTerm && t.includes(mainTerm)) score += 100;
       
       caracteristicas.forEach(c => {
         if (t.includes(c.toLowerCase())) score += 80;
       });
       sinonimosSugeridos.forEach(s => {
         if (t === s.toLowerCase()) score += 150; // Exact synonym match
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
        const base = getBaseScore(p) * 0.01; // Base metrics are secondary in search
        const match = getMatchScore(p, aiSuggestion);
        
        let semanticBoost = 0;
        if (queryEmbedding && p.embedding && p.embedding.length > 0) {
            const similarity = calculateCosineSimilarity(queryEmbedding, p.embedding);
            semanticBoost = similarity * 100; 
        }

        return {
            ...p,
            _tempScore: base + match + semanticBoost
        };
    })
    .filter(p => (p as any)._tempScore > 1) // Filter out clearly unrelated items if there's AI context
    .sort((a: any, b: any) => b._tempScore - a._tempScore)
    .map((p: any) => {
        const { _tempScore: _unused, ...pWithoutScore } = p;
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

    // Criar mapa de categorias para busca rápida de pais
    const categoryMap = new Map();
    categories.forEach(c => categoryMap.set(c.id, c));

    const getAncestors = (catId: string): any[] => {
        const ancestors: any[] = [];
        let currentId = catId;
        const visited = new Set(); // Prevenir loops
        
        while (currentId && categoryMap.has(currentId) && !visited.has(currentId)) {
            visited.add(currentId);
            const cat = categoryMap.get(currentId);
            ancestors.push(cat);
            currentId = cat.parentId;
        }
        return ancestors;
    };

    const ranked = products.map(p => {
        let score = 0;
        const name = normalizeSearchText(p.name);
        const desc = normalizeSearchText(`${p.shortDescription || ""} ${p.fullDescription || ""} ${p.subtitle || ""}`);
        const subcat = normalizeSearchText(p.subcategory || "");
        
        // Categorias e Ancestrais (Hierarquia: Pai e Filhas)
        const ancestors = p.categoryId ? getAncestors(p.categoryId) : [];
        const catNames = ancestors.map(a => normalizeSearchText(a.name));
        
        const tags = [
            ...(p.tags || []),
            ...(p.seo?.keywords || []),
            ...(p.ai_keywords || []),
            ...(p.ai_synonyms || []),
            ...(p.searchTerms || []),
            ...(p.palavras_chave || [])
        ].map(t => normalizeSearchText(String(t)));

        // 1. Nome exato ou parcial (Prioridade Máxima)
        const allWordsInName = queryWords.every(word => name.includes(word));
        const exactPhraseMatch = name.includes(normalizedQuery);
        const startsWithPhrase = name.startsWith(normalizedQuery);

        if (name === normalizedQuery) {
            score += 5000; // Match exato total - o suprassumo da busca
        } else if (startsWithPhrase) {
            score += 2000; // Começa exatamente com a frase buscada
        } else if (exactPhraseMatch) {
            score += 1500; // Contém a frase exata em qualquer lugar do nome
            
            // Bônus se a frase exata estiver "limpa" (sem muitas palavras extras ao redor)
            const queryLength = normalizedQuery.split(' ').length;
            const nameLength = name.split(' ').length;
            if (nameLength <= queryLength + 2) score += 500;
        } else if (allWordsInName) {
            score += 1000;  // Contém todas as palavras, mesmo que dispersas
            
            // Verificar ordem das palavras para reforçar match sequencial
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
        
        // Bônus por palavras individuais no nome
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

        // Penalidade para nomes que não contém a maioria das palavras buscadas se a busca for longa
        if (queryWords.length >= 3 && wordsMatched < Math.ceil(queryWords.length / 2)) {
            score -= 500; // Forte penalidade para "ruído"
        }

        // Penalidade para nomes muito longos se for uma busca curta (precisão por densidade)
        if (exactPhraseMatch && name.length > normalizedQuery.length + 30) {
            score -= 150; // Reduz mais agressivamente se houver muito texto extra irrelevante
        }

        // 2. Subcategoria (+120)
        if (subcat && (subcat === normalizedQuery || allSearchTerms.some(t => subcat.includes(t) || t.includes(subcat)))) {
            score += 120;
        }

        // 3. Tags e Synonyms (+80)
        tags.forEach(tag => {
            if (tag === normalizedQuery) score += 400; // Match exato com tag/keyword
            if (allSearchTerms.some(t => tag.includes(t) || t.includes(tag))) {
                score += 150;
            }
        });

        // 4. Categorias (Pai e Filhas) (+400 para match exato, +100 para parcial)
        catNames.forEach(cName => {
            if (cName === normalizedQuery) score += 400; // Match exato com nome da categoria (pai ou filha)
            else if (allSearchTerms.some(t => cName.includes(t) || t.includes(cName))) {
                score += 100; // Match parcial
            }
        });

        // 5. Keywords/SEO (+20) - Já estamos olhando nas tags acima, mas podemos reforçar
        // p.seo?.keywords.forEach(...)

        // 6. Descrição (+30 para parcial, +100 para todas as palavras)
        const allWordsInDesc = queryWords.every(word => desc.includes(word));
        if (allWordsInDesc) {
            score += 100;
        } else if (queryWords.some(word => desc.includes(word))) {
            score += 30;
        }

        // 7. Sku / Código Interno (Boost importante para busca técnica)
        const sku = normalizeSearchText(p.sku || "");
        const iCode = normalizeSearchText(p.internalCode || "");
        if (normalizedQuery === sku || normalizedQuery === iCode) score += 500;
        else if (sku.includes(normalizedQuery) || (iCode && iCode.includes(normalizedQuery))) score += 200;

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
            const { _searchScore: _unusedScore, ...clean } = p as any;
            return clean as Product;
        });

    console.log(`[SEARCH][RANKING] Found ${results.length} results in ${Date.now() - startTime}ms`);
    return results;
};
