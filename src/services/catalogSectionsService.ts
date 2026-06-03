
import { Product } from './productService';

export type CatalogSection = 'lancamentos' | 'destaques' | 'mais-vendidos' | 'em-alta' | 'recomendados' | 'promocoes';

interface SectionInfo {
  title: string;
  description: string;
  badge: string;
}

export const SECTION_METADATA: Record<CatalogSection, SectionInfo> = {
  lancamentos: {
    title: 'Lançamentos',
    description: 'As novidades mais recentes e picantes da Discreta Boutique.',
    badge: 'Novidade'
  },
  destaques: {
    title: 'Destaques',
    description: 'Curadoria exclusiva dos nossos melhores produtos.',
    badge: 'Premium'
  },
  'mais-vendidos': {
    title: 'Mais Vendidos',
    description: 'Os queridinhos e favoritos das nossas clientes.',
    badge: 'Favorito'
  },
  'em-alta': {
    title: 'Em Alta',
    description: 'Produtos que estão bombando e virando tendência agora.',
    badge: 'Trending'
  },
  recomendados: {
    title: 'Recomendados para Você',
    description: 'Seleção inteligente baseada no que você mais gosta.',
    badge: 'Para Você'
  },
  promocoes: {
    title: 'Ofertas Imperdíveis',
    description: 'Preços especiais para você despertar seus desejos.',
    badge: 'Oferta'
  }
};

export const catalogSectionsService = {
  /**
   * Filtra e ordena produtos com base na seção solicitada
   */
  applySectionLogic(products: Product[], section: CatalogSection): Product[] {
    const getCreationTime = (createdAt?: any) => {
      if (!createdAt) return 0;
      if (createdAt.seconds) return createdAt.seconds * 1000;
      return new Date(createdAt).getTime() || 0;
    };

    switch (section) {
      case 'lancamentos': {
        const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;
        const filtered = products.filter(p => !!p.newRelease || (p.createdAt && getCreationTime(p.createdAt) > fortyFiveDaysAgo));
        const finalProds = filtered.length > 0 ? filtered : products;
        
        return [...finalProds].sort((a, b) => {
          if (a.newRelease && !b.newRelease) return -1;
          if (!a.newRelease && b.newRelease) return 1;
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
      }

      case 'destaques': {
        const filtered = products.filter(p => !!p.featured);
        const finalProds = filtered.length > 0 ? filtered : products;
        
        return [...finalProds].sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (b.score || 0) - (a.score || 0);
        });
      }

      case 'mais-vendidos': {
        const filtered = products.filter(p => (p.conversoes || 0) > 0);
        const finalProds = filtered.length > 0 ? filtered : products;
        return [...finalProds].sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0));
      }

      case 'em-alta': {
        const filtered = products.filter(p => (p.cliques || 0) > 0);
        const finalProds = filtered.length > 0 ? filtered : products;
        return [...finalProds].sort((a, b) => (b.cliques || 0) - (a.cliques || 0));
      }

      case 'promocoes': {
        const filtered = products.filter(p => !!p.onSale || (p.promoPrice && p.promoPrice < p.price));
        return [...filtered].sort((a, b) => {
          const isAPromo = !!a.onSale || (a.promoPrice && a.promoPrice < a.price);
          const isBPromo = !!b.onSale || (b.promoPrice && b.promoPrice < b.price);
          
          if (isAPromo && !isBPromo) return -1;
          if (!isAPromo && isBPromo) return 1;
          
          if (isAPromo && isBPromo) {
            const discA = (a.price - (a.promoPrice || a.price)) / a.price;
            const discB = (b.price - (b.promoPrice || b.price)) / b.price;
            return discB - discA;
          }
          
          return 0;
        });
      }

      case 'recomendados': {
        const filtered = products.filter(p => (p.score || 0) > 0);
        const finalProds = filtered.length > 0 ? filtered : products;
        return [...finalProds].sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      default:
        return products;
    }
  }
};
