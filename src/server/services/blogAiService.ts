import { OpenAI } from "openai";
import { BlogContentBlock, BlogPost, FAQItem } from "../../services/blogService";

let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não está configurada no ambiente. Adicione em Configurações.");
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

export interface BlogGenerationParams {
  tema: string;
  palavraChavePrincipal: string;
  palavrasChaveSecundarias: string[];
  objetivo: string;
  publico: string;
  tomVoz: string;
  palavras: number;
  categoria: string;
  tags: string[];
  produtosSelecionados: string[]; // custom ids provided manually
  sugerirProdutos: boolean;
  faqRequested: boolean;
  ctaRequested: boolean;
  seoLocal: boolean;
  catalogProductsList?: { id: string; name: string; price: number }[]; // list of active products to match
}

export interface BlogGenerationResult {
  titulo: string;
  slug: string;
  subtitulo: string;
  resumo: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  palavrasChave: string[];
  categoriaSugerida: string;
  content: string; // Markdown text
  contentBlocks: BlogContentBlock[];
  faqs: FAQItem[];
  coverImage?: string;
  coverImageAlt?: string;
  relatedProducts: string[]; // names of related products
  suggestedProductIds?: string[]; // IDs of products from catalog to inject
  internalLinks: { text: string; url: string }[];
  relatedArticles: string[];
}

export const blogAiService = {
  async generateBlogPost(params: BlogGenerationParams): Promise<BlogGenerationResult> {
    const openai = getOpenAIClient();

    // Map catalog products for prompt reference
    const catalogSnippet = params.catalogProductsList && params.catalogProductsList.length > 0
      ? params.catalogProductsList.map(p => `- ID: "${p.id}", Nome: "${p.name}", Preço: R$${p.price.toFixed(2)}`).join("\n")
      : "Nenhum produto em estoque público disponível para seleção.";

    // Local SEO Guidance
    const localSeoInstructions = params.seoLocal
      ? `Use naturalmente, sem exageros ou keyword stuffing, as seguintes referências de SEO Local à cidade de Icó-CE:
        - "Discreta Boutique"
        - "Icó-CE"
        - "Boutique íntima em Icó"
        - "Sex shop em Icó"
        - "Entrega discreta em Icó"
        - "Loja física e online"`
      : "Evite referências locais específicas se não forem solicitadas.";

    const systemPrompt = `Você é o redator sênior chefe de SEO e especialista em Copywriting Erotológico e Moda Íntima da "Discreta Boutique" de luxo em Icó-CE.
Sua escrita deve ser altamente elegante, feminina, discreta, humanizada, sofisticada, romântica e educativa. 
Evite terminologias explícitas vulgares, spam, promessas exageradas e repetições em excesso (keyword stuffing). Escreva com carinho, empoderamento e classe.`;

    const userPrompt = `Gere um artigo de blog totalmente otimizado para SEO com base nos seguintes parâmetros:

DADOS DE ENTRADA:
- Tema do Artigo: "${params.tema}"
- Palavra-chave principal: "${params.palavraChavePrincipal}"
- Palavras-chave secundárias: ${params.palavrasChaveSecundarias.join(", ") || "nenhuma"}
- Objetivo: "${params.objetivo}"
- Público-alvo: "${params.publico}"
- Tom de Voz: "${params.tomVoz}"
- Quantidade estimada de palavras: ~${params.palavras} palavras
- Categoria sugerida: "${params.categoria}"
- Tags sugeridas pelo usuário: ${params.tags.join(", ") || "nenhuma"}
- Produtos Selecionados Manualmente: ${params.produtosSelecionados.join(", ") || "nenhum"}
- Incluir FAQ interativo? ${params.faqRequested ? "Sim" : "Não"}
- Incluir Chamadas para Ação (CTA)? ${params.ctaRequested ? "Sim" : "Não"}
- SEO Local Ativado? ${params.seoLocal ? "Sim" : "Não"}

CATÁLOGO DE PRODUTOS ATIVOS DISPONÍVEIS:
${catalogSnippet}

DIRETRIZES DO FORMATO:
Você deve retornar OBRIGATORIAMENTE um objeto JSON válido contendo os seguintes campos:
1. "titulo": Título principal do artigo otimizado para cliques e SEO (~50-65 caracteres).
2. "slug": Slug legível e amigável em kebab-case, derivado do título.
3. "subtitulo": Uma frase cativante e de apoio ao título (~80-120 caracteres).
4. "resumo": Pequeno resumo para listagem do blog (~120-160 caracteres).
5. "metaTitle": Meta title otimizado para SEO (máximo 60 caracteres).
6. "metaDescription": Meta description ideal (máximo 152 caracteres).
7. "tags": Array de 4 a 8 tags em texto.
8. "palavrasChave": Array de strings com palavras-chave identificadas e utilizadas.
9. "categoriaSugerida": Nome da categoria.
10. "content": Versão em texto puro Markdown do post inteiro, com cabeçalhos H2 e H3 (use "##" e "###").
11. "contentBlocks": Array de blocos de conteúdo compatíveis com a estrutura descrita abaixo.
12. "faqs": Se requisitado, array de objetos com "question" e "answer". Caso contrário, array vazio.
13. "coverImage": URL de sugestão de imagem (use "https://images.unsplash.com/photo-1515688594390-b649af70d282?q=80&w=1200" como imagem de destaque padrão sofisticada).
14. "coverImageAlt": Descrição alt otimizada da imagem de capa.
15. "relatedProducts": Array de nomes de produtos listados acima que combinam com o post.
16. "suggestedProductIds": Se produtos acima foram combinados ou indicados, coloque os IDs reais de string desses produtos que combinam com o tema de forma inteligente.
17. "internalLinks": Array de links sugeridos de formato { "text": string, "url": string } (ex: "/catalogo", "/entrega-discreta" ou categorias/produtos reais).
18. "relatedArticles": Array de 2 a 3 títulos de artigos relacionados sugeridos.

${localSeoInstructions}

DIRETRIZES SOBRE "contentBlocks":
Divida o artigo de forma rica em blocos ordenados para renderização moderna e de alta qualidade:
Cada bloco no array "contentBlocks" DEVE ter o seguinte formato de objeto:
- "id": string única randômica (ex: "block_1", "block_2" etc.)
- "type": define o tipo do bloco. Escolha entre estes valores válidos:
  * "paragraph": para parágrafos de texto normais. O conteúdo principal fica no campo "content" (pode incluir marcação markdown básica como negrito e links).
  * "heading": para títulos de seção. Use o campo "content" para o texto e "level" (2, 3 ou 4) para a hierarquia.
  * "quote": para depoimentos ou citações inspiradoras. Use o campo "content" para a frase e "alt" para o autor.
  * "callout": caixa de destaque. Use "content" para o texto e "style" ("tip" para dicas, "warning" para avisos ou "info" para informações neutras).
  * "divider": linha divisora horizontal simples.
  * "faq": para pergunta frequente interativa. Use "question" e "answer".
  * "cta": botão de chamada para ação. Use "content" para o texto do botão, "url" para o link e "style" ("primary", "whatsapp" ou "outline").
  * "product_grid": grade de produtos do catálogo recomendados. Use "productIds" com a lista de IDs reais informados no catálogo de ativos que mais fazem sentido. No máximo 4 IDs de produtos por grid.
  * "conclusion": bloco final de considerações. Use "content" para o texto de consideração final.

Exemplo de estrutura ordenada de blocos esperada em "contentBlocks":
[
  { "id": "b1", "type": "paragraph", "content": "Seu primeiro parágrafo envolvente..." },
  { "id": "b2", "type": "heading", "level": 2, "content": "Seu primeiro subtítulo H2 importante" },
  { "id": "b3", "type": "paragraph", "content": "Outro parágrafo explicativo..." },
  { "id": "b4", "type": "callout", "style": "tip", "content": "Dica elegante para o leitor..." },
  { "id": "b5", "type": "product_grid", "productIds": ["ID_REAL_PRESTADO_AQUI"] },
  { "id": "b6", "type": "quote", "content": "Uma frase romântica ou erótica delicada", "alt": "Especialista em bem-estar" },
  { "id": "b7", "type": "faq", "question": "Dúvida comum?", "answer": "Resposta otimizada..." },
  { "id": "b8", "type": "conclusion", "content": "Suas considerações finais" },
  { "id": "b9", "type": "cta", "content": "Fale com uma consultora", "url": "https://wa.me/5588992340317", "style": "whatsapp" }
]

Retorne EXCLUSIVAMENTE o objeto JSON descrito acima. Não inclua conversas, introdução ou formatações de blocos de código além do próprio JSON.`;

    const modelToUse = process.env.OPENAI_MODEL || "gpt-4o-mini";

    try {
      console.log(`[OpenAI Generation] Requesting blog generate with model: ${modelToUse} for theme: "${params.tema}"`);
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3500
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("Resposta da OpenAI vazia.");
      }

      const rawResult = JSON.parse(responseText);

      // Add unique IDs to suggested blocks where missing
      if (rawResult.contentBlocks && Array.isArray(rawResult.contentBlocks)) {
        rawResult.contentBlocks = rawResult.contentBlocks.map((block: any, idx: number) => ({
          ...block,
          id: block.id || `ai_block_${Date.now()}_${idx}_${Math.random().toString(36).substring(4, 9)}`
        }));
      }

      // Compute estimated tokens if API does not return it cleanly
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || (promptTokens + completionTokens);

      return {
        ...rawResult,
        tokensEstimated: totalTokens
      };

    } catch (e: any) {
      console.error("[OpenAI Generation] Failed to complete OpenAI call:", e);
      throw e;
    }
  },

  async generateSEOClusterSuggestions(params: { tema: string; catalogProductsList?: { id: string; name: string; price: number }[] }) {
    const openai = getOpenAIClient();
    const modelToUse = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const catalogSnippet = params.catalogProductsList && params.catalogProductsList.length > 0
      ? params.catalogProductsList.map(p => `- ID: "${p.id}", Nome: "${p.name}", Preço: R$${p.price.toFixed(2)}`).join("\n")
      : "Nenhum produto em estoque cadastrado.";

    const systemPrompt = `Você é um robô perito em SEO Avançado e Marketing de Atração Temática. 
Sua missão é projetar um ecossistema inteligente de conteúdos chamado "SEO Cluster" (Topic Cluster) para a Discreta Boutique (luxury sex shop e lingerie íntima de Icó-CE).`;

    const userPrompt = `Gere uma estratégia completa de Cluster SEO para o tema ou nicho: "${params.tema}".
Deveremos ter 1 Artigo Pilar (Pillar Content) e de 3 a 5 Artigos Secundários (Cluster Content) que orbitam o pilar, respondem a intenções específicas e referenciam produtos estratégicos do nosso catálogo.

CATÁLOGO DE PRODUTOS DISPONÍVEIS:
${catalogSnippet}

Você deve estruturar uma sugestão robusta e retornar EXCLUSIVAMENTE um objeto JSON com o formato: {
  "title": "Título estratégico do Cluster SEO (ex: Guia Definitivo da Lingerie de Renda)",
  "slug": "slug-do-cluster-seo",
  "description": "Meta description planejada para a Landing Page do Cluster",
  "mainKeyword": "Palavra-chave principal do cluster",
  "secondaryKeywords": ["palavra-chave 1", "palavra-chave 2"],
  "pillarSuggestion": {
    "title": "Título sugerido para o Artigo Pilar",
    "summary": "Resumo de 2 linhas do que abordar neste artigo principal",
    "slug": "slug-do-artigo-pilar"
  },
  "clusterSuggestions": [
    {
      "title": "Título sugerido para Artigo Secundário 1",
      "summary": "Resumo leve do tema específico",
      "slug": "slug-do-artigo-secundario-1"
    },
    ...
  ],
  "suggestedProducts": ["id_produto_1", "id_produto_2"]
}

Retorne estritamente o objeto JSON plano. Sem textos extras, comentários ou tags de blocos de código além do próprio JSON bruto.`;

    try {
      console.log(`[OpenAI Cluster suggestion] Generating suggestions for theme: "${params.tema}"`);
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error("Resposta da OpenAI vazia.");
      }

      return JSON.parse(text);
    } catch (e: any) {
      console.error("[OpenAI Cluster suggestions Exception]:", e);
      throw e;
    }
  }
};
