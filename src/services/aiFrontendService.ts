import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true 
});

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
  async generateProductContent(nome: string, categoria: string): Promise<GeneratedProductContent> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    // Se não houver chave no frontend, tenta usar a API do servidor (que já usa OpenAI)
    if (!apiKey) {
      console.warn('VITE_OPENAI_API_KEY não configurada no frontend. Usando API do servidor...');
      const response = await fetch('/api/ia/gerar-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, categoria })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro desconhecido na API do servidor' }));
        throw new Error(err.error || 'Falha ao conectar com o serviço de IA do servidor.');
      }

      return await response.json();
    }

    const prompt = `
      Você é um copywriter sênior especializado em e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é criar um conteúdo ENCANTADOR, PERSUASIVO e REALISTA que transforme visitantes em clientes.
      
      Produto: "${nome}"
      Categoria: "${categoria}"
      
      DIRETRIZES DE ESTILO:
      - Tom de voz: Elegante, sensual (sem ser vulgar), sofisticado e acolhedor.
      - Foco: Desperte o desejo através de benefícios sensoriais e emocionais.
      - Vocabulário: Use termos como "toque aveludado", "momentos inesquecíveis", "design anatômico", "elegância discreta", "experiência única".
      - Proibição: NUNCA use termos vulgares, explícitos, gírias de baixo calão ou descrições pornográficas.
      
      INSTRUÇÕES PARA OS CAMPOS (Retorne estritamente um objeto JSON):
      1. titulo: Uma chamada curta de impacto (máx 100 caracteres).
      2. descricao_curta: Um parágrafo envolvente que destaca o principal diferencial.
      3. descricao_longa: Texto completo e estruturado com introdução, benefícios (bullet points) e fechamento.
      4. meta_title: Título otimizado para Google (máx 60 caracteres).
      5. meta_description: Texto persuasivo para buscas no Google, mencione "Entrega Discreta" (máx 155 caracteres).
      6. palavras_chave: Lista de 5 a 8 termos técnicos e de busca.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error('Resposta vazia da OpenAI');
      
      return JSON.parse(text);
    } catch (error: any) {
      console.error('Erro na OpenAI API:', error);
      throw new Error(error.message || 'Falha ao gerar conteúdo com OpenAI');
    }
  },

  async generateCategoryContent(nome: string): Promise<GeneratedCategoryContent> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('VITE_OPENAI_API_KEY não configurada no frontend. Usando API do servidor...');
      const response = await fetch('/api/ia/gerar-categoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro desconhecido na API do servidor' }));
        throw new Error(err.error || 'Falha ao conectar com o serviço de IA do servidor.');
      }

      return await response.json();
    }

    const prompt = `
      Você é um copywriter sênior especialista em branding e SEO para e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é gerar o conteúdo estratégico e ENCANTADOR para a categoria de produtos "${nome}".

      DIRETRIZES DE ESTILO E QUALIDADE:
      - Tom de voz: Sofisticado, elegante, sensual (sem ser vulgar) e altamente persuasivo.
      - Foco: Despertar o desejo, elevar a autoestima e prometer experiências inesquecíveis.
      - Proibição: NUNCA use termos vulgares, explícitos, gírias de baixo calão ou descrições pornográficas.

      INSTRUÇÕES PARA OS CAMPOS (Retorne estritamente um objeto JSON):
      1. descricao: Uma introdução sedutora e curta (1-2 frases) que funciona como o "slogan" da categoria.
      2. conteudo_seo: Um texto LONGO, ELABORADO e ESTRUTURADO (mínimo 300 palavras). 
      3. meta_title: Título perfeito para Google (máx 60 caracteres).
      4. meta_description: Texto altamente persuasivo para cliques no Google (máx 155 caracteres).
      5. palavras_chave: Forneça uma lista EXAUSTIVA de 15 a 20 termos relevantes.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error('Resposta vazia da OpenAI');
      
      return JSON.parse(text);
    } catch (error: any) {
      console.error('Erro na OpenAI API:', error);
      throw new Error(error.message || 'Falha ao gerar conteúdo de categoria com OpenAI');
    }
  }
};
