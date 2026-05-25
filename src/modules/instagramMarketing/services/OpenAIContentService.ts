import OpenAI from 'openai';
import { InstagramSuggestion, StoriesSequence, ReelsStructure } from '../types/index.js';

export class OpenAIContentService {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      console.warn('⚠️ [OpenAIContentService] OPENAI_API_KEY não configurada nas variáveis de ambiente.');
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
   * Generates general ideas for posts.
   */
  async generateIdeas(context: string, sectionType: 'feed' | 'story' | 'reels', brandKitPrompt?: string, quantity: number = 10): Promise<InstagramSuggestion[]> {
    const client = this.getClient();
    
    const storeContext = `
      Empresa: Discreta Boutique
      Segmento: Cosméticos, Perfumes, Maquiagem, Skincare, Beleza
      Nicho: Produtos sensuais, bem-estar íntimo, perfumaria premium, maquiagem sofisticada e cuidados pessoais de alto padrão.
      Identidade de Marca: Minimalista, sutil, discreta, elegante, sedutora e empoderadora.
    `;

    const systemPrompt = `Você é um especialista sênior em marketing digital de engajamento para marcas premium.
Sua tarefa é planejar estratégias semanais de conteúdo para o Instagram no formato: ${sectionType.toUpperCase()}.
Gere exatamente ${quantity} ideias de conteúdo que sejam fascinantes, refinadas e com alta taxa de interação.
Retorne APENAS um array JSON válido contendo exatamente o seguinte formato sem blocos de código markdown ou texto explicativo extra:
[
  {
    "titulo": "Título curto e atrativo",
    "descricao": "Resumo ou descrição detalhada do que abordar, tom de voz, chamadas e conteúdo textual sugerido.",
    "hashtags": ["discretaboutique", "beleza", "cosmeticos"]
  }
]`;

    const userPrompt = `Baseado no seguinte contexto da empresa e identidade visual de marca / Brand Kit:
${brandKitPrompt || storeContext}

E no desejo do usuário para esta semana:
"${context}"

Gere ${quantity} sugestões estruturadas para o formato ${sectionType}.`;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      const parsed = JSON.parse(responseText);
      
      // Handle response that might be wrapped in an object
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.ideas && Array.isArray(parsed.ideas)) {
        return parsed.ideas;
      } else if (parsed.sugestoes && Array.isArray(parsed.sugestoes)) {
        return parsed.sugestoes;
      } else {
        const keys = Object.keys(parsed);
        if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
          return parsed[keys[0]];
        }
      }
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: any) {
      console.error('Erro ao gerar ideias de conteúdo:', error);
      throw new Error(`Falha ao gerar ideias: ${error.message}`);
    }
  }

  /**
   * Generates story sequence of up to 5 slides
   */
  async generateStorySequence(title: string, description: string, brandKitPrompt?: string): Promise<StoriesSequence> {
    const client = this.getClient();

    const systemPrompt = `Você é um redator de mídias de alto engajamento. Crie uma sequência estratégica de até 5 STORIES para o Instagram baseado no tema e detalhes informados.
Mantenha um tom persuasivo, interativo e elegante.
Estruture a sequência contendo as 5 telas sugeridas:
Tela 1: Chamada/Gancho irresistível (Curiosidade, pergunta instigante)
Tela 2: Apresentação do Problema/Necessidade íntima ou estética
Tela 3: Apresentação do Produto/Solução da Discreta Boutique
Tela 4: Benefícios exclusivos e diferenciações do produto
Tela 5: CTA (Call to Action) claro e persuasivo (ex: 'Envie um Direct', 'Clique no Link da Bio')

Retorne exclusivamente um objeto JSON sem formatação de markdown contendo a seguinte estrutura:
{
  "telas": [
    { "tipo": "string (ex: chamada, problema, solucao, beneficios, cta)", "fala": "A sugestão do que falar nos stories com voz natural", "texto_tela": "Legenda ou Caixa de texto curta para colocar na tela do Story" }
  ]
}`;

    const brandKitSection = brandKitPrompt ? `\n\nDiretrizes de Marca (Brand Kit):\n${brandKitPrompt}` : '';

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt + brandKitSection },
          { role: 'user', content: `Tema: "${title}". Detalhes adicionais: "${description}"` }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{}') as StoriesSequence;
    } catch (error: any) {
      console.error('Erro ao gerar sequência de Stories:', error);
      throw new Error(`Falha na criação da sequência de Stories: ${error.message}`);
    }
  }

  /**
   * Generates Reels structure
   */
  async generateReelsScript(title: string, description: string, brandKitPrompt?: string): Promise<ReelsStructure> {
    const client = this.getClient();

    const systemPrompt = `Você é um estrategista de conteúdo de vídeo curto (Reels, TikTok) especializado em mídias de alta conversão.
Crie um roteiro completo de Reels (15 a 60 segundos) contendo Gancho, Desenvolvimento, Roteiro Visual, Texto de Apoio na Tela e a Legenda do Post com hashtags.

Retorne exclusivamente um objeto JSON sem blocos de markdown e com a seguinte estrutura de propriedades:
{
  "tema": "Tema geral do vídeo",
  "roteiro": "Descreva o roteiro visual passo a passo (o que filmar ou mostrar)",
  "falas": "Texto exato das falas recomendadas ou narração em áudio",
  "descricao": "A legenda de texto perfeita para postar junto com o vídeo",
  "hashtags": ["discretaboutique", "reels", "autoestima"],
  "sugestao_audio": "Estilo de música ou áudio em tendência recomendado (ex: Luxo instrumental, sax sensual, pop calmo)"
}`;

    const brandKitSection = brandKitPrompt ? `\n\nDiretrizes de Marca (Brand Kit):\n${brandKitPrompt}` : '';

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt + brandKitSection },
          { role: 'user', content: `Tema: "${title}". Detalhes: "${description}"` }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{}') as ReelsStructure;
    } catch (error: any) {
      console.error('Erro ao gerar roteiro de Reels:', error);
      throw new Error(`Falha no roteiro de Reels: ${error.message}`);
    }
  }
}
