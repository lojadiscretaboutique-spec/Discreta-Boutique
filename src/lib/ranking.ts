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
    if (!aiSuggestion) return 0;
    let score = 0;
    const name = p.name.toLowerCase();
    const desc = `${(p.shortDescription || "").toLowerCase()} ${(p.fullDescription || "").toLowerCase()}`;
    const mainTerm = aiSuggestion.curadoria?.toLowerCase() || "";
    const caracteristicas = aiSuggestion.caracteristicas || [];
    const sinonimos = aiSuggestion.sinonimos || [];
    
    if (name.includes(mainTerm)) score += 3;
    if (caracteristicas.some((c: string) => name.includes(c.toLowerCase()) || desc.includes(c.toLowerCase()))) score += 2;
    if (sinonimos.some((s: string) => name.includes(s.toLowerCase()) || desc.includes(s.toLowerCase()))) score += 1;
    
    return score;
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
    return [...products].sort((a, b) => {
        const aTotalScore = getBaseScore(a) + getMatchScore(a, aiSuggestion);
        const bTotalScore = getBaseScore(b) + getMatchScore(b, aiSuggestion);
        return bTotalScore - aTotalScore;
    });
};
