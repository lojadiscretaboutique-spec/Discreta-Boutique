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
  intencao: z.string(),
  caracteristicas: z.array(z.string()),
  nivel_usuario: z.enum(['iniciante', 'intermediario', 'avancado']),
  sinonimos: z.array(z.string()),
  termos_relacionados: z.array(z.string()),
  sugestao_curadoria: z.string().optional(), // Ex: "Kit Iniciante", "Coleção Noite Romântica"
  mensagem_personalizada: z.string().optional() // Ex: "Preparamos uma seleção especial para sua primeira experiência..."
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
      Seu objetivo é gerar o conteúdo para o produto "${nome}" na categoria "${categoria}" focado em alta conversão.

      DIRETRIZES DE ESTILO:
      - Linguagem: Sensual leve, discreta, sofisticada e elegante.
      - Restrições: NUNCA use termos explícitos, vulgares ou anatômicos diretos.
      - Tom: Envolvente, que desperta o desejo através de sensações e benefícios, não apenas descrições técnicas.
      - Foco: Experiência do usuário, autocuidado e conexão.

      ESTRUTURA DA DESCRIÇÃO LONGA (Obrigatória):
      1. Abertura envolvente: Um parágrafo curto que conecte o produto ao desejo ou momento de uso.
      2. Benefícios principais: Use bullet points (•) para destacar 3 a 4 benefícios sensoriais.
      3. Experiência de uso: Descrição emocional de como é utilizar o produto.
      4. Discrição e conforto: Reafirmar a qualidade e a natureza discreta do item.
      5. Chamada para ação sutil: Uma frase que convide à descoberta.

      SEO:
      - Meta Title: Max 60 caracteres (incluindo o nome do produto e benefício).
      - Meta Description: Max 160 caracteres, instigante e com call-to-action.
      - Palavras-chave: 5 termos relacionados que usuários discretos buscariam.

      Retorne APENAS um JSON no seguinte formato:
      {
        "titulo": "Título com até 60 char focado em SEO",
        "descricao_curta": "Resumo magnético de até 2 linhas",
        "descricao_longa": "Texto seguindo a estrutura de 5 pontos definida acima",
        "meta_title": "Título SEO otimizado",
        "meta_description": "Descrição SEO otimizada até 160 char",
        "palavras_chave": ["termo1", "termo2", "termo3", "termo4", "termo5"]
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        temperature: 0.7,
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);
      
      const validated = ProductContentSchema.parse(parsed);
      this.setCache(cacheKey, validated);
      return validated;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo (Restantes: ${retries}) devido a erro:`, error instanceof Error ? error.message : error);
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
      Analise a intenção de busca do usuário em um e-commerce sensual discreto: "${query}"
      
      Retorne APENAS um JSON no seguinte formato:
      {
        "categoria": "Sugestão de categoria principal (ex: Lingerie, Bem-estar, Acessórios)",
        "intencao": "Breve descrição da intenção do usuário",
        "caracteristicas": ["lista", "de", "caracteristicas", "desejadas"],
        "nivel_usuario": "iniciante | intermediario | avancado",
        "sinonimos": ["lista de sinônimos para os termos buscados"],
        "termos_relacionados": ["lista de termos que complementam a busca"],
        "sugestao_curadoria": "Nome de uma coleção ou kit sugerido (curto)",
        "mensagem_personalizada": "Uma frase acolhedora e discreta baseada na intenção"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.3,
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);
      
      const validated = SearchInterpretationSchema.parse(parsed);
      this.setCache(cacheKey, validated);
      return validated;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando interpretação de busca (Restantes: ${retries}) devido a erro:`, error instanceof Error ? error.message : error);
        return this.interpretSearch(query, retries - 1);
      }
      console.error('Erro na OpenAI (interpretSearch):', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
