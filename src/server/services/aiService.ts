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
  termo_busca: z.string().default(''),
  categoria: z.string().optional().default(''),
  intencao: z.string().optional().default(''),
  caracteristicas: z.array(z.string()).optional().default([]),
  nivel_usuario: z.string().optional().default('intermediario'),
  sinonimos: z.array(z.string()).optional().default([]),
  termos_relacionados: z.array(z.string()).optional().default([]),
  produtos_recomendados: z.array(z.string()).optional().default([]),
  sugestao_curadoria: z.string().optional().default(''),
  mensagem_personalizada: z.string().optional().default('')
});

const CartSuggestionSchema = z.object({
  foco_complemento: z.string(),
  caracteristicas: z.array(z.string()),
  motivo: z.string().max(200)
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
  private CACHE_TTL = 3600000; // 1 hora
  private categoriesCache: { data: string[], expiry: number } = { data: [], expiry: 0 };

  private async getValidCategories(): Promise<string[]> {
    if (Date.now() < this.categoriesCache.expiry && this.categoriesCache.data.length > 0) {
      return this.categoriesCache.data;
    }

    try {
      const { categoryService } = await import('../../services/categoryService.js');
      const cats = await categoryService.listCategories();
      const catNames = [...new Set(cats.map(c => c.name)), "Outros"];
      
      this.categoriesCache = {
        data: catNames,
        expiry: Date.now() + (1000 * 60 * 15) // Cache de categorias por 15 min
      };
      return catNames;
    } catch (e) {
      console.error('[AI][CATEGORY_FETCH_ERROR]', e);
      return ["Cosméticos", "Fantasias", "Lingeries", "Masturbadores", "Plugs", "Próteses", "Sado", "Vibradores", "Outros"];
    }
  }

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

  private normalizeArray(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
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
      
      IMPORTANTE: A resposta deve ser estritamente um objeto json.
      
      Retorne um objeto json com: titulo, descricao_curta, descricao_longa (com benefícios em bullet points), meta_title, meta_description, palavras_chave.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0].message.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
        // Normalização preventiva
        if (parsed.palavras_chave) {
          parsed.palavras_chave = this.normalizeArray(parsed.palavras_chave);
        }
      } catch (e) {
        console.error('[AI][PRODUCT][JSON_PARSE_ERROR]', rawContent);
        throw e;
      }

      const result = ProductContentSchema.safeParse(parsed);
      if (!result.success) {
        console.error('[AI][PRODUCT][VALIDATION_ERROR]', result.error.format());
        // Fallback robusto se a validação falhar
        const fallback = {
          titulo: (parsed.titulo || nome).substring(0, 100),
          descricao_curta: parsed.descricao_curta || `Conheça o novo ${nome}, uma escolha sofisticada para seu bem-estar.`,
          descricao_longa: parsed.descricao_longa || `O ${nome} foi desenvolvido com materiais de alta qualidade para proporcionar momentos inesquecíveis.`,
          meta_title: (parsed.meta_title || `${nome} | Discreta Boutique`).substring(0, 100),
          meta_description: (parsed.meta_description || `Compre ${nome} na Discreta Boutique. Entrega discreta e rápida.`).substring(0, 200),
          palavras_chave: this.normalizeArray(parsed.palavras_chave).length > 0 ? this.normalizeArray(parsed.palavras_chave) : [nome, categoria]
        };
        this.setCache(cacheKey, fallback);
        return fallback;
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo (Restantes: ${retries})`);
        return this.generateProductContent(nome, categoria, retries - 1);
      }
      console.error('Erro na OpenAI (generateProductContent):', error);
      // Fallback final drástico se tudo falhar
      return {
        titulo: nome,
        descricao_curta: `Descrição elegante para ${nome}.`,
        descricao_longa: `Detalhes completos sobre o produto ${nome}.`,
        meta_title: nome,
        meta_description: `Confira ${nome} em nossa boutique.`,
        palavras_chave: [nome, categoria]
      };
    }
  }

  async interpretSearch(query: string, retries = 1): Promise<z.infer<typeof SearchInterpretationSchema>> {
    // 1. Pré-processamento: normalizar, remover pontuação e frases de preenchimento
    const normalizedQuery = query
      .toLowerCase()
      .replace(/[?!.;,]/g, '')
      .replace(/qual o melhor|quero algo para|você tem|onde encontro|preciso de/g, '')
      .trim();
    
    if (!normalizedQuery) {
      return SearchInterpretationSchema.parse({ termo_busca: query });
    }

    const cacheKey = `search_v2_${normalizedQuery}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const validCategories = await this.getValidCategories();
    const prompt = `
      Você é um motor de busca semântico para a Discreta Boutique (E-commerce de Bem-estar Íntimo).
      Sua tarefa é extrair a INTENÇÃO e ATRIBUTOS da busca do usuário.

      BUSCA DO USUÁRIO: "${query}"

      REGRAS DE EXTRAÇÃO:
      1. NUNCA responda com texto livre. A saída deve ser APENAS um objeto json válido.
      2. NUNCA sugira produtos específicos ou IDs.

      ÁREAS DE CRIATIVIDADE (Use sua inteligência para extrair/inferir):
      - Características técnicas (ex: "recarregável", "silicone", "vibrante", "texturizado")
      - Sinônimos apropriados para a busca (amplie a pesquisa com termos contextuais)
      - Intenção do usuário (ex: "pesquisa", "curiosidade", "compra_imediata", "presente")

      ÁREAS DE CONTROLE RÍGIDO (NÃO seja criativo aqui):
      - Categoria: VOCÊ DEVE ESCOLHER APENAS UMA DAS CATEGORIAS A SEGUIR: ${validCategories.join(", ")}.
      - Se a busca for genérica OU você não tiver certeza de qual categoria se encaixa perfeitamente, retorne "Outros".
      - NUNCA crie novas categorias. Se o termo não se encaixar em uma das categorias listadas, a resposta obrigatória é "Outros".

      Sua resposta deve ser um objeto JSON válido.

      FORMATO DE RETORNO:
      {
        "termo_busca": "versão limpa e técnica da busca",
        "categoria": "nome da categoria (ex: Vibradores, Lingeries)",
        "intencao": "objetivo do usuário",
        "caracteristicas": ["atributo1", "atributo2"],
        "sinonimos": ["sinonimo1", "sinonimo2"],
        "termos_relacionados": ["termo1", "termo2"],
        "nivel_usuario": "iniciante|intermediario|avancado",
        "mensagem_personalizada": "Mensagem acolhedora de até 120 caracteres"
      }
    `;
    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.3
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);

      // Normalização preventiva
      if (parsed.caracteristicas) parsed.caracteristicas = this.normalizeArray(parsed.caracteristicas);
      if (parsed.sinonimos) parsed.sinonimos = this.normalizeArray(parsed.sinonimos);
      if (parsed.termos_relacionados) parsed.termos_relacionados = this.normalizeArray(parsed.termos_relacionados);
      
      // Validação de Categoria
      if (parsed.categoria && !validCategories.includes(parsed.categoria)) {
        console.warn('[AI][SEARCH][INVALID_CATEGORY_DETECTED]', {
          original: parsed.categoria,
          substituindo_por: 'Outros'
        });
        parsed.categoria = 'Outros';
      }
      
      const result = SearchInterpretationSchema.safeParse(parsed);
      if (!result.success) {
        console.error('[AI][SEARCH][VALIDATION_ERROR]', result.error.format());
        const fallback = {
          termo_busca: parsed.termo_busca || normalizedQuery,
          categoria: parsed.categoria || '',
          intencao: parsed.intencao || 'pesquisa',
          caracteristicas: this.normalizeArray(parsed.caracteristicas),
          nivel_usuario: parsed.nivel_usuario || 'intermediario',
          sinonimos: this.normalizeArray(parsed.sinonimos),
          termos_relacionados: this.normalizeArray(parsed.termos_relacionados),
          produtos_recomendados: [],
          sugestao_curadoria: '',
          mensagem_personalizada: parsed.mensagem_personalizada || 'Estamos preparando o melhor para você...'
        };
        this.setCache(cacheKey, fallback);
        return fallback;
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error) {
      if (retries > 0) {
        return this.interpretSearch(query, retries - 1);
      }
      return SearchInterpretationSchema.parse({
        termo_busca: normalizedQuery,
        mensagem_personalizada: 'Explorando nossa coleção para você...'
      });
    }
  }

  async suggestComplements(productNames: string[]): Promise<z.infer<typeof CartSuggestionSchema>> {
    const productsStr = productNames.join(', ');
    const cacheKey = `cart_suggest_${productsStr}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um especialista em Cross-Sell (venda cruzada) para e-commerce de Bem-estar Íntimo.
      Analise os produtos no carrinho do usuário e sugira o que falta para completar a experiência através de um objeto json.
      
      PRODUTOS NO CARRINHO: "${productsStr}"
      
      REGRAS:
      1. Se houver um brinquedo, sugira higienizador ou lubrificante.
      2. Se houver lingerie, sugira acessórios ou cosméticos.
      3. Se o carrinho estiver vazio (o que não deve ocorrer), sugira os mais vendidos.
      
      Sua resposta deve ser estritamente um objeto json válido.

      FORMATO DE RETORNO (json):
      {
        "foco_complemento": "termo técnico de busca para o catálogo (ex: lubrificante, massageador)",
        "caracteristicas": ["silicone", "alto rendimento"],
        "motivo": "frase curta explicando por que esse item completa os que já estão no carrinho"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      const rawContent = response.choices[0].message.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
        if (parsed.caracteristicas) parsed.caracteristicas = this.normalizeArray(parsed.caracteristicas);
      } catch (e) {
        console.error('[AI][JSON_PARSE_ERROR]', rawContent);
        throw e;
      }

      const result = CartSuggestionSchema.safeParse(parsed);
      if (!result.success) {
        console.error('[AI][VALIDATION_ERROR]', result.error.format());
        console.error('[AI][RAW_PAYLOAD]', parsed);
        // Fallback robusto se a validação falhar
        return {
          foco_complemento: parsed.foco_complemento || 'higiene',
          caracteristicas: this.normalizeArray(parsed.caracteristicas).length > 0 ? this.normalizeArray(parsed.caracteristicas) : ['essenciais'],
          motivo: (parsed.motivo || 'Complementos ideais para sua compra.').substring(0, 150)
        };
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error) {
      console.error('Erro na OpenAI (suggestComplements):', error);
      return {
        foco_complemento: 'higiene',
        caracteristicas: ['antibactericida'],
        motivo: 'Mantenha seus itens sempre prontos para uso com segurança.'
      };
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
      
      Retorne a resposta estritamente no formato json.

      Retorne um objeto json com:
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
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
        if (parsed.palavras_chave) parsed.palavras_chave = this.normalizeArray(parsed.palavras_chave);
      } catch (e) {
        console.error('[AI][CATEGORY][JSON_PARSE_ERROR]', rawContent);
        throw e;
      }

      const result = CategoryContentSchema.safeParse(parsed);
      if (!result.success) {
        console.error('[AI][CATEGORY][VALIDATION_ERROR]', result.error.format());
        const fallback = {
          descricao: parsed.descricao || `Explore nossa categoria de ${nome}.`,
          conteudo_seo: parsed.conteudo_seo || `A categoria ${nome} oferece produtos exclusivos selecionados para sua satisfação.`,
          meta_title: (parsed.meta_title || `${nome} - Discreta Boutique`).substring(0, 100),
          meta_description: (parsed.meta_description || `Tudo o que você procura em ${nome} está aqui.`).substring(0, 200),
          palavras_chave: this.normalizeArray(parsed.palavras_chave).length > 0 ? this.normalizeArray(parsed.palavras_chave) : [nome]
        };
        this.setCache(cacheKey, fallback);
        return fallback;
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo de categoria (Restantes: ${retries})`);
        return this.generateCategoryContent(nome, retries - 1);
      }
      console.error('Erro na OpenAI (generateCategoryContent):', error);
      // Fallback final
      return {
        descricao: `Coleção especial de ${nome}.`,
        conteudo_seo: `Descubra os melhores produtos da categoria ${nome}.`,
        meta_title: nome,
        meta_description: `Variedade premium em ${nome}.`,
        palavras_chave: [nome]
      };
    }
  }
}

export const aiService = new AIService();
