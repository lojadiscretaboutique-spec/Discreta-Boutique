
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
    // As funções do ranking.ts usam o método 'pick' que internamente filtra e fatia.
    // Para o catálogo, queremos APENAS ORDENAÇÃO sem remover nenhum item da lista.
    
    switch (section) {
      case 'lancamentos':
        // Todos os itens, mas os mais recentes e marcados como lançamento primeiro
        return [...products].sort((a, b) => {
          if (a.newRelease && !b.newRelease) return -1;
          if (!a.newRelease && b.newRelease) return 1;
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });

      case 'destaques':
        // Todos os itens, mas os marcados como featured primeiro
        return [...products].sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (b.score || 0) - (a.score || 0);
        });

      case 'mais-vendidos':
        // Ordenação por conversões (vendas)
        return [...products].sort((a, b) => (b.conversoes || 0) - (a.conversoes || 0));

      case 'em-alta':
        // Ordenação por engajamento/tendência (cliques)
        return [...products].sort((a, b) => (b.cliques || 0) - (a.cliques || 0));

      case 'promocoes':
        // Itens em promoção no topo, ordenados pelo maior desconto
        return [...products].sort((a, b) => {
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

      case 'recomendados':
        // Recomendados no catálogo usa o score base da IA
        return [...products].sort((a, b) => (b.score || 0) - (a.score || 0));

      default:
        return products;
    }
  }
};
