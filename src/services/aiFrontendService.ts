export interface GeneratedProductContent {
  titulo: string;
  descricao_curta: string;
  descricao_longa: string;
  meta_title: string;
  meta_description: string;
  palavras_chave: string[];
  sinonimos?: string[];
  termos_busca?: string[];
}

export interface GeneratedCategoryContent {
  descricao_curta: string;
  descricao_completa: string;
  meta_titulo: string;
  meta_descricao: string;
  palavras_chave: string[];
}

export const aiFrontendService = {
  /**
   * Generates product content (descriptions, meta tags, etc.) via backend (OpenAI)
   */
  async generateProductContent(nome: string, categoria: string | string[], descricao?: string): Promise<GeneratedProductContent> {
    const response = await fetch('/api/ia/gerar-produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, categoria, descricao })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Falha ao gerar conteúdo do produto com OpenAI');
    }

    return await response.json();
  },

  /**
   * Generates category content via backend (OpenAI)
   */
  async generateCategoryContent(nome: string, slug?: string, existingDesc?: string): Promise<GeneratedCategoryContent> {
    const response = await fetch('/api/ia/gerar-categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, slug, existingDesc })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Falha ao gerar conteúdo da categoria com OpenAI');
    }

    return await response.json();
  },

  /**
   * Enriches product data by generating keywords, synonyms and common search terms via backend (OpenAI)
   */
  async enrichProduct(title: string, description: string): Promise<{keywords: string[], synonyms: string[], searchTerms: string[]}> {
    const response = await fetch('/api/ia/enriquecer-produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });

    if (!response.ok) {
       const error = await response.json();
       throw new Error(error.error || 'Falha ao enriquecer produto com OpenAI');
    }

    return await response.json();
  },

  /**
   * Generates a semantic embedding for a product or query via backend (OpenAI)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('/api/ia/gerar-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar embedding com OpenAI');
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao gerar embedding com OpenAI via Backend:", error);
      return [];
    }
  },

  /**
   * Interprets a search query to identify semantic intention and categories
   */
  async interpretSearch(busca: string): Promise<{ searchId: string; interpretacao: any }> {
    const response = await fetch('/api/ia/interpretar-busca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busca })
    });

    if (!response.ok) {
      throw new Error('Falha ao interpretar busca');
    }

    return await response.json();
  },

  /**
   * Tracks a click on a search result to improve ranking
   */
  async trackSearchClick(searchId: string, productId: string): Promise<void> {
    await fetch('/api/ia/registrar-clique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchId, productId })
    });
  },

  /**
   * Gets search suggestions based on previous successful searches
   */
  async getSearchSuggestions(q: string): Promise<string[]> {
    const response = await fetch(`/api/ia/search-suggestions?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    return await response.json();
  }
};
