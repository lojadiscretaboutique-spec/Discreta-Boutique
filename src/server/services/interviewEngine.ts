import OpenAI from 'openai';
import { db } from '../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface StageConfig {
  id: string; // IDENTIFICACAO, DISPONIBILIDADE, EXPERIENCIA, PERFIL, FINAL, COMPLETED
  objective: string;
  fields: {
    key: string;
    label: string;
    description: string;
  }[];
}

export interface InterviewTemplate {
  jobType: string;
  prompt: string;
  stages: StageConfig[];
}

export interface InterviewState {
  interviewId: string;
  currentStage: string;
  completedStages: string[];
  pendingFields: string[];
  structuredData: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Default Template for Discreta Boutique's recruitment process
export const DEFAULT_TEMPLATE: InterviewTemplate = {
  jobType: 'Default',
  prompt: 'Você é a recrutadora virtual Aurora da Discreta Boutique.',
  stages: [
    {
      id: 'IDENTIFICACAO',
      objective: 'Conhecer o candidato e obter seus dados básicos de identificação e contato.',
      fields: [
        { key: 'nomeCompleto', label: 'Nome completo', description: 'Nome completo do candidato' },
        { key: 'idade', label: 'Idade', description: 'Idade do candidato' },
        { key: 'cidade', label: 'Cidade', description: 'Cidade onde o candidato reside' },
        { key: 'bairro', label: 'Bairro', description: 'Bairro onde o candidato reside' },
        { key: 'whatsapp', label: 'WhatsApp', description: 'Número de telefone ou WhatsApp' },
        { key: 'email', label: 'E-mail', description: 'Endereço de e-mail do candidato' }
      ]
    },
    {
      id: 'DISPONIBILIDADE',
      objective: 'Entender a disponibilidade de horários, sábados, eventos e o tipo de vaga de interesse do candidato.',
      fields: [
        { key: 'disponibilidadeHorario', label: 'Disponibilidade de Horários', description: 'Horários disponíveis para trabalhar' },
        { key: 'disponibilidadeSabados', label: 'Disponibilidade aos Sábados', description: 'Disponibilidade de trabalhar aos sábados' },
        { key: 'disponibilidadeEventos', label: 'Disponibilidade para Datas Especiais e Eventos', description: 'Disponibilidade para trabalhar em datas especiais, eventos ou campanhas' },
        { key: 'quandoComecar', label: 'Quando pode iniciar', description: 'Previsão de data ou prazo para iniciar no trabalho' },
        { key: 'tipoInteresse', label: 'Tipo da vaga', description: 'Tipo de interesse (ex: Fixo, Temporário, Freelancer)' }
      ]
    },
    {
      id: 'EXPERIENCIA',
      objective: 'Conhecer a trajetória profissional do candidato, focando em atendimento, vendas, rotinas de loja e saída do último emprego.',
      fields: [
        { key: 'experienciaAtendimento', label: 'Experiência em Atendimento', description: 'Experiência prévia com atendimento ao cliente' },
        { key: 'experienciaVendas', label: 'Experiência em Vendas', description: 'Experiência com vendas de produtos' },
        { key: 'experienciaLoja', label: 'Experiência em Loja (Caixa/Estoque)', description: 'Experiência com rotinas de loja, caixa, estoque ou organização' },
        { key: 'experienciaWhatsComercial', label: 'Experiência com WhatsApp Business', description: 'Experiência em atendimento comercial via WhatsApp' },
        { key: 'ultimaExperiencia', label: 'Última empresa, cargo e tempo', description: 'Informações da última experiência (empresa, cargo ocupado e tempo trabalhado)' },
        { key: 'motivoSaida', label: 'Motivo da saída', description: 'Motivo do desligamento da última empresa' }
      ]
    },
    {
      id: 'PERFIL',
      objective: 'Avaliar características comportamentais, discrição, desenvoltura com redes sociais e vendas de produtos íntimos.',
      fields: [
        { key: 'confortoProdutosIntimos', label: 'Organização, responsabilidade e conforto com produtos íntimos', description: 'Se possui conforto, organização e responsabilidade ao trabalhar com produtos íntimos e de sex shop' },
        { key: 'entendimentoDiscricao', label: 'Entendimento sobre discrição e sigilo', description: 'Seu entendimento sobre a importância de discrição e sigilo absoluto no atendimento' },
        { key: 'comoLidariaClienteIndeciso', label: 'Como lidaria com cliente indeciso', description: 'Situação de como lidaria com um cliente indeciso ou tímido' },
        { key: 'comoLidariaPerguntasIntimas', label: 'Como lidaria com perguntas íntimas', description: 'Como reagiria a perguntas pessoais ou íntimas dos clientes' },
        { key: 'facilidadeInstagram', label: 'Desenvoltura no Instagram, stories, vídeos e live shop', description: 'Facilidade para produzir conteúdo no Instagram, stories, vídeos ou participar de live shops' }
      ]
    },
    {
      id: 'FINAL',
      objective: 'Coletar os pontos fortes, pontos a desenvolver, expectativa salarial e mensagem de fechamento do candidato.',
      fields: [
        { key: 'pontoForte', label: 'Ponto forte', description: 'Seu principal ponto forte ou diferencial' },
        { key: 'pontoMelhorar', label: 'Ponto a desenvolver', description: 'Uma característica que deseja melhorar ou desenvolver' },
        { key: 'expectativaSalarial', label: 'Expectativa salarial', description: 'Expectativa de remuneração ou salário' },
        { key: 'mensagemFinal', label: 'Mensagem final', description: 'Mensagem final do candidato direcionada à empresa' }
      ]
    }
  ]
};

class InterviewEngineClass {
  private openai: OpenAI | null = null;
  private templates: Record<string, InterviewTemplate> = {
    'Default': DEFAULT_TEMPLATE
  };

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('Configuração Ausente: A chave OPENAI_API_KEY não foi configurada no servidor.');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this.openai;
  }

  // Gets or initializes the InterviewState in Firestore
  async getInterviewState(interviewId: string): Promise<InterviewState> {
    const docRef = doc(db, 'interviewStates', interviewId);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          interviewId,
          currentStage: data.currentStage || 'IDENTIFICACAO',
          completedStages: data.completedStages || [],
          pendingFields: data.pendingFields || [],
          structuredData: data.structuredData || {},
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('[INTERVIEW_ENGINE] Could not fetch state from Firestore, starting fresh.', error);
    }

    // Default initialization
    const initialFields = DEFAULT_TEMPLATE.stages[0].fields.map(f => f.key);
    return {
      interviewId,
      currentStage: 'IDENTIFICACAO',
      completedStages: [],
      pendingFields: initialFields,
      structuredData: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Saves the InterviewState back to Firestore
  async saveInterviewState(interviewId: string, state: InterviewState): Promise<void> {
    const docRef = doc(db, 'interviewStates', interviewId);
    try {
      await setDoc(docRef, {
        ...state,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('[INTERVIEW_ENGINE] Failed to save InterviewState to Firestore:', error);
    }
  }

  // Dynamic template loader / helper
  getTemplate(jobType: string = 'Default'): InterviewTemplate {
    return this.templates[jobType] || DEFAULT_TEMPLATE;
  }

  // Processes the incoming chat message, updates structuredData, advances stages and returns Aurora's response
  async processChatMessage(
    interviewId: string,
    messages: any[],
    userMessage: string,
    recruiterSettings: any
  ): Promise<{ responseText: string; state: InterviewState }> {
    const state = await this.getInterviewState(interviewId);
    const template = this.getTemplate();
    const openai = this.getOpenAI();

    // Find current stage config
    let currentStageIndex = template.stages.findIndex(s => s.id === state.currentStage);
    if (currentStageIndex === -1) {
      currentStageIndex = 0;
      state.currentStage = template.stages[0].id;
    }

    let currentStageConfig = template.stages[currentStageIndex];

    // 1. UPDATE STRUCTURED FIELDS INCREMENTALLY
    // Call OpenAI to extract any fields related to the current stage from the user's latest response
    try {
      const fieldDescriptions = currentStageConfig.fields
        .map(f => `- ${f.key}: ${f.label} (${f.description})`)
        .join('\n');

      const extractionPrompt = `Você é o extrator de dados de recrutamento da Discreta Boutique.
Sua missão é analisar a última mensagem enviada pelo candidato e atualizar de forma precisa o JSON de dados coletados.

CAMPOS DA ETAPA ATUAL (${state.currentStage}):
${fieldDescriptions}

DADOS ESTRUTURADOS ATUAIS (JSON):
${JSON.stringify(state.structuredData, null, 2)}

ÚLTIMAS MENSAGENS:
Candidato: "${userMessage}"

INSTRUÇÕES CRÍTICAS DE EXTRAÇÃO:
- Extraia qualquer dado da resposta do candidato que corresponda aos campos listados acima.
- SE o candidato disser que não possui experiência ou que uma pergunta não se aplica (ex: "nunca trabalhei", "não tenho experiência com isso"), preencha o campo correspondente com "Não possui", "N/A" ou equivalente curto. Isso é fundamental para evitar que a entrevistadora continue insistindo na mesma pergunta de experiência que o candidato já declarou não possuir!
- Nunca apague ou modifique informações já existentes, a menos que o candidato as tenha corrigido nesta última mensagem.
- Se o candidato mencionar informações de outras etapas (ex: disse o nome e também já falou que trabalha em vendas), você pode extrair e preencher opcionalmente.
- Retorne obrigatoriamente um objeto JSON com o formato exato abaixo:
{
  "structuredData": { ... }
}`;

      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um analisador e extrator de dados de recrutamento extremamente conciso. Retorne estritamente um objeto JSON.' },
          { role: 'user', content: extractionPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const extractionResult = JSON.parse(extractionResponse.choices[0].message.content || '{}');
      if (extractionResult.structuredData) {
        state.structuredData = {
          ...state.structuredData,
          ...extractionResult.structuredData
        };
      }
    } catch (error) {
      console.error('[INTERVIEW_ENGINE] Incremental extraction failed:', error);
    }

    // 2. STAGE PROGRESSION & PENDING FIELDS CALCULATION
    const checkStageCompletion = (stageId: string, structData: Record<string, string>): { isCompleted: boolean; pending: string[] } => {
      const stage = template.stages.find(s => s.id === stageId);
      if (!stage) return { isCompleted: true, pending: [] };

      const pending = stage.fields
        .filter(f => !structData[f.key] || structData[f.key].toString().trim() === '')
        .map(f => f.key);

      return {
        isCompleted: pending.length === 0,
        pending
      };
    };

    let { isCompleted, pending } = checkStageCompletion(state.currentStage, state.structuredData);
    state.pendingFields = pending;

    // Advance stages programmatically if current stage is completed
    while (isCompleted && currentStageIndex < template.stages.length - 1) {
      // Complete current stage
      if (!state.completedStages.includes(state.currentStage)) {
        state.completedStages.push(state.currentStage);
      }
      // Advance
      currentStageIndex++;
      state.currentStage = template.stages[currentStageIndex].id;
      currentStageConfig = template.stages[currentStageIndex];

      // Recalculate pending for new stage
      const checkNew = checkStageCompletion(state.currentStage, state.structuredData);
      isCompleted = checkNew.isCompleted;
      state.pendingFields = checkNew.pending;
    }

    // If we have completed the final stage, transition to COMPLETED
    if (currentStageIndex === template.stages.length - 1 && state.pendingFields.length === 0) {
      if (!state.completedStages.includes(state.currentStage)) {
        state.completedStages.push(state.currentStage);
      }
      state.currentStage = 'COMPLETED';
    }

    // 3. CONSTRUCT MINI-CONTEXT AND GENERATE RESPONSE
    // Get objectives and pending details
    const currentObjective = state.currentStage === 'COMPLETED' 
      ? 'Agradecer e finalizar o processo com o candidato.'
      : currentStageConfig.objective;

    const pendingDetails = state.currentStage === 'COMPLETED'
      ? []
      : currentStageConfig.fields
          .filter(f => state.pendingFields.includes(f.key))
          .map(f => `${f.label} (${f.description})`);

    // Only send the last 3 messages from actual history to save tokens
    const lastThreeMessages = messages.slice(-3).map(m => ({
      role: m.sender === 'bot' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.text
    }));

    // If history is empty, add the last user message
    if (lastThreeMessages.length === 0 && userMessage) {
      lastThreeMessages.push({ role: 'user', content: userMessage });
    }

    const availableJobsText = recruiterSettings.availableJobsText || '';
    const hasJobs = availableJobsText.trim() !== '';

    const systemPrompt = `Você é a ${recruiterSettings.recruiterName || 'Aurora'}, recrutadora virtual oficial e amigável da Discreta Boutique.
O candidato está conversando com você para uma vaga de emprego, e ele NÃO deve perceber em hipótese alguma que existe um sistema dividido em etapas ou preenchimento de formulário por trás. A conversa deve fluir como se fosse com uma humana, de forma empática, profissional, acolhedora e discreta.

DIRETRIZES DO PROMPT PRINCIPAL:
${recruiterSettings.promptPrincipal}

VAGAS DISPONÍVEIS E REGRAS DE VAGAS:
${hasJobs ? `O conteúdo abaixo descreve as vagas reais disponíveis no momento:
---
${availableJobsText}
---
` : `[NÃO HÁ VAGAS CADASTRADAS NO MOMENTO]`}

REGRAS CRÍTICAS DE CONTRATAÇÃO E INFORMAÇÕES DE VAGAS:
1. Você só poderá falar sobre as vagas de emprego descritas acima.
2. Se o candidato perguntar "qual vaga?", "tem quais vagas?", "quero mais opções", "quais as vagas disponíveis" ou qualquer pergunta similar sobre vagas abertas, você DEVE responder estritamente baseando-se no conteúdo das "Vagas disponíveis" acima.
3. Se não houver vagas cadastradas (ou seja, se estiver marcado como [NÃO HÁ VAGAS CADASTRADAS NO MOMENTO]), você DEVE responder obrigatoriamente e exatamente com a seguinte frase:
   “No momento, não possuo vagas cadastradas para apresentar. Posso continuar sua candidatura para análise futura pela equipe da Discreta Boutique.”
4. Você JAMAIS deve inventar ou criar cargos, quantidades, salários, benefícios, horários ou requisitos que não estejam explicitamente escritos nas "Vagas disponíveis" acima. Se o candidato perguntar sobre detalhes não listados (ex: salário de uma vaga cujo salário diz "Não informado nesta etapa"), responda que não está informado ou que será tratado nas próximas etapas do processo presencial.

CONTEXTO ATUAL DA ENTREVISTA:
- Etapa atual: ${state.currentStage}
- Objetivo da Etapa: ${currentObjective}
- Campos pendentes para coletar nesta etapa: ${JSON.stringify(pendingDetails)}
- Dados já coletados (use-os para demonstrar empatia e evitar repetições):
${JSON.stringify(state.structuredData, null, 2)}

INSTRUÇÕES DO MOTOR INTELIGENTE:
1. Continue a conversa com base nas últimas mensagens enviadas. Foque no objetivo e nos campos pendentes da etapa atual.
2. Seja natural! Faça perguntas agrupadas e converse de maneira empática (ex: "Que ótimo que você é de [cidade]! Me conte, você tem disponibilidade para trabalhar aos sábados ou prefere horários comerciais?").
3. Se o candidato responder que nunca trabalhou ou que não tem experiência com algum dos campos da etapa de EXPERIÊNCIA, respeite a resposta de imediato, NÃO insista em experiências inexistentes, mude suavemente para explorar as suas características de perfil (Responsabilidade, Facilidade de aprendizado, Cursos, Projetos, etc.).
4. NUNCA faça perguntas sobre dados que já constam como preenchidos nos "Dados já coletados" acima. Se o nome ou cidade já foi coletado, use-o com naturalidade para cumprimentar ou contextualizar.
5. Quando o status da etapa for "COMPLETED" (ou todos os campos estiverem preenchidos), conclua a entrevista de forma extremamente acolhedora e educada, agradecendo pelo tempo do candidato, e adicione obrigatoriamente a tag secreta "[ENTREVISTA_CONCLUIDA]" ao final de sua resposta.

MENSAGEM FINAL CONFIGURADA:
${recruiterSettings.finalMessage}`;

    let responseText = '';
    try {
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...lastThreeMessages as any
        ],
        temperature: 0.7
      });

      responseText = chatResponse.choices[0].message.content || '';
    } catch (chatError: any) {
      console.error('[INTERVIEW_ENGINE] Response generation failed:', chatError);
      throw new Error(`Erro de conexão com o motor de entrevistas por IA: ${chatError.message}`);
    }

    // Double check completed state triggers
    if (state.currentStage === 'COMPLETED' && !responseText.includes('[ENTREVISTA_CONCLUIDA]')) {
      responseText = `${responseText}\n\n[ENTREVISTA_CONCLUIDA]`;
    }

    // Save state
    await this.saveInterviewState(interviewId, state);

    return {
      responseText,
      state
    };
  }
}

export const interviewEngine = new InterviewEngineClass();
