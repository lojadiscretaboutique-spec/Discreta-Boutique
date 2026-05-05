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
      Você é um copywriter sênior especializado em e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é criar um conteúdo ENCANTADOR, PERSUASIVO e REALISTA que transforme visitantes em clientes.
      
      Produto: "${nome}"
      Categoria: "${categoria}"
      
      DIRETRIZES DE ESTILO:
      - Tom de voz: Elegante, sensual (sem ser vulgar), sofisticado e acolhedor.
      - Foco: Desperte o desejo através de benefícios sensoriais e emocionais.
      - Vocabulário: Use termos como "toque aveludado", "momentos inesquecíveis", "design anatômico", "elegância discreta", "experiência única".
      - Proibição: NUNCA use termos vulgares, explícitos, gírias de baixo calão ou descrições pornográficas.
      
      INSTRUÇÕES PARA OS CAMPOS:
      1. titulo (Chamada Curta): Uma frase de impacto que resume a promessa do produto (ex: "O segredo para noites de puro requinte").
      2. descricao_curta: Um parágrafo envolvente que destaca o principal diferencial.
      3. descricao_longa: Texto completo e estruturado. Comece com uma introdução sedutora. Liste os benefícios e diferenciais usando bullet points (•). Finalize com uma frase de fechamento que convide à ação/experiência.
      4. meta_title: Título otimizado para Google. Deve conter o nome do produto e um benefício (máx 60 caracteres).
      5. meta_description: Texto persuasivo para buscas no Google. Inclua uma chamada para ação e mencione "Entrega Discreta" (máx 155 caracteres).
      6. palavras_chave: 5 a 8 termos técnicos e de busca relacionados ao produto.

      IMPORTANTE: A resposta deve ser estritamente um objeto JSON válido.
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
      t: { c: p.stats?.clicks || 0, v: p.stats?.purchases || 0 } // Termômetros: cliques e vendas
    }));

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
        messages: [{ role: 'user', content: prompt }],
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
    } catch (error) {
      console.error('[AI][HUNT_ERROR]', error);
      return { rankedIds: [], mensagem: "Buscando o melhor para você...", curadoria: "Busca", caracteristicas: [] };
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

    const prompt = `
      Como Consultora Especialista da Discreta Boutique, seu objetivo é sugerir produtos que COMPLEMENTEM ou sejam EXCELENTES ALTERNATIVAS ao produto que o cliente está vendo agora.

      PRODUTO ATUAL:
      ${JSON.stringify(compactTarget)}

      CATÁLOGO DE CANDIDATOS (Dê preferência a itens que combinem com o estilo ou categoria do atual):
      ${JSON.stringify(candidates.slice(0, 50))}

      CRITÉRIOS DE SELEÇÃO:
      1. Afinidade Semântica: Se é um vibrador de coelho, sugira outros vibradores premium ou géis estimulantes.
      2. Cross-Selling: Sugira acessórios que melhorem a experiência (ex: lubrificantes para brinquedos).
      3. Upselling/Popularidade: Itens com bons "Termômetros" (vendas v e cliques c) têm prioridade se forem relevantes.
      4. Decida a quantidade ideal (entre 4 e 12 itens).

      RETORNE APENAS JSON:
      {
        "rankedIds": ["id1", "id2", "..."],
        "mensagem": "Uma frase elegante de convite (máx 80 caracteres) conectando o item atual com as sugestões"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        rankedIds: Array.isArray(parsed.rankedIds) ? parsed.rankedIds : [],
        mensagem: parsed.mensagem || "Você também pode gostar destas escolhas exclusivas:"
      };
    } catch (error) {
      console.error('[AI][SUGGEST_ERROR]', error);
      return { rankedIds: [], mensagem: "Descubra mais opções exclusivas:" };
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
    const cacheKey = `cart_suggest_v4_${productsStr}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um especialista sênior em Mix de Produtos e Cross-Sell para a Discreta Boutique.
      Analise os itens no carrinho e sugira uma categoria ou tipo de produto complementar que elevaria a experiência do cliente para o próximo nível.
      
      PRODUTOS NO CARRINHO: "${productsStr}"
      
      OBJETIVO:
      Sugerir algo que o usuário AINDA NÃO tem no carrinho e que faz todo sentido lógico e sensorial.
      Seja variado nas sugestões. Não sugira sempre o básico (lubrificante). Pense em massageadores, velas, acessórios de toque, etc.
      
      REGRAS DE RETORNO (json):
      {
        "foco_complemento": "Um único termo técnico para busca no catálogo (ex: massageador, óleo, aromatizante, acessório)",
        "caracteristicas": ["3 a 5 palavras-chave para refinar a busca no banco de dados"],
        "motivo": "Uma frase curta e elegante (máx 150 chars) explicando o benefício da combinação"
      }
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.8, // Aumentado para mais variedade nas sugestões
        max_tokens: 250
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
        return {
          foco_complemento: 'higiene',
          caracteristicas: ['limpeza', 'cuidado'],
          motivo: 'Essenciais para sua rotina de bem-estar.'
        };
      }

      // Cache mais curto para sugestões de carrinho (15 min em vez de 1 hora)
      this.cache.set(cacheKey, {
        data: result.data,
        expiry: Date.now() + (1000 * 60 * 15)
      });
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

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = this.getClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('[AI][EMBEDDING_ERROR]', error);
      return [];
    }
  }

  async enrichProduct(title: string, description: string): Promise<{keywords: string[], synonyms: string[], searchTerms: string[]}> {
    const prompt = `
      Você é um especialista em SEO e e-commerce sênior para uma boutique erótica premium (Discreta Boutique).
      Com base no título e descrição do produto abaixo, gere:
      1. keywords: Palavras-chave relevantes (termos técnicos e de nicho).
      2. synonyms: Sinônimos naturais (incluindo termos mais discretos e variações de linguagem).
      3. searchTerms: Termos de busca populares que usuários usariam para encontrar este produto.

      PRODUTO: "${title}"
      DESCRIÇÃO: "${description}"
      
      Retorne estritamente um objeto JSON.
    `;

    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Você é um assistente especializado em SEO para e-commerce erótico premium.' }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        keywords: this.normalizeArray(parsed.keywords),
        synonyms: this.normalizeArray(parsed.synonyms),
        searchTerms: this.normalizeArray(parsed.searchTerms)
      };
    } catch (error) {
      console.error('[AI][ENRICH_ERROR]', error);
      return { keywords: [], synonyms: [], searchTerms: [] };
    }
  }

  async generateCategoryContent(nome: string, retries = 2): Promise<z.infer<typeof CategoryContentSchema>> {
    const cacheKey = `category_${nome}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `
      Você é um copywriter sênior especialista em branding e SEO para e-commerce de luxo e boutiques eróticas premium como a Discreta Boutique.
      Sua missão é gerar o conteúdo estratégico e ENCANTADOR para a categoria de produtos "${nome}".

      DIRETRIZES DE ESTILO E QUALIDADE:
      - Tom de voz: Sofisticado, elegante, sensual (sem ser vulgar) e altamente persuasivo.
      - Foco: Despertar o desejo, elevar a autoestima e prometer experiências inesquecíveis.
      - Proibição: NUNCA use termos vulgares, explícitos, gírias de baixo calão ou descrições pornográficas.

      INSTRUÇÕES PARA OS CAMPOS:
      1. descricao: Uma introdução sedutora e curta (1-2 frases) que funciona como o "slogan" da categoria.
      2. conteudo_seo: Um texto LONGO, ELABORADO e ESTRUTURADO (mínimo 300 palavras). 
         - Inicie contextualizando o papel desses produtos no prazer e bem-estar.
         - Crie parágrafos envolventes que expliquem o que o cliente encontrará na coleção.
         - Utilize gatilhos mentais de exclusividade, elegância e segurança.
         - Finalize reforçando a qualidade e o sigilo absoluto na entrega.
      3. meta_title: Título perfeito para Google (máx 60 caracteres). Deve ser impactante.
      4. meta_description: Texto altamente persuasivo para cliques no Google (máx 155 caracteres), mencionando "Entrega 100% Discreta".
      5. palavras_chave: Forneça uma lista EXAUSTIVA de 15 a 20 termos relevantes (tags), incluindo variações de busca, nomes técnicos e termos conceituais.

      IMPORTANTE: A resposta deve ser estritamente um objeto JSON válido.
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
