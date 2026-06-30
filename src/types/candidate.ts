export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

export interface CandidateStructuredData {
  nomeCompleto: string;
  idade: string;
  cidade: string;
  bairro: string;
  whatsapp: string;
  email: string;
  disponibilidadeHorario: string;
  disponibilidadeSabados: string;
  disponibilidadeEventos: string;
  quandoComecar: string;
  tipoInteresse: 'fixo' | 'temporário' | 'freelancer' | string;
  experienciaAtendimento: string;
  experienciaVendas: string;
  experienciaLoja: string;
  experienciaWhatsComercial: string;
  ultimaExperiencia: string;
  motivoSaida: string;
  confortoProdutosIntimos: string;
  entendimentoDiscricao: string;
  comoLidariaClienteIndeciso: string;
  comoLidariaPerguntasIntimas: string;
  facilidadeInstagram: string;
  pontoForte: string;
  pontoMelhorar: string;
  expectativaSalarial: string;
  mensagemFinal: string;
}

export interface CandidateAIAnalysis {
  resumoProfissional: string;
  pontosFortes: string[];
  pontosAtencao: string[];
  nivelAderencia: 'alto' | 'medio' | 'baixo';
  justificativaObjetiva: string;
  perguntasRecomendadas: string[];
  camposIncompletos: string[];
  observacaoFinal: string;
  avaliadoEm?: string;
}

export interface Candidate {
  id?: string;
  candidateName: string;
  phone: string;
  email: string;
  city: string;
  neighborhood: string;
  status: 'NOVO' | 'EM_ANALISE' | 'CHAMAR_ENTREVISTA' | 'APROVADO' | 'REPROVADO' | 'ARQUIVADO';
  lgpdAccepted: boolean;
  lgpdAcceptedAt: any;
  createdAt: any;
  updatedAt: any;
  structuredData: CandidateStructuredData;
  chatMessages: ChatMessage[];
  adminNotes?: string;
  aiAnalysis?: CandidateAIAnalysis;
  interviewQuestions?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecruitmentSettings {
  promptPrincipal: string;
  promptAnalise: string;
  recruiterName: string;
  initialMessage: string;
  finalMessage: string;
  isActive: boolean;
  lgpdText: string;
  availableJobsText?: string;
}
