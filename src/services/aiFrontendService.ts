export interface GeneratedProductContent {
  titulo: string;
  descricao_curta: string;
  descricao_longa: string;
  meta_title: string;
  meta_description: string;
  palavras_chave: string[];
}

export interface GeneratedCategoryContent {
  descricao: string;
  conteudo_seo: string;
  meta_title: string;
  meta_description: string;
  palavras_chave: string[];
}

export const aiFrontendService = {
  /**
   * Generates product content (descriptions, meta tags, etc.) via backend (OpenAI)
   */
  async generateProductContent(nome: string, categoria: string): Promise<GeneratedProductContent> {
    const response = await fetch('/api/ia/gerar-produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, categoria })
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
  async generateCategoryContent(nome: string): Promise<GeneratedCategoryContent> {
    const response = await fetch('/api/ia/gerar-categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome })
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
  }
};
