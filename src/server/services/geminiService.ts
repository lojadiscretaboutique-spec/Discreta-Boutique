import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. Please configure it in Settings.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_BUILD_ONLY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

export interface GeneratorParams {
  tema: string;
  objetivo: string;
  publico: string;
  tomVoz: string;
  palavras: number;
  categoria: string;
  palavrasChave: string[];
}

export interface GeneratedPost {
  titulo: string;
  subtitulo: string;
  resumo: string;
  conteudo: string; // Markdown
  faqs: { question: string; answer: string; }[];
  metaTitle: string;
  metaDescription: string;
  slug: string;
  tags: string[];
  linksInternos: { anchor: string; url: string; }[];
  produtosRelacionados: string[];
}

export const geminiService = {
  async generateBlogPost(params: GeneratorParams): Promise<GeneratedPost> {
    const ai = getGeminiClient();

    const prompt = `
      Você é a inteligência artificial especialista em SEO Copywriting e Marketing de Conteúdo da "Discreta Boutique".
      Sua missão é gerar um artigo extraordinário de blog otimizado para SEO que crie autoridade, engajamento e conversões.

      DADOS DE ENTRADA:
      - Tema: "${params.tema}"
      - Objetivo: "${params.objetivo}"
      - Público-alvo: "${params.publico}"
      - Tom de voz: "${params.tomVoz}"
      - Quantidade estimada de palavras: ${params.palavras} palavras.
      - Categoria: "${params.categoria}"
      - Palavras-chave principais: ${params.palavrasChave.join(', ')}

      DIRETRIZES DE CONTEÚDO E SEO:
      1. Sedução & Elegância: Utilize termos luxuosos, empoderados, sensuais mas sem vulgaridade.
      2. SEO Local Icó-CE: Insira de forma fluída e natural a cidade de Icó-CE, a entrega discreta, sex shop em Icó, a Discreta Boutique, boutique íntima e loja física e online. Sem exagero.
      3. Link Building Inteligente: Sugira 2-3 links internos e ancoragens para páginas da Discreta Boutique (ex: para /catalogo, /entrega-discreta, /categoria/lingeries ou o produto em si).
      4. Estrutura do Artigo: Crie títulos claros (H2, H3), introdução arrebatadora, capítulos estruturados e uma conclusão com "Call to action" forte direcionando para a compra de produtos relacionados.
      5. FAQs: Escreva de 2 a 4 perguntas e respostas frequentes que respondam a dúvidas reais dos usuários no Google.
      6. Metadados Extraordinários: Meta title (máximo 60 caracteres) e Meta description (máximo 155 caracteres) focados em cliques e taxa de conversão (CTR).
      7. Slug amigável: slug em formato kebab-case (exclusivo com letras minúsculas, números e traços).

      Gere a resposta exatamente de acordo com o JSON Schema especificado.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é o redator chefe de SEO e especialista erótico da boutique Discreta Boutique.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo: { type: Type.STRING, description: "Título chamativo e otimizado" },
              subtitulo: { type: Type.STRING, description: "Subtítulo engajador" },
              resumo: { type: Type.STRING, description: "Resumo do post para listagem" },
              conteudo: { type: Type.STRING, description: "Conteúdo completo com marcações H2, H3 e parágrafos em markdown brasileiro" },
              faqs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING }
                  },
                  required: ["question", "answer"]
                }
              },
              metaTitle: { type: Type.STRING, description: "Meta title exclusivo de até 60 chars" },
              metaDescription: { type: Type.STRING, description: "Meta description excelente de até 155 chars" },
              slug: { type: Type.STRING, description: "Slug amigável e único da postagem em kebab-case" },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Palavras-chave e tags adicionais de SEO"
              },
              linksInternos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    anchor: { type: Type.STRING, description: "Texto âncora do link" },
                    url: { type: Type.STRING, description: "URL interna sugerida" }
                  },
                  required: ["anchor", "url"]
                }
              },
              produtosRelacionados: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Nomes de produtos ou categorias sugeridos para linkar no blog"
              }
            },
            required: [
              "titulo",
              "subtitulo",
              "resumo",
              "conteudo",
              "faqs",
              "metaTitle",
              "metaDescription",
              "slug",
              "tags",
              "linksInternos",
              "produtosRelacionados"
            ]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }
      return JSON.parse(text) as GeneratedPost;
    } catch (e: any) {
      console.error("Gemini Content Generation Error:", e);
      throw e;
    }
  }
};
