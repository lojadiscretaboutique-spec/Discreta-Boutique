import { collection, doc, getDocs, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Candidate, RecruitmentSettings } from '../types/candidate';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error in Candidate Service: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = 'recruitmentApplications';
const SETTINGS_COLLECTION = 'recruitmentSettings';
const SETTINGS_DOC_ID = 'main';

export function isValidRequiredValue(key: string, value: any): boolean {
  if (value === null || value === undefined) return false;
  const str = value.toString().trim();
  if (str === '') return false;

  const lower = str.toLowerCase();
  if (
    lower === 'não informado' || 
    lower === 'nao informado' || 
    lower === 'n/a' || 
    lower === 'não sei' || 
    lower === 'nao sei' || 
    lower === 'não quero responder' || 
    lower === 'nao quero responder' ||
    lower === 'pendente'
  ) {
    return false;
  }

  if (key === 'whatsapp') {
    const digits = str.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) {
      return false;
    }
  }

  if (key === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(str)) {
      return false;
    }
  }

  return true;
}

export const DEFAULT_REQUIRED_QUESTIONS_TEXT = `nomeCompleto | Para começarmos, qual é o seu nome completo?
idade | Qual é a sua idade?
cidade | Em qual cidade você mora?
bairro | Qual é o seu bairro?
whatsapp | Qual é o seu WhatsApp com DDD?
email | Qual é o seu e-mail?
disponibilidadeHorarios | Quais horários você tem disponibilidade para trabalhar?
disponibilidadeSabados | Você tem disponibilidade para trabalhar aos sábados?
disponibilidadeDatasEspeciais | Você tem disponibilidade para trabalhar em datas especiais?
disponibilidadePromocoes | Você tem disponibilidade para participar de períodos de promoções?
disponibilidadeLiveShop | Você tem disponibilidade para apoiar ou participar de Live Shop?
dataInicio | Quando você poderia começar?
tipoInteresse | Seu interesse é em vaga fixa, temporária ou freelancer?
experienciaProfissional | Você já teve alguma experiência profissional? Conte um pouco.
experienciaAtendimento | Você já trabalhou com atendimento ao cliente?
experienciaVendas | Você já trabalhou com vendas?
experienciaLojaCaixaEstoquePdv | Você tem experiência com loja, caixa, estoque, organização ou PDV?
experienciaWhatsappComercial | Você já trabalhou com atendimento comercial pelo WhatsApp?
ultimaExperiencia | Qual foi sua última experiência profissional?
cargoUltimaExperiencia | Qual cargo ou função você exercia?
tempoPermanencia | Quanto tempo permaneceu nessa experiência?
motivoSaida | Qual foi o motivo de saída?
facilidadeAprender | Você tem facilidade para aprender novos processos?
organizacao | Como você avalia sua organização no trabalho?
trabalhoEquipe | Como você costuma trabalhar em equipe?
confortoProdutosIntimos | Você se sente confortável em atuar profissionalmente em uma loja que trabalha com lingerie, produtos íntimos, bem-estar e autoestima, mantendo sempre postura discreta e respeitosa?
entendimentoDiscricao | O que você entende por discrição no atendimento ao cliente?
clienteIndeciso | Como você lidaria com um cliente indeciso?
perguntasIntimas | Como você lidaria com perguntas íntimas feitas por clientes, mantendo postura profissional?
facilidadeRedesSociais | Você tem facilidade com Instagram, stories, vídeos ou Live Shop?
pontoForte | Qual é o seu principal ponto forte?
pontoDesenvolver | Qual ponto você acredita que precisa desenvolver?
expectativaSalarial | Qual sua expectativa salarial?
mensagemFinal | Para finalizar, deixe uma mensagem para a Discreta Boutique.`;

export const DEFAULT_RECRUITMENT_SETTINGS: RecruitmentSettings = {
  promptPrincipal: `Você é Aurora, a recrutadora virtual da Discreta Boutique. Lingerie e produtos íntimos.
Conduza uma entrevista profissional de forma extremamente educada, acolhedora, objetiva e discreta.
Seu objetivo é coletar as informações necessárias sobre o candidato, uma por vez, de maneira conversacional.
Pergunte e recolha as informações sobre os seguintes aspectos:
- Nome completo, idade, cidade e bairro, WhatsApp e e-mail.
- Disponibilidade de horários, incluindo sábados e datas especiais/lives/promoções.
- Quando pode começar e tipo de interesse (fixo, temporário ou freelancer).
- Experiências profissionais anteriores (com atendimento, vendas, loja/caixa/estoque, WhatsApp comercial).
- Detalhes da última experiência e o motivo de saída.
- Conforto com o nicho de produtos íntimos e o significado de discrição no atendimento.
- Como lidaria com cliente indeciso e perguntas íntimas.
- Facilidade com redes sociais (Instagram, stories, vídeos ou lives).
- Ponto forte, ponto a desenvolver, expectativa salarial e uma mensagem final para a empresa.

REGRAS CRÍTICAS:
- Faça apenas UMA pergunta de cada vez. Aguarde a resposta antes de prosseguir.
- Se o candidato der respostas muito curtas ou vagas, peça educadamente um pouco mais de detalhe.
- Nunca saia do assunto do processo seletivo.
- Não peça documentos (CPF, RG), fotos, endereço completo ou dados bancários.
- Não fale sobre política, religião, saúde, sexualidade, vida íntima, aparência física ou temas sensíveis.
- Não aprove, não reprove e não prometa contratação.
- Ao certificar-se de que coletou e confirmou todas as informações ou após o candidato responder a última mensagem com sua mensagem final para a empresa, você deve encerrar educadamente e incluir obrigatoriamente a tag secreta [ENTREVISTA_CONCLUIDA] no final do texto.`,

  promptAnalise: `Você é o Diretor de Recrutamento da Discreta Boutique.
Analise a ficha estruturada e a conversa do candidato.
Avalie sua adequação ao perfil da boutique, conforto com produtos íntimos e profissionalismo.
Retorne um JSON válido contendo exatamente a estrutura abaixo:
{
  "resumoProfissional": "Resumo objetivo da trajetória e perfil do candidato",
  "pontosFortes": ["ponto 1", "ponto 2", ...],
  "pontosAtencao": ["ponto de atenção 1", "ponto de atenção 2", ...],
  "nivelAderencia": "alto" | "medio" | "baixo",
  "justificativaObjetiva": "Justificativa clara baseada nas competências e perfil",
  "perguntasRecomendadas": ["pergunta 1", "pergunta 2", ...],
  "camposIncompletos": ["campo 1", ...],
  "observacaoFinal": "Comentários finais de avaliação"
}`,
  recruiterName: "Aurora",
  initialMessage: "Olá! Sou a Aurora, recrutadora virtual da Discreta Boutique. É um prazer ter você aqui querendo fazer parte do nosso time. Vamos iniciar nossa conversa?",
  finalMessage: "Muito obrigada pelas suas respostas! Seu processo de inscrição foi concluído com sucesso. Nossa equipe de recursos humanos e gerência revisará sua ficha e, se houver compatibilidade com nossas vagas, entraremos em contato direto.",
  isActive: true,
  lgpdText: "Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/18), informamos que os dados cadastrados nesta conversa (como nome, contato, informações profissionais e percepções de mercado) serão tratados exclusivamente para análise de aptidão ao nosso time e contatos de recrutamento. Seus dados serão mantidos em sigilo absoluto em nossa infraestrutura de segurança e nunca serão compartilhados com terceiros. Você pode solicitar a remoção permanente de sua ficha a qualquer momento pelo nosso canal oficial de atendimento.",
  availableJobsText: "",
  requiredQuestionsText: DEFAULT_REQUIRED_QUESTIONS_TEXT,
  shareImageUrl: "",
  shareDescription: ""
};

export const candidateService = {
  /**
   * Saves a new candidate application in Firestore.
   */
  async createCandidate(candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'> & { interviewId?: string }): Promise<string> {
    const targetId = candidate.interviewId || doc(collection(db, COLLECTION_NAME)).id;
    const docRef = doc(db, COLLECTION_NAME, targetId);

    let existingData: any = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        existingData = snap.data();
      }
    } catch (e) {
      // Ignore
    }

    // Validate completeness of all 34 required fields
    const requiredKeys = [
      'nomeCompleto', 'idade', 'cidade', 'bairro', 'whatsapp', 'email',
      'disponibilidadeHorarios', 'disponibilidadeSabados', 'disponibilidadeDatasEspeciais', 'disponibilidadePromocoes', 'disponibilidadeLiveShop', 'dataInicio', 'tipoInteresse',
      'experienciaProfissional', 'experienciaAtendimento', 'experienciaVendas', 'experienciaLojaCaixaEstoquePdv', 'experienciaWhatsappComercial', 'ultimaExperiencia', 'cargoUltimaExperiencia', 'tempoPermanencia', 'motivoSaida',
      'facilidadeAprender', 'organizacao', 'trabalhoEquipe', 'confortoProdutosIntimos', 'entendimentoDiscricao', 'clienteIndeciso', 'perguntasIntimas', 'facilidadeRedesSociais',
      'pontoForte', 'pontoDesenvolver', 'expectativaSalarial', 'mensagemFinal'
    ];

    const isComplete = requiredKeys.every(key => {
      const val = candidate.structuredData && (candidate.structuredData as any)[key];
      return isValidRequiredValue(key, val);
    });

    let finalStatus = isComplete ? 'NOVO' : 'INCOMPLETA';

    if (existingData && existingData.status) {
      if (existingData.status !== 'INCOMPLETA' && existingData.status !== 'NOVO') {
        finalStatus = existingData.status;
      }
    }

    const payload = {
      ...candidate,
      id: targetId,
      status: finalStatus,
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, payload, { merge: true });
      return targetId;
    } catch (error) {
      return handleFirestoreError(error, OperationType.CREATE, `${COLLECTION_NAME}/${targetId}`);
    }
  },

  /**
   * Lists all candidates from Firestore.
   */
  async listCandidates(): Promise<Candidate[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      const candidates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Candidate));

      // Sort in-memory by createdAt descending
      candidates.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      return candidates;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  /**
   * Updates the status of a candidate application.
   */
  async updateCandidateStatus(id: string, status: Candidate['status']): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Updates internal notes (observações internas) for a candidate application.
   */
  async updateCandidateNotes(id: string, notes: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        adminNotes: notes,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Updates the AI Analysis of a candidate application.
   */
  async updateCandidateAIAnalysis(id: string, aiAnalysis: Candidate['aiAnalysis']): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        aiAnalysis,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Updates the interview questions of a candidate application.
   */
  async updateCandidateInterviewQuestions(id: string, questions: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        interviewQuestions: questions,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Deletes a candidate's application from Firestore (LGPD compliance).
   */
  async deleteCandidate(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Saves settings in Firestore.
   */
  async saveSettings(settings: RecruitmentSettings): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    try {
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/${SETTINGS_DOC_ID}`);
    }
  },

  /**
   * Gets settings from Firestore, returning defaults if not found.
   */
  async getSettings(): Promise<RecruitmentSettings> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          promptPrincipal: data.promptPrincipal || DEFAULT_RECRUITMENT_SETTINGS.promptPrincipal,
          promptAnalise: data.promptAnalise || DEFAULT_RECRUITMENT_SETTINGS.promptAnalise,
          recruiterName: data.recruiterName || DEFAULT_RECRUITMENT_SETTINGS.recruiterName,
          initialMessage: data.initialMessage || DEFAULT_RECRUITMENT_SETTINGS.initialMessage,
          finalMessage: data.finalMessage || DEFAULT_RECRUITMENT_SETTINGS.finalMessage,
          isActive: data.isActive !== undefined ? data.isActive : DEFAULT_RECRUITMENT_SETTINGS.isActive,
          lgpdText: data.lgpdText || DEFAULT_RECRUITMENT_SETTINGS.lgpdText,
          availableJobsText: data.availableJobsText || DEFAULT_RECRUITMENT_SETTINGS.availableJobsText,
          requiredQuestionsText: data.requiredQuestionsText || DEFAULT_RECRUITMENT_SETTINGS.requiredQuestionsText
        };
      }
      return DEFAULT_RECRUITMENT_SETTINGS;
    } catch (error) {
      console.warn('Could not read recruitment settings, falling back to defaults.', error);
      return DEFAULT_RECRUITMENT_SETTINGS;
    }
  }
};
