import OpenAI from 'openai';
import { z } from 'zod';

const ProductContentSchema = z.object({
  titulo: z.string().max(100),
  descricao_curta: z.string(),
  descricao_longa: z.string(),
  meta_title: z.string().max(100),
  meta_description: z.string().max(200),
  palavras_chave: z.array(z.string())
});

const SearchInterpretationSchema = z.object({
  categoria: z.string().optional(),
  intencao: z.string().optional().default(''),
  caracteristicas: z.array(z.string()).optional().default([]),
  nivel_usuario: z.string().optional().default('intermediario'),
  sinonimos: z.array(z.string()).optional().default([]),
  termos_relacionados: z.array(z.string()).optional().default([]),
  produtos_recomendados: z.array(z.string()).optional().default([]),
  sugestao_curadoria: z.string().optional(),
  mensagem_personalizada: z.string().optional()
});

const CategoryContentSchema = z.object({
  descricao: z.string(),
  conteudo_seo: z.string(),
  meta_title: z.string().max(100),
  meta_description: z.string().max(200),
  palavras_chave: z.array(z.string())
});

class AIService {
  private openai: OpenAI | null = null;
  private cache = new Map<string, { data: any; expiry: number }>();
  private CACHE_TTL = 1000 * 60 * 60; // 1 hora

  private getClient() {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY não configurada no servidor.');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  private getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    });
  }

  async generateProductContent(nome: string, categoria: string, retries = 2): Promise<z.infer<typeof ProductContentSchema>> {
    const cacheKey = `product_${nome}_${categoria}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um copywriter especialista em e-commerce de luxo e bem-estar íntimo.
      Gere o conteúdo para o produto "${nome}" na categoria "${categoria}".
      Linguagem: Sensual leve, discreta, sofisticada e elegante.
      Nunca use termos vulgares ou explícitos.
      
      Retorne um JSON com: titulo, descricao_curta, descricao_longa (com benefícios em bullet points), meta_title, meta_description, palavras_chave.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);
      const validated = ProductContentSchema.parse(parsed);
      this.setCache(cacheKey, validated);
      return validated;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo (Restantes: ${retries})`);
        return this.generateProductContent(nome, categoria, retries - 1);
      }
      console.error('Erro na OpenAI (generateProductContent):', error);
      throw error;
    }
  }

  async interpretSearch(query: string, catalogContext?: string, retries = 1): Promise<z.infer<typeof SearchInterpretationSchema>> {
    const cacheKey = `search_${query}_${catalogContext ? 'ctx' : 'noctx'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um concierge especialista em bem-estar íntimo da Discreta Boutique.
      Seu objetivo é interpretar o desejo do cliente e sugerir produtos do nosso catálogo.

      BUSCA DO CLIENTE: "${query}"

      ${catalogContext ? `CATÁLOGO DISPONÍVEL (ID: Nome): \n${catalogContext}` : ''}

      Instruções:
      1. Identifique a intenção emocional e técnica.
      2. Selecione até 12 IDs de produtos do catálogo acima que MELHOR atendem ao desejo.
      3. Se a busca for vaga, use os termos relacionados para ampliar.
      4. Mensagem personalizada: Seja elegante, discreto e acolhedor (máx 180 caracteres).
      5. Nunca use termos vulgares.

      Retorne APENAS um JSON seguindo o esquema estrito:
      {
        "intencao": "string",
        "caracteristicas": ["string"],
        "sinonimos": ["string"],
        "termos_relacionados": ["string"],
        "produtos_recomendados": ["ID1", "ID2"...],
        "categoria": "nome da categoria sugerida",
        "sugestao_curadoria": "Pitch curto de venda",
        "mensagem_personalizada": "Texto acolhedor para o cliente",
        "nivel_usuario": "iniciante|intermediario|avancado"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);
      const validated = SearchInterpretationSchema.parse(parsed);
      this.setCache(cacheKey, validated);
      return validated;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando interpretação de busca (Restantes: ${retries})`);
        return this.interpretSearch(query, retries - 1);
      }
      console.error('Erro na OpenAI (interpretSearch):', error);
      throw error;
    }
  }

  async generateCategoryContent(nome: string, retries = 2): Promise<z.infer<typeof CategoryContentSchema>> {
    const cacheKey = `category_${nome}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um copywriter especialista em e-commerce de luxo e bem-estar íntimo.
      Gere o conteúdo estratégico para a categoria de produtos "${nome}".
      Linguagem: Sensual leve, discreta, sofisticada e elegante.
      Nunca use termos vulgares ou explícitos.
      
      Retorne um JSON com:
      - descricao: Uma descrição curta e sedutora da categoria.
      - conteudo_seo: Um texto longo (2-3 parágrafos) focado em SEO, explicando os benefícios e o que encontrar nessa categoria.
      - meta_title: Título otimizado para o Google (máx 60 caracteres).
      - meta_description: Descrição otimizada para o Google (máx 160 caracteres).
      - palavras_chave: Lista de 5-8 palavras-chave relevantes.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);
      const validated = CategoryContentSchema.parse(parsed);
      this.setCache(cacheKey, validated);
      return validated;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo de categoria (Restantes: ${retries})`);
        return this.generateCategoryContent(nome, retries - 1);
      }
      console.error('Erro na OpenAI (generateCategoryContent):', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
