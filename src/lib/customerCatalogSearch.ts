import type { Product } from '../types/product';

/** Customer storefront search: deterministic, accent-insensitive, no AI or network calls. */
export type CatalogCategoryNameMap = Record<string, string>;

export const normalizeCatalogQuery = (value: unknown): string => String(value ?? '')
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const valueList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flat(Infinity).filter(v => typeof v === 'string') as string[];
  return typeof value === 'string' ? [value] : [];
};

const words = (value: unknown): string[] => normalizeCatalogQuery(value).split(' ').filter(Boolean);
const allWords = (values: unknown[]): string[] => values.flatMap(v => valueList(v).flatMap(words));

/** Token boundaries prevent `gel` from matching `angel`, `gelatina` or unrelated excerpts. */
const wordMatches = (wanted: string, candidate: string): boolean => {
  if (candidate === wanted) return true;
  if (wanted.length >= 3 && (candidate === `${wanted}s` || wanted === `${candidate}s`)) return true;
  // Typing a partially completed longer word is useful on mobile, but not for 2-3 letter searches.
  return wanted.length >= 4 && candidate.startsWith(wanted);
};

const containsToken = (wanted: string, candidates: string[]): boolean => candidates.some(w => wordMatches(wanted, w));
const hasValidPicture = (p: Product): boolean => {
  const urls = [
    ...(Array.isArray(p.images) ? p.images.map(i => typeof i === 'string' ? i : i?.url) : []),
    p.imageThumb, p.imageUrl, p.thumbnailUrl, p.mainImage
  ];
  return urls.some(url => typeof url === 'string' && /^https?:\/\//i.test(url.trim()));
};

/** One public eligibility rule for the catalog, cache builder and autocomplete. */
export function isVisibleInCustomerCatalog(p: Product): boolean {
  if (!p || p.active !== true || (p as any).status === 'inactive') return false;
  if (p.extras?.showInCatalog === false || (p as any).showInCatalog === false) return false;
  if (!hasValidPicture(p)) return false;
  if (p.isCombo) return true; // A combo is a virtual SKU, with component stock checked at checkout.
  const parentStock = Number(p.stock) || 0;
  if (parentStock > 0) return true;
  // Some imported products have variations embedded but an unsynchronized parent balance.
  return !!p.hasVariants && Array.isArray(p.variants) && p.variants.some(v =>
    v.active !== false && (Number(v.stock) || Number(v.variantStock) || 0) > 0
  );
}

/** Returns 0 for non-matches. Every search token must match a relevant product field. */
export function customerProductMatchScore(
  p: Product, queryText: string, categoryNames: CatalogCategoryNameMap = {}
): number {
  if (!isVisibleInCustomerCatalog(p)) return 0;
  const q = normalizeCatalogQuery(queryText);
  if (!q) return 1;
  const tokens = [...new Set(q.split(' ').filter(Boolean))];
  const name = normalizeCatalogQuery(p.name);
  const seo = p.seo || {};
  const strongName = allWords([p.name, p.subtitle, seo.title, seo.metaTitle]);
  const category = allWords([categoryNames[p.categoryId], (p as any).categoryName, p.subcategory, (p as any).subcategoria, p.brand, p.cosmetics?.type]);
  const tags = allWords([p.tags, p.searchTerms, seo.keywords, (p as any).palavras_chave]);
  const aiTags = allWords([p.ai_keywords, p.ai_synonyms]);
  const shortExplicitTags = valueList([p.tags, p.searchTerms, seo.keywords])
    .map(normalizeCatalogQuery);
  const refs = valueList([
    p.sku, p.internalCode, p.gtin, p.barcode, p.ean, p.codigoBarras,
    p.variantIdentifiers, ...(Array.isArray(p.variants) ? p.variants.flatMap(v =>
      [v.sku, v.variantSku, v.gtin, v.barcode, v.variantBarcode, v.name, v.variantName]
    ) : [])
  ]).map(normalizeCatalogQuery);
  const shortDescription = allWords([p.shortDescription]);

  // Only genuinely descriptive, long queries use the short description as a fallback.
  // The full description and long AI-generated SEO texts are intentionally excluded.
  let total = 0;
  for (const token of tokens) {
    let weight = 0;
    if (containsToken(token, strongName)) weight = Math.max(weight, 900);
    if (containsToken(token, category)) weight = Math.max(weight, 480);
    // For short queries, avoid generic AI-generated marketing tags and phrases.
    if (token.length >= 4 && containsToken(token, tags)) weight = Math.max(weight, 320);
    if (token.length >= 4 && containsToken(token, aiTags)) weight = Math.max(weight, 120);
    if (token.length < 4 && shortExplicitTags.includes(token)) weight = Math.max(weight, 250);
    if (refs.some(ref => ref === token)) weight = Math.max(weight, 2000);
    else if (token.length >= 4 && refs.some(ref => ref.startsWith(token))) weight = Math.max(weight, 850);
    if (token.length >= 5 && containsToken(token, shortDescription)) weight = Math.max(weight, 90);
    if (weight === 0) return 0; // AND search: no unrelated results for a multi-word query.
    total += weight;
  }
  if (name === q) total += 9000;
  else if (name.startsWith(`${q} `) || name.startsWith(q)) total += 3500;
  else if (` ${name} `.includes(` ${q} `)) total += 2400;
  else if (tokens.every(token => containsToken(token, words(name)))) total += 1700;
  if (refs.some(ref => ref === q)) total += 9000;
  return total;
}

export function searchCustomerCatalog(
  products: Product[], search: string, categoryNames: CatalogCategoryNameMap = {}, maxResults?: number
): Product[] {
  const scored = products.map(p => ({ product: p, score: customerProductMatchScore(p, search, categoryNames) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'pt-BR'));
  return (maxResults ? scored.slice(0, maxResults) : scored).map(item => item.product);
}
