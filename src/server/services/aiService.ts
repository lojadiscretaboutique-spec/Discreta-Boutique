import OpenAI from 'openai';
import { z } from 'zod';

const ProductContentSchema = z.object({
  titulo: z.string().max(100),
  descricao_curta: z.string(),
  descricao_longa: z.string(),
  meta_title: z.string().max(100),
  meta_description: z.string().max(200),
  palavras_chave: z.array(z.string()),
  sinonimos: z.array(z.string()).optional(),
  termos_busca: z.array(z.string()).optional()
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

  constructor() {
    console.log("AI SERVICE: Verificando configuração OPENAI...");
    console.log("OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  private async getValidCategories(): Promise<string[]> {
    if (Date.now() < this.categoriesCache.expiry && this.categoriesCache.data.length > 0) {
      return this.categoriesCache.data;
    }

    try {
      const { categoryService } = await import('../../services/categoryService');
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
      console.error("OPENAI KEY MISSING ON REQUEST");
      throw new Error('Falha na geração OpenAI: OPENAI_API_KEY não configurada no servidor.');
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

  async generateProductContent(nome: string, categoria: string | string[], retries = 2): Promise<z.infer<typeof ProductContentSchema>> {
    const catStr = Array.isArray(categoria) ? categoria.join(', ') : categoria;
    const cacheKey = `product_${nome}_${catStr}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Gerando conteúdo para produto: ${nome}`);

    const prompt = `
      Você é o copywriter sênior e estrategista de SEO número 1 do Brasil, especializado em e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é criar o conteúdo mais COMPLETO, SEDUTOR e PERSUASIVO possível para o seguinte produto:
      
      Produto: "${nome}"
      Categorias/Funcionalidades Relacionadas: "${catStr}"
      
      IMPORTANTE: Este produto pertence a MÚLTIPLAS categorias e possui diversas funcionalidades. 
      Certifique-se de que a descrição e os metadados abranjam todos os aspectos mencionados nestas categorias: ${catStr}.
      
      A Discreta Boutique não vende apenas objetos; ela vende experiências, autoconhecimento, prazer e elegância. 
      O conteúdo deve ser impecável, profissional e despertar desejo imediato.

      DIRETRIZES TÉCNICAS E DE ESTILO:
      - Tom de voz: Luxuoso, empoderado, sensual (sem jamais ser vulgar), seguro e sofisticado.
      - Foco em Benefícios: Não foque apenas nas funções; foque em como o usuário se sentirá ao usar.
      - Descrição Longa Primorosa: Use uma linguagem rica. Fale sobre texturas, sensações, som (discreto), facilidade de higienização e segurança dos materiais (silicone grau médico, livre de ftalatos, etc).
      - SEO Master: Crie conteúdo que rankeie no Google mas que seja delicioso de ler.
      
      ESTRUTURA DO JSON (Obrigatório):
      1. titulo: Uma "Headline" hipnótica (ex: "O Despertar do Prazer em sua Forma Mais Pura").
      2. descricao_curta: Um resumo "matador" de 2 a 3 frases que resume a essência do produto.
      3. descricao_longa: Um texto extenso e estruturado. Use <p> para parágrafos e <ul>/<li> para benefícios. Inclua uma seção "Por que você vai amar:" e outra "Especificações premium:".
      4. meta_title: Máximo 60 caracteres. Foco em cliques.
      5. meta_description: Máximo 155 caracteres. Deve conter uma promessa forte e "Entrega Segura e 100% Discreta".
      6. palavras_chave: 15 a 25 termos SEO de alta relevância (técnicos, de desejo e nicho). Deve incluir termos de todas as categorias: ${catStr}.
      7. sinonimos: 10 a 15 termos alternativos para busca interna (incluso nomes populares, variações e gírias discretas).
      8. termos_busca: 10 Frases que os clientes digitariam no Google para achar este produto específico considerando todas as suas funcionalidades.

      IMPORTANTE: A resposta deve ser estritamente um objeto JSON válido.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um assistente de IA especialista em e-commerce erótico de luxo. Suas descrições são poéticas, seguras e convertem em vendas. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const rawContent = response.choices[0].message.content || '{}';
      console.log("[AI] OpenAI Response status: success");
      
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
        if (parsed.palavras_chave) {
          parsed.palavras_chave = this.normalizeArray(parsed.palavras_chave);
        }
      } catch (e) {
        console.error('[AI][PRODUCT][JSON_PARSE_ERROR]', rawContent);
        throw new Error("Falha na geração OpenAI: Erro ao parsear JSON de resposta");
      }

      const result = ProductContentSchema.safeParse(parsed);
      if (!result.success) {
        console.error('[AI][PRODUCT][VALIDATION_ERROR]', result.error.format());
        throw new Error("Falha na geração OpenAI: Resposta não condiz com o schema esperado");
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error: any) {
      if (retries > 0) {
        console.warn(`[AI] Retentando geração de conteúdo (Restantes: ${retries}). Erro: ${error.message}`);
        return this.generateProductContent(nome, categoria, retries - 1);
      }
      console.error('Erro na OpenAI (generateProductContent):', error);
      throw new Error(`Falha na geração OpenAI: ${error.message}`);
    }
  }

  async huntProducts(query: string, products: any[]): Promise<{ 
    rankedIds: string[], 
    mensagem: string, 
    curadoria: string,
    caracteristicas: string[]
  }> {
    const compactProducts = products.map(p => ({
      id: p.id,
      n: p.name,
      c: p.categoryId || p.category,
      k: p.palavras_chave || [],
      d: (p.description || p.shortDescription || "").substring(0, 160),
      t: { c: p.stats?.clicks || 0, v: p.stats?.purchases || 0 }
    }));

    console.log(`[AI] Realizando busca semântica para: ${query}`);

    const prompt = `
      Você é o Especialista de Vendas da Discreta Boutique. Sua missão é selecionar e ranquear os MELHORES produtos do catálogo para a busca do cliente.
      
      BUSCA DO CLIENTE: "${query}"
      
      CATÁLOGO DISPONÍVEL (ID, Nome, Categoria, Keywords, Descrição, Termômetros[Clique/Venda]):
      ${JSON.stringify(compactProducts.slice(0, 80))} 
      
      REGRAS DE OURO:
      1. Entenda a INTENÇÃO real (ex: "presente romântico", "aliviar tpm", "primeira vez").
      2. Priorize o match SEMÂNTICO (o que o produto faz) sobre o nome exato.
      3. Use os "Termômetros": Produtos com mais vendas (v) e cliques (c) devem ter leve prioridade se forem relevantes.
      4. Selecione no máximo 20 produtos, em ordem decrescente de relevância.
      
      RETORNE APENAS JSON:
      {
        "rankedIds": ["id1", "id2"],
        "mensagem": "Uma frase curta (máx 100 caracteres) sedutora e técnica explicando por que escolheu esses itens",
        "curadoria": "Um título para a coleção (ex: Seleção Especial para Momentos A Dois)",
        "caracteristicas": ["3 palavras-chave que definem esse resultado"]
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um selecionador de produtos especializado em e-commerce. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        rankedIds: Array.isArray(parsed.rankedIds) ? parsed.rankedIds : [],
        mensagem: parsed.mensagem || "Selecionamos os itens perfeitos para seu desejo.",
        curadoria: parsed.curadoria || "Resultados da Busca",
        caracteristicas: Array.isArray(parsed.caracteristicas) ? parsed.caracteristicas : []
      };
    } catch (error: any) {
      console.error('[AI][HUNT_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Hunt): ${error.message}`);
    }
  }

  async suggestRelatedProducts(targetProduct: any, products: any[]): Promise<{ 
    rankedIds: string[], 
    mensagem: string 
  }> {
    const compactTarget = {
      id: targetProduct.id,
      name: targetProduct.name,
      cat: targetProduct.categoryId || targetProduct.category,
      keys: targetProduct.palavras_chave || [],
      desc: (targetProduct.description || targetProduct.shortDescription || "").substring(0, 200)
    };

    const candidates = products
      .filter(p => p.id !== targetProduct.id)
      .map(p => ({
        id: p.id,
        n: p.name,
        c: p.categoryId || p.category,
        k: p.palavras_chave || [],
        d: (p.description || p.shortDescription || "").substring(0, 120),
        t: { c: p.stats?.clicks || 0, v: p.stats?.purchases || 0 }
      }));

    console.log(`[AI] Sugerindo produtos relacionados para: ${targetProduct.name}`);

    const prompt = `
      Como Consultora Especialista da Discreta Boutique, seu objetivo é sugerir produtos que COMPLEMENTEM ou sejam EXCELENTES ALTERNATIVAS ao produto que o cliente está vendo agora.
      PRODUTO ATUAL: ${JSON.stringify(compactTarget)}
      CATÁLOGO DE CANDIDATOS: ${JSON.stringify(candidates.slice(0, 50))}
      RETORNE APENAS JSON:
      {
        "rankedIds": ["id1", "id2", "..."],
        "mensagem": "Uma frase elegante de convite (máx 80 caracteres)"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um consultor de e-commerce erótico. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        rankedIds: Array.isArray(parsed.rankedIds) ? parsed.rankedIds : [],
        mensagem: parsed.mensagem || "Você também pode gostar destas escolhas exclusivas:"
      };
    } catch (error: any) {
      console.error('[AI][SUGGEST_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Suggest): ${error.message}`);
    }
  }

  async interpretSearch(query: string, retries = 1): Promise<z.infer<typeof SearchInterpretationSchema>> {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      throw new Error("Falha na geração OpenAI: Termo de busca vazio");
    }

    const cacheKey = `search_v2_${normalizedQuery}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Interpretando busca: ${query}`);

    const validCategories = await this.getValidCategories();
    const prompt = `
      Você é um motor de busca semântico para a Discreta Boutique.
      BUSCA DO USUÁRIO: "${query}"
      CATEGORIAS VÁLIDAS: ${validCategories.join(", ")}.
      RETORNE APENAS JSON NO FORMATO:
      {
        "termo_busca": "versão limpa",
        "categoria": "nome da categoria ou Outros",
        "intencao": "objetivo",
        "caracteristicas": [],
        "sinonimos": [],
        "termos_relacionados": [],
        "nivel_usuario": "iniciante|intermediario|avancado",
        "mensagem_personalizada": "até 120 chars"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um motor de busca semântico. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      if (parsed.caracteristicas) parsed.caracteristicas = this.normalizeArray(parsed.caracteristicas);
      if (parsed.sinonimos) parsed.sinonimos = this.normalizeArray(parsed.sinonimos);
      if (parsed.termos_relacionados) parsed.termos_relacionados = this.normalizeArray(parsed.termos_relacionados);
      
      if (parsed.categoria && !validCategories.includes(parsed.categoria)) {
        parsed.categoria = 'Outros';
      }
      
      const result = SearchInterpretationSchema.safeParse(parsed);
      if (!result.success) throw new Error("Schema inválido");

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error: any) {
      if (retries > 0) return this.interpretSearch(query, retries - 1);
      console.error('[AI][INTERPRET_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Interpret): ${error.message}`);
    }
  }

  async suggestComplements(productNames: string[]): Promise<z.infer<typeof CartSuggestionSchema>> {
    const productsStr = productNames.join(', ');
    const cacheKey = `cart_suggest_v4_${productsStr}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Sugerindo complementos para carrinho: ${productsStr}`);

    const prompt = `
      Especialista em Mix de Produtos para Discreta Boutique.
      CARRINHO: "${productsStr}"
      RETORNE APENAS JSON:
      {
        "foco_complemento": "termo técnico",
        "caracteristicas": [],
        "motivo": "frase curta"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um especialista em cross-sell. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      if (parsed.caracteristicas) parsed.caracteristicas = this.normalizeArray(parsed.caracteristicas);

      const result = CartSuggestionSchema.safeParse(parsed);
      if (!result.success) throw new Error("Schema inválido");

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error: any) {
      console.error('Erro na OpenAI (suggestComplements):', error.message);
      throw new Error(`Falha na geração OpenAI (Complements): ${error.message}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`[AI] Gerando embedding para texto de tamanho: ${text.length}`);
      const client = this.getClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      console.error('[AI][EMBEDDING_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Embedding): ${error.message}`);
    }
  }

  async enrichProduct(title: string, description: string): Promise<{keywords: string[], synonyms: string[], searchTerms: string[]}> {
    console.log(`[AI] Enriquecendo produto: ${title}`);
    const prompt = `
      Especialista SEO Adulto Premium.
      PRODUTO: "${title}"
      DESCRIÇÃO: "${description}"
      RETORNE APENAS JSON:
      { "keywords": [], "synonyms": [], "searchTerms": [] }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um estrategista de SEO. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        keywords: this.normalizeArray(parsed.keywords),
        synonyms: this.normalizeArray(parsed.synonyms),
        searchTerms: this.normalizeArray(parsed.searchTerms)
      };
    } catch (error: any) {
      console.error('[AI][ENRICH_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Enrich): ${error.message}`);
    }
  }

  async generateCategoryContent(nome: string, retries = 2): Promise<z.infer<typeof CategoryContentSchema>> {
    const cacheKey = `category_${nome}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Gerando conteúdo para categoria: ${nome}`);

    const prompt = `
      Copywriter Luxo Discreta Boutique.
      CATEGORIA: "${nome}"
      RETORNE APENAS JSON:
      { "descricao": "", "conteudo_seo": "", "meta_title": "", "meta_description": "", "palavras_chave": [] }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um copywriter de luxo. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      if (parsed.palavras_chave) parsed.palavras_chave = this.normalizeArray(parsed.palavras_chave);

      const result = CategoryContentSchema.safeParse(parsed);
      if (!result.success) throw new Error("Schema inválido");

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error: any) {
      if (retries > 0) return this.generateCategoryContent(nome, retries - 1);
      console.error('Erro na OpenAI (generateCategoryContent):', error.message);
      throw new Error(`Falha na geração OpenAI (Category): ${error.message}`);
    }
  }
}

export const aiService = new AIService();
