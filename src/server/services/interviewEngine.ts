import OpenAI from 'openai';
import { db } from '../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { isValidRequiredValue, DEFAULT_REQUIRED_QUESTIONS_TEXT } from '../../services/candidateService.js';

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
  structuredData: Record<string, any>;
  answeredFields?: Record<string, boolean>;
  requiredQuestions?: { key: string; question: string }[];
  isComplete?: boolean;
  createdAt: string;
  updatedAt: string;
  chatMessages?: any[];
  currentQuestionIndex?: number;
}

const REQUIRED_KEYS_MAP: Record<string, string> = {
  // ETAPA 1 — Identificação
  nomeCompleto: 'nome completo',
  idade: 'idade',
  cidade: 'cidade',
  bairro: 'bairro',
  whatsapp: 'WhatsApp',
  email: 'e-mail',

  // ETAPA 2 — Disponibilidade
  disponibilidadeHorarios: 'disponibilidade de horários',
  disponibilidadeSabados: 'disponibilidade aos sábados',
  disponibilidadeDatasEspeciais: 'disponibilidade para datas especiais',
  disponibilidadePromocoes: 'disponibilidade para períodos de promoções',
  disponibilidadeLiveShop: 'disponibilidade para participar de lives ou Live Shop',
  dataInicio: 'quando pode começar / data de início',
  tipoInteresse: 'tipo de interesse (vaga fixa, temporária ou freelancer)',

  // ETAPA 3 — Experiência
  experienciaProfissional: 'experiência profissional geral',
  experienciaAtendimento: 'experiência com atendimento ao cliente',
  experienciaVendas: 'experiência com vendas de produtos',
  experienciaLojaCaixaEstoquePdv: 'experiência com rotinas de loja, caixa, estoque, organização ou PDV',
  experienciaWhatsappComercial: 'experiência em atendimento comercial via WhatsApp',
  ultimaExperiencia: 'última empresa/experiência profissional ou informar se nunca trabalhou',
  cargoUltimaExperiencia: 'cargo ocupado na última experiência profissional',
  tempoPermanencia: 'tempo de permanência na última empresa/vaga',
  motivoSaida: 'motivo de saída da última empresa',

  // ETAPA 4 — Perfil profissional
  facilidadeAprender: 'se tem facilidade em aprender novas tarefas',
  organizacao: 'se possui boa organização pessoal e de estoque',
  trabalhoEquipe: 'se tem facilidade ou gosta de trabalhar em equipe',
  confortoProdutosIntimos: 'conforto, organização, responsabilidade e respeito ao trabalhar com produtos íntimos e de sex shop',
  entendimentoDiscricao: 'entendimento sobre a importância de discrição e sigilo absoluto no atendimento',
  clienteIndeciso: 'como lidaria com um cliente indeciso ou tímido na boutique',
  perguntasIntimas: 'como reagiria ou responderia a perguntas íntimas ou pessoais feitas por clientes',
  facilidadeRedesSociais: 'facilidade ou desenvoltura com Instagram, gravação de stories, vídeos ou participação de live shops',

  // ETAPA 5 — Finalização
  pontoForte: 'seu principal ponto forte ou diferencial',
  pontoDesenvolver: 'uma característica ou ponto que deseja desenvolver ou melhorar',
  expectativaSalarial: 'sua expectativa salarial ou de remuneração',
  mensagemFinal: 'sua mensagem final para a empresa ou considerações adicionais'
};

export function parseRequiredQuestions(questionsText: string): { key: string; question: string }[] {
  if (!questionsText) return [];
  const lines = questionsText.split('\n');
  const result: { key: string; question: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const question = parts.slice(1).join('|').trim();
      if (key && question) {
        result.push({ key, question });
      }
    }
  }
  return result;
}

export function getRequiredQuestionsList(recruiterSettings?: any): { key: string; question: string; label: string }[] {
  const text = recruiterSettings?.requiredQuestionsText || '';
  const parsed = parseRequiredQuestions(text);
  if (parsed.length > 0) {
    return parsed.map(p => ({
      key: p.key,
      question: p.question,
      label: REQUIRED_KEYS_MAP[p.key] || p.key
    }));
  }
  // Fallback to DEFAULT_REQUIRED_QUESTIONS_TEXT
  const defaultParsed = parseRequiredQuestions(DEFAULT_REQUIRED_QUESTIONS_TEXT);
  return defaultParsed.map(p => ({
    key: p.key,
    question: p.question,
    label: REQUIRED_KEYS_MAP[p.key] || p.key
  }));
}

export function canCompleteInterview(structuredData: Record<string, string>, recruiterSettings?: any): boolean {
  return getMissingRequiredFields(structuredData, recruiterSettings).length === 0;
}

export function getMissingRequiredFields(structuredData: Record<string, string>, recruiterSettings?: any): string[] {
  const reqQuestions = getRequiredQuestionsList(recruiterSettings);
  return reqQuestions
    .map(q => q.key)
    .filter(key => {
      const val = structuredData[key];
      return !isValidRequiredValue(key, val);
    });
}

export function getNextRequiredQuestion(missingFields: string[]): string {
  if (missingFields.length === 0) return '';
  const firstMissing = missingFields[0];
  const label = REQUIRED_KEYS_MAP[firstMissing] || firstMissing;
  return `Por favor, faça uma pergunta simpática para obter o seguinte dado pendente do candidato: ${label}.`;
}

export function isValidWhatsApp(val: string): boolean {
  const digits = val.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export function isValidEmail(val: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(val.trim());
}

// Default Template for Discreta Boutique's recruitment process
export const DEFAULT_TEMPLATE: InterviewTemplate = {
  jobType: 'Default',
  prompt: 'Você é a recrutadora virtual Aurora da Discreta Boutique.',
  stages: [
    {
      id: 'IDENTIFICACAO',
      objective: 'Conhecer o candidato e obter seus dados básicos de identificação e contato sem solicitar endereço completo, apenas cidade e bairro.',
      fields: [
        { key: 'nomeCompleto', label: 'Nome completo', description: 'Nome completo do candidato' },
        { key: 'idade', label: 'Idade', description: 'Idade do candidato' },
        { key: 'cidade', label: 'Cidade', description: 'Cidade onde o candidato reside (apenas a cidade)' },
        { key: 'bairro', label: 'Bairro', description: 'Bairro onde o candidato reside (apenas o bairro)' },
        { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp do candidato com DDD' },
        { key: 'email', label: 'E-mail', description: 'E-mail válido do candidato' }
      ]
    },
    {
      id: 'DISPONIBILIDADE',
      objective: 'Entender a disponibilidade de horários, sábados, datas especiais, promoções, participação de Live Shop, data de início e tipo de interesse.',
      fields: [
        { key: 'disponibilidadeHorarios', label: 'Disponibilidade de Horários', description: 'Horários disponíveis para trabalhar' },
        { key: 'disponibilidadeSabados', label: 'Disponibilidade aos Sábados', description: 'Disponibilidade de trabalhar aos sábados' },
        { key: 'disponibilidadeDatasEspeciais', label: 'Disponibilidade para Datas Especiais', description: 'Disponibilidade para trabalhar em datas especiais de vendas' },
        { key: 'disponibilidadePromocoes', label: 'Disponibilidade para Promoções', description: 'Disponibilidade para trabalhar em períodos de promoções' },
        { key: 'disponibilidadeLiveShop', label: 'Disponibilidade para Live Shop', description: 'Disponibilidade para participar de transmissões ao vivo ou Live Shop' },
        { key: 'dataInicio', label: 'Data de início', description: 'Previsão de data ou prazo para iniciar no trabalho' },
        { key: 'tipoInteresse', label: 'Tipo da vaga de interesse', description: 'Fixo, Temporário ou Freelancer' }
      ]
    },
    {
      id: 'EXPERIENCIA',
      objective: 'Conhecer a trajetória profissional do candidato, focando em experiência geral, atendimento, vendas, rotinas de loja, caixa, estoque, WhatsApp comercial, última experiência, cargo, tempo de permanência e saída do último emprego.',
      fields: [
        { key: 'experienciaProfissional', label: 'Experiência profissional geral', description: 'Histórico ou resumo profissional geral' },
        { key: 'experienciaAtendimento', label: 'Experiência com atendimento', description: 'Experiência prévia com atendimento ao cliente' },
        { key: 'experienciaVendas', label: 'Experiência com vendas', description: 'Experiência com vendas de produtos' },
        { key: 'experienciaLojaCaixaEstoquePdv', label: 'Experiência com loja/caixa/estoque/PDV', description: 'Experiência com rotinas de loja, caixa, estoque, organização ou PDV' },
        { key: 'experienciaWhatsappComercial', label: 'Experiência com WhatsApp comercial', description: 'Experiência em atendimento comercial via WhatsApp' },
        { key: 'ultimaExperiencia', label: 'Última experiência profissional', description: 'Última empresa onde trabalhou (ou se nunca trabalhou)' },
        { key: 'cargoUltimaExperiencia', label: 'Cargo na última experiência', description: 'Cargo ou função desempenhada no último emprego' },
        { key: 'tempoPermanencia', label: 'Tempo de permanência', description: 'Quanto tempo ficou no último emprego' },
        { key: 'motivoSaida', label: 'Motivo de saída', description: 'Motivo do desligamento do último emprego ou não se aplica' }
      ]
    },
    {
      id: 'PERFIL',
      objective: 'Avaliar características comportamentais, soft skills (aprendizado, organização, trabalho em equipe), discrição, desenvoltura com redes sociais e vendas de produtos íntimos.',
      fields: [
        { key: 'facilidadeAprender', label: 'Facilidade em aprender', description: 'Se possui facilidade ou interesse em aprender novas tarefas' },
        { key: 'organizacao', label: 'Organização', description: 'Nível de organização pessoal, cuidado com ambiente ou organização de estoque' },
        { key: 'trabalhoEquipe', label: 'Trabalho em equipe', description: 'Gosto ou facilidade em trabalhar colaborando com outras pessoas' },
        { key: 'confortoProdutosIntimos', label: 'Conforto com produtos íntimos', description: 'Se possui conforto, organização, responsabilidade e respeito ao trabalhar com produtos íntimos e de sex shop' },
        { key: 'entendimentoDiscricao', label: 'Entendimento sobre discrição', description: 'Importância de discrição e sigilo absoluto no atendimento' },
        { key: 'clienteIndeciso', label: 'Como lidaria com cliente indeciso', description: 'Como lidaria com um cliente indeciso ou tímido' },
        { key: 'perguntasIntimas', label: 'Como lidaria com perguntas íntimas', description: 'Como reagiria a perguntas pessoais ou íntimas dos clientes' },
        { key: 'facilidadeRedesSociais', label: 'Facilidade com redes sociais / Instagram', description: 'Desenvoltura para produzir conteúdo no Instagram, stories, vídeos ou participar de live shops' }
      ]
    },
    {
      id: 'FINAL',
      objective: 'Coletar os pontos fortes, pontos a desenvolver, expectativa salarial e mensagem de fechamento do candidato.',
      fields: [
        { key: 'pontoForte', label: 'Ponto forte', description: 'Seu principal ponto forte ou diferencial' },
        { key: 'pontoDesenvolver', label: 'Ponto a desenvolver', description: 'Uma característica que deseja melhorar ou desenvolver' },
        { key: 'expectativaSalarial', label: 'Expectativa salarial', description: 'Expectativa de remuneração ou salário' },
        { key: 'mensagemFinal', label: 'Mensagem final para a empresa', description: 'Mensagem final do candidato direcionada à empresa' }
      ]
    }
  ]
};

function isComplaintMsg(msg: string): boolean {
  const clean = msg.toLowerCase().trim();
  const patterns = [
    'ja respondi', 'já respondi',
    'ja falei', 'já falei',
    'ja disse', 'já disse',
    'ja informei', 'já informei',
    'voce ja perguntou', 'você já perguntou',
    'voce perguntou', 'você perguntou',
    'ja perguntei', 'já perguntei',
    'ja repeti', 'já repeti',
    'eu ja falei', 'eu já falei',
    'eu ja respondi', 'eu já respondi',
    'eu ja disse', 'eu já disse',
    'ja respondi isso', 'já respondi isso',
    'ja te respondi', 'já te respondi',
    'ja te falei', 'já te falei',
    'ja comentei', 'já comentei',
    'você já me perguntou', 'voce ja me perguntou'
  ];
  return patterns.some(pattern => clean.includes(pattern));
}

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
  async getInterviewState(interviewId: string, recruiterSettings?: any): Promise<InterviewState> {
    const docRef = doc(db, 'interviewStates', interviewId);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const reqQuestions = getRequiredQuestionsList(recruiterSettings);
        return {
          interviewId,
          currentStage: data.currentStage || 'IDENTIFICACAO',
          completedStages: data.completedStages || [],
          pendingFields: data.pendingFields || [],
          structuredData: data.structuredData || {},
          answeredFields: data.answeredFields || {},
          requiredQuestions: data.requiredQuestions || reqQuestions.map(q => ({ key: q.key, question: q.question })),
          isComplete: data.isComplete || false,
          chatMessages: data.chatMessages || [],
          currentQuestionIndex: data.currentQuestionIndex !== undefined ? data.currentQuestionIndex : 0,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('[INTERVIEW_ENGINE] Could not fetch state from Firestore, starting fresh.', error);
    }

    const reqQuestions = getRequiredQuestionsList(recruiterSettings);
    // Default initialization
    const initialFields = reqQuestions.map(f => f.key);
    return {
      interviewId,
      currentStage: 'IDENTIFICACAO',
      completedStages: [],
      pendingFields: initialFields,
      structuredData: {},
      answeredFields: {},
      requiredQuestions: reqQuestions.map(q => ({ key: q.key, question: q.question })),
      isComplete: false,
      chatMessages: [],
      currentQuestionIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Saves the InterviewState back to Firestore
  async saveInterviewState(interviewId: string, state: InterviewState, recruiterSettings?: any): Promise<void> {
    const docRef = doc(db, 'interviewStates', interviewId);
    try {
      const reqQuestions = getRequiredQuestionsList(recruiterSettings);
      const isComp = state.currentQuestionIndex !== undefined 
        ? state.currentQuestionIndex >= reqQuestions.length 
        : false;
      const missing = reqQuestions.slice(state.currentQuestionIndex || 0).map(q => q.key);
      await setDoc(docRef, {
        ...state,
        camposPendentes: missing,
        isComplete: isComp,
        answeredFields: state.answeredFields || {},
        requiredQuestions: state.requiredQuestions || reqQuestions.map(q => ({ key: q.key, question: q.question })),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('[INTERVIEW_ENGINE] Failed to save InterviewState to Firestore:', error);
    }
  }

  // Saves Candidate application state as INCOMPLETA / NOVO in Firestore
  async saveCandidateProgress(interviewId: string, state: InterviewState, messages: any[], recruiterSettings?: any): Promise<void> {
    const docRef = doc(db, 'recruitmentApplications', interviewId);
    try {
      const snap = await getDoc(docRef);
      const existingData = snap.exists() ? snap.data() : null;

      const reqQuestions = getRequiredQuestionsList(recruiterSettings);
      const isComplete = state.currentQuestionIndex !== undefined 
        ? state.currentQuestionIndex >= reqQuestions.length 
        : false;

      // Rule 8: Only create or save inside recruitmentApplications if it's complete,
      // OR if a partial/existing document already exists (to update its status/messages/etc.)
      if (isComplete || existingData) {
        let status = isComplete ? 'NOVO' : 'INCOMPLETA';

        if (existingData && existingData.status) {
          if (existingData.status !== 'INCOMPLETA' && existingData.status !== 'NOVO') {
            status = existingData.status;
          }
        }

        const payload = {
          id: interviewId,
          candidateName: state.structuredData.nomeCompleto || 'Candidato Sem Nome',
          phone: state.structuredData.whatsapp || '',
          email: state.structuredData.email || '',
          city: state.structuredData.cidade || '',
          neighborhood: state.structuredData.bairro || '',
          status,
          lgpdAccepted: true,
          lgpdAcceptedAt: existingData?.lgpdAcceptedAt || new Date().toISOString(),
          structuredData: state.structuredData,
          chatMessages: messages,
          createdAt: existingData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ipAddress: 'Disponível no servidor',
          userAgent: 'Aurora Recruitment Bot',
          interviewId
        };

        await setDoc(docRef, payload, { merge: true });
        console.log(`[INTERVIEW_ENGINE] Progress saved to recruitmentApplications (id: ${interviewId}, status: ${status}, isComplete: ${isComplete})`);
      } else {
        // If it's not complete and does not exist in recruitmentApplications, we block creation there!
        console.log(`[INTERVIEW_ENGINE] [RECRUITMENT_APPLICATION_BLOCKED] Application document not created in recruitmentApplications yet because isComplete is false.`);
      }
    } catch (error) {
      console.error('[INTERVIEW_ENGINE] Failed to save candidate progress:', error);
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
  ): Promise<{ responseText: string; isComplete: boolean; missingFields: string[]; state: InterviewState }> {
    const state = await this.getInterviewState(interviewId, recruiterSettings);
    const template = this.getTemplate();
    const openai = this.getOpenAI();

    // Store previous pending fields to calculate currentField log
    const previousPendingFields = [...(state.pendingFields || [])];
    const requiredQuestions = getRequiredQuestionsList(recruiterSettings);

    const idxBefore = state.currentQuestionIndex !== undefined ? state.currentQuestionIndex : 0;
    const campoAtual = idxBefore < requiredQuestions.length ? requiredQuestions[idxBefore].key : '';
    const currentField = campoAtual || 'Nenhum (Iniciando)';

    // Check if answeredFields map is initialized
    if (!state.answeredFields) {
      state.answeredFields = {};
    }
    for (const q of requiredQuestions) {
      if (isValidRequiredValue(q.key, state.structuredData[q.key])) {
        if (q.key === 'nomeCompleto') {
          const words = String(state.structuredData[q.key]).trim().split(/\s+/);
          if (words.length >= 2) {
            state.answeredFields[q.key] = true;
          }
        } else {
          state.answeredFields[q.key] = true;
        }
      }
    }

    // Check if candidate complained
    const isComplaint = campoAtual ? isComplaintMsg(userMessage) : false;

    let validationInstruction = '';

    // 1. PRE-POPULATE EXPERIENCES PROGRAMMATICALLY IF NO EXPERIENCE SPECIFIED
    const userMsgLower = userMessage.toLowerCase();
    const hasNoExpKeywords = [
      'não tenho experiência', 'não possuo experiência', 'nunca trabalhei', 
      'sem experiência', 'primeiro emprego', 'nenhuma experiência',
      'nao tenho experiencia', 'nao possuo experiencia', 'nunca trabalhei'
    ].some(k => userMsgLower.includes(k));

    if (hasNoExpKeywords) {
      state.structuredData['experienciaProfissional'] = 'não possui experiência formal';
      state.structuredData['ultimaExperiencia'] = 'não se aplica';
      state.structuredData['motivoSaida'] = 'não se aplica';
      state.answeredFields['experienciaProfissional'] = true;
      state.answeredFields['ultimaExperiencia'] = true;
      state.answeredFields['motivoSaida'] = true;
    }

    // 2. EXTRACTION OR COMPLAINT PROCESSING
    if (isComplaint && campoAtual) {
      // Rule 7: Mark current field as answered and advance index, apologizing briefly
      console.log(`[INTERVIEW_ENGINE_QUEUE] Candidate complained on field ${campoAtual}. Forcing advancement.`);
      state.answeredFields[campoAtual] = true;
      if (!state.structuredData[campoAtual]) {
        state.structuredData[campoAtual] = 'Confirmado anteriormente pelo candidato';
      }
      // Advance current index
      let idxAfter = idxBefore + 1;
      while (idxAfter < requiredQuestions.length) {
        const k = requiredQuestions[idxAfter].key;
        if (state.answeredFields[k] === true || isValidRequiredValue(k, state.structuredData[k])) {
          state.answeredFields[k] = true;
          idxAfter++;
        } else {
          break;
        }
      }
      state.currentQuestionIndex = idxAfter;
    } else {
      // Update structured fields incrementally via OpenAI (ALL FIELDS AT ONCE - Rule 7)
      try {
        const fieldDescriptions = requiredQuestions
          .map(f => `- ${f.key}: ${f.label}`)
          .join('\n');

        const extractionPrompt = `Você é o extrator de dados de recrutamento da Discreta Boutique.
Sua missão é analisar a última mensagem enviada pelo candidato e atualizar de forma precisa o JSON de dados coletados.

CAMPOS DA ENTREVISTA:
${fieldDescriptions}

DADOS ESTRUTURADOS ATUAIS (JSON):
${JSON.stringify(state.structuredData, null, 2)}

ÚLTIMAS MENSAGENS:
Candidato: "${userMessage}"

INSTRUÇÕES CRÍTICAS DE EXTRAÇÃO DE DISPONIBILIDADE E CAMPOS:
1. SÓ preencha um campo se o candidato tiver mencionado explicitamente ou respondido de forma inequívoca sobre ele na mensagem.
2. NUNCA faça deduções ou adivinhe valores ("Sim" ou "Não") para campos de disponibilidade que não foram ditos.
   Por exemplo:
   - Se o candidato disser "Tenho disponibilidade de segunda a sexta, das 8h às 18h", você DEVE preencher "disponibilidadeHorarios" com essa resposta, mas NÃO preencha "disponibilidadeSabados", "disponibilidadeDatasEspeciais", "disponibilidadePromocoes" ou "disponibilidadeLiveShop". Deixe esses campos intocados para que a recrutadora pergunte-os depois.
   - Se o candidato disser "Tenho disponibilidade total todos os dias", preencha "disponibilidadeHorarios" com "total", mas NÃO preencha os demais campos de disponibilidade individual (sábados, datas especiais, promoções, liveshop) a menos que ele mencione-os de forma expressa.
3. EXTRAÇÃO DE RESPOSTAS COMPOSTAS (Se o candidato responder a múltiplas perguntas de uma vez, extraia todas com precisão):
   - Se o candidato disser "Trabalho aos sábados e datas especiais sem problemas", você DEVE extrair "disponibilidadeSabados" = "Sim" e "disponibilidadeDatasEspeciais" = "Sim".
   - Se o candidato disser "Não posso trabalhar aos sábados, mas tenho disponibilidade para promoções e live shop", você DEVE extrair "disponibilidadeSabados" = "Não", "disponibilidadePromocoes" = "Sim" and "disponibilidadeLiveShop" = "Sim".
   - Certifique-se de marcar corretamente cada um desses campos com base nas palavras explícitas do candidato.
4. SE o candidato disser que não possui experiência ou que uma pergunta não se aplica (ex: "nunca trabalhei", "não tenho experiência com isso"), preencha o campo correspondente com "Não possui", "N/A" ou equivalente curto.
5. Se o candidato dizer que nunca trabalhou ou que não tem experiência profissional, você DEVE preencher "experienciaProfissional" como "não possui experiência formal", "ultimaExperiencia" como "não se aplica" e "motivoSaida" como "não se aplica".
6. Nunca apague ou modifique informações já existentes, a menos que o candidato as tenha corrigido nesta última mensagem.

Retorne obrigatoriamente um objeto JSON com o formato exato abaixo:
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

      // Check current field validation & simple fallback validations
      let isFieldValid = false;
      if (campoAtual) {
        const extractedValue = state.structuredData[campoAtual];
        if (isValidRequiredValue(campoAtual, extractedValue)) {
          if (campoAtual === 'nomeCompleto') {
            const words = String(extractedValue).trim().split(/\s+/);
            isFieldValid = (words.length >= 2);
          } else if (campoAtual === 'whatsapp') {
            const digits = String(extractedValue).replace(/\D/g, '');
            isFieldValid = (digits.length === 10 || digits.length === 11);
          } else if (campoAtual === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isFieldValid = emailRegex.test(String(extractedValue).trim());
          } else {
            isFieldValid = true;
          }
        }

        // 11. Validações simples fallback (Rule 11)
        if (!isFieldValid) {
          const rawLower = userMessage.trim().toLowerCase();
          
          // WhatsApp: must contain 10 or 11 digits
          if (campoAtual === 'whatsapp') {
            const digits = userMessage.replace(/\D/g, '');
            if (digits.length === 10 || digits.length === 11) {
              state.structuredData['whatsapp'] = digits;
              isFieldValid = true;
            }
          }
          // Email: must contain @ and domain
          else if (campoAtual === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(userMessage.trim())) {
              state.structuredData['email'] = userMessage.trim();
              isFieldValid = true;
            }
          }
          // Idade: must contain digits
          else if (campoAtual === 'idade') {
            const digits = userMessage.replace(/\D/g, '');
            if (digits.length > 0 && Number(digits) > 0 && Number(digits) < 120) {
              state.structuredData['idade'] = digits;
              isFieldValid = true;
            }
          }
          // Nome completo: at least two words
          else if (campoAtual === 'nomeCompleto') {
            const words = userMessage.trim().split(/\s+/);
            if (words.length >= 2) {
              state.structuredData['nomeCompleto'] = userMessage.trim();
              isFieldValid = true;
            }
          }
          // Boolean/disponibilidade fields: accept "sim, não, tenho, posso, disponível, sou disponível, consigo, não posso"
          else if (
            campoAtual.startsWith('disponibilidade') || 
            campoAtual.startsWith('experiencia') || 
            ['confortoProdutosIntimos', 'facilidadeAprender', 'trabalhoEquipe', 'facilidadeRedesSociais'].includes(campoAtual)
          ) {
            const booleanKeywords = [
              'sim', 'não', 'nao', 'tenho', 'posso', 'disponível', 'disponivel', 
              'sou disponível', 'sou disponivel', 'consigo', 'não posso', 'nao posso',
              'com certeza', 'claro', 'nunca', 'jamais', 'sem problemas'
            ];
            const isMatch = booleanKeywords.some(kw => {
              const regex = new RegExp(`\\b${kw}\\b`, 'i');
              return regex.test(rawLower);
            });
            if (isMatch) {
              state.structuredData[campoAtual] = userMessage.trim();
              isFieldValid = true;
            }
          }
          // Generic fields: if user typed any text and it is not empty, we can accept it as a valid response
          else if (userMessage.trim().length >= 2) {
            state.structuredData[campoAtual] = userMessage.trim();
            isFieldValid = true;
          }
        }
      }

      if (campoAtual && isFieldValid) {
        state.answeredFields[campoAtual] = true;
      }

      // Mark all other fields as answered if their value in structuredData is valid (Rule 8)
      for (const q of requiredQuestions) {
        const val = state.structuredData[q.key];
        if (isValidRequiredValue(q.key, val)) {
          if (q.key === 'nomeCompleto') {
            const words = String(val).trim().split(/\s+/);
            if (words.length >= 2) {
              state.answeredFields[q.key] = true;
            }
          } else {
            state.answeredFields[q.key] = true;
          }
        }
      }

      // 3. VALIDATE CONTACT DATA (WhatsApp & Email format check)
      if (state.structuredData['whatsapp']) {
        const ws = state.structuredData['whatsapp'].toString().trim();
        if (ws !== '' && !isValidWhatsApp(ws)) {
          delete state.structuredData['whatsapp'];
          if (state.answeredFields) {
            delete state.answeredFields['whatsapp'];
          }
          validationInstruction += `\n- Atenção: O número de WhatsApp fornecido (${ws}) parece inválido. Por favor, peça para o candidato digitar novamente o WhatsApp com DDD (exemplo: 11999998888).`;
        }
      }

      if (state.structuredData['email']) {
        const em = state.structuredData['email'].toString().trim();
        if (em !== '' && !isValidEmail(em)) {
          delete state.structuredData['email'];
          if (state.answeredFields) {
            delete state.answeredFields['email'];
          }
          validationInstruction += `\n- Atenção: O e-mail fornecido (${em}) possui formato inválido. Por favor, peça para o candidato digitar um e-mail válido contendo @ e um domínio válido.`;
        }
      }

      // Advance index
      let idxAfter = idxBefore;
      if (campoAtual && isFieldValid) {
        idxAfter = idxBefore + 1;
      }
      while (idxAfter < requiredQuestions.length) {
        const k = requiredQuestions[idxAfter].key;
        if (state.answeredFields[k] === true) {
          idxAfter++;
        } else {
          break;
        }
      }
      state.currentQuestionIndex = idxAfter;
    }

    const idx = state.currentQuestionIndex ?? 0;
    const isComplete = idx >= requiredQuestions.length;
    state.isComplete = isComplete;

    // Remaining missing fields from the current index onwards that do not have a valid value yet
    const missing = requiredQuestions
      .slice(idx)
      .map(q => q.key)
      .filter(key => !state.answeredFields?.[key]);

    if (idx < requiredQuestions.length) {
      state.pendingFields = missing;
      const nextFieldKey = requiredQuestions[idx].key;
      
      // Find which stage in DEFAULT_TEMPLATE contains the first missing field
      let foundStage = 'IDENTIFICACAO';
      for (const stage of template.stages) {
        if (stage.fields.some(f => f.key === nextFieldKey)) {
          foundStage = stage.id;
          break;
        }
      }
      state.currentStage = foundStage;
    } else {
      state.currentStage = 'COMPLETED';
      state.pendingFields = [];
    }

    // Identify current stage config again after potential update
    let currentStageIndex = template.stages.findIndex(s => s.id === state.currentStage);
    if (currentStageIndex === -1) {
      currentStageIndex = 0;
      state.currentStage = template.stages[0].id;
    }
    let currentStageConfig = template.stages[currentStageIndex];

    // Get objective
    const currentObjective = state.currentStage === 'COMPLETED' 
      ? 'Agradecer e finalizar o processo com o candidato.'
      : currentStageConfig.objective;

    // Only send the last 5 messages (from 3 to 5) from actual history to save tokens
    const lastThreeMessages = messages.slice(-5).map(m => ({
      role: m.sender === 'bot' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.text
    }));

    // If history is empty, add the last user message
    if (lastThreeMessages.length === 0 && userMessage) {
      lastThreeMessages.push({ role: 'user', content: userMessage });
    }

    const availableJobsText = recruiterSettings.availableJobsText || '';
    const hasJobs = availableJobsText.trim() !== '';

    const nextFieldKey = idx < requiredQuestions.length ? requiredQuestions[idx].key : '';
    const nextMissingQuestion = idx < requiredQuestions.length ? requiredQuestions[idx] : null;
    
    const proximoCampoObrigatorio = nextFieldKey || 'Nenhum (Entrevista completa)';
    const perguntaObrigatoriaExata = nextMissingQuestion ? nextMissingQuestion.question : '';

    // Format answered and pending fields for explicit system prompt context
    const perguntasRespondidas = requiredQuestions
      .filter(q => isValidRequiredValue(q.key, state.structuredData[q.key]))
      .map(q => `- ${q.label} (campo: ${q.key}): "${state.structuredData[q.key]}"`)
      .join('\n') || 'Nenhuma pergunta respondida ainda.';

    const camposPendentesPrompt = requiredQuestions
      .filter(q => !isValidRequiredValue(q.key, state.structuredData[q.key]))
      .map(q => `- ${q.label} (campo: ${q.key})`)
      .join('\n') || 'Nenhum campo pendente.';

    let instrucaoFormulaConforto = '';
    if (nextFieldKey === 'confortoProdutosIntimos') {
      instrucaoFormulaConforto = `\n- REQUISITO ABSOLUTO: Ao perguntar sobre "confortoProdutosIntimos", use EXATAMENTE a seguinte formulação profissional:
  “Você se sente confortável em atuar profissionalmente em uma loja que trabalha com lingerie, produtos íntimos, bem-estar e autoestima, mantendo sempre postura discreta e respeitosa?”`;
    }

    // 5. CONSTRUCT SYSTEM PROMPT WITH REDUCED BUT COMPLETELY ACCURATE CONTEXT
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

ROTEIRO DE PERGUNTAS OBRIGATÓRIAS (requiredQuestionsText):
${recruiterSettings.requiredQuestionsText || 'Nenhum roteiro cadastrado.'}

CONTEXTO E VARIÁVEIS EXPLICITAS DA ENTREVISTA (FONTES DA VERDADE):
- etapaAtual: ${state.currentStage}
- objetivoDaEtapa: ${currentObjective}
- próxima pergunta obrigatória (campo chave): ${proximoCampoObrigatorio}
- próxima pergunta obrigatória (pergunta exata): ${perguntaObrigatoriaExata}

DADOS ESTRUTURADOS ATUAIS (structuredData):
${JSON.stringify(state.structuredData, null, 2)}

PERGUNTAS RESPONDIDAS ATÉ O MOMENTO (FONTES DA VERDADE):
${perguntasRespondidas}

CAMPOS PENDENTES RESTANTES (CAMPOS_PENDENTES):
${camposPendentesPrompt}

DIRETRIZ CRÍTICA DE PERGUNTAS SOBRE VAGAS OU SALÁRIOS (REQUISITO 8):
- Se o candidato perguntar de alguma forma sobre vagas disponíveis, cargos abertos, salários, benefícios, horários ou remuneração da boutique (ou fizer qualquer pergunta sobre vagas/salários), você DEVE responder de forma clara, simpática e objetiva apresentando as informações reais contidas na seção "VAGAS DISPONÍVEIS" acima.
- Logo em seguida, na mesma mensagem, faça uma transição natural e amigável para retomar o fluxo da entrevista e faça a pergunta correspondente ao próximo campo pendente de forma humana e acolhedora: "${perguntaObrigatoriaExata}".

INSTRUÇÃO DE CONDUÇÃO CRÍTICA (REQUISITOS OBRIGATÓRIOS DO ROTEIRO - REQUISITO 9):
- O roteiro de perguntas obrigatórias do campo "requiredQuestionsText" manda 100% no fluxo da entrevista. Você é estritamente PROIBIDA de decidir qual pergunta fazer ou de inventar novos assuntos/perguntas.
- O backend determina 100% a pergunta a ser feita. Você DEVE fazer uma pergunta simpática para obter EXATAMENTE a informação do campo: "${proximoCampoObrigatorio}".
- Para isso, use estritamente como base a pergunta definida pelo backend: "${perguntaObrigatoriaExata}". Sua única função é humanizar e redigir essa pergunta de forma natural, simpática e profissional.
- NÃO pergunte sobre nenhum outro campo, não pule para perguntas futuras e não repita perguntas já respondidas. Foque estritamente em humanizar a pergunta exata indicada acima.
${instrucaoFormulaConforto}

REGRAS DE CONDUTA PROFISSIONAL DA AURORA (REQUISITOS OBRIGATÓRIOS DO SEGMENTO ÍNTIMO):
1. Se o candidato responder de forma pessoal, íntima ou inadequada ao falar de produtos íntimos:
   - NUNCA elogie (por exemplo, nunca diga "que bom ouvir isso" ou expresse aprovação de hábitos pessoais).
   - NUNCA incentive ou comente a vida pessoal do candidato.
   - Redirecione IMEDIATAMENTE de forma profissional, elegante, polida e estritamente corporativa para o próximo tema.
   - Exemplo correto de transição e redirecionamento:
     “Entendi. Para este processo, o ponto mais importante é manter um atendimento profissional, respeitoso e discreto. Seguindo nossa entrevista, [insira aqui a sua pergunta simpática sobre o proximoCampoObrigatorio]”
2. Nunca valorize nem mencione interesse pessoal ou uso pessoal do candidato em relação a produtos íntimos. O único critério de avaliação e condução deve ser a postura profissional, o respeito absoluto, o sigilo e a discrição corporativa.

INSTRUÇÕES DO MOTOR DE ENTREVISTAS (REGRAS DE CONVENÇÃO):
- Você NÃO PODE em hipótese alguma finalizar a entrevista enquanto houver campos pendentes!
- Os seguintes campos de toda a candidatura estão pendentes no momento: ${JSON.stringify(missing.map(key => REQUIRED_KEYS_MAP[key] || key))}
- Você só deve avançar ou sugerir conclusão se a lista de campos pendentes estiver completamente vazia (camposPendentes vazio).
- Faça apenas uma pergunta de cada vez para obter as informações de forma empática e natural.
- Não mencione de forma técnica ou fria os nomes das etapas ou "campos pendentes", converse com empatia humana!
${validationInstruction ? `\nINSTRUÇÕES DE CORREÇÃO URGENTES:${validationInstruction}` : ''}

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

    // 6. BLOCK PREMATURE FINALIZATION (Rule 5)
    // isComplete is already declared above as idx >= requiredQuestions.length

    if (!isComplete) {
      // Log missing required fields (Rule 10)
      console.log(`[INTERVIEW_ENGINE] [CAMPOS_FALTANTES] Candidato: ${state.structuredData.nomeCompleto || 'Sem Nome'} | Campos pendentes (${missing.length}):`, missing);

      // Programmatic filter: Check if OpenAI is trying to ask a prefilled question
      let askedAlreadyAnswered = false;
      const answeredQuestions = requiredQuestions.filter(q => !missing.includes(q.key));
      const responseTextLower = responseText.toLowerCase();

      for (const q of answeredQuestions) {
        if (
          (q.key === 'nomeCompleto' && (responseTextLower.includes('nome completo') || responseTextLower.includes('seu nome') || responseTextLower.includes('como se chama') || responseTextLower.includes('como posso te chamar'))) ||
          (q.key === 'idade' && (responseTextLower.includes('idade') || responseTextLower.includes('quantos anos') || responseTextLower.includes('sua idade'))) ||
          (q.key === 'whatsapp' && (responseTextLower.includes('whatsapp') || responseTextLower.includes('seu número') || responseTextLower.includes('seu numero') || responseTextLower.includes('celular') || responseTextLower.includes('telefone') || responseTextLower.includes('seu contato'))) ||
          (q.key === 'email' && (responseTextLower.includes('email') || responseTextLower.includes('e-mail') || responseTextLower.includes('seu endereço de email') || responseTextLower.includes('seu endereco de email'))) ||
          (q.key === 'cidade' && (responseTextLower.includes('cidade') || responseTextLower.includes('qual cidade') || responseTextLower.includes('onde você mora') || responseTextLower.includes('onde voce mora'))) ||
          (q.key === 'bairro' && (responseTextLower.includes('bairro') || responseTextLower.includes('qual bairro'))) ||
          (q.key === 'expectativaSalarial' && (responseTextLower.includes('expectativa salarial') || responseTextLower.includes('quanto quer ganhar') || responseTextLower.includes('pretensão salarial')))
        ) {
          askedAlreadyAnswered = true;
          break;
        }
      }

      if (askedAlreadyAnswered) {
        console.warn(`[INTERVIEW_ENGINE] [CAMPOS_JA_PREENCHIDOS] Aurora tentou perguntar um campo já preenchido. Substituindo pela próxima pergunta pendente.`);
        responseText = `Perfeito, compreendido! Dando continuidade à nossa conversa, você poderia me dizer: ${perguntaObrigatoriaExata}`;
      }

      // Remove any concluding tags if sent prematurely (Rule 5)
      if (responseText.includes('[ENTREVISTA_CONCLUIDA]')) {
        // Log blocked attempted completion (Rule 10)
        console.warn(`[INTERVIEW_ENGINE] [CONCLUSAO_BLOQUEADA] Tentativa de conclusão com [ENTREVISTA_CONCLUIDA] foi bloqueada pelo backend. Motivo: existem ${missing.length} campos obrigatórios pendentes.`);
        responseText = responseText.replace('[ENTREVISTA_CONCLUIDA]', '').trim();
      }

      // Check if response text acts as a conclusion/goodbye prematurely without asking a question
      const isGoodbye = ['obrigada', 'obrigado', 'boa sorte', 'sucesso', 'agradeço', 'finalizar', 'concluir'].some(w => responseText.toLowerCase().includes(w)) && 
                        !responseText.toLowerCase().includes('?');

      if (isGoodbye) {
        // Log blocked attempted completion (Rule 10)
        console.warn(`[INTERVIEW_ENGINE] [CONCLUSAO_BLOQUEADA] Aurora tentou encerrar sem fazer pergunta amigável. Forçando pergunta sobre o próximo campo de forma estática (Requisito 2).`);
        const nextField = missing[0];
        const nextFieldLabel = REQUIRED_KEYS_MAP[nextField] || nextField;
        responseText = `Entendi perfeitamente! Muito obrigada. Agora, para darmos seguimento ao seu cadastro, você poderia me informar o seguinte detalhe: ${perguntaObrigatoriaExata ? perguntaObrigatoriaExata : nextFieldLabel}?`;
      }
    } else {
      // All fields are present! (Rule 10)
      console.log(`[INTERVIEW_ENGINE] [CONCLUSAO_PERMITIDA] Conclusão permitida somente quando todos os campos estiverem válidos. Todos os campos estão preenchidos!`);
      if (!state.completedStages.includes(state.currentStage)) {
        state.completedStages.push(state.currentStage);
      }
      state.currentStage = 'COMPLETED';
      state.pendingFields = [];

      // Append '[ENTREVISTA_CONCLUIDA]'
      if (!responseText.includes('[ENTREVISTA_CONCLUIDA]')) {
        responseText = `${responseText.trim()}\n\n[ENTREVISTA_CONCLUIDA]`;
      }
    }

    // Calculate logs asked in Rule 10
    const requiredQuestionsCount = requiredQuestions.length;
    const currentQuestionIndex = requiredQuestions.findIndex(q => q.key === nextFieldKey);

    // Rule 10 MANDATORY Logs
    console.log(`[INTERVIEW_ENGINE] Logs do Chat:`, {
      currentField,
      nextField: nextFieldKey || 'Nenhum (Entrevista completa)',
      pendingFields: missing,
      smartSearchDisabled: true,
      requiredQuestionsCount,
      currentQuestionIndex: currentQuestionIndex !== -1 ? currentQuestionIndex : requiredQuestionsCount
    });

    // Save interview state
    await this.saveInterviewState(interviewId, state, recruiterSettings);

    // Save candidate progress to Firestore collection 'recruitmentApplications'
    await this.saveCandidateProgress(interviewId, state, messages, recruiterSettings);

    return {
      responseText,
      isComplete,
      missingFields: missing,
      state
    };
  }
}

export const interviewEngine = new InterviewEngineClass();
