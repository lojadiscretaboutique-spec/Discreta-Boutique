import OpenAI from 'openai';
import { z } from 'zod';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  subcategorias_sugeridas: z.array(z.string()).optional().default([]),
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
  descricao_curta: z.string(),
  descricao_completa: z.string(),
  meta_titulo: z.string().max(100),
  meta_descricao: z.string().max(200),
  palavras_chave: z.array(z.string())
});

class AIService {
  private openai: OpenAI | null = null;
  private cache = new Map<string, { data: any; expiry: number }>();
  private CACHE_TTL = 3600000; // 1 hora
  private categoriesCache: { data: string[], expiry: number } = { data: [], expiry: 0 };

  constructor() {
    console.log("-----------------------------------------");
    console.log("AI SERVICE: Verificando configuração...");
    const keyExists = !!process.env.OPENAI_API_KEY;
    console.log("OPENAI KEY EXISTS:", keyExists);
    if (!keyExists) {
      console.warn("[CRITICAL] OPENAI_API_KEY NÃO ENCONTRADA! As funcionalidades de IA serão desativadas.");
    }
    console.log("-----------------------------------------");
    
    if (keyExists) {
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
      const errorMsg = 'Configuração Ausente: A chave OPENAI_API_KEY não foi configurada no servidor (Secrets). Por favor, adicione a chave no painel de configurações para habilitar as funções de IA.';
      console.error(`[AI][CONFIG_ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
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

  async generateProductContent(nome: string, categoria: string | string[], existingDescription?: string, retries = 2): Promise<z.infer<typeof ProductContentSchema>> {
    const catStr = Array.isArray(categoria) ? categoria.join(', ') : categoria;
    const cacheKey = `product_v2_${nome}_${catStr}_${existingDescription ? existingDescription.substring(0, 50) : ''}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Gerando conteúdo para produto: ${nome}`);
    const startTime = Date.now();

    const prompt = `
      Você é o copywriter sênior e estrategista de SEO número 1 do Brasil, especializado em e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é criar o conteúdo mais COMPLETO, SEDUTOR e PERSUASIVO possível para o seguinte produto:
      
      Produto: "${nome}"
      Categorias/Funcionalidades Relacionadas: "${catStr}"
      ${existingDescription ? `\nCONTEXTO ADICIONAL (Descrição Atual): "${existingDescription}"` : ''}
      
      IMPORTANTE: ${existingDescription ? 'Utilize a descrição atual como base de contexto, mas REESCREVA para torná-la luxuosa, sedutora e otimizada para SEO.' : 'Este produto pertence a MÚLTIPLAS categorias e possui diversas funcionalidades.'}
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
      const duration = Date.now() - startTime;
      console.log(`[AI] OpenAI Response status: success (${duration}ms). Tokens: ${response.usage?.total_tokens || 'N/A'}`);
      
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
        return this.generateProductContent(nome, categoria, existingDescription, retries - 1);
      }
      console.error('Erro na OpenAI (generateProductContent):', error);
      throw new Error(`Falha na geração OpenAI: ${error.message}`);
    }
  }

  async huntProducts(searchQuery: string, products: any[]): Promise<{ 
    rankedIds: string[], 
    mensagem: string, 
    curadoria: string,
    caracteristicas: string[]
  }> {
    const compactProducts = products.map(p => ({
      id: p.id,
      n: p.name,
      c: p.categoryId || p.category,
      k: p.palavras_chave || p.tags || [],
      d: (p.description || p.shortDescription || p.subtitle || "").substring(0, 160),
      t: { c: p.cliques || 0, v: p.conversoes || 0, s: p.score || 0 }
    }));

    console.log(`[AI] Realizando busca semântica para: ${searchQuery}`);
    const startTime = Date.now();

    // Buscar métricas de buscas recentes para dar contexto de tendência
    let trendContext = "";
    try {
      const searchesRef = collection(db, 'intelligent_searches');
      const qTrends = query(searchesRef, orderBy('cliques', 'desc'), limit(10));
      const trendSnap = await getDocs(qTrends);
      const topTerms = trendSnap.docs.map(d => d.data().termo);
      if (topTerms.length > 0) {
        trendContext = `TENDÊNCIAS RECENTES (O que outros estão buscando): ${topTerms.join(', ')}`;
      }
    } catch (e) {}

    const prompt = `
      Você é o Especialista de Vendas da Discreta Boutique. Sua missão é selecionar e ranquear os MELHORES produtos do catálogo para a busca do cliente.
      
      BUSCA DO CLIENTE: "${searchQuery}"
      ${trendContext ? `\nCONTEXTO DE TENDÊNCIA: ${trendContext}` : ''}
      
      CATÁLOGO DISPONÍVEL (ID, Nome, Categoria, Keywords, Descrição, Stats[Cliques c/Vendas v/Relevância s]):
      ${JSON.stringify(compactProducts.slice(0, 100))} 
      
      REGRAS DE OURO:
      1. Entenda a INTENÇÃO real (ex: "presente romântico", "primeira vez", "algo para casal").
      2. Pense em SINÔNIMOS e contextos (ex: "discreto" pode ser um item pequeno ou silencioso).
      3. Use os Stats: Produtos com mais relevância (s) e vendas (v) devem ter prioridade se houver match semântico.
      4. Selecione no máximo 24 produtos, em ordem decrescente de relevância.
      
      RETORNE APENAS JSON:
      {
        "rankedIds": ["id1", "id2"],
        "mensagem": "Uma frase elegante e técnica explicando por que escolheu esses itens",
        "curadoria": "Um título para a coleção",
        "caracteristicas": ["3 tags representativas"]
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
      const duration = Date.now() - startTime;
      console.log(`[AI] OpenAI Hunt status: success (${duration}ms). Tokens: ${response.usage?.total_tokens || 'N/A'}`);

      return {
        rankedIds: Array.isArray(parsed.rankedIds) ? parsed.rankedIds : [],
        mensagem: parsed.mensagem || "Selecionamos os itens perfeitos para seu desejo.",
        curadoria: parsed.curadoria || "Sua Seleção Exclusiva",
        caracteristicas: Array.isArray(parsed.caracteristicas) ? parsed.caracteristicas : []
      };
    } catch (error: any) {
      console.error('[AI][HUNT_ERROR]', error.message);
      throw new Error(`Falha na geração OpenAI (Hunt): ${error.message}`);
    }
  }

  async analyzeCatalog(products: any[], categories: any[]): Promise<any> {
    console.log(`[AI] Categorizing and Analyzing Catalog...`);
    
    const compactProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      cat: p.categoryId,
      v: p.conversoes || 0,
      c: p.cliques || 0
    }));

    const prompt = `
      Você é um Consultor de Merchandising E-commerce Gênial.
      Analise o catálogo da Discreta Boutique e sugira melhorias na ORGANIZAÇÃO.
      
      CATEGORIAS ATUAIS: ${JSON.stringify(categories.map(c => ({ id: c.id, nome: c.name })))}
      PRODUTOS E PERFORMANCE: ${JSON.stringify(compactProducts.slice(0, 100))}
      
      SUA TAREFA:
      1. Identifique categorias que estão "bombando" (muitas vendas/cliques).
      2. Identifique produtos que podem estar na categoria errada ou que precisam de uma nova categoria (ex: "Mais Vendidos", "Kits de Luxo").
      3. Sugira 3 estratégias de agrupamento para aumentar conversão.
      
      RETORNE APENAS JSON:
      {
        "insights": ["insight 1", "insight 2"],
        "sugestoesCategorias": [{"nome": "Nova Categoria", "motivo": "...", "produtosIds": ["id1"]}],
        "rankingCategorias": ["catId1", "catId2"]
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um consultor de e-commerce focado em análise de dados e conversão.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      console.error('[AI][CATALOG_ANALYSIS_ERROR]', error.message);
      return { insights: ["Foque em itens de alto clique para aumentar conversão."], sugestoesCategorias: [], rankingCategorias: [] };
    }
  }

  async botConsult(pergunta: string, context?: any): Promise<string> {
    console.log(`[AI] Bot Consult: ${pergunta}`);
    
    const prompt = `
      Você é a Especialista Discreta, a assistente virtual de uma boutique erótica de luxo.
      Seu tom é elegante, educado, empoderador e informativo. 
      Nunca seja vulgar. Use discrição e segurança como pilares.
      
      PERGUNTA DO CLIENTE: "${pergunta}"
      CONTEXTO: ${JSON.stringify(context || {})}
      
      Responda de forma curta (máx 3 parágrafos). 
      Se o cliente perguntar sobre produtos, sugira que ele use a busca inteligente do site.
      Se ele perguntar sobre entrega, diga que é 100% discreta, sem nome da loja na caixa.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é a Especialista Discreta. Elegante, empoderadora e técnica.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });

      return response.choices[0].message.content || "Olá! Como posso ajudar você hoje em sua jornada de descoberta?";
    } catch (error: any) {
      console.error('[AI][BOT_ERROR]', error.message);
      return "Desculpe, estou com uma pequena instabilidade agora. Mas saiba que nossa entrega é discreta e estamos aqui para você!";
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

    const cacheKey = `search_v3_${normalizedQuery}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Interpretando busca: ${query}`);

    const validCategories = await this.getValidCategories();
    const prompt = `
      Você é a inteligência de interpretação linguística e semântica da Discreta Boutique.
      Sua missão é extrair a REAL INTENÇÃO do cliente para que nosso sistema possa buscar no banco de dados real.

      REGRAS ABSOLUTAS:
      1. VOCÊ JAMAIS ESCOLHE OU RETORNA PRODUTOS. VOCÊ APENAS GERA METADADOS PARA O MOTOR DE BUSCA.
      2. CATEGORIA: Identifique qual das categorias abaixo melhor se encaixa no desejo do usuário.
         Categorias Válidas: ${validCategories.join(", ")}.
      3. TAGS SEO: Gere uma lista de 15 a 20 palavras-chave (tags) que caracterizam o produto ideal para o usuário.
      4. SINÔNIMOS E VARIAÇÕES: Pense em termos técnicos, discretos, populares e até gírias do nicho.
      5. MENSAGEM: Uma frase curta, elegante e acolhedora de recepção (máx 120 caracteres).
      6. INTENÇÃO: Explique brevemente o que o usuário está procurando (ex: "Busca por intensificação de prazer anal com foco em iniciantes").

      BUSCA DO USUÁRIO: "${query}"

      RETORNE APENAS JSON NO FORMATO:
      {
        "termo_busca": "termo purificado para o motor de busca",
        "categoria": "nome exato da categoria acima ou 'Outros'",
        "subcategorias_sugeridas": ["3 a 5 subcategorias ou sub-nichos específicos"],
        "intencao": "explicação da intenção detectada",
        "caracteristicas": ["características físicas, sensoriais ou técnicas (ex: 'recarregável', 'toque aveludado', 'lubrificação íntima')"],
        "sinonimos": ["lista extensiva de sinônimos"],
        "termos_relacionados": ["termos complementares que expandem a busca"],
        "nivel_usuario": "iniciante|intermediario|avancado",
        "mensagem_personalizada": "frase de acolhimento elegante"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um motor de busca semântico especializado em e-commerce sensorial de luxo. Sua função é interpretar intenção e expandir termos para busca em banco de dados. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      if (parsed.caracteristicas) parsed.caracteristicas = this.normalizeArray(parsed.caracteristicas);
      if (parsed.sinonimos) parsed.sinonimos = this.normalizeArray(parsed.sinonimos);
      if (parsed.termos_relacionados) parsed.termos_relacionados = this.normalizeArray(parsed.termos_relacionados);
      if (parsed.subcategorias_sugeridas) parsed.subcategorias_sugeridas = this.normalizeArray(parsed.subcategorias_sugeridas);
      
      if (parsed.categoria && !validCategories.includes(parsed.categoria)) {
        parsed.categoria = 'Outros';
      }
      
      this.setCache(cacheKey, parsed);
      return parsed;
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

  async generateCategoryContent(nome: string, slug?: string, existingDesc?: string, retries = 2): Promise<z.infer<typeof CategoryContentSchema>> {
    const cacheKey = `category_v2_${nome}_${slug || ''}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    console.log(`[AI] Gerando conteúdo SEO para categoria: ${nome}`);
    const startTime = Date.now();

    const prompt = `
      Você é um Especialista em SEO e Copywriter de Luxo para a Discreta Boutique.
      Sua missão é gerar conteúdo de alta performance para a categoria: "${nome}".
      
      CONTEXTO:
      Slug: "${slug || ''}"
      Descrição Atual (se houver): "${existingDesc || ''}"
      
      RETORNE APENAS JSON NO FORMATO:
      {
        "descricao_curta": "Texto comercial, objetivo e direto para o topo da página (máx 3 frases).",
        "descricao_completa": "Texto rico em SEO, persuasivo, humanizado e focado em conversão. Use uma linguagem luxuosa e segura (máx 3 parágrafos).",
        "meta_titulo": "Título forte para Google (máx 60 chars) com alto CTR.",
        "meta_descricao": "Descrição persuasiva para Google (máx 155 chars) terminando com 'Entrega 100% Discreta'.",
        "palavras_chave": ["pelo menos 15 a 20 tags incluindo sinônimos e termos de busca relacionados"]
      }
      
      IMPORTANTE: A Discreta Boutique é elegante e empoderadora. Evite qualquer tipo de vulgaridade.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um estrategista de SEO de luxo. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const rawContent = response.choices[0].message.content || '{}';
      const duration = Date.now() - startTime;
      console.log(`[AI] OpenAI Category SEO status: success (${duration}ms). Tokens: ${response.usage?.total_tokens || 'N/A'}`);

      const parsed = JSON.parse(rawContent);
      if (parsed.palavras_chave) parsed.palavras_chave = this.normalizeArray(parsed.palavras_chave);

      const result = CategoryContentSchema.safeParse(parsed);
      if (!result.success) {
         console.error('[AI][CATEGORY][VALIDATION_ERROR]', result.error.format());
         throw new Error("Schema inválido");
      }

      this.setCache(cacheKey, result.data);
      return result.data;
    } catch (error: any) {
      if (retries > 0) return this.generateCategoryContent(nome, slug, existingDesc, retries - 1);
      console.error('Erro na OpenAI (generateCategoryContent):', error.message);
      throw new Error(`Falha na geração OpenAI (Category): ${error.message}`);
    }
  }

  async homeCuratory(products: any[]): Promise<{ 
    destaques: string[], 
    lancamentos: string[], 
    maisVendidos: string[],
    emAlta: string[],
    fraseImpacto: string
  }> {
    const compactProducts = products.map(p => ({
      id: p.id,
      n: p.name,
      c: p.categoryId || p.category,
      t: { c: p.cliques || 0, v: p.conversoes || 0, s: p.score || 0 },
      feat: p.featured,
      new: p.newRelease
    }));

    console.log(`[AI] Gerando curadoria inteligente para Home Page`);
    const startTime = Date.now();

    const prompt = `
      Você é o Diretor Criativo da Discreta Boutique. 
      Sua tarefa é organizar a vitrine virtual para maximizar a conversão e o desejo.
      
      PRODUTOS DISPONÍVEIS:
      ${JSON.stringify(compactProducts.slice(0, 150))}
      
      REGRAS:
      1. destaques: Selecione 8 a 12 produtos que têm alto score (s) ou são 'feat'.
      2. lancamentos: Selecione 8 a 12 produtos que são 'new' ou têm IDs recentes (maiores).
      3. maisVendidos: Selecione 8 a 12 produtos com maiores (v).
      4. emAlta: Selecione 8 a 12 produtos com muito (c) mas poucos (v) - potencial de virar tendência.
      5. fraseImpacto: Uma frase luxuosa para o banner principal.
      
      RETORNE APENAS JSON:
      {
        "destaques": ["id1", "id2"],
        "lancamentos": ["id3", "id4"],
        "maisVendidos": ["id5", "id6"],
        "emAlta": ["id7", "id8"],
        "fraseImpacto": "Sua frase"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um diretor de e-commerce de luxo. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      const duration = Date.now() - startTime;
      console.log(`[AI] OpenAI Home Curatory status: success (${duration}ms)`);

      return {
        destaques: Array.isArray(parsed.destaques) ? parsed.destaques : [],
        lancamentos: Array.isArray(parsed.lancamentos) ? parsed.lancamentos : [],
        maisVendidos: Array.isArray(parsed.maisVendidos) ? parsed.maisVendidos : [],
        emAlta: Array.isArray(parsed.emAlta) ? parsed.emAlta : [],
        fraseImpacto: parsed.fraseImpacto || "O Despertar do Prazer em sua Forma Mais Pura."
      };
    } catch (error: any) {
      console.error('[AI][HOME_CURATORY_ERROR]', error.message);
      return { destaques: [], lancamentos: [], maisVendidos: [], emAlta: [], fraseImpacto: "A sua Boutique Discreta." };
    }
  }

  async rankOffers(products: any[]): Promise<string[]> {
    // Limitar para os primeiros 40 produtos para evitar payloads gigantes e garantir qualidade no ranking
    const topProducts = products.slice(0, 40);
    
    const compactProducts = topProducts.map(p => ({
      id: p.id,
      n: (p.name || "").substring(0, 80), // Limitar nome para economizar tokens
      p: p.price,
      pp: p.promoPrice,
      d: p.price > 0 ? (((p.price - (p.promoPrice || p.price)) / p.price * 100).toFixed(0) + '%') : '0%',
      c: p.cliques || 0,
      v: p.conversoes || 0,
      s: p.score || 0
    }));

    console.log(`[AI] Ranquando ${compactProducts.length} ofertas para vitrine premium`);
    const startTime = Date.now();

    const prompt = `
      Você é o Diretor de Merchandising da Discreta Boutique. 
      Sua missão é RANQUEAR as melhores ofertas para uma vitrine premium de alta conversão.
      
      ITENS DISPONÍVEIS:
      ${JSON.stringify(compactProducts)}
      
      REGRAS DE RANQUEAMENTO:
      1. Priorize produtos com MAIOR PERCENTUAL DE DESCONTO.
      2. Considere o apelo visual e luxo (pelo nome do produto).
      3. Use Stats: Produtos com mais relevância (s) e vendas (v) devem subir no ranking.
      4. Itens que parecem "Trend" ou "Must-have" devem ser destacados.
      5. Retorne os IDs na ordem decrescente de prioridade visual.

      IMPORTANTE: Retorne APENAS um objeto JSON no formato exatamente igual a:
      {
        "rankedIds": ["id1", "id2", "id3", ...]
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um estrategista de vendas de e-commerce focado em Discreta Boutique. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000 // Suficiente para 40-50 IDs e evita respostas infinitas se a IA "alucinar"
      });

      const content = response.choices[0].message.content || '{"rankedIds": []}';
      
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('[AI][RANK_OFFERS][PARSE_ERROR] Tentando recuperar JSON...', content.substring(0, 100));
        // Fallback simples se o JSON vier quebrado mas com o array visível
        const match = content.match(/\[\s*".*?"\s*(,\s*".*?"\s*)*\]/);
        if (match) {
          parsed = { rankedIds: JSON.parse(match[0]) };
        } else {
          throw parseError;
        }
      }
      
      const rankedIds = Array.isArray(parsed) ? parsed : (parsed.rankedIds || parsed.ids || []);
      
      const duration = Date.now() - startTime;
      console.log(`[AI] OpenAI Ranking status: success (${duration}ms)`);

      return rankedIds;
    } catch (error: any) {
      console.error('[AI][RANK_OFFERS_ERROR]', error.message);
      // Fallback para a ordem original do banco se a IA falhar
      return products.map(p => p.id);
    }
  }

  async generateMarketingCalendarPosts(
    brandRules: string,
    objectives: string,
    days: string[],
    postsPerDay: number
  ) {
    const startTime = Date.now();
    console.log(`[AI] Generating marketing posts calendar for ${days.length} days, style: ${postsPerDay} posts/day`);

    const prompt = `
      Você é o Gerente Criativo de Mídias Sociais da Discreta Boutique (um sexshop premium e romântico, elegante, especialista em lingeries sensuais e bem-estar íntimo da marca discretaboutique.com.br).
      Sua missão é desenvolver legendas e ideias de postagem ricas, elaboradas, provocativas, sofisticadas e prontas para uso para o feed do Instagram da marca nas seguintes datas específicas (formato YYYY-MM-DD):
      ${days.join(', ')}

      QUANTIDADE: Para CADA uma das datas fornecidas enumeradas, você deve gerar exatamente ${postsPerDay} ideias de postagem.
      
      DIRETRIZES DE MARCA / REGRAS DE ADEQUAÇÃO:
      ${brandRules || "Tom elegante, sensual, discreto e premium. Evitar termos chulos ou vulgars. Focar no empoderamento, prazer saudável, mistério e sofisticação."}

      OBJETIVO(S) DA CAMPANHA DE FEED:
      ${objectives}

      REGRAS COMPORTAMENTAIS DE REDAÇÃO (COPYWRITING):
      1. NÃO descreva de forma abstrata o que deve estar na foto ou na arte (evite termos como "Uma imagem de lingerie preta..."). Em vez disso, assuma o papel de redator de elite e escreva a LEGENDA REAL DO FEED, pronta para o lojista copiar e publicar!
      2. Use excelente espaçamento com quebras de linha duplas para deixar o texto leve e esteticamente escaneável no Instagram.
      3. Use emojis elegantes, sensuais e profissionais para destacar as frases e tópicos (como: 🖤, 👀, 🚚, 🎁, ✨, 💋, 🥂, 🕊️, 🔥).
      4. Crie listas charmosas com bullet points para reforçar vantagens e diferenciais da Discreta Boutique.
      5. Redija em um estilo elaborado e envolvente, igual ou superior ao exemplo de referência a seguir:
         
         "Estamos preparando novidades especiais para tornar esse momento ainda mais inesquecível 👀
         
         🖤 envio discreto
         🚚 entrega rápida
         🎁 novidades exclusivas
         
         Fique de olho nos próximos posts ✨"

      6. Garanta uma ótima Chamada para Ação (CTA) ao final, convidando discretamente à consulta na bio, no site ou via atendimento privativo no WhatsApp.

      ESTRUTURA DO JSON (Retorne estritamente um JSON com este formato exato):
      {
        "ideas": [
          {
            "date": "YYYY-MM-DD",
            "titulo": "Título de Impacto ou Headline",
            "descricao": "Legenda real altamente elaborada e pronta para o feed (com quebras de linha e emojis no estilo exigido)",
            "hashtags": "#discretaboutique #sexshoppremium #bemestarintimo #casal"
          }
        ]
      }
      
      IMPORTANTE: A resposta deve ser EXCLUSIVAMENTE um objeto JSON válido, contendo as ideias devidamente mapeadas para as datas passadas. Não inclua blocos markdown como \`\`\`json em torno do resultado.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um estrategista de conteúdo premium. Retorne APENAS um objeto JSON válido no formato solicitado, sem markdown ou textos adicionais.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const rawContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawContent);

      const duration = Date.now() - startTime;
      console.log(`[AI] Calendar Posts Generated: success (${duration}ms)`);
      return parsed;
    } catch (error: any) {
      console.error('Erro no generateMarketingCalendarPosts (AI):', error.message);
      throw new Error(`Falha ao gerar ideias de postagem: ${error.message}`);
    }
  }

  async generateStrategicReport(data: any): Promise<any> {
    console.log(`[AI] Gerando Relatorio Estrategico (PROMPT MASTER - DISCRETA BOUTIQUE)`);
    const startTime = Date.now();

    const prompt = `
PROMPT MASTER — CENTRAL DE INTELIGÊNCIA ESTRATÉGICA DA DISCRETA BOUTIQUE

Você é a Central de Inteligência Estratégica da Discreta Boutique.
Sua verdadeira função é atuar como diretor de inteligência comercial, analista de crescimento, estrategista de varejo, especialista em comportamento do consumidor, lucratividade, retenção e conversão.

Sua missão é transformar dados reais em diagnósticos estratégicos, alertas críticos e decisões acionáveis.

DADOS DO SISTEMA (E-COMMERCE E LOJA FÍSICA):
${JSON.stringify({
  catalogo: {
    totalProdutos: data.stats.activeProducts,
    amostraProdutos: data.products.slice(0, 80) // Amostra significativa
  },
  ecommerce: {
    totalPedidosAnalisados: data.stats.totalOrders,
    receitaEcommerce: data.totalRevenue,
    ticketMedio: data.avgTicket,
    amostraPedidos: data.ecommerceOrders.slice(0, 30)
  },
  lojaFisica: {
    receitaFisica: data.totalPhysicalRevenue,
    amostraVendas: data.physicalSales.slice(0, 30)
  },
  comportamentoBusca: data.searchLogs
})}

ESTRUTURA DE ANÁLISE OBRIGATÓRIA:
1 — MÓDULO DE DIAGNÓSTICO EXECUTIVO: Resumo estratégico para diretoria.
2 — MÓDULO DE OPORTUNIDADES: Descobrir produtos escondidos, combos, upsell e tendências.
3 — MÓDULO DE ALERTAS CRÍTICOS: Quedas de conversão, estoque parado, prejuízos.
4 — MÓDULO DE COMPORTAMENTO DO CLIENTE: Padrões de compra, recorrência e perfis (impulsivo, premium, etc).
5 — MÓDULO DE DECISÕES E AÇÕES: O que fazer agora (reorganizar vitrine, alterar preço, criar kits).
6 — MÓDULO PREDITIVO: Prever quedas, sazonalidade e sucessos futuros.
7 — MÓDULO DE COMPARAÇÃO ESTRATÉGICA: Online vs Físico, mudanças de padrão.

REGRA ABSOLUTA: NÃO mostre apenas números. Transforme dados em interpretação, impacto e ação recomendada.

RETORNE APENAS JSON NO SEGUINTE FORMATO:
{
  "diagnostico_executivo": "Texto profundo e estratégico",
  "principais_descobertas": ["Insight 1", "..."],
  "oportunidades": [
    { "titulo": "Nome", "descricao": "Por que e como" }
  ],
  "problemas_criticos": [
    { "problema": "Nome", "gravidade": "Alta|Media|Baixa", "impacto": "Financeiro/Operacional", "acao": "Imediata" }
  ],
  "comportamento_cliente": {
    "padrao_identificado": "Descrição do comportamento atual",
    "perfis_dominantes": ["Perfil 1", "Perfil 2"]
  },
  "acoes_recomendadas": [
    { "acao": "O que", "motivo": "Por que", "prioridade": "Alta|Media|Baixa", "impacto_esperado": "Resultado" }
  ],
  "previsoes": ["Previsão 1", "Previsão 2"],
  "comparacao_estrategica": "Análise Online vs Físico ou Períodos",
  "resumo_final": "Veredito executivo final"
}
`;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é a Inteligência Estratégica Discreta. Pense como um Diretor de e-commerce de luxo. Retorne APENAS JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      const duration = Date.now() - startTime;
      console.log(`[AI] Strategic Report Generated: success (${duration}ms)`);

      return parsed;
    } catch (error: any) {
      console.error('Erro no generateStrategicReport (AI):', error.message);
      throw new Error(`Falha estratégica: ${error.message}`);
    }
  }

  async generateMarketingCopywriting(topic: string, tone: string, ctaGoal: string, format: string): Promise<any> {
    const prompt = `Você é um Copywriter Especialista da Boutique Discreta, focado em marketing de luxo, sedução e moda íntima premium.
Escreva 3 variações de publicações de marketing para o Instagram baseadas nas seguintes diretrizes:

TÓPICO/IDEIA: "${topic}"
TOM DE VOZ: "${tone}" (por exemplo: Sensual de Luxo, Romântico, Provocativo, Sofisticado)
OBJETIVO DO CTA: "${ctaGoal}" (por exemplo: chamar no whatsapp, comprar no site, engajar, salvar)
FORMATO DO POST: "${format}" (por exemplo: Feed, Stories, Reels)

As três opções devem ter abordagens bem distintas:
- Opção A: Foco Sensorial, Elegância & Desejo (Poético e sofisticado)
- Opção B: Foco no Produto & Benefícios Exclusivos (Foco em tecido, caimento e ajuste perfeito)
- Opção C: Foco Comercial, Urgência & Escassez (Foco em cupom, poucas peças, ação imediata)

Retorne estritamente um objeto JSON com a seguinte estrutura:
{
  "options": [
    {
      "label": "Abordagem sensorial...",
      "headline": "Gancho matador e charmoso",
      "copy": "Texto primoroso, formatado, espaçado com parágrafos curtos e emojis que valorizam lingeries e sofisticação.",
      "cta": "Legenda ou chamada do CTA clara",
      "hashtags": ["discretaboutique", "lingeriepremium"]
    }
  ]
}
`;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é a Inteligência Estratégica Discreta. Retorne apenas JSON válido.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });
      return JSON.parse(response.choices[0].message.content || '{"options": []}');
    } catch (err: any) {
      console.error('[AI] Copywriting failed:', err.message);
      return {
        options: [
          {
            label: "Abordagem Sensorial (Luxo & Poesia)",
            headline: `✨ Sedução em cada detalhe: ${topic}`,
            copy: `Sinta a sofisticação na pele com as peças mais desejadas da Discreta Boutique. Um toque sutil de renda premium redesenhando sua confiança.\n\nExperimente a coleção e descubra o poder de se sentir linda por completo.`,
            cta: `Clique no link da nossa bio e garanta o seu hoje mesmo. Atendimento personalizado online.`,
            hashtags: ["discretaboutique", "lingeriestudio", "autoestima", "rendadeluxo"]
          },
          {
            label: "Abordagem Foco Conforto & Ajuste",
            headline: "🌹 O toque que redefine o seu autocuidado",
            copy: `Delicadeza que abraça seu corpo. Cada renda, costura e fecho foi selecionada para criar a harmonia ideal entre elegância insuperável e conforto absoluto.\n\nVista-se de si mesma com a Discreta Boutique.`,
            cta: `Adicione o cupom EXCLUSIVO e compre direto pelo site oficial.`,
            hashtags: ["discretaboutique", "mulhereselegantes", "confortoeestilo"]
          },
          {
            label: "Abordagem Comercial (Urgência & Escassez)",
            headline: "⚡ ÚLTIMO CHAMADO: Peças limitadíssimas!",
            copy: `Seu closet merece o glamour definitivo. Unidades remanescentes da nossa coleção premium de lingeries com condições especiais de lançamento.\n\nEvite ficar sem seu tamanho! Garanta agora com frete grátis nacional acima de R$199.`,
            cta: `Chame agora nossas consultoras no direct ou fale via WhatsApp clicando no link do perfil.`,
            hashtags: ["discretaboutique", "lingerieexclusiva", "promocaomoda"]
          }
        ]
      };
    }
  }

  async generateMarketingImage(imagePrompt: string, referenceUrl?: string): Promise<{ imageUrl: string }> {
    console.log(`[AI] Generating marketing image... Reference URL: ${referenceUrl}`);
    try {
      if (process.env.OPENAI_API_KEY) {
        const client = this.getClient();
        const response = await client.images.generate({
          model: "dall-e-3",
          prompt: `${imagePrompt}. Focus on luxurious details, sensual lace, high-end studio modeling. Elegant aesthetics, warm lighting, romantic luxury bedroom, stylish packaging. Exclude explicit content, keep it premium boutique grade. No text.`,
          n: 1,
          size: "1024x1024",
          quality: "standard"
        });
        if (response.data?.[0]?.url) {
          return { imageUrl: response.data[0].url };
        }
      }
    } catch (err: any) {
      console.warn(`[AI] Real image generation failed, calling fallbacks:`, err.message);
    }

    const fallbacks = [
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600",
      "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=600",
      "https://images.unsplash.com/photo-1615396899839-c99c121888b0?q=80&w=600",
      "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?q=80&w=600",
      "https://images.unsplash.com/photo-1549439602-43ebcb23281f?q=80&w=600",
      "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=600"
    ];
    const randomIndex = Math.floor(Math.random() * fallbacks.length);
    return { imageUrl: fallbacks[randomIndex] };
  }

  async marketingRewrite(originalCopy: string, instruction: string): Promise<{ copy: string }> {
    const prompt = `Reescreva a seguinte legenda de Instagram da Boutique Discreta baseando-se especificamente nestas instruções:
INSTRUÇÃO: "${instruction}"

LEGENDA ORIGINAL:
"${originalCopy}"

Mantenha o tom sofisticado, as formatações limpas, emojis adequados e hashtags. Retorne a legenda reescrita direta, polida e pronta para colar. Retorne no formato de texto limpo em JSON:
{
  "copy": "versão reescrita..."
}
`;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é a Inteligência Estratégica Discreta. Retorne JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });
      return JSON.parse(response.choices[0].message.content || `{"copy": "${originalCopy}"}`);
    } catch (err: any) {
      console.error('[AI] Rewrite failed:', err.message);
      return { copy: `${originalCopy} (Reescrito com instrução: ${instruction})` };
    }
  }

}

export const aiService = new AIService();
