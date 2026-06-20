import { doc, getDoc, setDoc, collection, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from './productService';
import { Category } from './categoryService';
import { visualHomeService } from './visualHomeService';
import { getLancamentos, getDestaques, getMaisVendidos, getEmAlta, getRecomendados, fillFallback } from '../lib/ranking';

export interface HomeCacheDoc {
  banners: any[];
  offerBanners: any[];
  categories: any[];
  visibleProducts: any[];
  sections: {
    lancamentos: any[];
    destaques: any[];
    maisVendidos: any[];
    emAlta: any[];
    recomendados: any[];
    ofertas: any[];
  };
  visualStructure: any;
  updatedAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error in HomeCacheService: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const homeCacheService = {
  /**
   * Fetches the compiled public home cache.
   */
  async getHomeCache(): Promise<HomeCacheDoc | null> {
    try {
      const docRef = doc(db, 'public_home_cache', 'home');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as HomeCacheDoc;
      }
      return null;
    } catch (e) {
      console.warn("⚠️ Failed to load home cache from Firestore, fallback will be used:", e);
      return null;
    }
  },

  /**
   * Regenerates and saves the compiled home cache in public_home_cache/home.
   */
  async regenerateHomeCache(bypassWriteToFirestore = false): Promise<HomeCacheDoc> {
    const path = 'public_home_cache/home';
    try {
      console.log("⚡ Starting Home Cache regeneration...");

      // 1. Fetch visual home structure
      const visualStructure = await visualHomeService.getFullHomeStructure();

      // Extract specific custom items mentioned in dynamic home configuration
      let customProductIdsToFetch: string[] = [];
      let categoryIdsToFetch: string[] = [];
      if (visualStructure?.settings) {
        Object.values(visualStructure.settings).forEach((s: any) => {
          if (s.active) {
            if ((s.source === 'custom_products' || s.source === 'limited_promo') && s.sourceDetails && s.sourceDetails.length > 0) {
              customProductIdsToFetch.push(...s.sourceDetails);
            } else if (s.source === 'categories' && s.sourceDetails && s.sourceDetails.length > 0) {
              categoryIdsToFetch.push(...s.sourceDetails);
            }
          }
        });
      }
      customProductIdsToFetch = Array.from(new Set(customProductIdsToFetch));
      categoryIdsToFetch = Array.from(new Set(categoryIdsToFetch));

      // 2. Fetch AI curation
      let curadoria: any = null;
      try {
        const docSnap = await getDoc(doc(db, 'ai_curation', 'home'));
        if (docSnap.exists()) {
          curadoria = docSnap.data();
        }
      } catch (e) {
        console.warn('AI Home Curation fetching failed:', e);
      }

      // 3. Fetch Banners
      const bannersSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
      const banners = bannersSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          imageUrl: data.imageUrl || '',
          linkUrl: data.linkUrl || '',
          active: true
        };
      });

      // 4. Fetch Offer Banners
      const oSnap = await getDocs(query(collection(db, 'offer_banners'), where('active', '==', true)));
      const now = new Date();
      const offerBanners = oSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            imageUrl: data.imageUrl || '',
            linkUrl: data.linkUrl || '',
            active: true,
            startDate: data.startDate || null,
            endDate: data.endDate || null
          };
        })
        .filter(o => {
          if (o.startDate && new Date(o.startDate) > now) return false;
          if (o.endDate && new Date(o.endDate) < now) return false;
          return true;
        });

      // 5. Fetch Categories
      const cSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true)));
      const allCats = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));

      // 6. Fetch Products & Combos (limit 150)
      const [pSnap, combosSnap, customProdsDocs, categoryProdsSnaps] = await Promise.all([
        getDocs(query(
          collection(db, 'products'), 
          where('active', '==', true),
          limit(150)
        )),
        getDocs(query(
          collection(db, 'combos'),
          where('active', '==', true),
          where('showInCatalog', '==', true)
        )),
        customProductIdsToFetch.length > 0
          ? Promise.all(customProductIdsToFetch.slice(0, 15).map(id => getDoc(doc(db, 'products', id))))
          : Promise.resolve([]),
        categoryIdsToFetch.length > 0
          ? Promise.all(categoryIdsToFetch.slice(0, 5).map(catId => 
              getDocs(query(collection(db, 'products'), where('active', '==', true), where('categoryId', '==', catId), limit(12)))
            ))
          : Promise.resolve([])
      ]);

      const allFetchedProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      const explicitlyFetchedProducts: Product[] = [];
      customProdsDocs.forEach((d: any) => {
        if (d && d.exists()) {
          explicitlyFetchedProducts.push({ id: d.id, ...d.data() } as Product);
        }
      });

      const categoryFetchedProducts: Product[] = [];
      categoryProdsSnaps.forEach((snap: any) => {
        if (snap) {
          snap.docs.forEach((d: any) => {
            categoryFetchedProducts.push({ id: d.id, ...d.data() } as Product);
          });
        }
      });

      // Deduplicate
      const mergedProductsMap = new Map<string, Product>();
      allFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));
      explicitlyFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));
      categoryFetchedProducts.forEach(p => mergedProductsMap.set(p.id!, p));

      const finalFetchedProductsList = Array.from(mergedProductsMap.values());

      const comboProducts = combosSnap.docs.map(d => {
        const combo = d.data();
        return {
          id: d.id,
          name: combo.name || '',
          description: combo.description || '',
          price: combo.price || 0,
          images: combo.images || (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
          isCombo: true,
          categoryId: 'combos',
          featured: combo.isFeatured || false,
          active: true
        } as any;
      });

      const rawVisibleProducts = [...finalFetchedProductsList, ...comboProducts].filter(p => 
        (p.images && p.images.length > 0) && 
        (p.extras?.showInCatalog !== false) &&
        (p.isCombo || (Number((p as any).stock) || 0) > 0)
      );

      // Map to brief/essential fields for public home cache (drastically reduced payload)
      const visibleProducts = rawVisibleProducts.map(p => {
        const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='100%' height='100%' fill='%2309090b'/><text x='50%' y='50%' font-family='sans-serif' font-size='12' font-weight='bold' fill='%2327272a' dominant-baseline='middle' text-anchor='middle' letter-spacing='4'>DISCRETA BOUTIQUE</text></svg>";
        const imageThumb = p.imageThumb || (p as any).thumbnailUrl || p.imageUrl || (p as any).mainImage || (p.images && p.images.find(i => i.isMain)?.url) || (p.images && p.images[0]?.url) || placeholderImg;
        return {
          id: p.id,
          name: p.name || '',
          slug: p.slug || (p.name ? p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') : ''),
          price: p.price || 0,
          promoPrice: p.promoPrice || p.promotionalPrice || null,
          promotionalPrice: p.promoPrice || p.promotionalPrice || null,
          imageThumb: imageThumb,
          images: p.images && p.images.length > 0 ? p.images : [{ url: imageThumb, isMain: true }],
          categoryId: p.categoryId || '',
          active: true,
          isCombo: !!p.isCombo,
          featured: !!p.featured,
          description: p.description?.substring(0, 100) || '', // essential brief description
          stock: p.stock ?? 1,
          rating: p.rating || 5,
          reviewsCount: p.reviewsCount || 0
        };
      });

      // Recalculate categories (filtering out those without products)
      const categoryIdsWithProducts = new Set<string>();
      visibleProducts.forEach(p => {
        if (p.categoryId) {
          categoryIdsWithProducts.add(p.categoryId);
          let parent = allCats.find(c => c.id === p.categoryId);
          while (parent && parent.parentId) {
            categoryIdsWithProducts.add(parent.parentId);
            parent = allCats.find(c => c.id === parent?.parentId);
          }
        }
      });

      const visibleRootCats = allCats.filter(c => c.level === 0 && categoryIdsWithProducts.has(c.id));
      const categoriesWithImages = visibleRootCats.map(cat => {
        if (cat.image?.url) return cat;

        const productsOfThisCat = visibleProducts.filter(p => {
          if (p.categoryId === cat.id) return true;
          const pCat = allCats.find(c => c.id === p.categoryId);
          return pCat?.parentId === cat.id;
        });

        if (productsOfThisCat.length > 0) {
          const randomIndex = Math.floor(Math.random() * productsOfThisCat.length);
          const randomProduct = productsOfThisCat[randomIndex];
          return { ...cat, image: { url: randomProduct.imageThumb || '' } };
        }
        return cat;
      });

      const sortedCategoriesWithImages = [...categoriesWithImages].sort((a, b) => {
        const scoreB = b.accessCount || 0;
        const scoreA = a.accessCount || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
        return a.name.localeCompare(b.name);
      });

      // Compute sections/curation exactly like HomePage mapping, but referencing the lightweight products
      const usedIds = new Set<string>();
      let lancamentos: any[] = [];
      let destaques: any[] = [];
      let maisVendidos: any[] = [];
      let emAlta: any[] = [];
      let recomendados: any[] = [];
      let ofertas: any[] = [];

      // Type-cast to fit ranking algorithms nicely
      const productsForRanking = visibleProducts as any[] as Product[];
      ofertas = visibleProducts.filter(p => !!p.promoPrice || !!p.promotionalPrice);

      if (curadoria) {
        const pickAi = (ids: string[]) => ids.map(id => visibleProducts.find(p => p.id === id)).filter(p => !!p && !usedIds.has(p.id!)) as any[];
        
        lancamentos = pickAi(curadoria.lancamentos);
        lancamentos.forEach(p => usedIds.add(p.id!));

        destaques = pickAi(curadoria.destaques);
        destaques.forEach(p => usedIds.add(p.id!));

        maisVendidos = pickAi(curadoria.maisVendidos);
        maisVendidos.forEach(p => usedIds.add(p.id!));

        emAlta = pickAi(curadoria.emAlta);
        emAlta.forEach(p => usedIds.add(p.id!));

        recomendados = getRecomendados(productsForRanking, usedIds) as any[];
      } else {
        lancamentos = getLancamentos(productsForRanking, usedIds) as any[];
        destaques = getDestaques(productsForRanking, usedIds) as any[];
        maisVendidos = getMaisVendidos(productsForRanking, usedIds) as any[];
        emAlta = getEmAlta(productsForRanking, usedIds) as any[];
        recomendados = getRecomendados(productsForRanking, usedIds) as any[];
      }

      [lancamentos, destaques, maisVendidos, emAlta, recomendados].forEach(sec => {
        if (sec.length < 8) {
          const fallback = fillFallback(productsForRanking, usedIds, 8 - sec.length) as any[];
          sec.push(...fallback);
        }
      });

      const sections = {
        lancamentos,
        destaques,
        maisVendidos,
        emAlta,
        recomendados,
        ofertas
      };

      const cacheDoc: HomeCacheDoc = {
        banners,
        offerBanners,
        categories: sortedCategoriesWithImages,
        visibleProducts: visibleProducts,
        sections,
        visualStructure,
        updatedAt: new Date().toISOString()
      };

      if (!bypassWriteToFirestore) {
        // Write to Firestore securely
        await setDoc(doc(db, 'public_home_cache', 'home'), {
          ...cacheDoc,
          // use firestore serverTimestamp for precise DB tracking
          lastRegeneration: serverTimestamp()
        });
      }

      console.log("✅ Home Cache successfully regenerated!");
      return cacheDoc;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }
};
