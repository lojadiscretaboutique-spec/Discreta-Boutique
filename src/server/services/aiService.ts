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
  sugestao_curadoria: z.string().optional(),
  mensagem_personalizada: z.string().optional()
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

  async interpretSearch(query: string, retries = 1): Promise<z.infer<typeof SearchInterpretationSchema>> {
    const cacheKey = `search_${query}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Analise a intenção de busca em um sex shop de luxo discreto: "${query}"
      Retorne um JSON com: categoria (sugerida), intencao, caracteristicas[], nivel_usuario (iniciante/intermediario/avancado), sinonimos[], termos_relacionados[], sugestao_curadoria, mensagem_personalizada.
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
}

export const aiService = new AIService();
