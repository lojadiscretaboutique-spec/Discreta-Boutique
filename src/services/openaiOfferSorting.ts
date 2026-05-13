import { Product } from './productService';

export const openaiOfferSorting = {
  /**
   * Envia uma lista de produtos em oferta para o backend e recebe a ordem ideal de ranqueamento.
   * @param products Lista filtrada de produtos retornada pelo Firebase
   */
  async rankOffers(products: Product[]): Promise<Product[]> {
    if (products.length <= 1) return products;

    try {
      // Enviar apenas uma amostra significativa para ranqueamento para evitar request muito grande
      // e porque o servidor já limita para os top 40.
      const productsToRank = products.slice(0, 100);

      const response = await fetch('/api/ia/ranquear-ofertas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: productsToRank }),
      });

      if (!response.ok) {
        throw new Error('Falha ao ranquear ofertas via IA');
      }

      const rankedIds: string[] = await response.json();

      // Reorganizar o array original com base nos IDs retornados pela IA
      // Sem remover nenhum item que não esteja no retorno da IA (fallback)
      const sortedProducts = [...products].sort((a, b) => {
        const indexA = rankedIds.indexOf(a.id!);
        const indexB = rankedIds.indexOf(b.id!);
        
        // Se um ID não for encontrado, ele vai para o final
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });

      return sortedProducts;
    } catch (error) {
      console.warn('[OFFER_RANKING] Erro ao carregar ranking IA, mantendo ordem original:', error);
      return products;
    }
  }
};
