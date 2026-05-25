import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

export class OpenAIImageService {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  private getClient(): OpenAI {
    if (!this.openai) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        throw new Error('OPENAI_API_KEY não configurada no servidor.');
      }
      this.openai = new OpenAI({ apiKey: key });
    }
    return this.openai;
  }

  /**
   * Describes a reference image to transfer its style, composition, product alignment, or mood
   */
  async describeReferenceImage(imageUrl: string): Promise<string> {
    const client = this.getClient();

    try {
      // If imageUrl is a local path or a base64 string, keep it as is.
      // If it is regular URL starting with http, load it.
      const messages: any[] = [
        {
          role: 'system',
          content: 'Você é um diretor de arte sênior especialista em composição de fotografia, iluminação, cores e ambientação luxuosa para maquiagem de alta costura, perfumes elegantes e cosméticos sofisticados.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Descreva detalhadamente a composição, os elementos, a paleta de cores, a estética e a iluminação desta imagem de referência para que possamos recriá-la com um novo produto cosmético da marca Discreta Boutique. Descreva a atmosfera premium e elegante.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 400
      });

      return completion.choices[0]?.message?.content || 'Composição minimalista moderna de produtos cosméticos.';
    } catch (error: any) {
      console.warn('⚠️ [OpenAIImageService] Falha ao analisar a imagem via modelo de visão (multimodal):', error.message);
      // Fallback description
      return 'Imagem de referência contendo exibição elegante de produtos cosméticos de grife com iluminação suave, foco seletivo e fundo neutro minimalista.';
    }
  }

  /**
   * Generates a new image based on reference description, theme, and branding context
   */
  async generateImage(theme: string, referenceDescription: string, index = 1, total = 1, brandKitPrompt?: string): Promise<string> {
    const client = this.getClient();

    let carouselFocusPrompt = '';
    if (total > 1) {
      switch (index) {
        case 1:
          carouselFocusPrompt = 'Esta é a imagem de CAPA. Ela deve ter um título implícito ou o produto em grande destaque para chamar atenção imediata. Ideal para capa de post do Instagram.';
          break;
        case 2:
          carouselFocusPrompt = 'Foco em BENEFÍCIOS. Mostre a textura do produto, gotas, ou aplicação suave para demonstrar a alta qualidade e fórmula rica.';
          break;
        case 3:
          carouselFocusPrompt = 'Foco em DETALHES DO PRODUTO. O frasco ou embalagem elegante posicionado de forma imponente sobre uma superfície espelhada ou de mármore.';
          break;
        case 4:
          carouselFocusPrompt = 'Foco em OFERTA/VALOR. Uma atmosfera festiva ou sofisticada que evoque desejo, com arranjos minimalistas elegantes.';
          break;
        case 5:
          carouselFocusPrompt = 'Foco em CTA / Chamada para Ação. Uma composição elegante com fundo sutil, excelente espaço para texto e um convite para interagir com a loja.';
          break;
        default:
          carouselFocusPrompt = 'Composição publicitária integrada com a marca.';
      }
    }

    const fullPrompt = `Composição publicitária de alta costura e luxo para mídias sociais (Instagram) da marca "Discreta Boutique".
Tema da campanha: "${theme}".
Estética e Ambientação: Baseado neste conceito de arte e iluminação de referência: ${referenceDescription}.
${carouselFocusPrompt}
${brandKitPrompt ? `DIRETRIZES DE MARCA DE IDENTIDADE VISUAL:\n${brandKitPrompt}\n` : ''}
Diretrizes Visuais Importantes:
- Estilo: Fotografia comercial profissional de estúdio de altíssima fidelidade, cosméticos de marca de luxo, embalagem fosca clássica, cores sóbrias (preto, dourado, bronze, cinza fosco, off-white, vermelho escuro).
- Qualidade: Iluminação volumétrica suave de estúdio, sombras realistas, nitidez ultra-fina de vidro/líquido.
- Coisas a evitar: NÃO inclua textos descritivos artificiais na imagem, fontes distorcidas ou logotipos feios. Foque inteiramente na arte visual, estética premium e sofisticação pura do cosmético.`;

    try {
      console.log(`[OpenAIImageService] Tentando gerar imagem ${index} usando dall-e-3...`);
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024' // Default standard Instagram size
      });

      return response.data[0]?.url || '';
    } catch (dalle3Error: any) {
      console.warn(`[OpenAIImageService] Falha ou indisponibilidade do modelo dall-e-3 na API da OpenAI, tentando dall-e-2 no index ${index}...`, dalle3Error.message || dalle3Error);
      
      try {
        const response = await client.images.generate({
          model: 'dall-e-2',
          prompt: fullPrompt,
          n: 1,
          size: '1024x1024'
        });
        return response.data[0]?.url || '';
      } catch (dalle2Error: any) {
        console.warn(`[OpenAIImageService] Falha no dall-e-2 no index ${index}, tentando Gemini (gemini-2.5-flash-image)...`, dalle2Error.message || dalle2Error);
        
        // Try Gemini Fallback
        if (process.env.GEMINI_API_KEY) {
          try {
            const ai = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });
            const geminiResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [
                  {
                    text: fullPrompt,
                  },
                ],
              },
              config: {
                imageConfig: {
                  aspectRatio: "1:1"
                }
              },
            });
            
            if (geminiResponse.candidates?.[0]?.content?.parts) {
              for (const part of geminiResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                  const base64EncodeString: string = part.inlineData.data;
                  return `data:image/png;base64,${base64EncodeString}`;
                }
              }
            }
          } catch (geminiError: any) {
            console.error(`[OpenAIImageService] Erro no fallback do Gemini no index ${index}:`, geminiError.message || geminiError);
          }
        }
        
        // Ultimate bulletproof placeholder fallback
        console.warn(`[OpenAIImageService] Todos os modelos de IA falharam no index ${index}. Usando picsum placeholder se semeado para resiliência total.`);
        return `https://picsum.photos/seed/${encodeURIComponent(theme + '_' + index)}/1024/1024`;
      }
    }
  }

  /**
   * Generates up to 5 images for carousel or a single image
   */
  async generateImagesForPost(
    theme: string, 
    imageUrl: string | undefined, 
    mode: 'unica' | 'carrossel',
    brandKitPrompt?: string
  ): Promise<string[]> {
    let referenceDesc = 'Foco em fotografia comercial premium de cosméticos com luzes de estúdio elegantes.';
    
    if (imageUrl) {
      try {
        referenceDesc = await this.describeReferenceImage(imageUrl);
      } catch (err) {
        console.warn('Erro ao ler imagem de referência:', err);
      }
    }

    const count = mode === 'carrossel' ? 5 : 1;
    const urls: string[] = [];

    // For better reliability, we can run them in a loop
    for (let i = 1; i <= count; i++) {
      console.log(`[AI Image] Gerando imagem ${i} de ${count}...`);
      const url = await this.generateImage(theme, referenceDesc, i, count, brandKitPrompt);
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }
}
